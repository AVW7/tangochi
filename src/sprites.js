// ===========================================================
// sprites.js — pixel-grid rendering helpers (resolution-independent)
// ===========================================================
window.TG = window.TG || {};

(function () {
  // Draw a flat 16x16 species frame at (x,y) top-left with `scale` px per cell.
  function drawSpecies(ctx, species, frameIdx, x, y, scale) {
    const sp = TG.SPECIES[species];
    if (!sp) return;
    const frame = sp.frames[frameIdx % sp.frames.length];
    const colors = sp.colors;
    for (let i = 0; i < frame.length; i++) {
      const v = frame[i];
      if (v === 0) continue;
      ctx.fillStyle = colors[v] || '#fff';
      ctx.fillRect(x + (i % 16) * scale, y + ((i / 16) | 0) * scale, scale, scale);
    }
  }

  // Generic small pixel grid (for the bug-hunt sprite, icons, etc.).
  function drawGrid(ctx, grid, w, palette, x, y, scale) {
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v === 0) continue;
      ctx.fillStyle = palette[v] || '#fff';
      ctx.fillRect(x + (i % w) * scale, y + ((i / w) | 0) * scale, scale, scale);
    }
  }

  // A little 8x8 bug used by the mini-game.
  const BUG = [
    0,0,4,0,0,4,0,0,
    0,0,0,3,3,0,0,0,
    0,4,3,1,1,3,4,0,
    0,0,3,1,1,3,0,0,
    0,4,3,1,1,3,4,0,
    0,0,3,2,2,3,0,0,
    0,4,0,3,3,0,4,0,
    0,0,4,0,0,4,0,0,
  ];
  const BUG_PAL = ['', '#c0392b', '#e74c3c', '#7b241c', '#2c2c2c'];

  function drawBug(ctx, x, y, scale) {
    drawGrid(ctx, BUG, 8, BUG_PAL, x, y, scale);
  }

  TG.sprites = { drawSpecies, drawGrid, drawBug, BUG, BUG_PAL };
})();
