// ===========================================================
// minigame.js — "BUG HUNT": tap bugs that scuttle across the
// room before time runs out. Earns coins + debugging XP.
// Bugs are rendered by iso.js (depth-sorted); this module owns
// their lifecycle, hit-testing, scoring and rewards.
// ===========================================================
window.TG = window.TG || {};

(function () {
  let running = false;
  let timeLeft = 0;       // ms
  let score = 0;
  let spawnTimer = 0;
  let list = [];          // [{col,row,t,ttl,id}]
  let nextId = 1;
  const DURATION = 20000;

  function active() { return running; }
  function bugs() { return list; }
  function getScore() { return score; }
  function timeRemaining() { return Math.max(0, timeLeft); }

  function start() {
    if (running) return;
    running = true;
    timeLeft = DURATION;
    score = 0;
    spawnTimer = 0;
    list = [];
    TG.audio.ensure();
    TG.events.emit('minigame:start');
  }

  function spawnBug() {
    const G = TG.iso.GRID;
    list.push({
      id: nextId++,
      col: TG.util.randInt(0, G - 1),
      row: TG.util.randInt(0, G - 1),
      t: 0,
      ttl: TG.util.rand(1400, 2600), // ms before it escapes
    });
  }

  function update(dt) {
    if (!running) return;
    timeLeft -= dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && list.length < 5) {
      spawnBug();
      spawnTimer = TG.util.rand(400, 900);
    }
    for (const b of list) { b.t += dt / 200; b.ttl -= dt; }
    list = list.filter(b => b.ttl > 0);
    if (timeLeft <= 0) end();
  }

  // Returns true if a bug was hit (so the click isn't also a "pet").
  function handleClick(px, py) {
    if (!running) return false;
    let hit = null, best = 22;
    for (const b of list) {
      const c = TG.iso.tileCenter(b.col, b.row);
      const d = Math.hypot(px - c.x, py - (c.y - 8));
      if (d < best) { best = d; hit = b; }
    }
    if (hit) {
      list = list.filter(b => b.id !== hit.id);
      score++;
      const c = TG.iso.tileCenter(hit.col, hit.row);
      TG.particles.sparks(c.x, c.y - 8);
      TG.audio.play('squash');
      TG.STATE.counters.bugs++;
      TG.events.emit('bug:squashed');
      return true;
    }
    return false;
  }

  function end() {
    running = false;
    list = [];
    const coins = score * 3;
    TG.sim.gainCoins(coins);
    TG.sim.gainXP(score * 4);
    TG.STATE.stats.debugging = TG.util.clamp(TG.STATE.stats.debugging + Math.min(20, score * 2), 0, 100);
    if (score >= 5) { TG.STATE.counters.bugWins++; TG.events.emit('quest:bugWins'); }
    TG.audio.play(score >= 5 ? 'win' : 'coin');
    TG.events.emit('minigame:end', { score, coins });
  }

  TG.minigame = { active, bugs, start, update, handleClick, getScore, timeRemaining };
})();
