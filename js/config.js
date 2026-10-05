(() => {
  "use strict";

  const config = {
    version: "1.4.0",
    canvas: { width: 960, height: 640 },
    mine: { x: 24, y: 160, width: 912, height: 456 },
    miner: { anchor: { x: 480, y: 112 } },
    hook: {
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
      smallGold: { label: "小金块", value: 100, returnSpeed: 220, radius: 14 },
      largeGold: { label: "大金块", value: 300, returnSpeed: 110, radius: 27 },
      stone: { label: "石头", value: 20, returnSpeed: 75, radius: 23 },
      diamond: { label: "钻石", value: 250, returnSpeed: 270, width: 20, height: 24 },
      ruby: { label: "红宝石", value: 350, returnSpeed: 240, width: 20, height: 24 },
      mysteryBag: { label: "神秘钱袋", value: 0, returnSpeed: 200, width: 24, height: 28 },
      treasureChest: { label: "宝箱", value: 0, returnSpeed: 100, width: 34, height: 28 },
      cursedRelic: { label: "诅咒古物", value: 500, returnSpeed: 130, width: 26, height: 30 },
      powderKeg: { label: "火药桶", value: 0, returnSpeed: 90, width: 26, height: 34, blastRadius: 80 },
    },
    levels: [
      {
        id: 1,
        target: 650,
        counts: { smallGold: 5, largeGold: 3, stone: 3, diamond: 1 },
        layout: [
          { id: "l1-g1", type: "smallGold", x: 290, y: 225 },
          { id: "l1-g2", type: "smallGold", x: 635, y: 240 },
          { id: "l1-g3", type: "smallGold", x: 195, y: 350 },
          { id: "l1-g4", type: "smallGold", x: 740, y: 380 },
          { id: "l1-g5", type: "smallGold", x: 425, y: 430 },
          { id: "l1-big1", type: "largeGold", x: 390, y: 305 },
          { id: "l1-big2", type: "largeGold", x: 550, y: 410 },
          { id: "l1-big3", type: "largeGold", x: 305, y: 525 },
          { id: "l1-r1", type: "stone", x: 520, y: 255 },
          { id: "l1-r2", type: "stone", x: 660, y: 480 },
          { id: "l1-r3", type: "stone", x: 815, y: 500 },
          { id: "l1-d1", type: "diamond", x: 475, y: 550 },
        ],
      },
      {
        id: 2, target: 1000,
        counts: { smallGold: 4, largeGold: 3, stone: 5, diamond: 3 },
        layout: [
          { id: "l2-g1", type: "smallGold", x: 270, y: 235 },
          { id: "l2-g2", type: "smallGold", x: 730, y: 300 },
          { id: "l2-g3", type: "smallGold", x: 530, y: 365 },
          { id: "l2-g4", type: "smallGold", x: 820, y: 540 },
          { id: "l2-big1", type: "largeGold", x: 330, y: 360 },
          { id: "l2-big2", type: "largeGold", x: 610, y: 440 },
          { id: "l2-big3", type: "largeGold", x: 390, y: 545 },
          { id: "l2-r1", type: "stone", x: 480, y: 260 },
          { id: "l2-r2", type: "stone", x: 300, y: 455 },
          { id: "l2-r3", type: "stone", x: 690, y: 370 },
          { id: "l2-r4", type: "stone", x: 170, y: 380 },
          { id: "l2-r5", type: "stone", x: 570, y: 550 },
          { id: "l2-d1", type: "diamond", x: 650, y: 235 },
          { id: "l2-d2", type: "diamond", x: 765, y: 425 },
          { id: "l2-d3", type: "diamond", x: 190, y: 500 },
        ],
      },
      {
        id: 3, target: 1400,
        counts: { smallGold: 4, largeGold: 4, stone: 6, diamond: 4 },
        layout: [
          { id: "l3-g1", type: "smallGold", x: 285, y: 240 },
          { id: "l3-g2", type: "smallGold", x: 725, y: 295 },
          { id: "l3-g3", type: "smallGold", x: 355, y: 300 },
          { id: "l3-g4", type: "smallGold", x: 555, y: 600 },
          { id: "l3-big1", type: "largeGold", x: 295, y: 405 },
          { id: "l3-big2", type: "largeGold", x: 625, y: 450 },
          { id: "l3-big3", type: "largeGold", x: 425, y: 565 },
          { id: "l3-big4", type: "largeGold", x: 745, y: 555 },
          { id: "l3-r1", type: "stone", x: 475, y: 250 },
          { id: "l3-r2", type: "stone", x: 635, y: 350 },
          { id: "l3-r3", type: "stone", x: 190, y: 430 },
          { id: "l3-r4", type: "stone", x: 380, y: 465 },
          { id: "l3-r5", type: "stone", x: 805, y: 425 },
          { id: "l3-r6", type: "stone", x: 590, y: 535 },
          { id: "l3-d1", type: "diamond", x: 650, y: 240 },
          { id: "l3-d2", type: "diamond", x: 210, y: 320 },
          { id: "l3-d3", type: "diamond", x: 535, y: 350 },
          { id: "l3-d4", type: "diamond", x: 175, y: 565 },
        ],
      },
    ],
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
      baseCount: 15, maxAttempts: 30, placementAttempts: 100,
      targets: [650, 800, 950, 1200, 1400, 1600, 1800, 1950, 2050, 2100],
      stageIncomeGrowth: .25, stageTargetBonus: 80, stageDepthBonus: 24,
      warmupPriceGrowth: .14, stagePriceGrowth: .22,
      routeAngles: [-60, -45, -30, -15, 0, 15, 30, 45, 60],
      obstacleIndices: [3, 5, 1, 7, 4],
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
