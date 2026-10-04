// REEL RUSH — daily quests & achievements: seeded daily selection, event-driven
// progress, persistence, achievement checks. Pure logic — no DOM, no imports,
// no Date.now(): the caller always supplies the dateKey ('YYYY-MM-DD').
//
// Quest state shape (what serialize/deserialize carry):
//   { dateKey: 'YYYY-MM-DD', progress: { [questId]: number }, done: { [questId]: boolean } }
// `claimed` lives on quest objects only and is managed by the caller.

const SALT = 'REEL_RUSH_DAILY_V1:';
const QUESTS_PER_DAY = 3;

const DAILY_POOL = [
  { id: 'catch_n_fish',   icon: '🎣', target: 5,   textKo: '물고기 {n}마리 낚기',     textEn: 'Catch {n} fish' },
  { id: 'perfect_hooks',  icon: '✨', target: 3,   textKo: 'PERFECT 후킹 {n}회 성공', textEn: 'Land {n} PERFECT hooks' },
  { id: 'sell_fish',      icon: '🏪', target: 3,   textKo: '어획물 {n}마리 판매하기', textEn: 'Sell {n} fish' },
  { id: 'catch_at_night', icon: '🌙', target: 2,   textKo: '밤에 {n}마리 낚기',       textEn: 'Catch {n} fish at night' },
  { id: 'combo_x3',       icon: '🔥', target: 1,   textKo: '콤보 3 달성',             textEn: 'Reach combo x3' },
  { id: 'earn_coins',     icon: '🪙', target: 300, textKo: '🪙 {n} 벌기',             textEn: 'Earn 🪙{n}' },
  { id: 'big_fish',       icon: '📏', target: 1,   textKo: '2kg 초과 물고기 낚기',    textEn: 'Catch a fish over 2kg' },
];

// ---------------------------------------------------------------- seeded rng

function hashKey(str) { // FNV-1a 32-bit
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) { // Fisher–Yates on a copy
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

// ------------------------------------------------------------------- helpers

const asObject = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v)) ? v : null;

