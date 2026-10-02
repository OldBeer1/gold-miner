(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerStorage = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const key = "gold-miner.survival.preferences.v1";
  const legacyKey = "gold-miner.preferences.v1";

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
      const legacy = validatePreferences(JSON.parse(storage.getItem(legacyKey)));
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

  return Object.freeze({ key, legacyKey, validatePreferences, loadPreferences, savePreferences, highScoreAfterRun });
});
