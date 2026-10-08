"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const config = require("../js/config.js"), rules = require("../js/rules.js");
const { loadBaseline } = require("./check-ui-compat.cjs");
const checks = [], close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
function check(name, run) { run(); checks.push(name); console.log(name); }
const mineral = type => ({id:type,type,x:480,y:360,status:"available"});
const ray = x => [{x,y:112},{x,y:616}];
check("九类物体侧边 8 像素内命中、8 像素外不命中，零半径恢复原轮廓", () => {
  const pointConfig = {...config,hook:{...config.hook,captureRadius:0}};
  const missing = {...config,hook:{...config.hook}}; delete missing.hook.captureRadius;
  for (const type of Object.keys(config.minerals)) {
    const m=mineral(type), d=config.minerals[type], half=d.radius||d.width/2;
    for(const offset of [0,half,half+7.999,half+8]) assert.equal(rules.firstHit(...ray(480+offset),[m],config)?.mineral.id,type);
    assert.equal(rules.firstHit(...ray(480+half+8.001),[m],config),null);
    assert.equal(rules.firstHit(...ray(480+half+.001),[m],pointConfig),null);
    assert.deepEqual(rules.firstHit(...ray(480+half+.001),[m],missing),rules.firstHit(...ray(480+half+.001),[m],pointConfig));
  }
});
check("矩形外扩四角为圆角，斜角不出现方形额外吸附；正面/切线/零长度正确", () => {
  for(const type of Object.keys(config.minerals).filter(t=>!config.minerals[t].radius)) {
    const m=mineral(type),d=config.minerals[type];
    for(const sx of [-1,1]) for(const sy of [-1,1]) {
      const corner={x:m.x+sx*d.width/2,y:m.y+sy*d.height/2};
      for(const [distance,hit] of [[7.999,true],[8.001,false]]) {
        const point={x:corner.x+sx*distance*.6,y:corner.y+sy*distance*.8};
        assert.equal(!!rules.firstHit(point,point,[m],config),hit);
      }
      const outside={x:corner.x+sx*7,y:corner.y+sy*7};assert.equal(rules.firstHit(outside,outside,[m],config),null);
    }
    const start={x:m.x,y:200},end={x:m.x,y:500};
    close(rules.firstHit(start,end,[m],config).t,(m.y-d.height/2-8-200)/300);
    const side={x:m.x+d.width/2+8,y:m.y};close(rules.firstHit(side,side,[m],config).t,0);
    assert.equal(rules.firstHit({x:900,y:200},{x:900,y:200},[m],config),null);
  }
  const m=mineral("smallGold"); close(rules.firstHit(...ray(508),[m],config).t,(360-112)/504);
});
check("扩大范围仍选最早接触：前方石头/桶优先，等时沿稳定地图顺序；非可用物忽略", () => {
  const behind={...mineral("diamond"),y:460};
  for(const type of ["stone","powderKeg","smallGold"]) {
    const front={...mineral(type),x:500,y:250};
    for(const list of [[behind,front],[front,behind]])assert.equal(rules.firstHit(...ray(480),list,config).mineral.id,front.id);
  }
  const a={...mineral("smallGold"),id:"a"},b={...a,id:"b"};
  assert.equal(rules.firstHit(...ray(480),[b,a],config).mineral.id,"b");b.status="banked";
  assert.equal(rules.firstHit(...ray(480),[b,a],config).mineral.id,"a");
});
check("正式引擎擦边回收、前方障碍和火药桶爆炸；截止在途无入账", () => {
  const fresh=layout=>rules.createRun(config,1,{level:{id:1,duration:60,target:650,layout}});
  const run=fresh([{id:"graze",type:"smallGold",x:507,y:300}]);rules.launchHook(run);rules.advanceRun(run,3,config);
  assert.equal(run.minerals[0].status,"banked");assert.equal(run.levelIncome,100);
  const blocked=fresh([{id:"behind",type:"diamond",x:480,y:460},{id:"front",type:"stone",x:510,y:260}]);
  rules.launchHook(blocked);rules.advanceRun(blocked,3,config);assert.equal(blocked.minerals[0].status,"available");assert.equal(blocked.levelIncome,20);
  const keg=fresh([{id:"barrel",type:"powderKeg",x:500,y:250},{id:"near",type:"smallGold",x:540,y:260}]);
  rules.launchHook(keg);const events=rules.advanceRun(keg,1,config);assert.equal(events.filter(e=>e.type==="exploded").length,1);assert.equal(keg.levelIncome,0);assert.equal(keg.hook.carryingId,null);assert.ok(keg.minerals.every(m=>m.status==="destroyed"));
  const late=fresh([{id:"late",type:"largeGold",x:480,y:550}]);late.remainingTime=.8;rules.launchHook(late);rules.advanceRun(late,2,config);assert.ok(late.settled);assert.equal(late.levelIncome,0);assert.equal(late.wallet,0);
});
check("四套旧规则全部碰撞返回值逐项匹配已发布源码，包含边缘和斜线", () => {
  for(const version of ["1.4.0","1.5.0","1.5.1","1.5.2"]) {
    const base=loadBaseline("v"+version),old=rules.configForVersion(config,version);assert.equal(old.hook.captureRadius,undefined);
    const objects=Object.keys(config.minerals).map((t,i)=>({...mineral(t),id:String(i),x:100+i*80,y:250+(i%3)*80}));
    for(let i=0;i<100;i++) {
      const start={x:480,y:112},end={x:24+i*9.12,y:616};
      assert.deepEqual(rules.firstHit(start,end,objects,old),base.rules.firstHit(start,end,objects,base.config));
    }
  }
});
fs.writeFileSync("output/playwright/survival-v153-hook-report.json",JSON.stringify({version:config.version,result:"passed",method:"analytical collision boundaries, controlled formal engine cases and 400 old-rule rays; not browser or natural play",checks},null,2)+"\n");
