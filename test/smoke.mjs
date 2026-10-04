// REEL RUSH — headless logic smoke test (node). Exercises the full fishing loop
// with juice/audio stubs, economy math, and fish-selection distribution.
import { FishingGame } from '../js/fishing.js';
import { Economy, calcValue, rollWeight } from '../js/economy.js';
import { FISHES } from '../js/data/fishes.js';
import { ZONES, RARITIES, COMBO, DEPTH_BANDS } from '../js/config.js';

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ok  -', msg); } else { failed++; console.error('  FAIL -', msg); } };

// recording stubs: any method callable, records names
const recorder = (label) => new Proxy({}, {
  get: (t, k) => (typeof k === 'string') ? ((...a) => { (recorder.calls ||= []).push(label + ':' + k); return undefined; }) : undefined,
});

console.log('== 1. full fishing loop simulation (cast -> bite -> perfect hook -> fight -> catch -> sell) ==');
{
  const eco = new Economy('reelrush.test');
  const events = [];
  const fg = new FishingGame({
    juice: recorder('juice'), audio: recorder('audio'),
    economy: eco, fishes: FISHES, onEvent: (t, d) => events.push(t),
  });
  fg._night = false;

  fg.press();
  ok(fg.state === 'casting', 'press() in idle begins casting');
  fg.cast.t = 0.28; fg.update(0.001); // move meter
  fg.press();
  ok(fg.state === 'flying', 'second press locks power -> flying');

  let guard = 0;
  while (fg.state === 'flying' && guard++ < 200) fg.update(0.05);
  ok(fg.state === 'bobbing', 'bobber lands -> bobbing');
  ok(eco.s.stats.casts === 1, 'cast counted');

  fg.debugBite = true;
  fg.update(0.016);
  ok(fg.state === 'strike', 'forced bite -> strike window');

  fg.update(0.1); // 100ms into window (< perfectFrac)
  fg.press();
  ok(fg.state === 'fight', 'early press -> hookset -> fight');
  ok(fg.lastPerfect === true, 'early press counted PERFECT');
  ok(fg.fight.progress >= 15, `perfect seeds progress (${fg.fight.progress.toFixed(1)})`);

  guard = 0;
  while (fg.state === 'fight' && guard++ < 4000) {
    fg.holdReeling = fg.fight.tension < 72;
    fg.update(0.033);
  }
  ok(fg.state === 'reveal', `fight resolved to reveal (state=${fg.state}, guard=${guard})`);
  ok(!!fg.reveal, 'reveal payload exists');
  ok(eco.cooler.length === 1, 'catch added to cooler');
  ok(eco.s.stats.catches === 1, 'catch counted');
  ok(eco.s.log[fg.reveal.fish.id]?.count === 1, 'collection log updated');
  ok(fg.reveal.value >= 1, `value computed (${fg.reveal.value})`);
  ok(events.includes('catch'), 'catch event fired');

  const coinsBefore = eco.coins;
  const gained = eco.sellAll();
  ok(gained === fg.reveal.value && eco.coins === coinsBefore + gained, `sellAll credits coins (+${gained})`);

  ok(recorder.calls.includes('juice:hitstop'), 'juice.hitstop fired');
  ok(recorder.calls.includes('juice:shake'), 'juice.shake fired');
  ok(recorder.calls.includes('juice:burst'), 'juice.particles fired');
  ok(recorder.calls.includes('audio:catchSting'), 'audio fanfare fired');
}

console.log('== 2. fight failure paths ==');
{
  // escape path: never reel, tension decays, progress hits 0 and stays
  const eco = new Economy('reelrush.test2');
  const fg = new FishingGame({ juice: recorder('j'), audio: recorder('a'), economy: eco, fishes: FISHES, onEvent: () => {} });
  fg._night = false;
  fg.press(); fg.cast.t = 0.28; fg.update(0.001); fg.press();
  let g = 0; while (fg.state === 'flying' && g++ < 200) fg.update(0.05);
  fg.debugBite = true; fg.update(0.016);
  fg.update(0.5); fg.press(); // late press: not perfect but hooks
  ok(fg.state === 'fight', 'late-but-in-window press hooks the fish');
  g = 0;
  while (fg.state === 'fight' && g++ < 2000) { fg.holdReeling = false; fg.update(0.05); }
  ok(fg.state === 'idle' && eco.s.stats.escapes === 1, `no-reel leads to escape (${fg.state})`);
}

