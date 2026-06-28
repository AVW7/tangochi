// ===========================================================
// sim.js — the simulation: needs, decay, mood, day/night,
// evolution, sickness, offline progression, economy helpers.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const C = TG.CONFIG;
  let neglectMins = 0; // sustained-neglect accumulator for sickness

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ── DAY / NIGHT ─────────────────────────────────────────
  function currentPhase() {
    const h = new Date().getHours();
    let phase = TG.DAY_PHASES[0];
    for (const p of TG.DAY_PHASES) if (h >= p.from) phase = p;
    return phase;
  }
  function isNight() {
    const n = currentPhase().name;
    return n === 'night' || n === 'evening';
  }

  // ── OFFLINE PROGRESSION ─────────────────────────────────
  // Apply elapsed real time once, on load, capped to avoid harsh punishment.
  function applyOffline() {
    const S = TG.STATE;
    const now = Date.now();
    const mins = Math.min((now - (S.lastSeen || now)) / 60000, C.maxOfflineHours * 60);
    if (mins > 1) {
      decayNeeds(mins, /*offline*/ true);
      S.mood = recalcMood();
    }
    // Session + streak bookkeeping.
    S.sessions++;
    const tk = TG.state.todayKey();
    if (S.streak.lastDay !== tk) {
      const yest = TG.state.todayKey(now - 86400000);
      S.streak.count = (S.streak.lastDay === yest) ? S.streak.count + 1 : 1;
      S.streak.lastDay = tk;
    }
    return mins;
  }

  // ── NEEDS DECAY ─────────────────────────────────────────
  function decayNeeds(mins, offline) {
    const S = TG.STATE, n = S.needs, d = C.decayPerMin;
    const resting = S.mood === 'sleeping';
    n.hunger    = clamp(n.hunger    - d.hunger    * mins, 0, 100);
    n.hygiene   = clamp(n.hygiene   - d.hygiene   * mins, 0, 100);
    n.energy    = clamp(n.energy + (resting ? C.energyRegenPerMin : -d.energy) * mins, 0, 100);
    // Happiness sags when other needs are low; recovers slowly when all is well.
    const avgOther = (n.hunger + n.energy + n.hygiene) / 3;
    const happyDrift = avgOther > 60 ? +0.2 : -d.happiness;
    n.happiness = clamp(n.happiness + happyDrift * mins, 0, 100);

    updateCare(mins);
    updateHealth(mins, offline);
  }

  // Care score is a slow rolling average of how satisfied needs are.
  function updateCare(mins) {
    const S = TG.STATE, n = S.needs;
    const avg = (n.hunger + n.energy + n.happiness + n.hygiene) / 4;
    const a = Math.min(1, mins / 240);     // ease toward current avg
    S.careScore = clamp(S.careScore + (avg - S.careScore) * a, 0, 100);
  }

  function updateHealth(mins, offline) {
    const S = TG.STATE, n = S.needs;
    const critical = Math.min(n.hunger, n.energy, n.happiness, n.hygiene) < C.sickIfNeedBelow;
    if (critical) {
      neglectMins += mins;
      if (neglectMins >= C.sickAfterMins && S.health === 'ok') {
        S.health = 'sick';
        if (!offline) TG.events && TG.events.emit('sick');
      }
    } else {
      neglectMins = Math.max(0, neglectMins - mins * 0.5);
    }
    // Sickness drags skill stats down gently until cured.
    if (S.health === 'sick') {
      ['speed', 'patience'].forEach(k => {
        S.stats[k] = clamp(S.stats[k] - 0.2 * mins, 0, 100);
      });
    }
  }

  function cure() {
    TG.STATE.health = 'ok';
    neglectMins = 0;
  }

  // ── MOOD ────────────────────────────────────────────────
  function recalcMood() {
    const S = TG.STATE, n = S.needs, s = S.stats;
    if (S.health === 'sick') return 'sick';
    if (n.hunger < 22) return 'hungry';
    if (n.energy < 18) return 'sleeping';

    const avg = (s.debugging + s.patience + s.chaos + s.wisdom + s.speed) / 5;
    const wellbeing = (n.hunger + n.energy + n.happiness + n.hygiene) / 4;

    if (wellbeing < 30) return 'sad';
    if (s.chaos > 80) return 'angry';
    if (wellbeing > 85 && avg > 75) return 'celebrating';
    if (isNight() && n.energy < 45) return 'sleeping';
    if (s.patience > 70 && s.wisdom > 60) return 'focused';
    if (s.speed > 75 && s.debugging > 60) return 'excited';
    if (wellbeing > 55) return 'happy';
    return 'focused';
  }

  // ── EVOLUTION ───────────────────────────────────────────
  function evalStage() {
    const S = TG.STATE, e = C.evolution;
    let stage = 'baby';
    if (S.level >= e.juvenile.level && S.careScore >= e.juvenile.care) stage = 'juvenile';
    if (S.level >= e.adult.level && S.careScore >= e.adult.care) stage = 'adult';
    if (stage !== S.stage) {
      const order = { baby: 0, juvenile: 1, adult: 2 };
      if (order[stage] > order[S.stage]) {  // only evolve forward
        S.stage = stage;
        TG.events && TG.events.emit('evolve', stage);
        return stage;
      }
    }
    return null;
  }

  function stageScale() {
    return ({ baby: 0.72, juvenile: 0.88, adult: 1.0 })[TG.STATE.stage] || 1;
  }

  // ── ECONOMY / XP ────────────────────────────────────────
  function gainXP(amount) {
    const S = TG.STATE;
    S.xp += amount;
    let needed = S.level * C.xpPerLevelBase;
    while (S.xp >= needed) {
      S.xp -= needed;
      S.level++;
      TG.events && TG.events.emit('levelup', S.level);
      needed = S.level * C.xpPerLevelBase;
    }
    evalStage();
  }

  function gainCoins(amount) {
    TG.STATE.coins += amount;
    if (amount > 0) TG.events && TG.events.emit('coins', amount);
  }

  // Live tick called from the loop roughly once per simulated minute.
  function liveDecay(realMins) {
    decayNeeds(realMins, false);
    TG.STATE.mood = recalcMood();
  }

  TG.sim = {
    clamp, currentPhase, isNight, applyOffline, decayNeeds, liveDecay,
    recalcMood, evalStage, stageScale, gainXP, gainCoins, cure,
  };
})();
