"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "22", version: "1.2.0", method: "original game and random seed, real elapsed time and real keyboard/mouse; no clock, level, income or outcome overrides", levels: [], shops: [], errors: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await page.screenshot({ path: path.join(__dirname, "survival-v120-home.png"), fullPage: true });
    await page.locator("#start-button").click();
    report.runSeed = (await diag(page)).run.runSeed;
    let mouseUsed = false;
    for (let levelId = 1; levelId <= 4; levelId += 1) {
      const started = performance.now();
      let qualifiedAt = null;
      const trace = [], banks = new Set();
      while (performance.now() - started < 65000) {
        const state = await diag(page), run = state.run;
        assert.equal(run.levelId, levelId);
        for (const mineral of run.minerals) if (mineral.status === "banked" && !banks.has(mineral.id)) {
          banks.add(mineral.id); trace.push({ id: mineral.id, type: mineral.type, income: run.levelIncome, realSeconds: (performance.now() - started) / 1000 });
        }
        if (run.levelIncome >= run.level.target && qualifiedAt === null) {
          qualifiedAt = (performance.now() - started) / 1000;
          assert.equal(run.settled, false);
          console.log(`无限生存第 ${levelId} 关真实 ${qualifiedAt.toFixed(2)} 秒达标，收入 ${run.levelIncome}。`);
        }
        if (state.screen === "result") {
          assert.equal(run.result.success, true); assert.equal(run.bombs, 1);
          assert.ok(Object.values(run.effects).every(value => value === false));
          const settledAt = (performance.now() - started) / 1000;
          assert.ok(settledAt >= 59.5 && settledAt < 64); assert.ok(qualifiedAt < 45);
          report.levels.push({ levelId, target: run.level.target, income: run.levelIncome, qualifiedAt, settledAt, totalIncome: run.totalIncome, trace });
          await page.screenshot({ path: path.join(__dirname, `survival-v120-level${levelId}-result.png`), fullPage: true });
          break;
        }
        assert.equal(state.screen, "playing");
        if (qualifiedAt === null && run.hook.phase === "swinging") {
          const mineral = run.minerals.find(m => m.safeRoute && m.status === "available" && Math.abs(Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI - run.hook.angle) <= .7);
          if (mineral) {
            if (!mouseUsed) {
              const box = await page.locator("#game-canvas").boundingBox();
              await page.mouse.click(box.x + box.width * .55, box.y + box.height * .65);
              mouseUsed = true;
            } else await page.keyboard.press("Space");
          }
        }
        await pause(qualifiedAt === null ? 8 : 200);
      }
      assert.equal(report.levels.length, levelId, "本关必须完成真实计时结算");
      await page.locator("#restart-button").click();
      const shop = await diag(page);
      assert.equal(shop.screen, "shop"); assert.equal(shop.shop.offers.length, 4); assert.equal(shop.shop.purchaseCount, 0);
      report.shops.push({ afterLevel: levelId, offers: shop.shop.offers });
      await page.screenshot({ path: path.join(__dirname, `survival-v120-shop${levelId}.png`), fullPage: true });
      await page.locator("#next-level-button").click();
    }
    const fifth = await diag(page);
    assert.equal(fifth.run.levelId, 5); assert.equal(fifth.run.runSeed, report.runSeed);
    report.enteredLevel5 = true;
    const failureStarted = performance.now();
    await page.locator("#result-screen").waitFor({ state: "visible", timeout: 64000 });
    const failed = await diag(page);
    assert.equal(failed.run.result.success, false); assert.equal(failed.run.levelIncome, 0);
    assert.equal(failed.bestClearedLevel, 4);
    const totalIncome = report.levels.reduce((sum, level) => sum + level.income, 0);
    assert.equal(failed.highScore, totalIncome); assert.equal(failed.run.totalIncome, totalIncome);
    const career = failed.progress.profile.career;
    assert.equal(career.levelsCleared, 4); assert.equal(career.qualifiedIncome, totalIncome);
    assert.equal(career.recoveredIncome, totalIncome); assert.equal(career.activePlayMs, 300000);
    assert.equal(failed.progress.activeRun, null); assert.equal(failed.progress.profile.recentReports.length, 1);
    assert.ok(failed.progress.profile.achievements.first_clear.unlockedAt);
    report.growth = { career, report: failed.progress.profile.recentReports[0] };
    report.failure = { levelId: 5, realSeconds: (performance.now() - failureStarted) / 1000, totalIncome };
    await page.locator("#restart-button").click();
    const fresh = await diag(page);
    assert.equal(fresh.run.levelId, 1); assert.equal(fresh.run.wallet, 0); assert.equal(fresh.run.bombs, 1); assert.equal(fresh.run.totalIncome, 0);
    assert.notEqual(fresh.run.runSeed, report.runSeed);
    await page.locator("#home-button").click(); await page.reload();
    const saved = await diag(page);
    assert.equal(saved.screen, "home"); assert.equal(saved.bestClearedLevel, 4); assert.equal(saved.highScore, totalIncome);
    assert.deepEqual(report.errors, []);
    report.mouseUsed = mouseUsed; report.result = "passed";
    console.log("真实连续四关、四次商店、进入第五关、失败重开与刷新记录通过。");
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "survival-v120-real-run-report.json"), JSON.stringify(report, null, 2) + "\n");
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
