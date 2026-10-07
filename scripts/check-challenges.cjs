"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const config = require("../js/config.js"), rules = require("../js/rules.js"), growth = require("../js/growth.js"), storage = require("../js/storage.js"), challenges = require("../js/challenges.js");
const now = "2026-10-04T08:00:00.000Z", checks = [], generations = [];
function check(name, action) { action(); checks.push(name); console.log(name); }
const prefs = { soundEnabled: true, highScore: 0, bestClearedLevel: 0 };
function database() { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }
function init(challenge) {
  const doc = growth.createDocument(prefs, now), run = rules.createRun(config, 1, { challenge, runSeed: challenge.seed });
  const cp = rules.captureCheckpoint(run, "level", config);
  growth.createActive(doc, cp, `check-${challenge.mode}-${challenge.seed}`, now, false); growth.enterLevel(doc, cp, now);
  return { doc, run };
}
function collect(run) {
  while (run.elapsedTime < 45 && !run.settled && run.levelIncome < run.level.target) {
    if (run.hook.phase === "swinging" && run.minerals.some(m => m.safeRoute && m.status === "available"
      && Math.abs(Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI - run.hook.angle) <= .5)) rules.launchHook(run);
    rules.advanceRun(run, 1 / 120, config);
  }
  assert.ok(run.levelIncome >= run.level.target, "正式规则安全路线必须达标");
  rules.advanceRun(run, 100, config);
}
check("Seed 规范化：0、上限、前导零和空白；拒绝空、负、小数、科学计数、溢出", () => {
  assert.equal(challenges.normalizeSeed(" 00042 "), 42); assert.equal(challenges.normalizeSeed("0"), 0); assert.equal(challenges.normalizeSeed("4294967295"), 0xffffffff);
  for (const value of ["", " ", "-1", "1.2", "1e3", "4294967296", "NaN", "Infinity", "abc", null, undefined]) assert.equal(challenges.normalizeSeed(value), null);
});
check("UTC+8 午夜、闰日、非法日期、时钟回退和版本派生", () => {
  assert.equal(challenges.dailyDate("2026-10-03T15:59:59Z"), "2026-10-03"); assert.equal(challenges.dailyDate("2026-10-03T16:00:00Z"), "2026-10-04");
  assert.equal(challenges.dailyDate("2026-10-04T00:00:00+08:00"), "2026-10-04");
  assert.ok(challenges.validDate("2024-02-29")); assert.ok(!challenges.validDate("2026-02-29")); assert.throws(() => challenges.dailySeed("2026-13-01"));
  assert.notEqual(challenges.dailySeed("2026-10-04"), challenges.dailySeed("2026-10-03")); assert.notEqual(challenges.dailySeed("2026-10-04"), challenges.dailySeed("2026-10-04", "1.6.0"));
  assert.equal(challenges.dailyDate("2026-10-03T00:00:00Z"), "2026-10-03");
});
check("事件独立用途、机会边界、不连续和五种事件覆盖", () => {
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) for (let n = 1; n <= 41; n++) {
    const event = rules.selectEvent(config, n, seed); assert.equal(event, rules.selectEvent(config, n, seed));
    if (n < 5 || n % 5 !== 0) assert.equal(event, "none");
    if (event !== "none") { seen.add(event); assert.equal(rules.selectEvent(config, n + 1, seed), "none"); }
  }
  assert.equal(seen.size, 5); assert.throws(() => rules.selectEvent(config, 0, 0));
});
check("660 份普通/事件地图：升档、极大关号、有界、无重叠、危险物上限、45 秒真实规则路线", () => {
  for (const eventId of Object.keys(config.events.definitions)) for (const n of [5, 10, 19, 20, 29, 30, 39, 40, 100, 1000, Number.MAX_SAFE_INTEGER]) {
    let maxSeconds = 0, fallbackCount = 0;
    for (let seed = 0; seed < 10; seed++) {
      const level = rules.createLevel(config, n, seed, eventId), duplicate = rules.createLevel(config, n, seed, eventId);
      assert.deepEqual(level, duplicate); assert.ok(level.count <= 29 && level.layout.length === level.count);
      assert.ok(Number.isSafeInteger(level.target)); assert.ok(level.route.success && level.route.seconds <= 45);
      for (const m of level.layout) assert.ok(rules.validPlacement(m, level.layout.filter(other => other !== m), config));
      assert.ok(level.layout.filter(m => m.type === "powderKeg").length <= level.event.maxPowderKegs);
      assert.ok(level.layout.filter(m => m.type === "cursedRelic").length <= 2);
      assert.ok(new Set(level.layout.filter(m => config.survival.newTypes.includes(m.type)).map(m => m.type)).size >= 2);
      if (level.event.id === "unstable") assert.ok(level.layout.filter(m => m.type === "powderKeg").length >= 2);
      if (level.event.id === "diamondVein") assert.equal(level.layout.filter(m => m.safeRoute && m.type === "diamond").length, 6);
      if (level.event.id === "goldRush") assert.ok(level.layout.some(m => !m.safeRoute && m.type === "largeGold"));
      maxSeconds = Math.max(maxSeconds, level.route.seconds); fallbackCount += Number(level.fallback);
    }
    generations.push({ eventId, levelId: n, seeds: 10, maxSeconds, fallbackCount });
  }
});
check("强制备用和不可行事件降级可复现，最终描述与实际矿层一致", () => {
  const forced = { ...config, survival: { ...config.survival, maxAttempts: 0 } };
  for (const id of Object.keys(config.events.definitions)) for (const n of [5, 20, 30, 40, Number.MAX_SAFE_INTEGER]) {
    const level = rules.createLevel(forced, n, 42, id); assert.ok(level.fallback && level.route.success);
  }
  const impossible = { ...forced, events: { ...config.events, definitions: { ...config.events.definitions, diamondVein: { ...config.events.definitions.diamondVein, targetMultiplier: 100 } } } };
  const degraded = rules.createLevel(impossible, 20, 42, "diamondVein");
  assert.equal(degraded.event.id, "none"); assert.equal(degraded.requestedEventId, "diamondVein"); assert.ok(degraded.eventDowngrade);
  assert.deepEqual(degraded, rules.createLevel(impossible, 20, 42, "diamondVein"));
});
check("黑市报价和实际扣款；四件限购与库存上限保留", () => {
  let seed = 0; while (rules.selectEvent(config, 5, seed) !== "blackMarket") seed++;
  const run = rules.createRun(config, 4, { runSeed: seed }); collect(run); const shop = rules.createShop(run, config);
  assert.equal(shop.nextLevel.event.id, "blackMarket");
  for (const item of shop.offers) assert.equal(shop.prices[item], rules.shopPrice(config, 5, item, shop.nextLevel.event));
  const before = run.wallet; const bought = rules.purchaseItem(run, shop, "dynamite", config); assert.ok(bought.success); assert.equal(run.wallet, before - shop.prices.dynamite);
  while (shop.purchaseCount < 4 && run.wallet >= shop.prices.dynamite && run.bombs < 5) rules.purchaseItem(run, shop, "dynamite", config);
  assert.ok(run.bombs <= 5 && shop.purchaseCount <= 4);
  const cp = rules.captureCheckpoint(run, "shop", config); assert.ok(storage.validateCheckpoint(cp, config));
  const restored = rules.restoreCheckpoint(cp, config); assert.deepEqual(restored.shop, shop);
});
check("相同模式/版本/Seed 的地图、事件和商店一致；不同模式分离", () => {
  for (const mode of ["seed", "daily"]) {
    const challenge = challenges.create(mode, 42, mode === "daily" ? "2026-10-04" : null);
    const a = rules.createRun(config, 4, { challenge, runSeed: challenge.seed }), b = rules.createRun(config, 4, { challenge, runSeed: challenge.seed });
    assert.deepEqual(a.level, b.level); collect(a); collect(b); assert.deepEqual(rules.createShop(a, config), rules.createShop(b, config));
  }
  assert.notEqual(challenges.generationSeed(challenges.create("seed", 42)), challenges.generationSeed(challenges.create("endless", 42)));
  assert.throws(() => rules.createRun(config, 1, { runSeed: 43, challenge: challenges.create("seed", 42) }));
});
check("Seed 和每日完整 20 关规则模拟：提交幂等、终结报告、无第 21 关、独立纪录与成就隔离", () => {
  for (const mode of ["seed", "daily"]) {
    const challenge = challenges.create(mode, 42, mode === "daily" ? "2026-10-04" : null), state = init(challenge);
    for (let n = 1; n <= 20; n++) {
      collect(state.run); const cp = n === 20 ? null : rules.captureCheckpoint(state.run, "shop", config);
      assert.deepEqual(growth.settleLevel(state.doc, state.run, cp, now), []);
      assert.deepEqual(growth.settleLevel(state.doc, state.run, cp, now), []);
      assert.ok(storage.validateProgress(state.doc, config), `第 ${n} 关保存有效`);
      if (n < 20) {
        const shop = state.run.shop;
        state.run = rules.createRun(config, n + 1, { challenge, runSeed: challenge.seed, wallet: state.run.wallet, bombs: state.run.bombs, totalIncome: state.run.totalIncome, level: shop.nextLevel, effects: shop.effects });
        growth.enterLevel(state.doc, rules.captureCheckpoint(state.run, "level", config), now);
      }
    }
    assert.equal(state.doc.activeRun, null); assert.equal(rules.createShop(state.run, config), null); assert.throws(() => rules.createRun(config, 21, { challenge, runSeed: challenge.seed }));
    const report = state.doc.profile.recentReports[0]; assert.equal(report.reason, "completed"); assert.equal(report.totals.levelsCleared, 20);
    assert.equal(state.doc.profile.career.bestClearedLevel, 0); assert.ok(Object.values(state.doc.profile.achievements).every(a => a.unlockedAt === null));
    assert.equal(state.doc.profile.modeStats[mode].levelsCleared, 20); assert.ok(state.doc.profile.challengeRecords[challenges.key(challenge)]);
    assert.match(challenges.share(report), /规则：1.5.1/);
  }
});
check("个人最佳比较按关数、有效成绩、时长；日期/Seed/版本键隔离", () => {
  const previous = { levelsCleared: 5, qualifiedIncome: 5000, activePlayMs: 300000 };
  assert.ok(challenges.better({ ...previous, levelsCleared: 6 }, previous)); assert.ok(challenges.better({ ...previous, qualifiedIncome: 5001 }, previous));
  assert.ok(challenges.better({ ...previous, activePlayMs: 299999 }, previous)); assert.ok(!challenges.better(previous, previous));
  assert.ok(!challenges.better({ ...previous, levelsCleared: 4, qualifiedIncome: 9000 }, previous));
  const a = challenges.create("daily", 0, "2026-10-04"), b = challenges.create("daily", 0, "2026-10-03"); assert.notEqual(challenges.key(a), challenges.key(b));
  assert.notEqual(challenges.key(a), challenges.key(challenges.create("daily", 0, "2026-10-04", "1.4.0")));
  const state = init(challenges.create("seed", 201));
  for (let seed = 0; seed < 200; seed++) {
    const challenge = challenges.create("seed", seed);
    state.doc.profile.challengeRecords[challenges.key(challenge)] = { challenge, runId: `history-${seed}`, updatedAt: new Date(Date.parse(now) - 200000 + seed * 1000).toISOString(), levelsCleared: 0, qualifiedIncome: 0, activePlayMs: 0 };
  }
  growth.abandon(state.doc, now);
  assert.equal(Object.keys(state.doc.profile.challengeRecords).length, 200);
  assert.ok(!state.doc.profile.challengeRecords[challenges.key(challenges.create("seed", 0))]);
  assert.ok(state.doc.profile.challengeRecords[challenges.key(challenges.create("seed", 201))]);
  assert.ok(storage.validateProgress(state.doc, config));
});
check("失败/放弃与跨日恢复保留模式日期，分享只生成内容", () => {
  const state = init(challenges.create("daily", 0, "2026-10-03")); const cp = rules.captureCheckpoint(state.run, "level", config);
  assert.deepEqual(rules.restoreCheckpoint(cp, config).challenge, state.run.challenge);
  rules.advanceRun(state.run, 61, config); growth.settleLevel(state.doc, state.run, null, now);
  assert.equal(state.doc.profile.recentReports[0].challenge.date, "2026-10-03"); assert.equal(state.doc.profile.recentReports[0].reason, "failed"); assert.ok(storage.validateProgress(state.doc, config));
  const next = init(challenges.create("seed", 0)); growth.abandon(next.doc, now); assert.equal(next.doc.profile.recentReports[0].reason, "abandoned"); assert.ok(storage.validateProgress(next.doc, config));
  const rollback = init(challenges.create("daily", 0, "2026-10-04"));
  growth.abandon(rollback.doc, "2026-10-03T08:00:00.000Z");
  assert.equal(rollback.doc.profile.recentReports[0].endedAt, now);
  assert.equal(rollback.doc.profile.recentReports[0].challenge.date, "2026-10-04");
  assert.ok(storage.validateProgress(rollback.doc, config));
});
check("v1.2.0 活动入口/商店、永久档案、报告与装备迁移；备份旧原文且不重复计数", () => {
  for (const kind of ["level", "shop"]) {
    const state = init(challenges.create("endless", 42));
    if (kind === "shop") { collect(state.run); growth.settleLevel(state.doc, state.run, rules.captureCheckpoint(state.run, "shop", config), now); }
    const old = growth.clone(state.doc); old.rulesVersion = "1.2.0"; old.activeRun.rulesetVersion = "1.2.0"; old.activeRun.checkpoint.rulesVersion = "1.2.0";
    for (const def of growth.definitions) if (!growth.historicalDefinitions.some(oldDef => oldDef.id === def.id)) delete old.profile.achievements[def.id];
    old.activeRun.newAchievementIds = old.activeRun.newAchievementIds.filter(id => old.profile.achievements[id]);
    delete old.profile.modeStats; delete old.profile.challengeRecords; delete old.profile.endlessChestRewardIds; delete old.activeRun.challenge; delete old.activeRun.eventCounts;
    delete old.activeRun.checkpoint.run.challenge; delete old.activeRun.checkpoint.run.level.event;
    if (kind === "shop") delete old.activeRun.checkpoint.shop.nextLevel;
    assert.ok(storage.validateProgress(old, { ...rules.configForVersion(config, "1.4.0"), version: "1.2.0", rulesVersion: "1.2.0" }));
    const raw = JSON.stringify(old), db = database(); db.setItem(storage.progressKey, raw);
    const loaded = storage.loadProgress(db, config, now); assert.ok(!loaded.blocked); assert.ok(storage.validateProgress(loaded.document, config));
    assert.equal(db.getItem(storage.v120BackupKey), raw); assert.deepEqual(loaded.document.profile.career, old.profile.career);
    assert.deepEqual(loaded.document.activeRun.checkpoint.run.level.layout, old.activeRun.checkpoint.run.level.layout);
    if (kind === "shop") { assert.deepEqual(loaded.document.activeRun.checkpoint.shop.prices, old.activeRun.checkpoint.shop.prices); assert.equal(loaded.document.activeRun.checkpoint.shop.nextLevel.event.id, "none"); }
    assert.deepEqual(storage.loadProgress(db, config, now).document, loaded.document);
  }
});
check("未知格式、非法事件/日期/跨模式字段与拒绝存储不覆盖数据", () => {
  const state = init(challenges.create("daily", 0, "2026-10-04"));
  const illegal = growth.clone(state.doc); illegal.activeRun.challenge.date = "2026-10-03"; assert.equal(storage.validateProgress(illegal, config), null);
  const badEvent = growth.clone(state.doc); badEvent.activeRun.checkpoint.run.level.event.rewardMultiplier = 5; assert.equal(storage.validateProgress(badEvent, config), null);
  const db = database(), raw = JSON.stringify({ ...state.doc, rulesVersion: "9.0.0" }); db.setItem(storage.progressKey, raw);
  assert.ok(storage.loadProgress(db, config, now).blocked); assert.equal(db.getItem(storage.progressKey), raw);
  db.data.clear(); db.setItem = () => { throw new Error("denied"); }; assert.ok(!storage.saveProgress(db, state.doc, config, null).saved);
});
const output = `output/playwright/survival-v${config.version.replaceAll(".", "")}-challenges-report.json`;
fs.writeFileSync(output, JSON.stringify({ version: config.version, result: "passed", method: "pure logic and formal game-rule simulations; no claim of real-time 20-level gameplay", checks, generations }, null, 2) + "\n");
console.log(`挑战与事件检查通过：${checks.length} 组，660 份地图，两个模式完整 20 关正式规则模拟。`);
