"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const config = require("../js/config.js"), rules = require("../js/rules.js"), growth = require("../js/growth.js"), storage = require("../js/storage.js"), challenges = require("../js/challenges.js");
const { loadBaseline, fixture } = require("./check-ui-compat.cjs");
const base=loadBaseline(), oldConfig=rules.configForVersion(config,"1.4.0"), now="2026-10-07T08:00:00Z", checks=[];
function check(name,fn) { fn(); checks.push({name,result:"passed"}); console.log(name); }
function database(raw) { const data=new Map([[storage.progressKey,raw]]); let writes=0;return {data,get writes(){return writes;},getItem:key=>data.get(key)??null,setItem:(key,v)=>{writes++;data.set(key,v);}}; }
check("四类小物放大、基础价值/回速/钩子/计时/事件/商店不变",()=>{
  for(const [type,expected] of Object.entries({smallGold:{radius:20},diamond:{width:30,height:36},ruby:{width:30,height:36},mysteryBag:{width:36,height:42}})) {
    assert.deepEqual(config.minerals[type],{...base.config.minerals[type],...expected});
  }
  for(const type of growth.types.filter(t=>!config.legacyMineralSizes[t])) assert.deepEqual(config.minerals[type],base.config.minerals[type]);
  assert.equal(config.hook.captureRadius,8); const oldHook={...config.hook};delete oldHook.captureRadius;assert.deepEqual(oldHook,base.config.hook);
  for(const key of ["levelDuration","simulation","initialRun","events","shop","mine","canvas"]) assert.deepEqual(config[key],base.config[key]);
});
check("新轮廓擦边可抓、旧轮廓外路径改善；边界外无远距离吸附",()=>{
  for(const type of Object.keys(config.legacyMineralSizes)) {
    const d=config.minerals[type], half=d.radius||d.width/2, m={id:type,type,x:480,y:360,status:"available"};
    const ray=offset=>[{x:480+offset,y:112},{x:480+offset,y:616}];
    assert.equal(rules.firstHit(...ray(half),[m],config)?.mineral.id,type);
    assert.equal(rules.firstHit(...ray(half+8+.01),[m],config),null);
    const offset=((oldConfig.minerals[type].radius||oldConfig.minerals[type].width/2)+half)/2;
    assert.equal(rules.firstHit(...ray(offset),[m],oldConfig),null); assert.ok(rules.firstHit(...ray(offset),[m],config));
  }
});
check("最近碰撞优先、石头阻挡、火药桶风险与顺序无关",()=>{
  const start={x:480,y:112},end={x:480,y:616};
  const behind={id:"diamond",type:"diamond",x:480,y:460,status:"available"};
  for(const type of ["stone","powderKeg","smallGold"]) {
    const front={id:"front",type,x:480,y:250,status:"available"};
    for(const list of [[behind,front],[front,behind]]) assert.equal(rules.firstHit(start,end,list,config).mineral.id,"front");
  }
  const run=rules.createRun(config,1,{level:{id:1,duration:60,target:650,layout:[{id:"keg",type:"powderKeg",x:480,y:250},behind]}});
  rules.launchHook(run); const events=rules.advanceRun(run,.5,config);assert.ok(events.some(e=>e.type==="exploded"));assert.equal(run.levelIncome,0);assert.equal(run.hook.carryingId,null);
});
check("历史 12 项退出可解锁目录，旧徽章/称号/报告保留，升级补发幂等",()=>{
  assert.equal(growth.retiredDefinitions.length,12);assert.equal(growth.allDefinitions.length,25);
  const old=fixture(base,"endless","shop");
  for(const d of base.growth.definitions) if(growth.retiredDefinitions.some(retired=>retired.id===d.id)) old.profile.achievements[d.id]={progress:d.target,unlockedAt:now,unlockedRunId:"historical-award"};
  old.profile.equippedTitleId="clear_20";assert.ok(base.storage.validateProgress(old,base.config));
  const raw=JSON.stringify(old),db=database(raw), loaded=storage.loadProgress(db,config,now);
  assert.equal(loaded.blocked,false);assert.equal(db.data.get(storage.v140BackupKey),raw);
  for(const d of growth.retiredDefinitions) assert.deepEqual(loaded.document.profile.achievements[d.id],old.profile.achievements[d.id]);
  assert.ok(growth.equipTitle(loaded.document,"clear_20"));assert.ok(loaded.document.profile.achievements.first_recovery.unlockedAt);
  assert.equal(loaded.document.profile.achievements.first_recovery.unlockedRunId,"upgrade-statistics");
  assert.deepEqual(loaded.document.activeRun.newAchievementIds,old.activeRun.newAchievementIds);
  const again=storage.loadProgress(db,config,now);assert.deepEqual(again.document,loaded.document);assert.equal(db.writes,2);
  const fresh=growth.createDocument({soundEnabled:true,highScore:1000000,bestClearedLevel:100},now);growth.evaluate(fresh,null,now,true);growth.evaluate(fresh,null,now);
  for(const d of growth.retiredDefinitions) assert.equal(fresh.profile.achievements[d.id].unlockedAt,null);
});
check("迁移拒绝写入保留旧原文，恢复重试成功；外部修订和未知格式保护",()=>{
  const raw=JSON.stringify(fixture(base,"daily","shop")),db=database(raw), set=db.setItem;db.setItem=()=>{throw Error("quota");};
  const loaded=storage.loadProgress(db,config,now);assert.equal(loaded.blocked,false);assert.match(loaded.message,/保存失败/);assert.equal(db.data.get(storage.progressKey),raw);
  assert.ok(storage.validateProgress(loaded.document,config));db.setItem=set;
  assert.ok(storage.saveProgress(db,loaded.document,config,loaded.revision).saved);
  assert.equal(storage.saveProgress(db,loaded.document,config,loaded.revision).conflict,true);
  const unknown=JSON.stringify({...loaded.document,rulesVersion:"9.0.0"});db.data.set(storage.progressKey,unknown);
  assert.equal(storage.loadProgress(db,config,now).blocked,true);assert.equal(db.data.get(storage.progressKey),unknown);
});
check("旧/新个人最佳同时保留且键隔离，混合版本报告和商店合法",()=>{
  const old=fixture(base,"seed","report"),loaded=storage.adaptV140Progress(old,config,now), p=loaded.profile;
  for(const version of ["1.4.0","1.5.0"]) {const challenge=challenges.create("seed",42,null,version);p.challengeRecords[challenges.key(challenge)]={challenge,runId:"record-"+version,updatedAt:now,levelsCleared:1,qualifiedIncome:650,activePlayMs:60000};}
  assert.equal(Object.keys(p.challengeRecords).length,2);assert.ok(storage.validateProgress(loaded,config));
  assert.match(challenges.share(p.recentReports[0]),/规则：1\.4\.0/);
  const wrong=growth.clone(loaded);wrong.profile.recentReports[0].challenge.rulesVersion="1.5.0";assert.equal(storage.validateProgress(wrong,config),null);
});
fs.writeFileSync("output/playwright/survival-v154-gameplay-report.json",JSON.stringify({version:config.version,rulesVersion:config.rulesVersion,method:"formal collision tests and controlled committed-baseline save fixtures; not real-time play",checks,result:"passed"},null,2)+"\n");
