"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "07", method: "real elapsed time, original game rules, real keyboard and mouse input; no clock or outcome overrides", levels: [], errors: [], potions: false, dynamite: false };
const routes = [
  ["l1-big1", "l1-big3", "l1-g5"],
  ["l2-d1", "l2-big1", "l2-big2", "l2-big3"],
  ["l3-d1", "l3-d3", "l3-g3", "l3-big1", "l3-big2", "l3-r1", "l3-big3"],
];
async function diag(page) { return page.evaluate(() => GoldMiner.getDiagnostics()); }
async function playLevel(page, levelId) {
  const start = performance.now();
  const trace = [];
  const seenGrabs = new Set();
  const seenBanks = new Set();
  const grabbedAt = {};
  let index = 0;
  let qualifiedAt = null;
  let mouseUsed = false;
  let deadlineChecked = false;
  while (performance.now() - start < 65000) {
    const state = await diag(page);
    const run = state.run;
    const seconds = (performance.now() - start) / 1000;
    for (const mineral of run.minerals) {
      if (mineral.status === "carried" && !seenGrabs.has(mineral.id)) {
        seenGrabs.add(mineral.id);
        grabbedAt[mineral.id] = seconds;
        trace.push({ event: "grabbed", id: mineral.id, type: mineral.type, seconds: Number(seconds.toFixed(2)), income: run.levelIncome });
      }
      if (mineral.status === "banked" && !seenBanks.has(mineral.id)) {
        seenBanks.add(mineral.id);
        const carrySeconds = grabbedAt[mineral.id] === undefined ? null : Number((seconds - grabbedAt[mineral.id]).toFixed(2));
        trace.push({ event: "banked", id: mineral.id, type: mineral.type, seconds: Number(seconds.toFixed(2)), carrySeconds, income: run.levelIncome });
        console.log(`第 ${levelId} 关收回 ${mineral.id}，收入 ${run.levelIncome}，真实经过 ${seconds.toFixed(2)} 秒。`);
      }
    }
    if (run.levelIncome >= [650, 1000, 1400][levelId - 1] && qualifiedAt === null) {
      qualifiedAt = Number(seconds.toFixed(2));
      assert.equal(run.settled, false);
      assert.equal(state.screen, "playing");
      await page.screenshot({ path: path.join(__dirname, `final-level${levelId}-qualified.png`), fullPage: true });
    }
    if (run.remainingTime <= 10 && !deadlineChecked && state.screen === "playing") {
      assert.ok((await page.locator("#hud-time").getAttribute("class"))?.includes("is-urgent"));
      deadlineChecked = true;
    }
    if (state.screen === "result") {
      assert.equal(run.result.success, true);
      assert.equal(run.bombs, 1);
      assert.deepEqual(run.effects, { strength: false, diamondBoost: false });
      assert.ok(seconds >= 59.8 && seconds <= 63);
      assert.ok(qualifiedAt < 60);
      assert.equal(state.loopRunning, false);
      const summary = { levelId, income: run.levelIncome, target: run.result.target, qualifiedAt, settledAt: Number(seconds.toFixed(2)), totalIncome: run.totalIncome, mouseUsed, deadlineChecked, trace };
      report.levels.push(summary);
      await page.screenshot({ path: path.join(__dirname, `final-level${levelId}-result.png`), fullPage: true });
      console.log(`第 ${levelId} 关真实 60 秒结束，成功结算 ${run.levelIncome}。`);
      return;
    }
    assert.equal(state.screen, "playing");
    while (run.minerals.find(m => m.id === routes[levelId - 1][index])?.status === "banked") index += 1;
    const next = run.minerals.find(m => m.id === routes[levelId - 1][index]);
    if (next && run.hook.phase === "swinging") {
      const angle = Math.atan2(next.x - 480, next.y - 112) * 180 / Math.PI;
      if (Math.abs(run.hook.angle - angle) <= .75) {
        if (!mouseUsed) {
          const box = await page.locator("#game-canvas").boundingBox();
          await page.mouse.click(box.x + box.width * .55, box.y + box.height * .6);
          mouseUsed = true;
        } else await page.keyboard.press("Space");
      }
    }
    await new Promise(resolve => setTimeout(resolve, qualifiedAt === null ? 12 : 250));
  }
  throw new Error(`第 ${levelId} 关未在真实 65 秒内完成：${JSON.stringify(await diag(page))}`);
}
async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await page.locator("#start-button").click();
    await page.locator("#home-button").click();
    await page.locator("#sound-button").click();
    await page.locator("#start-button").click();
    for (let levelId = 1; levelId <= 3; levelId += 1) {
      await playLevel(page, levelId);
      if (levelId < 3) {
        await page.locator("#restart-button").click();
        assert.equal((await diag(page)).screen, "shop");
        assert.equal((await diag(page)).loopRunning, false);
        await page.screenshot({ path: path.join(__dirname, `final-shop${levelId}.png`), fullPage: true });
        await page.locator("#next-level-button").click();
      }
    }
    assert.equal(await page.locator("#result-title").textContent(), "三关通关！");
    assert.equal((await diag(page)).run.totalIncome, report.levels.reduce((sum, item) => sum + item.income, 0));
    await page.locator("#restart-button").click();
    assert.equal((await diag(page)).run.wallet, 0);
    assert.equal((await diag(page)).run.levelId, 1);
    const failureStart = performance.now();
    await page.locator("#result-screen").waitFor({ state: "visible", timeout: 64000 });
    const failed = await diag(page);
    assert.equal(failed.run.result.success, false);
    assert.equal(failed.run.totalIncome, 0);
    assert.equal(failed.highScore, report.levels.reduce((sum, item) => sum + item.income, 0));
    report.failure = { realSeconds: Number(((performance.now() - failureStart) / 1000).toFixed(2)), income: failed.run.levelIncome };
    await page.locator("#restart-button").click();
    const retry = await diag(page);
    assert.equal(retry.run.wallet, 0);
    assert.equal(retry.run.bombs, 1);
    assert.ok(retry.run.remainingTime > 59.5);
    assert.ok(retry.run.minerals.every(m => m.status === "available"));
    await page.locator("#home-button").click();
    await page.reload();
    assert.equal((await diag(page)).screen, "home");
    assert.equal((await diag(page)).highScore, failed.highScore);
    assert.equal((await diag(page)).soundEnabled, false);
    assert.deepEqual(report.errors, []);
    report.result = "passed";
    console.log("三关真实完整通关、无药水/炸药路线、真实失败和重试通过。");
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "final-real-run-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
