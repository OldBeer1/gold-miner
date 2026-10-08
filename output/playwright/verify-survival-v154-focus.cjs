"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {chromium}=require(process.env.GOLD_PLAYWRIGHT_MODULE||"playwright"),{loadBaseline,fixture}=require("../../scripts/check-ui-compat.cjs");
const config=require("../../js/config.js"),report={version:config.version,method:"isolated real Chrome keyboard Enter/Tab on valid unlocked-title fixture; controlled data, no gameplay claim",scenes:[],errors:[]};
(async()=>{const base=loadBaseline("v1.5.3"),pkg=JSON.parse(await fs.readFile(path.join(__dirname,"survival-v153-package-report.json"),"utf8"));
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
try{for(const [label,target] of [["previous",path.join(pkg.extractedDirectory,"index.html")],["current",path.resolve("index.html")]]){
 const doc=fixture(base,"endless"),now="2026-10-08T08:00:00Z";doc.profile.achievements.clear_10={progress:10,unlockedAt:now,unlockedRunId:"focus-fixture"};assert.ok(base.storage.validateProgress(doc,base.config));
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on("pageerror",e=>report.errors.push(e.message));await page.addInitScript(({key,doc})=>localStorage.setItem(key,JSON.stringify(doc)),{key:base.storage.progressKey,doc});await page.goto(pathToFileURL(target).href);
 await page.locator('[data-profile="achievements"]').first().click();const equip=page.locator('[data-achievement="clear_10"] button');await equip.focus();await page.keyboard.press("Enter");
 const afterEquip=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,top:document.activeElement.getBoundingClientRect().top,screen:GoldMiner.getDiagnostics().screen,title:GoldMiner.getDiagnostics().progress.profile.equippedTitleId}));assert.equal(afterEquip.title,"clear_10");
 let afterClear=null;if(label==="current"&&afterEquip.id==="unequip-title-button"){await page.keyboard.press("Enter");afterClear=await page.evaluate(()=>({id:document.activeElement.id,title:GoldMiner.getDiagnostics().progress.profile.equippedTitleId}));assert.ok(afterEquip.top>=0&&afterEquip.top<720);assert.equal(afterClear.title,null);assert.equal(afterClear.id,"unequip-title-button");await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement.id),"achievement-status");}
 report.scenes.push({label,afterEquip,afterClear});await page.close();}
 assert.equal(report.scenes[0].afterEquip.tag,"BODY");
 if(process.argv.includes("--accept"))assert.equal(report.scenes[1].afterEquip.id,"unequip-title-button");
 assert.deepEqual(report.errors,[]);report.result="passed";console.log(JSON.stringify(report.scenes));
}finally{await browser.close();await fs.writeFile(path.join(__dirname,`survival-v154-focus-${process.argv.includes("--accept")?"ui":"baseline"}-report.json`),JSON.stringify(report,null,2)+"\n");}})().catch(e=>{console.error(e);process.exitCode=1;});
