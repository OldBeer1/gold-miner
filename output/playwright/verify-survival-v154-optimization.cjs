"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto"), { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const { loadBaseline, fixture } = require("../../scripts/check-ui-compat.cjs");
const baseline = loadBaseline("v1.5.3"), config = require("../../js/config.js");
const report = { version: config.version, rulesVersion: config.rulesVersion, method: "isolated Chrome; identical original v153 entry, manual RAF/performance clock 60 frames at 1/60 s; visible Canvas call counts and exact PNG equality, not real-time gameplay or FPS", scenes: [], errors: [] };
(async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(__dirname, "survival-v153-package-report.json"), "utf8"));
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    for (const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]) {
      const scene = { viewport };
      for (const [label, target] of [["previous",path.join(pkg.extractedDirectory,"index.html")],["current",path.resolve("index.html")]]) {
        const doc = fixture(baseline, "seed"), page = await browser.newPage({viewport});
        page.on("pageerror", error => report.errors.push(error.message));
        await page.addInitScript(({key,doc}) => {
          localStorage.setItem(key, JSON.stringify(doc)); window.__draws = {fillRect:0,drawImage:0}; window.__now=0; window.__raf=new Map(); window.__nextFrame=0; performance.now=()=>__now; window.requestAnimationFrame=callback=>{__raf.set(++__nextFrame,callback);return __nextFrame;}; window.cancelAnimationFrame=id=>__raf.delete(id);
          for (const name of Object.keys(__draws)) {
            const original = CanvasRenderingContext2D.prototype[name];
            CanvasRenderingContext2D.prototype[name] = function(...args) { if (this.canvas.id === "game-canvas") __draws[name]++; return original.apply(this,args); };
          }
        }, {key:baseline.storage.progressKey,doc});

        await page.goto(pathToFileURL(target).href); await page.evaluate(() => document.getElementById("continue-button").click());
        const before = await page.evaluate(() => { __draws.fillRect=__draws.drawImage=0; return GoldMiner.getDiagnostics().frameCount; });
        await page.evaluate(() => {for(let n=1;n<=60;n++){__now=n*1000/60;const callbacks=[...__raf.values()];__raf.clear();callbacks.forEach(callback=>callback(__now));}});
        const measured = await page.evaluate(() => ({calls:{...__draws},frames:GoldMiner.getDiagnostics().frameCount, run:GoldMiner.getDiagnostics().run, png:document.getElementById("game-canvas").toDataURL(),footer:document.querySelector(".footer-hint").textContent}));
        scene[label] = { calls:measured.calls, frames:measured.frames-before, pngSha256:crypto.createHash("sha256").update(measured.png).digest("hex"), footer:measured.footer, elapsedTime:measured.run.elapsedTime };
        await page.screenshot({path:path.join(__dirname,`survival-v154-${label}-${viewport.width}x${viewport.height}.png`),fullPage:true});
        await page.close();
      }
      assert.equal(scene.current.pngSha256,scene.previous.pngSha256,"identical Canvas pixels");
      assert.equal(scene.current.frames,scene.previous.frames); assert.equal(scene.current.elapsedTime,scene.previous.elapsedTime);
      if(config.version !== "1.5.3") {
        assert.ok(scene.current.calls.fillRect < scene.previous.calls.fillRect);
        assert.equal(scene.current.calls.drawImage,scene.current.frames);
        assert.ok(scene.current.footer.includes(config.version));
      }
      report.scenes.push(scene);
    }
    assert.deepEqual(report.errors,[]); report.result="passed";
  } finally { await browser.close(); await fs.writeFile(path.join(__dirname,`survival-v154-optimization-${config.version === "1.5.3" ? "baseline" : "ui"}-report.json`),JSON.stringify(report,null,2)+"\n"); }
  console.log(JSON.stringify(report.scenes));
})().catch(e => {console.error(e);process.exitCode=1;});
