// ===========================================================
// iso.js — isometric room: floor tiles, walls, furniture,
// depth sorting (painter's algorithm by col+row), a wandering
// pet, soft shadows, and a day/night ambient tint.
// True 2:1 diamond tile projection on a pixel-scaled canvas.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const GRID = 5;          // GRID x GRID floor tiles
  let W = 320, H = 300;    // logical (internal) canvas resolution
  let hw = 30, hh = 15;    // half tile width / height
  let ox = 160, oy = 72;   // projection origin (top corner of tile 0,0)
  const WALL_H = 60;

  // Floor palette (subtle checker) + walls.
  const FLOOR_A = '#2b3550', FLOOR_B = '#313c5e', FLOOR_EDGE = '#1c2436';
  const WALL_L_TOP = '#222b44', WALL_L = '#1b2236';
  const WALL_R_TOP = '#2a3450', WALL_R = '#232c46';

  // Pet position in float tile coords + a wander target.
  let pet = { col: 2, row: 2, tx: 2, ty: 2, wait: 0, facing: 1 };

  // ── PROJECTION ──────────────────────────────────────────
  function proj(col, row) {
    return { x: ox + (col - row) * hw, y: oy + (col + row) * hh };
  }
  function tileCenter(col, row) {
    const p = proj(col, row);
    return { x: p.x, y: p.y + hh };   // visual centre of the diamond
  }
  function screenToTile(px, py) {
    const dx = (px - ox) / hw, dy = (py - oy) / hh;
    return { col: Math.round((dx + dy) / 2 - 0.5), row: Math.round((dy - dx) / 2 - 0.5) };
  }
  function inBounds(c, r) { return c >= 0 && r >= 0 && c < GRID && r < GRID; }

  function occupied(col, row) {
    return TG.STATE.placed.some(p => p.col === col && p.row === row &&
      p.item !== 'rug' && p.item !== 'poster');
  }

  // ── PRIMITIVES ──────────────────────────────────────────
  function diamond(ctx, x, y, sw, sh, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - sh);
    ctx.lineTo(x + sw, y);
    ctx.lineTo(x, y + sh);
    ctx.lineTo(x - sw, y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // Isometric cuboid sitting on the floor at base centre (bx,by).
  function isoCube(ctx, bx, by, sw, sh, ht, top, left, right) {
    // left face
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(bx - sw, by); ctx.lineTo(bx, by + sh);
    ctx.lineTo(bx, by + sh - ht); ctx.lineTo(bx - sw, by - ht);
    ctx.closePath(); ctx.fill();
    // right face
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(bx + sw, by); ctx.lineTo(bx, by + sh);
    ctx.lineTo(bx, by + sh - ht); ctx.lineTo(bx + sw, by - ht);
    ctx.closePath(); ctx.fill();
    // top face
    diamond(ctx, bx, by - ht, sw, sh, top);
  }

  function shadow(ctx, x, y, w) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── FURNITURE (procedural pixel-ish iso shapes) ──────────
  const FURNITURE = {
    rug(ctx, x, y) {
      diamond(ctx, x, y, hw * 0.82, hh * 0.82, '#7a4ba0');
      diamond(ctx, x, y, hw * 0.55, hh * 0.55, '#9b6fc4');
      diamond(ctx, x, y, hw * 0.28, hh * 0.28, '#c79be6');
    },
    beanbag(ctx, x, y) {
      shadow(ctx, x, y + 2, 16);
      isoCube(ctx, x, y, 16, 8, 10, '#3a9ad6', '#2b6fa0', '#327fb8');
      diamond(ctx, x, y - 10, 12, 6, '#2b6fa0'); // dent
    },
    plant(ctx, x, y) {
      shadow(ctx, x, y + 2, 12);
      isoCube(ctx, x, y, 9, 4.5, 12, '#9a5a2c', '#6e3f1d', '#84502a'); // pot
      const gy = y - 12;
      ctx.fillStyle = '#2f8f4e';
      for (const [dx, dy, s] of [[0,-12,9],[-7,-4,7],[7,-4,7],[0,-2,8]]) {
        ctx.beginPath(); ctx.arc(x + dx, gy + dy, s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#3fb567';
      ctx.beginPath(); ctx.arc(x - 2, gy - 10, 5, 0, Math.PI * 2); ctx.fill();
    },
    lamp(ctx, x, y) {
      shadow(ctx, x, y + 2, 9);
      isoCube(ctx, x, y, 4, 2, 34, '#444c66', '#2c3346', '#363e56'); // post
      // glow
      const g = ctx.createRadialGradient(x, y - 40, 2, x, y - 40, 26);
      g.addColorStop(0, 'rgba(255,228,140,0.85)');
      g.addColorStop(1, 'rgba(255,228,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y - 40, 26, 0, Math.PI * 2); ctx.fill();
      isoCube(ctx, x, y - 34, 9, 4.5, 8, '#ffe48c', '#d9b85a', '#ecc972'); // shade
    },
    bookshelf(ctx, x, y) {
      shadow(ctx, x, y + 2, 16);
      isoCube(ctx, x, y, 15, 7.5, 42, '#5a3f28', '#3c2a1a', '#4a3320');
      // book rows on the right face
      const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad'];
      for (let s = 0; s < 3; s++) {
        const sy = y - 8 - s * 12;
        for (let b = 0; b < 4; b++) {
          ctx.fillStyle = cols[(s * 4 + b) % cols.length];
          ctx.fillRect(x + 2 + b * 3, sy - 9, 2.4, 9);
        }
      }
    },
    poster(ctx, x, y) { // placed flat on the floor tile as a framed art crate if not on wall
      shadow(ctx, x, y + 2, 12);
      isoCube(ctx, x, y, 11, 5.5, 18, '#e8e8f0', '#b9b9cc', '#d2d2e0');
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(x - 5, y - 16, 10, 8);
      ctx.fillStyle = '#ff55cc';
      ctx.fillRect(x - 3, y - 14, 4, 4);
    },
  };

  // ── PET RENDER ──────────────────────────────────────────
  function petScreen() {
    const c = tileCenter(pet.col, pet.row);
    return { x: c.x, y: c.y };
  }

  function drawPet(ctx, bounce) {
    const c = petScreen();
    const scale = TG.sim.stageScale();
    const px = 2.0 * scale;                 // pixel cell size for 16x16 sprite
    const spriteW = 16 * px;
    const baseY = c.y - 6;
    shadow(ctx, c.x, baseY + 4, spriteW * 0.34);
    const drawX = c.x - spriteW / 2;
    const drawY = baseY - 16 * px + bounce;
    // facing flip
    ctx.save();
    if (pet.facing < 0) {
      ctx.translate(c.x * 2, 0);
      ctx.scale(-1, 1);
    }
    TG.sprites.drawSpecies(ctx, TG.STATE.species, TG.anim.frame(), drawX, drawY, px);
    ctx.restore();
  }

  // ── WANDER ──────────────────────────────────────────────
  function update(dtMs) {
    const sleeping = TG.STATE.mood === 'sleeping' || TG.STATE.mood === 'sick';
    if (sleeping || TG.util.reduced()) { pet.tx = pet.col; pet.ty = pet.row; return; }

    if (pet.wait > 0) { pet.wait -= dtMs; }
    const dx = pet.tx - pet.col, dy = pet.ty - pet.row;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.04) {
      pet.col = pet.tx; pet.row = pet.ty;
      if (pet.wait <= 0) {
        // choose a new free, in-bounds target tile
        for (let tries = 0; tries < 8; tries++) {
          const nc = TG.util.randInt(0, GRID - 1), nr = TG.util.randInt(0, GRID - 1);
          if (inBounds(nc, nr) && !occupied(nc, nr)) {
            pet.tx = nc; pet.ty = nr;
            pet.facing = (proj(nc, nr).x >= proj(pet.col, pet.row).x) ? 1 : -1;
            break;
          }
        }
        pet.wait = TG.util.rand(900, 2600);
      }
    } else {
      const moodSpeed = { excited: 2.6, celebrating: 2.6, happy: 1.4, angry: 2.2 };
      const sp = (moodSpeed[TG.STATE.mood] || 1.1) * (dtMs / 1000);
      pet.col += (dx / dist) * sp;
      pet.row += (dy / dist) * sp;
    }
  }

  // ── FULL SCENE RENDER ───────────────────────────────────
  function render(ctx, bounce) {
    ctx.clearRect(0, 0, W, H);

    // Back walls (drawn first, behind everything).
    // Left wall sits behind the col=0 edge; right wall behind row=0 edge.
    const A = proj(0, 0), Lc = proj(0, GRID), Rc = proj(GRID, 0);
    // left wall
    ctx.fillStyle = WALL_L;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(Lc.x, Lc.y);
    ctx.lineTo(Lc.x, Lc.y - WALL_H); ctx.lineTo(A.x, A.y - WALL_H);
    ctx.closePath(); ctx.fill();
    // right wall
    ctx.fillStyle = WALL_R;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(Rc.x, Rc.y);
    ctx.lineTo(Rc.x, Rc.y - WALL_H); ctx.lineTo(A.x, A.y - WALL_H);
    ctx.closePath(); ctx.fill();
    // wall top trim
    ctx.fillStyle = WALL_L_TOP;
    ctx.fillRect(Math.min(A.x, Lc.x), 0, 2, 2); // (no-op safeguard)

    // Poster decoration on the right wall (if owned/placed).
    const poster = TG.STATE.placed.find(p => p.item === 'poster' && p.wall);
    if (poster) {
      const wx = (A.x + Rc.x) / 2, wy = (A.y + Rc.y) / 2 - WALL_H * 0.55;
      ctx.fillStyle = '#0d1a2c'; ctx.fillRect(wx - 14, wy - 12, 28, 24);
      ctx.fillStyle = '#44aaff'; ctx.fillRect(wx - 11, wy - 9, 22, 12);
      ctx.fillStyle = '#ffd83d'; ctx.fillRect(wx - 6, wy + 4, 12, 4);
    }

    // Floor tiles (checker) with thin edges for readability.
    for (let s = 0; s <= (GRID - 1) * 2; s++) {
      for (let col = 0; col < GRID; col++) {
        const row = s - col;
        if (row < 0 || row >= GRID) continue;
        const p = proj(col, row);
        diamond(ctx, p.x, p.y + hh, hw, hh, (col + row) % 2 ? FLOOR_A : FLOOR_B, FLOOR_EDGE);
      }
    }

    // Build the depth-sorted drawable list: furniture + pet.
    const items = [];
    for (const f of TG.STATE.placed) {
      if (f.item === 'poster' && f.wall) continue; // wall art handled above
      items.push({ key: f.col + f.row, sub: 0, render: (cx) => {
        const c = tileCenter(f.col, f.row);
        (FURNITURE[TG.ITEMS[f.item] && TG.ITEMS[f.item].draw] || FURNITURE.beanbag)(cx, c.x, c.y);
      }});
    }
    items.push({ key: pet.col + pet.row, sub: 1, render: (cx) => drawPet(cx, bounce) });

    // Inject mini-game bugs if active.
    if (TG.minigame && TG.minigame.active()) {
      TG.minigame.bugs().forEach(b => {
        items.push({ key: b.col + b.row, sub: 2, render: (cx) => {
          const c = tileCenter(b.col, b.row);
          const s = 2.4;
          TG.sprites.drawBug(cx, c.x - 4 * s, c.y - 12 + Math.sin(b.t) * 2, s);
        }});
      });
    }

    items.sort((a, b) => (a.key - b.key) || (a.sub - b.sub));
    items.forEach(it => it.render(ctx));

    // Sleeping z's / status emote anchored to pet.
    if (TG.STATE.mood === 'sleeping' && !TG.util.reduced() && Math.random() < 0.04) {
      const c = petScreen();
      TG.particles.zzz(c.x + 10, c.y - 30);
    }

    // Day/night ambient tint over the whole room.
    const tint = TG.sim.currentPhase().tint;
    if (tint && tint !== 'rgba(255,255,255,0)') {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function resize(cssW) {
    // Keep internal resolution fixed for crisp pixels; CSS scales it up.
    return { W, H };
  }

  TG.iso = {
    GRID, init() {}, resize, render, update,
    tileCenter, screenToTile, petScreen, inBounds, occupied,
    get W() { return W; }, get H() { return H; },
    petTile: () => ({ col: Math.round(pet.col), row: Math.round(pet.row) }),
  };
})();
