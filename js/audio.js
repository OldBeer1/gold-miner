(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldMinerAudio = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const melodies = {
    button: [[620, 800, 0, .055, "square"]],
    launch: [[560, 150, 0, .16, "sawtooth"]],
    grab: [[240, 100, 0, .08, "triangle"]],
    harvest: [[660, 660, 0, .1, "square"], [880, 880, .08, .1, "square"], [1320, 1320, .16, .14, "triangle"]],
    explode: [[100, 22, 0, .3, "sawtooth"], [65, 25, .02, .24, "triangle"]],
    success: [[523, 523, 0, .13, "square"], [659, 659, .12, .13, "square"], [784, 784, .24, .13, "square"], [1047, 1047, .36, .24, "triangle"]],
    failure: [[330, 330, 0, .16, "triangle"], [247, 247, .14, .16, "triangle"], [165, 120, .28, .23, "triangle"]],
  };

  function createPlayer(contextFactory = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    return new Context();
  }) {
    let context = null;
    let master = null;
    let enabled = true;
    let unavailable = false;
    const voices = new Set();
    const counts = {};

    function stopAll() {
      for (const voice of voices) {
        try { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); } catch { /* 已自然结束的声音可能拒绝再次停止。 */ }
      }
      voices.clear();
    }

    function unlock() {
      if (!enabled || unavailable) return;
      try {
        if (!context) {
          context = contextFactory();
          master = context.createGain();
          master.gain.value = .055;
          master.connect(context.destination);
        }
        if (context.state === "suspended") context.resume().catch(() => {});
      } catch {
        unavailable = true;
        stopAll();
      }
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      if (master) master.gain.value = enabled ? .055 : 0;
      if (!enabled) stopAll();
    }

    function tone(frequency, endFrequency, offset, duration, wave) {
      const source = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      source.type = wave;
      source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.8, start + .006);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      source.connect(gain);
      gain.connect(master);
      const voice = { source, gain };
      voices.add(voice);
      source.onended = () => {
        voices.delete(voice);
        source.disconnect();
        gain.disconnect();
      };
      source.start(start);
      source.stop(start + duration + .015);
    }

    function play(name) {
      if (!enabled || unavailable || !context || !melodies[name]) return false;
      try {
        // 只合成短音效，无背景循环；暂停与静音仍会立即清理未结束的节点。
        for (const note of melodies[name]) tone(...note);
        counts[name] = (counts[name] || 0) + 1;
        return true;
      } catch {
        unavailable = true;
        stopAll();
        return false;
      }
    }

    return Object.freeze({
      unlock, setEnabled, play, stopAll,
      getDiagnostics() { return { initialized: Boolean(context), unavailable, enabled, contextState: context?.state || "uninitialized", activeVoices: voices.size, counts: { ...counts } }; },
    });
  }

  return Object.freeze({ createPlayer });
});
