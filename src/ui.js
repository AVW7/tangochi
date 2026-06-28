// ===========================================================
// ui.js — all DOM rendering + wiring (panels, bars, buttons).
// ===========================================================
window.TG = window.TG || {};

(function () {
  const $ = id => document.getElementById(id);
  const S = () => TG.STATE;
  let bubbleTimer = null, toastTimer = null;

  // ── SPEECH / TOAST ──────────────────────────────────────
  function speak(text) {
    const el = $('speechBubble');
    el.textContent = text; el.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function toast(text) {
    const el = $('toast');
    el.textContent = text; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ── MAIN REFRESH ────────────────────────────────────────
  function refresh() {
    const s = S(), sp = TG.SPECIES[s.species], mood = TG.MOODS[s.mood] || TG.MOODS.happy;

    $('stageBadge').textContent = s.stage.toUpperCase();
    $('levelBadge').textContent = `LVL ${s.level}`;
    $('coinBadge').textContent = `◉ ${s.coins}`;
    $('moodBadge').textContent = mood.label;
    $('speciesName').textContent = sp.name;
    $('speciesEmoji').textContent = sp.emoji;
    document.body.className = `mood-${s.mood}`;

    // needs
    ['hunger', 'energy', 'happiness', 'hygiene'].forEach(k => {
      const v = Math.round(s.needs[k]);
      const f = $(`nf-${k}`);
      f.style.width = `${v}%`;
      f.classList.toggle('warn', v < 25);
      $(`nv-${k}`).textContent = v;
    });

    // stats
    ['debugging', 'patience', 'chaos', 'wisdom', 'speed'].forEach(k => {
      const v = Math.round(s.stats[k]);
      $(`sf-${k}`).style.width = `${v}%`;
      $(`sv-${k}`).textContent = v;
    });

    // xp
    const need = s.level * TG.CONFIG.xpPerLevelBase;
    $('xpFill').style.width = `${Math.min(100, (s.xp / need) * 100)}%`;
    $('xpLabel').textContent = `${s.xp}/${need}`;

    // status
    const labels = { happy:'IDLE', excited:'ACTIVE', focused:'WORKING', sad:'LONELY', sleeping:'SLEEPING', celebrating:'SHIPPING', angry:'DEBUGGING', hungry:'HUNGRY', sick:'SICK' };
    $('statusText').textContent = labels[s.mood] || 'IDLE';
    $('streakInfo').textContent = `streak: ${s.streak.count}d`;
    $('lastFed').textContent = `fed: ${s.lastFed ? timeSince(s.lastFed) : 'never'}`;

    buildSpecies(); buildShop(); buildQuests(); buildTrophies();
    syncSettings();
    TG.events.emit('refresh');
  }

  function timeSince(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ── SPECIES GRID ────────────────────────────────────────
  function buildSpecies() {
    const grid = $('speciesGrid'); grid.innerHTML = '';
    TG.SPECIES_ORDER.forEach(key => {
      const sp = TG.SPECIES[key];
      const owned = S().unlockedSpecies.includes(key);
      const btn = document.createElement('div');
      btn.className = 'sp-btn' + (key === S().species ? ' active' : '') + (owned ? '' : ' locked');
      btn.innerHTML = `<span class="sp-emoji">${sp.emoji}</span><span class="sp-name">${sp.name}</span>` +
        (owned ? '' : `<span class="lock">🔒 ${TG.SPECIES_COST}</span>`);
      btn.onclick = () => owned ? TG.game.setSpecies(key) : TG.shop.unlockSpecies(key);
      grid.appendChild(btn);
    });
  }

  // ── SHOP ────────────────────────────────────────────────
  function buildShop() {
    const grid = $('shopGrid'); grid.innerHTML = '';
    TG.SHOP_ORDER.forEach(id => {
      const it = TG.ITEMS[id];
      const own = S().inventory[id] || 0;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML = `<span class="si-name">${it.name}</span><span class="si-cost">◉ ${it.cost}</span>` +
        `<span class="si-own">${it.type === 'food' ? 'have ' + own + ' · tap to use' : 'placed in room'}</span>`;
      el.onclick = () => {
        if (it.type === 'food' && own > 0) TG.actions.consume(id);
        else TG.shop.buy(id);
      };
      grid.appendChild(el);
    });
  }

  // ── QUESTS ──────────────────────────────────────────────
  function buildQuests() {
    const wrap = $('questList'); wrap.innerHTML = '';
    const q = S().quests;
    if (!q || !q.list.length) { wrap.innerHTML = '<div class="quest">no quests today</div>'; return; }
    q.list.forEach(item => {
      const def = TG.QUEST_POOL.find(d => d.id === item.id);
      if (!def) return;
      const row = document.createElement('div');
      row.className = 'quest' + (item.done ? ' done' : '');
      row.innerHTML = `<span>${item.done ? '✅' : '▢'} ${def.desc} (${Math.min(item.prog, def.goal)}/${def.goal})</span><span class="q-rew">◉ ${def.reward}</span>`;
      wrap.appendChild(row);
    });
  }

  // ── TROPHIES ────────────────────────────────────────────
  function buildTrophies() {
    const grid = $('trophyGrid'); grid.innerHTML = '';
    Object.entries(TG.ACHIEVEMENTS).forEach(([id, a]) => {
      const got = !!S().achievements[id];
      const el = document.createElement('div');
      el.className = 'trophy' + (got ? ' got' : '');
      el.innerHTML = `<span class="t-name">${got ? '🏆' : '🔒'} ${a.name}</span><span>${a.desc}</span>`;
      grid.appendChild(el);
    });
  }

  // ── MINIGAME HUD ────────────────────────────────────────
  function updateMgHud() {
    const hud = $('mgHud');
    if (TG.minigame.active()) {
      hud.classList.add('show');
      $('mgTime').textContent = Math.ceil(TG.minigame.timeRemaining() / 1000);
      $('mgScore').textContent = TG.minigame.getScore();
    } else hud.classList.remove('show');
  }

  // ── SETTINGS ────────────────────────────────────────────
  function syncSettings() {
    $('toggleSound').classList.toggle('off', !S().settings.sound);
    $('toggleMotion').classList.toggle('off', !S().settings.reducedMotion ? false : true);
  }

  // ── WIRING ──────────────────────────────────────────────
  function init() {
    $('btnFeed').onclick  = () => TG.actions.feed();
    $('btnPlay').onclick  = () => TG.actions.play();
    $('btnRest').onclick  = () => TG.actions.rest();
    $('btnClean').onclick = () => TG.actions.clean();
    $('btnDebug').onclick = () => TG.actions.debug();
    $('btnHunt').onclick  = () => { TG.minigame.start(); toast('🎯 tap the bugs!'); };

    // tabs
    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        ['species', 'shop', 'quests', 'trophies'].forEach(name =>
          $(`panel-${name}`).classList.toggle('hidden', name !== t.dataset.tab));
      };
    });

    // canvas tap → squash bug (during hunt) else pet
    const cv = $('petCanvas');
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cv.width / r.width);
      const y = (e.clientY - r.top) * (cv.height / r.height);
      TG.audio.ensure();
      if (TG.minigame.active()) { if (TG.minigame.handleClick(x, y)) { TG.ui.refresh(); return; } }
      TG.actions.petClick();
    });

    $('clearRoom').onclick = () => TG.shop.clearRoom();
    $('toggleSound').onclick = () => { S().settings.sound = !S().settings.sound; if (S().settings.sound) TG.audio.play('coin'); toast(S().settings.sound ? '🔊 sound on' : '🔇 sound off'); refresh(); TG.state.save(); };
    $('toggleMotion').onclick = () => { S().settings.reducedMotion = !S().settings.reducedMotion; toast(S().settings.reducedMotion ? 'reduced motion' : 'full motion'); refresh(); TG.state.save(); };
    $('resetGame').onclick = () => {
      if (confirm('Reset TANGOCHI? All progress is lost.')) { TG.state.reset(); location.reload(); }
    };

    $('footerInfo').textContent = `tangochi v2 · ${TG.SPECIES_ORDER.length} species`;
  }

  TG.ui = { refresh, speak, toast, updateMgHud, init };
})();
