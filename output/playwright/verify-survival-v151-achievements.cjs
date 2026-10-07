"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {chromium}=require(process.env.GOLD_PLAYWRIGHT_MODULE||"playwright"),{loadBaseline,fixture}=require("../../scripts/check-ui-compat.cjs");
const config=require("../../js/config.js"),growth=require("../../js/growth.js"),storage=require("../../js/storage.js"),base=loadBaseline(),now="2026-10-07T08:00:00Z";
const report={version:config.version,method:"real Chrome controls; historical baseline save fixtures and controlled clock; no claim of natural achievement play",checks:[],errors:[]};
const diag=p=>p.evaluate(()=>GoldMiner.getDiagnostics());
(async()=>{const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});try{
 async function pageFor(doc){const p=await browser.newPage({viewport:{width:1280,height:720}});p.on("pageerror",e=>report.errors.push(e.message));if(doc)await p.addInitScript(({key,doc})=>localStorage.setItem(key,JSON.stringify(doc)),{key:storage.progressKey,doc});await p.clock.install({time:new Date(now)});await p.clock.pauseAt(new Date(Date.parse(now)+1));await p.goto(pathToFileURL(path.resolve("index.html")).href);return p;}
 const p=await pageFor();await p.locator('[data-profile="achievements"]').first().click();assert.equal(await p.locator("[data-achievement]").count(),13);
 for(const d of growth.retiredDefinitions)assert.equal(await p.locator(`[data-achievement="${d.id}"]`).count(),0);
 await p.screenshot({path:path.join(__dirname,"survival-v151-achievements-current.png"),fullPage:true});await p.close();report.checks.push("新档案仅显示 13 项现行成就，12 项下架任务不占目录和进度分母");
 const old=fixture(base,"endless","shop");old.profile.achievements.clear_20={progress:20,unlockedAt:now,unlockedRunId:"old-achievement"};old.profile.equippedTitleId="clear_20";
 const legacy=await pageFor(old);assert.equal((await diag(legacy)).progress.profile.equippedTitleId,"clear_20");assert.match(await legacy.locator("#checkpoint-description").textContent(),/规则 1\.4\.0/);
 await legacy.locator('[data-profile="achievements"]').first().click();assert.equal(await legacy.locator("[data-achievement]").count(),14);assert.match(await legacy.locator('[data-achievement="clear_20"]').textContent(),/老练矿工|历史徽章/);
 const raw=await legacy.evaluate(key=>localStorage.getItem(key),storage.progressKey);await legacy.keyboard.press("Escape");assert.equal(await legacy.evaluate(key=>localStorage.getItem(key),storage.progressKey),raw);
 await legacy.locator("#continue-button").click();assert.deepEqual((await diag(legacy)).shop,old.activeRun.checkpoint.shop);await legacy.locator("#next-level-button").click();assert.equal((await diag(legacy)).run.challenge.rulesVersion,"1.4.0");
 await legacy.screenshot({path:path.join(__dirname,"survival-v151-legacy-game.png"),fullPage:true});await legacy.close();report.checks.push("旧称号、历史徽章和已支付商店保留；继续旧商店及下一关均使用旧规则；浏览不写入");
 const seed=await pageFor(fixture(base,"seed","level"));await seed.locator("#continue-button").click();await seed.clock.runFor(61000);assert.equal((await diag(seed)).run.challenge.rulesVersion,"1.4.0");await seed.locator("#restart-button").click();assert.equal((await diag(seed)).run.challenge.rulesVersion,"1.5.1");assert.equal((await diag(seed)).run.runSeed,42);await seed.close();report.checks.push("旧 Seed 失败后重新挑战使用新规则 1.5.1，同数字 Seed 的最佳键保持分离");
 assert.deepEqual(report.errors,[]);report.result="passed";console.log(report.checks.join("\n"));
}finally{await browser.close();fs.writeFileSync(path.join(__dirname,"survival-v151-achievements-ui-report.json"),JSON.stringify(report,null,2)+"\n");}})().catch(e=>{console.error(e);process.exitCode=1;});
