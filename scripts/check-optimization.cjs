"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{loadBaseline}=require("./check-ui-compat.cjs");
const config=require("../js/config.js"),rules=require("../js/rules.js"),base=loadBaseline("v1.5.3");
const report={version:config.version,rulesVersion:config.rulesVersion,method:"deterministic exact differential rays and interleaved warmed Node generation timing; same rules, not a browser FPS claim",rays:0,samples:[],rounds:[]};
let seedState=154; const random=()=>{seedState=(Math.imul(seedState,1664525)+1013904223)>>>0;return seedState/4294967296;}; const objects=Object.keys(config.minerals).map((type,i)=>({id:String(i),type,status:"available",x:100+i*80,y:250+i%3*80}));
for(let i=0;i<40000;i++){
  const start={x:random()*1200-120,y:random()*800-80},end=i%17===0?start:{x:random()*1200-120,y:random()*800-80};
  assert.deepEqual(rules.firstHit(start,end,objects,config),base.rules.firstHit(start,end,objects,base.config));report.rays++;
}
for(const mineral of objects)for(const side of [-1,1])for(const offset of [-1e-7,0,1e-7]){
  const def=config.minerals[mineral.type],extent=(def.radius??def.width/2)+8+offset;
  const start={x:mineral.x+side*extent,y:mineral.y-100},end={x:start.x,y:mineral.y+100};
  assert.deepEqual(rules.firstHit(start,end,[mineral],config),base.rules.firstHit(start,end,[mineral],base.config));report.rays++;
}
const cases=[];for(const n of [1,4,10,30,1000])for(let seed=0;seed<20;seed++)cases.push([n,seed]);
for(const engine of [base,{config,rules}])for(let i=0;i<20;i++)engine.rules.createLevel(engine.config,...cases[i],"none");
for(let round=0;round<5;round++){
  const measured={round};
  for(const [label,engine] of round%2?[["current",{config,rules}],["previous",base]]:[["previous",base],["current",{config,rules}]]){
    const times=[];
    for(const [n,seed] of cases){const t=performance.now(),level=engine.rules.createLevel(engine.config,n,seed,"none");times.push(performance.now()-t);
      if(round===0){const other=(label==="previous"?rules:base.rules).createLevel(label==="previous"?config:base.config,n,seed,"none");assert.deepEqual(level,other);}
    }
    const sorted=[...times].sort((a,b)=>a-b); measured[label]={medianMs:sorted[49],p95Ms:sorted[94],totalMs:times.reduce((a,b)=>a+b,0)};
  }
  report.rounds.push(measured);
}
report.result="passed";
fs.writeFileSync("output/playwright/survival-v154-optimization-engine-report.json",JSON.stringify(report,null,2)+"\n");
console.log(`${report.rays} differential rays and 100 identical maps passed; five timing rounds: ${JSON.stringify(report.rounds)}`);
