(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerStorage = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const key = "gold-miner.survival.preferences.v2";
  const previousKey = "gold-miner.survival.preferences.v1";
  const legacyKey = "gold-miner.preferences.v1";
  const checkpointKey = "gold-miner.survival.checkpoint.v1";

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

  return Object.freeze({ key, previousKey, legacyKey, checkpointKey, validatePreferences, loadPreferences, savePreferences,
    highScoreAfterRun, validateCheckpoint, loadCheckpoint, saveCheckpoint, clearCheckpoint });
});
