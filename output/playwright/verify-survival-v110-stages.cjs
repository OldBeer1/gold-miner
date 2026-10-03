"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { version: "1.1.0", method: "original generated levels and UI, controlled entry checkpoints at 19/29; controlled clock, real keyboard input; not continuous play to level 30", boundaries: [], viewports: [], checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
async function qualify(page) {
  for (let tries = 0; tries < 600; tries++) {
    const { run } = await diag(page); if (run.levelIncome >= run.level.target) return run;
    assert.ok(!run.settled, "controlled route must qualify before deadline");
    if (run.hook.phase !== "swinging") { await page.clock.runFor(150); continue; }
    const choices = run.minerals.filter(m => m.safeRoute && m.status === "available").map(m => {
      const angle = Math.atan2(m.x-480,m.y-112)*180/Math.PI, direction = run.hook.swingDirection;
      const direct = (angle-run.hook.angle)*direction;
      return { angle, wait: (direct >= 0 ? direct : direction > 0 ? 150-run.hook.angle-angle : 150+run.hook.angle+angle)/65 };
    }).sort((a,b)=>a.wait-b.wait);
    assert.ok(choices.length); await page.clock.runFor(Math.max(1, Math.round(choices[0].wait*1000)));
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space");
    await page.clock.runFor(50);
  }
  throw Error("route input budget exceeded");
}
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", e => report.errors.push(e.message)); await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1));
    const url = pathToFileURL(path.resolve("index.html")).href; await page.goto(url);
    for (const n of [19,29]) {
      await page.evaluate(n => {
        const run = GoldMinerRules.createRun(GoldMinerConfig,n,{runSeed:42,wallet:12000,totalIncome:20000,bombs:1});
        GoldMinerStorage.saveCheckpoint(localStorage,GoldMinerRules.captureCheckpoint(run,"level",GoldMinerConfig),GoldMinerConfig);
      },n); await page.reload(); await page.locator("#continue-button").click();
      const qualified = await qualify(page); await page.clock.fastForward(60100);
      assert.equal((await diag(page)).run.result.success,true); await page.locator("#restart-button").click();
      const before = await diag(page), destination = await page.locator("#shop-destination").textContent();
      assert.ok(destination.includes(`第 ${n+1} 关`));
      const prices = before.shop.prices;
      for (const item of before.shop.offers) {
        assert.match(await page.locator(`#buy-${item}`).locator("..").locator("span").textContent(),new RegExp(`¥${prices[item]}`));
      }
      await page.locator("#buy-dynamite").click(); await page.locator("#buy-dynamite").click();
      const bought = await diag(page); assert.equal(bought.run.wallet,before.run.wallet-2*prices.dynamite);
      await page.reload(); await page.locator("#continue-button").click(); assert.deepEqual((await diag(page)).shop,bought.shop);
      await page.locator("#buy-dynamite").click(); await page.locator("#buy-dynamite").click();
      const limit = await diag(page); assert.equal(limit.shop.purchaseCount,4); assert.equal(limit.run.bombs,5);
      for (const item of limit.shop.offers) assert.ok(await page.locator(`#buy-${item}`).isDisabled());
      const wallet = limit.run.wallet; await page.locator("#buy-dynamite").dispatchEvent("click"); assert.equal((await diag(page)).run.wallet,wallet);
      await page.screenshot({path:path.join(__dirname,`survival-v110-shop-to-${n+1}.png`),fullPage:true});
      for (const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]) {
        await page.setViewportSize(viewport);
        const bounds = await page.evaluate(()=>{
          const scene=document.querySelector(".scene-shell").getBoundingClientRect(), panel=document.querySelector(".shop-panel").getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth>innerWidth,top:panel.top-scene.top,bottom:scene.bottom-panel.bottom};
        });
        assert.ok(!bounds.overflow && bounds.top>=-.1 && bounds.bottom>=-.1); assert.equal(await page.locator("#next-level-button").isVisible(),true);
        report.viewports.push({next:n+1,...viewport,result:"passed"});
      }
      await page.setViewportSize({width:1280,height:720}); await page.locator("#next-level-button").click();
      const next = await diag(page); assert.equal(next.run.levelId,n+1); assert.equal(next.run.level.stage,Math.floor((n+1)/10)-1);
      assert.ok(next.run.level.target>qualified.level.target); assert.ok(next.run.level.depth>qualified.level.depth);
      const nextEntry = next.checkpoint; await page.reload(); await page.locator("#continue-button").click(); assert.deepEqual((await diag(page)).checkpoint,nextEntry);
      report.boundaries.push({from:n,to:n+1,qualifiedSeconds:qualified.elapsedTime,target:next.run.level.target,stage:next.run.level.stage,prices,purchases:4,wallet});
    }
    report.checks.push("19→20 与29→30 原始布局达标、升档与存档延续", "固定动态报价、两件恢复、四件/库存上限与拒绝扣款", "商店三种屏幕布局与操作按钮完整");
    report.clearing = [];
    for (const mode of ["normal","strength","dynamite"]) {
      await page.evaluate(mode=>{
        const run=GoldMinerRules.createRun(GoldMinerConfig,20,{runSeed:42,wallet:5000,totalIncome:10000,bombs:1,effects:{strength:mode==="strength"}});
        GoldMinerStorage.saveCheckpoint(localStorage,GoldMinerRules.captureCheckpoint(run,"level",GoldMinerConfig),GoldMinerConfig);
      },mode); await page.reload(); await page.locator("#continue-button").click();
      const run=(await diag(page)).run, stone=run.minerals.find(m=>m.routeObstacle);
      const angle=Math.atan2(stone.x-480,stone.y-112)*180/Math.PI;
      await page.clock.runFor(Math.round((angle>=0?angle:150-angle)/65*1000));
      await page.locator("#game-canvas").focus(); await page.keyboard.press("Space");
      const launched=(await diag(page)).run.elapsedTime; await page.clock.runFor(400);
      assert.equal((await diag(page)).run.hook.carryingId,stone.id);
      if(mode==="dynamite") await page.keyboard.press("s");
      for(let i=0;i<60 && (await diag(page)).run.hook.phase!=="swinging";i++) await page.clock.runFor(100);
      const cleared=(await diag(page)).run;
      assert.equal(cleared.hook.phase,"swinging");
      assert.equal(cleared.minerals.find(m=>m.id===stone.id).status,mode==="dynamite"?"destroyed":"banked");
      assert.equal(cleared.bombs,mode==="dynamite"?0:1);
      report.clearing.push({mode,seconds:cleared.elapsedTime-launched,income:cleared.levelIncome,bombs:cleared.bombs});
    }
    assert.ok(report.clearing[1].seconds<report.clearing[0].seconds);
    assert.ok(report.clearing[2].seconds<report.clearing[1].seconds);
    report.checks.push("同一生成地图实际出钩清障：普通/力量/炸药时间和收入成本不同");
    assert.deepEqual(report.errors,[]); report.result="passed"; console.log("阶段边界、动态商店恢复与三种布局检查通过。");
  } finally { await browser.close(); await fs.writeFile(path.join(__dirname,"survival-v110-stages-report.json"),JSON.stringify(report,null,2)+"\n"); }
})().catch(e=>{console.error(e);process.exitCode=1;});
