"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const config = require("../js/config.js");
const rules = require("../js/rules.js");
const growth = require("../js/growth.js");
const storage = require("../js/storage.js");
const now = "2026-10-04T08:00:00.000Z";
const checks = [], achievementChecks = [];
function check(name, action) { action(); checks.push({ name, result: "passed" }); }
function database() {
  const items = new Map();
  return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
}
function make(types = ["largeGold"], options = {}) {
  const levelId = options.levelId || 1;
  const level = { id: levelId, duration: 60, target: options.target || 1, rewardScale: options.scale || 1,
    layout: types.map((type, i) => ({ id: `object-${i}`, type, x: 330 + i % 3 * 150, y: 260 + Math.floor(i / 3) * 100, rewardRoll: options.rolls?.[i] ?? .4 })) };
  const run = rules.createRun(config, levelId, { level, runSeed: 42, effects: options.effects, bombs: options.bombs ?? 1 });
  const doc = growth.createDocument({ soundEnabled: true, highScore: 0, bestClearedLevel: 0 }, now);
  const cp = rules.captureCheckpoint(run, "level", config);
  growth.createActive(doc, cp, "test-run", now, false); growth.enterLevel(doc, cp, now);
  return { run, doc };
}
// 显式设置携带位置/奖励时刻，仍调用正式出钩、入账、计时、暂存和成就提交逻辑。
function bank(run, i, remaining = 50) {
  assert.ok(rules.launchHook(run));
  const mineral = run.minerals[i];
  mineral.status = "carried"; run.hook.phase = "returning-loaded"; run.hook.carryingId = mineral.id;
  run.hook.length = config.minerals[mineral.type].returnSpeed * (run.effects.strength ? 1.5 : 1) * .01;
  growth.recordEvent(run, { type: "grabbed", id: mineral.id, mineralType: mineral.type });
  run.remainingTime = remaining + .01;
  const event = rules.advanceRun(run, .02, config).find(event => event.type === "banked");
  assert.ok(event, "受控携带物必须完成正式入账");
  return event;
}
function finish(test) {
  rules.advanceRun(test.run, 100, config);
  const cp = test.run.result.success ? rules.captureCheckpoint(test.run, "shop", config) : null;
  const ids = growth.settleLevel(test.doc, test.run, cp, now);
  return ids;
}
function achievement(id, positive, negative) {
  const yes = positive(), no = negative();
  assert.ok(yes.doc.profile.achievements[id].unlockedAt, `${id} 满足条件`);
  assert.equal(no.doc.profile.achievements[id].unlockedAt, null, `${id} 未满足条件`);
  achievementChecks.push({ id, positive: "passed", negative: "passed" });
}
function cleared(levelId, target = 1) { const t = make(["largeGold"], { levelId, target }); bank(t.run, 0); finish(t); return t; }
check("目录稳定：18 项成就、9 类图鉴、8 类回收与 5/3 奖励档", () => {
  assert.equal(growth.definitions.length, 18); assert.equal(new Set(growth.definitions.map(d => d.id)).size, 18);
  assert.equal(growth.types.length, 9); assert.equal(growth.recoverableTypes.length, 8);
  assert.equal(growth.rewardIds.mysteryBag.length, 5); assert.equal(growth.rewardIds.treasureChest.length, 3);
});
for (const [id, n] of [["first_clear", 1], ["clear_5", 5], ["clear_20", 20]]) achievement(id, () => cleared(n), () => cleared(n, 1000));
achievement("reach_50", () => make(["largeGold"], { levelId: 50 }), () => make(["largeGold"], { levelId: 49 }));
achievement("level_income_5000", () => { const t = make(["smallGold"], { scale: 50 }); bank(t.run, 0); finish(t); return t; }, () => { const t = make(["smallGold"], { scale: 49.99 }); bank(t.run, 0); finish(t); return t; });
achievement("career_income_100000", () => {
  const t = make(); t.doc.profile.career.qualifiedIncome = 100000; growth.evaluate(t.doc, null, now); return t;
}, () => { const t = make(); t.doc.profile.career.qualifiedIncome = 99999; growth.evaluate(t.doc, null, now); return t; });
achievement("recover_streak_5", () => { const t = make(Array(5).fill("smallGold")); for (let i = 0; i < 5; i++) bank(t.run, i); finish(t); return t; }, () => {
  const t = make(Array(5).fill("smallGold")); for (let i = 0; i < 5; i++) { bank(t.run, i); if (i === 2) { rules.launchHook(t.run); growth.recordEvent(t.run, { type: "empty-returned" }); t.run.hook.phase = "swinging"; } } finish(t); return t;
});
achievement("perfect_level", () => { const t = make(Array(8).fill("smallGold")); for (let i = 0; i < 8; i++) bank(t.run, i); finish(t); return t; }, () => {
  const t = make(Array(8).fill("smallGold")); for (let i = 0; i < 8; i++) bank(t.run, i); rules.launchHook(t.run); finish(t); return t;
});
achievement("last_second_target", () => { const t = make(); bank(t.run, 0, .5); finish(t); return t; }, () => { const t = make(); bank(t.run, 0, 1.01); finish(t); return t; });
achievement("no_assistance_clear", () => cleared(1), () => { const t = make(["largeGold"], { effects: { luckyCharm: true } }); bank(t.run, 0); finish(t); return t; });
function blast(count) {
  const t = make(["powderKeg", ...Array(count).fill("smallGold")]);
  rules.launchHook(t.run);
  const ids = t.run.minerals.map(m => m.id);
  t.run.minerals.forEach(m => { m.status = "destroyed"; });
  const event = { type: "exploded", id: ids[0], mineralType: "powderKeg", destroyedIds: [...ids, ids[1]] };
  growth.recordEvent(t.run, event); growth.recordEvent(t.run, event); finish(t); return t;
}
achievement("blast_four", () => blast(4), () => blast(3));
achievement("dynamite_ten", () => { const t = make(); t.doc.profile.career.dynamiteUsed = 10; growth.evaluate(t.doc, null, now); return t; }, () => { const t = make(); t.doc.profile.career.dynamiteUsed = 9; growth.evaluate(t.doc, null, now); return t; });
achievement("penalty_twice", () => { const t = make(["cursedRelic", "cursedRelic"], { target: 5000 }); bank(t.run, 0); bank(t.run, 1); finish(t); return t; }, () => {
  const t = make(["cursedRelic", "smallGold", "cursedRelic"]); bank(t.run, 0); bank(t.run, 1); bank(t.run, 2); finish(t); return t;
});
achievement("lucky_streak_3", () => {
  const t = make(["mysteryBag", "smallGold", "treasureChest", "mysteryBag"], { rolls: [.4, 0, .9, .4] }); for (let i = 0; i < 4; i++) bank(t.run, i); finish(t); return t;
}, () => { const t = make(["treasureChest", "treasureChest", "treasureChest"], { rolls: [.9, .4, .9], scale: 10 }); for (let i = 0; i < 3; i++) bank(t.run, i); finish(t); return t; });
achievement("recover_all_v120", () => { const t = make(growth.recoverableTypes); for (let i = 0; i < 8; i++) bank(t.run, i); finish(t); return t; }, () => {
  const t = make(growth.recoverableTypes.slice(0, 7)); for (let i = 0; i < 7; i++) bank(t.run, i); finish(t); return t;
});
achievement("chest_all_rewards", () => { const t = make(Array(3).fill("treasureChest"), { rolls: [.1, .6, .9] }); for (let i = 0; i < 3; i++) bank(t.run, i); finish(t); return t; }, () => {
  const t = make(Array(3).fill("treasureChest"), { rolls: [.1, .6, .6], scale: 10 }); for (let i = 0; i < 3; i++) bank(t.run, i); finish(t); return t;
});
achievement("last_second_rescue", () => { const t = make(["largeGold", "mysteryBag"], { rolls: [0, .91] }); bank(t.run, 0); bank(t.run, 1, .5); finish(t); return t; }, () => {
  const t = make(["largeGold", "mysteryBag"], { rolls: [0, .91] }); bank(t.run, 0); t.run.timeBonusUsed = 20; bank(t.run, 1, .5); finish(t); return t;
});
achievement("charm_rescue", () => { const t = make(["cursedRelic"], { effects: { protectionCharm: true } }); bank(t.run, 0, 5); finish(t); return t; }, () => {
  const t = make(["cursedRelic"], { effects: { protectionCharm: true } }); bank(t.run, 0, 5.01); finish(t); return t;
});
check("截止优先、实际扣时裁剪、时间上限与真实事件时刻", () => {
  const t = make(["cursedRelic"]); const event = bank(t.run, 0, 2);
  assert.ok(Math.abs(event.timeBefore - 2) < 1e-9); assert.ok(Math.abs(event.actualTimeChange + 2) < 1e-9); assert.equal(t.run.growth.cursedTimeLostMs, 2000);
  assert.ok(t.run.settled); assert.equal(t.run.growth.activePlayMs, 10);
  const late = make(); rules.launchHook(late.run); late.run.minerals[0].status = "carried"; late.run.hook.phase = "returning-loaded";
  late.run.hook.carryingId = late.run.minerals[0].id; late.run.hook.length = 110; late.run.remainingTime = 1;
  rules.advanceRun(late.run, 2, config); assert.equal(late.run.levelIncome, 0); assert.equal(late.run.growth.objectsRecovered, 0);
  assert.equal(late.run.growth.targetTime, null);
  const capped = make(["mysteryBag"], { rolls: [.91] }); capped.run.timeBonusUsed = 18; const reward = bank(capped.run, 0);
  assert.ok(Math.abs(reward.actualTimeChange - 2) < 1e-9); assert.equal(capped.run.growth.timeAddedMs, 2000);
});
check("一次长帧的回收时刻与后续计时分开，额外加时改变截止", () => {
  const t = make(["mysteryBag"], { rolls: [.91] }); rules.launchHook(t.run); t.run.minerals[0].status = "carried";
  growth.recordEvent(t.run, { type: "grabbed" }); t.run.hook.phase = "returning-loaded"; t.run.hook.carryingId = "object-0";
  t.run.hook.length = 100; t.run.remainingTime = 1;
  const events = rules.advanceRun(t.run, 2, config); const event = events.find(e => e.type === "banked");
  assert.ok(Math.abs(event.timeBefore - .5) < 1e-8); assert.equal(event.actualTimeChange, 5);
  assert.ok(Math.abs(t.run.remainingTime - 4) < 1e-8); assert.ok(t.run.growth.lastSecondRescue);
});
check("无效出钩/炸药不计，命中不等于回收，重复事件不累加", () => {
  const t = make(); assert.equal(rules.useDynamite(t.run), null); rules.launchHook(t.run); assert.equal(rules.launchHook(t.run), false);
  t.run.hook.phase = "returning-loaded"; t.run.hook.carryingId = "object-0"; t.run.minerals[0].status = "carried";
  growth.recordEvent(t.run, { type: "grabbed" }); growth.recordEvent(t.run, { type: "grabbed" });
  const event = rules.useDynamite(t.run); growth.recordEvent(t.run, event); assert.equal(rules.useDynamite(t.run), null); finish(t);
  assert.equal(t.run.growth.hooksLaunched, 1); assert.equal(t.run.growth.hooksHit, 1); assert.equal(t.run.growth.objectsRecovered, 0);
  assert.equal(t.doc.profile.career.dynamiteUsed, 1); assert.equal(t.doc.profile.collection.largeGold.recovered, 0);
  const barrel = blast(4); assert.equal(barrel.run.growth.barrelsDetonated, 1); assert.equal(barrel.run.growth.objectsDestroyedByBarrel, 4);
  assert.equal(barrel.doc.profile.collection.powderKeg.detonated, 1);
});
check("入口发现、延时券只计一次；关内回滚、结算/商店不重复", () => {
  const t = make(["largeGold"], { effects: { timeCoupon: true } }); const cp = growth.clone(t.doc.activeRun.checkpoint);
  growth.enterLevel(t.doc, cp, now); assert.equal(t.doc.profile.collection.largeGold.seen, 1); assert.equal(t.doc.profile.career.timeAddedMs, 10000);
  bank(t.run, 0); const restored = rules.restoreCheckpoint(cp, config);
  assert.equal(restored.growth.objectsRecovered, 0); assert.equal(restored.growth.recoveryStreak, 0); assert.equal(restored.elapsedTime, 0);
  finish(t); const before = growth.clone(t.doc); assert.deepEqual(finish(t), []); assert.deepEqual(t.doc, before);
  assert.equal(t.doc.profile.career.recoveredIncome, 300); assert.ok(storage.validateProgress(t.doc, config));
  for (let i = 0; i < 3; i++) assert.equal(rules.restoreCheckpoint(t.doc.activeRun.checkpoint, config).totalIncome, 300);
});
check("失败提交回收收入，不加有效成绩；报告与活动挑战同次保存", () => {
  const t = make(["largeGold"], { target: 1000 }); const db = database();
  bank(t.run, 0); finish(t); assert.equal(t.doc.activeRun, null);
  assert.equal(t.doc.profile.career.qualifiedIncome, 0); assert.equal(t.doc.profile.career.failedLevelIncome, 300);
  assert.equal(t.doc.profile.recentReports[0].totals.recoveredIncome, 300);
  assert.ok(storage.saveProgress(db, t.doc, config, null).saved); const read = storage.loadProgress(db, config, now);
  assert.equal(read.document.activeRun, null); assert.equal(read.document.profile.recentReports.length, 1);
});
check("图鉴全部 9 类、5/3 基础奖励；满炸药、护符、倍率不新造档位", () => {
  const bags = make(Array(5).fill("mysteryBag"), { rolls: [.1, .4, .75, .91, .98], bombs: 5, scale: 10, effects: { protectionCharm: true } });
  for (let i = 0; i < 5; i++) bank(bags.run, i); finish(bags);
  assert.deepEqual(new Set(bags.doc.profile.collection.mysteryBag.rewardIds), new Set(growth.rewardIds.mysteryBag));
  assert.equal(bags.doc.profile.career.penaltiesBlocked, 1); assert.equal(bags.doc.profile.career.bagBadLuck, 1);
  assert.equal(bags.doc.profile.career.recoveredIncome, 3500);
  assert.ok(storage.validateProgress(bags.doc, config));
});
check("旧关卡与商店显式迁移、补发可证明成就、旧键保持不变", () => {
  for (const kind of ["level", "shop"]) {
    const oldConfig = { ...config, version: "1.1.0" }, run = rules.createRun(oldConfig, 20, { runSeed: 123, wallet: 4000, totalIncome: 5000 });
    if (kind === "shop") { run.levelIncome = 6000; run.wallet += 6000; rules.advanceRun(run, 61, oldConfig); rules.purchaseItem(run, rules.createShop(run, oldConfig), "dynamite", oldConfig); }
    const cp = rules.captureCheckpoint(run, kind, oldConfig), db = database();
    const oldText = JSON.stringify(cp), prefs = JSON.stringify({ soundEnabled: false, highScore: 12000, bestClearedLevel: 20 });
    db.setItem(storage.checkpointKey, oldText); db.setItem(storage.key, prefs);
    const imported = storage.loadProgress(db, config, now);
    assert.ok(!imported.blocked); assert.ok(imported.revision); assert.equal(imported.document.settings.soundEnabled, false);
    assert.equal(imported.document.profile.career.qualifiedIncome, 0); assert.equal(imported.document.profile.career.levelsCleared, 0);
    assert.equal(imported.document.profile.career.runsImported, 1); assert.equal(imported.document.profile.career.bestRunIncome, 12000);
    assert.deepEqual(imported.document.activeRun.checkpoint.run.level, cp.run.level);
    assert.equal(imported.document.activeRun.checkpoint.run.wallet, cp.run.wallet);
    if (kind === "shop") assert.deepEqual(imported.document.activeRun.checkpoint.shop, cp.shop);
    for (const id of ["first_clear", "clear_5", "clear_20"]) assert.ok(imported.document.profile.achievements[id].unlockedAt);
    assert.equal(imported.document.profile.achievements.reach_50.unlockedAt, null);
    assert.deepEqual(storage.loadProgress(db, config, now).document, imported.document);
    assert.equal(db.getItem(storage.checkpointKey), oldText); assert.equal(db.getItem(storage.key), prefs);
    growth.abandon(imported.document, now); assert.ok(storage.saveProgress(db, imported.document, config, imported.revision).saved);
    assert.equal(storage.loadProgress(db, config, now).document.activeRun, null);
  }
});
check("迁移保存失败后重试不重算；拒绝存储、未知新版本、修订冲突保留原数据", () => {
  const db = database(), old = rules.captureCheckpoint(rules.createRun(config), "level", config); old.rulesVersion = "1.1.0";
  db.setItem(storage.checkpointKey, JSON.stringify(old)); const originalSet = db.setItem; db.setItem = () => { throw Error("quota"); };
  const failed = storage.loadProgress(db, config, now); assert.match(failed.message, /保存失败/); assert.equal(failed.document.profile.career.runsImported, 1);
  db.setItem = originalSet; const retried = storage.loadProgress(db, config, now); assert.equal(retried.document.profile.career.runsImported, 1);
  const a = storage.loadProgress(db, config, now), b = storage.loadProgress(db, config, now);
  assert.ok(storage.saveProgress(db, a.document, config, a.revision).saved);
  assert.equal(storage.saveProgress(db, b.document, config, b.revision).conflict, true);
  for (const text of ["{bad", '{"schemaVersion":99}', JSON.stringify({ ...a.document, rulesVersion: "future" })]) {
    db.setItem(storage.progressKey, text); const result = storage.loadProgress(db, config, now); assert.equal(result.blocked, true);
    assert.equal(db.getItem(storage.progressKey), text); assert.equal(result.document.activeRun, null);
  }
  const denied = storage.loadProgress({ getItem() { throw Error("denied"); } }, config, now); assert.equal(denied.blocked, true);
});
check("存档非法 ID、计数、关系、日期、成就状态与挑战关系拒绝", () => {
  const t = cleared(1); assert.ok(storage.validateProgress(t.doc, config));
  for (const mutate of [d => d.profile.career.hooksHit = 100, d => d.profile.career.qualifiedIncome = -1,
    d => d.profile.statisticsSince = "not a date", d => d.profile.achievements.bad = {}, d => d.profile.achievements.first_clear.progress = 99,
    d => d.profile.collection.largeGold.seen = 0, d => d.activeRun.checkpoint.run.runSeed = 2,
    d => d.activeRun.committedThroughLevel = 0, d => d.profile.equippedTitleId = "charm_rescue"]) {
    const bad = growth.clone(t.doc); mutate(bad); assert.equal(storage.validateProgress(bad, config), null);
  }
});
check("已有入口后失败写入被拒绝，旧磁盘快照保留；重试保存一致且只提交一次", () => {
  const t = make(["largeGold"], { target: 1000 }), db = database();
  const initial = storage.saveProgress(db, t.doc, config, null); assert.ok(initial.saved);
  const originalSet = db.setItem, previousText = db.getItem(storage.progressKey);
  bank(t.run, 0); finish(t); db.setItem = () => { throw Error("quota"); };
  assert.equal(storage.saveProgress(db, t.doc, config, initial.revision).saved, false);
  assert.equal(db.getItem(storage.progressKey), previousText);
  assert.ok(storage.loadProgress(db, config, now).document.activeRun);
  db.setItem = originalSet; assert.ok(storage.saveProgress(db, t.doc, config, initial.revision).saved);
  const saved = storage.loadProgress(db, config, now).document;
  assert.equal(saved.activeRun, null); assert.equal(saved.profile.recentReports.length, 1); assert.equal(saved.profile.career.objectsRecovered, 1);
  const bad = { ...saved, rulesVersion: "unknown" }; db.setItem(storage.progressKey, JSON.stringify(bad));
  assert.equal(storage.saveProgress(db, t.doc, config, saved.revision).conflict, true);
  assert.equal(JSON.parse(db.getItem(storage.progressKey)).rulesVersion, "unknown");
});
check("11 份报告裁剪为 10 份；新纪录按局开始基线，放弃不提交未结算数据", () => {
  const t = cleared(1); assert.ok(growth.equipTitle(t.doc, null)); assert.equal(growth.equipTitle(t.doc, "clear_20"), false);
  const report = growth.abandon(t.doc, now); assert.ok(report.newRecords.includes("bestRunIncome")); assert.ok(report.newAchievementIds.includes("first_clear"));
  for (let i = 0; i < 10; i++) {
    const run = rules.createRun(config, 1, { runSeed: i }), cp = rules.captureCheckpoint(run, "level", config);
    growth.createActive(t.doc, cp, `run-${i}`, now, false); growth.enterLevel(t.doc, cp, now);
    run.levelIncome = 9999; growth.abandon(t.doc, now);
  }
  assert.equal(t.doc.profile.recentReports.length, 10); assert.equal(t.doc.profile.recentReports[0].runId, "run-9");
  assert.equal(t.doc.profile.career.qualifiedIncome, 300); assert.ok(storage.validateProgress(t.doc, config));
});
check("称号、检查与图鉴不消费随机数；已解锁成就不因目录未来扩展撤销", () => {
  const before = rules.createRun(config, 50, { runSeed: 78 }); const t = cleared(20);
  assert.ok(growth.equipTitle(t.doc, "clear_20")); const unlocked = growth.clone(t.doc.profile.achievements.clear_20);
  growth.evaluate(t.doc, null, now); assert.deepEqual(t.doc.profile.achievements.clear_20, unlocked);
  assert.deepEqual(rules.createRun(config, 50, { runSeed: 78 }).level, before.level);
});
fs.writeFileSync(`output/playwright/survival-v${config.version.replaceAll(".", "")}-growth-report.json`, JSON.stringify({ version: config.version,
  method: "pure engine with explicit layouts, carrying state and times; no claim of natural play", achievementChecks, checks, result: "passed" }, null, 2) + "\n");
console.log(`成长检查通过：${achievementChecks.length} 项成就正反条件，${checks.length} 组事件/保存/图鉴/报告边界。`);
