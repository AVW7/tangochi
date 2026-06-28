// ===========================================================
// audio.js — tiny WebAudio blip synth (no asset files)
// Browsers require a user gesture before audio; we lazily create
// the context on the first interaction.
// ===========================================================
window.TG = window.TG || {};

(function () {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Play a short tone. type: sine/square/triangle/sawtooth.
  function tone(freq, dur, type, vol) {
    if (!TG.STATE.settings.sound) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }

  function seq(notes) { // notes: [[freq,dur,delay],...]
    notes.forEach(([f, d, delay, type]) => setTimeout(() => tone(f, d, type), delay));
  }

  const sfx = {
    feed:   () => seq([[523, 0.08, 0], [659, 0.10, 70]]),
    play:   () => seq([[659, 0.07, 0], [784, 0.07, 60], [988, 0.10, 120]]),
    rest:   () => seq([[392, 0.18, 0, 'sine'], [330, 0.22, 120, 'sine']]),
    debug:  () => seq([[220, 0.06, 0, 'sawtooth'], [180, 0.08, 50, 'sawtooth']]),
    clean:  () => seq([[880, 0.05, 0, 'sine'], [1175, 0.06, 50, 'sine']]),
    pet:    () => tone(880, 0.06, 'sine', 0.06),
    coin:   () => seq([[988, 0.05, 0], [1319, 0.08, 50]]),
    levelup:() => seq([[523, 0.08, 0], [659, 0.08, 90], [784, 0.08, 180], [1047, 0.16, 270]]),
    evolve: () => seq([[392, 0.1, 0], [523, 0.1, 110], [659, 0.1, 220], [880, 0.2, 330]]),
    squash: () => tone(140, 0.07, 'square', 0.1),
    bad:    () => seq([[200, 0.12, 0, 'sawtooth'], [150, 0.16, 90, 'sawtooth']]),
    win:    () => seq([[659, 0.1, 0], [784, 0.1, 110], [1047, 0.22, 220]]),
  };

  function play(name) { (sfx[name] || (() => {}))(); }

  TG.audio = { play, ensure };
})();
