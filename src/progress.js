// ===========================================================
// progress.js — achievements + daily quests + streak rewards.
// Subscribes to the event bus and reconciles state.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const S = () => TG.STATE;

  // ── ACHIEVEMENTS ────────────────────────────────────────
  function unlock(id) {
    const s = S();
    if (s.achievements[id]) return;
    s.achievements[id] = Date.now();
    const a = TG.ACHIEVEMENTS[id];
    TG.sim.gainCoins(15);
    TG.audio.play('levelup');
    TG.ui.toast(`🏆 ${a.name}  (+15)`);
    TG.events.emit('achievement', id);
    TG.ui.refresh();
  }

  function check() {
    const s = S();
    if (s.counters.feeds >= 1) unlock('firstFeed');
    if (s.level >= 5) unlock('level5');
    if (s.stage === 'adult') unlock('adult');
    if (s.counters.bugs >= 10) unlock('bug10');
    if (s.counters.bugs >= 50) unlock('bug50');
    if (s.coins >= 200) unlock('rich');
    if (s.unlockedSpecies.length >= 6) unlock('collector');
    if (s.placed.length >= 4) unlock('decorator');
    const n = s.needs;
    if (n.hunger > 90 && n.energy > 90 && n.happiness > 90 && n.hygiene > 90) unlock('fullCare');
    if (s.streak.count >= 3) unlock('streak3');
  }

  // ── DAILY QUESTS ────────────────────────────────────────
  function ensureDaily() {
    const s = S();
    const today = TG.state.todayKey();
    if (s.quests && s.quests.day === today) return;
    // sample 3 distinct quests
    const pool = TG.QUEST_POOL.slice();
    const list = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const q = pool.splice(TG.util.randInt(0, pool.length - 1), 1)[0];
      list.push({ id: q.id, prog: 0, done: false });
    }
    s.quests = { day: today, list };
    TG.state.save();
  }

  function questDef(id) { return TG.QUEST_POOL.find(q => q.id === id); }

  function progress(track, amount) {
    const s = S();
    if (!s.quests) return;
    let changed = false;
    for (const q of s.quests.list) {
      const def = questDef(q.id);
      if (!def || def.track !== track || q.done) continue;
      q.prog = Math.min(def.goal, q.prog + (amount || 1));
      if (q.prog >= def.goal) {
        q.done = true;
        TG.sim.gainCoins(def.reward);
        TG.audio.play('coin');
        TG.ui.toast(`✅ Quest: ${def.desc} (+${def.reward})`);
      }
      changed = true;
    }
    if (changed) { TG.ui.refresh(); TG.state.save(); }
  }

  // ── WIRE EVENTS ─────────────────────────────────────────
  function init() {
    ensureDaily();
    TG.events.on('quest:feeds',   () => progress('feeds'));
    TG.events.on('quest:plays',   () => progress('plays'));
    TG.events.on('quest:cleans',  () => progress('cleans'));
    TG.events.on('quest:bugWins', () => progress('bugWins'));
    TG.events.on('action:feed',   () => check());
    TG.events.on('bug:squashed',  () => check());
    TG.events.on('coins',         () => check());

    TG.events.on('levelup', (lvl) => {
      TG.audio.play('levelup');
      TG.particles.confetti(TG.iso.petScreen().x, TG.iso.petScreen().y - 20);
      TG.ui.toast(`⬆ LEVEL UP!  LVL ${lvl}`);
      check();
    });
    TG.events.on('evolve', (stage) => {
      TG.audio.play('evolve');
      TG.particles.confetti(TG.iso.petScreen().x, TG.iso.petScreen().y - 20);
      TG.ui.toast(`✨ EVOLVED → ${stage.toUpperCase()}`);
      TG.ui.speak('i grew up!');
      check();
    });
    TG.events.on('sick', () => { TG.ui.toast('🤒 your pet is sick! use a MEDKIT or rest'); });

    // happiness>=80 quest is checked each refresh
    TG.events.on('refresh', () => {
      if (S().needs.happiness >= 80) progress('happy80');
    });
    check();
  }

  TG.progress = { init, check, ensureDaily, progress, unlock };
})();
