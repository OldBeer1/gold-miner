"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "12", method: "real browser UI and original collision/reward rules, controlled single-object fixtures, browser clock and explicit settlement fixtures for transaction boundaries", checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
function fixtureInstaller() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", {
    get() { return rules; },
    set(original) {
      rules = Object.freeze({ ...original,
        createRun(config, n = 1, entry = {}) {
          const fixture = window.__fixture;
          if (!fixture) return original.createRun(config, n, entry);
          const level = { id: n, target: 650 + 150 * Math.min(n - 1, 9), duration: 60, layout: fixture.layout || [{ id: "fixture", type: fixture.type || "smallGold", x: 480, y: 360, rewardRoll: fixture.roll ?? 0 }] };
          return original.createRun(config, n, { ...entry, level, runSeed: fixture.seed ?? 0,
            effects: fixture.effects ?? entry.effects, bombs: fixture.bombs ?? entry.bombs });
        },
        advanceRun(run, elapsed, config) {
          if (window.__finish !== undefined) {
            run.wallet += window.__finish - run.levelIncome; run.levelIncome = window.__finish;
            run.remainingTime = .001; window.__finish = undefined;
          }
          return original.advanceRun(run, elapsed, config);
        },
      });
    },
  });
}
async function fresh(page, fixture) {
  if ((await diag(page)).screen !== "home") await page.locator((await diag(page)).screen === "shop" ? "#shop-home-button" : "#home-button").click();
  await page.evaluate(value => { window.__fixture = value; }, fixture);
  await page.locator("#start-button").click();
}
async function grab(page) {
  await page.locator("#game-canvas").focus(); await page.keyboard.press("Space"); await page.clock.runFor(400);
  assert.equal((await diag(page)).run.hook.phase, "returning-loaded");
}
async function finish(page, income = 5000) {
  await page.evaluate(value => { window.__finish = value; }, income);
  await page.clock.fastForward(100); assert.equal((await diag(page)).screen, "result");
}
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(fixtureInstaller); await page.clock.install();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1));
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    await page.goto("http://127.0.0.1:8080");
    for (const [type, income, roll] of [["ruby",350,0], ["mysteryBag",200,.5], ["treasureChest",800,.9], ["cursedRelic",500,0]]) {
      await fresh(page, { type, roll }); await grab(page);
      assert.equal((await diag(page)).run.levelIncome, 0);
      await page.screenshot({ path: path.join(__dirname, `survival-carry-${type}.png`), fullPage: true });
      await page.clock.runFor(3200);
      const state = await diag(page); assert.equal(state.run.levelIncome, income); assert.equal(state.run.minerals[0].status, "banked");
      if (type === "cursedRelic") assert.ok(state.run.remainingTime < 52);
      report.checks.push(`${type} 真实输入抓取、收回及效果`);
    }
    await fresh(page, { effects: { protectionCharm: true }, layout: [
      { id: "keg", type: "powderKeg", x: 480, y: 360 },
      { id: "near-ruby", type: "ruby", x: 540, y: 360 },
      { id: "near-relic", type: "cursedRelic", x: 480, y: 420 },
      { id: "far-chest", type: "treasureChest", x: 640, y: 360, rewardRoll: .9 },
    ] });
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space");
    await page.clock.runFor(250); const beforeExplosion = await diag(page);
    assert.equal(beforeExplosion.run.minerals[0].status, "available"); assert.equal(beforeExplosion.run.hook.phase, "extending");
    await page.screenshot({ path: path.join(__dirname, "survival-powder-keg-before.png"), fullPage: true });
    await page.clock.runFor(150);
    let state = await diag(page);
    assert.equal(state.run.minerals[0].status, "destroyed"); assert.equal(state.run.effects.protectionCharm, true);
    assert.equal(state.run.hook.phase, "returning-empty"); assert.equal(state.run.hook.carryingId, null);
    assert.equal(state.run.minerals[1].status, "destroyed"); assert.equal(state.run.minerals[2].status, "destroyed");
    assert.equal(state.run.minerals[3].status, "available");
    assert.ok(Math.abs(state.run.remainingTime + state.run.elapsedTime - 60) < 1e-7);
    assert.equal(state.run.levelIncome, 0); assert.equal(state.run.wallet, 0); assert.equal(state.run.bombs, 1);
    assert.equal(state.visuals.particles.length, 16); assert.ok(state.visuals.labels.some(label => label.text.includes("火药桶爆炸")));
    assert.ok(state.visuals.particles.every(particle => particle.x === 480 && particle.y === 360));
    assert.equal(state.audio.counts.explode || 0, (beforeExplosion.audio.counts.explode || 0) + 1);
    assert.equal(state.audio.counts.harvest || 0, beforeExplosion.audio.counts.harvest || 0);
    assert.ok((await page.locator("#input-feedback").textContent()).includes("火药桶爆炸"));
    await page.screenshot({ path: path.join(__dirname, "survival-powder-keg-explosion.png"), fullPage: true });
    await page.keyboard.press("Escape"); const explosionPaused = await diag(page); await page.clock.fastForward(5000);
    assert.deepEqual((await diag(page)).visuals, explosionPaused.visuals); assert.deepEqual((await diag(page)).run, explosionPaused.run);
    await page.locator("#resume-button").click(); await page.clock.runFor(1000);
    assert.equal((await diag(page)).audio.counts.explode, state.audio.counts.explode);
    assert.equal((await diag(page)).run.hook.phase, "swinging");
    report.checks.push("火药桶碰撞立即在原地爆炸，附近物体消失、远处保留、空钩返回，不扣时间或消耗护符");
    report.checks.push("火药桶爆炸动画、声音和提示只触发一次，暂停冻结爆炸效果");
    await fresh(page, { type: "cursedRelic", effects: { protectionCharm: true } }); await grab(page); await page.clock.runFor(2800);
    state = await diag(page); assert.equal(state.run.effects.protectionCharm, false); assert.ok(state.run.remainingTime > 55); assert.equal(state.run.levelIncome, 500);
    assert.ok((await page.locator("#input-feedback").textContent()).includes("护身符抵消"));
    report.checks.push("护身符实际抵消古物惩罚并消耗，保留金币收益");
    await fresh(page, { type: "mysteryBag", roll: .75, bombs: 5 }); await grab(page); await page.clock.runFor(1600);
    assert.equal((await diag(page)).run.levelIncome, 100); assert.equal((await diag(page)).run.bombs, 5);
    await fresh(page, { type: "mysteryBag", roll: .9 }); await grab(page); await page.clock.runFor(1600);
    state = await diag(page); assert.equal(state.run.timeBonusUsed, 5); assert.equal(state.run.levelIncome, 0); assert.ok(state.run.remainingTime > 62);
    await fresh(page, { type: "mysteryBag", roll: .99 }); await grab(page); await page.clock.runFor(1600);
    assert.ok((await diag(page)).run.remainingTime < 54);
    await fresh(page, { type: "mysteryBag", roll: .99, effects: { luckyCharm: true } }); await grab(page); await page.clock.runFor(1600);
    assert.equal((await diag(page)).run.timeBonusUsed, 5);
    report.checks.push("钱袋库存满转金币、正负时间与幸运概率");
    await fresh(page, { type: "cursedRelic" }); await grab(page); await page.keyboard.press("s");
    await page.clock.runFor(1000); state = await diag(page);
    assert.equal(state.run.minerals[0].status, "destroyed"); assert.equal(state.run.bombs, 0); assert.equal(state.run.levelIncome, 0); assert.ok(state.run.remainingTime > 58);
    report.checks.push("炸药销毁危险物不触发惩罚");
    await fresh(page, { type: "ruby", effects: { timeCoupon: true, luckyCharm: true, protectionCharm: true } });
    assert.equal((await diag(page)).run.remainingTime, 70);
    await grab(page); await page.keyboard.press("Escape");
    const frozen = await diag(page); await page.clock.fastForward(120000);
    state = await diag(page); assert.deepEqual(state.run, frozen.run); assert.deepEqual(state.visuals, frozen.visuals); assert.equal(state.loopRunning, false);
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space"); assert.equal((await diag(page)).run.input.acceptedCount, frozen.run.input.acceptedCount);
    await page.locator("#resume-button").click(); await page.clock.runFor(100);
    state = await diag(page); assert.ok(frozen.run.remainingTime - state.run.remainingTime < .2);
    report.checks.push("携带新物体与增益暂停 120 秒冻结、输入无效、恢复无跳变");
    const config = require("../../js/config.js"), rules = require("../../js/rules.js");
    for (const item of Object.keys(config.shop).filter(item => item !== "dynamite")) {
      let seed = 0;
      while (true) { const run = rules.createRun(config, 1, { runSeed: seed }); run.result = { success: true }; if (rules.createShop(run, config).offers.includes(item)) break; seed += 1; }
      await fresh(page, { seed }); await finish(page); await page.locator("#restart-button").click();
      assert.equal(await page.locator("#shop-products .shop-product").count(), 4);
      await page.locator(`#buy-${item}`).click(); const bought = await diag(page);
      assert.equal(bought.shop.purchaseCount, 1); assert.equal(bought.run.wallet, 5000 - config.shop[item].price);
      assert.equal(await page.locator(`#buy-${item}`).isDisabled(), true);
      await page.locator(`#buy-${item}`).dispatchEvent("click"); assert.equal((await diag(page)).shop.purchaseCount, 1);
      await page.locator("#next-level-button").click(); state = await diag(page); assert.equal(state.run.levelId, 2); assert.equal(state.run.effects[item], true);
      if (item === "timeCoupon") assert.equal(state.run.remainingTime, 70);
      report.checks.push(`${item} 商店购买、重复拒绝、下一关生效`);
    }
    await fresh(page, { seed: 0 }); await finish(page); await page.locator("#restart-button").click();
    const offers = (await diag(page)).shop.offers;
    for (let i = 0; i < 4; i += 1) await page.locator("#buy-dynamite").click();
    state = await diag(page); assert.equal(state.shop.purchaseCount, 4); assert.equal(state.run.wallet, 4600); assert.equal(state.run.bombs, 5);
    for (const item of offers) { assert.equal(await page.locator(`#buy-${item}`).isDisabled(), true); await page.locator(`#buy-${item}`).dispatchEvent("click"); }
    assert.equal((await diag(page)).run.wallet, 4600); assert.deepEqual((await diag(page)).shop.offers, offers);
    await page.screenshot({ path: path.join(__dirname, "survival-shop-limit.png"), fullPage: true });
    report.checks.push("四件限购、所有按钮禁用、强制重复点击不扣钱、不刷新商品");
    await fresh(page, {}); await finish(page, 650); await page.locator("#restart-button").click();
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1280, height: 480 }]) {
      await page.setViewportSize(viewport);
      const metrics = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        cards: [...document.querySelectorAll(".shop-product")].map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }));
      assert.equal(metrics.overflow, false); assert.ok(metrics.cards.every(card => card.width > 100 && card.height > 100));
      if (viewport.height >= 720) for (const selector of ["#next-level-button", "#shop-home-button", "#buy-dynamite"]) {
        const box = await page.locator(selector).boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= viewport.height);
      }
      await page.screenshot({ path: path.join(__dirname, `survival-shop-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
    report.checks.push("四卡商店在两种桌面视口与短屏无横向溢出");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator("#next-level-button").click(); await finish(page, 0);
    assert.equal(await page.locator("#restart-button").textContent(), "重新挑战 ↻");
    await page.locator("#restart-button").click(); state = await diag(page);
    assert.equal(state.run.levelId, 1); assert.equal(state.run.wallet, 0); assert.equal(state.run.bombs, 1);
    const preferences = await page.evaluate(() => JSON.parse(localStorage.getItem(GoldMinerStorage.key)));
    assert.deepEqual(Object.keys(preferences).sort(), ["bestClearedLevel", "highScore", "soundEnabled"]);
    await page.reload(); state = await diag(page); assert.equal(state.screen, "home"); assert.equal(state.bestClearedLevel, preferences.bestClearedLevel); assert.equal(state.highScore, preferences.highScore);
    report.checks.push("失败重新挑战和刷新只保存设置与生存记录");
    for (const mode of ["denied", "corrupt", "legacy", "audio-unavailable"]) {
      const second = await browser.newPage();
      await second.addInitScript(mode => {
        if (mode === "denied") Object.defineProperty(window, "localStorage", { get() { throw Error("denied"); } });
        if (mode === "corrupt") Storage.prototype.getItem = () => "{bad";
        if (mode === "legacy") { localStorage.removeItem("gold-miner.survival.preferences.v1"); localStorage.setItem("gold-miner.preferences.v1", JSON.stringify({ soundEnabled: false, highScore: 3370 })); }
        if (mode === "audio-unavailable") { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
      }, mode);
      second.on("pageerror", e => report.errors.push(e.message));
      await second.goto("http://127.0.0.1:8080"); const initial = await diag(second);
      assert.equal(initial.highScore, 0); assert.equal(initial.bestClearedLevel, 0);
      if (mode === "legacy") assert.equal(initial.soundEnabled, false);
      await second.locator("#start-button").click(); assert.equal((await diag(second)).screen, "playing");
      await second.close(); report.checks.push(`${mode} 环境可启动和游玩`);
    }
    assert.deepEqual(report.errors, []); report.result = "passed";
    console.log(`浏览器边界验证通过：${report.checks.length} 项。`);
  } finally {
    await browser.close(); await fs.writeFile(path.join(__dirname, "survival-ui-report.json"), JSON.stringify(report, null, 2) + "\n");
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
