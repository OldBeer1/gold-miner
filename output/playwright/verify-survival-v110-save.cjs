"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { version: "1.1.0", method: "real browser UI and rules, controlled clock and explicit one-gold level fixture for settlement boundaries", checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
function fixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", { get() { return rules; }, set(original) {
    rules = Object.freeze({ ...original, createRun(config, n = 1, entry = {}) {
      if (!window.__fixture || entry.level) return original.createRun(config, n, entry);
      return original.createRun(config, n, { ...entry, level: { id: n, target: 300, duration: 60,
        layout: [{ id: "gold", type: "largeGold", x: 480, y: 260 }] } });
    } });
  } });
}
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", e => report.errors.push(e.message));
    await page.addInitScript(fixture); await page.clock.install();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1));
    const url = pathToFileURL(path.resolve("index.html")).href;
    await page.goto(url); await page.evaluate(() => { localStorage.clear(); window.__fixture = true; }); await page.reload();
    await page.evaluate(() => { window.__fixture = true; });
    await page.locator("#start-button").click(); const entry = await diag(page);
    assert.equal(entry.checkpoint.kind, "level"); assert.equal(entry.saveError, false);
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space"); await page.clock.runFor(2100);
    assert.equal((await diag(page)).run.wallet, 300);
    await page.reload(); await page.locator("#continue-button").click(); const restored = await diag(page);
    assert.equal(restored.run.wallet, 0); assert.equal(restored.run.remainingTime, 60);
    assert.equal(restored.run.runSeed, entry.run.runSeed); assert.deepEqual(restored.run.level, entry.run.level);
    report.checks.push("关内赚取后刷新回本关起点，种子/布局相同，钱包回滚");
    await page.locator("#home-button").click(); const saved = await diag(page);
    page.once("dialog", dialog => dialog.dismiss()); await page.locator("#start-button").click();
    assert.deepEqual((await diag(page)).checkpoint, saved.checkpoint); assert.equal((await diag(page)).screen, "home");
    await page.locator("#continue-button").click();
    report.checks.push("返回主页保留存档，新挑战取消覆盖后继续原挑战");
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space"); await page.clock.runFor(60100);
    const won = await diag(page); assert.equal(won.screen, "result"); assert.ok(won.run.result.success); assert.equal(won.checkpoint.kind, "shop");
    await page.reload(); await page.locator("#continue-button").click(); const shop = await diag(page);
    assert.equal(shop.screen, "shop"); assert.equal(shop.run.totalIncome, 300);
    await page.locator("#buy-dynamite").click(); const bought = await diag(page);
    assert.equal(bought.shop.purchaseCount, 1); assert.equal(bought.run.bombs, 2);
    await page.reload(); await page.locator("#continue-button").click(); const sameShop = await diag(page);
    assert.deepEqual(sameShop.shop, bought.shop); assert.equal(sameShop.run.wallet, bought.run.wallet); assert.equal(sameShop.run.totalIncome, 300);
    report.checks.push("成功结算退出直达固定商店，购物恢复同报价、金额、库存和限购且不重复收入");
    await page.locator("#next-level-button").click(); assert.equal((await diag(page)).run.levelId, 2);
    const level2 = await diag(page); await page.reload(); await page.locator("#continue-button").click();
    assert.equal((await diag(page)).run.wallet, level2.run.wallet); assert.equal((await diag(page)).run.levelId, 2);
    await page.clock.runFor(80100); const failed = await diag(page);
    assert.equal(failed.run.result.success, false); assert.equal(failed.checkpoint, null);
    assert.equal(await page.evaluate(() => localStorage.getItem(GoldMinerStorage.checkpointKey)), null);
    await page.reload(); assert.equal(await page.locator("#continue-button").isVisible(), false);
    assert.equal((await diag(page)).highScore, 300); await page.locator("#start-button").click();
    const restarted = await diag(page); assert.equal(restarted.run.levelId, 1); assert.equal(restarted.run.wallet, 0); assert.equal(restarted.run.bombs, 1);
    report.checks.push("入下一关保存、实际失败清档、记录保留、重新挑战资源重置");
    await page.locator("#home-button").click(); const previous = (await diag(page)).run.runSeed;
    page.once("dialog", d => d.accept()); await page.locator("#start-button").click();
    assert.notEqual((await diag(page)).run.runSeed, previous);
    report.checks.push("确认新挑战替换存档并生成新种子");
    await page.evaluate(() => localStorage.setItem(GoldMinerStorage.checkpointKey, "{broken")); await page.reload();
    assert.equal(await page.locator("#continue-button").isVisible(), false); assert.match(await page.locator("#save-status").textContent(), /损坏/);
    page.once("dialog", d => d.accept()); await page.locator("#start-button").click(); assert.equal((await diag(page)).screen, "playing");
    report.checks.push("损坏存档提示且可确认覆盖后游玩");
    const goodCheckpoint = (await diag(page)).checkpoint;
    await page.evaluate(value => { value.rulesVersion = "unknown"; localStorage.setItem(GoldMinerStorage.checkpointKey,JSON.stringify(value)); },goodCheckpoint);
    await page.reload(); assert.equal(await page.locator("#continue-button").isVisible(),false);
    assert.match(await page.locator("#save-status").textContent(),/版本/);
    report.checks.push("未知玩法版本拒绝恢复并显示版本提示");
    for (const mode of ["read","write","delete","legacy"]) {
      const second = await browser.newPage(); second.on("dialog",d=>d.accept()); second.on("pageerror",e=>report.errors.push(e.message));
      await second.addInitScript(fixture); await second.clock.install(); await second.clock.pauseAt(new Date(await second.evaluate(()=>Date.now())+1));
      await second.addInitScript(mode=>{
        window.__fixture=true;
        if(mode==="read") Storage.prototype.getItem=()=>{throw Error("blocked read");};
        if(mode==="write") Storage.prototype.setItem=()=>{throw Error("quota");};
        if(mode==="delete") Storage.prototype.removeItem=()=>{throw Error("blocked delete");};
        if(mode==="legacy") {
          localStorage.setItem("gold-miner.survival.preferences.v1",JSON.stringify({soundEnabled:false,highScore:9000,bestClearedLevel:80}));
          localStorage.setItem("gold-miner.preferences.v1",JSON.stringify({soundEnabled:true,highScore:100}));
        }
      },mode);
      await second.goto(url); const initial=await diag(second);
      assert.equal(initial.highScore,0); assert.equal(initial.bestClearedLevel,0);
      if(mode==="read") assert.match(await second.locator("#save-status").textContent(),/无法读取/);
      if(mode==="legacy") {
        assert.equal(initial.soundEnabled,false); await second.locator("#sound-button").click();
        const stored=await second.evaluate(()=>({old:JSON.parse(localStorage.getItem(GoldMinerStorage.previousKey)),current:JSON.parse(localStorage.getItem(GoldMinerStorage.key))}));
        assert.equal(stored.old.highScore,9000); assert.equal(stored.current.highScore,0); assert.equal(stored.current.soundEnabled,true);
      }
      await second.locator("#start-button").click(); assert.equal((await diag(second)).screen,"playing");
      if(mode==="write") { assert.equal((await diag(second)).saveError,true); assert.match(await second.locator("#save-status").textContent(),/保存失败/); }
      if(mode==="delete") {
        await second.clock.fastForward(60100); const failed=await diag(second);
        assert.equal(failed.run.result.success,false); assert.equal(failed.checkpoint,null); assert.equal(failed.saveError,true);
        assert.match(await second.locator("#save-status").textContent(),/清除失败/);
      }
      await second.close(); report.checks.push(`${mode} 存储场景反馈正确且仍可游玩`);
    }
    assert.deepEqual(report.errors, []); report.result = "passed";
    await page.screenshot({ path: path.join(__dirname, "survival-v110-save.png"), fullPage: true });
    console.log(`存档浏览器检查通过：${report.checks.length} 项。`);
  } finally { await browser.close(); await fs.writeFile(path.join(__dirname, "survival-v110-save-report.json"), JSON.stringify(report, null, 2) + "\n"); }
})().catch(e => { console.error(e); process.exitCode = 1; });
