// ===========================================================
// state.js — persistent state: defaults, load/save, migration
// ===========================================================
window.TG = window.TG || {};

(function () {
  const C = TG.CONFIG;

  function defaultState() {
    return {
      v: C.SAVE_VERSION,
      species: 'robot',
      level: 1,
      xp: 0,
      mood: 'happy',
      stage: 'baby',
      health: 'ok',
      stats:  { debugging: 50, patience: 50, chaos: 30, wisdom: 60, speed: 55 },
      needs:  { hunger: 80, energy: 80, happiness: 75, hygiene: 80 },
      careScore: 50,
      coins: 25,
      inventory: {},                 // { itemId: count }
      placed: [],                    // [{ item, col, row }]
      unlockedSpecies: TG.STARTER_SPECIES.slice(),
      achievements: {},              // { id: timestamp }
      counters: { bugs: 0, feeds: 0, plays: 0, cleans: 0, bugWins: 0 },
      quests: null,                  // { day, list:[{id,prog,done}] }
      streak: { count: 1, lastDay: todayKey() },
      lastFed: null,
      lastSeen: Date.now(),
      sessions: 1,
      created: Date.now(),
      settings: { sound: true, reducedMotion: prefersReducedMotion() },
    };
  }

  function todayKey(ts) {
    const d = ts ? new Date(ts) : new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  // Bring any older save up to the current schema without losing progress.
  function migrate(s) {
    if (!s || typeof s !== 'object') return defaultState();
    const base = defaultState();

    // v1 had no version field, no needs/coins/etc.
    if (!s.v || s.v < 2) {
      s.needs = base.needs;
      s.coins = base.coins;
      s.stage = 'baby';
      s.health = 'ok';
    }
    if (!s.v || s.v < 3) {
      s.inventory = s.inventory || {};
      s.placed = s.placed || [];
      s.unlockedSpecies = s.unlockedSpecies || TG.STARTER_SPECIES.slice();
      s.achievements = s.achievements || {};
      s.counters = s.counters || base.counters;
      s.careScore = s.careScore == null ? 50 : s.careScore;
      s.streak = s.streak || base.streak;
      s.settings = s.settings || base.settings;
      s.lastSeen = s.lastSeen || Date.now();
    }

    // Make sure every expected key exists (forward-compatible).
    const merged = Object.assign({}, base, s);
    merged.stats    = Object.assign({}, base.stats, s.stats);
    merged.needs    = Object.assign({}, base.needs, s.needs);
    merged.counters = Object.assign({}, base.counters, s.counters);
    merged.settings = Object.assign({}, base.settings, s.settings);
    // Always ensure starter species are unlocked.
    TG.STARTER_SPECIES.forEach(sp => {
      if (!merged.unlockedSpecies.includes(sp)) merged.unlockedSpecies.push(sp);
    });
    merged.v = C.SAVE_VERSION;
    return merged;
  }

  function load() {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.warn('save load failed', e); }
    return defaultState();
  }

  function save() {
    try {
      TG.STATE.lastSeen = Date.now();
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(TG.STATE));
    } catch (e) { console.warn('save failed', e); }
  }

  function reset() {
    TG.STATE = defaultState();
    save();
  }

  TG.state = { defaultState, load, save, reset, migrate, todayKey };
  TG.STATE = load();
})();
