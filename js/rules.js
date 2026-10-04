(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./growth.js"));
  else root.GoldMinerRules = factory(root.GoldMinerGrowth);
})(typeof window !== "undefined" ? window : globalThis, function (growth) {
  "use strict";

  function seededRandom(seed, levelId, purpose) {
    let value = ((seed >>> 0) ^ Math.imul(levelId, 0x9e3779b1) ^ purpose) >>> 0;
    return function () {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(value ^ value >>> 15, 1 | value);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }

  function levelParameters(config, levelId) {
    if (!Number.isSafeInteger(levelId) || levelId < 1) throw new Error("关号必须为正整数");
    const difficulty = Math.min(levelId - 1, config.survival.maxDifficulty);
    const stage = Math.max(0, Math.floor(levelId / 10) - 1);
    // 后期几何压力逐渐逼近矿区上限，金额使用缓慢的对数增长，避免高关号溢出。
    const pressure = stage / (stage + 3);
    const rewardScale = 1 + config.survival.stageIncomeGrowth * Math.log2(1 + stage);
    const obstacleCount = difficulty < 3 ? 0 : Math.min(4, Math.floor((difficulty - 1) / 2)) + Number(stage >= 2);
    return { id: levelId, difficulty, stage, pressure, rewardScale,
      target: Math.round((config.survival.targets[difficulty] + config.survival.stageTargetBonus * pressure) * rewardScale),
      depth: 250 + 8 * difficulty + config.survival.stageDepthBonus * pressure, obstacleCount,
      duration: config.levelDuration, count: config.survival.baseCount + difficulty + Math.floor(3 * pressure) };
  }

  function boundingRadius(definition) {
    return definition.radius || Math.hypot(definition.width / 2, definition.height / 2);
  }

  function validPlacement(mineral, layout, config) {
    const radius = boundingRadius(config.minerals[mineral.type]);
    const mine = config.mine;
    if (mineral.x - radius < mine.x || mineral.x + radius > mine.x + mine.width
      || mineral.y - radius < mine.y || mineral.y + radius > mine.y + mine.height) return false;
    const angle = Math.atan2(mineral.x - config.miner.anchor.x, mineral.y - config.miner.anchor.y) * 180 / Math.PI;
    if (angle < config.hook.minAngle || angle > config.hook.maxAngle) return false;
    return layout.every(other => Math.hypot(mineral.x - other.x, mineral.y - other.y)
      >= radius + boundingRadius(config.minerals[other.type]) + 8);
  }

  function protectsRoute(mineral, bases, config) {
    const radius = boundingRadius(config.minerals[mineral.type]) + 6;
    return bases.every(base => segmentCircle(config.miner.anchor, base, mineral, radius) === null);
  }

  function freezeLevel(level) {
    level.layout.forEach(Object.freeze);
    Object.freeze(level.layout);
    if (level.route) Object.freeze(level.route);
    return Object.freeze(level);
  }

  function makeLayout(config, parameters, random, fallback) {
    const types = ["largeGold", "diamond", "smallGold", "diamond", "largeGold", "diamond", "smallGold", "diamond", "largeGold"];
    const offset = fallback ? 0 : random() * 6 - 3;
    const mirror = !fallback && random() < .5 ? -1 : 1;
    const layout = types.map((type, index) => {
      const angle = (config.survival.routeAngles[index] * mirror + offset) * Math.PI / 180;
      const distance = parameters.depth + (fallback ? 30 : 20 + random() * 30);
      return { id: `l${parameters.id}-safe${index}`, type, x: config.miner.anchor.x + Math.sin(angle) * distance,
        y: config.miner.anchor.y + Math.cos(angle) * distance, safeRoute: true, rewardRoll: random() };
    });
    if (!layout.every((mineral, index) => validPlacement(mineral, layout.filter((_, i) => i !== index), config))) return null;
    const bases = layout.slice();
    for (const index of config.survival.obstacleIndices.slice(0, parameters.obstacleCount)) {
      const base = bases[index];
      const angle = Math.atan2(base.x - config.miner.anchor.x, base.y - config.miner.anchor.y);
      const distance = 235 + parameters.pressure * 12;
      const stone = { id: `l${parameters.id}-block${index}`, type: "stone", routeObstacle: true,
        x: config.miner.anchor.x + Math.sin(angle) * distance, y: config.miner.anchor.y + Math.cos(angle) * distance };
      if (!validPlacement(stone, layout, config)) return null;
      layout.push(stone);
    }
    const newTypes = config.survival.newTypes.filter(type => config.minerals[type]);
    const firstNew = newTypes.length ? Math.floor(random() * newTypes.length) : -1;
    const required = firstNew < 0 ? [] : fallback ? ["mysteryBag", "treasureChest"]
      : [newTypes[firstNew], newTypes[(firstNew + 1 + Math.floor(random() * (newTypes.length - 1))) % newTypes.length]];
    const available = parameters.difficulty >= 3 ? ["stone", "stone", "stone", "smallGold", "mysteryBag", "treasureChest", "ruby", "cursedRelic", "powderKeg"] : Object.keys(config.minerals);
    const extraCount = parameters.count - layout.length;
    for (let i = 0; i < extraCount; i += 1) {
      const pool = available.filter(type => !["powderKeg", "cursedRelic"].includes(type) || layout.filter(item => item.type === type).length < 2);
      const type = required[i] || (fallback ? "stone" : pool[Math.floor(random() * pool.length)]);
      let placed = false;
      for (let attempt = 0; attempt < (fallback ? 1 : config.survival.placementAttempts); attempt += 1) {
        const row = Math.floor(i / 10);
        const mineral = { id: `l${parameters.id}-extra${i}`, type,
          x: fallback ? 75 + (i % 10) * 90 + row * 45 : 60 + random() * 840,
          y: fallback ? 530 + row * 55 : (parameters.difficulty >= 3 ? 455 + random() * 130 : 210 + random() * 375),
          rewardRoll: fallback ? 0 : random() };
        if (!validPlacement(mineral, layout, config) || !protectsRoute(mineral, bases, config)) continue;
        layout.push(mineral);
        placed = true;
        break;
      }
      if (!placed) return null;
    }
    return layout;
  }

  // 与游玩共用碰撞、摆动和计时规则，生成器不靠地图总价值判断可玩性。
  function verifyRoute(config, level, strategy = "steady") {
    const run = createRun(config, level.id, { level, runSeed: 0, bombs: 0 });
    let candidates = null;
    while (run.elapsedTime < 45 && !run.settled && run.levelIncome < level.target) {
      if (run.hook.phase === "swinging") {
        if (!candidates) {
          const available = run.minerals.filter(mineral => mineral.status === "available" && mineral.type !== "powderKeg");
          candidates = available.filter(mineral => mineral.safeRoute);
          if (strategy !== "steady") {
            candidates = available.filter(mineral => {
              const hit = firstHit(config.miner.anchor, mineral, run.minerals, config);
              return hit?.mineral.id === mineral.id;
            });
            if (strategy === "safe") candidates = candidates.filter(mineral => mineral.type !== "cursedRelic" && !(mineral.reward?.kind === "time" && mineral.reward.amount < 0));
            const value = mineral => (mineral.reward?.kind === "coins" ? mineral.reward.amount : config.minerals[mineral.type].value) * (level.rewardScale || 1);
            const score = mineral => strategy === "value" ? value(mineral) : (value(mineral) + (mineral.routeObstacle ? 120 : 0))
              / (Math.hypot(mineral.x - config.miner.anchor.x, mineral.y - config.miner.anchor.y) / config.minerals[mineral.type].returnSpeed + 1);
            candidates.sort((a, b) => score(b) - score(a));
            candidates = candidates.slice(0, 3);
          }
        }
        const next = candidates.find(mineral => Math.abs(Math.atan2(mineral.x - config.miner.anchor.x, mineral.y - config.miner.anchor.y) * 180 / Math.PI - run.hook.angle) <= .5);
        if (next) { launchHook(run); candidates = null; }
      }
      advanceRun(run, 1 / 120, config);
    }
    return { strategy, success: run.levelIncome >= level.target, seconds: run.elapsedTime, income: run.levelIncome };
  }

  function createLevel(config, levelId, runSeed = 0) {
    const parameters = levelParameters(config, levelId);
    const random = seededRandom(runSeed, levelId, 0x4c41594f);
    for (let attempt = 0; attempt < config.survival.maxAttempts; attempt += 1) {
      const layout = makeLayout(config, parameters, random, false);
      if (!layout) continue;
      const level = { ...parameters, layout, fallback: false };
      const route = verifyRoute(config, level);
      if (route.success) return freezeLevel({ ...level, route });
    }
    const layout = makeLayout(config, parameters, seededRandom(runSeed, levelId, 0x46414c4c), true);
    if (!layout) throw new Error("备用布局配置无效");
    const level = { ...parameters, layout, fallback: true };
    const route = verifyRoute(config, level);
    if (!route.success) throw new Error("备用布局没有可达标路线");
    return freezeLevel({ ...level, route });
  }

  function emptyEffects() {
    return { strength: false, diamondBoost: false, timeCoupon: false, goldBoost: false,
      protectionCharm: false, luckyCharm: false };
  }

  function resolveReward(mineral, config, lucky) {
    const table = mineral.type === "mysteryBag" ? config.survival.bagRewards
      : mineral.type === "treasureChest" ? config.survival.chestRewards : null;
    if (!table) return null;
    let roll = (mineral.rewardRoll ?? 0) * 100;
    for (const reward of table) {
      roll -= lucky ? reward.luckyWeight : reward.weight;
      if (roll < 0) return { kind: reward.kind, amount: reward.amount };
    }
    const reward = table[table.length - 1];
    return { kind: reward.kind, amount: reward.amount };
  }

  function createRun(config, levelId = 1, entry = {}) {
    const runSeed = entry.runSeed ?? 0;
    const level = entry.level || createLevel(config, levelId, runSeed);
    if (!level || !level.layout.length) throw new Error("该关卡尚未配置布局");
    const effects = emptyEffects();
    Object.keys(effects).forEach(key => { effects[key] = Boolean(entry.effects?.[key]); });
    const timeBonus = effects.timeCoupon ? config.shop.timeCoupon.seconds : 0;
    const run = {
      levelId, level, runSeed,
      levelIncome: 0,
      wallet: entry.wallet ?? config.initialRun.wallet,
      totalIncome: entry.totalIncome ?? config.initialRun.totalIncome,
      bombs: entry.bombs ?? config.initialRun.bombs,
      effects,
      timeBonusUsed: timeBonus,
      remainingTime: (level.duration ?? config.levelDuration) + timeBonus,
      elapsedTime: 0,
      hook: { phase: "swinging", angle: 0, swingDirection: 1, length: config.hook.restLength, carryingId: null },
      minerals: level.layout.map((mineral) => ({ ...mineral, reward: resolveReward(mineral, config, effects.luckyCharm), status: "available" })),
      input: { acceptedCount: 0, lastAction: null, lastPoint: null },
      settled: false,
      result: null,
    };
    run.growth = growth.createLevelStats(run);
    return run;
  }

  function captureEntrySnapshot(run) {
    return Object.freeze({
      levelId: run.levelId,
      runSeed: run.runSeed,
      level: run.level,
      wallet: run.wallet,
      bombs: run.bombs,
      totalIncome: run.totalIncome,
      effects: Object.freeze({ ...run.effects }),
    });
  }

  function restoreEntrySnapshot(snapshot, config) {
    return createRun(config, snapshot.levelId, snapshot);
  }

  function createShop(run, config) {
    if (!run.result?.success) return null;
    if (run.shop) return run.shop;
    const random = seededRandom(run.runSeed, run.levelId, 0x53484f50);
    const pool = Object.keys(config.shop).filter(item => item !== "dynamite");
    const offers = ["dynamite"];
    while (offers.length < config.survival.shopSlots && pool.length) offers.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    run.shop = { nextLevelId: run.levelId + 1, offers: Object.freeze(offers),
      prices: Object.freeze(Object.fromEntries(offers.map(item => [item, shopPrice(config, run.levelId + 1, item)]))),
      purchaseCount: 0, effects: emptyEffects() };
    return run.shop;
  }

  function shopPrice(config, nextLevelId, item) {
    const next = levelParameters(config, nextLevelId);
    const multiplier = (1 + config.survival.warmupPriceGrowth * next.difficulty)
      * (1 + config.survival.stagePriceGrowth * Math.log2(1 + next.stage)) * next.rewardScale;
    return Math.ceil(config.shop[item].price * multiplier / 10) * 10;
  }

  function captureCheckpoint(run, kind, config) {
    const checkpoint = { schemaVersion: 1, rulesVersion: config.version, kind,
      run: JSON.parse(JSON.stringify(captureEntrySnapshot(run))) };
    if (kind === "shop") {
      if (!run.result?.success) throw new Error("只能保存成功关卡的商店");
      checkpoint.run.levelIncome = run.levelIncome;
      checkpoint.run.result = { ...run.result };
      checkpoint.shop = JSON.parse(JSON.stringify(createShop(run, config)));
    } else if (kind !== "level" || run.elapsedTime !== 0 || run.levelIncome !== 0) {
      throw new Error("关卡存档必须在开局创建");
    }
    return checkpoint;
  }

  function restoreCheckpoint(checkpoint, config) {
    const run = restoreEntrySnapshot(checkpoint.run, config);
    if (checkpoint.kind === "shop") {
      run.levelIncome = checkpoint.run.levelIncome;
      run.result = { ...checkpoint.run.result };
      run.settled = true;
      run.remainingTime = 0;
      run.elapsedTime = run.level.duration;
      run.hook.phase = "stopped";
      run.shop = { ...checkpoint.shop, offers: Object.freeze([...checkpoint.shop.offers]),
        prices: Object.freeze({ ...checkpoint.shop.prices }), effects: { ...checkpoint.shop.effects } };
    }
    return run;
  }

  function purchaseAvailability(run, shop, item, config) {
    if (!shop || run.shop !== shop || !run.result?.success || !shop.offers.includes(item) || !Object.hasOwn(config.shop, item)) return { available: false, reason: "不可购买" };
    if (shop.purchaseCount >= config.survival.maxPurchases) return { available: false, reason: "已购满 4 件" };
    if (item === "dynamite" && run.bombs >= config.shop.dynamite.maxInventory) return { available: false, reason: "持有已满" };
    if (item !== "dynamite" && shop.effects[item]) return { available: false, reason: "已购买" };
    if (run.wallet < shop.prices[item]) return { available: false, reason: "金币不足" };
    return { available: true, reason: "购买" };
  }

  function purchaseItem(run, shop, item, config) {
    const availability = purchaseAvailability(run, shop, item, config);
    if (!availability.available) return { success: false, reason: availability.reason };
    run.wallet -= shop.prices[item];
    shop.purchaseCount += 1;
    if (item === "dynamite") run.bombs += 1;
    else shop.effects[item] = true;
    return { success: true, item, cost: shop.prices[item] };
  }

  function canUseDynamite(run) {
    return !run.settled && run.bombs > 0 && run.hook.phase === "returning-loaded"
      && run.minerals.some(mineral => mineral.id === run.hook.carryingId && mineral.status === "carried");
  }

  function useDynamite(run) {
    if (!canUseDynamite(run)) return null;
    const mineral = run.minerals.find(item => item.id === run.hook.carryingId);
    mineral.status = "destroyed";
    run.bombs -= 1;
    run.hook.carryingId = null;
    run.hook.phase = "returning-empty";
    const event = { type: "destroyed", id: mineral.id, mineralType: mineral.type };
    growth.recordEvent(run, event);
    return event;
  }

  function hookPoint(hook, config, length = hook.length) {
    const angle = hook.angle * Math.PI / 180;
    return {
      x: config.miner.anchor.x + Math.sin(angle) * length,
      y: config.miner.anchor.y + Math.cos(angle) * length,
    };
  }

  function maximumLength(angle, config) {
    const radians = angle * Math.PI / 180;
    const dx = Math.sin(radians);
    const dy = Math.cos(radians);
    const anchor = config.miner.anchor;
    const mine = config.mine;
    const vertical = (mine.y + mine.height - anchor.y) / dy;
    const horizontal = dx > 0 ? (mine.x + mine.width - anchor.x) / dx
      : dx < 0 ? (mine.x - anchor.x) / dx : Infinity;
    return Math.min(vertical, horizontal);
  }

  function segmentCircle(start, end, center, radius) {
    const ox = start.x - center.x;
    const oy = start.y - center.y;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a === 0) return null;
    const b = 2 * (ox * dx + oy * dy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  function segmentRectangle(start, end, center, width, height) {
    let entry = 0;
    let exit = 1;
    for (const [axis, half] of [["x", width / 2], ["y", height / 2]]) {
      const delta = end[axis] - start[axis];
      const low = center[axis] - half;
      const high = center[axis] + half;
      if (delta === 0) {
        if (start[axis] < low || start[axis] > high) return null;
      } else {
        const a = (low - start[axis]) / delta;
        const b = (high - start[axis]) / delta;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) return null;
      }
    }
    return entry;
  }

  function firstHit(start, end, minerals, config) {
    let nearest = null;
    for (const mineral of minerals) {
      if (mineral.status !== "available") continue;
      const definition = config.minerals[mineral.type];
      const t = definition.radius
        ? segmentCircle(start, end, mineral, definition.radius)
        : segmentRectangle(start, end, mineral, definition.width, definition.height);
      if (t !== null && (!nearest || t < nearest.t)) nearest = { mineral, t };
    }
    return nearest;
  }

  function launchHook(run) {
    if (run.settled || run.hook.phase !== "swinging") return false;
    run.hook.phase = "extending";
    growth.recordEvent(run, { type: "launched" });
    return true;
  }

  function bankCarriedMineral(run, config, events) {
    const mineral = run.minerals.find((item) => item.id === run.hook.carryingId);
    if (!mineral || mineral.status !== "carried" || run.settled) return false;
    const reward = mineral.reward;
    const timeBefore = run.remainingTime;
    const incomeBefore = run.levelIncome;
    let value = reward?.kind === "coins" ? reward.amount : config.minerals[mineral.type].value;
    if (mineral.type === "diamond" && run.effects.diamondBoost) value *= config.shop.diamondBoost.multiplier;
    if (["smallGold", "largeGold"].includes(mineral.type) && run.effects.goldBoost) value *= config.shop.goldBoost.multiplier;
    const feedback = [];
    if (reward?.kind === "bomb") {
      if (run.bombs < config.shop.dynamite.maxInventory) {
        run.bombs += 1;
        feedback.push("炸药 +1");
      } else { value = 100; feedback.push("炸药已满，改为 +¥100"); }
    }
    value = Math.round(value * (run.level.rewardScale || 1));
    mineral.status = "banked";
    run.levelIncome += value;
    run.wallet += value;
    let timeChange = reward?.kind === "time" ? reward.amount : mineral.type === "cursedRelic" ? -5 : 0;
    let protectedPenalty = false;
    if (timeChange < 0 && run.effects.protectionCharm) {
      run.effects.protectionCharm = false;
      protectedPenalty = true;
      timeChange = 0;
      feedback.push("护身符抵消惩罚");
    }
    if (timeChange > 0) {
      timeChange = Math.min(timeChange, config.survival.maxTimeBonus - run.timeBonusUsed);
      run.timeBonusUsed += timeChange;
      feedback.push(timeChange ? `时间 +${timeChange} 秒` : "时间加成已满");
    } else if (timeChange < 0) feedback.push(`时间 ${timeChange} 秒`);
    run.remainingTime = Math.max(0, run.remainingTime + timeChange);
    const event = { type: "banked", id: mineral.id, mineralType: mineral.type, value, timeChange, protectedPenalty, feedback,
      rewardId: growth.rewardId(reward), timeBefore, timeAfter: run.remainingTime, actualTimeChange: run.remainingTime - timeBefore,
      incomeBefore, incomeAfter: run.levelIncome, firstTargetReached: incomeBefore < run.level.target && run.levelIncome >= run.level.target,
      elapsedTime: run.elapsedTime };
    growth.recordEvent(run, event);
    events.push(event);
    return true;
  }

  function resetHook(hook, config) {
    hook.phase = "swinging";
    hook.length = config.hook.restLength;
    hook.carryingId = null;
  }

  function explodePowderKeg(run, keg, config, events) {
    const radius = config.minerals.powderKeg.blastRadius;
    const destroyedIds = [];
    for (const mineral of run.minerals) {
      if (mineral.status !== "available") continue;
      const definition = config.minerals[mineral.type];
      const dx = Math.abs(mineral.x - keg.x);
      const dy = Math.abs(mineral.y - keg.y);
      const distance = definition.radius ? Math.hypot(dx, dy) - definition.radius
        : Math.hypot(Math.max(0, dx - definition.width / 2), Math.max(0, dy - definition.height / 2));
      if (distance > radius) continue;
      mineral.status = "destroyed";
      destroyedIds.push(mineral.id);
    }
    run.hook.phase = "returning-empty";
    run.hook.carryingId = null;
    // 范围内的物体直接销毁，不结算奖励或惩罚；其他桶不继续引爆。
    const event = { type: "exploded", id: keg.id, mineralType: keg.type,
      point: { x: keg.x, y: keg.y }, radius, destroyedIds };
    growth.recordEvent(run, event);
    events.push(event);
  }

  function stepHook(run, seconds, config, events, endsAtDeadline) {
    const hook = run.hook;
    if (hook.phase === "swinging") {
      hook.angle += config.hook.swingSpeed * seconds * hook.swingDirection;
      if (hook.angle > config.hook.maxAngle) {
        hook.angle = 2 * config.hook.maxAngle - hook.angle;
        hook.swingDirection = -1;
      } else if (hook.angle < config.hook.minAngle) {
        hook.angle = 2 * config.hook.minAngle - hook.angle;
        hook.swingDirection = 1;
      }
      return;
    }
    if (hook.phase === "extending") {
      const previousLength = hook.length;
      const limit = maximumLength(hook.angle, config);
      hook.length = Math.min(limit, previousLength + config.hook.extendSpeed * seconds);
      const hit = firstHit(hookPoint(hook, config, previousLength), hookPoint(hook, config), run.minerals, config);
      if (hit) {
        hook.length = previousLength + (hook.length - previousLength) * hit.t;
        if (hit.mineral.type === "powderKeg") {
          if (!endsAtDeadline || hit.t < 1 - 1e-9) explodePowderKeg(run, hit.mineral, config, events);
          return;
        }
        hook.phase = "returning-loaded";
        hook.carryingId = hit.mineral.id;
        hit.mineral.status = "carried";
        const event = { type: "grabbed", id: hit.mineral.id, mineralType: hit.mineral.type };
        growth.recordEvent(run, event);
        events.push(event);
      } else if (hook.length >= limit) {
        hook.phase = "returning-empty";
      }
      return;
    }
    if (hook.phase === "returning-loaded" || hook.phase === "returning-empty") {
      const mineral = run.minerals.find((item) => item.id === hook.carryingId);
      const speed = mineral ? config.minerals[mineral.type].returnSpeed * (run.effects.strength ? config.shop.strength.multiplier : 1) : config.hook.emptyReturnSpeed;
      const arrivalSeconds = hook.length / speed;
      hook.length = Math.max(0, hook.length - speed * seconds);
      // 同时到达锚点和截止时刻时，优先结束关卡，避免超时补入账。
      if (arrivalSeconds <= seconds && (!endsAtDeadline || arrivalSeconds < seconds - 1e-9)) {
        if (mineral) bankCarriedMineral(run, config, events);
        else {
          const event = { type: "empty-returned" };
          growth.recordEvent(run, event);
          events.push(event);
        }
        resetHook(hook, config);
      }
    }
  }

  function settleRun(run, config, events) {
    if (run.settled) return false;
    const target = run.level.target;
    const success = run.levelIncome >= target;
    if (success) run.totalIncome += run.levelIncome;
    const inTransit = run.minerals.find((mineral) => mineral.id === run.hook.carryingId);
    if (inTransit) inTransit.status = "lost";
    run.remainingTime = 0;
    run.settled = true;
    run.hook.phase = "stopped";
    run.hook.carryingId = null;
    run.effects = emptyEffects();
    run.result = { success, levelIncome: run.levelIncome, target, totalIncome: run.totalIncome };
    const event = { type: "settled", ...run.result };
    growth.recordEvent(run, event);
    events.push(event);
    return true;
  }

  function advanceRun(run, elapsedSeconds, config) {
    const events = [];
    if (run.settled || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return events;
    let left = elapsedSeconds;
    // 收回时刻也是时间事件边界，先消费真实时间，再应用奖励或惩罚。
    // 动态延时必须改变本次长帧的截止点，不能使用进入帧时的旧时间预算。
    while (left > 1e-12 && !run.settled) {
      if (run.remainingTime <= 1e-9) { settleRun(run, config, events); break; }
      let step = Math.min(left, config.simulation.maxStepSeconds, run.remainingTime);
      if (["returning-loaded", "returning-empty"].includes(run.hook.phase)) {
        const mineral = run.minerals.find(item => item.id === run.hook.carryingId);
        const speed = mineral ? config.minerals[mineral.type].returnSpeed * (run.effects.strength ? config.shop.strength.multiplier : 1) : config.hook.emptyReturnSpeed;
        if (run.hook.length > 0) step = Math.min(step, run.hook.length / speed);
      }
      run.remainingTime = Math.max(0, run.remainingTime - step);
      run.elapsedTime += step;
      stepHook(run, step, config, events, run.remainingTime <= 1e-9);
      left = Math.max(0, left - step);
      if (run.remainingTime <= 1e-9) settleRun(run, config, events);
    }
    return events;
  }

  return Object.freeze({ createLevel, levelParameters, verifyRoute, validPlacement, protectsRoute, resolveReward, createRun,
    captureEntrySnapshot, restoreEntrySnapshot, captureCheckpoint, restoreCheckpoint, createShop, shopPrice, purchaseAvailability,
    purchaseItem, canUseDynamite, useDynamite, hookPoint, maximumLength, segmentCircle, segmentRectangle, firstHit, launchHook, advanceRun });
});
