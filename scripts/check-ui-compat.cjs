"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), { spawnSync } = require("node:child_process");
const config = require("../js/config.js"), rules = require("../js/rules.js"), growth = require("../js/growth.js"), storage = require("../js/storage.js"), challenges = require("../js/challenges.js");
const baselineCommit = "9a82b3a21b82752dba77743d144614075020970a";
function loadBaseline(commit = baselineCommit) {
  const cache = {};
  function load(name) {
    name = name.replace(/^\.\//, "");
    if (!["config.js", "challenges.js", "growth.js", "rules.js", "storage.js"].includes(name)) throw new Error("Unexpected baseline module");
    if (cache[name]) return cache[name].exports;
    const source = spawnSync("git", ["show", `${commit}:js/${name}`], { encoding: "utf8" });
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
  const checks = [], baselines = [{version:"1.4.0",commit:baselineCommit}, {version:"1.5.0",commit:"v1.5.0"}, {version:"1.5.1",commit:"v1.5.1"}, {version:"1.5.2",commit:"v1.5.2"}, {version:"1.5.3",commit:"v1.5.3"}];
  const add = (name, action) => { action(); checks.push(name); console.log(name); };
  let layouts = 0, shops = 0;
  for (const baseline of baselines) {
  const base = loadBaseline(baseline.commit), version = baseline.version;
  add(`新规则 1.5.3；旧 ${version} 参数精确保留`, () => {
    assert.equal(config.version,"1.5.4"); assert.equal(config.rulesVersion,"1.5.3");
    const current = growth.clone(rules.configForVersion(config,version)), original = growth.clone(base.config);
    delete current.version; delete original.version;
    if (version === "1.4.0") { delete current.rulesVersion; delete current.legacyMineralSizes; assert.deepEqual(require("../docs/history/three-level-layouts.json").levels,original.levels); delete original.levels; }
    assert.deepEqual(current,original);
  });
  add(`${version} 三模式 90 地图/商店：事件、奖励、目标、收益和报价精确一致`, () => {
    for (const mode of challenges.modes) for (const [index, seed] of [0, 9, 42, 123, 0xffffffff].entries()) for (const n of [1, 4, 5, 10, 19, 20]) {
      const date = mode === "daily" ? ["2024-02-29", "2026-10-03", "2026-10-04", "2026-10-05", "2026-12-31"][index] : null;
      const challenge = challenges.create(mode, seed, date, version);
      assert.deepEqual(challenge, base.challenges.create(mode, seed, date));
      const entry = { challenge, runSeed: challenge.seed, wallet: 20000 }, a = rules.createRun(config, n, entry), b = base.rules.createRun(base.config, n, entry);
      assert.deepEqual(a.level, b.level); layouts++;
      // 固定成功状态仅比较商店生成，完整通关另由正式规则检查验证。
      a.result = b.result = { success: true };
      assert.deepEqual(rules.createShop(a, config), base.rules.createShop(b, base.config)); shops++;
    }
  });
  add(`${version} 三模式入口/商店/报告：按实际规则升级或直接读取，幂等且不改变活动/报价/历史`, () => {
    for (const mode of challenges.modes) for (const kind of ["level", "shop", "report"]) {
      const document = fixture(base, mode, kind), raw = JSON.stringify(document), data = new Map([[storage.progressKey, raw]]); let writes = 0;
      const db = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes++; data.set(key, value); } };
      const loaded = storage.loadProgress(db, config, "2026-10-05T08:00:00Z");
      const sameRules = version === config.rulesVersion, expectedWrites = sameRules ? 0 : 2;
      assert.equal(loaded.blocked, false); assert.equal(loaded.revision, sameRules ? 7 : 8); assert.equal(writes, expectedWrites);
      if (sameRules) assert.equal(data.get(storage.progressKey), raw);
      else assert.equal(data.get(version === "1.4.0" ? storage.v140BackupKey : version === "1.5.0" ? storage.v150BackupKey : version === "1.5.1" ? storage.v151BackupKey : storage.v152BackupKey), raw);
      assert.deepEqual(loaded.document.activeRun,document.activeRun); assert.deepEqual(loaded.document.profile.recentReports,document.profile.recentReports); assert.deepEqual(loaded.document.profile.challengeRecords,document.profile.challengeRecords);
      assert.deepEqual(storage.loadProgress(db,config).document,loaded.document); assert.equal(writes,expectedWrites);
      if (document.activeRun) assert.deepEqual(rules.restoreCheckpoint(document.activeRun.checkpoint, config), base.rules.restoreCheckpoint(document.activeRun.checkpoint, base.config));
      assert.equal(data.get(storage.v120BackupKey), undefined);
    }
  });
  add(`${version} 无 rulesVersion 回退 version；旧日期/键/分享保留，同规则赛题不变`, () => {
    const fallback = { ...rules.configForVersion(config,version) }; delete fallback.rulesVersion; fallback.version = version;
    assert.deepEqual(rules.createLevel(fallback, 5, 42), base.rules.createLevel(base.config, 5, 42));
    assert.ok(storage.validateProgress(fixture(base, "seed"), fallback));
    for (const date of ["2024-02-29", "2026-10-03", "2026-10-05"]) {
      assert.equal(challenges.dailySeed(date,version), base.challenges.dailySeed(date));
      assert.equal(challenges.key(challenges.create("daily", 0, date,version)), base.challenges.key(base.challenges.create("daily", 0, date)));
      if (version === config.rulesVersion) {
        assert.equal(challenges.dailySeed(date),base.challenges.dailySeed(date));
        assert.equal(challenges.key(challenges.create("daily",0,date)),challenges.key(challenges.create("daily",0,date,version)));
      } else {
        assert.notEqual(challenges.dailySeed(date),base.challenges.dailySeed(date));
        assert.notEqual(challenges.key(challenges.create("daily",0,date)),challenges.key(challenges.create("daily",0,date,version)));
      }
    }
    assert.equal(challenges.share(fixture(base, "seed", "report").profile.recentReports[0]), base.challenges.share(fixture(base, "seed", "report").profile.recentReports[0]));
  });
  }
  fs.writeFileSync("output/playwright/survival-v154-compat-report.json", JSON.stringify({ version: config.version, rulesVersion: config.rulesVersion, baselines, result: "passed", checks, layouts, shops, method: "legacy-rule exact comparison against committed v1.4.0, v1.5.0, v1.5.1, v1.5.2 and v1.5.3; formal fixtures, not real-time gameplay" }, null, 2) + "\n");
}
module.exports = { loadBaseline, fixture, collect };
