// ===========================================================
// config.js — game balance, content tables, static definitions
// All tunable numbers live here so design changes stay in one place.
// ===========================================================
window.TG = window.TG || {};

TG.CONFIG = {
  SAVE_KEY: 'tangochi',
  SAVE_VERSION: 3,

  // Real-time need decay, expressed as points lost per real minute.
  // Needs run 0..100 where 100 = fully satisfied.
  decayPerMin: { hunger: 0.7, energy: 0.5, happiness: 0.4, hygiene: 0.3 },

  // When awake energy drains; while resting it regenerates.
  energyRegenPerMin: 2.2,

  // Offline progression is capped so a pet left for a week isn't dead on arrival.
  maxOfflineHours: 12,

  // Care score (0..100) tracks how well needs have been kept. Drives evolution.
  evolution: {
    juvenile: { level: 5,  care: 35 },
    adult:    { level: 10, care: 55 },
  },

  // Sickness triggers when needs are critically neglected.
  sickIfNeedBelow: 12,        // any need under this for too long
  sickAfterMins: 30,          // sustained neglect window

  xpPerLevelBase: 100,        // xp needed = level * base
};

// ── MOODS ─────────────────────────────────────────────────
TG.MOODS = {
  happy:       { label: 'HAPPY',      color: '#44dd88' },
  excited:     { label: 'EXCITED !!', color: '#ffcc00' },
  focused:     { label: 'FOCUSED ...',color: '#44aaff' },
  sad:         { label: 'SAD :(',     color: '#9966dd' },
  sleeping:    { label: 'ZZZ...',     color: '#558898' },
  celebrating: { label: 'WOOHOO!',    color: '#ff55cc' },
  angry:       { label: 'ANGRY >:(',  color: '#ff4444' },
  hungry:      { label: 'HUNGRY',     color: '#ee8833' },
  sick:        { label: 'SICK ...',   color: '#88aa66' },
};

TG.SPEECHES = {
  happy:       ['hello there!', 'feeling good!', "let's code!", 'ready!', '\u{1F47E}'],
  excited:     ['YES!!', 'LETS GO!!', 'so pumped!!', 'whoa!!', '!!!'],
  focused:     ['...working', 'in the zone', 'deep focus', '...', 'shhh.'],
  sad:         ['need attention...', 'feeling low', 'help me?', 'so lonely', 'oh no'],
  sleeping:    ['zzz...', '*snore*', 'zZzZ', 'dreaming of code', 'zzzzz'],
  celebrating: ['WE DID IT!', 'SHIP IT!!', '✨ ✨ ✨', 'LGTM!', 'MERGED!'],
  angry:       ['BUG FOUND!', '>:(', 'WHY!!!', 'npm ERR!', 'REVERT!'],
  hungry:      ['feed me!', 'so hungry...', 'snack? please?', 'tummy rumbling', 'need fuel'],
  sick:        ['not feeling great', 'i need rest...', 'cough cough', 'so dizzy', 'help :('],
};

// ── ROOM TINT BY TIME OF DAY ──────────────────────────────
// Real local clock drives ambient lighting over the room.
// Neutral (no colour) so the room stays monochrome; time of day only dims it.
TG.DAY_PHASES = [
  { name: 'night',   from: 0,  tint: 'rgba(0,0,0,0.45)' },
  { name: 'dawn',    from: 6,  tint: 'rgba(0,0,0,0.22)' },
  { name: 'day',     from: 8,  tint: 'rgba(255,255,255,0)' },
  { name: 'dusk',    from: 18, tint: 'rgba(0,0,0,0.18)' },
  { name: 'evening', from: 20, tint: 'rgba(0,0,0,0.34)' },
  { name: 'night',   from: 22, tint: 'rgba(0,0,0,0.45)' },
];

// ── SHOP / ITEMS ──────────────────────────────────────────
// type 'furniture' items can be placed in the room; 'food' is consumable;
// 'species' unlocks a new pet.
TG.ITEMS = {
  // Furniture (footprint is 1 tile unless noted). 'draw' key maps to iso.js.
  lamp:      { type: 'furniture', name: 'LAMP',      cost: 30,  draw: 'lamp',     h: 22 },
  plant:     { type: 'furniture', name: 'PLANT',     cost: 25,  draw: 'plant',    h: 20 },
  rug:       { type: 'furniture', name: 'RUG',       cost: 20,  draw: 'rug',      h: 0  },
  bookshelf: { type: 'furniture', name: 'BOOKSHELF', cost: 60,  draw: 'bookshelf',h: 28 },
  beanbag:   { type: 'furniture', name: 'BEANBAG',   cost: 40,  draw: 'beanbag',  h: 10 },
  poster:    { type: 'furniture', name: 'POSTER',    cost: 35,  draw: 'poster',   h: 18 },
  // Consumables
  snack:     { type: 'food', name: 'SNACK',  cost: 8,  hunger: 25, happiness: 5 },
  feast:     { type: 'food', name: 'FEAST',  cost: 20, hunger: 60, happiness: 12 },
  medkit:    { type: 'food', name: 'MEDKIT', cost: 30, cure: true, energy: 20 },
};

TG.SHOP_ORDER = ['snack','feast','medkit','rug','plant','lamp','beanbag','poster','bookshelf'];

// Species after the starter set must be bought/unlocked.
TG.STARTER_SPECIES = ['robot','cat','ghost','mushroom'];
TG.SPECIES_COST = 80; // coins to unlock any locked species

// ── ACHIEVEMENTS ──────────────────────────────────────────
TG.ACHIEVEMENTS = {
  firstFeed:   { name: 'First Bite',     desc: 'Feed your pet once.' },
  level5:      { name: 'Growing Up',     desc: 'Reach level 5.' },
  adult:       { name: 'All Grown Up',   desc: 'Evolve to adult stage.' },
  bug10:       { name: 'Exterminator',   desc: 'Squash 10 bugs.' },
  bug50:       { name: 'Bug Slayer',     desc: 'Squash 50 bugs.' },
  rich:        { name: 'Venture Funded', desc: 'Hold 200 coins.' },
  collector:   { name: 'Collector',      desc: 'Unlock 6 species.' },
  decorator:   { name: 'Interior Dev',   desc: 'Place 4 items in the room.' },
  fullCare:    { name: 'Caretaker',      desc: 'Get every need above 90.' },
  streak3:     { name: 'Consistent',     desc: 'Visit 3 days in a row.' },
};

// ── DAILY QUESTS (sampled each new day) ───────────────────
TG.QUEST_POOL = [
  { id: 'feed3',  desc: 'Feed 3 times',        goal: 3, reward: 15, track: 'feeds' },
  { id: 'play2',  desc: 'Play 2 times',        goal: 2, reward: 12, track: 'plays' },
  { id: 'bug5',   desc: 'Win Bug Hunt once',   goal: 1, reward: 20, track: 'bugWins' },
  { id: 'clean1', desc: 'Clean your pet',      goal: 1, reward: 10, track: 'cleans' },
  { id: 'happy80',desc: 'Happiness to 80',     goal: 1, reward: 18, track: 'happy80' },
];
