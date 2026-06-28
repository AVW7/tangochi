// ===========================================================
// main.js — boot, game loop (delta-timed), animation driver.
// Single requestAnimationFrame loop renders the room + particles
// and advances the simulation in real time.
// ===========================================================
window.TG = window.TG || {};

(function () {
  const canvas = document.getElementById('petCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // animation state
  let animFrame = 0, animAcc = 0, bounceT = 0;
  TG.anim = { frame: () => animFrame };

  // sim accumulator (apply decay ~once per second)
  let simAcc = 0;
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(64, now - last); // clamp big tab-away gaps
    last = now;

    // ── animation frame switch + bounce by mood ──
    const moodFrameMs = { excited: 160, celebrating: 180, angry: 130, happy: 480, focused: 800, sleeping: 1600, sad: 900, hungry: 360, sick: 1200 };
    animAcc += dt;
    if (animAcc >= (moodFrameMs[TG.STATE.mood] || 480)) { animFrame ^= 1; animAcc = 0; }
    bounceT += dt;
    const amp = TG.util.reduced() ? 0 : (TG.STATE.mood === 'sleeping' ? 0 : (TG.STATE.mood === 'excited' ? 6 : 4));
    const period = ({ excited: 280, celebrating: 320, angry: 240 })[TG.STATE.mood] || 700;
    const bounce = Math.round(Math.sin(bounceT / (period / (Math.PI * 2))) * amp);

    // ── update systems ──
    TG.iso.update(dt);
    TG.minigame.update(dt);
    TG.particles.update();

    // ── real-time simulation (~1s cadence) ──
    simAcc += dt;
    if (simAcc >= 1000) {
      const mins = simAcc / 60000;
      TG.sim.liveDecay(mins);
      TG.sim.evalStage();
      simAcc = 0;
      TG.ui.refresh();
      TG.state.save();
    }

    // ── render ──
    TG.iso.render(ctx, bounce);
    TG.particles.render(ctx);
    TG.ui.updateMgHud();

    requestAnimationFrame(loop);
  }

  // species switch (used by ui + shop)
  TG.game = {
    setSpecies(key) {
      if (!TG.STATE.unlockedSpecies.includes(key)) return;
      TG.STATE.species = key;
      animFrame = 0;
      TG.STATE.mood = TG.sim.recalcMood();
      TG.ui.speak(`i'm ${TG.SPECIES[key].name.toLowerCase()}!`);
      TG.ui.refresh(); TG.state.save();
    },
  };

  // ── BOOT ──
  function boot() {
    TG.iso.init();
    const offMins = TG.sim.applyOffline();
    TG.progress.init();
    TG.ui.init();
    TG.ui.refresh();
    requestAnimationFrame(loop);

    setTimeout(() => {
      if (offMins > 30) {
        TG.ui.toast(`welcome back! ${Math.round(offMins / 60)}h passed`);
        TG.ui.speak('you were gone a while!');
      } else {
        TG.ui.speak(TG.util.pick(TG.SPEECHES[TG.STATE.mood] || TG.SPEECHES.happy));
      }
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
