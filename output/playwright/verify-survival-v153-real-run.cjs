"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const config = require("../../js/config.js"), rules = require("../../js/rules.js");
const report = { version: "1.5.3", method: "original randomly generated endless maps, original real clock, real mouse and Space input; diagnostics only read; no map, clock, money, carrying or outcome overrides", levels: [], shops: [], errors: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", e => report.errors.push(e.message)); page.on("console", m => { if(m.type()==="error") report.errors.push(m.text()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await page.locator("#start-button").click(); report.runSeed = (await diag(page)).run.runSeed;
    let mouseUsed = false;
    const addedTypes = new Set(), requiredTypes = ["smallGold", "diamond", "ruby", "mysteryBag"];
    for (let levelId=1;levelId<=4;levelId++) {
      const started=performance.now(), banks=new Set(), trace=[]; let qualifiedAt=null;
      while (performance.now()-started<90000) {
        const state=await diag(page), run=state.run; assert.equal(run.levelId,levelId);
        for (const m of run.minerals) if(m.status==="banked"&&!banks.has(m.id)) { banks.add(m.id); if(/-dense\d+$/.test(m.id)) addedTypes.add(m.type); trace.push({id:m.id,type:m.type,income:run.levelIncome,realSeconds:(performance.now()-started)/1000}); }
        if(run.levelIncome>=run.level.target&&qualifiedAt===null) { qualifiedAt=(performance.now()-started)/1000; console.log(`第 ${levelId} 关：真实 ${qualifiedAt.toFixed(2)} 秒达标。`); }
        if(state.screen==="result") {
          assert.equal(run.result.success,true); assert.equal(run.growth.dynamiteUsed,0); assert.ok(Object.values(run.effects).every(v=>v===false));
          const settledAt=(performance.now()-started)/1000; assert.ok(Math.abs(settledAt-run.elapsedTime)<1.5); assert.ok(qualifiedAt<45);
          report.levels.push({levelId,target:run.level.target,count:run.level.layout.length,income:run.levelIncome,qualifiedAt,settledAt,elapsedTime:run.elapsedTime,trace,newAchievementIds:state.progress.activeRun.newAchievementIds});
          await page.screenshot({path:path.join(__dirname,`survival-v153-real-level${levelId}.png`),fullPage:true}); break;
        }
        assert.equal(state.screen,"playing");
        if((run.levelIncome<Math.max(1500,run.level.target)||addedTypes.size<requiredTypes.length)&&run.remainingTime>8&&run.hook.phase==="swinging") {
          const candidates=run.minerals.filter(m=>m.status==="available"&&m.type!=="powderKeg"&&m.type!=="cursedRelic")
            .filter(m=>rules.firstHit(config.miner.anchor,m,run.minerals,config)?.mineral.id===m.id)
            .sort((a,b)=>Number(/-dense\d+$/.test(b.id)&&!addedTypes.has(b.type))-Number(/-dense\d+$/.test(a.id)&&!addedTypes.has(a.type)));
          const m=candidates.find(m=>(/-dense\d+$/.test(m.id)&&!addedTypes.has(m.type)||run.levelIncome<1500&&m.type!=="stone")&&Math.abs(Math.atan2(m.x-480,m.y-112)*180/Math.PI-run.hook.angle)<=.9);
          if(m) { if(!mouseUsed) { const b=await page.locator("#game-canvas").boundingBox(); await page.mouse.click(b.x+b.width*.55,b.y+b.height*.65);mouseUsed=true; } else await page.keyboard.press("Space"); }
        }
        await pause(run.hook.phase==="swinging"&&(run.levelIncome<1500||addedTypes.size<requiredTypes.length)?8:100);
      }
      assert.equal(report.levels.length,levelId);
      await page.locator("#restart-button").click(); const shop=await diag(page); assert.equal(shop.screen,"shop"); assert.equal(shop.shop.purchaseCount,0);
      report.shops.push({afterLevel:levelId,offers:shop.shop.offers}); await page.locator("#next-level-button").click();
    }
    const failureStarted=performance.now(); await page.locator("#result-screen").waitFor({state:"visible",timeout:65000});
    const failed=await diag(page), total=report.levels.reduce((sum,l)=>sum+l.income,0), career=failed.progress.profile.career;
    assert.equal(failed.run.result.success,false); assert.equal(failed.run.levelId,5); assert.equal(failed.run.levelIncome,0);
    assert.equal(career.levelsCleared,4); assert.equal(career.qualifiedIncome,total); assert.equal(failed.highScore,total); assert.equal(failed.bestClearedLevel,4);
    assert.equal(failed.progress.activeRun,null); assert.equal(career.activePlayMs,report.levels.reduce((sum,l)=>sum+Math.round(l.elapsedTime*1000),60000));
    assert.deepEqual([...addedTypes].sort(),requiredTypes.sort()); report.addedTypesRecovered=[...addedTypes];
    for(const id of ["first_recovery","first_clear","level_income_1200","no_assistance_clear"]) assert.ok(failed.progress.profile.achievements[id].unlockedAt,id);
    report.unlocked=Object.entries(failed.progress.profile.achievements).filter(([,a])=>a.unlockedAt).map(([id])=>id);
    report.growth={career,report:failed.progress.profile.recentReports[0]}; report.failure={levelId:5,realSeconds:(performance.now()-failureStarted)/1000}; report.mouseUsed=mouseUsed;
    await page.screenshot({path:path.join(__dirname,"survival-v153-real-report.png"),fullPage:true});
    await page.locator("#result-home-button").click(); await page.reload(); assert.equal((await diag(page)).highScore,total);
    assert.deepEqual(report.errors,[]); report.result="passed"; console.log(`原始计时四关、四次商店、自然失败与刷新通过；自然获得 ${report.unlocked.length} 个成就。`);
  } finally { await browser.close(); await fs.writeFile(path.join(__dirname,"survival-v153-real-run-report.json"),JSON.stringify(report,null,2)+"\n"); }
})().catch(e=>{console.error(e);process.exitCode=1;});
