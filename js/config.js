(() => {
  "use strict";

  const config = {
    version: "1.5.3",
    rulesVersion: "1.5.3",
    canvas: { width: 960, height: 640 },
    mine: { x: 24, y: 160, width: 912, height: 456 },
    miner: { anchor: { x: 480, y: 112 } },
    hook: {
      captureRadius: 8,
      restLength: 60,
      minAngle: -75,
      maxAngle: 75,
      swingSpeed: 65,
      extendSpeed: 520,
      emptyReturnSpeed: 650,
    },
    levelDuration: 60,
    simulation: { maxStepSeconds: 1 / 120 },
    initialRun: { wallet: 0, bombs: 1, totalIncome: 0 },
    minerals: {
      smallGold: { label: "小金块", value: 100, returnSpeed: 220, radius: 20 },
      largeGold: { label: "大金块", value: 300, returnSpeed: 110, radius: 27 },
      stone: { label: "石头", value: 20, returnSpeed: 75, radius: 23 },
      diamond: { label: "钻石", value: 250, returnSpeed: 270, width: 30, height: 36 },
      ruby: { label: "红宝石", value: 350, returnSpeed: 240, width: 30, height: 36 },
      mysteryBag: { label: "神秘钱袋", value: 0, returnSpeed: 200, width: 36, height: 42 },
      treasureChest: { label: "宝箱", value: 0, returnSpeed: 100, width: 34, height: 28 },
      cursedRelic: { label: "诅咒古物", value: 500, returnSpeed: 130, width: 26, height: 30 },
      powderKeg: { label: "火药桶", value: 0, returnSpeed: 90, width: 26, height: 34, blastRadius: 80 },
    },
    legacyMineralSizes: { smallGold: { radius: 14 }, diamond: { width: 20, height: 24 }, ruby: { width: 20, height: 24 }, mysteryBag: { width: 24, height: 28 } },
    shop: {
      dynamite: { label: "炸药", description: "毁掉拖拽物，快速收钩", price: 100, maxInventory: 5 },
      strength: { label: "力量药水", description: "下一关带物回收速度 ×1.5", price: 200, multiplier: 1.5, maxPerVisit: 1 },
      diamondBoost: { label: "钻石增值剂", description: "下一关钻石价值 ×1.5", price: 200, multiplier: 1.5, maxPerVisit: 1 },
      timeCoupon: { label: "延时券", description: "下一关初始时间 +10 秒", price: 300, seconds: 10, maxPerVisit: 1 },
      goldBoost: { label: "黄金增值剂", description: "下一关大小金块价值 ×1.5", price: 250, multiplier: 1.5, maxPerVisit: 1 },
      protectionCharm: { label: "护身符", description: "下一关抵消一次扣时间效果", price: 180, maxPerVisit: 1 },
      luckyCharm: { label: "幸运符", description: "下一关钱袋、宝箱奖励更幸运", price: 220, maxPerVisit: 1 },
    },
    survival: {
      maxDifficulty: 9, baseTarget: 650, targetStep: 150,
      baseCount: 23, maxAttempts: 30, placementAttempts: 100,
      targets: [650, 800, 950, 1200, 1400, 1600, 1800, 1950, 2050, 2100],
      stageIncomeGrowth: .25, stageTargetBonus: 80, stageDepthBonus: 24,
      warmupPriceGrowth: .14, stagePriceGrowth: .22,
      routeAngles: [-60, -45, -30, -15, 0, 15, 30, 45, 60],
      obstacleIndices: [3, 5, 1, 7, 4],
      scatter: { minimumWidth: 560, minimumHeight: 260, minimumDistanceRange: 220,
        obstacleFraction: .62, valuableExtraMinimumY: 400, fallbackTemplates: 64 },
      density: { types: ["smallGold", "smallGold", "smallGold", "smallGold", "diamond", "ruby", "mysteryBag", "mysteryBag"],
        x: 60, y: 210, cellWidth: 280, cellHeight: 125, gemstoneMinimumY: 400 },
      maxTimeBonus: 20, shopSlots: 4, maxPurchases: 4,
      newTypes: ["ruby", "mysteryBag", "treasureChest", "cursedRelic", "powderKeg"],
      bagRewards: [
        { kind: "coins", amount: 50, weight: 35, luckyWeight: 20 },
        { kind: "coins", amount: 200, weight: 35, luckyWeight: 40 },
        { kind: "bomb", amount: 1, weight: 15, luckyWeight: 20 },
        { kind: "time", amount: 5, weight: 10, luckyWeight: 20 },
        { kind: "time", amount: -5, weight: 5, luckyWeight: 0 },
      ],
      chestRewards: [
        { kind: "coins", amount: 150, weight: 50, luckyWeight: 20 },
        { kind: "coins", amount: 450, weight: 35, luckyWeight: 50 },
        { kind: "coins", amount: 800, weight: 15, luckyWeight: 30 },
      ],
    },
    events: {
      firstLevel: 5, interval: 5, probability: .6,
      definitions: {
        none: { name: "普通矿层", description: "沿用普通矿层规则", targetMultiplier: 1, rewardMultiplier: 1, countDelta: 0, maxPowderKegs: 2 },
        goldRush: { name: "黄金热潮", description: "额外金块与石头，深处收益和清障机会增加", targetMultiplier: 1, rewardMultiplier: 1, countDelta: 2, maxPowderKegs: 2 },
        diamondVein: { name: "钻石矿脉", description: "两条小金块路线变为钻石，目标提高 8%", targetMultiplier: 1.08, rewardMultiplier: 1, countDelta: 0, maxPowderKegs: 2 },
        unstable: { name: "地质不稳定", description: "至少两个火药桶，最多四个；接触即爆炸，请谨慎瞄准", targetMultiplier: 1, rewardMultiplier: 1, countDelta: 2, maxPowderKegs: 4 },
        blackMarket: { name: "黑市", description: "本次补给炸药价格 ×0.75，其他商品 ×1.25；矿层规则不变", targetMultiplier: 1, rewardMultiplier: 1, countDelta: 0, maxPowderKegs: 2 },
        sparse: { name: "贫瘠矿层", description: "减少四个额外物体，金币收入 ×1.12，目标 ×1.08", targetMultiplier: 1.08, rewardMultiplier: 1.12, countDelta: -4, maxPowderKegs: 2 },
      },
    },
    palette: {
      sky: "#9bbaad", skyLight: "#bdd1b4", mountain: "#7a9b8d",
      grass: "#6f8a4b", grassLight: "#9caf61", surface: "#8c6947",
      soil: "#49372e", soilDeep: "#322922", strata: "#584033",
      stone: "#7b8989", stoneLight: "#a0aaa6", stoneShadow: "#526166",
      gold: "#efb94f", goldLight: "#ffe3a0", goldShadow: "#a7752d",
      diamond: "#73d0d4", diamondLight: "#d4f6ed", diamondShadow: "#408caa",
      wood: "#b7844b", woodShadow: "#73502e", rope: "#efe0af",
      skin: "#e9bd86", shirt: "#b95538", shirtLight: "#df8150", dark: "#263238",
    },
  };

  function freezeTree(value) {
    Object.values(value).forEach((child) => {
      if (child && typeof child === "object") freezeTree(child);
    });
    return Object.freeze(value);
  }

  const frozenConfig = freezeTree(config);
  if (typeof module === "object" && module.exports) module.exports = frozenConfig;
  else window.GoldMinerConfig = frozenConfig;
})();
