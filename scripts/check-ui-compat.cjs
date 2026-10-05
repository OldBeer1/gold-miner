"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), { spawnSync } = require("node:child_process");
const config = require("../js/config.js"), rules = require("../js/rules.js"), growth = require("../js/growth.js"), storage = require("../js/storage.js"), challenges = require("../js/challenges.js");
const baselineCommit = "9a82b3a21b82752dba77743d144614075020970a";
function loadBaseline() {
  const cache = {};
  function load(name) {
    name = name.replace(/^\.\//, "");
    if (!["config.js", "challenges.js", "growth.js", "rules.js", "storage.js"].includes(name)) throw new Error("Unexpected baseline module");
    if (cache[name]) return cache[name].exports;
    const source = spawnSync("git", ["show", `${baselineCommit}:js/${name}`], { encoding: "utf8" });
    assert.equal(source.status, 0, source.stderr);
    const module = { exports: {} }; cache[name] = module;
    vm.runInThisContext(`(function(module, exports, require) {\n${source.stdout}\n})`, { filename: `v140/${name}` })(module, module.exports, load);
    return module.exports;
  }
  return Object.fromEntries(["config", "challenges", "growth", "rules", "storage"].map(name => [name, load(`${name}.js`)]));
}
function collect(run, engine, settings) {
  while (run.elapsedTime < 45 && run.levelIncome < run.level.target) {
    if (run.hook.phase === "swinging" && run.minerals.some(m => m.safeRoute && m.status === "available" && Math.abs(Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI - run.hook.angle) <= .5)) engine.launchHook(run);
    engine.advanceRun(run, 1 / 120, settings);
  }
  assert.ok(run.levelIncome >= run.level.target); engine.advanceRun(run, 100, settings);
}
function fixture(base, mode, kind = "level", seed = 42) {
  const now = "2026-10-03T08:00:00.000Z", challenge = base.challenges.create(mode, seed, mode === "daily" ? "2026-10-03" : null);
  const doc = base.growth.createDocument({ soundEnabled: true, highScore: 0, bestClearedLevel: 0 }, now);
  const run = base.rules.createRun(base.config, 1, { challenge, runSeed: challenge.seed });
  const cp = base.rules.captureCheckpoint(run, "level", base.config);
  base.growth.createActive(doc, cp, `baseline-${mode}-${kind}-${seed}`, now, false); base.growth.enterLevel(doc, cp, now);
  if (kind === "shop") { collect(run, base.rules, base.config); base.growth.settleLevel(doc, run, base.rules.captureCheckpoint(run, "shop", base.config), now); }
  if (kind === "report") base.growth.abandon(doc, now);
  doc.revision = 7;
  assert.ok(base.storage.validateProgress(doc, base.config)); return doc;
}
if (require.main === module) {
  const base = loadBaseline(), checks = [];
  const add = (name, action) => { action(); checks.push(name); console.log(name); };
  add("发行 1.4.1 / 规则 1.4.0 分离，玩法参数逐项与验收源码一致", () => {
    assert.equal(config.version, "1.4.1"); assert.equal(config.rulesVersion, "1.4.0");
    const current = growth.clone(config), original = growth.clone(base.config); delete current.version; delete current.rulesVersion; delete original.version;
    assert.deepEqual(current, original);
  });
  let layouts = 0, shops = 0;
  add("三模式 90 组固定种子/关号：地图、事件、奖励值、目标、收益和商店精确一致", () => {
    for (const mode of challenges.modes) for (const [index, seed] of [0, 9, 42, 123, 0xffffffff].entries()) for (const n of [1, 4, 5, 10, 19, 20]) {
      const date = mode === "daily" ? ["2024-02-29", "2026-10-03", "2026-10-04", "2026-10-05", "2026-12-31"][index] : null;
      const challenge = challenges.create(mode, seed, date);
      assert.deepEqual(challenge, base.challenges.create(mode, seed, date));
      const entry = { challenge, runSeed: challenge.seed, wallet: 20000 }, a = rules.createRun(config, n, entry), b = base.rules.createRun(base.config, n, entry);
      assert.deepEqual(a.level, b.level); layouts++;
      // 固定成功状态仅比较商店生成，完整通关另由正式规则检查验证。
      a.result = b.result = { success: true };
      assert.deepEqual(rules.createShop(a, config), base.rules.createShop(b, base.config)); shops++;
    }
  });
  add("v1.4.0 三模式入口/商店/报告直接读取，修订/原文/个人最佳不写入或迁移", () => {
    for (const mode of challenges.modes) for (const kind of ["level", "shop", "report"]) {
      const document = fixture(base, mode, kind), raw = JSON.stringify(document), data = new Map([[storage.progressKey, raw]]); let writes = 0;
      const db = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes++; data.set(key, value); } };
      const loaded = storage.loadProgress(db, config, "2026-10-05T08:00:00Z");
      assert.equal(loaded.blocked, false); assert.equal(loaded.revision, 7); assert.deepEqual(loaded.document, document); assert.equal(writes, 0); assert.equal(data.get(storage.progressKey), raw);
      if (document.activeRun) assert.deepEqual(rules.restoreCheckpoint(document.activeRun.checkpoint, config), base.rules.restoreCheckpoint(document.activeRun.checkpoint, base.config));
      assert.equal(data.get(storage.v120BackupKey), undefined);
    }
  });
  add("旧配置无 rulesVersion 仍回退 version，现行日期派生/记录键/分享不换规则", () => {
    const fallback = { ...config }; delete fallback.rulesVersion; fallback.version = "1.4.0";
    assert.deepEqual(rules.createLevel(fallback, 5, 42), rules.createLevel(config, 5, 42));
    assert.ok(storage.validateProgress(fixture(base, "seed"), fallback));
    for (const date of ["2024-02-29", "2026-10-03", "2026-10-05"]) {
      assert.equal(challenges.dailySeed(date), base.challenges.dailySeed(date));
      assert.equal(challenges.key(challenges.create("daily", 0, date)), base.challenges.key(base.challenges.create("daily", 0, date)));
    }
    assert.equal(challenges.share(fixture(base, "seed", "report").profile.recentReports[0]), base.challenges.share(fixture(base, "seed", "report").profile.recentReports[0]));
  });
  fs.writeFileSync("output/playwright/survival-v141-compat-report.json", JSON.stringify({ version: config.version, rulesVersion: config.rulesVersion, baselineCommit, result: "passed", checks, layouts, shops, method: "exact comparison against committed v1.4.0 source; formal fixtures, not gameplay performance claims" }, null, 2) + "\n");
}
module.exports = { loadBaseline, fixture, collect };
