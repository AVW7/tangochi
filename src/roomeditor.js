// ===========================================================
// roomeditor.js — Phase 5 drag-to-place room editing.
// Toggle edit mode; tap furniture to select; drag to move;
// tap same tile twice to sell back for half price.
// Exposes render helpers (drawFloorOverlay, getGhost) consumed
// by iso.js in the normal render loop.
// ===========================================================
window.TG = window.TG || {};

(function () {
  let editMode  = false;
  // selected: { idx, origCol, origRow } — piece currently held
  let selected  = null;
  // ghost tile (current drag target)
  let ghostCol  = -1, ghostRow = -1;
  // pending sell: { col, row, idx } — tap same tile again to confirm
  let awaitingSell = null;

  // ── PUBLIC API ───────────────────────────────────────────
  function toggle() {
    editMode = !editMode;
    _clear();
    document.body.classList.toggle('edit-mode', editMode);
    TG.ui.toast(editMode ? '✏️ tap furniture to move' : '✅ done editing');
  }

  function isActive() { return editMode; }

  // ── INTERNAL HELPERS ─────────────────────────────────────
  function _clear() {
    selected = null; ghostCol = -1; ghostRow = -1; awaitingSell = null;
  }

  function _ghostBlocked(idx) {
    return TG.STATE.placed.some((p, i) =>
      i !== idx && !p.wall && p.item !== 'rug' &&
      p.col === ghostCol && p.row === ghostRow);
  }

  function _sellItem(idx) {
    const p  = TG.STATE.placed[idx];
    const it = TG.ITEMS[p.item];
    const coins = Math.floor((it?.cost || 0) / 2);
    TG.STATE.placed.splice(idx, 1);
    TG.STATE.coins += coins;
    TG.audio.play('coin');
    TG.ui.toast(`sold! ◉+${coins}`);
    TG.state.save();
    TG.ui.refresh();
  }

  // ── POINTER HANDLERS ─────────────────────────────────────
  // Return true = event consumed (caller should not process further).

  function onDown(cx, cy) {
    if (!editMode) return false;
    const t = TG.iso.screenToTile(cx, cy);
    if (!TG.iso.inBounds(t.col, t.row)) { _clear(); return true; }

    // Pending sell confirmation: tap the same tile again → sell
    if (awaitingSell &&
        awaitingSell.col === t.col && awaitingSell.row === t.row) {
      _sellItem(awaitingSell.idx);
      _clear();
      return true;
    }

    // Any other tap cancels a pending sell
    awaitingSell = null;

    // Find furniture on this tile (wall-mounted items not moveable here)
    const idx = TG.STATE.placed.findIndex(p =>
      !p.wall && p.col === t.col && p.row === t.row);
    if (idx < 0) { selected = null; return true; }

    selected  = { idx, origCol: t.col, origRow: t.row };
    ghostCol  = t.col;
    ghostRow  = t.row;
    return true;
  }

  function onMove(cx, cy) {
    if (!editMode || !selected) return false;
    const t = TG.iso.screenToTile(cx, cy);
    if (TG.iso.inBounds(t.col, t.row)) { ghostCol = t.col; ghostRow = t.row; }
    return true;
  }

  function onUp(cx, cy) {
    if (!editMode) return false;
    if (!selected) return true;

    const { idx, origCol, origRow } = selected;

    // Determine intent from ghost position (avoids pointer-up jitter)
    const isTap = ghostCol === origCol && ghostRow === origRow;

    if (isTap) {
      // First tap → show sell price, wait for second tap
      const it    = TG.ITEMS[TG.STATE.placed[idx].item];
      const coins = Math.floor((it?.cost || 0) / 2);
      awaitingSell = { col: origCol, row: origRow, idx };
      TG.ui.toast(`sell for ◉${coins}? tap again`);
      selected = null; ghostCol = -1; ghostRow = -1;
      return true;
    }

    // Dragged to a different tile
    awaitingSell = null;
    if (TG.iso.inBounds(ghostCol, ghostRow) && !_ghostBlocked(idx)) {
      TG.STATE.placed[idx].col = ghostCol;
      TG.STATE.placed[idx].row = ghostRow;
      TG.audio.play('coin');
      TG.state.save();
    } else if (!TG.iso.inBounds(ghostCol, ghostRow)) {
      // dropped out of bounds — snap back silently
    } else {
      TG.audio.play('bad');
      TG.ui.toast('tile occupied');
    }

    _clear();
    TG.ui.refresh();
    return true;
  }

  // ── RENDER HELPERS (called from iso.render) ──────────────

  /**
   * drawFloorOverlay — call AFTER the floor diamonds, BEFORE depth-sorted items.
   * Draws a subtle edit-mode tint and a gold highlight on the selected tile.
   */
  function drawFloorOverlay(ctx) {
    if (!editMode) return;
    const G  = TG.iso.GRID;
    const hw = TG.iso.hw, hh = TG.iso.hh;

    // Faint green wash over all floor tiles
    ctx.globalAlpha = 0.06;
    ctx.fillStyle   = '#44dd88';
    for (let col = 0; col < G; col++) {
      for (let row = 0; row < G; row++) {
        const p = TG.iso.proj(col, row);
        ctx.beginPath();
        ctx.moveTo(p.x,      p.y);
        ctx.lineTo(p.x + hw, p.y + hh);
        ctx.lineTo(p.x,      p.y + 2 * hh);
        ctx.lineTo(p.x - hw, p.y + hh);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Gold highlight on the selected (origin) tile
    if (selected) {
      const p  = TG.iso.proj(selected.origCol, selected.origRow);
      const hw = TG.iso.hw, hh = TG.iso.hh;
      ctx.beginPath();
      ctx.moveTo(p.x,      p.y);
      ctx.lineTo(p.x + hw, p.y + hh);
      ctx.lineTo(p.x,      p.y + 2 * hh);
      ctx.lineTo(p.x - hw, p.y + hh);
      ctx.closePath();
      ctx.globalAlpha = 0.14; ctx.fillStyle   = '#ffd24a'; ctx.fill();
      ctx.globalAlpha = 0.75; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * getGhost — returns { item, col, row, valid } or null.
   * iso.render adds this to the depth-sorted draw list.
   */
  function getGhost() {
    if (!editMode || !selected) return null;
    // No ghost while pointer hasn't moved to a new tile yet
    if (ghostCol === selected.origCol && ghostRow === selected.origRow) return null;
    if (!TG.iso.inBounds(ghostCol, ghostRow)) return null;
    const valid = !_ghostBlocked(selected.idx);
    return { item: TG.STATE.placed[selected.idx]?.item, col: ghostCol, row: ghostRow, valid };
  }

  /** getSelected — used by iso.render to dim the piece being dragged. */
  function getSelected() { return editMode ? selected : null; }

  TG.roomeditor = { toggle, isActive, onDown, onMove, onUp, drawFloorOverlay, getGhost, getSelected };
})();