function sanitizeKey(v) {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return String(v);
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;

function clampProgress(v, target) {
  const n = Math.floor(num(v));
  if (n <= 0) return 0;
  return typeof target === 'number' ? Math.min(n, target) : n;
}

function freshState(dateKey = '') {
  return { dateKey: sanitizeKey(dateKey), progress: {}, done: {} };
}

// Rebuild a valid state from anything; drops garbage keys, clamps known ids.
function normalizeState(src) {
  const obj = asObject(src);
  if (!obj) return freshState();
  const progress = {};
  const done = {};
  const pSrc = asObject(obj.progress);
  if (pSrc) {
    for (const k of Object.keys(pSrc)) {
      const def = DAILY_POOL.find((d) => d.id === k);
      const v = clampProgress(pSrc[k], def ? def.target : Infinity);
      if (v > 0) progress[k] = v;
    }
  }
  const dSrc = asObject(obj.done);
  if (dSrc) {
    for (const k of Object.keys(dSrc)) if (dSrc[k] === true) done[k] = true;
  }
  return { dateKey: sanitizeKey(obj.dateKey), progress, done };
}

// The 3 quests of `dateKey`, with progress/done merged in from `state`
// (state.dateKey must already equal dateKey).
function buildQuests(dateKey, state) {
  const rng = mulberry32(hashKey(SALT + dateKey));
  return shuffled(DAILY_POOL, rng).slice(0, QUESTS_PER_DAY).map((def) => {
    const progress = clampProgress(state.progress[def.id], def.target);
    const done = state.done[def.id] === true || progress >= def.target;
    return {
      id: def.id,
      icon: def.icon,
      textKo: def.textKo.split('{n}').join(String(def.target)),
      textEn: def.textEn.split('{n}').join(String(def.target)),
      target: def.target,
      progress,
      done,
      claimed: false,
    };
  });
}

// ------------------------------------------------------------- daily quests

// daily(dateKey [, savedState]) -> exactly 3 quests for that date.
// Same dateKey => same selection (seeded shuffle). If savedState is given and
// is for the same date, its stored progress/done merge into the quests.
export function daily(dateKey, savedState) {
  const key = sanitizeKey(dateKey);
  const saved = asObject(savedState);
  const state = (saved && sanitizeKey(saved.dateKey) === key)
    ? normalizeState(saved)
    : freshState(key);
  return buildQuests(key, state);
}

// How much one event advances a given quest. Each event may advance several.
function eventCount(ev) {
  const n = Math.floor(num(ev.count));
  return n >= 1 ? n : 1;
}

function incrementFor(questId, type, ev) {
  switch (questId) {
    case 'catch_n_fish':   return type === 'catch' ? eventCount(ev) : 0;
    case 'perfect_hooks':  return type === 'perfect' ? 1 : 0;
    case 'sell_fish':      return type === 'sell' ? eventCount(ev) : 0;
    case 'catch_at_night': return (type === 'catch' && ev.night === true) ? eventCount(ev) : 0;
    case 'combo_x3':
      return (type === 'combo' && num(ev.combo) >= 3) ? 1 : 0;
    case 'earn_coins': {
      if (type !== 'sell') return 0;
      return Math.floor(num(ev.total));
    }
    case 'big_fish':
      return (type === 'catch' && num(ev.weightKg) > 2) ? 1 : 0;
    default:
      return 0;
  }
}

// record(questState, dateKey, event) -> quests that JUST became done.
// Mutates questState (dateKey/progress/done). If the state belongs to another
// date, the day rolls over and old progress is cleared. Irrelevant events,
// missing events, or already-done quests advance nothing.
export function record(questState, dateKey, event) {
  const key = sanitizeKey(dateKey);
  const state = asObject(questState) || freshState(key);
  if (sanitizeKey(state.dateKey) !== key || !asObject(state.progress) || !asObject(state.done)) {
    state.dateKey = key;
    state.progress = {};
    state.done = {};
  }
  const ev = asObject(event) || {};
  const type = typeof ev.type === 'string' ? ev.type : '';
  const newly = [];
  if (!type) return newly;
  for (const q of buildQuests(key, state)) {
    const inc = incrementFor(q.id, type, ev);
    if (inc <= 0 || q.done) continue;
    q.progress = Math.min(q.target, q.progress + inc);
    state.progress[q.id] = q.progress;
    if (q.progress >= q.target) {
      q.done = true;
      state.done[q.id] = true;
      newly.push(q);
    }
  }
  return newly;
}

// ------------------------------------------------------------- persistence

export function serialize(questState) {
  const st = normalizeState(questState);
  return JSON.stringify({ dateKey: st.dateKey, progress: st.progress, done: st.done });
}

export function deserialize(json) {
  if (typeof json !== 'string') {
    const obj = asObject(json);
    return obj ? normalizeState(obj) : freshState();
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return freshState(); // garbage in -> fresh state out
  }
  return normalizeState(parsed);
}

// ------------------------------------------------------------- achievements

// log entry counts as caught when present in the log (count defaults to >= 1).
function speciesCaught(log, fishId) {
  const entry = asObject(log) ? log[fishId] : null;
  if (!entry) return false;
  if (typeof entry !== 'object') return true;
  return entry.count === undefined ? true : num(entry.count) >= 1;
}

export const ACHIEVEMENTS = [
  {
    id: 'first_catch', icon: '🐟',
    nameKo: '첫 조우', nameEn: 'First Bite',
    descKo: '첫 물고기를 낚으세요.', descEn: 'Catch your very first fish.',
    check: (s) => num(s && s.catches) >= 1,
  },
  {
    id: 'species_10', icon: '📖',
    nameKo: '도감 초보', nameEn: 'Rookie Ichthyologist',
    descKo: '10종의 물고기를 도감에 기록하세요.', descEn: 'Log 10 different species.',
    check: (s) => num(s && s.species) >= 10,
  },
  {
    id: 'species_25', icon: '📚',
    nameKo: '도감 연구자', nameEn: 'Avid Collector',
    descKo: '25종의 물고기를 도감에 기록하세요.', descEn: 'Log 25 different species.',
    check: (s) => num(s && s.species) >= 25,
  },
  {
    id: 'perfect_25', icon: '⚡',
    nameKo: '완벽한 손목', nameEn: 'Perfect Touch',
    descKo: 'PERFECT 후킹 25회 성공.', descEn: 'Land 25 PERFECT hooks.',
    check: (s) => num(s && s.perfects) >= 25,
  },
  {
    id: 'combo_5', icon: '🌟',
    nameKo: '콤보의 달인', nameEn: 'Combo Artist',
    descKo: '콤보 x5를 달성하세요.', descEn: 'Reach a x5 combo.',
    check: (s) => num(s && s.bestCombo) >= 5,
  },
  {
    id: 'boss_coral', icon: '🗿',
    nameKo: '산호의 정복자', nameEn: 'Coral Conqueror',
    descKo: '보스 "코랄 콜로서스"를 낚으세요.', descEn: 'Catch the Coral Colossus.',
    check: (s, log) => speciesCaught(log, 'coral-colossus'),
  },
  {
    id: 'boss_leviathan', icon: '🐋',
    nameKo: '심연의 지배자', nameEn: 'Abyss Ruler',
    descKo: '보스 "어비설 리바이어던"을 낚으세요.', descEn: 'Catch the Abyssal Leviathan.',
    check: (s, log) => speciesCaught(log, 'abyssal-leviathan'),
  },
  {
    id: 'casts_100', icon: '🎯',
    nameKo: '근성의 캐스터', nameEn: 'Iron Arm',
    descKo: '100회 캐스팅하세요.', descEn: 'Cast 100 times.',
    check: (s) => num(s && s.casts) >= 100,
  },
  {
    id: 'earned_10000', icon: '💰',
    nameKo: '만코인 사냥꾼', nameEn: 'Coin Hunter',
    descKo: '누적 10,000코인을 벌으세요.', descEn: 'Earn 10,000 coins in total.',
    check: (s) => num(s && s.earned) >= 10000,
  },
  {
    id: 'night_10', icon: '🦉',
    nameKo: '야행성 어부', nameEn: 'Night Owl',
    descKo: '밤에 물고기 10마리를 낚으세요.', descEn: 'Catch 10 fish at night.',
    check: (s) => num(s && s.nightCatches) >= 10,
  },
  {
    id: 'escape_10', icon: '🛡️',
    nameKo: '포기하지 않는 각오', nameEn: 'Never give up',
    descKo: '물고기 10마리를 놓쳐도 다시 던지세요.', descEn: 'Lose 10 fish and keep casting.',
    check: (s) => num(s && s.escapes) >= 10,
  },
  {
    id: 'full_log', icon: '👑',
    nameKo: '완벽한 도감', nameEn: 'Completionist',
    descKo: '35종의 물고기를 모두 기록하세요.', descEn: 'Log all 35 species.',
    check: (s) => num(s && s.species) >= 35,
  },
];

// achievementState(stats, log, saved) -> [{ id, unlocked, isNew }]
// unlocked = saved?.[id] || check(); isNew = check() true but not yet saved.
export function achievementState(stats, log, saved) {
  const s = asObject(stats) || {};
  const l = asObject(log) || {};
  const unlockedMap = asObject(saved) || {};
  return ACHIEVEMENTS.map((a) => {
    let checked = false;
    try {
      checked = a.check(s, l) === true;
    } catch {
      checked = false; // a malformed check must never brick the UI
    }
    const savedUnlocked = unlockedMap[a.id] === true;
    return { id: a.id, unlocked: savedUnlocked || checked, isNew: checked && !savedUnlocked };
  });
}

export function ACHIEVEMENT_IDS() {
  return ACHIEVEMENTS.map((a) => a.id);
}

// Namespace facade: `quests.daily(...)`, `quests.record(...)` — as specified.
const quests = { daily, record, serialize, deserialize, achievementState, ACHIEVEMENT_IDS, ACHIEVEMENTS };
export { quests };
export default quests;
