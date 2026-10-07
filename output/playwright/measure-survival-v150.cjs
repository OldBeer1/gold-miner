"use strict";
const fs = require("node:fs"), path = require("node:path"), { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const config = require("../../js/config.js");
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const report = { version: config.version, rulesVersion: config.rulesVersion, method: "original map and browser layout measurement; no performance claim", views: [], errors: [] };
  try {
    for (const [width, height] of [[1280,720],[1920,1080],[1280,480]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on("pageerror", e => report.errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve("index.html")).href);
      await page.locator("#challenge-mode").selectOption("seed"); await page.locator("#challenge-seed").fill("9"); await page.locator("#start-button").click();
      const box = await page.locator("#game-canvas").boundingBox(), scale = box.width / config.canvas.width;
      report.views.push({ width, height, canvas: box, targets: Object.fromEntries(["smallGold","diamond","ruby","mysteryBag"].map(type => { const d = config.minerals[type]; return [type, { width: (d.radius ? 2*d.radius : d.width)*scale, height: (d.radius ? 2*d.radius : d.height)*scale }]; })) });
      await page.screenshot({ path: path.join(__dirname, "survival-v150-" + (config.version === "1.4.1" ? "baseline" : "enlarged") + "-" + width + "x" + height + ".png"), fullPage: true });
      await page.close();
    }
    report.result = report.errors.length ? "failed" : "passed";
    fs.writeFileSync(path.join(__dirname, "survival-v150-" + (config.version === "1.4.1" ? "baseline" : "enlarged") + "-report.json"), JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
