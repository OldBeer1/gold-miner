(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./challenges.js"));
  else root.GoldMinerGrowth = factory(root.GoldMinerChallenges);
})(typeof window !== "undefined" ? window : globalThis, function (challenges) {
  "use strict";
  const types = Object.freeze(["smallGold", "largeGold", "stone", "diamond", "ruby", "mysteryBag", "treasureChest", "cursedRelic", "powderKeg"]);
  // v1.2 收藏成就固定八类；未来图鉴扩展不能增加这个成就的要求。
  const recoverableTypes = Object.freeze(["smallGold", "largeGold", "stone", "diamond", "ruby", "mysteryBag", "treasureChest", "cursedRelic"]);
  const rewardIds = Object.freeze({ mysteryBag: ["coins_50", "coins_200", "bomb_1", "time_plus_5", "time_minus_5"], treasureChest: ["coins_150", "coins_450", "coins_800"] });
  const historicalDefinitions = Object.freeze([
    ["first_clear", "开工大吉", "进度", "普通", 1, "正式通过第 1 关"],
    ["clear_5", "初出茅庐", "进度", "普通", 5, "正式通过第 5 关"],
    ["clear_20", "老练矿工", "进度", "稀有", 20, "正式通过第 20 关", false, "老练矿工"],
    ["reach_50", "矿井深处", "进度", "史诗", 50, "实际进入第 50 关", false, "深井探索者"],
    ["level_income_5000", "第一桶金", "收入", "稀有", 5000, "成功关收入达到 ¥5000"],
    ["career_income_100000", "矿业新贵", "累计", "稀有", 100000, "升级后累计有效成绩达到 ¥100000", false, "矿业新贵"],
    ["recover_streak_5", "精准捕获", "技巧", "稀有", 5, "同一关连续 5 次出钩成功回收"],
    ["perfect_level", "钩无虚发", "技巧", "史诗", 8, "成功关至少出钩 8 次，每次都成功回收", false, "神钩手"],
    ["last_second_target", "压哨达标", "极限", "稀有", 1, "首次达标时剩余大于 0 且不超过 1 秒，并通关"],
    ["no_assistance_clear", "白手起家", "克制", "普通", 1, "入关无商店增益、不使用炸药并通关"],
    ["blast_four", "爆破专家", "爆炸", "稀有", 4, "一次火药桶爆炸额外销毁 4 个物体", false, "爆破专家"],
    ["dynamite_ten", "果断清障", "累计", "普通", 10, "累计成功使用炸药 10 次"],
    ["penalty_twice", "祸不单行", "风险", "稀有", 2, "同一关连续两次回收实际损失时间"],
    ["lucky_streak_3", "欧皇", "幸运", "史诗", 3, "同一关连续三个容器为钱袋基础 ¥200 或宝箱基础 ¥800"],
    ["recover_all_v120", "地下收藏家", "收集", "史诗", 8, "成功回收全部 8 类可回收物", false, "地下收藏家"],
    ["chest_all_rewards", "宝箱研究员", "收集", "稀有", 3, "回收宝箱并发现全部 3 档基础奖励"],
    ["last_second_rescue", "这也能活？", "极限", "史诗", 1, "奖励前最后一秒实际获得加时，并通关", true],
    ["charm_rescue", "有备无患", "风险", "稀有", 1, "最后 5 秒护身符抵消惩罚，并通关", true],
  ].map(([id, title, category, rarity, target, description, hidden = false, rewardTitle = null]) => Object.freeze({
    id, title, category, rarity, target, description, hidden, hint: "在危急时刻，抓住一线生机。", conditionVersion: 1,
    modes: ["endless"], reward: { badge: id, title: rewardTitle },
  })));
  const retiredIds = new Set(["clear_20", "reach_50", "level_income_5000", "career_income_100000", "perfect_level", "last_second_target", "blast_four", "penalty_twice", "lucky_streak_3", "chest_all_rewards", "last_second_rescue", "charm_rescue"]);
  const additions = [
    ["first_recovery", "第一份收获", "收集", 1, "首次成功回收任意物体"],
    ["gold_recovered_10", "小有金山", "累计", 10, "累计成功回收 10 块金块"],
    ["diamond_recovered_5", "闪闪发光", "累计", 5, "累计成功回收 5 颗钻石"],
    ["objects_recovered_30", "勤劳矿工", "累计", 30, "累计成功回收 30 个物体"],
    ["level_income_1200", "收获颇丰", "收入", 1200, "一个成功关收入达到 ¥1200"],
    ["clear_10", "稳步深入", "进度", 10, "正式通过第 10 关"],
    ["career_income_5000", "积少成多", "累计", 5000, "累计有效成绩达到 ¥5000"],
  ].map(([id, title, category, target, description]) => Object.freeze({ id, title, category, rarity: target <= 10 ? "普通" : "稀有", target,
    description, hidden: false, hint: "", conditionVersion: 1, modes: ["endless"], reward: { badge: id, title: id === "clear_10" ? "稳步深入" : null } }));
  const definitions = Object.freeze([...historicalDefinitions.filter(def => !retiredIds.has(def.id)), ...additions]);
  const retiredDefinitions = Object.freeze(historicalDefinitions.filter(def => retiredIds.has(def.id)));
  const allDefinitions = Object.freeze([...historicalDefinitions, ...additions]);
  const reportLimit = 10;
  const sumKeys = Object.freeze(["levelsCleared", "qualifiedIncome", "recoveredIncome", "failedLevelIncome", "hooksLaunched", "hooksHit", "objectsRecovered", "dynamiteUsed", "objectsDestroyedByDynamite", "barrelsDetonated", "objectsDestroyedByBarrel", "bagGoodLuck", "bagBadLuck", "chestTopRewards", "timeAddedMs", "cursedTimeLostMs", "penaltiesBlocked", "activePlayMs"]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const counts = () => Object.fromEntries(types.map(type => [type, 0]));
  const integer = number => Number.isSafeInteger(number) && number >= 0;
  const date = value => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
  const idValid = value => typeof value === "string" && value.length > 0 && value.length <= 100;
  const object = value => value && typeof value === "object" && !Array.isArray(value);

  function totals() { return { ...Object.fromEntries(sumKeys.map(key => [key, 0])), bestRecoveryValue: 0, recoveredByType: counts() }; }
  function collectionEntry() { return { seen: 0, recovered: 0, destroyedByDynamite: 0, destroyedByBarrel: 0, detonated: 0, firstSeenAt: null, researchedAt: null, rewardIds: [] }; }
  function createDocument(preferences, now) {
    const document = { schemaVersion: 1, rulesVersion: challenges.version, revision: 0, settings: { soundEnabled: preferences.soundEnabled },
      profile: { statisticsSince: now, legacyRecords: { source: "preferences.v2", highScore: preferences.highScore, bestClearedLevel: preferences.bestClearedLevel },
        career: { ...totals(), runsStarted: 0, runsImported: 0, runsFailed: 0, runsAbandoned: 0, bestReachedLevel: 0,
          bestClearedLevel: preferences.bestClearedLevel, bestRunIncome: preferences.highScore, bestLevelIncome: 0 },
        achievements: Object.fromEntries(allDefinitions.map(def => [def.id, { progress: 0, unlockedAt: null, unlockedRunId: null }])),
        collection: Object.fromEntries(types.map(type => [type, collectionEntry()])), equippedTitleId: null, recentReports: [] }, activeRun: null };
    document.profile.modeStats = Object.fromEntries(challenges.modes.map(mode => [mode, mode === "endless" ? clone(document.profile.career) : { ...totals(), runsStarted: 0, runsImported: 0, runsFailed: 0, runsAbandoned: 0, bestReachedLevel: 0, bestClearedLevel: 0, bestRunIncome: 0, bestLevelIncome: 0 }]));
    document.profile.challengeRecords = {};
    document.profile.endlessChestRewardIds = [];
    return document;
  }
  function createLevelStats(run) {
    return { ...totals(), seenBanked: [], seenDestroyed: [], hookHit: false, hookRecovered: false, hookOpen: false,
      recoveryStreak: 0, bestRecoveryStreak: 0, penaltyStreak: 0, bestPenaltyStreak: 0, luckyStreak: 0, bestLuckyStreak: 0,
      maxBlastOthers: 0, targetTime: null, lastSecondRescue: false, charmRescue: false,
      entryAssisted: Object.values(run.effects).some(Boolean), collection: Object.fromEntries(types.map(type => [type, collectionEntry()])), sealed: false };
  }
  function rewardId(reward) {
    if (!reward) return null;
    return reward.kind === "time" ? reward.amount > 0 ? "time_plus_5" : "time_minus_5" : `${reward.kind}_${reward.amount}`;
  }
  function recordEvent(run, event) {
    const stats = run.growth;
    if (!stats || stats.sealed) return;
    const markHit = () => { if (!stats.hookHit) { stats.hooksHit += 1; stats.hookHit = true; } };
    if (event.type === "launched") {
      stats.hooksLaunched += 1; stats.hookHit = false; stats.hookRecovered = false; stats.hookOpen = true;
    }
    if (event.type === "grabbed") markHit();
    if (event.type === "empty-returned") { stats.recoveryStreak = 0; stats.hookOpen = false; }
    if (event.type === "destroyed" && !stats.seenDestroyed.includes(event.id)) {
      stats.seenDestroyed.push(event.id); stats.dynamiteUsed += 1; stats.objectsDestroyedByDynamite += 1;
      stats.collection[event.mineralType].destroyedByDynamite += 1; stats.recoveryStreak = 0;
    }
    if (event.type === "exploded") {
      if (stats.seenDestroyed.includes(event.id)) return;
      markHit(); stats.recoveryStreak = 0; stats.barrelsDetonated += 1; stats.collection.powderKeg.detonated += 1;
      const others = [...new Set(event.destroyedIds)].filter(id => id !== event.id);
      stats.maxBlastOthers = Math.max(stats.maxBlastOthers, others.length);
      for (const id of [event.id, ...others]) {
        if (stats.seenDestroyed.includes(id)) continue;
        stats.seenDestroyed.push(id);
        const mineral = run.minerals.find(item => item.id === id);
        if (mineral) stats.collection[mineral.type].destroyedByBarrel += 1;
      }
      stats.objectsDestroyedByBarrel += others.length;
    }
    if (event.type === "banked" && !stats.seenBanked.includes(event.id)) {
      stats.seenBanked.push(event.id); stats.objectsRecovered += 1; stats.recoveredByType[event.mineralType] += 1;
      stats.recoveredIncome += event.value; stats.bestRecoveryValue = Math.max(stats.bestRecoveryValue, event.value);
      stats.hookRecovered = true; stats.hookOpen = false;
      stats.bestRecoveryStreak = Math.max(stats.bestRecoveryStreak, ++stats.recoveryStreak);
      stats.penaltyStreak = event.actualTimeChange < 0 ? stats.penaltyStreak + 1 : 0;
      stats.bestPenaltyStreak = Math.max(stats.bestPenaltyStreak, stats.penaltyStreak);
      stats.timeAddedMs += Math.round(Math.max(0, event.actualTimeChange) * 1000);
      if (event.mineralType === "cursedRelic") stats.cursedTimeLostMs += Math.round(Math.max(0, -event.actualTimeChange) * 1000);
      if (event.protectedPenalty) stats.penaltiesBlocked += 1;
      if (event.firstTargetReached) stats.targetTime = event.timeBefore;
      if (event.timeBefore > 0 && event.timeBefore <= 1 && event.actualTimeChange > 0) stats.lastSecondRescue = true;
      if (event.timeBefore > 0 && event.timeBefore <= 5 && event.protectedPenalty) stats.charmRescue = true;
      const item = stats.collection[event.mineralType]; item.recovered += 1;
      if (event.rewardId && !item.rewardIds.includes(event.rewardId)) item.rewardIds.push(event.rewardId);
      if (rewardIds[event.mineralType]) {
        const high = event.mineralType === "mysteryBag" ? event.rewardId === "coins_200" : event.rewardId === "coins_800";
        stats.luckyStreak = high ? stats.luckyStreak + 1 : 0;
        stats.bestLuckyStreak = Math.max(stats.bestLuckyStreak, stats.luckyStreak);
        if (event.mineralType === "mysteryBag") { if (high) stats.bagGoodLuck += 1; if (event.rewardId === "time_minus_5") stats.bagBadLuck += 1; }
        else if (high) stats.chestTopRewards += 1;
      }
    }
    if (event.type === "settled") {
      if (stats.hookOpen && !stats.hookRecovered) stats.recoveryStreak = 0;
      stats.activePlayMs = Math.round(run.elapsedTime * 1000);
      stats.levelsCleared = event.success ? 1 : 0;
      stats.qualifiedIncome = event.success ? run.levelIncome : 0;
      stats.failedLevelIncome = event.success ? 0 : run.levelIncome;
      stats.sealed = true;
    }
  }
  function addTotals(target, delta) {
    for (const key of sumKeys) target[key] += delta[key];
    target.bestRecoveryValue = Math.max(target.bestRecoveryValue, delta.bestRecoveryValue);
    for (const type of types) target.recoveredByType[type] += delta.recoveredByType[type];
  }
  function evaluate(document, run, now, legacy = false, backfill = false) {
    if (!backfill && document.activeRun && document.activeRun.mode !== "endless") return [];
    const profile = document.profile, career = profile.career, stats = run?.growth;
    const success = Boolean(run?.result?.success);
    const progress = {
      first_clear: career.bestClearedLevel, clear_5: career.bestClearedLevel,
      dynamite_ten: career.dynamiteUsed - (profile.modeStats?.seed.dynamiteUsed || 0) - (profile.modeStats?.daily.dynamiteUsed || 0),
      recover_all_v120: recoverableTypes.filter(type => profile.collection[type].recovered - (profile.modeStats?.seed.recoveredByType[type] || 0) - (profile.modeStats?.daily.recoveredByType[type] || 0) > 0).length,
    };
    if (stats) Object.assign(progress, { recover_streak_5: stats.bestRecoveryStreak,
      no_assistance_clear: Number(success && !stats.entryAssisted && stats.dynamiteUsed === 0) });
    const endless = profile.modeStats?.endless || career;
    Object.assign(progress, {
      first_recovery: endless.objectsRecovered, gold_recovered_10: endless.recoveredByType.smallGold + endless.recoveredByType.largeGold,
      diamond_recovered_5: endless.recoveredByType.diamond, objects_recovered_30: endless.objectsRecovered,
      level_income_1200: career.bestLevelIncome, clear_10: career.bestClearedLevel, career_income_5000: endless.qualifiedIncome,
    });
    const unlocked = [];
    for (const def of definitions) {
      if (legacy && !["first_clear", "clear_5", "clear_10"].includes(def.id)) continue;
      const item = profile.achievements[def.id];
      item.progress = Math.max(item.progress, Math.min(def.target, progress[def.id] || 0));
      if (!item.unlockedAt && item.progress >= def.target) {
        item.unlockedAt = now; item.unlockedRunId = backfill ? "upgrade-statistics" : document.activeRun?.runId || "legacy-records";
        unlocked.push(def.id);
        if (!backfill && document.activeRun && !document.activeRun.newAchievementIds.includes(def.id)) document.activeRun.newAchievementIds.push(def.id);
      }
    }
    return unlocked;
  }
  function createActive(document, checkpoint, runId, now, imported) {
    const career = document.profile.career;
    const run = checkpoint.run;
    const runTotals = totals();
    if (imported) { runTotals.qualifiedIncome = run.totalIncome; runTotals.levelsCleared = checkpoint.kind === "shop" ? run.levelId : run.levelId - 1; }
    const challenge = run.challenge || challenges.create("endless", run.runSeed);
    document.activeRun = { runId, mode: challenge.mode, rulesetVersion: challenge.rulesVersion, challenge: clone(challenge), eventCounts: {}, runSeed: run.runSeed, startedAt: now,
      recordsAtStart: { bestRunIncome: career.bestRunIncome, bestClearedLevel: career.bestClearedLevel, bestReachedLevel: career.bestReachedLevel },
      checkpoint: clone(checkpoint), committedThroughLevel: checkpoint.kind === "shop" ? run.levelId : run.levelId - 1,
      entryCountedForLevel: 0, runTotals, newAchievementIds: [], bestReachedLevel: run.levelId,
      importedFromV110: imported, statisticsComplete: !imported };
    career[imported ? "runsImported" : "runsStarted"] += 1;
    document.profile.modeStats[challenge.mode][imported ? "runsImported" : "runsStarted"] += 1;
  }
  function enterLevel(document, checkpoint, now) {
    const active = document.activeRun;
    if (!active || checkpoint.run.runSeed !== active.runSeed) throw new Error("挑战身份不一致");
    active.checkpoint = clone(checkpoint);
    const n = checkpoint.run.levelId;
    if (active.entryCountedForLevel === n || checkpoint.kind !== "level") return [];
    active.entryCountedForLevel = n;
    active.bestReachedLevel = Math.max(active.bestReachedLevel, n);
    const modeStats = document.profile.modeStats[active.mode];
    modeStats.bestReachedLevel = Math.max(modeStats.bestReachedLevel, n);
    if (active.mode === "endless") document.profile.career.bestReachedLevel = Math.max(document.profile.career.bestReachedLevel, n);
    for (const mineral of checkpoint.run.level.layout) {
      const entry = document.profile.collection[mineral.type]; entry.seen += 1; entry.firstSeenAt ||= now;
    }
    if (checkpoint.run.effects.timeCoupon) {
      document.profile.career.timeAddedMs += 10000; active.runTotals.timeAddedMs += 10000;
      modeStats.timeAddedMs += 10000;
    }
    return evaluate(document, null, now);
  }
  function report(document, reason, now, run = null) {
    const active = document.activeRun, career = document.profile.career;
    // 设备时钟回退仍可结束挑战，保持报告日期顺序而不重派生挑战日期。
    now = new Date(Math.max(Date.parse(now), Date.parse(active.startedAt))).toISOString();
    const newRecords = [];
    for (const key of ["bestRunIncome", "bestClearedLevel", "bestReachedLevel"]) if (career[key] > active.recordsAtStart[key]) newRecords.push(key);
    const item = { runId: active.runId, mode: active.mode, rulesetVersion: active.rulesetVersion, challenge: clone(active.challenge), eventCounts: clone(active.eventCounts), runSeed: active.runSeed,
      startedAt: active.startedAt, endedAt: now, reason, statisticsComplete: active.statisticsComplete,
      bestReachedLevel: active.bestReachedLevel, totals: clone(active.runTotals),
      failure: run && reason === "failed" ? { levelId: run.levelId, income: run.levelIncome, target: run.level.target, eventId: run.level.event?.id || "none" } : null,
      newAchievementIds: [...active.newAchievementIds], newRecords };
    document.profile.recentReports.unshift(item); document.profile.recentReports.length = Math.min(reportLimit, document.profile.recentReports.length);
    if (active.mode !== "endless") {
      const recordKey = challenges.key(active.challenge);
      const candidate = { challenge: clone(active.challenge), runId: active.runId, updatedAt: now,
        levelsCleared: active.runTotals.levelsCleared, qualifiedIncome: active.runTotals.qualifiedIncome, activePlayMs: active.runTotals.activePlayMs };
      if (challenges.better(candidate, document.profile.challengeRecords[recordKey])) document.profile.challengeRecords[recordKey] = candidate;
      // 离线档案保留最近更新的 200 个赛题最佳，防止任意 Seed 无界撑大统一存档。
      const entries = Object.entries(document.profile.challengeRecords).sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt));
      document.profile.challengeRecords = Object.fromEntries(entries.slice(0, 200));
    }
    document.activeRun = null;
    return item;
  }
  function abandon(document, now) {
    if (!document.activeRun) return null;
    document.profile.career.runsAbandoned += 1;
    document.profile.modeStats[document.activeRun.mode].runsAbandoned += 1;
    return report(document, "abandoned", now);
  }
  function settleLevel(document, run, checkpoint, now) {
    const active = document.activeRun;
    if (!active || !run.settled || !run.growth.sealed || active.runSeed !== run.runSeed
      || active.checkpoint.kind !== "level" || active.checkpoint.run.levelId !== run.levelId || active.committedThroughLevel >= run.levelId) return [];
    addTotals(document.profile.career, run.growth); addTotals(active.runTotals, run.growth);
    const modeStats = document.profile.modeStats[active.mode];
    addTotals(modeStats, run.growth);
    const eventId = run.level.event?.id || "none";
    active.eventCounts[eventId] = (active.eventCounts[eventId] || 0) + 1;
    active.committedThroughLevel = run.levelId;
    const career = document.profile.career;
    if (run.result.success && active.mode === "endless") {
      career.bestClearedLevel = Math.max(career.bestClearedLevel, run.levelId);
      career.bestRunIncome = Math.max(career.bestRunIncome, run.totalIncome);
      career.bestLevelIncome = Math.max(career.bestLevelIncome, run.levelIncome);
    }
    if (run.result.success) {
      modeStats.bestClearedLevel = Math.max(modeStats.bestClearedLevel, run.levelId);
      modeStats.bestRunIncome = Math.max(modeStats.bestRunIncome, run.totalIncome);
      modeStats.bestLevelIncome = Math.max(modeStats.bestLevelIncome, run.levelIncome);
    }
    for (const type of types) {
      const entry = document.profile.collection[type], delta = run.growth.collection[type];
      for (const key of ["recovered", "destroyedByDynamite", "destroyedByBarrel", "detonated"]) entry[key] += delta[key];
      if (delta.recovered > 0 || delta.detonated > 0) entry.researchedAt ||= now;
      entry.rewardIds = [...new Set([...entry.rewardIds, ...delta.rewardIds])];
    }
    if (active.mode === "endless") document.profile.endlessChestRewardIds = [...new Set([...document.profile.endlessChestRewardIds, ...run.growth.collection.treasureChest.rewardIds])];
    const unlocked = evaluate(document, run, now);
    if (run.result.success && active.challenge.levelLimit === run.levelId) report(document, "completed", now, run);
    else if (run.result.success) active.checkpoint = clone(checkpoint);
    else { career.runsFailed += 1; modeStats.runsFailed += 1; report(document, "failed", now, run); }
    return unlocked;
  }
  function equipTitle(document, id) {
    if (id === null) { document.profile.equippedTitleId = null; return true; }
    const def = allDefinitions.find(item => item.id === id);
    if (!def?.reward.title || !document.profile.achievements[id].unlockedAt) return false;
    document.profile.equippedTitleId = id; return true;
  }
  function validateDocument(value, version = challenges.version) {
    try {
      const catalog = ["1.5.0", "1.5.1", "1.5.2", "1.5.3"].includes(version) ? allDefinitions : historicalDefinitions;
      const modern = challenges.supportedVersions.includes(version);
      const compatibleRules = challenges.supportedVersions.slice(0, challenges.supportedVersions.indexOf(version) + 1);
      const validChallenge = challenge => challenge && compatibleRules.includes(challenge.rulesVersion) && challenges.valid(challenge, challenge.rulesVersion);
      if (!object(value) || value.schemaVersion !== 1 || value.rulesVersion !== version || !integer(value.revision)
        || !object(value.settings) || typeof value.settings.soundEnabled !== "boolean") return false;
      const p = value.profile, c = p?.career;
      const validTotals = t => object(t) && [...sumKeys, "bestRecoveryValue"].every(key => integer(t[key]))
        && object(t.recoveredByType) && types.every(type => integer(t.recoveredByType[type]))
        && Object.keys(t.recoveredByType).every(type => types.includes(type))
        && Object.values(t.recoveredByType).reduce((a, b) => a + b, 0) === t.objectsRecovered
        && t.hooksHit <= t.hooksLaunched && t.objectsRecovered <= t.hooksHit
        && t.objectsDestroyedByDynamite === t.dynamiteUsed;
      if (!object(p) || !date(p.statisticsSince) || !validTotals(c)
        || !["runsStarted", "runsImported", "runsFailed", "runsAbandoned", "bestReachedLevel", "bestClearedLevel", "bestRunIncome", "bestLevelIncome"].every(key => integer(c[key]))
        || c.recoveredIncome !== c.qualifiedIncome + c.failedLevelIncome || !object(p.legacyRecords)
        || !integer(p.legacyRecords.highScore) || !integer(p.legacyRecords.bestClearedLevel)) return false;
      if (!object(p.achievements) || Object.keys(p.achievements).some(id => !catalog.some(def => def.id === id))) return false;
      for (const def of catalog) {
        p.achievements[def.id] ||= { progress: 0, unlockedAt: null, unlockedRunId: null };
        const a = p.achievements[def.id];
        if (!integer(a.progress) || a.progress > def.target || (a.unlockedAt !== null && (!date(a.unlockedAt) || a.progress !== def.target || !idValid(a.unlockedRunId)))
          || a.unlockedAt === null && a.unlockedRunId !== null) return false;
      }
      if (!object(p.collection) || Object.keys(p.collection).some(type => !types.includes(type))) return false;
      for (const type of types) {
        p.collection[type] ||= collectionEntry();
        const item = p.collection[type];
        if (!object(item) || !["seen", "recovered", "destroyedByDynamite", "destroyedByBarrel", "detonated"].every(key => integer(item[key]))
          || item.recovered + item.destroyedByDynamite + item.destroyedByBarrel > item.seen
          || item.recovered !== c.recoveredByType[type] || item.detonated > item.destroyedByBarrel
          || item.firstSeenAt !== null && !date(item.firstSeenAt) || item.researchedAt !== null && !date(item.researchedAt)
          || !Array.isArray(item.rewardIds) || new Set(item.rewardIds).size !== item.rewardIds.length
          || !item.rewardIds.every(id => rewardIds[type]?.includes(id))) return false;
      }
      if (types.reduce((sum, type) => sum + p.collection[type].destroyedByDynamite, 0) !== c.objectsDestroyedByDynamite
        || types.reduce((sum, type) => sum + p.collection[type].destroyedByBarrel, 0) !== c.objectsDestroyedByBarrel + c.barrelsDetonated
        || p.collection.powderKeg.detonated !== c.barrelsDetonated || p.collection.powderKeg.recovered !== 0
        || c.runsFailed + c.runsAbandoned > c.runsStarted + c.runsImported) return false;
      if (p.equippedTitleId !== null && (!catalog.some(def => def.id === p.equippedTitleId && def.reward.title) || !p.achievements[p.equippedTitleId].unlockedAt)) return false;
      if (!Array.isArray(p.recentReports) || p.recentReports.length > reportLimit || new Set(p.recentReports.map(r => r.runId)).size !== p.recentReports.length) return false;
      for (const r of p.recentReports) if (!idValid(r.runId) || !date(r.startedAt) || !date(r.endedAt) || Date.parse(r.endedAt) < Date.parse(r.startedAt)
        || !["failed", "abandoned", ...(modern ? ["completed"] : [])].includes(r.reason)
        || !(modern ? challenges.modes : ["endless"]).includes(r.mode) || !(modern ? ["1.2.0", ...compatibleRules] : [version, "1.2.0"]).includes(r.rulesetVersion)
        || !integer(r.runSeed) || r.runSeed > 0xffffffff || !validTotals(r.totals) || !integer(r.bestReachedLevel) || typeof r.statisticsComplete !== "boolean"
        || !Array.isArray(r.newRecords) || !r.newRecords.every(key => ["bestRunIncome", "bestClearedLevel", "bestReachedLevel"].includes(key))
        || !Array.isArray(r.newAchievementIds) || !r.newAchievementIds.every(id => p.achievements[id]?.unlockedAt)
        || r.reason === "failed" && (!object(r.failure) || !integer(r.failure.levelId) || !integer(r.failure.income) || !integer(r.failure.target) || r.failure.income >= r.failure.target)) return false;
      const active = value.activeRun;
      if (active !== null && (!object(active) || !idValid(active.runId) || !date(active.startedAt) || !(modern ? challenges.modes : ["endless"]).includes(active.mode)
        || !(modern ? ["1.2.0", ...compatibleRules] : [version, "1.2.0"]).includes(active.rulesetVersion) || !integer(active.runSeed) || active.runSeed > 0xffffffff
        || !integer(active.committedThroughLevel) || !integer(active.entryCountedForLevel) || !integer(active.bestReachedLevel)
        || !validTotals(active.runTotals) || typeof active.statisticsComplete !== "boolean" || typeof active.importedFromV110 !== "boolean"
        || !object(active.recordsAtStart) || !["bestRunIncome", "bestClearedLevel", "bestReachedLevel"].every(key => integer(active.recordsAtStart[key]))
        || !Array.isArray(active.newAchievementIds) || !active.newAchievementIds.every(id => p.achievements[id]?.unlockedAt))) return false;
      if (modern) {
        if (!object(p.modeStats) || Object.keys(p.modeStats).length !== 3 || !challenges.modes.every(mode => validTotals(p.modeStats[mode])
          && ["runsStarted", "runsImported", "runsFailed", "runsAbandoned", "bestReachedLevel", "bestClearedLevel", "bestRunIncome", "bestLevelIncome"].every(key => integer(p.modeStats[mode][key])))) return false;
        for (const key of sumKeys) if (challenges.modes.reduce((sum, mode) => sum + p.modeStats[mode][key], 0) !== c[key]) return false;
        if (!Array.isArray(p.endlessChestRewardIds) || !p.endlessChestRewardIds.every(id => rewardIds.treasureChest.includes(id))
          || !object(p.challengeRecords) || Object.keys(p.challengeRecords).length > 200) return false;
        const validEventCounts = counts => object(counts) && Object.entries(counts).every(([id, n]) => ["none", "goldRush", "diamondVein", "unstable", "blackMarket", "sparse"].includes(id) && integer(n));
        for (const [key, r] of Object.entries(p.challengeRecords)) if (!validChallenge(r.challenge) || r.challenge.mode === "endless" || key !== challenges.key(r.challenge)
          || !idValid(r.runId) || !date(r.updatedAt) || !integer(r.levelsCleared) || r.levelsCleared > challenges.limit || !integer(r.qualifiedIncome) || !integer(r.activePlayMs)) return false;
        for (const r of p.recentReports) if (challenges.supportedVersions.includes(r.rulesetVersion) && (!validChallenge(r.challenge) || r.rulesetVersion !== r.challenge.rulesVersion || r.challenge.mode !== r.mode || r.challenge.seed !== r.runSeed
          || !validEventCounts(r.eventCounts) || r.reason === "completed" && (r.mode === "endless" || r.totals.levelsCleared !== challenges.limit))) return false;
        if (active && (!validChallenge(active.challenge) || active.rulesetVersion !== active.challenge.rulesVersion || active.mode !== active.challenge.mode || active.runSeed !== active.challenge.seed || !validEventCounts(active.eventCounts))) return false;
      }
      return true;
    } catch { return false; }
  }
  return Object.freeze({ types, recoverableTypes, rewardIds, definitions, retiredDefinitions, historicalDefinitions, allDefinitions, reportLimit, sumKeys, totals, clone,
    createDocument, createLevelStats, rewardId, recordEvent, evaluate, createActive, enterLevel, settleLevel, abandon, equipTitle, validateDocument });
});
