"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const config = require("../../js/config.js"), rules = require("../../js/rules.js"), growth = require("../../js/growth.js"), storage = require("../../js/storage.js");
const { loadBaseline, fixture, collect } = require("../../scripts/check-ui-compat.cjs");
const report = { version:config.version,method:"real Chrome render/input with isolated formally generated entry fixtures and controlled browser clock; not real-time gameplay",scenes:[],comparison:[],checks:[],errors:[] };
const url = pathToFileURL(path.resolve(__dirname,"../../index.html")).href, now="2026-10-07T08:00:00.000Z";
function entry(event, fallback=false, engine={config,rules,growth,storage}) {
  const {config,rules,growth,storage}=engine;
  const doc = growth.createDocument({soundEnabled:true,highScore:0,bestClearedLevel:0},now);
  let run = rules.createRun(config,1,{runSeed:42});
  let checkpoint=rules.captureCheckpoint(run,"level",config); growth.createActive(doc,checkpoint,"layout-"+event+"-"+fallback,now,false);growth.enterLevel(doc,checkpoint,now);
  const last = event === "none" ? 4 : 10;
  for(let n=1;n<last;n++) {
    collect(run,rules,config);growth.settleLevel(doc,run,rules.captureCheckpoint(run,"shop",config),now);
    const effective = fallback ? {...config,survival:{...config.survival,maxAttempts:0}} : config;
    const level = n+1 === last ? rules.createLevel(effective,last,42,event) : run.shop.nextLevel;
    run=rules.createRun(config,n+1,{runSeed:42,level,wallet:run.wallet,bombs:run.bombs,totalIncome:run.totalIncome,effects:run.shop.effects});
    checkpoint=rules.captureCheckpoint(run,"level",config);growth.enterLevel(doc,checkpoint,now);
  }
  assert.ok(storage.validateProgress(doc,config));return doc;
}
async function pageFor(browser,size,doc,target=url) {
  const page=await browser.newPage({viewport:size});
  page.on("pageerror",e=>report.errors.push(e.message));
  await page.addInitScript(({key,doc})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(doc));},{key:storage.progressKey,doc});
  await page.clock.install({time:new Date(now)});await page.clock.pauseAt(new Date(Date.parse(now)+1));
  await page.goto(target);return page;
}
(async()=>{
  const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
  try {
    const scenarios=Object.keys(config.events.definitions).map(event=>({event,doc:entry(event)}));scenarios.push({event:"fallback",doc:entry("none",true)});
    for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]) for(const scenario of scenarios) {
      const page=await pageFor(browser,size,scenario.doc);await page.locator("#continue-button").click();
      const state=await page.evaluate(()=>GoldMiner.getDiagnostics());
      assert.equal(state.run.challenge.rulesVersion,"1.5.3");assert.deepEqual(state.run.level.layout,scenario.doc.activeRun.checkpoint.run.level.layout);
      const measures=await page.evaluate(()=>{
        const canvas=document.querySelector("#game-canvas").getBoundingClientRect(), banner=document.querySelector("#event-label")?.getBoundingClientRect();
        return {horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},banner:banner?{bottom:banner.bottom}:null};
      });
      assert.equal(measures.horizontalOverflow,false);if(measures.banner)assert.ok(measures.banner.bottom<=measures.canvas.y+1);
      const screenshot=`survival-v154-layout-${scenario.event}-${size.width}x${size.height}.png`;
      await page.screenshot({path:path.join(__dirname,screenshot),fullPage:true});
      report.scenes.push({viewport:size,event:state.run.level.event.id,fallback:state.run.level.fallback,screenshot,measures});await page.close();
    }
    report.checks.push("21 scenes: three desktop viewports, normal/five events/forced fallback, real Canvas and no horizontal overflow");
    const oldPackage=JSON.parse(await fs.readFile(path.join(__dirname,"survival-v152-package-report.json"),"utf8"));
    const oldURL=pathToFileURL(path.join(oldPackage.extractedDirectory,"index.html")).href,base=loadBaseline("v1.5.2"),oldDoc=entry("none",false,base);
    for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]) {
      const page=await pageFor(browser,size,oldDoc,oldURL);await page.locator("#continue-button").click();const state=await page.evaluate(()=>GoldMiner.getDiagnostics());
      assert.equal(state.run.challenge.rulesVersion,"1.5.2");assert.equal(state.run.level.layout.length,26);
      const screenshot=`survival-v154-before-v152-${size.width}x${size.height}.png`;await page.screenshot({path:path.join(__dirname,screenshot),fullPage:true});
      report.comparison.push({viewport:size,previousCount:26,currentCount:26,screenshot,previousRuntime:"independently extracted released v1.5.2 player package"});await page.close();
    }
    for(const version of ["1.4.0","1.5.0","1.5.1","1.5.2"]) {
      const base=loadBaseline("v"+version),old=fixture(base,"seed","shop"),page=await pageFor(browser,{width:1280,height:720},old);
      await page.locator("#continue-button").click();const state=await page.evaluate(()=>GoldMiner.getDiagnostics());
      assert.deepEqual(state.shop,old.activeRun.checkpoint.shop);await page.locator("#next-level-button").click();
      const continued=await page.evaluate(()=>GoldMiner.getDiagnostics());assert.equal(continued.run.challenge.rulesVersion,version);assert.deepEqual(continued.run.level,old.activeRun.checkpoint.shop.nextLevel);
      await page.clock.runFor(61000);await page.locator("#restart-button").click();
      const restarted=await page.evaluate(()=>GoldMiner.getDiagnostics());assert.equal(restarted.run.challenge.rulesVersion,"1.5.3");assert.equal(restarted.run.runSeed,42);
      await page.close();
    }
    report.checks.push("All four legacy versions keep paid shop/map/next generation; restarting the same Seed creates a new 1.5.3 challenge");
    assert.deepEqual(report.errors,[]);report.result="passed";console.log("分散布局浏览器检查通过：21 场景、三张旧版对比与三套旧商店/同 Seed 重开。");
  }finally{await browser.close();await fs.writeFile(path.join(__dirname,"survival-v154-layouts-ui-report.json"),JSON.stringify(report,null,2)+"\n");}
})().catch(e=>{console.error(e);process.exitCode=1;});
