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

  // Monochrome "Claude FM" room: grey halftone dots on black, no colour.
  const FLOOR_DOT = '#2e2e2e';            // floor stipple
  const WALL_DOT_L = '#303030';           // shaded (left) wall stipple
  const WALL_DOT_R = '#3e3e3e';           // lit (right) wall stipple
  const EDGE = 'rgba(255,255,255,0.05)';  // faint grid / outline lines
  const DOT_STEP = 6, DOT_R = 1;          // dot spacing / radius (internal px)

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

  // Fill a clipped shape with a continuous grid of small dots (halftone).
  // `clip` receives ctx and must trace the path to clip to.
  function dotFill(ctx, clip, x0, y0, x1, y1, color, step, r) {
    ctx.save();
    ctx.beginPath(); clip(ctx); ctx.clip();
    ctx.fillStyle = color;
    const sx = Math.floor(x0 / step) * step, sy = Math.floor(y0 / step) * step;
    for (let y = sy; y <= y1; y += step)
      for (let x = sx; x <= x1; x += step) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    ctx.restore();
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
  // Furniture is monochrome (grey) so the pet stays the only colour in the room.
  const FURNITURE = {
    rug(ctx, x, y) {
      diamond(ctx, x, y, hw * 0.82, hh * 0.82, '#2e2e2e');
      diamond(ctx, x, y, hw * 0.55, hh * 0.55, '#3c3c3c');
      diamond(ctx, x, y, hw * 0.28, hh * 0.28, '#4c4c4c');
    },
    beanbag(ctx, x, y) {
      shadow(ctx, x, y + 2, 16);
      isoCube(ctx, x, y, 16, 8, 10, '#555555', '#363636', '#454545');
      diamond(ctx, x, y - 10, 12, 6, '#363636'); // dent
    },
    plant(ctx, x, y) {
      shadow(ctx, x, y + 2, 12);
      isoCube(ctx, x, y, 9, 4.5, 12, '#4a4a4a', '#2c2c2c', '#3a3a3a'); // pot
      const gy = y - 12;
      ctx.fillStyle = '#3f3f3f';
      for (const [dx, dy, s] of [[0,-12,9],[-7,-4,7],[7,-4,7],[0,-2,8]]) {
        ctx.beginPath(); ctx.arc(x + dx, gy + dy, s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#525252';
      ctx.beginPath(); ctx.arc(x - 2, gy - 10, 5, 0, Math.PI * 2); ctx.fill();
    },
    lamp(ctx, x, y) {
      shadow(ctx, x, y + 2, 9);
      isoCube(ctx, x, y, 4, 2, 34, '#4a4a4a', '#2c2c2c', '#3a3a3a'); // post
      // warm light glow (the one warmth — a lamp casting light)
      const g = ctx.createRadialGradient(x, y - 40, 2, x, y - 40, 26);
      g.addColorStop(0, 'rgba(255,228,160,0.7)');
      g.addColorStop(1, 'rgba(255,228,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y - 40, 26, 0, Math.PI * 2); ctx.fill();
      isoCube(ctx, x, y - 34, 9, 4.5, 8, '#d8d2c4', '#9a958a', '#bbb6a8'); // shade
    },
    bookshelf(ctx, x, y) {
      shadow(ctx, x, y + 2, 16);
      isoCube(ctx, x, y, 15, 7.5, 42, '#4a4a4a', '#2c2c2c', '#3a3a3a');
      // book rows on the right face (varied greys)
      const cols = ['#5a5a5a', '#444444', '#666666', '#4e4e4e', '#5f5f5f'];
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
      isoCube(ctx, x, y, 11, 5.5, 18, '#6a6a6a', '#424242', '#565656');
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x - 5, y - 16, 10, 8);
      ctx.fillStyle = '#5a5a5a';
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

    // Back walls (drawn first, behind everything) as dotted stipple + faint
    // outline. Left wall sits behind the col=0 edge; right behind row=0 edge.
    const A = proj(0, 0), Lc = proj(0, GRID), Rc = proj(GRID, 0);
    const leftWall = c => { c.moveTo(A.x, A.y); c.lineTo(Lc.x, Lc.y); c.lineTo(Lc.x, Lc.y - WALL_H); c.lineTo(A.x, A.y - WALL_H); c.closePath(); };
    dotFill(ctx, leftWall, Math.min(A.x, Lc.x), Math.min(A.y, Lc.y) - WALL_H, Math.max(A.x, Lc.x), Math.max(A.y, Lc.y), WALL_DOT_L, DOT_STEP, DOT_R);
    ctx.strokeStyle = EDGE; ctx.lineWidth = 1; ctx.beginPath(); leftWall(ctx); ctx.stroke();
    const rightWall = c => { c.moveTo(A.x, A.y); c.lineTo(Rc.x, Rc.y); c.lineTo(Rc.x, Rc.y - WALL_H); c.lineTo(A.x, A.y - WALL_H); c.closePath(); };
    dotFill(ctx, rightWall, Math.min(A.x, Rc.x), Math.min(A.y, Rc.y) - WALL_H, Math.max(A.x, Rc.x), Math.max(A.y, Rc.y), WALL_DOT_R, DOT_STEP, DOT_R);
    ctx.strokeStyle = EDGE; ctx.lineWidth = 1; ctx.beginPath(); rightWall(ctx); ctx.stroke();

    // Poster decoration on the right wall (if owned/placed).
    const poster = TG.STATE.placed.find(p => p.item === 'poster' && p.wall);
    if (poster) {
      const wx = (A.x + Rc.x) / 2, wy = (A.y + Rc.y) / 2 - WALL_H * 0.55;
      ctx.fillStyle = '#0d1a2c'; ctx.fillRect(wx - 14, wy - 12, 28, 24);
      ctx.fillStyle = '#44aaff'; ctx.fillRect(wx - 11, wy - 9, 22, 12);
      ctx.fillStyle = '#ffd83d'; ctx.fillRect(wx - 6, wy + 4, 12, 4);
    }

    // Floor — one continuous dot field clipped to the floor diamond, plus faint
    // grid lines for the iso perspective (matches Claude FM's dotted floor).
    const fTop = { x: ox, y: oy };
    const fRight = { x: ox + GRID * hw, y: oy + GRID * hh };
    const fBot = { x: ox, y: oy + 2 * GRID * hh };
    const fLeft = { x: ox - GRID * hw, y: oy + GRID * hh };
    const floorPath = c => { c.moveTo(fTop.x, fTop.y); c.lineTo(fRight.x, fRight.y); c.lineTo(fBot.x, fBot.y); c.lineTo(fLeft.x, fLeft.y); c.closePath(); };
    dotFill(ctx, floorPath, fLeft.x, fTop.y, fRight.x, fBot.y, FLOOR_DOT, DOT_STEP, DOT_R);
    ctx.strokeStyle = EDGE; ctx.lineWidth = 1;
    for (let col = 0; col < GRID; col++) {
      for (let row = 0; row < GRID; row++) {
        const p = proj(col, row), cy = p.y + hh;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + hw, cy);
        ctx.lineTo(p.x, p.y + 2 * hh); ctx.lineTo(p.x - hw, cy); ctx.closePath();
        ctx.stroke();
      }
    }

    // Room editor: floor overlay (edit tint + selection highlight) before items.
    TG.roomeditor?.drawFloorOverlay?.(ctx);

    // Build the depth-sorted drawable list: furniture + pet.
    const items = [];
    const _sel   = TG.roomeditor?.getSelected?.();
    const _ghost = TG.roomeditor?.getGhost?.();
    for (const [fIdx, f] of TG.STATE.placed.entries()) {
      if (f.item === 'poster' && f.wall) continue; // wall art handled above
      const dimmed = _ghost && _sel?.idx === fIdx;  // dim while ghost is elsewhere
      items.push({ key: f.col + f.row, sub: 0, render: (cx) => {
        const c = tileCenter(f.col, f.row);
        if (dimmed) cx.globalAlpha = 0.3;
        (FURNITURE[TG.ITEMS[f.item]?.draw] || FURNITURE.beanbag)(cx, c.x, c.y);
        cx.globalAlpha = 1;
      }});
    }
    // Ghost preview for the piece being dragged
    if (_ghost?.item) {
      items.push({ key: _ghost.col + _ghost.row, sub: 0.5, render: (cx) => {
        const c = tileCenter(_ghost.col, _ghost.row);
        cx.globalAlpha = _ghost.valid ? 0.52 : 0.22;
        (FURNITURE[TG.ITEMS[_ghost.item]?.draw] || FURNITURE.beanbag)(cx, c.x, c.y);
        cx.globalAlpha = 1;
        if (!_ghost.valid) {
          // Red ✕ over invalid drop target
          cx.strokeStyle = '#ff4444'; cx.lineWidth = 2; cx.globalAlpha = 0.7;
          cx.beginPath();
          cx.moveTo(c.x - 7, c.y - 7); cx.lineTo(c.x + 7, c.y + 7);
          cx.moveTo(c.x + 7, c.y - 7); cx.lineTo(c.x - 7, c.y + 7);
          cx.stroke();
          cx.globalAlpha = 1;
        }
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
    proj,                           // needed by roomeditor overlays
    get hw() { return hw; },        // half tile width
    get hh() { return hh; },        // half tile height
    get W() { return W; }, get H() { return H; },
    petTile: () => ({ col: Math.round(pet.col), row: Math.round(pet.row) }),
  };
})();
