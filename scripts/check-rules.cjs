"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../js/config.js");
const rules = require("../js/rules.js");
const storage = require("../js/storage.js");
const effects = require("../js/effects.js");
const checks = [], generations = [];
function check(name, action) { action(); checks.push({ name, result: "passed" }); }
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`); }
const fixture = { id: 1, target: 650, duration: 60, layout: [{ id: "fixture", type: "smallGold", x: 480, y: 230 }] };
function fresh(entry = {}) { return rules.createRun(config, entry.level?.id || 1, { level: fixture, ...entry }); }
function loaded(type, length = 1, entry = {}, reward = null) {
  const run = fresh(entry);
  run.minerals = [{ id: "loaded", type, x: 480, y: 300, reward, status: "carried" }];
  Object.assign(run.hook, { phase: "returning-loaded", carryingId: "loaded", length });
  return run;
}
function funded(seed = 0, levelId = 1) {
  const run = fresh({ runSeed: seed, level: { ...fixture, id: levelId } });
  run.levelIncome = 5000; run.wallet = 5000;
  rules.advanceRun(run, 60, config);
  return { run, shop: rules.createShop(run, config) };
}
check("1000 份布局均可见、可达、无重叠并在 45 秒内无道具达标", () => {
  for (const levelId of [1, 2, 3, 4, 9, 10, 11, 20, 100, 1000]) {
    let maximumSeconds = 0, fallbackCount = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const level = rules.createLevel(config, levelId, seed);
      assert.deepEqual(level, rules.createLevel(config, levelId, seed));
      const d = Math.min(levelId - 1, 9);
      assert.equal(level.target, 650 + 150 * d); assert.equal(level.layout.length, 15 + d);
      assert.equal(new Set(level.layout.map(m => m.id)).size, level.layout.length);
      assert.ok(Object.isFrozen(level) && Object.isFrozen(level.layout));
      const bases = level.layout.filter(m => m.safeRoute);
      for (const mineral of level.layout) {
        assert.ok(rules.validPlacement(mineral, level.layout.filter(m => m !== mineral), config));
        if (!mineral.safeRoute) assert.ok(rules.protectsRoute(mineral, bases, config));
      }
      assert.ok(new Set(level.layout.filter(m => config.survival.newTypes.includes(m.type)).map(m => m.type)).size >= 2);
      for (const type of ["powderKeg", "cursedRelic"]) assert.ok(level.layout.filter(m => m.type === type).length <= 2);
      const verified = rules.verifyRoute(config, level);
      assert.ok(verified.success && verified.seconds <= 45);
      maximumSeconds = Math.max(maximumSeconds, verified.seconds);
      fallbackCount += Number(level.fallback);
    }
    generations.push({ levelId, seeds: 100, maximumSeconds, fallbackCount });
  }
});
check("不同种子生成不同布局，强制失败使用有效备用布局", () => {
  assert.notDeepEqual(rules.createLevel(config, 1, 0).layout, rules.createLevel(config, 1, 1).layout);
  const fallbackConfig = { ...config, survival: { ...config.survival, maxAttempts: 0 } };
  for (const n of [1, 10, 1000]) {
    const level = rules.createLevel(fallbackConfig, n, 42);
    assert.equal(level.fallback, true); assert.equal(level.layout.length, 15 + Math.min(n - 1, 9));
    assert.ok(rules.verifyRoute(fallbackConfig, level).success);
  }
});
check("拒绝非法关号，各次运行状态独立", () => {
  for (const n of [0, -1, 1.5, Infinity]) assert.throws(() => rules.createLevel(config, n));
  const a = fresh(), b = fresh(); a.minerals[0].status = "banked"; a.effects.strength = true;
  assert.equal(b.minerals[0].status, "available"); assert.equal(b.effects.strength, false);
});
check("圆形和矩形线段碰撞及首个命中", () => {
  assert.equal(rules.segmentCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10), .4);
  assert.equal(rules.segmentCircle({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10), 0);
  assert.equal(rules.segmentCircle({ x: 0, y: 20 }, { x: 100, y: 20 }, { x: 50, y: 0 }, 10), null);
  assert.equal(rules.segmentRectangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 20, 24), .4);
  assert.equal(rules.segmentRectangle({ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 50, y: 0 }, 20, 24), null);
  const near = { id: "near", type: "smallGold", x: 40, y: 0, status: "available" };
  const far = { id: "far", type: "largeGold", x: 100, y: 0, status: "available" };
  assert.equal(rules.firstHit({ x: 0, y: 0 }, { x: 200, y: 0 }, [far, near], config).mineral.id, "near");
  near.status = "carried";
  assert.equal(rules.firstHit({ x: 0, y: 0 }, { x: 200, y: 0 }, [far, near], config).mineral.id, "far");
});
check("长帧不穿透近物、出钩锁向且忙碌拒绝重复出钩", () => {
  const run = fresh();
  run.minerals = [{ id: "far", type: "largeGold", x: 480, y: 400, status: "available" }, { id: "near", type: "smallGold", x: 480, y: 220, status: "available" }];
  assert.equal(rules.launchHook(run), true); assert.equal(rules.launchHook(run), false);
  rules.advanceRun(run, 1, config);
  assert.equal(run.minerals[0].status, "available"); assert.equal(run.minerals[1].status, "banked"); assert.equal(run.levelIncome, 100);
});
check("空钩到边界后恢复摆动，摆动始终在角度范围内", () => {
  const run = fresh(); run.minerals = []; run.hook.angle = 75; rules.launchHook(run);
  rules.advanceRun(run, 1, config); assert.equal(run.hook.phase, "returning-empty");
  rules.advanceRun(run, 1, config); assert.equal(run.hook.phase, "swinging");
  for (let i = 0; i < 200; i += 1) { rules.advanceRun(run, .1, config); assert.ok(Math.abs(run.hook.angle) <= 75); }
});
for (const type of Object.keys(config.minerals).filter(type => type !== "powderKeg")) {
  check(`${type} 收回才入账且只有一次，力量回收速度正确`, () => {
    const reward = ["mysteryBag", "treasureChest"].includes(type) ? { kind: "coins", amount: 200 } : null;
    const run = loaded(type, config.minerals[type].returnSpeed * .2, { effects: { strength: true } }, reward);
    rules.advanceRun(run, .05, config);
    close(run.hook.length, config.minerals[type].returnSpeed * .125); assert.equal(run.levelIncome, 0);
    const events = rules.advanceRun(run, .2, config);
    assert.equal(events.filter(e => e.type === "banked").length, 1);
    const expected = reward ? 200 : config.minerals[type].value;
    assert.equal(run.levelIncome, expected); assert.equal(run.wallet, expected); assert.equal(run.totalIncome, 0);
    run.hook.phase = "returning-loaded"; run.hook.carryingId = "loaded"; run.hook.length = 1;
    assert.equal(rules.advanceRun(run, .1, config).filter(e => e.type === "banked").length, 0);
  });
  check(`炸药销毁 ${type} 不触发奖励或惩罚`, () => {
    const run = loaded(type, 400, {}, { kind: "time", amount: -5 });
    assert.ok(rules.useDynamite(run)); assert.equal(run.bombs, 0); assert.equal(run.hook.phase, "returning-empty");
    assert.equal(rules.useDynamite(run), null);
    rules.advanceRun(run, .1, config); close(run.hook.length, 335); close(run.remainingTime, 59.9);
    rules.advanceRun(run, 1, config); assert.equal(run.levelIncome, 0); assert.equal(run.hook.phase, "swinging");
  });
}
check("两种增值剂只影响指定矿物，不影响红宝石或随机奖励", () => {
  for (const [type, expected] of [["smallGold", 150], ["largeGold", 450], ["diamond", 375], ["ruby", 350], ["stone", 20], ["treasureChest", 800]]) {
    const run = loaded(type, 1, { effects: { goldBoost: true, diamondBoost: true } }, type === "treasureChest" ? { kind: "coins", amount: 800 } : null);
    rules.advanceRun(run, .1, config); assert.equal(run.levelIncome, expected);
  }
});
check("力量不改变摆动、伸出和空钩回收，空钩/无库存/结算后不可用炸药", () => {
  for (const phase of ["swinging", "extending", "returning-empty"]) {
    const a = fresh(), b = fresh({ effects: { strength: true } });
    for (const run of [a, b]) { run.hook.phase = phase; run.hook.length = 200; }
    rules.advanceRun(a, .1, config); rules.advanceRun(b, .1, config); close(a.hook.length, b.hook.length); close(a.hook.angle, b.hook.angle);
  }
  assert.equal(rules.useDynamite(fresh()), null);
  const run = loaded("stone"); run.bombs = 0; assert.equal(rules.useDynamite(run), null);
  run.bombs = 1; run.settled = true; assert.equal(rules.useDynamite(run), null);
});
check("达标不提前结束，长帧计时完整，成功只累计一次", () => {
  const run = fresh(); run.levelIncome = 800; run.totalIncome = 1000; run.wallet = 600;
  rules.advanceRun(run, 20.5, config); close(run.remainingTime, 39.5); assert.equal(run.settled, false);
  assert.equal(rules.advanceRun(run, 50, config).filter(e => e.type === "settled").length, 1);
  assert.equal(run.totalIncome, 1800); assert.deepEqual(rules.advanceRun(run, 10, config), []); assert.equal(rules.launchHook(run), false);
});
check("截止时刻在途和恰好到达物体不入账，稍早到达可入账", () => {
  for (const [arrival, expected] of [[.01, 0], [.004, 0], [.002, 100]]) {
    const run = loaded("smallGold", 220 * arrival); run.remainingTime = .004;
    rules.advanceRun(run, 5, config); assert.equal(run.levelIncome, expected); assert.equal(run.settled, true);
  }
});
check("失败不累计、不进店，新轮初始资源重置", () => {
  const run = loaded("smallGold"); run.totalIncome = 1000; rules.advanceRun(run, 60, config);
  assert.equal(run.totalIncome, 1000); assert.equal(run.result.success, false); assert.equal(rules.createShop(run, config), null);
  const next = fresh({ runSeed: 99 }); assert.equal(next.levelId, 1); assert.equal(next.wallet, 0); assert.equal(next.bombs, 1); assert.equal(next.totalIncome, 0);
});
check("时间奖励改变长帧截止点，初始延时及累计上限 20 秒", () => {
  const run = loaded("mysteryBag", 2, { effects: { timeCoupon: true } }, { kind: "time", amount: 5 });
  assert.equal(run.remainingTime, 70); assert.equal(run.timeBonusUsed, 10);
  run.remainingTime = .1; rules.advanceRun(run, 1, config); assert.equal(run.settled, false); close(run.remainingTime, 4.1);
  for (let i = 0; i < 3; i += 1) {
    run.minerals[0].status = "carried"; Object.assign(run.hook, { phase: "returning-loaded", carryingId: "loaded", length: 1 });
    rules.advanceRun(run, .01, config);
  }
  assert.equal(run.timeBonusUsed, 20);
  const ended = loaded("mysteryBag", 2, {}, { kind: "time", amount: 5 }); ended.remainingTime = .001;
  rules.advanceRun(ended, 5, config); assert.equal(ended.settled, true); assert.equal(ended.timeBonusUsed, 0);
});
check("古物先入账再扣时间并立即结算；护符只抵消一次", () => {
  const run = loaded("cursedRelic"); run.levelIncome = 200; run.remainingTime = 3;
  const events = rules.advanceRun(run, .1, config); assert.equal(run.levelIncome, 700); assert.equal(run.result.success, true);
  assert.equal(events.at(-1).type, "settled");
  const protectedRun = loaded("cursedRelic", 1, { effects: { protectionCharm: true } });
  rules.advanceRun(protectedRun, .1, config); close(protectedRun.remainingTime, 59.9); assert.equal(protectedRun.effects.protectionCharm, false);
  protectedRun.minerals[0].status = "carried"; Object.assign(protectedRun.hook, { phase: "returning-loaded", carryingId: "loaded", length: 1 });
  rules.advanceRun(protectedRun, .1, config); close(protectedRun.remainingTime, 54.8);
  assert.equal(protectedRun.levelIncome, 1000);
});
check("钩尖碰到火药桶立即爆炸并清除附近物体，空钩回收且不扣时间或消耗资源", () => {
  for (const protectionCharm of [false, true]) {
    const layout = [{ id: "keg", type: "powderKeg", x: 480, y: 300 },
      { id: "gold", type: "smallGold", x: 540, y: 300 },
      { id: "bag", type: "mysteryBag", x: 480, y: 360, rewardRoll: .9 },
      { id: "relic", type: "cursedRelic", x: 420, y: 300 },
      { id: "chest", type: "treasureChest", x: 420, y: 340, rewardRoll: .9 },
      { id: "far", type: "ruby", x: 650, y: 300 }];
    const run = fresh({ level: { ...fixture, layout }, wallet: 200, bombs: 2, effects: { protectionCharm } });
    rules.launchHook(run);
    assert.deepEqual(rules.advanceRun(run, .2, config), []);
    assert.ok(run.minerals.every(mineral => mineral.status === "available"));
    const events = rules.advanceRun(run, .03, config);
    close(run.remainingTime, 59.77);
    assert.equal(run.wallet, 200); assert.equal(run.levelIncome, 0); assert.equal(run.bombs, 2);
    assert.equal(run.effects.protectionCharm, protectionCharm);
    assert.equal(run.timeBonusUsed, 0); assert.equal(run.hook.phase, "returning-empty"); assert.equal(run.hook.carryingId, null);
    assert.equal(events.length, 1); assert.equal(events[0].type, "exploded");
    assert.deepEqual(events[0].point, { x: 480, y: 300 }); assert.equal(events[0].radius, 80);
    assert.deepEqual(events[0].destroyedIds, ["keg", "gold", "bag", "relic", "chest"]);
    assert.equal(run.minerals.at(-1).status, "available");
    assert.deepEqual(rules.advanceRun(run, .4, config), []); assert.equal(run.hook.phase, "swinging");
    assert.equal(run.wallet, 200); assert.equal(run.levelIncome, 0); close(run.remainingTime, 59.37);
  }
});
check("爆炸半径按圆形和矩形轮廓判断，边界外保留且已回收物不受影响", () => {
  const layout = [{ id: "keg", type: "powderKeg", x: 480, y: 300 },
    { id: "circle-edge", type: "stone", x: 583, y: 300 },
    { id: "circle-out", type: "stone", x: 583.01, y: 300 },
    { id: "rectangle-edge", type: "ruby", x: 570, y: 300 },
    { id: "rectangle-out", type: "ruby", x: 570.01, y: 300 },
    { id: "banked", type: "diamond", x: 500, y: 300 }];
  const run = fresh({ level: { ...fixture, layout } }); run.minerals.at(-1).status = "banked";
  rules.launchHook(run); const event = rules.advanceRun(run, .23, config)[0];
  assert.deepEqual(event.destroyedIds, ["keg", "circle-edge", "rectangle-edge"]);
  assert.equal(run.minerals[2].status, "available"); assert.equal(run.minerals[4].status, "available");
  assert.equal(run.minerals[5].status, "banked");
});
check("附近火药桶直接销毁不连锁引爆，先撞到普通物体不会隔空引爆桶", () => {
  const layout = [{ id: "keg", type: "powderKeg", x: 480, y: 300 },
    { id: "near-keg", type: "powderKeg", x: 550, y: 300 },
    { id: "beyond", type: "ruby", x: 630, y: 300 }];
  const run = fresh({ level: { ...fixture, layout } }); rules.launchHook(run);
  const events = rules.advanceRun(run, 1, config);
  assert.equal(events.filter(event => event.type === "exploded").length, 1);
  assert.equal(run.minerals[1].status, "destroyed"); assert.equal(run.minerals[2].status, "available");
  const blocked = fresh({ level: { ...fixture, layout: [layout[0], { id: "front", type: "largeGold", x: 480, y: 220 }] } });
  rules.launchHook(blocked); const blockedEvents = rules.advanceRun(blocked, .3, config);
  assert.equal(blockedEvents.some(event => event.type === "exploded"), false);
  assert.equal(blocked.hook.carryingId, "front"); assert.equal(blocked.minerals[0].status, "available");
});
check("截止时才碰到火药桶或关卡已结束，不触发爆炸", () => {
  const run = fresh({ level: { ...fixture, layout: [{ id: "keg", type: "powderKeg", x: 480, y: 300 }] } });
  run.remainingTime = (300 - config.miner.anchor.y - config.minerals.powderKeg.height / 2 - config.hook.restLength) / config.hook.extendSpeed;
  rules.launchHook(run); const events = rules.advanceRun(run, 1, config);
  assert.equal(run.settled, true); assert.equal(events.some(event => event.type === "exploded"), false);
  assert.equal(run.minerals[0].status, "available"); assert.deepEqual(rules.advanceRun(run, 1, config), []);
});
check("钱袋炸药满库存转 100 金币；普通非金币奖励不计收入", () => {
  for (const bombs of [1, 5]) {
    const run = loaded("mysteryBag", 1, { bombs }, { kind: "bomb", amount: 1 });
    rules.advanceRun(run, .1, config); assert.equal(run.bombs, Math.min(5, bombs + 1)); assert.equal(run.levelIncome, bombs === 5 ? 100 : 0);
  }
});
check("随机奖励概率与边界正确，幸运只影响奖励且开局已确定", () => {
  for (const [type, normal, lucky] of [["mysteryBag", [35,35,15,10,5], [20,40,20,20,0]], ["treasureChest", [50,35,15], [20,50,30]]]) {
    for (const enabled of [false, true]) {
      const counts = new Map();
      for (let i = 0; i < 100; i += 1) { const reward = rules.resolveReward({ type, rewardRoll: (i + .5) / 100 }, config, enabled); const key = `${reward.kind}:${reward.amount}`; counts.set(key, (counts.get(key) || 0) + 1); }
      const table = type === "mysteryBag" ? config.survival.bagRewards : config.survival.chestRewards;
      table.forEach((reward, i) => assert.equal(counts.get(`${reward.kind}:${reward.amount}`) || 0, (enabled ? lucky : normal)[i]));
    }
  }
  const level = rules.createLevel(config, 1, 42);
  const a = fresh({ level }), b = fresh({ level, effects: { luckyCharm: true } });
  assert.equal(a.level, b.level); assert.deepEqual(a.minerals.map(m => [m.type, m.x, m.y]), b.minerals.map(m => [m.type, m.x, m.y]));
  const rewards = JSON.stringify(a.minerals.map(m => m.reward)); rules.advanceRun(a, 20, config); assert.equal(JSON.stringify(a.minerals.map(m => m.reward)), rewards);
});
check("100 个种子商店四种不重复，固定炸药、重进不刷新或重置限购", () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    const { run, shop } = funded(seed); assert.equal(shop.offers.length, 4); assert.equal(new Set(shop.offers).size, 4); assert.ok(shop.offers.includes("dynamite"));
    shop.offers.forEach(item => seen.add(item)); const copy = [...shop.offers]; rules.purchaseItem(run, shop, "dynamite", config);
    assert.equal(rules.createShop(run, config), shop); assert.equal(shop.purchaseCount, 1); assert.deepEqual(shop.offers, copy);
    assert.deepEqual(shop.offers, funded(seed).shop.offers);
  }
  assert.equal(seen.size, 7);
});
check("四件限购、炸药上限、拒绝交易无扣款", () => {
  const { run, shop } = funded();
  for (let i = 0; i < 4; i += 1) assert.equal(rules.purchaseItem(run, shop, "dynamite", config).success, true);
  assert.equal(shop.purchaseCount, 4); assert.equal(run.bombs, 5); assert.equal(run.wallet, 4600);
  assert.equal(rules.purchaseItem(run, shop, shop.offers[1], config).success, false); assert.equal(run.wallet, 4600);
  const next = funded(); next.run.bombs = 5;
  assert.equal(rules.purchaseItem(next.run, next.shop, "dynamite", config).success, false); assert.equal(next.shop.purchaseCount, 0);
  next.run.bombs = 1; next.run.wallet = 50;
  for (const item of next.shop.offers) assert.equal(rules.purchaseItem(next.run, next.shop, item, config).success, false);
  assert.equal(next.run.wallet, 50); assert.equal(next.shop.purchaseCount, 0);
  const missing = Object.keys(config.shop).find(item => !next.shop.offers.includes(item));
  assert.equal(rules.purchaseItem(next.run, next.shop, missing, config).success, false);
});
check("全部增益可购买且仅下一关生效、同种不叠加", () => {
  for (const item of Object.keys(config.shop).filter(item => item !== "dynamite")) {
    let pair;
    for (let seed = 0; seed < 100; seed += 1) { const candidate = funded(seed); if (candidate.shop.offers.includes(item)) { pair = candidate; break; } }
    const { run, shop } = pair; assert.equal(rules.purchaseItem(run, shop, item, config).success, true);
    assert.equal(run.effects[item], false); assert.equal(shop.effects[item], true);
    assert.equal(rules.purchaseItem(run, shop, item, config).success, false); assert.equal(shop.purchaseCount, 1);
    const next = fresh({ effects: shop.effects, wallet: run.wallet, bombs: run.bombs, totalIncome: run.totalIncome });
    assert.equal(next.effects[item], true); rules.advanceRun(next, 100, config);
    assert.ok(Object.values(next.effects).every(value => value === false));
  }
});
check("第 3、10、1000 关成功后均可继续，钱包与收入跨关保留", () => {
  for (const n of [3, 10, 1000]) {
    const { run, shop } = funded(42, n); assert.equal(shop.nextLevelId, n + 1);
    const next = rules.createRun(config, n + 1, { wallet: run.wallet, bombs: run.bombs, totalIncome: run.totalIncome, runSeed: run.runSeed, effects: shop.effects });
    assert.equal(next.wallet, 5000); assert.equal(next.totalIncome, 5000); assert.equal(next.levelIncome, 0); assert.equal(next.runSeed, 42);
  }
});
check("新版记录独立校验，旧版只继承音效且不改写旧键", () => {
  assert.deepEqual(storage.validatePreferences(null), { soundEnabled: true, highScore: 0, bestClearedLevel: 0 });
  for (const invalid of [-1, 1.5, Infinity, "100", Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(storage.validatePreferences({ soundEnabled: false, highScore: invalid, bestClearedLevel: invalid }), { soundEnabled: false, highScore: 0, bestClearedLevel: 0 });
  }
  const map = new Map([[storage.legacyKey, JSON.stringify({ soundEnabled: false, highScore: 3370 })]]);
  const memory = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  assert.deepEqual(storage.loadPreferences(memory), { soundEnabled: false, highScore: 0, bestClearedLevel: 0 });
  storage.savePreferences(memory, { soundEnabled: true, highScore: 2000, bestClearedLevel: 3, wallet: 100, levelId: 4 });
  assert.deepEqual(JSON.parse(map.get(storage.key)), { soundEnabled: true, highScore: 2000, bestClearedLevel: 3 });
  assert.equal(JSON.parse(map.get(storage.legacyKey)).highScore, 3370);
});
check("损坏、不可读、不可写存储安全回退，失败不更新记录", () => {
  for (const source of [{ getItem: () => "{bad" }, { getItem() { throw Error("denied"); } }, () => { throw Error("denied"); }]) assert.deepEqual(storage.loadPreferences(source), storage.validatePreferences(null));
  assert.equal(storage.savePreferences({ setItem() { throw Error("quota"); } }, {}), false);
  const { run } = funded(); assert.equal(storage.highScoreAfterRun(650, run), 5000);
  run.result.success = false; assert.equal(storage.highScoreAfterRun(650, run), 650);
  for (const totalIncome of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(storage.highScoreAfterRun(650, { settled: true, result: { success: true }, totalIncome }), 650);
});
check("收获、爆炸和特殊浮字有数量/寿命上限，零时间冻结", () => {
  const visuals = effects.createState(); effects.harvest(visuals, config.miner.anchor, 375, config.palette);
  assert.equal(visuals.particles.length, 10); assert.equal(visuals.labels[0].text, "+¥375");
  effects.message(visuals, config.miner.anchor, "护身符抵消惩罚", config.palette.diamondLight);
  effects.explode(visuals, { x: 600, y: 400 }, config.palette);
  for (let i = 0; i < 10; i += 1) effects.harvest(visuals, config.miner.anchor, 100, config.palette);
  assert.equal(visuals.particles.length, 64); assert.equal(visuals.labels.length, 4);
  const frozen = JSON.stringify(visuals); effects.advance(visuals, 0); assert.equal(JSON.stringify(visuals), frozen);
  effects.advance(visuals, 1); assert.equal(visuals.particles.length, 0); assert.equal(visuals.labels.length, 0);
});
const report = { phase: "12", result: "passed", count: checks.length, checks, generations };
const directory = path.resolve(__dirname, "../output/playwright");
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, "survival-rules-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`无限生存规则检查通过：${checks.length} 项，1000 份关卡布局。`);
