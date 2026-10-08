"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const config = require("../js/config.js"), rules = require("../js/rules.js"), growth = require("../js/growth.js"), storage = require("../js/storage.js"), challenges = require("../js/challenges.js");
const { loadBaseline, fixture } = require("./check-ui-compat.cjs");
const { assertDensity } = require("./check-density.cjs");
const checks = [], cases = [], minima = { width: Infinity, height: Infinity, distanceRange: Infinity }, downgrade = { previous: 0, current: 0 };
function check(name, action) { action(); checks.push(name); console.log(name); }
function spread(level) {
  assertDensity(level);
  const bases = level.layout.filter(m => m.safeRoute), xs = bases.map(m => m.x), ys = bases.map(m => m.y), distances = bases.map(m => Math.hypot(m.x - 480, m.y - 112));
  const result = { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), distanceRange: Math.max(...distances) - Math.min(...distances) };
  assert.equal(bases.length, 9);
  assert.ok(result.width >= 560 && result.height >= 260 && result.distanceRange >= 220);
  const shift = Math.min(22, level.difficulty * 2 + level.pressure * 4);
  const cells = new Set(bases.map(m => Math.floor((m.x - 95) / 290) + 3 * Math.floor((m.y - 235 - shift) / 140)));
  assert.equal(cells.size, 9);
  for (const key of Object.keys(minima)) minima[key] = Math.min(minima[key], result[key]);
  for (const m of level.layout) assert.ok(rules.validPlacement(m, level.layout.filter(other => other !== m), config));
  assert.equal(level.layout.filter(m => m.routeObstacle).length, level.obstacleCount);
  for (const stone of level.layout.filter(m => m.routeObstacle)) {
    const base = bases.find(m => m.id === stone.id.replace("-block", "-safe"));
    assert.ok(base);
    assert.ok(Math.abs(stone.x - (480 + (base.x - 480) * .62)) < 1e-8);
    assert.ok(Math.abs(stone.y - (112 + (base.y - 112) * .62)) < 1e-8);
  }
  assert.ok(level.route.success && level.route.seconds <= 45);
  return result;
}
check("普通与全部事件、所有档位和极大关号：强制错落备用模板可解且不回退圆弧", () => {
  const forced = { ...config, survival: { ...config.survival, maxAttempts: 0 } };
  for (const n of [1,4,5,10,20,30,40,100,1000,Number.MAX_SAFE_INTEGER]) for (const id of Object.keys(config.events.definitions)) {
    const level = rules.createLevel(forced,n,42,id);
    assert.equal(level.fallback,true); assert.equal(level.event.id,id);
    assert.deepEqual(level,rules.createLevel(forced,n,99,id));
    const metrics = spread(level);
    cases.push({level:n,event:id,seconds:level.route.seconds,...metrics,geometrySha256:crypto.createHash("sha256").update(JSON.stringify(level.layout)).digest("hex")});
  }
});
check("660 个同种子/关号/请求事件对比：记录旧版及新版事件降级，分散条件始终满足", () => {
  const old = rules.configForVersion(config,"1.5.2");
  for (const n of [1,4,5,9,10,19,20,30,40,100,1000]) for (const id of Object.keys(config.events.definitions)) for (let seed=0;seed<10;seed++) {
    const current = rules.createLevel(config,n,seed,id), previous = rules.createLevel(old,n,seed,id);
    downgrade.previous += Number(previous.event.id !== id); downgrade.current += Number(current.event.id !== id);
    spread(current);
  }
  assert.ok(downgrade.current <= downgrade.previous);
});
check("v1.5.2 三模式档案备份失败/重试/已有备份、外部修订、跨日和历史成果保留", () => {
  const base = loadBaseline("v1.5.2"), now = "2026-10-08T08:00:00.000Z";
  for (const mode of challenges.modes) {
    const document = fixture(base,mode,"shop"), raw = JSON.stringify(document), data = new Map([[storage.progressKey,raw]]);
    let denied = true;
    const db = { getItem:k=>data.get(k)??null, setItem:(k,v)=>{if(denied)throw Error("quota");data.set(k,v);} };
    const loaded = storage.loadProgress(db,config,now);
    assert.equal(loaded.blocked,false); assert.match(loaded.message,/未能保存/); assert.equal(data.get(storage.progressKey),raw);
    assert.deepEqual(loaded.document.activeRun,document.activeRun); assert.deepEqual(loaded.document.profile,document.profile);
    denied = false; assert.ok(storage.saveProgress(db,loaded.document,config,loaded.revision).saved);
    assert.equal(data.get(storage.v152BackupKey),raw);
    assert.ok(storage.saveProgress(db,loaded.document,config,loaded.revision).conflict);
    const restored = storage.loadProgress(db,config,now);
    assert.deepEqual(restored.document.activeRun.challenge,document.activeRun.challenge);
    const originalBackup = data.get(storage.v152BackupKey);
    storage.loadProgress(db,config,now); assert.equal(data.get(storage.v152BackupKey),originalBackup);
    if(mode === "daily") assert.equal(restored.document.activeRun.challenge.date,"2026-10-03");
    const unknown = JSON.stringify({...restored.document,rulesVersion:"9.0.0"});data.set(storage.progressKey,unknown);
    assert.ok(storage.loadProgress(db,config,now).blocked);assert.equal(data.get(storage.progressKey),unknown);
  }
});
check("五套规则最佳键隔离、旧档不能接受未来规则；同模式新版生成和奖励确定", () => {
  const doc=growth.createDocument({soundEnabled:true,highScore:0,bestClearedLevel:0},"2026-10-07T08:00:00Z");
  for(const version of challenges.supportedVersions) {
    const challenge=challenges.create("seed",42,null,version);
    doc.profile.challengeRecords[challenges.key(challenge)]={challenge,runId:"record-"+version,updatedAt:"2026-10-07T08:00:00Z",levelsCleared:1,qualifiedIncome:650,activePlayMs:60000};
  }
  assert.equal(Object.keys(doc.profile.challengeRecords).length,5);assert.ok(storage.validateProgress(doc,config));
  const future=growth.clone(doc);future.rulesVersion="1.5.0";assert.equal(storage.validateProgress(future,rules.configForVersion(config,"1.5.0")),null);
  for(const mode of challenges.modes) {
    const challenge=challenges.create(mode,42,mode==="daily"?"2026-10-07":null);
    assert.deepEqual(rules.createRun(config,4,{challenge,runSeed:challenge.seed}),rules.createRun(config,4,{challenge,runSeed:challenge.seed}));
  }
});
fs.writeFileSync("output/playwright/survival-v154-layouts-report.json",JSON.stringify({version:config.version,result:"passed",method:"formal deterministic generation, route verification and controlled save fixtures; not browser or real-time gameplay",checks,minima,comparisonMaps:660,downgrade,fallbackCases:cases},null,2)+"\n");
