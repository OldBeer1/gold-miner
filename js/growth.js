(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerGrowth = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const types = Object.freeze(["smallGold", "largeGold", "stone", "diamond", "ruby", "mysteryBag", "treasureChest", "cursedRelic", "powderKeg"]);
  // v1.2 收藏成就固定八类；未来图鉴扩展不能增加这个成就的要求。
  const recoverableTypes = Object.freeze(["smallGold", "largeGold", "stone", "diamond", "ruby", "mysteryBag", "treasureChest", "cursedRelic"]);
  const rewardIds = Object.freeze({ mysteryBag: ["coins_50", "coins_200", "bomb_1", "time_plus_5", "time_minus_5"], treasureChest: ["coins_150", "coins_450", "coins_800"] });
  const definitions = Object.freeze([
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
    return { schemaVersion: 1, rulesVersion: "1.2.0", revision: 0, settings: { soundEnabled: preferences.soundEnabled },
      profile: { statisticsSince: now, legacyRecords: { source: "preferences.v2", highScore: preferences.highScore, bestClearedLevel: preferences.bestClearedLevel },
        career: { ...totals(), runsStarted: 0, runsImported: 0, runsFailed: 0, runsAbandoned: 0, bestReachedLevel: 0,
          bestClearedLevel: preferences.bestClearedLevel, bestRunIncome: preferences.highScore, bestLevelIncome: 0 },
        achievements: Object.fromEntries(definitions.map(def => [def.id, { progress: 0, unlockedAt: null, unlockedRunId: null }])),
        collection: Object.fromEntries(types.map(type => [type, collectionEntry()])), equippedTitleId: null, recentReports: [] }, activeRun: null };
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
  function evaluate(document, run, now, legacy = false) {
    const profile = document.profile, career = profile.career, stats = run?.growth;
    const success = Boolean(run?.result?.success);
    const progress = {
      first_clear: career.bestClearedLevel, clear_5: career.bestClearedLevel, clear_20: career.bestClearedLevel,
      reach_50: career.bestReachedLevel, level_income_5000: career.bestLevelIncome, career_income_100000: career.qualifiedIncome,
      dynamite_ten: career.dynamiteUsed, recover_all_v120: recoverableTypes.filter(type => profile.collection[type].recovered > 0).length,
      chest_all_rewards: profile.collection.treasureChest.rewardIds.length,
    };
    if (stats) Object.assign(progress, { recover_streak_5: stats.bestRecoveryStreak, blast_four: stats.maxBlastOthers,
      penalty_twice: stats.bestPenaltyStreak, lucky_streak_3: stats.bestLuckyStreak,
      perfect_level: success && stats.objectsRecovered === stats.hooksLaunched ? stats.hooksLaunched : 0,
      last_second_target: Number(success && stats.targetTime > 0 && stats.targetTime <= 1),
      no_assistance_clear: Number(success && !stats.entryAssisted && stats.dynamiteUsed === 0),
      last_second_rescue: Number(success && stats.lastSecondRescue), charm_rescue: Number(success && stats.charmRescue) });
    const unlocked = [];
    for (const def of definitions) {
      if (legacy && !["first_clear", "clear_5", "clear_20"].includes(def.id)) continue;
      const item = profile.achievements[def.id];
      item.progress = Math.max(item.progress, Math.min(def.target, progress[def.id] || 0));
      if (!item.unlockedAt && item.progress >= def.target) {
        item.unlockedAt = now; item.unlockedRunId = document.activeRun?.runId || "legacy-records";
        unlocked.push(def.id);
        if (document.activeRun && !document.activeRun.newAchievementIds.includes(def.id)) document.activeRun.newAchievementIds.push(def.id);
      }
    }
    return unlocked;
  }
  function createActive(document, checkpoint, runId, now, imported) {
    const career = document.profile.career;
    const run = checkpoint.run;
    const runTotals = totals();
    if (imported) { runTotals.qualifiedIncome = run.totalIncome; runTotals.levelsCleared = checkpoint.kind === "shop" ? run.levelId : run.levelId - 1; }
    document.activeRun = { runId, mode: "endless", rulesetVersion: "1.2.0", runSeed: run.runSeed, startedAt: now,
      recordsAtStart: { bestRunIncome: career.bestRunIncome, bestClearedLevel: career.bestClearedLevel, bestReachedLevel: career.bestReachedLevel },
      checkpoint: clone(checkpoint), committedThroughLevel: checkpoint.kind === "shop" ? run.levelId : run.levelId - 1,
      entryCountedForLevel: 0, runTotals, newAchievementIds: [], bestReachedLevel: run.levelId,
      importedFromV110: imported, statisticsComplete: !imported };
    career[imported ? "runsImported" : "runsStarted"] += 1;
  }
  function enterLevel(document, checkpoint, now) {
    const active = document.activeRun;
    if (!active || checkpoint.run.runSeed !== active.runSeed) throw new Error("挑战身份不一致");
    active.checkpoint = clone(checkpoint);
    const n = checkpoint.run.levelId;
    if (active.entryCountedForLevel === n || checkpoint.kind !== "level") return [];
    active.entryCountedForLevel = n;
    active.bestReachedLevel = Math.max(active.bestReachedLevel, n);
    document.profile.career.bestReachedLevel = Math.max(document.profile.career.bestReachedLevel, n);
    for (const mineral of checkpoint.run.level.layout) {
      const entry = document.profile.collection[mineral.type]; entry.seen += 1; entry.firstSeenAt ||= now;
    }
    if (checkpoint.run.effects.timeCoupon) {
      document.profile.career.timeAddedMs += 10000; active.runTotals.timeAddedMs += 10000;
    }
    return evaluate(document, null, now);
  }
  function report(document, reason, now, run = null) {
    const active = document.activeRun, career = document.profile.career;
    const newRecords = [];
    for (const key of ["bestRunIncome", "bestClearedLevel", "bestReachedLevel"]) if (career[key] > active.recordsAtStart[key]) newRecords.push(key);
    const item = { runId: active.runId, mode: active.mode, rulesetVersion: active.rulesetVersion, runSeed: active.runSeed,
      startedAt: active.startedAt, endedAt: now, reason, statisticsComplete: active.statisticsComplete,
      bestReachedLevel: active.bestReachedLevel, totals: clone(active.runTotals),
      failure: run ? { levelId: run.levelId, income: run.levelIncome, target: run.level.target } : null,
      newAchievementIds: [...active.newAchievementIds], newRecords };
    document.profile.recentReports.unshift(item); document.profile.recentReports.length = Math.min(reportLimit, document.profile.recentReports.length);
    document.activeRun = null;
    return item;
  }
  function abandon(document, now) {
    if (!document.activeRun) return null;
    document.profile.career.runsAbandoned += 1;
    return report(document, "abandoned", now);
  }
  function settleLevel(document, run, checkpoint, now) {
    const active = document.activeRun;
    if (!active || !run.settled || !run.growth.sealed || active.runSeed !== run.runSeed
      || active.checkpoint.kind !== "level" || active.checkpoint.run.levelId !== run.levelId || active.committedThroughLevel >= run.levelId) return [];
    addTotals(document.profile.career, run.growth); addTotals(active.runTotals, run.growth);
    active.committedThroughLevel = run.levelId;
    const career = document.profile.career;
    if (run.result.success) {
      career.bestClearedLevel = Math.max(career.bestClearedLevel, run.levelId);
      career.bestRunIncome = Math.max(career.bestRunIncome, run.totalIncome);
      career.bestLevelIncome = Math.max(career.bestLevelIncome, run.levelIncome);
    }
    for (const type of types) {
      const entry = document.profile.collection[type], delta = run.growth.collection[type];
      for (const key of ["recovered", "destroyedByDynamite", "destroyedByBarrel", "detonated"]) entry[key] += delta[key];
      if (delta.recovered > 0 || delta.detonated > 0) entry.researchedAt ||= now;
      entry.rewardIds = [...new Set([...entry.rewardIds, ...delta.rewardIds])];
    }
    const unlocked = evaluate(document, run, now);
    if (run.result.success) active.checkpoint = clone(checkpoint);
    else { career.runsFailed += 1; report(document, "failed", now, run); }
    return unlocked;
  }
  function equipTitle(document, id) {
    if (id === null) { document.profile.equippedTitleId = null; return true; }
    const def = definitions.find(item => item.id === id);
    if (!def?.reward.title || !document.profile.achievements[id].unlockedAt) return false;
    document.profile.equippedTitleId = id; return true;
  }
  function validateDocument(value) {
    try {
      if (!object(value) || value.schemaVersion !== 1 || value.rulesVersion !== "1.2.0" || !integer(value.revision)
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
      if (!object(p.achievements) || Object.keys(p.achievements).some(id => !definitions.some(def => def.id === id))) return false;
      for (const def of definitions) {
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
      if (p.equippedTitleId !== null && (!definitions.some(def => def.id === p.equippedTitleId && def.reward.title) || !p.achievements[p.equippedTitleId].unlockedAt)) return false;
      if (!Array.isArray(p.recentReports) || p.recentReports.length > reportLimit || new Set(p.recentReports.map(r => r.runId)).size !== p.recentReports.length) return false;
      for (const r of p.recentReports) if (!idValid(r.runId) || !date(r.startedAt) || !date(r.endedAt) || Date.parse(r.endedAt) < Date.parse(r.startedAt)
        || !["failed", "abandoned"].includes(r.reason) || r.mode !== "endless" || r.rulesetVersion !== "1.2.0"
        || !integer(r.runSeed) || r.runSeed > 0xffffffff || !validTotals(r.totals) || !integer(r.bestReachedLevel) || typeof r.statisticsComplete !== "boolean"
        || !Array.isArray(r.newRecords) || !r.newRecords.every(key => ["bestRunIncome", "bestClearedLevel", "bestReachedLevel"].includes(key))
        || !Array.isArray(r.newAchievementIds) || !r.newAchievementIds.every(id => p.achievements[id]?.unlockedAt)
        || r.reason === "failed" && (!object(r.failure) || !integer(r.failure.levelId) || !integer(r.failure.income) || !integer(r.failure.target) || r.failure.income >= r.failure.target)) return false;
      const active = value.activeRun;
      if (active !== null && (!object(active) || !idValid(active.runId) || !date(active.startedAt) || active.mode !== "endless"
        || active.rulesetVersion !== "1.2.0" || !integer(active.runSeed) || active.runSeed > 0xffffffff
        || !integer(active.committedThroughLevel) || !integer(active.entryCountedForLevel) || !integer(active.bestReachedLevel)
        || !validTotals(active.runTotals) || typeof active.statisticsComplete !== "boolean" || typeof active.importedFromV110 !== "boolean"
        || !object(active.recordsAtStart) || !["bestRunIncome", "bestClearedLevel", "bestReachedLevel"].every(key => integer(active.recordsAtStart[key]))
        || !Array.isArray(active.newAchievementIds) || !active.newAchievementIds.every(id => p.achievements[id]?.unlockedAt))) return false;
      return true;
    } catch { return false; }
  }
  return Object.freeze({ types, recoverableTypes, rewardIds, definitions, reportLimit, sumKeys, totals, clone,
    createDocument, createLevelStats, rewardId, recordEvent, evaluate, createActive, enterLevel, settleLevel, abandon, equipTitle, validateDocument });
});
