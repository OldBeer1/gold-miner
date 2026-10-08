"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {chromium}=require(process.env.GOLD_PLAYWRIGHT_MODULE||"playwright");
const config=require("../../js/config.js"),rules=require("../../js/rules.js"),growth=require("../../js/growth.js"),storage=require("../../js/storage.js"),challenges=require("../../js/challenges.js");
const now="2026-10-08T00:00:00Z",report={version:config.version,method:"real Chrome mouse/keyboard on isolated controlled layouts and controlled browser clock; original live gameplay is a separate report",scenes:[],errors:[]};
function entry(version,layout){
 const cfg=rules.configForVersion(config,version),challenge=challenges.create("endless",42,null,version),run=rules.createRun(cfg,1,{challenge,runSeed:42,level:{id:1,duration:60,target:650,layout}});
 const doc=growth.createDocument({soundEnabled:false,highScore:0,bestClearedLevel:0},now),cp=rules.captureCheckpoint(run,"level",cfg);
 growth.createActive(doc,cp,"hook-"+version,now,false);growth.enterLevel(doc,cp,now);assert.ok(storage.validateProgress(doc,config));return doc;
}
(async()=>{
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
 try{
  const scenarios=[
   {name:"previous-miss",version:"1.5.2",layout:[{id:"target",type:"smallGold",x:507,y:300}],income:0,status:"available"},
   {name:"current-graze",version:"1.5.3",layout:[{id:"target",type:"smallGold",x:507,y:300}],income:100,status:"banked"},
   {name:"outside-miss",version:"1.5.3",layout:[{id:"target",type:"smallGold",x:508.1,y:300}],income:0,status:"available"},
   {name:"gem-graze",version:"1.5.3",layout:[{id:"target",type:"diamond",x:502,y:300}],income:250,status:"banked"},
   {name:"bag-graze",version:"1.5.3",layout:[{id:"target",type:"mysteryBag",x:505,y:300,rewardRoll:0}],income:50,status:"banked"},
   {name:"stone-blocks",version:"1.5.3",layout:[{id:"target",type:"stone",x:510,y:260},{id:"behind",type:"diamond",x:480,y:460}],income:20,status:"banked"},
   {name:"keg-graze",version:"1.5.3",layout:[{id:"target",type:"powderKeg",x:500,y:250},{id:"behind",type:"diamond",x:480,y:460}],income:0,status:"destroyed"}
  ];
  for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}])for(const [index,scenario] of scenarios.entries()){
   const page=await browser.newPage({viewport});page.on("pageerror",e=>report.errors.push(e.message));
   const doc=entry(scenario.version,scenario.layout);await page.addInitScript(({key,doc})=>localStorage.setItem(key,JSON.stringify(doc)),{key:storage.progressKey,doc});
   await page.clock.install({time:new Date(now)});await page.clock.pauseAt(new Date(Date.parse(now)+1));await page.goto(pathToFileURL(path.resolve("index.html")).href);await page.locator("#continue-button").click();
   assert.equal((await page.evaluate(()=>GoldMiner.getDiagnostics())).run.hook.angle,0);
   if(index%2){await page.locator("#game-canvas").scrollIntoViewIfNeeded();const b=await page.locator("#game-canvas").boundingBox();await page.mouse.click(b.x+b.width*.55,b.y+b.height*.6);}else await page.keyboard.press("Space");
   await page.clock.runFor(300);const screenshot=`survival-v154-hook-${scenario.name}-${viewport.width}x${viewport.height}.png`;
   await page.screenshot({path:path.join(__dirname,screenshot),fullPage:true});await page.clock.runFor(3000);
   const state=await page.evaluate(()=>GoldMiner.getDiagnostics());assert.equal(state.run.levelIncome,scenario.income);assert.equal(state.run.minerals[0].status,scenario.status);
   if(scenario.layout.length>1)assert.equal(state.run.minerals[1].status,"available");assert.equal(state.run.challenge.rulesVersion,scenario.version);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   report.scenes.push({viewport,scenario:scenario.name,rulesVersion:scenario.version,income:state.run.levelIncome,status:state.run.minerals[0].status,screenshot});await page.close();
  }
  assert.deepEqual(report.errors,[]);report.result="passed";console.log("抓取范围三视口 21 受控浏览器场景通过：新旧擦边、边界外、宝石/钱袋、石头阻挡及桶风险。");
 }finally{await browser.close();await fs.writeFile(path.join(__dirname,"survival-v154-hook-ui-report.json"),JSON.stringify(report,null,2)+"\n");}
})().catch(e=>{console.error(e);process.exitCode=1;});
