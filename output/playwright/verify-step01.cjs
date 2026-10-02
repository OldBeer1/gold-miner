"use strict";

// 第 01 步的浏览器验收工具，不属于游戏运行依赖。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "../..");
const output = __dirname;
const fileUrl = pathToFileURL(path.join(root, "index.html")).href;
const report = { phase: "01", browser: "", checks: [], errors: [] };

function installLoopProbe() {
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const pending = new Set();
  window.__loopProbe = { pending: 0, maximum: 0 };
  window.requestAnimationFrame = (callback) => {
    const id = request((time) => {
      pending.delete(id);
      window.__loopProbe.pending = pending.size;
      callback(time);
    });
    pending.add(id);
    window.__loopProbe.pending = pending.size;
    window.__loopProbe.maximum = Math.max(window.__loopProbe.maximum, pending.size);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    window.__loopProbe.pending = pending.size;
    cancel(id);
  };
}

async function snapshot(page, name) {
  await fs.writeFile(path.join(output, `${name}.aria.txt`), await page.locator("body").ariaSnapshot(), "utf8");
}

async function diagnostics(page) {
  return page.evaluate(() => GoldMiner.getDiagnostics());
}

async function inspectViewport(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  await context.addInitScript(installLoopProbe);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(`${label}: ${message.text()}`);
  });
  page.on("request", (request) => assert.ok(request.url().startsWith("file:"), "直接打开不应请求远程资源"));
  await page.goto(fileUrl);
  await page.getByRole("heading", { name: "黄金矿工", exact: true }).waitFor();
  await snapshot(page, `${label}-home`);
  assert.equal((await diagnostics(page)).screen, "home");
  assert.equal((await diagnostics(page)).loopRunning, false);
  assert.equal(await page.locator("#game-hud").isVisible(), false);

  const geometry = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const rect = canvas.getBoundingClientRect();
    const start = document.getElementById("start-button").getBoundingClientRect();
    return {
      width: rect.width, height: rect.height, bottom: rect.bottom,
      startBottom: start.bottom, pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth, smoothing: canvas.getContext("2d").imageSmoothingEnabled,
      center: GoldMiner.clientToCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    };
  });
  assert.ok(Math.abs(geometry.width / geometry.height - 1.5) < .001);
  assert.ok(geometry.bottom <= viewport.height && geometry.startBottom <= viewport.height);
  assert.ok(geometry.pageHeight <= viewport.height && geometry.pageWidth <= viewport.width);
  assert.equal(geometry.smoothing, false);
  assert.ok(Math.abs(geometry.center.x - 480) < .001 && Math.abs(geometry.center.y - 320) < .001);
  await page.screenshot({ path: path.join(output, `${label}-home.png`), fullPage: true });

  await page.getByRole("button", { name: "音效：开", exact: true }).click();
  assert.equal((await diagnostics(page)).soundEnabled, false);
  await page.getByRole("button", { name: "音效：关", exact: true }).click();
  await page.getByRole("button", { name: "进入矿区", exact: true }).click();
  await snapshot(page, `${label}-scene`);
  await page.waitForFunction(() => GoldMiner.getDiagnostics().frameCount > 0);
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 0, "开始按钮不应穿透触发游戏输入");
  assert.equal(await page.locator("#game-hud").isVisible(), true);
  assert.equal(await page.locator("#dynamite-button").isDisabled(), true);

  const bounds = await page.locator("#game-canvas").boundingBox();
  const clickLogical = (x, y) => page.mouse.click(bounds.x + x * bounds.width / 960, bounds.y + y * bounds.height / 640);
  await clickLogical(600, 400);
  const point = (await diagnostics(page)).run.input.lastPoint;
  assert.ok(Math.abs(point.x - 600) <= 1.5 && Math.abs(point.y - 400) <= 1.5, "缩放后点击必须落在正确逻辑坐标");
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 1);
  await clickLogical(60, 135);
  await clickLogical(12, 400);
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 1, "矿区以外不接受游戏输入");
  await page.screenshot({ path: path.join(output, `${label}-scene.png`), fullPage: true });

  await page.locator("#game-canvas").focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 2);
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 3, "长按空格不应重复接受输入");
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
  await page.getByRole("button", { name: "音效：开", exact: true }).click();
  assert.equal((await diagnostics(page)).run.input.acceptedCount, 3, "音效按钮不应穿透");

  const starts = (await diagnostics(page)).loopStarts;
  await page.evaluate(() => { GoldMiner.startGame(); GoldMiner.startGame(); });
  assert.equal((await diagnostics(page)).loopStarts, starts, "重复启动应保持同一个循环");
  assert.equal(await page.evaluate(() => window.__loopProbe.maximum), 1);
  assert.equal((await diagnostics(page)).run.remainingTime, 60, "本阶段计时应保持占位值");
  const independentCopy = await page.evaluate(() => {
    const copy = GoldMiner.getDiagnostics();
    copy.run.wallet = 999;
    copy.run.minerals[0].x = 0;
    return GoldMiner.getDiagnostics().run;
  });
  assert.equal(independentCopy.wallet, 0);
  assert.equal(independentCopy.minerals[0].x, 290);

  for (let index = 0; index < 8; index += 1) {
    await page.getByRole("button", { name: "← 返回开始", exact: true }).click();
    assert.equal((await diagnostics(page)).loopRunning, false);
    assert.equal(await page.evaluate(() => window.__loopProbe.pending), 0);
    const stoppedAt = (await diagnostics(page)).frameCount;
    await page.waitForTimeout(50);
    assert.equal((await diagnostics(page)).frameCount, stoppedAt);
    await page.getByRole("button", { name: "进入矿区", exact: true }).click();
    assert.equal((await diagnostics(page)).run.input.acceptedCount, 0);
    assert.equal(await page.evaluate(() => window.__loopProbe.maximum), 1);
  }
  await page.reload();
  await page.getByRole("heading", { name: "黄金矿工", exact: true }).waitFor();
  assert.equal((await diagnostics(page)).screen, "home");
  assert.equal((await diagnostics(page)).soundEnabled, true, "音效持久化尚未接入，刷新应使用默认值");
  report.checks.push({ viewport, geometry, result: "passed", transitions: 8, maximumPendingFrames: 1 });
  await context.close();
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.GOLD_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  let server;
  try {
    report.browser = await browser.version();
    await inspectViewport(browser, { width: 1280, height: 720 });
    await inspectViewport(browser, { width: 1920, height: 1080 });

    const shortPage = await browser.newPage({ viewport: { width: 1280, height: 480 } });
    await shortPage.goto(fileUrl);
    assert.ok(await shortPage.evaluate(() => document.documentElement.scrollHeight > innerHeight && document.documentElement.scrollWidth <= innerWidth));
    await shortPage.getByRole("button", { name: "进入矿区", exact: true }).click();
    await shortPage.getByRole("button", { name: "← 返回开始", exact: true }).click();
    report.checks.push({ viewport: { width: 1280, height: 480 }, result: "passed", behavior: "允许垂直滚动，无横向溢出，按钮可操作" });
    await shortPage.close();

    server = spawn(process.execPath, [path.join(root, "scripts/serve.cjs"), "18080"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("本地服务启动超时")), 5000);
      server.once("error", reject);
      server.stderr.once("data", (data) => { clearTimeout(timeout); reject(new Error(data.toString())); });
      server.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
    });
    const response = await fetch("http://127.0.0.1:18080/");
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").includes("text/html"));
    assert.equal((await fetch("http://127.0.0.1:18080/js/game.js")).status, 200);
    assert.equal((await fetch("http://127.0.0.1:18080/missing.js")).status, 404);
    assert.equal((await fetch("http://127.0.0.1:18080/%2e%2e%5coutside.txt")).status, 403);
    const httpPage = await browser.newPage();
    httpPage.on("pageerror", (error) => report.errors.push(`HTTP: ${error.message}`));
    await httpPage.goto("http://127.0.0.1:18080/");
    await httpPage.getByRole("button", { name: "进入矿区", exact: true }).click();
    assert.equal((await diagnostics(httpPage)).screen, "playing");
    report.checks.push({ mode: "HTTP", result: "passed", missingFile: 404, outsideRoot: 403 });
    assert.deepEqual(report.errors, []);
    report.result = "passed";
  } finally {
    if (server) server.kill();
    await browser.close();
    await fs.writeFile(path.join(output, "step01-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
