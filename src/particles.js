// ===========================================================
// particles.js — pooled particle system for interaction juice
// ===========================================================
window.TG = window.TG || {};

(function () {
  const POOL = [];
  const MAX = 160;
  for (let i = 0; i < MAX; i++) POOL.push({ alive: false });

  function spawn(o) {
    if (TG.util.reduced()) return;          // respect reduced-motion
    const p = POOL.find(p => !p.alive);
    if (!p) return;
    p.alive = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx; p.vy = o.vy;
    p.g = o.g == null ? 0.05 : o.g;          // gravity
    p.life = o.life; p.max = o.life;
    p.color = o.color;
    p.size = o.size || 3;
    p.char = o.char || null;                 // optional glyph
    p.fade = o.fade !== false;
  }

  // ── EMITTERS (x,y in canvas pixels) ──────────────────────
  function burst(x, y, opts) {
    const n = opts.count || 10;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + TG.util.rand(-0.3, 0.3);
      const sp = TG.util.rand(opts.spMin || 0.6, opts.spMax || 2.2);
      spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.lift || 0),
        g: opts.g, life: TG.util.randInt(opts.lifeMin || 24, opts.lifeMax || 48),
        color: Array.isArray(opts.color) ? TG.util.pick(opts.color) : opts.color,
        size: opts.size, char: opts.char,
      });
    }
  }

  const hearts   = (x, y) => burst(x, y, { count: 6, color: ['#ff6688','#ff99bb'], char: '♥', lift: 1.4, g: 0.02, lifeMin: 36, lifeMax: 60 });
  const crumbs   = (x, y) => burst(x, y, { count: 10, color: ['#caa15a','#8a6a30','#e6c27a'], g: 0.18, spMax: 1.6 });
  const stars    = (x, y) => burst(x, y, { count: 10, color: ['#ffd83d','#fff0a0','#ffaa22'], char: '✦', g: 0.02, lift: 0.6 });
  const sparks   = (x, y) => burst(x, y, { count: 12, color: ['#ff5555','#ffaa44','#ffffff'], spMax: 2.6, g: 0.08 });
  const bubbles  = (x, y) => burst(x, y, { count: 10, color: ['#bfe9ff','#ffffff','#88c8ff'], char: '○', lift: 1.2, g: -0.01, lifeMin: 40, lifeMax: 70 });
  const confetti = (x, y) => burst(x, y, { count: 30, color: ['#44dd88','#ffcc00','#ff55cc','#44aaff','#ff5555'], spMax: 3.2, g: 0.16, lifeMin: 40, lifeMax: 80 });
  const coins    = (x, y) => burst(x, y, { count: 8, color: ['#ffd24a','#ffe98a'], char: '◉', g: 0.14, lift: 1.6 });

  function zzz(x, y) {
    if (TG.util.reduced()) return;
    spawn({ x, y, vx: 0.2, vy: -0.5, g: -0.004, life: 70, color: '#aabbcc', char: 'z', size: 4 });
  }

  function update() {
    for (const p of POOL) {
      if (!p.alive) continue;
      p.vy += p.g;
      p.x += p.vx; p.y += p.vy;
      if (--p.life <= 0) p.alive = false;
    }
  }

  function render(ctx) {
    for (const p of POOL) {
      if (!p.alive) continue;
      const a = p.fade ? Math.max(0, p.life / p.max) : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.char) {
        ctx.font = `bold ${p.size * 3}px monospace`;
        ctx.fillText(p.char, p.x, p.y);
      } else {
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  TG.particles = { update, render, hearts, crumbs, stars, sparks, bubbles, confetti, coins, zzz, burst };
})();