console.log('== 3. economy math ==');
{
  const sardine = FISHES.find(f => f.id === 'sardine');
  const v0 = calcValue(sardine, sardine.weight[0]);
  const vMax = calcValue(sardine, sardine.weight[1]);
  ok(vMax > v0, `value scales with weight (${v0} -> ${vMax})`);
  const vPerfect = calcValue(sardine, sardine.weight[0], { perfect: true });
  ok(Math.abs(vPerfect / v0 - 1.5) < 0.02, 'perfect = x1.5');
  const vCombo = calcValue(sardine, sardine.weight[0], { comboMult: 1.5 });
  ok(Math.abs(vCombo / v0 - 1.5) < 0.02, 'combo multiplier applied');
  ok(economyComboCap(), 'combo mult capped at ' + COMBO.maxMult);

  const eco = new Economy('reelrush.test3');
  eco.addCoins(1000);
  ok(eco.buyUpgrade('rod'), 'can afford rod upgrade');
  ok(eco.upgrades.rod === 1 && eco.upgradeCost('rod') === 600, 'level + next cost tracked');
  eco.s.coins = 10;
  ok(!eco.buyUpgrade('rod'), 'cannot buy without coins');

  ok(!eco.unlockZone('abyss'), 'zone unlock gated by coins');
  eco.s.coins = 999999;
  ok(eco.unlockZone('abyss') && eco.zoneUnlocked('abyss'), 'zone unlocks with funds');
  ok(!eco.selectZone('nowhere'), 'cannot select unknown zone');

  for (let i = 0; i < 100; i++) {
    const f = FISHES[(Math.random() * FISHES.length) | 0];
    const w = rollWeight(f);
    if (w < f.weight[0] - 1e-9 || w > f.weight[1] + 1e-9) { ok(false, `rollWeight out of range for ${f.id}`); break; }
  }
  ok(true, 'rollWeight within [min,max] over 100 rolls');
}
function economyComboCap() {
  const eco = new Economy('reelrush.cap');
  let last = 0;
  for (let c = 1; c <= 30; c++) last = eco.comboMult(c);
  return Math.abs(last - COMBO.maxMult) < 1e-9;
}

console.log('== 4. fish table integrity + selection coverage ==');
{
  ok(FISHES.length >= 32, `species count = ${FISHES.length}`);
  for (const z of ZONES) {
    for (const night of [false, true]) {
      const slot = night ? 'night' : 'day';
      const expected = FISHES.filter(f => f.zone === z.id && (f.time === 'any' || f.time === slot));
      ok(expected.length > 0, `${z.id} ${slot}: ${expected.length} eligible species`);
    }
  }
  const eco = new Economy('reelrush.test4');
  const fg = new FishingGame({ juice: recorder('j'), audio: recorder('a'), economy: eco, fishes: FISHES, onEvent: () => {} });
  for (const z of ZONES) {
    const seen = new Set();
    for (let i = 0; i < 20000; i++) {
      const f = fg.pickFish(z.id, i % 2 === 0, Math.random());
      if (f) seen.add(f.id);
    }
    const eligible = FISHES.filter(f => f.zone === z.id).map(f => f.id);
    const missing = eligible.filter(id => !seen.has(id));
    ok(missing.length === 0, `${z.id}: all ${eligible.length} species reachable (missing: ${missing.join(',') || 'none'})`);
  }
  // rarity distribution sanity: commons >> mythics
  const eco2 = new Economy('reelrush.test5');
  const fg2 = new FishingGame({ juice: recorder('j'), audio: recorder('a'), economy: eco2, fishes: FISHES, onEvent: () => {} });
  const counts = {};
  for (let i = 0; i < 20000; i++) {
    const f = fg2.pickFish('reef', false, 0.9);
    counts[f.rarity] = (counts[f.rarity] || 0) + 1;
  }
  const c = counts.common || 0, m = counts.mythic || 0;
  ok(c > m * 20, `reef day distribution: common=${c} >> mythic=${m}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
