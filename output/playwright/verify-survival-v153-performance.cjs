"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {chromium}=require(process.env.GOLD_PLAYWRIGHT_MODULE||"playwright"),{loadBaseline}=require("../../scripts/check-ui-compat.cjs");
const current={config:require("../../js/config.js"),rules:require("../../js/rules.js"),growth:require("../../js/growth.js"),storage:require("../../js/storage.js")};
const report={version:current.config.version,method:"real headless Chrome requestAnimationFrame intervals over four seconds per scene; isolated formal entry fixtures, no clock overrides; local comparison, not a general hardware/FPS guarantee",scenes:[],errors:[]};
const percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
(async()=>{
  const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
  try{
    const pkg=JSON.parse(await fs.readFile(path.join(__dirname,"survival-v152-package-report.json"),"utf8")),old=loadBaseline("v1.5.2"),now="2026-10-07T08:00:00Z";
    for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}])for(const levelId of [1,1000]){
      const comparison={viewport:size,levelId};
      for(const [label,engine,target] of [["previous",old,path.join(pkg.extractedDirectory,"index.html")],["current",current,path.resolve("index.html")]]){
        const {config,rules,growth,storage}=engine,doc=growth.createDocument({soundEnabled:false,highScore:0,bestClearedLevel:0},now),run=rules.createRun(config,levelId,{runSeed:42}),checkpoint=rules.captureCheckpoint(run,"level",config);
        growth.createActive(doc,checkpoint,"perf-"+levelId,now,false);growth.enterLevel(doc,checkpoint,now);assert.ok(storage.validateProgress(doc,config));
        const page=await browser.newPage({viewport:size});page.on("pageerror",e=>report.errors.push(e.message));
        await page.addInitScript(({key,doc})=>localStorage.setItem(key,JSON.stringify(doc)),{key:storage.progressKey,doc});await page.goto(pathToFileURL(target).href);await page.locator("#continue-button").click();
        await page.evaluate(()=>{window.__intervals=[];window.__longTasks=[];let last=null;window.__frameActive=true;const frame=t=>{if(!__frameActive)return;if(last!==null)__intervals.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);window.__longObserver=new PerformanceObserver(list=>__longTasks.push(...list.getEntries().map(e=>e.duration)));__longObserver.observe({type:"longtask",buffered:false});});
        await page.waitForTimeout(4000);const measured=await page.evaluate(()=>{__frameActive=false;__longObserver.disconnect();return {intervals:__intervals,longTasks:__longTasks,state:GoldMiner.getDiagnostics()};});
        assert.ok(measured.intervals.length>=120);assert.equal(measured.state.screen,"playing");
        comparison[label]={count:measured.state.run.level.layout.length,frames:measured.intervals.length,medianMs:percentile(measured.intervals,.5),p95Ms:percentile(measured.intervals,.95),p99Ms:percentile(measured.intervals,.99),maximumMs:Math.max(...measured.intervals),over50ms:measured.intervals.filter(t=>t>50).length,longTasks:measured.longTasks};await page.close();
      }
      assert.equal(comparison.current.count-comparison.previous.count,0);assert.ok(comparison.current.p95Ms<=Math.max(comparison.previous.p95Ms*1.5,comparison.previous.p95Ms+8));report.scenes.push(comparison);
    }
    assert.deepEqual(report.errors,[]);report.result="passed";console.log("三视口首关/高关的真实帧间隔对比通过：12 次四秒测量。");
  }finally{await browser.close();await fs.writeFile(path.join(__dirname,"survival-v153-performance-ui-report.json"),JSON.stringify(report,null,2)+"\n");}
})().catch(e=>{console.error(e);process.exitCode=1;});
