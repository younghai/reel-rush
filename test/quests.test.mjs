// REEL RUSH — quests.js unit test (plain node, no framework).
// Run: node test/quests.test.mjs   → prints "QUESTS OK — N assertions", exits non-zero on failure.
import { strict as assert } from 'node:assert';
import { quests, ACHIEVEMENTS } from '../js/quests.js';

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const eq = (actual, expected, msg) => { assert.deepStrictEqual(actual, expected, msg); passed++; };

// ---- test-only date helpers (quests.js itself never touches Date) ----
const pad = (n) => String(n).padStart(2, '0');
function* daysOf2026() {
  const d = new Date(Date.UTC(2026, 0, 1));
  while (d.getUTCFullYear() === 2026) {
    yield `2026-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
// find a 2026 date whose 3 selected quests satisfy pred(ids)
function findDay(pred) {
  for (const k of daysOf2026()) {
    if (pred(quests.daily(k).map((q) => q.id))) return k;
  }
  return null;
}
const unlock = (stats, log, id) =>
  quests.achievementState(stats, log, {}).find((s) => s.id === id).unlocked;

try {
  // == 1. daily(): shape, determinism, distinctness =======================
  const d1 = quests.daily('2026-10-03');
  eq(d1, quests.daily('2026-10-03'), 'daily("2026-10-03") is deterministic (two calls equal)');
  ok(Array.isArray(d1) && d1.length === 3, 'daily() returns exactly 3 quests');
  eq(new Set(d1.map((q) => q.id)).size, 3, 'the 3 quests of a day have distinct ids');
  const POOL_IDS = ['catch_n_fish', 'perfect_hooks', 'sell_fish', 'catch_at_night', 'combo_x3', 'earn_coins', 'big_fish'];
  ok(d1.every((q) => POOL_IDS.includes(q.id)), 'daily quests come from the defined pool');
  for (const q of d1) {
    ok(typeof q.icon === 'string' && q.icon.length > 0, `${q.id}: icon present`);
    ok(typeof q.textKo === 'string' && q.textKo.length > 0 && !q.textKo.includes('{n}'), `${q.id}: textKo rendered`);
    ok(typeof q.textEn === 'string' && q.textEn.length > 0 && !q.textEn.includes('{n}'), `${q.id}: textEn rendered`);
    ok(Number.isFinite(q.target) && q.target > 0, `${q.id}: positive target`);
    ok(q.progress === 0, `${q.id}: fresh progress is 0`);
    ok(q.done === false && q.claimed === false, `${q.id}: fresh quest is not done / not claimed`);
  }

  // == 5. different dates -> different selection ==========================
  const idsA = d1.map((q) => q.id).join(',');
  const idsB = quests.daily('2026-10-04').map((q) => q.id).join(',');
  ok(idsA !== idsB, "daily('2026-10-03') and daily('2026-10-04') differ (>= 1 differing id)");

  // == 2. record(): catch_n_fish completes after 5 catches, exactly once ==
  const catchDay = findDay((ids) => ids.includes('catch_n_fish'));
  ok(catchDay !== null, 'found a 2026 day where catch_n_fish is selected');
  {
    const st = { dateKey: catchDay, progress: {}, done: {} };
    let newly = [];
    for (let i = 0; i < 4; i++) newly = quests.record(st, catchDay, { type: 'catch' });
    eq(newly, [], 'no quest newly done after 4 catches');
    eq(st.progress['catch_n_fish'], 4, 'catch_n_fish progress advanced to 4');
    newly = quests.record(st, catchDay, { type: 'catch' });
    eq(newly.length, 1, 'exactly one quest newly done on the 5th catch');
    eq(newly[0].id, 'catch_n_fish', 'the newly done quest is catch_n_fish');
    eq(newly[0].done, true, 'returned quest flagged done');
    eq(newly[0].progress, 5, 'returned quest progress clamped at target');
    eq(quests.record(st, catchDay, { type: 'catch' }), [], 'already-done quest is not returned again');
    eq(st.progress['catch_n_fish'], 5, 'progress stays clamped at target');
    eq(st.done['catch_n_fish'], true, 'questState.done records completion');
    ok(quests.daily(catchDay, st).find((q) => q.id === 'catch_n_fish').done === true,
      'daily() merges stored completion back into the quest');
  }

  // one event advancing multiple quests at once
  const catchBigDay = findDay((ids) => ids.includes('catch_n_fish') && ids.includes('big_fish'));
  ok(catchBigDay !== null, 'found a 2026 day with both catch_n_fish and big_fish');
  {
    const st = { dateKey: catchBigDay, progress: {}, done: {} };
    for (let i = 0; i < 4; i++) quests.record(st, catchBigDay, { type: 'catch' });
    const newly = quests.record(st, catchBigDay, { type: 'catch', weightKg: 2.6 });
    eq(newly.map((q) => q.id).sort(), ['big_fish', 'catch_n_fish'],
      'a single catch event can complete two quests at once');
  }

  // big_fish: strictly over 2kg
  const bigDay = findDay((ids) => ids.includes('big_fish'));
  ok(bigDay !== null, 'found a 2026 day where big_fish is selected');
  {
    const st = { dateKey: bigDay, progress: {}, done: {} };
    eq(quests.record(st, bigDay, { type: 'catch', weightKg: 2 }), [], 'exactly 2kg does not count');
    eq(st.progress['big_fish'] ?? 0, 0, 'big_fish untouched at exactly 2kg');
    const newly = quests.record(st, bigDay, { type: 'catch', weightKg: 2.01 });
    eq(newly.map((q) => q.id), ['big_fish'], 'a fish over 2kg completes big_fish');
  }

  // catch_at_night: only night catches advance it
  const nightDay = findDay((ids) => ids.includes('catch_at_night'));
  ok(nightDay !== null, 'found a 2026 day where catch_at_night is selected');
  {
    const st = { dateKey: nightDay, progress: {}, done: {} };
    eq(quests.record(st, nightDay, { type: 'catch' }), [], 'a day catch does not advance catch_at_night');
    eq(st.progress['catch_at_night'] ?? 0, 0, 'catch_at_night untouched by day catches');
    quests.record(st, nightDay, { type: 'catch', night: true });
    eq(st.progress['catch_at_night'], 1, 'a night catch advances catch_at_night');
    ok(quests.record(st, nightDay, { type: 'catch', night: true }).some((q) => q.id === 'catch_at_night'),
      'the second night catch completes catch_at_night');
  }

  // combo_x3: payload combo >= 3
  const comboDay = findDay((ids) => ids.includes('combo_x3'));
  ok(comboDay !== null, 'found a 2026 day where combo_x3 is selected');
  {
    const st = { dateKey: comboDay, progress: {}, done: {} };
    eq(quests.record(st, comboDay, { type: 'combo', combo: 2 }), [], 'combo x2 does not advance combo_x3');
    eq(st.progress['combo_x3'] ?? 0, 0, 'combo_x3 untouched at x2');
    ok(quests.record(st, comboDay, { type: 'combo', combo: 3 }).some((q) => q.id === 'combo_x3'),
      'combo x3 completes combo_x3');
  }

  // earn_coins: sell payload total, clamped at 300
  const coinDay = findDay((ids) => ids.includes('earn_coins'));
  ok(coinDay !== null, 'found a 2026 day where earn_coins is selected');
  {
    const st = { dateKey: coinDay, progress: {}, done: {} };
    quests.record(st, coinDay, { type: 'sell', total: 120 });
    eq(st.progress['earn_coins'], 120, 'sell payload total accumulates into earn_coins');
    ok(quests.record(st, coinDay, { type: 'sell', total: 500 }).some((q) => q.id === 'earn_coins'),
      'reaching 300 coins completes earn_coins');
    eq(st.progress['earn_coins'], 300, 'earn_coins progress clamped at 300');
  }

  // perfect_hooks + irrelevant events never advance anything
  const perfectDay = findDay((ids) => ids.includes('perfect_hooks'));
  ok(perfectDay !== null, 'found a 2026 day where perfect_hooks is selected');
  {
    const st = { dateKey: perfectDay, progress: {}, done: {} };
    eq(quests.record(st, perfectDay, { type: 'perfect' }), [], 'one perfect hook is not enough yet');
    quests.record(st, perfectDay, { type: 'perfect' });
    ok(quests.record(st, perfectDay, { type: 'perfect' }).some((q) => q.id === 'perfect_hooks'),
      'the third perfect hook completes perfect_hooks');
    eq(st.progress['perfect_hooks'], 3, 'perfect_hooks progress at target');
    const st2 = { dateKey: perfectDay, progress: {}, done: {} };
    eq(quests.record(st2, perfectDay, { type: 'cast' }), [], 'cast events advance nothing');
    eq(quests.record(st2, perfectDay, { type: 'escape' }), [], 'escape events advance nothing');
    eq(quests.record(st2, perfectDay, { type: 'snap' }), [], 'snap events advance nothing');
    quests.record(st2, perfectDay, { type: 'catch' });
    eq(st2.progress['perfect_hooks'] ?? 0, 0, 'catch events never advance perfect_hooks');
    eq(quests.record(st2, perfectDay, null), [], 'null event is safe');
    eq(quests.record(st2, perfectDay, {}), [], 'event without type is safe');
  }

  // day rollover: recording against a new date resets stale progress
  {
    const dayB = findDay((ids) => !ids.includes('catch_n_fish'));
    ok(dayB !== null, 'found a 2026 day without catch_n_fish');
    const st = { dateKey: catchDay, progress: {}, done: {} };
    for (let i = 0; i < 5; i++) quests.record(st, catchDay, { type: 'catch' });
    eq(st.done['catch_n_fish'], true, 'catch_n_fish done on day A');
    quests.record(st, dayB, { type: 'catch' });
    eq(st.dateKey, dayB, 'record() rolls the state over to the new date');
    eq(st.progress['catch_n_fish'], undefined, 'yesterday progress cleared on rollover');
    eq(st.done['catch_n_fish'], undefined, 'yesterday completion cleared on rollover');
    eq(quests.record(null, catchDay, { type: 'cast' }), [], 'record(null, ...) is safe');
  }

  // == 3. serialize / deserialize round-trip ==============================
  const rtDay = findDay((ids) => ids.includes('catch_n_fish') && ids.includes('earn_coins'));
  ok(rtDay !== null, 'found a 2026 day with catch_n_fish and earn_coins for round-trip');
  {
    const st = { dateKey: rtDay, progress: {}, done: {} };
    for (let i = 0; i < 5; i++) quests.record(st, rtDay, { type: 'catch' });
    quests.record(st, rtDay, { type: 'sell', total: 250 });
    ok(st.done['catch_n_fish'] === true && st.progress['earn_coins'] === 250,
      'state has both a completion and mid-progress before serialization');
    const json = quests.serialize(st);
    ok(typeof json === 'string', 'serialize() returns a JSON string');
    const back = quests.deserialize(json);
    eq(back.dateKey, st.dateKey, 'round-trip preserves dateKey');
    eq(back.progress, st.progress, 'round-trip preserves progress');
    eq(back.done, st.done, 'round-trip preserves done');
    for (const q of quests.daily(rtDay, back)) {
      eq(q.progress, st.progress[q.id] ?? 0, `merged progress for ${q.id}`);
      eq(q.done, st.done[q.id] === true, `merged done for ${q.id}`);
    }
  }
  {
    const fresh = { dateKey: '', progress: {}, done: {} };
    eq(quests.deserialize('not json at all {{{'), fresh, 'deserialize(garbage string) -> fresh state');
    eq(quests.deserialize(null), fresh, 'deserialize(null) -> fresh state');
    eq(quests.deserialize(undefined), fresh, 'deserialize(undefined) -> fresh state');
    eq(quests.deserialize(42), fresh, 'deserialize(number) -> fresh state');
    eq(quests.deserialize('[]'), fresh, 'deserialize(array JSON) -> fresh state');
    eq(quests.deserialize('{}'), fresh, 'deserialize(empty object) fills missing fields with defaults');
    eq(quests.deserialize('{"dateKey":"2026-01-02","progress":{"catch_n_fish":2,"junk":"x"},"done":{"catch_n_fish":true}}'),
      { dateKey: '2026-01-02', progress: { catch_n_fish: 2 }, done: { catch_n_fish: true } },
      'deserialize() drops malformed entries and keeps valid ones');
    eq(quests.deserialize(quests.serialize(null)), fresh, 'serialize(null) round-trips to fresh state');
    eq(quests.deserialize('{"dateKey":"2026-03-03","progress":{"earn_coins":9999}}').progress.earn_coins, 300,
      'deserialize clamps stored progress at the quest target');
  }

  // == 4. achievements ====================================================
  ok(Array.isArray(ACHIEVEMENTS) && ACHIEVEMENTS.length === 12, 'exactly 12 achievements are defined');
  const EXPECTED_IDS = ['first_catch', 'species_10', 'species_25', 'perfect_25', 'combo_5', 'boss_coral',
    'boss_leviathan', 'casts_100', 'earned_10000', 'night_10', 'escape_10', 'full_log'];
  eq(quests.ACHIEVEMENT_IDS(), EXPECTED_IDS, 'ACHIEVEMENT_IDS() lists the spec ids in order');
  for (const a of ACHIEVEMENTS) {
    ok(typeof a.id === 'string' && a.id.length > 0, `${a.id}: id present`);
    ok(typeof a.icon === 'string' && a.icon.length > 0, `${a.id}: icon present`);
    ok(typeof a.nameKo === 'string' && a.nameKo.length > 0, `${a.id}: nameKo present`);
    ok(typeof a.nameEn === 'string' && a.nameEn.length > 0, `${a.id}: nameEn present`);
    ok(typeof a.descKo === 'string' && a.descKo.length > 0, `${a.id}: descKo present`);
    ok(typeof a.descEn === 'string' && a.descEn.length > 0, `${a.id}: descEn present`);
    ok(typeof a.check === 'function', `${a.id}: check(stats, log) is a function`);
  }
  {
    const blank = quests.achievementState({}, {}, {});
    ok(Array.isArray(blank) && blank.length === 12, 'achievementState() returns one entry per achievement');
    ok(blank.every((s) => s.unlocked === false && s.isNew === false), 'fresh stats unlock nothing');
    ok(blank.every((s) => typeof s.id === 'string'), 'entries carry achievement ids');
    ok(quests.achievementState(null, null, null).every((s) => s.unlocked === false),
      'achievementState(null, null, null) is safe and unlocks nothing');
  }
  {
    const st = quests.achievementState({ species: 39 }, {}, {});
    const full = st.find((s) => s.id === 'full_log');
    ok(full && full.unlocked === true && full.isNew === true, 'species=35 unlocks full_log as isNew');
    eq(st.filter((s) => s.unlocked).map((s) => s.id).sort(), ['full_log', 'species_10', 'species_25'],
      'species thresholds unlock cumulatively (10, 25, 35)');
    const saved = quests.achievementState({ species: 39 }, {}, { full_log: true });
    const fullSaved = saved.find((s) => s.id === 'full_log');
    ok(fullSaved && fullSaved.unlocked === true && fullSaved.isNew === false,
      'saved full_log stays unlocked but is no longer new');
  }
  {
    const coralSt = quests.achievementState({}, { 'coral-colossus': { count: 1, maxW: 9.5 } }, {});
    const coral = coralSt.find((s) => s.id === 'boss_coral');
    ok(coral && coral.unlocked === true && coral.isNew === true, 'coral-colossus log entry unlocks boss_coral');
    ok(coralSt.find((s) => s.id === 'boss_leviathan').unlocked === false,
      'boss_leviathan stays locked without its own log entry');
    ok(quests.achievementState({}, { 'abyssal-leviathan': { count: 2, maxW: 21.0 } }, {})
      .find((s) => s.id === 'boss_leviathan').unlocked === true,
      'abyssal-leviathan log entry unlocks boss_leviathan');
  }
  ok(unlock({ catches: 1 }, {}, 'first_catch'), 'first_catch unlocks at 1 catch');
  ok(!unlock({ catches: 0 }, {}, 'first_catch'), 'first_catch locked at 0 catches');
  ok(unlock({ bestCombo: 5 }, {}, 'combo_5'), 'combo_5 unlocks at bestCombo 5');
  ok(!unlock({ bestCombo: 4 }, {}, 'combo_5'), 'combo_5 locked at bestCombo 4');
  ok(unlock({ perfects: 25 }, {}, 'perfect_25'), 'perfect_25 unlocks at 25 perfects');
  ok(unlock({ casts: 100 }, {}, 'casts_100'), 'casts_100 unlocks at 100 casts');
  ok(!unlock({ casts: 99 }, {}, 'casts_100'), 'casts_100 locked at 99 casts');
  ok(unlock({ earned: 10000 }, {}, 'earned_10000'), 'earned_10000 unlocks at 10000 coins');
  ok(!unlock({ species: 34 }, {}, 'full_log'), 'full_log locked at 34 species');
  ok(unlock({ nightCatches: 10 }, {}, 'night_10'), 'night_10 unlocks at 10 night catches');
  ok(!unlock({}, {}, 'night_10'), 'night_10 locked when nightCatches defaults to 0');
  ok(unlock({ escapes: 10 }, {}, 'escape_10'), 'escape_10 unlocks at 10 escapes');
  const esc = ACHIEVEMENTS.find((a) => a.id === 'escape_10');
  eq(esc.nameKo, '포기하지 않는 각오', 'escape_10 carries the spec Korean name');
  eq(esc.nameEn, 'Never give up', 'escape_10 carries the spec English name');

  console.log(`QUESTS OK — ${passed} assertions`);
} catch (err) {
  console.error('QUESTS FAILED:', err && err.message);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
}
