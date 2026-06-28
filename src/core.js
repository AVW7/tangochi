// ===========================================================
// core.js — tiny event bus + shared helpers. Loaded first.
// ===========================================================
window.TG = window.TG || {};

// Minimal pub/sub so modules stay decoupled (sim emits, ui/audio listen).
TG.events = (function () {
  const map = {};
  return {
    on(name, fn) { (map[name] = map[name] || []).push(fn); },
    emit(name, payload) { (map[name] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); },
  };
})();

TG.util = {
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  reduced: () => TG.STATE && TG.STATE.settings && TG.STATE.settings.reducedMotion,
};
