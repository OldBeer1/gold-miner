(() => {
  "use strict";

  const config = window.GoldMinerConfig;
  const rules = window.GoldMinerRules;
  const preferencesStore = window.GoldMinerStorage;
  const growth = window.GoldMinerGrowth;
  const effects = window.GoldMinerEffects;
  const audio = window.GoldMinerAudio.createPlayer();
  const savedProgress = preferencesStore.loadProgress(() => window.localStorage, config);
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
    settings: savedProgress.document.settings,
    highScore: savedProgress.document.profile.career.bestRunIncome,
    bestClearedLevel: savedProgress.document.profile.career.bestClearedLevel,
    progress: savedProgress.document,
    revision: savedProgress.revision,
    storageBlocked: savedProgress.blocked,
    externalChange: false,
    profileReturn: "home",
    profilePage: "career",
    levelUnlocks: [],
    unlockQueue: [],
    toastSeconds: 0,
    run: createRun(),
    notice: { text: "", seconds: 0 },
    entrySnapshot: null,
    shop: null,
    pauseReason: null,
    visuals: effects.createState(),
    checkpoint: savedProgress.document.activeRun?.checkpoint || null,
    hasCheckpointData: Boolean(savedProgress.document.activeRun),
    saveMessage: savedProgress.message,
    saveError: savedProgress.blocked || savedProgress.revision === null,
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
    document.getElementById("profile-screen").hidden = state.screen !== "profile";
    document.getElementById("latest-report-button").hidden = !state.progress.profile.recentReports.length;
    document.getElementById("reload-progress-button").hidden = !state.externalChange;
    const title = growth.definitions.find(def => def.id === state.progress.profile.equippedTitleId)?.reward.title;
    setText(document.getElementById("equipped-title"), title ? `称号 · ${title}` : "矿工档案 · 成就记录你的经历");
    const toast = document.getElementById("achievement-notice");
    toast.hidden = !state.unlockQueue.length || state.screen === "paused" || state.screen === "profile";
    if (state.unlockQueue.length) setText(document.getElementById("achievement-notice-text"), `徽章解锁 · ${growth.definitions.find(def => def.id === state.unlockQueue[0]).title}${state.saveError ? "（本次未能保存）" : ""}`);
    elements.pause.disabled = !["playing", "paused"].includes(state.screen);
    for (const button of [elements.start, elements.continue, elements.restart, elements.nextLevel, elements.resume]) button.disabled = state.externalChange;
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
    setText(elements.saveStatus, state.saveMessage);
    elements.saveStatus.classList.toggle("is-error", state.saveError);
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
      setText(elements.resultTitle, result.success ? `第 ${state.run.levelId} 关达标！` : "本次挑战报告");
      setText(elements.resultDescription, result.success
        ? "本关收入已累计，去补给站准备下一关。更深处还有新发现。"
        : `第 ${state.run.levelId} 关未达标，已通过 ${state.run.levelId - 1} 关。本次失败收入不计入记录。`);
      setText(elements.restart, result.success ? "进入商店 →" : "重新挑战 ↻");
      setText(elements.resultIncome, `¥ ${result.levelIncome}`);
      setText(elements.resultTarget, `¥ ${result.target}`);
      setText(elements.resultTotal, `¥ ${result.totalIncome}`);
      setText(document.getElementById("result-achievements"), state.levelUnlocks.length ? `本关新徽章：${state.levelUnlocks.map(id => growth.definitions.find(def => def.id === id).title).join("、")}` : "");
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
    const checkpoint = rules.captureCheckpoint(state.run, kind, config);
    if (kind === "level") queueUnlocks(growth.enterLevel(state.progress, checkpoint, new Date().toISOString()));
    else state.progress.activeRun.checkpoint = checkpoint;
    persistProgress(kind === "shop" ? "商店与档案已保存" : "已保存本关起点，退出后可继续");
  }

  function persistProgress(message) {
    state.checkpoint = state.progress.activeRun?.checkpoint || null;
    state.hasCheckpointData = Boolean(state.checkpoint);
    state.highScore = state.progress.profile.career.bestRunIncome;
    state.bestClearedLevel = state.progress.profile.career.bestClearedLevel;
    if (state.storageBlocked || state.externalChange) { state.saveError = true; return; }
    const saved = preferencesStore.saveProgress(() => window.localStorage, state.progress, config, state.revision);
    state.saveError = !saved.saved;
    state.saveMessage = saved.saved ? message : saved.message;
    if (saved.saved) { state.revision = saved.revision; state.progress.revision = saved.revision; }
    if (saved.conflict) handleExternalChange();
  }

  function queueUnlocks(ids) {
    for (const id of ids) if (!state.unlockQueue.includes(id)) state.unlockQueue.push(id);
    if (ids.length) { state.toastSeconds = 4; audio.play("success"); }
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
    state.levelUnlocks = [];
    document.getElementById("result-report").replaceChildren();
    persistCheckpoint("level");
    updateInterface();
    renderScene();
    startLoop();
    canvas.focus({ preventScroll: true });
  }

  function startGame() {
    if (state.screen === "playing") return;
    if (state.externalChange) return;
    if (state.hasCheckpointData && !window.confirm("开始新挑战会替换已有存档，确定开始吗？")) return;
    const now = new Date().toISOString();
    growth.abandon(state.progress, now);
    const run = createRun();
    const checkpoint = rules.captureCheckpoint(run, "level", config);
    const runId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `run-${Date.now()}-${run.runSeed}`;
    growth.createActive(state.progress, checkpoint, runId, now, false);
    beginLevel(run);
  }

  function continueGame() {
    if (state.screen !== "home" || !state.checkpoint || state.externalChange) return;
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
    if (state.screen !== "shop" || state.externalChange) return;
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
    if (state.screen !== "shop" || state.externalChange) return;
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
    persistProgress("设置与档案已保存");
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
    if (state.screen !== "paused" || document.hidden || state.externalChange) return;
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
    if (state.unlockQueue.length) {
      state.toastSeconds -= deltaSeconds;
      if (state.toastSeconds <= 0) { state.unlockQueue.shift(); state.toastSeconds = 4; if (state.unlockQueue.length) audio.play("success"); }
    }
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
        const checkpoint = event.success ? rules.captureCheckpoint(state.run, "shop", config) : null;
        state.levelUnlocks = growth.settleLevel(state.progress, state.run, checkpoint, new Date().toISOString());
        state.screen = "result";
        persistProgress(event.success ? "本关成果与商店已保存" : "挑战已结束，档案与报告已保存");
        if (!event.success) renderReport(state.progress.profile.recentReports[0], document.getElementById("result-report"));
        state.notice = { text: "", seconds: 0 };
        stopLoop();
        audio.stopAll();
        audio.play(event.success ? "success" : "failure");
        queueUnlocks(state.levelUnlocks);
      }
    }
  }

  function element(tag, text, className = "") {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
  }
  const formatDate = value => value ? new Date(value).toLocaleString("zh-CN") : "—";
  const formatDuration = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const hitRate = totals => totals.hooksLaunched ? `${(100 * totals.hooksHit / totals.hooksLaunched).toFixed(1)}%` : "—";
  function statList(rows, container) {
    const list = element("dl", "", "profile-stats");
    for (const [label, value] of rows) { const row = element("div", ""); row.append(element("dt", label), element("dd", String(value))); list.append(row); }
    container.append(list);
  }
  function totalsRows(t) {
    return [["已通过关卡", t.levelsCleared], ["有效成绩收入", `¥ ${t.qualifiedIncome}`], ["实际回收收入", `¥ ${t.recoveredIncome}`],
      ["失败关回收收入", `¥ ${t.failedLevelIncome}`], ["有效采矿时长", formatDuration(t.activePlayMs)], ["出钩 / 命中", `${t.hooksLaunched} / ${t.hooksHit}`],
      ["命中率", hitRate(t)], ["成功回收", t.objectsRecovered], ["使用炸药 / 销毁物体", `${t.dynamiteUsed} / ${t.objectsDestroyedByDynamite}`],
      ["引爆火药桶 / 额外销毁", `${t.barrelsDetonated} / ${t.objectsDestroyedByBarrel}`], ["钱袋好运 / 坏运", `${t.bagGoodLuck} / ${t.bagBadLuck}`],
      ["宝箱最高档", t.chestTopRewards], ["实际增加时间", `${t.timeAddedMs / 1000} 秒`], ["古物实际扣时", `${t.cursedTimeLostMs / 1000} 秒`],
      ["护符抵消", t.penaltiesBlocked], ["单次最高回收", `¥ ${t.bestRecoveryValue}`]];
  }
  function renderReport(report, container) {
    container.replaceChildren();
    if (!report) return;
    if (container.id === "result-report") {
      container.append(element("p", `有效采矿 ${formatDuration(report.totals.activePlayMs)} · 命中率 ${hitRate(report.totals)} · 回收 ¥${report.totals.recoveredIncome}`));
      const details = document.createElement("details"), body = element("div", "");
      details.append(element("summary", "本次挑战报告 · 查看完整统计与新纪录"), body);
      renderReport(report, body); container.append(details); return;
    }
    container.append(element("h3", "本次挑战报告"));
    container.append(element("p", report.reason === "failed" ? `第 ${report.failure.levelId} 关未达标 · 回收 ¥${report.failure.income} / 目标 ¥${report.failure.target}` : "主动放弃 · 只记录已经结算的关卡"));
    if (!report.statisticsComplete) container.append(element("p", "升级后记录：有效成绩继承旧局，回收次数、收入与时长仅包含升级后成果。"));
    statList([["最高到达关", report.bestReachedLevel], ...totalsRows(report.totals), ["种子", report.runSeed], ["开始时间", formatDate(report.startedAt)], ["结束时间", formatDate(report.endedAt)]], container);
    const records = { bestRunIncome: "最高有效成绩", bestClearedLevel: "最高通过关", bestReachedLevel: "最高到达关" };
    container.append(element("p", `本局新纪录：${report.newRecords.map(key => records[key]).join("、") || "暂无"}`));
    container.append(element("p", `本局新徽章：${report.newAchievementIds.map(id => growth.definitions.find(def => def.id === id).title).join("、") || "暂无"}`));
  }
  function openProfile(page = "career") {
    if (state.screen === "playing") pauseGame();
    if (state.screen !== "profile") { state.profileReturn = state.screen; state.profileFocus = document.activeElement; }
    state.screen = "profile"; state.profilePage = page;
    for (const region of document.querySelectorAll(".app-header, .scene-shell, .app-footer")) region.inert = true;
    renderProfile(); updateInterface(); document.getElementById("profile-close-button").focus({ preventScroll: true });
  }
  function closeProfile() {
    state.screen = state.profileReturn;
    for (const region of document.querySelectorAll(".app-header, .scene-shell, .app-footer")) region.inert = false;
    updateInterface(); renderScene(); state.profileFocus?.focus({ preventScroll: true });
  }
  function renderProfile() {
    const content = document.getElementById("profile-content"), profile = state.progress.profile, career = profile.career;
    content.replaceChildren();
    const pageTitles = { career: "矿工档案", achievements: "成就", collection: "矿井图鉴", report: "挑战报告" };
    setText(document.getElementById("profile-title"), pageTitles[state.profilePage]);
    for (const button of document.querySelectorAll("#profile-screen [data-profile]")) button.setAttribute("aria-pressed", String(button.dataset.profile === state.profilePage));
    if (state.profilePage === "report") { renderReport(state.selectedReport || profile.recentReports[0], content); return; }
    if (state.profilePage === "career") {
      content.append(element("p", `统计始于 ${formatDate(profile.statisticsSince)}。本关成果在结算后记录，入口重试会回滚。`));
      statList([["新挑战 / 继承挑战", `${career.runsStarted} / ${career.runsImported}`], ["失败 / 主动放弃", `${career.runsFailed} / ${career.runsAbandoned}`],
        ["最高到达 / 最高通过", `${career.bestReachedLevel} / ${career.bestClearedLevel}`], ["单局最高有效成绩", `¥ ${career.bestRunIncome}`],
        ["成功关最高收入", `¥ ${career.bestLevelIncome}`], ...totalsRows(career)], content);
      content.append(element("h3", "历史记录（继承 v1.1.0）"));
      content.append(element("p", `最高有效成绩 ¥${profile.legacyRecords.highScore} · 最高通过 ${profile.legacyRecords.bestClearedLevel} 关。旧累计次数无法还原。`));
      content.append(element("h3", "分类型回收"));
      statList(growth.recoverableTypes.map(type => [config.minerals[type].label, career.recoveredByType[type]]), content);
      content.append(element("h3", "最近挑战报告"));
      if (!profile.recentReports.length) content.append(element("p", "暂无报告。挑战失败或确认放弃后记录。"));
      for (const report of profile.recentReports) {
        const button = element("button", `${formatDate(report.endedAt)} · ${report.reason === "failed" ? "失败" : "放弃"} · ¥${report.totals.qualifiedIncome}`, "button button-quiet result-home");
        button.type = "button"; button.addEventListener("click", () => { state.selectedReport = report; state.profilePage = "report"; renderProfile(); }); content.append(button);
      }
    }
    if (state.profilePage === "achievements") {
      content.append(element("p", `已解锁 ${growth.definitions.filter(def => profile.achievements[def.id].unlockedAt).length} / ${growth.definitions.length}。徽章和称号只作纪念，不改变采矿能力。`));
      const clearTitle = element("button", "卸下称号", "button button-quiet"); clearTitle.type = "button";
      clearTitle.addEventListener("click", () => { growth.equipTitle(state.progress, null); persistProgress("称号已保存"); updateInterface(); renderProfile(); }); content.append(clearTitle);
      const filters = element("div", "", "profile-filters");
      for (const [key, label, values] of [["status", "解锁状态", ["全部", "已解锁", "未解锁"]], ["category", "分类", ["全部", ...new Set(growth.definitions.map(def => def.category))]]]) {
        const control = element("label", label), select = document.createElement("select"); select.id = `achievement-${key}`;
        for (const value of values) select.append(element("option", value));
        select.value = state[`filter_${key}`] || "全部";
        select.addEventListener("change", () => { state[`filter_${key}`] = select.value; renderProfile(); document.getElementById(select.id).focus(); });
        control.append(select); filters.append(control);
      }
      content.append(filters);
      const grid = element("div", "", "profile-grid");
      for (const def of growth.definitions) {
        const item = profile.achievements[def.id], unlocked = Boolean(item.unlockedAt);
        if (state.filter_status === "已解锁" && !unlocked || state.filter_status === "未解锁" && unlocked || state.filter_category && state.filter_category !== "全部" && state.filter_category !== def.category) continue;
        const card = element("article", "", "profile-card"); card.dataset.achievement = def.id;
        const hidden = def.hidden && !unlocked;
        card.append(element("h3", hidden ? "？？？" : `${unlocked ? "◆ " : "◇ "}${def.title}`));
        card.append(element("p", `${def.rarity} · ${def.category} · ${unlocked ? "已解锁" : "未解锁"}`));
        card.append(element("p", hidden ? def.hint : def.description));
        if (!hidden) {
          const progress = document.createElement("progress"); progress.max = def.target; progress.value = item.progress; progress.setAttribute("aria-label", def.title);
          card.append(progress, element("p", `${item.progress} / ${def.target}`));
        }
        if (unlocked) {
          card.append(element("p", `徽章已获得 · ${formatDate(item.unlockedAt)}`));
          if (def.reward.title) {
            const button = element("button", profile.equippedTitleId === def.id ? `已装备：${def.reward.title}` : `装备称号：${def.reward.title}`, "button button-quiet"); button.type = "button"; button.disabled = profile.equippedTitleId === def.id;
            button.addEventListener("click", () => { growth.equipTitle(state.progress, def.id); persistProgress("称号已保存"); updateInterface(); renderProfile(); }); card.append(button);
          }
        }
        grid.append(card);
      }
      if (!grid.children.length) grid.append(element("p", "这个筛选下暂无成就。")); content.append(grid);
    }
    if (state.profilePage === "collection") {
      content.append(element("p", `已研究 ${growth.types.filter(type => profile.collection[type].researchedAt).length} / 9。奖励需实际回收后发现，火药桶需亲自引爆。`));
      const grid = element("div", "", "profile-grid");
      for (const type of growth.types) {
        const item = profile.collection[type], researched = Boolean(item.researchedAt), definition = config.minerals[type];
        const card = element("article", "", "profile-card"); card.dataset.mineral = type;
        const icon = document.createElement("canvas"); icon.width = 64; icon.height = 64; icon.className = `mineral-icon${researched ? "" : " is-unknown"}`; icon.setAttribute("aria-hidden", "true");
        drawMineral({ type, x: 32, y: 32 }, icon.getContext("2d"));
        card.append(icon, element("h3", researched ? definition.label : "？？？"));
        card.append(element("p", researched ? "已研究" : item.seen ? "已发现，尚未回收／引爆" : "未发现"));
        card.append(element("p", `已发现 ${item.seen} 件 · ${type === "powderKeg" ? `已引爆 ${item.detonated} 次` : `已回收 ${item.recovered} 件`}`));
        if (researched) {
          const details = document.createElement("details"); details.append(element("summary", "查看物体详情"));
          const notes = { ruby: "不受钻石增值剂影响。", mysteryBag: "金币、炸药或时间；满炸药转基础 ¥100，基础档位不变。", treasureChest: "基础金币 150 / 450 / 800，幸运符改变概率。", cursedRelic: "完整收回后 −5 秒，护身符可抵消；扣至零立刻结算。", powderKeg: "钩尖碰到立即爆炸，范围 80 像素，无连锁；范围销毁无收益、不消耗炸药或护符。" };
          details.append(element("p", `${type === "powderKeg" ? "不可回收" : `基础价值 ¥${definition.value} · 回收速度 ${definition.returnSpeed}`}。金币随关卡倍率与对应增值剂修正，时间与道具数量不放大。${notes[type] || "完整收回才入账。"}`));
          statList([["炸药销毁", item.destroyedByDynamite], ["桶范围销毁（包含触发桶）", item.destroyedByBarrel], ["首次发现", formatDate(item.firstSeenAt)], ["首次研究", formatDate(item.researchedAt)]], details);
          if (growth.rewardIds[type]) {
            const labels = { coins_50: "金币 50", coins_200: "金币 200", bomb_1: "炸药 +1", time_plus_5: "时间 +5 秒", time_minus_5: "时间 −5 秒", coins_150: "金币 150", coins_450: "金币 450", coins_800: "金币 800" };
            details.append(element("p", `已发现奖励 ${item.rewardIds.length} / ${growth.rewardIds[type].length}：${item.rewardIds.map(id => labels[id]).join("、") || "暂无"}`));
          }
          card.append(details);
        }
        grid.append(card);
      }
      content.append(grid);
    }
  }
  function handleExternalChange() {
    state.externalChange = true;
    // 外部修订到来时直接冻结，不能在暂停前补算并提交过期的本关。
    stopLoop(); audio.stopAll();
    if (state.screen === "playing") { state.screen = "paused"; state.pauseReason = "external"; }
    state.saveError = true; state.saveMessage = "其他页面已更新档案，当前页面已冻结。请重新载入最新档案；首发不支持多页面同时游玩。";
    updateInterface();
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

  function fill(color, x, y, width, height, surface = context) {
    surface.fillStyle = color;
    surface.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function polygon(color, points, surface = context) {
    surface.fillStyle = color;
    surface.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) surface.moveTo(Math.round(x), Math.round(y));
      else surface.lineTo(Math.round(x), Math.round(y));
    });
    surface.closePath();
    surface.fill();
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

  function drawMineral(mineral, surface = context) {
    const rect = (...args) => fill(...args, surface);
    const shape = (...args) => polygon(...args, surface);
    const { x, y, type } = mineral;
    const definition = config.minerals[type];
    if (type === "diamond" || type === "ruby") {
      const halfWidth = definition.width / 2;
      const halfHeight = definition.height / 2;
      const gem = type === "ruby" ? ["#dc5261", "#ffbcc3", "#933347"] : [colors.diamond, colors.diamondLight, colors.diamondShadow];
      shape(gem[0], [[x, y - halfHeight], [x + halfWidth, y], [x, y + halfHeight], [x - halfWidth, y]]);
      shape(gem[1], [[x, y - halfHeight], [x, y + 2], [x - halfWidth, y]]);
      shape(gem[2], [[x, y + 2], [x + halfWidth, y], [x, y + halfHeight]]);
      if (Math.floor(state.visuals.time * 3 + x) % 5 === 0) {
        rect(colors.diamondLight, x - 2, y - halfHeight - 4, 4, 8);
        rect(colors.diamondLight, x - 4, y - halfHeight - 2, 8, 4);
      }
      return;
    }
    if (type === "mysteryBag") {
      rect(colors.goldShadow, x - 7, y - 14, 14, 6);
      rect(colors.wood, x - 12, y - 5, 24, 17);
      rect(colors.goldLight, x - 8, y - 4, 7, 13);
      rect(colors.dark, x - 8, y - 8, 16, 3);
      rect(colors.dark, x + 2, y + 2, 5, 3);
      rect(colors.dark, x + 4, y + 7, 3, 3);
      return;
    }
    if (type === "treasureChest") {
      rect(colors.woodShadow, x - 17, y - 14, 34, 28);
      rect(colors.wood, x - 15, y - 12, 30, 12);
      rect(colors.gold, x - 17, y - 2, 34, 4);
      rect(colors.goldShadow, x - 12, y - 14, 4, 28);
      rect(colors.goldShadow, x + 8, y - 14, 4, 28);
      rect(colors.goldLight, x - 3, y - 1, 6, 8);
      return;
    }
    if (type === "cursedRelic") {
      rect("#695681", x - 9, y - 15, 18, 9);
      rect("#9c79af", x - 13, y - 6, 26, 17);
      rect("#493855", x - 10, y + 11, 20, 4);
      rect("#ff9178", x - 7, y - 3, 4, 5);
      rect("#ff9178", x + 3, y - 3, 4, 5);
      rect(colors.dark, x - 4, y + 6, 8, 3);
      return;
    }
    if (type === "powderKeg") {
      rect(colors.woodShadow, x - 11, y - 14, 22, 31);
      rect(colors.shirt, x - 13, y - 11, 26, 25);
      rect(colors.stoneLight, x - 13, y - 9, 26, 3);
      rect(colors.stoneLight, x - 13, y + 10, 26, 3);
      rect(colors.goldLight, x - 2, y - 17, 4, 5);
      rect(colors.goldLight, x - 2, y - 2, 4, 6);
      rect(colors.goldLight, x - 2, y + 6, 4, 2);
      return;
    }
    const r = definition.radius;
    const isStone = type === "stone";
    const base = isStone ? colors.stone : colors.gold;
    const shadow = isStone ? colors.stoneShadow : colors.goldShadow;
    const light = isStone ? colors.stoneLight : colors.goldLight;
    shape(shadow, [[x - r, y - r * .3], [x - r * .6, y - r * .8], [x + r * .5, y - r], [x + r, y - r * .2], [x + r * .7, y + r * .7], [x, y + r], [x - r * .8, y + r * .6]]);
    shape(base, [[x - r, y - r * .3], [x - r * .6, y - r * .8], [x + r * .5, y - r], [x + r * .7, y + r * .4], [x - r * .6, y + r * .5]]);
    rect(light, x - r * .5, y - r * .45, r * .65, Math.max(4, r * .2));
    rect(shadow, x + r * .15, y + r * .1, r * .3, Math.max(4, r * .2));
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
  for (const button of document.querySelectorAll("[data-profile]")) button.addEventListener("click", () => openProfile(button.dataset.profile));
  document.getElementById("profile-close-button").addEventListener("click", closeProfile);
  document.getElementById("latest-report-button").addEventListener("click", () => { state.selectedReport = null; openProfile("report"); });
  document.getElementById("reload-progress-button").addEventListener("click", () => window.location.reload());
  document.getElementById("next-achievement-button").addEventListener("click", () => {
    state.unlockQueue.shift(); state.toastSeconds = 4;
    if (state.unlockQueue.length) audio.play("success"); updateInterface();
  });
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
    if (state.screen === "profile") {
      if (event.code === "Escape") { event.preventDefault(); if (!event.repeat) closeProfile(); }
      if (event.code === "Tab") {
        const controls = [...document.querySelectorAll("#profile-screen button:not(:disabled), #profile-screen select, #profile-screen summary")].filter(node => node.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
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
  window.addEventListener("storage", event => {
    if (event.key !== preferencesStore.progressKey && event.key !== null) return;
    try { if (event.newValue === null || JSON.parse(event.newValue).revision !== state.revision) handleExternalChange(); }
    catch { handleExternalChange(); }
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
        progress: growth.clone(state.progress),
        externalChange: state.externalChange,
        levelUnlocks: [...state.levelUnlocks],
        saveError: state.saveError,
        saveMessage: state.saveMessage,
      };
    },
  });

  updateInterface();
  renderScene();
})();
