// ===========================================================
// shop.js — economy: buy food/furniture, unlock species,
// place furniture into the isometric room.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const S = () => TG.STATE;

  function buy(itemId) {
    const it = TG.ITEMS[itemId], s = S();
    if (!it) return false;
    if (s.coins < it.cost) { TG.ui.toast('not enough coins'); TG.audio.play('bad'); return false; }
    s.coins -= it.cost;
    s.inventory[itemId] = (s.inventory[itemId] || 0) + 1;
    TG.audio.play('coin');
    TG.ui.toast(`🛒 bought ${it.name}`);
    if (it.type === 'furniture') placeAuto(itemId);  // auto-drop into the room
    TG.progress.check();
    TG.ui.refresh(); TG.state.save();
    return true;
  }

  function unlockSpecies(key) {
    const s = S();
    if (s.unlockedSpecies.includes(key)) { TG.game.setSpecies(key); return; }
    if (s.coins < TG.SPECIES_COST) { TG.ui.toast('not enough coins'); TG.audio.play('bad'); return; }
    s.coins -= TG.SPECIES_COST;
    s.unlockedSpecies.push(key);
    TG.audio.play('levelup');
    TG.ui.toast(`🔓 unlocked ${TG.SPECIES[key].name}`);
    TG.progress.check();
    TG.ui.refresh(); TG.state.save();
  }

  // Place an owned furniture item onto a free room tile.
  function placeAuto(itemId) {
    const s = S(), it = TG.ITEMS[itemId];
    if (!it || (s.inventory[itemId] || 0) <= 0) { TG.ui.toast('none in inventory'); return; }
    if (itemId === 'poster') {
      if (s.placed.some(p => p.item === 'poster' && p.wall)) { TG.ui.toast('poster already up'); return; }
      s.inventory[itemId]--;
      s.placed.push({ item: 'poster', wall: true, col: 0, row: 0 });
    } else {
      const G = TG.iso.GRID;
      let spot = null;
      for (let r = 0; r < G && !spot; r++)
        for (let c = 0; c < G && !spot; c++)
          if (!TG.iso.occupied(c, r) && !(itemId !== 'rug' && c === TG.iso.petTile().col && r === TG.iso.petTile().row))
            spot = { c, r };
      if (!spot) { TG.ui.toast('room is full'); return; }
      s.inventory[itemId]--;
      s.placed.push({ item: itemId, col: spot.c, row: spot.r });
    }
    TG.particles.stars(TG.iso.petScreen().x, TG.iso.petScreen().y - 20);
    TG.progress.check();
    TG.ui.refresh(); TG.state.save();
  }

  function clearRoom() {
    const s = S();
    // return placed furniture to inventory
    s.placed.forEach(p => { s.inventory[p.item] = (s.inventory[p.item] || 0) + 1; });
    s.placed = [];
    TG.ui.toast('room cleared');
    TG.ui.refresh(); TG.state.save();
  }

  TG.shop = { buy, unlockSpecies, placeAuto, clearRoom };
})();
