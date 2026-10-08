"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const config = require("../js/config.js"), rules = require("../js/rules.js"), storage = require("../js/storage.js");
const { loadBaseline, fixture } = require("./check-ui-compat.cjs");
function assertDensity(level) {
  const added = level.layout.filter(m => /-dense\d+$/.test(m.id));
  assert.equal(added.length, 8);
  const counts = Object.fromEntries(["smallGold", "diamond", "ruby", "mysteryBag"].map(type => [type, added.filter(m => m.type === type).length]));
  assert.deepEqual(counts, { smallGold: 4, diamond: 1, ruby: 1, mysteryBag: 2 });
  const cells = added.map(m => Math.floor((m.x - 60) / 280) + 3 * Math.floor((m.y - 210) / 125));
  assert.equal(new Set(cells).size, 8);
  for (const axis of [cell => cell % 3, cell => Math.floor(cell / 3)]) for (let i = 0; i < 3; i++) assert.ok(cells.filter(cell => axis(cell) === i).length >= 2);
  for (const mineral of added) {
    assert.ok(rules.validPlacement(mineral, level.layout.filter(m => m !== mineral), config));
    assert.ok(rules.protectsRoute(mineral, level.layout.filter(m => m.safeRoute), config));
    if (level.id >= 4 && ["diamond", "ruby"].includes(mineral.type)) assert.ok(mineral.y >= 400);
  }
  assert.equal(level.layout.length, rules.eventParameters(config, level.id, level.event).count);
  assert.ok(level.layout.length <= 36);
}
if (require.main === module) {
  const checks = [], samples = [], now = "2026-10-07T08:00:00Z";
  const check = (name, run) => { run(); checks.push(name); console.log(name); };
  check("新增八物覆盖八个分区，配比/深度/尺寸/间距/数量准确；每个新增物按正式钩子独立回收", () => {
    for (const n of [1,4,10,30,1000,Number.MAX_SAFE_INTEGER]) for (const id of Object.keys(config.events.definitions)) {
      const level = rules.createLevel(config,n,42,id); assertDensity(level);
      for (const mineral of level.layout.filter(m => /-dense\d+$/.test(m.id))) {
        // 受控场景仅隔离前方物体，保留原位置、尺寸、奖励和真实碰撞/拖回规则。
        const run = rules.createRun(config,n,{level:{...level,layout:[mineral]},runSeed:42,bombs:0});
        run.hook.angle = Math.atan2(mineral.x-480,mineral.y-112)*180/Math.PI;
        assert.ok(rules.launchHook(run)); rules.advanceRun(run,20,config);
        assert.equal(run.minerals[0].status,"banked"); assert.equal(run.growth.objectsRecovered,1);
      }
    }
  });
  check("v152 备份写入失败单独阻止权威升级，重试成功；已有不同备份保持原文", () => {
    const base = loadBaseline("v1.5.2"), old = fixture(base,"daily","shop"), raw=JSON.stringify(old), data=new Map([[storage.progressKey,raw]]);
    let denied=true;const db={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(denied&&k===storage.v152BackupKey)throw Error("backup denied");data.set(k,v);}};
    const loaded=storage.loadProgress(db,config,now);assert.equal(loaded.blocked,false);assert.match(loaded.message,/未能保存/);assert.equal(data.get(storage.progressKey),raw);
    denied=false;assert.ok(storage.saveProgress(db,loaded.document,config,loaded.revision).saved);assert.equal(data.get(storage.v152BackupKey),raw);
    data.set(storage.progressKey,raw);data.set(storage.v152BackupKey,"previous backup retained");const restored=storage.loadProgress(db,config,now);assert.equal(restored.blocked,false);assert.equal(data.get(storage.v152BackupKey),"previous backup retained");assert.deepEqual(restored.document.profile,old.profile);
  });
  check("同输入 v152/v153 生成耗时和四种策略收益/耗时对比；原目标及收益倍率保持", () => {
    const old=rules.configForVersion(config,"1.5.2");
    for(const n of [1,4,10,30,1000])for(let seed=0;seed<20;seed++){
      const sample={level:n,seed};
      for(const [name,cfg] of [["previous",old],["current",config]]){
        const started=performance.now(),level=rules.createLevel(cfg,n,seed,"none");
        sample[name]={generationMs:performance.now()-started,count:level.count,target:level.target,rewardScale:level.rewardScale,fallback:level.fallback,routes:["steady","value","efficiency","safe"].map(s=>rules.verifyRoute(cfg,level,s))};
      }
      assert.equal(sample.current.count-sample.previous.count,0);assert.equal(sample.current.target,sample.previous.target);assert.equal(sample.current.rewardScale,sample.previous.rewardScale);samples.push(sample);
    }
  });
  fs.writeFileSync("output/playwright/survival-v153-density-report.json",JSON.stringify({version:config.version,result:"passed",method:"formal geometry, controlled isolated-target recovery/save cases and Node timing; not browser or natural gameplay",checks,samples},null,2)+"\n");
}
module.exports={assertDensity};
