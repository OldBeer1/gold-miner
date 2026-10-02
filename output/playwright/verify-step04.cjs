"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "04", method: "controlled settlement + browser clock + real UI input", checks: [], errors: [] };

function installFixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", {
    get() { return rules; },
    set(original) {
      rules = Object.freeze({ ...original, advanceRun(run, delta, config) {
        if (window.__outcome !== undefined) {
          const income = window.__outcome;
          window.__outcome = undefined;
          run.wallet += income - run.levelIncome;
          run.levelIncome = income;
          run.remainingTime = .001;
        }
        return original.advanceRun(run, delta, config);
      } });
    },
  });
}
async function diag(page) { return page.evaluate(() => GoldMiner.getDiagnostics()); }
async function finish(page, income) {
  await page.evaluate(value => { window.__outcome = value; }, income);
  await page.clock.fastForward(100);
  await page.locator("#result-screen").waitFor({ state: "visible" });
}
async function grabStone(page) {
  await page.keyboard.press("Space");
  await page.clock.runFor(300);
  const state = await diag(page);
  assert.equal(state.run.hook.phase, "returning-loaded");
  assert.equal(state.run.minerals.find(m => m.id === state.run.hook.carryingId).type, "stone");
  assert.equal(await page.locator("#dynamite-button").isDisabled(), false);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(installFixture);
    await page.clock.install();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    assert.equal((await diag(page)).run.bombs, 1);
    await page.keyboard.press("s");
    assert.equal((await diag(page)).run.bombs, 1);
    await finish(page, 1000);
    await page.getByRole("button", { name: "进入商店 →", exact: true }).click();
    await page.locator("#buy-strength").click();
    await page.locator("#buy-diamond").click();
    await page.locator("#buy-strength").dispatchEvent("click");
    assert.equal((await diag(page)).run.wallet, 600);
    assert.equal(await page.locator("#buy-strength").isDisabled(), true);
    assert.equal(await page.locator("#buy-diamond").isDisabled(), true);
    for (let index = 0; index < 4; index += 1) await page.locator("#buy-dynamite").click();
    await page.locator("#buy-dynamite").dispatchEvent("click");
    const purchased = await diag(page);
    assert.equal(purchased.run.wallet, 200);
    assert.equal(purchased.run.bombs, 5);
    assert.equal(purchased.run.totalIncome, 1000);
    assert.equal(purchased.run.levelIncome, 1000);
    assert.deepEqual(purchased.run.effects, { strength: false, diamondBoost: false });
    assert.deepEqual(purchased.shop.effects, { strength: true, diamondBoost: true });
    assert.equal(await page.locator("#buy-dynamite").textContent(), "持有已满");
    await page.screenshot({ path: path.join(__dirname, "step04-shop-purchased.png"), fullPage: true });
    for (const id of ["buy-dynamite", "buy-strength", "buy-diamond", "next-level-button"]) {
      const rect = await page.locator(`#${id}`).boundingBox();
      assert.ok(rect.y >= 0 && rect.y + rect.height <= 720, `${id} 必须在视口中可见`);
    }
    await page.locator("#game-canvas").focus();
    await page.keyboard.press("s");
    assert.equal((await diag(page)).run.bombs, 5);
    report.checks.push({ name: "购买仅扣钱包、药水每种一份、炸药上限 5、商店按键无效、按钮可见", result: "passed" });

    await page.getByRole("button", { name: "开始下一关 →", exact: true }).click();
    const entry = (await diag(page)).entrySnapshot;
    assert.equal(entry.wallet, 200);
    assert.equal(entry.bombs, 5);
    assert.deepEqual(entry.effects, { strength: true, diamondBoost: true });
    await grabStone(page);
    await page.keyboard.down("s");
    await page.keyboard.down("s");
    await page.keyboard.up("s");
    assert.equal((await diag(page)).run.bombs, 4);
    assert.equal((await diag(page)).run.hook.phase, "returning-empty");
    assert.equal((await diag(page)).run.levelIncome, 0);
    await finish(page, 200);
    await page.getByRole("button", { name: "重试当前关 ↻", exact: true }).click();
    assert.deepEqual((await diag(page)).entrySnapshot, entry);
    assert.equal((await diag(page)).run.wallet, 200);
    assert.equal((await diag(page)).run.bombs, 5);
    assert.deepEqual((await diag(page)).run.effects, { strength: true, diamondBoost: true });
    await grabStone(page);
    const accepted = (await diag(page)).run.input.acceptedCount;
    await page.locator("#dynamite-button").click();
    assert.equal((await diag(page)).run.input.acceptedCount, accepted + 1);
    assert.equal((await diag(page)).run.bombs, 4);
    assert.equal((await diag(page)).run.hook.phase, "returning-empty");
    assert.equal(await page.locator("#dynamite-button").isDisabled(), true);
    await finish(page, 100);
    await page.getByRole("button", { name: "重试当前关 ↻", exact: true }).click();
    await grabStone(page);
    const scroll = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    assert.equal((await diag(page)).run.bombs, 4);
    assert.equal(await page.evaluate(() => window.scrollY), scroll);
    await finish(page, 100);
    await page.getByRole("button", { name: "重试当前关 ↻", exact: true }).click();
    report.checks.push({ name: "实际抓住石头后 S/按钮/↓ 均可炸掉，无收入、无重复消耗、失败恢复购买后的快照", result: "passed" });

    let aimed = false;
    for (let index = 0; index < 400; index += 1) {
      const run = (await diag(page)).run;
      const angle = Math.atan2(650 - 480, 235 - 112) * 180 / Math.PI;
      if (run.hook.phase === "swinging" && Math.abs(run.hook.angle - angle) < 1.1) { aimed = true; break; }
      await page.clock.runFor(16);
    }
    assert.equal(aimed, true);
    await page.keyboard.press("Space");
    await page.clock.runFor(1000);
    assert.equal((await diag(page)).run.levelIncome, 375);
    assert.equal((await diag(page)).run.wallet, 575);
    assert.equal((await diag(page)).run.totalIncome, 1000);
    await page.screenshot({ path: path.join(__dirname, "step04-active-potions.png"), fullPage: true });
    await finish(page, 1000);
    assert.deepEqual((await diag(page)).run.effects, { strength: false, diamondBoost: false });
    await page.getByRole("button", { name: "进入商店 →", exact: true }).click();
    assert.equal(await page.locator("#buy-strength").isDisabled(), false);
    assert.deepEqual((await diag(page)).shop.effects, { strength: false, diamondBoost: false });
    await page.getByRole("button", { name: "开始下一关 →", exact: true }).click();
    assert.equal((await diag(page)).run.levelId, 3);
    assert.deepEqual((await diag(page)).run.effects, { strength: false, diamondBoost: false });
    report.checks.push({ name: "下一关钻石实抓计入 375，两种药水仅指定关卡生效，下一商店可重新购买", result: "passed" });

    await page.getByRole("button", { name: "← 返回开始", exact: true }).click();
    await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    await finish(page, 650);
    await page.getByRole("button", { name: "进入商店 →", exact: true }).click();
    await page.locator("#buy-strength").click();
    await page.locator("#buy-diamond").click();
    await page.locator("#buy-dynamite").click();
    await page.locator("#buy-dynamite").click();
    assert.equal((await diag(page)).run.wallet, 50);
    assert.equal(await page.locator("#buy-dynamite").textContent(), "金币不足");
    assert.equal(await page.locator("#buy-dynamite").isDisabled(), true);
    await page.locator("#buy-dynamite").dispatchEvent("click");
    assert.equal((await diag(page)).run.wallet, 50);
    await page.screenshot({ path: path.join(__dirname, "step04-insufficient-funds.png"), fullPage: true });
    report.checks.push({ name: "缺钱禁购，强制重复点击也不能扣成负数", result: "passed" });
    assert.deepEqual(report.errors, []);
    report.result = "passed";
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "step04-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
