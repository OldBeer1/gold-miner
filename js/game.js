(() => {
  "use strict";

  const config = window.GoldMinerConfig;
  const rules = window.GoldMinerRules;
  const preferencesStore = window.GoldMinerStorage;
  const effects = window.GoldMinerEffects;
  const audio = window.GoldMinerAudio.createPlayer();
  const savedPreferences = preferencesStore.loadPreferences(() => window.localStorage);
  const savedCheckpoint = preferencesStore.loadCheckpoint(() => window.localStorage, config);
  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const elements = {
    home: document.getElementById("home-screen"),
    hud: document.getElementById("game-hud"),
    sceneLabel: document.getElementById("scene-label"),
    homeFooter: document.getElementById("home-footer"),
    toolbar: document.getElementById("game-toolbar"),
    start: document.getElementById("start-button"),
    continue: document.getElementById("continue-button"),
    checkpointDescription: document.getElementById("checkpoint-description"),
    saveStatus: document.getElementById("save-status"),
    returnHome: document.getElementById("home-button"),
    sound: document.getElementById("sound-button"),
    soundLabel: document.getElementById("sound-label"),
    highScore: document.getElementById("high-score"),
    bestClearedLevel: document.getElementById("best-cleared-level"),
    feedback: document.getElementById("input-feedback"),
    level: document.getElementById("hud-level"),
    income: document.getElementById("hud-income"),
    target: document.getElementById("hud-target"),
    time: document.getElementById("hud-time"),
    wallet: document.getElementById("hud-wallet"),
    bombs: document.getElementById("hud-bombs"),
    effects: document.getElementById("hud-effects"),
    result: document.getElementById("result-screen"),
    resultTitle: document.getElementById("result-title"),
    resultDescription: document.getElementById("result-description"),
    resultIncome: document.getElementById("result-income"),
    resultTarget: document.getElementById("result-target"),
    resultTotal: document.getElementById("result-total"),
    restart: document.getElementById("restart-button"),
    resultHome: document.getElementById("result-home-button"),
    resultEyebrow: document.getElementById("result-eyebrow"),
    shop: document.getElementById("shop-screen"),
    shopDestination: document.getElementById("shop-destination"),
    shopWallet: document.getElementById("shop-wallet"),
    shopProducts: document.getElementById("shop-products"),
    shopPurchaseCount: document.getElementById("shop-purchase-count"),
    nextLevel: document.getElementById("next-level-button"),
    shopHome: document.getElementById("shop-home-button"),
    dynamite: document.getElementById("dynamite-button"),
    pause: document.getElementById("pause-button"),
    pauseScreen: document.getElementById("pause-screen"),
    pauseTitle: document.getElementById("pause-title"),
    pauseDescription: document.getElementById("pause-description"),
    resume: document.getElementById("resume-button"),
    pauseHome: document.getElementById("pause-home-button"),
  };
  const colors = config.palette;
  const state = {
    screen: "home",
    settings: { soundEnabled: savedPreferences.soundEnabled },
    highScore: savedPreferences.highScore,
    bestClearedLevel: savedPreferences.bestClearedLevel,
    run: createRun(),
    notice: { text: "", seconds: 0 },
    entrySnapshot: null,
    shop: null,
    pauseReason: null,
    visuals: effects.createState(),
    checkpoint: savedCheckpoint.checkpoint,
    hasCheckpointData: savedCheckpoint.hasData,
    saveMessage: savedCheckpoint.message,
    saveError: Boolean(savedCheckpoint.message),
    preferencesError: false,
  };
  audio.setEnabled(state.settings.soundEnabled);
  let frameId = null;
  let lastTimestamp = null;
  let frameCount = 0;
  let loopStarts = 0;

  canvas.width = config.canvas.width;
  canvas.height = config.canvas.height;
  context.imageSmoothingEnabled = false;

  function createRun() {
    const seed = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(seed);
    else seed[0] = Math.floor(Math.random() * 4294967296);
    return rules.createRun(config, 1, { runSeed: seed[0] });
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function updateInterface() {
    const inGame = ["playing", "paused", "result"].includes(state.screen);
    const level = state.run.level;
    document.querySelector(".app").dataset.screen = state.screen;
    elements.home.hidden = state.screen !== "home";
    elements.homeFooter.hidden = state.screen !== "home";
    elements.hud.hidden = !inGame;
    elements.toolbar.hidden = !inGame;
    elements.sceneLabel.hidden = !inGame;
    elements.result.hidden = state.screen !== "result";
    elements.shop.hidden = state.screen !== "shop";
    elements.pauseScreen.hidden = state.screen !== "paused";
    elements.pause.disabled = !["playing", "paused"].includes(state.screen);
    elements.pause.setAttribute("aria-pressed", String(state.screen === "paused"));
    setText(elements.pause, state.screen === "paused" ? "继续" : "暂停");
    setText(elements.pauseTitle, state.pauseReason === "hidden" ? "已自动暂停" : "已暂停");
    setText(elements.pauseDescription, state.pauseReason === "hidden" ? "离开页面时已暂停，返回后点击继续采矿。" : "时间、钩子和矿物已冻结，准备好后继续。");
    elements.sound.setAttribute("aria-pressed", String(state.settings.soundEnabled));
    elements.soundLabel.textContent = `音效：${state.settings.soundEnabled ? "开" : "关"}`;
    elements.highScore.textContent = `¥ ${state.highScore}`;
    elements.bestClearedLevel.textContent = `${state.bestClearedLevel} 关`;
    elements.continue.hidden = !state.checkpoint;
    elements.checkpointDescription.hidden = !state.checkpoint;
    document.querySelector(".home-actions").classList.toggle("single-action", !state.checkpoint);
    elements.start.classList.toggle("button-primary", !state.checkpoint);
    elements.start.classList.toggle("button-quiet", Boolean(state.checkpoint));
    if (state.checkpoint) setText(elements.checkpointDescription, state.checkpoint.kind === "shop"
      ? `已保存：第 ${state.checkpoint.run.levelId} 关后的商店`
      : `已保存：第 ${state.checkpoint.run.levelId} 关起点 · 关内退出会从本关重开`);
    setText(elements.saveStatus, state.saveMessage + (state.preferencesError ? " · 音效或最高记录保存失败" : ""));
    elements.saveStatus.classList.toggle("is-error", state.saveError || state.preferencesError);
    elements.level.textContent = `第 ${state.run.levelId} 关`;
    setText(document.getElementById("hud-stage"), level.stage ? `关卡 · 进阶 ${level.stage}` : "关卡 · 基础");
    elements.level.title = `矿物收入 ×${(level.rewardScale || 1).toFixed(2)}，石头阻挡 ${level.obstacleCount || 0} 条路线`;
    elements.income.textContent = String(state.run.levelIncome);
    elements.target.textContent = String(level.target);
    setText(elements.time, String(Math.ceil(state.run.remainingTime)));
    elements.time.classList.toggle("is-urgent", state.run.remainingTime <= 10);
    elements.wallet.textContent = `¥ ${state.run.wallet}`;
    elements.bombs.textContent = `${state.run.bombs} 枚`;
    const effects = [];
    if (state.run.effects.strength) effects.push(`力量 ×${config.shop.strength.multiplier}`);
    if (state.run.effects.diamondBoost) effects.push(`钻石 ×${config.shop.diamondBoost.multiplier}`);
    if (state.run.effects.goldBoost) effects.push("黄金 ×1.5");
    if (state.run.effects.timeCoupon) effects.push("延时 +10秒");
    if (state.run.effects.protectionCharm) effects.push("护身符 · 1次");
    if (state.run.effects.luckyCharm) effects.push("幸运符");
    elements.effects.textContent = effects.length ? effects.join("、") : "无";
    const dynamiteReady = state.screen === "playing" && rules.canUseDynamite(state.run);
    elements.dynamite.disabled = !dynamiteReady;
    elements.dynamite.classList.toggle("button-dynamite-ready", dynamiteReady);
    setText(elements.dynamite, `炸药 · ${state.run.bombs} 枚`);
    const qualified = state.run.levelIncome >= level.target;
    setText(elements.sceneLabel, qualified ? "已达标，可继续采矿" : state.run.remainingTime <= 10
      ? "最后 10 秒！时间到，未收回的矿物不计分" : `收回矿物才入账 · 本关目标 ¥${level.target}`);
    elements.sceneLabel.classList.toggle("is-qualified", qualified);
    const phase = state.run.hook.phase;
    const carried = state.run.minerals.find((mineral) => mineral.id === state.run.hook.carryingId);
    let feedback = "瞄准目标，按空格或点击矿区出钩";
    if (phase === "extending") feedback = "出钩中，方向已锁定";
    if (phase === "returning-empty") feedback = "空钩回收中，稍后再试";
    if (carried) feedback = `正在收回${config.minerals[carried.type].label}，回到矿工处才入账`;
    if (state.screen === "paused") feedback = "游戏已暂停，继续后再出钩";
    if (state.screen === "result") {
      feedback = !state.run.result.success ? "本轮挑战结束，重新挑战将从第一关开始"
        : "本关已结束，进入商店准备下一关";
    }
    setText(elements.feedback, state.notice.seconds > 0 ? state.notice.text : feedback);
    if (state.run.result) {
      const result = state.run.result;
      setText(elements.resultEyebrow, `采矿报告 · 第 ${String(state.run.levelId).padStart(2, "0")} 关`);
      setText(elements.resultTitle, result.success ? `第 ${state.run.levelId} 关达标！` : "本轮挑战结束");
      setText(elements.resultDescription, result.success
        ? "本关收入已累计，去补给站准备下一关。更深处还有新发现。"
        : `第 ${state.run.levelId} 关未达标，已通过 ${state.run.levelId - 1} 关。本次失败收入不计入记录。`);
      setText(elements.restart, result.success ? "进入商店 →" : "重新挑战 ↻");
      setText(elements.resultIncome, `¥ ${result.levelIncome}`);
      setText(elements.resultTarget, `¥ ${result.target}`);
      setText(elements.resultTotal, `¥ ${result.totalIncome}`);
    }
    if (state.shop) {
      const next = rules.levelParameters(config, state.shop.nextLevelId);
      setText(elements.shopDestination, `下一站：第 ${next.id} 关 · 目标 ¥${next.target} · ${next.stage ? `进阶 ${next.stage}` : "基础档"}`);
      setText(elements.shopWallet, `¥ ${state.run.wallet}`);
      setText(elements.shopPurchaseCount, `已购买 ${state.shop.purchaseCount} / ${config.survival.maxPurchases} 件`);
      for (const button of elements.shopProducts.querySelectorAll("button[data-item]")) {
        const item = button.dataset.item;
        const availability = rules.purchaseAvailability(state.run, state.shop, item, config);
        button.disabled = !availability.available;
        setText(button, availability.reason);
        setText(button.previousElementSibling, item === "dynamite" ? `持有 ${state.run.bombs} / ${config.shop.dynamite.maxInventory}` : "仅下一关生效 · 限购一份");
      }
    }
  }

  function persistCheckpoint(kind) {
    state.checkpoint = rules.captureCheckpoint(state.run, kind, config);
    const saved = preferencesStore.saveCheckpoint(() => window.localStorage, state.checkpoint, config);
    state.hasCheckpointData = true;
    state.saveError = !saved;
    state.saveMessage = saved ? (kind === "shop" ? "商店进度已保存" : "已保存本关起点，退出后可继续")
      : "保存失败：本次进度仅在当前页面保留，关闭后无法保证恢复。";
  }

  function beginLevel(run, snapshot = rules.captureEntrySnapshot(run)) {
    stopLoop();
    audio.stopAll();
    state.run = run;
    state.entrySnapshot = snapshot;
    state.shop = null;
    state.pauseReason = null;
    state.notice = { text: "", seconds: 0 };
    state.visuals = effects.createState();
    state.screen = "playing";
    persistCheckpoint("level");
    updateInterface();
    renderScene();
    startLoop();
    canvas.focus({ preventScroll: true });
  }

  function startGame() {
    if (state.screen === "playing") return;
    if (state.hasCheckpointData && !window.confirm("开始新挑战会替换已有存档，确定开始吗？")) return;
    beginLevel(createRun());
  }

  function continueGame() {
    if (state.screen !== "home" || !state.checkpoint) return;
    const run = rules.restoreCheckpoint(state.checkpoint, config);
    if (state.checkpoint.kind === "level") beginLevel(run);
    else {
      state.run = run;
      state.screen = "result";
      openShop();
    }
  }

  function openShop() {
    if (state.screen !== "result" || !state.run.result.success) return;
    stopLoop();
    audio.stopAll();
    state.visuals = effects.createState();
    state.shop = rules.createShop(state.run, config);
    persistCheckpoint("shop");
    elements.shopProducts.replaceChildren();
    for (const item of state.shop.offers) {
      const definition = config.shop[item];
      const card = document.createElement("div");
      card.className = "shop-product";
      const name = document.createElement("strong");
      name.textContent = definition.label;
      const description = document.createElement("p");
      description.className = "product-effect";
      description.textContent = definition.description;
      const price = document.createElement("span");
      price.textContent = `¥${state.shop.prices[item]}${item === "dynamite" ? " / 枚" : ""}`;
      const limit = document.createElement("small");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-quiet";
      button.dataset.item = item;
      button.id = `buy-${item}`;
      button.setAttribute("aria-label", `购买${definition.label}`);
      card.append(name, description, price, limit, button);
      elements.shopProducts.append(card);
    }
    state.screen = "shop";
    updateInterface();
    renderScene();
    elements.nextLevel.focus({ preventScroll: true });
  }

  function startNextLevel() {
    if (state.screen !== "shop") return;
    const next = rules.createRun(config, state.shop.nextLevelId, {
      wallet: state.run.wallet,
      bombs: state.run.bombs,
      totalIncome: state.run.totalIncome,
      effects: state.shop.effects,
      runSeed: state.run.runSeed,
    });
    beginLevel(next);
  }

  function purchase(item) {
    if (state.screen !== "shop") return;
    const result = rules.purchaseItem(state.run, state.shop, item, config);
    if (result.success) persistCheckpoint("shop");
    updateInterface();
  }

  function resultAction() {
    if (state.screen !== "result") return;
    if (!state.run.result.success) startGame();
    else openShop();
  }

  function returnHome() {
    if (state.screen === "playing" && lastTimestamp !== null) updateGame(Math.max(0, (performance.now() - lastTimestamp) / 1000));
    stopLoop();
    audio.stopAll();
    state.screen = "home";
    state.run = createRun();
    state.notice = { text: "", seconds: 0 };
    state.entrySnapshot = null;
    state.shop = null;
    state.pauseReason = null;
    state.visuals = effects.createState();
    updateInterface();
    renderScene();
    elements.start.focus({ preventScroll: true });
  }

  function persistPreferences() {
    state.preferencesError = !preferencesStore.savePreferences(() => window.localStorage, {
      soundEnabled: state.settings.soundEnabled,
      highScore: state.highScore,
      bestClearedLevel: state.bestClearedLevel,
    });
  }

  function pauseGame(reason = "manual") {
    if (state.screen !== "playing") return;
    if (lastTimestamp !== null) updateGame(Math.max(0, (performance.now() - lastTimestamp) / 1000));
    if (state.screen !== "playing") {
      updateInterface();
      renderScene();
      elements.restart.focus({ preventScroll: true });
      return;
    }
    stopLoop();
    audio.stopAll();
    state.screen = "paused";
    state.pauseReason = reason;
    updateInterface();
    renderScene();
    elements.resume.focus({ preventScroll: true });
  }

  function resumeGame() {
    if (state.screen !== "paused" || document.hidden) return;
    state.screen = "playing";
    state.pauseReason = null;
    updateInterface();
    renderScene();
    startLoop();
    canvas.focus({ preventScroll: true });
  }

  function startLoop() {
    if (frameId !== null) return;
    lastTimestamp = performance.now();
    loopStarts += 1;
    frameId = window.requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    frameId = null;
    lastTimestamp = null;
  }

  function tick(timestamp) {
    frameId = null;
    if (state.screen !== "playing") return;
    const deltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    updateGame(deltaSeconds);
    updateInterface();
    if (state.screen === "result") elements.restart.focus({ preventScroll: true });
    renderScene();
    frameCount += 1;
    if (state.screen === "playing") frameId = window.requestAnimationFrame(tick);
  }

  function updateGame(deltaSeconds) {
    state.notice.seconds = Math.max(0, state.notice.seconds - deltaSeconds);
    const elapsedBefore = state.run.elapsedTime;
    const events = rules.advanceRun(state.run, deltaSeconds, config);
    effects.advance(state.visuals, state.run.elapsedTime - elapsedBefore);
    for (const event of events) {
      if (event.type === "grabbed") audio.play("grab");
      if (event.type === "exploded") {
        const text = `火药桶爆炸，周围 ${event.destroyedIds.length - 1} 件物体被炸毁`;
        state.notice = { text, seconds: 2 };
        effects.explode(state.visuals, event.point, colors);
        effects.message(state.visuals, { x: event.point.x, y: event.point.y - 28 }, text, colors.shirtLight);
        audio.play("explode");
      }
      if (event.type === "banked") {
        const details = [event.value > 0 ? `收入 +¥${event.value}` : "", ...event.feedback].filter(Boolean);
        state.notice = { text: `${config.minerals[event.mineralType].label}已收回${details.length ? "，" + details.join("，") : ""}`, seconds: 2 };
        if (event.value > 0) effects.harvest(state.visuals, config.miner.anchor, event.value, colors);
        if (event.feedback.length) effects.message(state.visuals, { x: config.miner.anchor.x + 60, y: config.miner.anchor.y + 68 }, event.feedback.join(" · "), event.timeChange < 0 ? colors.shirtLight : colors.diamondLight);
        audio.play(event.timeChange < 0 ? "explode" : "harvest");
      }
      if (event.type === "settled") {
        const highScore = preferencesStore.highScoreAfterRun(state.highScore, state.run);
        const bestClearedLevel = event.success ? Math.max(state.bestClearedLevel, state.run.levelId) : state.bestClearedLevel;
        if (highScore > state.highScore || bestClearedLevel > state.bestClearedLevel) {
          state.highScore = highScore;
          state.bestClearedLevel = bestClearedLevel;
          persistPreferences();
        }
        state.screen = "result";
        if (event.success) persistCheckpoint("shop");
        else {
          state.checkpoint = null;
          const cleared = preferencesStore.clearCheckpoint(() => window.localStorage);
          state.hasCheckpointData = !cleared;
          state.saveError = !cleared;
          state.saveMessage = cleared ? "本轮已结束，挑战存档已清除" : "存档清除失败：当前挑战已结束，关闭后旧进度可能仍可恢复。";
        }
        state.notice = { text: "", seconds: 0 };
        stopLoop();
        audio.stopAll();
        audio.play(event.success ? "success" : "failure");
      }
    }
  }

  function clientToCanvasPoint(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) * config.canvas.width / bounds.width,
      y: (clientY - bounds.top) * config.canvas.height / bounds.height,
    };
  }

  function isInMine(point) {
    const mine = config.mine;
    return point.x >= mine.x && point.x <= mine.x + mine.width
      && point.y >= mine.y && point.y <= mine.y + mine.height;
  }

  function handleGameInput(action, point = null) {
    if (state.screen !== "playing") return false;
    if (action === "launch") {
      if (point && !isInMine(point)) return false;
      if (!rules.launchHook(state.run)) return false;
      audio.play("launch");
    } else if (action === "dynamite") {
      const destroyed = rules.useDynamite(state.run);
      if (!destroyed) return false;
      effects.explode(state.visuals, rules.hookPoint(state.run.hook, config), colors);
      audio.play("explode");
      state.notice = { text: `${config.minerals[destroyed.mineralType].label}已炸掉，不计收入，快速收钩`, seconds: 1.5 };
    } else return false;
    state.run.input.acceptedCount += 1;
    state.run.input.lastAction = action;
    state.run.input.lastPoint = point ? { ...point } : null;
    updateInterface();
    return true;
  }

  function fill(color, x, y, width, height) {
    context.fillStyle = color;
    context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function polygon(color, points) {
    context.fillStyle = color;
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(Math.round(x), Math.round(y));
      else context.lineTo(Math.round(x), Math.round(y));
    });
    context.closePath();
    context.fill();
  }

  function drawBackground() {
    fill(colors.sky, 0, 0, 960, 112);
    fill(colors.skyLight, 70, 22, 90, 12);
    fill(colors.skyLight, 96, 14, 40, 8);
    fill(colors.skyLight, 710, 34, 116, 12);
    polygon(colors.mountain, [[0, 108], [90, 52], [155, 90], [230, 60], [320, 112]]);
    polygon(colors.mountain, [[700, 112], [805, 68], [856, 83], [900, 53], [960, 100], [960, 112]]);
    fill(colors.surface, 0, 112, 960, 48);
    fill(colors.grass, 0, 108, 960, 12);
    for (let x = 0; x < 960; x += 32) fill(colors.grassLight, x, 108, 20, 4);
    fill(colors.soil, 0, 160, 960, 480);
    polygon(colors.strata, [[0, 180], [148, 180], [148, 200], [324, 200], [324, 192], [568, 192], [568, 180], [804, 180], [804, 204], [960, 204], [960, 224], [0, 224]]);
    polygon(colors.soilDeep, [[0, 530], [180, 530], [180, 566], [400, 566], [400, 548], [652, 548], [652, 590], [820, 590], [820, 570], [960, 570], [960, 640], [0, 640]]);
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 12; column += 1) {
        const x = column * 82 + ((row * 19 + column * 7) % 38);
        const y = 174 + row * 73 + ((column * 11) % 40);
        fill(row > 4 ? colors.soil : colors.strata, x, y, 12, 4);
        fill(colors.soilDeep, x + 18, y + 26, 4, 4);
      }
    }
    fill(colors.woodShadow, 70, 72, 12, 64);
    fill(colors.woodShadow, 186, 72, 12, 64);
    fill(colors.wood, 62, 68, 144, 12);
    fill(colors.wood, 80, 84, 108, 8);
    fill(colors.woodShadow, 786, 87, 78, 36);
    fill(colors.wood, 782, 82, 86, 8);
    fill(colors.wood, 798, 90, 6, 28);
    fill(colors.wood, 848, 90, 6, 28);
  }

  function drawMiner() {
    const { x, y } = config.miner.anchor;
    const pulling = ["returning-loaded", "returning-empty"].includes(state.run.hook.phase);
    const pose = Math.floor(state.visuals.time * (pulling ? 10 : 2)) % 2;
    const bob = pose * (pulling ? 2 : 1);
    context.save();
    context.translate(0, bob);
    fill(colors.dark, x - 32, y - 48, 40, 32);
    fill(colors.skin, x - 30, y - 47, 28, 24);
    fill(colors.dark, x - 9, y - 42, 4, Math.floor(state.visuals.time * 2) % 8 === 7 ? 1 : 4);
    fill(colors.rope, x - 26, y - 30, 24, 12);
    fill(colors.goldShadow, x - 38, y - 54, 54, 8);
    fill(colors.gold, x - 32, y - 70, 38, 18);
    fill(colors.goldLight, x - 18, y - 62, 10, 8);
    fill(colors.shirt, x - 34, y - 18, 34, 24);
    fill(colors.shirtLight, x - 29, y - 18, 8, 24);
    fill(colors.skin, x - 4, y - 14, 26, 10);
    fill(colors.dark, x - 34, y + 6, 12, 12);
    fill(colors.dark, x - 14, y + 6, 12, 12);
    context.restore();
    fill(colors.woodShadow, x + 22, y - 23, 12, 42);
    fill(colors.wood, x + 10, y - 20, 32, 24);
    fill(colors.dark, x + 17, y - 15, 18, 14);
    fill(colors.rope, x + 20, y - 15, 4, 14);
    fill(colors.rope, x + 28, y - 15, 4, 14);
    fill(colors.woodShadow, x + 4, y + 16, 44, 6);
    fill(colors.stoneLight, x + 27, y - 11, 6, 6);
    fill(colors.woodShadow, x + 31, y - 8, pulling && pose ? 4 : 14, pulling && pose ? 14 : 4);
    fill(colors.skin, x + (pulling && pose ? 30 : 39), y + (pulling && pose ? 2 : -11), 8, 8);
  }

  function drawHook() {
    const anchor = config.miner.anchor;
    const radians = state.run.hook.angle * Math.PI / 180;
    const x = anchor.x + Math.sin(radians) * state.run.hook.length;
    const y = anchor.y + Math.cos(radians) * state.run.hook.length;
    context.strokeStyle = colors.rope;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(anchor.x, anchor.y);
    context.lineTo(x, y);
    context.stroke();
    fill(colors.stoneLight, x - 2, y - 5, 4, 10);
    fill(colors.stoneLight, x - 10, y + 2, 6, 4);
    fill(colors.stoneLight, x + 4, y + 2, 6, 4);
    fill(colors.stoneLight, x - 10, y - 4, 4, 6);
    fill(colors.stoneLight, x + 6, y - 4, 4, 6);
  }

  function drawMineral(mineral) {
    const { x, y, type } = mineral;
    const definition = config.minerals[type];
    if (type === "diamond" || type === "ruby") {
      const halfWidth = definition.width / 2;
      const halfHeight = definition.height / 2;
      const gem = type === "ruby" ? ["#dc5261", "#ffbcc3", "#933347"] : [colors.diamond, colors.diamondLight, colors.diamondShadow];
      polygon(gem[0], [[x, y - halfHeight], [x + halfWidth, y], [x, y + halfHeight], [x - halfWidth, y]]);
      polygon(gem[1], [[x, y - halfHeight], [x, y + 2], [x - halfWidth, y]]);
      polygon(gem[2], [[x, y + 2], [x + halfWidth, y], [x, y + halfHeight]]);
      if (Math.floor(state.visuals.time * 3 + x) % 5 === 0) {
        fill(colors.diamondLight, x - 2, y - halfHeight - 4, 4, 8);
        fill(colors.diamondLight, x - 4, y - halfHeight - 2, 8, 4);
      }
      return;
    }
    if (type === "mysteryBag") {
      fill(colors.goldShadow, x - 7, y - 14, 14, 6);
      fill(colors.wood, x - 12, y - 5, 24, 17);
      fill(colors.goldLight, x - 8, y - 4, 7, 13);
      fill(colors.dark, x - 8, y - 8, 16, 3);
      fill(colors.dark, x + 2, y + 2, 5, 3);
      fill(colors.dark, x + 4, y + 7, 3, 3);
      return;
    }
    if (type === "treasureChest") {
      fill(colors.woodShadow, x - 17, y - 14, 34, 28);
      fill(colors.wood, x - 15, y - 12, 30, 12);
      fill(colors.gold, x - 17, y - 2, 34, 4);
      fill(colors.goldShadow, x - 12, y - 14, 4, 28);
      fill(colors.goldShadow, x + 8, y - 14, 4, 28);
      fill(colors.goldLight, x - 3, y - 1, 6, 8);
      return;
    }
    if (type === "cursedRelic") {
      fill("#695681", x - 9, y - 15, 18, 9);
      fill("#9c79af", x - 13, y - 6, 26, 17);
      fill("#493855", x - 10, y + 11, 20, 4);
      fill("#ff9178", x - 7, y - 3, 4, 5);
      fill("#ff9178", x + 3, y - 3, 4, 5);
      fill(colors.dark, x - 4, y + 6, 8, 3);
      return;
    }
    if (type === "powderKeg") {
      fill(colors.woodShadow, x - 11, y - 14, 22, 31);
      fill(colors.shirt, x - 13, y - 11, 26, 25);
      fill(colors.stoneLight, x - 13, y - 9, 26, 3);
      fill(colors.stoneLight, x - 13, y + 10, 26, 3);
      fill(colors.goldLight, x - 2, y - 17, 4, 5);
      fill(colors.goldLight, x - 2, y - 2, 4, 6);
      fill(colors.goldLight, x - 2, y + 6, 4, 2);
      return;
    }
    const r = definition.radius;
    const isStone = type === "stone";
    const base = isStone ? colors.stone : colors.gold;
    const shadow = isStone ? colors.stoneShadow : colors.goldShadow;
    const light = isStone ? colors.stoneLight : colors.goldLight;
    polygon(shadow, [[x - r, y - r * .3], [x - r * .6, y - r * .8], [x + r * .5, y - r], [x + r, y - r * .2], [x + r * .7, y + r * .7], [x, y + r], [x - r * .8, y + r * .6]]);
    polygon(base, [[x - r, y - r * .3], [x - r * .6, y - r * .8], [x + r * .5, y - r], [x + r * .7, y + r * .4], [x - r * .6, y + r * .5]]);
    fill(light, x - r * .5, y - r * .45, r * .65, Math.max(4, r * .2));
    fill(shadow, x + r * .15, y + r * .1, r * .3, Math.max(4, r * .2));
  }

  function renderScene() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    state.run.minerals.forEach((mineral) => {
      if (mineral.status === "available") drawMineral(mineral);
    });
    const carried = state.run.minerals.find((mineral) => mineral.id === state.run.hook.carryingId);
    if (carried) drawMineral({ ...carried, ...rules.hookPoint(state.run.hook, config) });
    drawHook();
    drawMiner();
    drawEffects();
  }

  function drawEffects() {
    context.save();
    for (const particle of state.visuals.particles) {
      context.globalAlpha = Math.min(1, (particle.life - particle.age) * 6);
      const x = particle.x + particle.vx * particle.age;
      const y = particle.y + particle.vy * particle.age + particle.gravity * particle.age * particle.age / 2;
      fill(particle.color, x, y, particle.size, particle.size);
    }
    context.textAlign = "center";
    context.font = 'bold 23px "Microsoft YaHei", monospace';
    for (const label of state.visuals.labels) {
      context.globalAlpha = Math.min(1, (label.life - label.age) * 4);
      const x = Math.round(label.x);
      const y = Math.round(label.y - label.age * 32);
      context.fillStyle = colors.dark;
      context.fillText(label.text, x + 2, y + 2);
      context.fillStyle = label.color;
      context.fillText(label.text, x, y);
    }
    context.restore();
  }

  // 首次真实手势才创建音频；规则事件可以随后复用它，文件直开也无需音频素材。
  function unlockAudio(event) {
    if (event.isTrusted) audio.unlock();
  }
  document.addEventListener("pointerdown", unlockAudio, { capture: true });
  document.addEventListener("keydown", unlockAudio, { capture: true });
  document.addEventListener("click", event => {
    if (state.screen !== "paused" && event.target instanceof Element && event.target.closest("button:not(:disabled)") && event.target.closest("button") !== elements.sound) audio.play("button");
  });

  elements.start.addEventListener("click", startGame);
  elements.continue.addEventListener("click", continueGame);
  elements.returnHome.addEventListener("click", returnHome);
  elements.restart.addEventListener("click", resultAction);
  elements.resultHome.addEventListener("click", returnHome);
  elements.nextLevel.addEventListener("click", startNextLevel);
  elements.shopHome.addEventListener("click", returnHome);
  elements.pause.addEventListener("click", () => state.screen === "paused" ? resumeGame() : pauseGame());
  elements.resume.addEventListener("click", resumeGame);
  elements.pauseHome.addEventListener("click", returnHome);
  elements.shopProducts.addEventListener("click", event => {
    const button = event.target.closest("button[data-item]");
    if (button && !button.disabled) purchase(button.dataset.item);
  });
  elements.dynamite.addEventListener("click", () => {
    if (handleGameInput("dynamite")) canvas.focus({ preventScroll: true });
  });
  elements.sound.addEventListener("click", () => {
    state.settings.soundEnabled = !state.settings.soundEnabled;
    audio.setEnabled(state.settings.soundEnabled);
    if (state.settings.soundEnabled) {
      audio.unlock();
      audio.play("button");
    }
    persistPreferences();
    updateInterface();
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state.screen !== "playing") return;
    const point = clientToCanvasPoint(event.clientX, event.clientY);
    if (handleGameInput("launch", point)) canvas.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && ["playing", "paused"].includes(state.screen)) {
      event.preventDefault();
      if (!event.repeat) {
        if (state.screen === "paused") resumeGame();
        else pauseGame();
      }
      return;
    }
    if (state.screen === "paused" && ["Space", "ArrowDown", "KeyS"].includes(event.code)) {
      if (!(event.code === "Space" && event.target instanceof Element && event.target.closest("button, a"))) event.preventDefault();
      return;
    }
    if (state.screen !== "playing" || !["Space", "ArrowDown", "KeyS"].includes(event.code)) return;
    if (event.target instanceof Element && (event.target.closest("input, textarea, select") || (event.code === "Space" && event.target.closest("button, a")))) return;
    event.preventDefault();
    if (!event.repeat) handleGameInput(event.code === "Space" ? "launch" : "dynamite");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame("hidden");
  });
  window.addEventListener("pagehide", () => {
    if (state.screen === "playing") pauseGame("hidden");
    else stopLoop();
    audio.stopAll();
  });

  // 只提供状态副本供浏览器验收读取，避免外部修改运行中的状态。
  window.GoldMiner = Object.freeze({
    startGame,
    returnHome,
    clientToCanvasPoint,
    getDiagnostics() {
      return {
        screen: state.screen,
        loopRunning: frameId !== null,
        loopStarts,
        frameCount,
        soundEnabled: state.settings.soundEnabled,
        highScore: state.highScore,
        bestClearedLevel: state.bestClearedLevel,
        pauseReason: state.pauseReason,
        visuals: JSON.parse(JSON.stringify(state.visuals)),
        audio: audio.getDiagnostics(),
        run: JSON.parse(JSON.stringify(state.run)),
        entrySnapshot: state.entrySnapshot ? JSON.parse(JSON.stringify(state.entrySnapshot)) : null,
        shop: state.shop ? JSON.parse(JSON.stringify(state.shop)) : null,
        checkpoint: state.checkpoint ? JSON.parse(JSON.stringify(state.checkpoint)) : null,
        saveError: state.saveError,
        saveMessage: state.saveMessage,
      };
    },
  });

  updateInterface();
  renderScene();
})();
