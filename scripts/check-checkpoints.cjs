"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../js/config.js");
const rules = require("../js/rules.js");
const storage = require("../js/storage.js");
const checks = [];
function check(name, action) { action(); checks.push({ name, result: "passed" }); }
function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const level = { id: 4, target: 650, duration: 60, layout: [
  { id: "gold", type: "largeGold", x: 480, y: 330 },
  { id: "bag", type: "mysteryBag", x: 580, y: 360, rewardRoll: .96 },
] };
function entry() { return rules.createRun(config, 4, { level, runSeed: 987, wallet: 200, totalIncome: 1000, bombs: 3,
  effects: { protectionCharm: true, timeCoupon: true, luckyCharm: true } }); }
check("关中变化全部回滚到同种子、布局、奖励、资源与增益的入口", () => {
  const run = entry(), expected = structuredClone(run), snapshot = rules.captureCheckpoint(run, "level", config);
  const db = memory(); assert.ok(storage.saveCheckpoint(db, snapshot, config));
  run.wallet += 800; run.bombs = 0; run.effects.protectionCharm = false; rules.advanceRun(run, 10, config);
  assert.deepEqual(rules.restoreCheckpoint(storage.loadCheckpoint(db, config).checkpoint, config), expected);
  assert.throws(() => rules.captureCheckpoint(run, "level", config));
});
check("成功收入只结算一次，商店报价/商品/购物次数与状态重复恢复不变", () => {
  const run = entry(); run.levelIncome = 2000; run.wallet += 2000; rules.advanceRun(run, 70, config);
  const shop = rules.createShop(run, config); assert.ok(rules.purchaseItem(run, shop, "dynamite", config).success);
  const item = shop.offers[1]; assert.ok(rules.purchaseItem(run, shop, item, config).success);
  const snapshot = rules.captureCheckpoint(run, "shop", config), db = memory();
  assert.ok(storage.saveCheckpoint(db, snapshot, config));
  for (let i = 0; i < 3; i++) {
    const restored = rules.restoreCheckpoint(storage.loadCheckpoint(db, config).checkpoint, config);
    assert.deepEqual(restored.shop, shop); assert.equal(restored.wallet, run.wallet); assert.equal(restored.totalIncome, 3000);
    assert.equal(rules.advanceRun(restored, 100, config).length, 0);
    assert.ok(!rules.purchaseItem(restored, restored.shop, item, config).success);
    assert.deepEqual(rules.captureCheckpoint(restored, "shop", config), snapshot);
  }
});
check("四件限购在存档恢复后继续累计，第五件不扣款", () => {
  const run = entry(); run.bombs = 0; run.levelIncome = 5000; run.wallet += 5000; rules.advanceRun(run, 70, config);
  const shop = rules.createShop(run, config); rules.purchaseItem(run, shop, "dynamite", config);
  const restored = rules.restoreCheckpoint(rules.captureCheckpoint(run, "shop", config), config);
  for (let i = 0; i < 3; i++) assert.ok(rules.purchaseItem(restored, restored.shop, "dynamite", config).success);
  const wallet = restored.wallet;
  assert.ok(!rules.purchaseItem(restored, restored.shop, "dynamite", config).success);
  assert.equal(restored.wallet, wallet); assert.equal(restored.shop.purchaseCount, 4); assert.equal(restored.bombs, 4);
});
check("新版成绩从零开始，只迁移音效，旧键内容不变", () => {
  const db = memory(); const old = JSON.stringify({ soundEnabled: false, highScore: 8888, bestClearedLevel: 90 });
  db.setItem(storage.previousKey, old); db.setItem(storage.legacyKey, old);
  assert.deepEqual(storage.loadPreferences(db), { soundEnabled: false, highScore: 0, bestClearedLevel: 0 });
  assert.ok(storage.savePreferences(db, { soundEnabled: true, highScore: 50, bestClearedLevel: 2 }));
  assert.equal(storage.loadPreferences(db).highScore, 50); assert.equal(db.getItem(storage.previousKey), old);
});
check("损坏、非法字段和不兼容存档均拒绝恢复，并保留覆盖提示", () => {
  const good = rules.captureCheckpoint(entry(), "level", config), db = memory();
  for (const mutate of [v => { v.schemaVersion = 99; }, v => { v.rulesVersion = "old"; },
    v => { v.run.wallet = -1; }, v => { v.run.bombs = 6; }, v => { v.run.level.layout[0].type = "unknown"; },
    v => { v.run.level.layout[0].x = 9999; }, v => { v.run.effects.strength = "yes"; }]) {
    const bad = structuredClone(good); mutate(bad); assert.equal(storage.validateCheckpoint(bad, config), null);
  }
  for (const text of ["{bad", "x".repeat(100001), "null", '{"schemaVersion":99}']) {
    db.setItem(storage.checkpointKey, text);
    const result = storage.loadCheckpoint(db, config); assert.equal(result.checkpoint, null); assert.ok(result.hasData && result.message);
  }
});
check("读写/删除不可用安全返回，失败删除不影响记录", () => {
  const unavailable = { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); }, removeItem() { throw Error("blocked"); } };
  assert.equal(storage.saveCheckpoint(unavailable, rules.captureCheckpoint(entry(), "level", config), config), false);
  assert.equal(storage.loadCheckpoint(unavailable, config).checkpoint, null); assert.equal(storage.clearCheckpoint(unavailable), false);
  const db = memory(); storage.savePreferences(db, { highScore: 100 }); storage.saveCheckpoint(db, rules.captureCheckpoint(entry(), "level", config), config);
  assert.ok(storage.clearCheckpoint(db)); assert.equal(storage.loadCheckpoint(db, config).checkpoint, null); assert.equal(storage.loadPreferences(db).highScore, 100);
});
fs.writeFileSync(path.resolve(__dirname, "../output/playwright/survival-v110-checkpoints-report.json"), JSON.stringify({ version: config.version, checks, result: "passed" }, null, 2) + "\n");
console.log(`存档规则检查通过：${checks.length} 项。`);
