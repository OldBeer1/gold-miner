(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./growth.js"), require("./rules.js"), require("./challenges.js"));
  else root.GoldMinerStorage = factory(root.GoldMinerGrowth, root.GoldMinerRules, root.GoldMinerChallenges);
})(typeof window !== "undefined" ? window : globalThis, function (growth, rules, challenges) {
  "use strict";
  const key = "gold-miner.survival.preferences.v2";
  const previousKey = "gold-miner.survival.preferences.v1";
  const legacyKey = "gold-miner.preferences.v1";
  const checkpointKey = "gold-miner.survival.checkpoint.v1";
  const progressKey = "gold-miner.survival.progress.v1";
  const v120BackupKey = "gold-miner.survival.progress.backup.v120";

  function validatePreferences(value) {
    const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      soundEnabled: typeof data.soundEnabled === "boolean" ? data.soundEnabled : true,
      highScore: Number.isSafeInteger(data.highScore) && data.highScore >= 0 ? data.highScore : 0,
      bestClearedLevel: Number.isSafeInteger(data.bestClearedLevel) && data.bestClearedLevel >= 0 ? data.bestClearedLevel : 0,
    };
  }

  function loadPreferences(source) {
    try {
      const storage = typeof source === "function" ? source() : source;
      const current = storage.getItem(key);
      if (current !== null) return validatePreferences(JSON.parse(current));
      const legacy = validatePreferences(JSON.parse(storage.getItem(previousKey) ?? storage.getItem(legacyKey)));
      return validatePreferences({ soundEnabled: legacy.soundEnabled });
    } catch {
      return validatePreferences(null);
    }
  }

  function savePreferences(source, preferences) {
    try {
      const storage = typeof source === "function" ? source() : source;
      storage.setItem(key, JSON.stringify(validatePreferences(preferences)));
      return true;
    } catch {
      return false;
    }
  }

  function highScoreAfterRun(current, run) {
    const previous = validatePreferences({ highScore: current }).highScore;
    if (!run.settled || !run.result?.success || !Number.isSafeInteger(run.totalIncome) || run.totalIncome < 0) return previous;
    return Math.max(previous, run.totalIncome);
  }

  function validateCheckpoint(value, config) {
    const object = data => data && typeof data === "object" && !Array.isArray(data);
    const money = number => Number.isSafeInteger(number) && number >= 0;
    const effectKeys = Object.keys(config.shop).filter(item => item !== "dynamite");
    const validEffects = data => object(data) && Object.keys(data).length === effectKeys.length
      && effectKeys.every(item => typeof data[item] === "boolean");
    if (!object(value) || value.schemaVersion !== 1 || value.rulesVersion !== config.version
      || !["level", "shop"].includes(value.kind) || !object(value.run)) return null;
    const run = value.run;
    const level = run.level;
    if (!Number.isSafeInteger(run.levelId) || run.levelId < 1 || !Number.isInteger(run.runSeed)
      || run.runSeed < 0 || run.runSeed > 0xffffffff || !object(level) || level.id !== run.levelId
      || !money(level.target) || level.target === 0 || level.duration !== config.levelDuration
      || !Array.isArray(level.layout) || level.layout.length < 1 || level.layout.length > 40
      || !money(run.wallet) || !money(run.totalIncome) || run.wallet > run.totalIncome
      || !Number.isInteger(run.bombs) || run.bombs < 0 || run.bombs > config.shop.dynamite.maxInventory
      || !validEffects(run.effects)) return null;
    if (level.rewardScale !== undefined && (!Number.isFinite(level.rewardScale) || level.rewardScale < 1 || level.rewardScale > 1000)) return null;
    if (config.version === "1.4.0") {
      if (!challenges.valid(run.challenge) || run.challenge.seed !== run.runSeed || run.challenge.levelLimit && run.levelId > run.challenge.levelLimit) return null;
      if (level.event) {
        const event = config.events.definitions[level.event.id];
        if (!event || Object.keys(level.event).length !== Object.keys(event).length + 1 || Object.entries(event).some(([key, entry]) => level.event[key] !== entry)) return null;
        if (level.event.id !== "none") {
          const parameters = rules.eventParameters(config, run.levelId, rules.resolveEvent(config, level.event.id));
          if (level.target !== parameters.target || level.rewardScale !== parameters.rewardScale || level.layout.length !== parameters.count) return null;
        }
      }
    }
    const ids = new Set();
    for (const mineral of level.layout) {
      if (!object(mineral) || typeof mineral.id !== "string" || !mineral.id.length || mineral.id.length > 80
        || ids.has(mineral.id) || !Object.hasOwn(config.minerals, mineral.type)
        || !Number.isFinite(mineral.x) || !Number.isFinite(mineral.y)
        || mineral.rewardRoll !== undefined && (!Number.isFinite(mineral.rewardRoll) || mineral.rewardRoll < 0 || mineral.rewardRoll >= 1)) return null;
      const definition = config.minerals[mineral.type];
      const radius = definition.radius || Math.hypot(definition.width / 2, definition.height / 2);
      if (mineral.x - radius < config.mine.x || mineral.x + radius > config.mine.x + config.mine.width
        || mineral.y - radius < config.mine.y || mineral.y + radius > config.mine.y + config.mine.height) return null;
      const angle = Math.atan2(mineral.x - config.miner.anchor.x, mineral.y - config.miner.anchor.y) * 180 / Math.PI;
      if (angle < config.hook.minAngle || angle > config.hook.maxAngle) return null;
      for (const other of level.layout) {
        if (other === mineral || !object(other) || !Object.hasOwn(config.minerals, other.type)) continue;
        const shape = config.minerals[other.type];
        const otherRadius = shape.radius || Math.hypot(shape.width / 2, shape.height / 2);
        if (Math.hypot(mineral.x - other.x, mineral.y - other.y) < radius + otherRadius + 8) return null;
      }
      ids.add(mineral.id);
    }
    if (value.kind === "shop") {
      const shop = value.shop;
      if (!object(shop) || shop.nextLevelId !== run.levelId + 1 || !Number.isSafeInteger(shop.nextLevelId)
        || !Array.isArray(shop.offers) || shop.offers.length !== config.survival.shopSlots
        || shop.offers[0] !== "dynamite" || new Set(shop.offers).size !== shop.offers.length
        || !shop.offers.every(item => Object.hasOwn(config.shop, item)) || !object(shop.prices)
        || !shop.offers.every(item => money(shop.prices[item]) && shop.prices[item] > 0)
        || !Number.isInteger(shop.purchaseCount) || shop.purchaseCount < 0 || shop.purchaseCount > config.survival.maxPurchases
        || !validEffects(shop.effects) || effectKeys.filter(item => shop.effects[item]).length > shop.purchaseCount
        || effectKeys.some(item => shop.effects[item] && !shop.offers.includes(item))
        || !money(run.levelIncome) || run.levelIncome < level.target || run.totalIncome < run.levelIncome
        || !object(run.result) || run.result.success !== true || run.result.target !== level.target
        || run.result.levelIncome !== run.levelIncome || run.result.totalIncome !== run.totalIncome
        || effectKeys.some(item => run.effects[item])) return null;
      if (config.version === "1.4.0") {
        if (run.challenge.levelLimit === run.levelId || !object(shop.nextLevel) || shop.nextLevel.id !== shop.nextLevelId) return null;
        const next = { schemaVersion: 1, rulesVersion: config.version, kind: "level", run: { ...run, levelId: shop.nextLevelId, level: shop.nextLevel, effects: shop.effects } };
        if (!validateCheckpoint(next, config)) return null;
      }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function loadCheckpoint(source, config) {
    let text;
    try {
      const storage = typeof source === "function" ? source() : source;
      text = storage.getItem(checkpointKey);
    } catch {
      return { checkpoint: null, hasData: false, message: "无法读取存档，请检查浏览器保存权限。" };
    }
    if (text === null) return { checkpoint: null, hasData: false, message: "" };
    try {
      if (text.length > 100000) throw new Error("oversized checkpoint");
      const checkpoint = validateCheckpoint(JSON.parse(text), config);
      return { checkpoint, hasData: true, message: checkpoint ? "" : "存档损坏或版本不兼容，请开始新挑战。" };
    } catch {
      return { checkpoint: null, hasData: true, message: "存档损坏或版本不兼容，请开始新挑战。" };
    }
  }

  function saveCheckpoint(source, checkpoint, config) {
    try {
      const validated = validateCheckpoint(checkpoint, config);
      if (!validated) return false;
      const storage = typeof source === "function" ? source() : source;
      storage.setItem(checkpointKey, JSON.stringify(validated));
      return true;
    } catch { return false; }
  }

  function clearCheckpoint(source) {
    try {
      const storage = typeof source === "function" ? source() : source;
      storage.removeItem(checkpointKey);
      return true;
    } catch { return false; }
  }

  function validateProgress(value, config) {
    const data = growth.clone(value);
    if (!growth.validateDocument(data, config.version)) return null;
    const active = data.activeRun;
    if (active) {
      const checkpoint = validateCheckpoint(active.checkpoint, config);
      if (!checkpoint || checkpoint.run.runSeed !== active.runSeed
        || active.committedThroughLevel !== checkpoint.run.levelId - (checkpoint.kind === "level" ? 1 : 0)
        || checkpoint.kind === "level" && active.entryCountedForLevel !== checkpoint.run.levelId
        || active.bestReachedLevel < checkpoint.run.levelId || active.runTotals.qualifiedIncome !== checkpoint.run.totalIncome
        || config.version === "1.4.0" && JSON.stringify(active.challenge) !== JSON.stringify(checkpoint.run.challenge)) return null;
      active.checkpoint = checkpoint;
    }
    return data;
  }

  function adaptV110Checkpoint(value, config) {
    // v1.2 没有改变关卡数值，仍显式按旧版本校验，再复制兼容的入口/交易字段。
    const old = validateCheckpoint(value, { ...config, version: "1.1.0" });
    if (!old) return null;
    const source = old.run;
    const run = { levelId: source.levelId, runSeed: source.runSeed, level: source.level, wallet: source.wallet,
      bombs: source.bombs, totalIncome: source.totalIncome, effects: source.effects };
    if (old.kind === "shop") { run.levelIncome = source.levelIncome; run.result = source.result; }
    const checkpoint = { schemaVersion: 1, rulesVersion: config.version, kind: old.kind, run };
    if (old.kind === "shop") checkpoint.shop = old.shop;
    return adaptCheckpoint(checkpoint, config);
  }

  function adaptCheckpoint(value, config) {
    const checkpoint = growth.clone(value);
    checkpoint.rulesVersion = config.version;
    checkpoint.run.challenge = challenges.create("endless", checkpoint.run.runSeed, null, config.version);
    // 升级时保留当前布局与已支付交易；旧商店的下一关也使用普通矿层。
    checkpoint.run.level.event = { id: "none", ...config.events.definitions.none };
    if (checkpoint.kind === "shop") checkpoint.shop.nextLevel = rules.createLevel(config, checkpoint.shop.nextLevelId, checkpoint.run.runSeed, "none");
    return validateCheckpoint(checkpoint, config);
  }

  function adaptV120Progress(value, config) {
    const old = validateProgress(value, { ...config, version: "1.2.0" });
    if (!old) return null;
    const fresh = growth.createDocument({ soundEnabled: old.settings.soundEnabled, highScore: 0, bestClearedLevel: 0 }, old.profile.statisticsSince);
    old.rulesVersion = config.version;
    old.profile.modeStats = fresh.profile.modeStats;
    old.profile.modeStats.endless = growth.clone(old.profile.career);
    old.profile.challengeRecords = {};
    old.profile.endlessChestRewardIds = [...old.profile.collection.treasureChest.rewardIds];
    if (old.activeRun) {
      const checkpoint = adaptCheckpoint(old.activeRun.checkpoint, config);
      if (!checkpoint) return null;
      old.activeRun.checkpoint = checkpoint;
      old.activeRun.challenge = growth.clone(checkpoint.run.challenge);
      old.activeRun.rulesetVersion = config.version;
      old.activeRun.eventCounts = {};
    }
    return validateProgress(old, config);
  }

  function saveProgress(source, document, config, expectedRevision) {
    try {
      const storage = typeof source === "function" ? source() : source;
      const current = storage.getItem(progressKey);
      const currentDocument = current === null ? null : JSON.parse(current);
      if (currentDocument !== null && !validateProgress(currentDocument, config)
        && !(currentDocument.rulesVersion === "1.2.0" && adaptV120Progress(currentDocument, config))) return { saved: false, conflict: true, message: "磁盘档案损坏或版本不兼容，已保留原数据，请重新载入。" };
      const revision = currentDocument === null ? null : currentDocument.revision;
      if (revision !== expectedRevision) return { saved: false, conflict: true, message: "其他页面已更新档案，请重新载入。" };
      const candidate = growth.clone(document);
      candidate.revision = (expectedRevision ?? 0) + 1;
      const validated = validateProgress(candidate, config);
      if (!validated) return { saved: false, message: "档案校验失败：本次进度仅在当前页面保留。" };
      if (currentDocument?.rulesVersion === "1.2.0" && storage.getItem(v120BackupKey) === null) storage.setItem(v120BackupKey, current);
      storage.setItem(progressKey, JSON.stringify(validated));
      return { saved: true, revision: validated.revision };
    } catch {
      return { saved: false, message: "保存失败：本次未能保存，关闭后旧进度、统计或报告可能仍可恢复。" };
    }
  }

  function loadProgress(source, config, now = new Date().toISOString()) {
    const preferences = loadPreferences(source);
    const fresh = () => growth.createDocument(preferences, now);
    let storage, text;
    try { storage = typeof source === "function" ? source() : source; text = storage.getItem(progressKey); }
    catch { return { document: fresh(), revision: null, blocked: true, message: "无法读取档案：本次只能临时游玩，关闭后无法保证恢复。" }; }
    if (text !== null) {
      try {
        if (text.length > 300000) throw new Error("oversized progress");
        const raw = JSON.parse(text);
        const document = raw.rulesVersion === "1.2.0" && config.version === "1.4.0" ? adaptV120Progress(raw, config) : validateProgress(raw, config);
        if (!document) throw new Error("invalid progress");
        if (raw.rulesVersion !== config.version) {
          const saved = saveProgress(storage, document, config, raw.revision);
          if (saved.saved) document.revision = saved.revision;
          return { document, revision: saved.saved ? saved.revision : raw.revision, blocked: false, message: saved.saved ? "v1.2.0 档案已迁入，当前布局与交易保留。" : saved.message };
        }
        return { document, revision: document.revision, blocked: false, message: "" };
      } catch {
        return { document: fresh(), revision: null, blocked: true, message: "档案损坏或版本不兼容，已保留原数据。本次可临时游玩，不能保存；请检查备份。" };
      }
    }
    const document = fresh();
    growth.evaluate(document, null, now, true);
    let migrationMessage = "";
    try {
      const oldText = storage.getItem(checkpointKey);
      if (oldText !== null) {
        const checkpoint = oldText.length <= 100000 ? adaptV110Checkpoint(JSON.parse(oldText), config) : null;
        if (checkpoint) {
          growth.createActive(document, checkpoint, `legacy-${checkpoint.run.runSeed}-${checkpoint.run.levelId}-${checkpoint.kind}`, now, true);
          if (checkpoint.kind === "level") growth.enterLevel(document, checkpoint, now);
          migrationMessage = "旧挑战已迁入，次数与时长从升级后记录。";
        } else migrationMessage = "旧挑战损坏或不兼容，原数据已保留。";
      }
    } catch { migrationMessage = "旧挑战无法读取，原数据已保留。"; }
    const saved = saveProgress(storage, document, config, null);
    if (saved.saved) document.revision = saved.revision;
    return { document, revision: saved.saved ? saved.revision : null, blocked: false,
      message: saved.saved ? migrationMessage : `${migrationMessage} ${saved.message}`.trim() };
  }

  return Object.freeze({ key, previousKey, legacyKey, checkpointKey, validatePreferences, loadPreferences, savePreferences,
    highScoreAfterRun, validateCheckpoint, loadCheckpoint, saveCheckpoint, clearCheckpoint,
    progressKey, v120BackupKey, validateProgress, adaptV110Checkpoint, adaptV120Progress, saveProgress, loadProgress });
});
