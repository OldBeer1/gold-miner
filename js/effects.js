(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerEffects = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function createState() {
    return { time: 0, particles: [], labels: [] };
  }

  function advance(state, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    state.time += seconds;
    for (const collection of [state.particles, state.labels]) {
      for (const item of collection) item.age += seconds;
    }
    state.particles = state.particles.filter(item => item.age < item.life);
    state.labels = state.labels.filter(item => item.age < item.life);
  }

  function burst(state, point, colors, count, explosive) {
    for (let i = 0; i < count; i += 1) {
      const angle = i * Math.PI * 2 / count;
      const speed = explosive ? 65 + (i % 3) * 32 : 45 + (i % 3) * 18;
      state.particles.push({
        x: point.x, y: point.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (explosive ? 10 : 65),
        gravity: explosive ? 90 : 180,
        size: explosive ? 4 + (i % 2) * 2 : 4,
        color: colors[i % colors.length],
        life: explosive ? .45 : .65, age: 0,
      });
    }
    state.particles = state.particles.slice(-64);
  }

  function harvest(state, point, value, palette) {
    burst(state, point, [palette.gold, palette.goldLight, palette.goldShadow], 10, false);
    state.labels.push({ x: point.x + 56, y: point.y + 34, text: `+¥${value}`, color: palette.goldLight, life: .95, age: 0 });
    state.labels = state.labels.slice(-4);
  }

  function explode(state, point, palette) {
    burst(state, point, [palette.goldLight, palette.gold, palette.shirtLight, palette.shirt], 16, true);
  }

  function message(state, point, text, color) {
    state.labels.push({ x: point.x, y: point.y, text, color, life: .95, age: 0 });
    state.labels = state.labels.slice(-4);
  }

  return Object.freeze({ createState, advance, harvest, explode, message });
});
