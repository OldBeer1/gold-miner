(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerChallenges = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const version = "1.5.2";
  const supportedVersions = Object.freeze(["1.4.0", "1.5.0", "1.5.1", version]);
  const modes = Object.freeze(["endless", "seed", "daily"]);
  const names = Object.freeze({ endless: "无限生存", seed: "Seed 挑战", daily: "每日挑战" });
  const limit = 20;
  function normalizeSeed(value) {
    const text = String(value).trim();
    if (!/^\d{1,10}$/.test(text)) return null;
    const seed = Number(text);
    return Number.isInteger(seed) && seed <= 0xffffffff ? seed : null;
  }
  function dailyDate(now = Date.now()) {
    const instant = new Date(now).getTime();
    if (!Number.isFinite(instant)) throw new Error("无效日期");
    return new Date(instant + 8 * 3600000).toISOString().slice(0, 10);
  }
  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  }
  // UTF-8 FNV-1a，固定规则版本和用途；不受操作系统时区、页面行为影响。
  function hash(text) {
    let value = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(text)) value = Math.imul(value ^ byte, 0x01000193) >>> 0;
    return value;
  }
  function dailySeed(date, rulesVersion = version) {
    if (!validDate(date)) throw new Error("无效每日日期");
    return hash(`gold-miner|daily|${rulesVersion}|${date}`);
  }
  function create(mode = "endless", seed = 0, date = null, rulesVersion = version) {
    if (!modes.includes(mode) || normalizeSeed(seed) === null) throw new Error("无效挑战参数");
    if (mode === "daily") { if (!validDate(date)) throw new Error("无效每日日期"); seed = dailySeed(date, rulesVersion); }
    return { mode, seed: Number(seed), date: mode === "daily" ? date : null, rulesVersion, levelLimit: mode === "endless" ? null : limit };
  }
  function valid(value, rulesVersion = version) {
    return value && modes.includes(value.mode) && value.rulesVersion === rulesVersion
      && Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff
      && value.levelLimit === (value.mode === "endless" ? null : limit)
      && (value.mode === "daily" ? validDate(value.date) && value.seed === dailySeed(value.date, rulesVersion) : value.date === null);
  }
  function key(challenge) { return `${challenge.mode}|${challenge.rulesVersion}|${challenge.mode === "daily" ? challenge.date : challenge.seed}`; }
  function generationSeed(challenge) { return challenge.mode === "endless" ? challenge.seed : hash(`${challenge.mode}|${challenge.rulesVersion}|${challenge.seed}`); }
  function better(candidate, previous) {
    return !previous || candidate.levelsCleared > previous.levelsCleared
      || candidate.levelsCleared === previous.levelsCleared && (candidate.qualifiedIncome > previous.qualifiedIncome
        || candidate.qualifiedIncome === previous.qualifiedIncome && candidate.activePlayMs < previous.activePlayMs);
  }
  function share(report) {
    const challenge = report.challenge || create("endless", report.runSeed, null, report.rulesetVersion);
    return `黄金矿工 · ${names[challenge.mode]}${challenge.date ? ` · ${challenge.date}（UTC+8）` : ""}\nSeed：${challenge.seed}\n规则：${challenge.rulesVersion}\n通过：${report.totals.levelsCleared}${challenge.levelLimit ? `/${challenge.levelLimit}` : ""} 关 · 有效成绩 ¥${report.totals.qualifiedIncome}\n有效采矿：${(report.totals.activePlayMs / 1000).toFixed(1)} 秒`;
  }
  return Object.freeze({ version, supportedVersions, modes, names, limit, normalizeSeed, dailyDate, dailySeed, validDate, hash, create, valid, key, generationSeed, better, share });
});
