// ===========================================================
// actions.js — player actions. Each adjusts needs + skill stats,
// awards xp/coins, plays sfx + particles, and nudges mood.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const clamp = TG.util.clamp;
  const S = () => TG.STATE;

  function fx(emit, sound) {
    const p = TG.iso.petScreen();
    if (emit) emit(p.x, p.y - 18);
    if (sound) TG.audio.play(sound);
  }

  function after(mood, holdMs) {
    S().mood = mood;
    TG.ui.refresh();
    if (holdMs) setTimeout(() => { S().mood = TG.sim.recalcMood(); TG.ui.refresh(); }, holdMs);
    else S().mood = TG.sim.recalcMood();
    TG.state.save();
  }

  function feed() {
    const s = S();
    s.needs.hunger = clamp(s.needs.hunger + 28, 0, 100);
    s.needs.happiness = clamp(s.needs.happiness + 6, 0, 100);
    s.stats.patience = clamp(s.stats.patience + 6, 0, 100);
    s.stats.speed = clamp(s.stats.speed + 4, 0, 100);
    s.lastFed = Date.now();
    s.counters.feeds++;
    TG.sim.gainXP(8); TG.sim.gainCoins(2);
    fx(TG.particles.crumbs, 'feed');
    TG.ui.speak('thanks for the food!');
    TG.ui.toast('🍖 FED  +hunger');
    TG.events.emit('quest:feeds');
    TG.events.emit('action:feed');
    after('happy', 1500);
  }

  function play() {
    const s = S();
    if (s.needs.energy < 12) { TG.ui.speak('too tired to play...'); TG.ui.toast('💤 needs energy'); return; }
    s.needs.happiness = clamp(s.needs.happiness + 22, 0, 100);
    s.needs.energy = clamp(s.needs.energy - 8, 0, 100);
    s.stats.chaos = clamp(s.stats.chaos + 8, 0, 100);
    s.stats.speed = clamp(s.stats.speed + 10, 0, 100);
    s.counters.plays++;
    TG.sim.gainXP(12); TG.sim.gainCoins(3);
    fx(TG.particles.stars, 'play');
    TG.ui.speak("yay!! let's play!!");
    TG.ui.toast('🎮 PLAYED  +happiness');
    TG.events.emit('quest:plays');
    after('excited', 3500);
  }

  function rest() {
    const s = S();
    s.needs.energy = clamp(s.needs.energy + 35, 0, 100);
    s.stats.patience = clamp(s.stats.patience + 12, 0, 100);
    s.stats.wisdom = clamp(s.stats.wisdom + 8, 0, 100);
    s.stats.chaos = clamp(s.stats.chaos - 12, 0, 100);
    TG.sim.gainXP(6); TG.sim.gainCoins(1);
    TG.audio.play('rest');
    TG.ui.speak('zzzz...');
    TG.ui.toast('💤 RESTED  +energy');
    after('sleeping', 4500);
  }

  function clean() {
    const s = S();
    s.needs.hygiene = clamp(s.needs.hygiene + 40, 0, 100);
    s.needs.happiness = clamp(s.needs.happiness + 8, 0, 100);
    s.counters.cleans++;
    TG.sim.gainXP(6); TG.sim.gainCoins(2);
    fx(TG.particles.bubbles, 'clean');
    TG.ui.speak('squeaky clean!');
    TG.ui.toast('🧼 CLEANED  +hygiene');
    TG.events.emit('quest:cleans');
    after('happy', 1200);
  }

  function debug() {
    const s = S();
    s.stats.debugging = clamp(s.stats.debugging + 18, 0, 100);
    s.stats.wisdom = clamp(s.stats.wisdom + 8, 0, 100);
    s.stats.chaos = clamp(s.stats.chaos - 8, 0, 100);
    s.needs.energy = clamp(s.needs.energy - 6, 0, 100);
    TG.sim.gainXP(16); TG.sim.gainCoins(4);
    fx(TG.particles.sparks, 'debug');
    TG.ui.speak('found the bug!!');
    TG.ui.toast('🐛 DEBUGGED  +debugging');
    after('angry', 2200);
    setTimeout(() => { S().mood = 'focused'; TG.ui.refresh(); }, 2300);
  }

  function petClick() {
    const s = S();
    s.needs.happiness = clamp(s.needs.happiness + 3, 0, 100);
    TG.sim.gainXP(2);
    fx(TG.particles.hearts, 'pet');
    const list = TG.SPEECHES[s.mood] || TG.SPEECHES.happy;
    TG.ui.speak(TG.util.pick(list));
    s.mood = TG.sim.recalcMood();
    TG.ui.refresh(); TG.state.save();
  }

  function consume(itemId) {
    const it = TG.ITEMS[itemId], s = S();
    if (!it || (s.inventory[itemId] || 0) <= 0) return;
    s.inventory[itemId]--;
    if (it.hunger) s.needs.hunger = clamp(s.needs.hunger + it.hunger, 0, 100);
    if (it.energy) s.needs.energy = clamp(s.needs.energy + it.energy, 0, 100);
    if (it.happiness) s.needs.happiness = clamp(s.needs.happiness + it.happiness, 0, 100);
    if (it.cure) { TG.sim.cure(); TG.ui.toast('💊 cured!'); }
    if (it.hunger) s.lastFed = Date.now();
    fx(it.cure ? TG.particles.stars : TG.particles.crumbs, it.cure ? 'levelup' : 'feed');
    TG.ui.speak(it.cure ? 'feeling better!' : 'yum!');
    after('happy', 1200);
  }

  TG.actions = { feed, play, rest, clean, debug, petClick, consume };
})();
