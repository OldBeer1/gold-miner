"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const config=require("../js/config.js"),rules=require("../js/rules.js"),{loadBaseline}=require("./check-ui-compat.cjs");
const samples=[];
for(const version of ["1.4.0","1.5.0","1.5.1"]){
  const old=loadBaseline("v"+version),effective=rules.configForVersion(config,version);
  for(const n of [10,30,1000]){
    const steady=[],fastest=[];
    for(let seed=0;seed<100;seed++){
      const current=rules.createLevel(effective,n,seed,"none"),previous=old.rules.createLevel(old.config,n,seed,"none");assert.deepEqual(current,previous);
      const routes=["steady","value","efficiency","safe"].map(s=>{const route=rules.verifyRoute(effective,current,s);assert.deepEqual(route,old.rules.verifyRoute(old.config,previous,s));return route;});
      steady.push(routes[0].seconds);fastest.push(Math.min(...routes.filter(r=>r.success).map(r=>r.seconds)));
    }
    const median=a=>a.sort((a,b)=>a-b)[50],sample={version,level:n,seeds:100,steadyMedian:median(steady),fastestMedian:median(fastest)};
    assert.ok(sample.steadyMedian>=35);assert.ok(sample.fastestMedian>=28);samples.push(sample);
  }
}
fs.writeFileSync("output/playwright/survival-v152-legacy-budgets-report.json",JSON.stringify({version:config.version,result:"passed",method:"900 old-rule maps and all four route strategies compared exactly to three released tags; formal simulation",samples},null,2)+"\n");
console.log("三套旧规则 900 地图及四策略与发布源码一致，原 35/28 秒预算保留。");
