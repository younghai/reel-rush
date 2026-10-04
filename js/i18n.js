// REEL RUSH — i18n string tables & locale helpers
// KO table is the source of truth (mirrors hardcoded strings in main.js / fishing.js /
// scenes.js / index.html / config.js). EN uses a punchy arcade tone.
//
// Zero dependencies. Pure ES module, importable in Node:
// localStorage / navigator / window access is guarded with typeof checks + try/catch.
//
// Public API:
//   t(key, params)    localized string, {token} substitution, unknown key -> key itself
//   getLocale()       'ko' | 'en'
//   setLocale(loc)    'ko' | 'en'; persists to localStorage 'reelrush.locale' (guarded);
//                     fires window event 'reelrush:locale' when a window exists (guarded)
//   detectLocale()    localStorage -> navigator.language (ko* => ko) -> 'en' (node-safe)
//   fishName(fish)    fish object with .name / .nameKo -> locale-appropriate name
//   rarityName(r)     'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
//   zoneName(id)      'pier' | 'shallows' | 'reef' | 'open' | 'abyss'
//   timeName(t)       'any' | 'day' | 'night'

// ============================================================
// KO table (source of truth)
// ============================================================
const KO = {
  // ---- toasts (main.js) ----
  'toast.firstCast': '🎣 첫 캐스트를 시작해보세요!',
  'toast.snap': '줄이 끊어졌다! 🪢 업그레이드를 확인하자',
  'toast.miss': '입질을 놓쳤다…',
  'toast.escape': '도망갔다…! 🐟💨',
  'toast.needCoins': '🪙 {cost}이 필요해요 (보유: {have})',
  'toast.zoneMove': '📍 {zone}로 이동!',
  'toast.zoneUnlocked': '🗺️ 새 어장 개방: {zone}!',
  'toast.upgradeDone': '{icon} {name} 강화 완료!',
  'toast.sold': '판매 완료! +🪙{n}',
  'toast.bossFound': '👑 보스 발견: {name}!',

  // ---- state hints (main.js HINTS) ----
  'hint.idle': '🖱️ 클릭해서 캐스트!',
  'hint.casting': '⚡ 파워가 한계에 가까울 때 클릭! (깊을수록 희귀어 ↑)',
  'hint.bobbing': '…입질을 기다리는 중 (클릭: 회수)',
  'hint.strike': '❗ 지금 즉시 클릭!',
  'hint.fight': '🖱️ 홀드: 릴링 / 놓기: 텐션 휴식 — 초록 밴드 유지!',

  // ---- HUD buttons & panel headers (main.js / index.html) ----
  'ui.tabUpgrades': '업그레이드',
  'ui.tabCooler': '어획물',
  'ui.tabLog': '도감',
  'ui.tabShop': '상점',
  'ui.maxBtn': '완료',
  'ui.sellAll': '전체 판매하기 — 🪙 {n}',
  'ui.sellEmpty': '판매할 어획물 없음',
  'ui.coolerEmpty': '아직 잡은 물고기가 없어요. 낚시하러 가요! 🎣',
  'ui.panelShop': '낚시 상점',
  'ui.panelLog': '어족도감',
  'ui.titleTime': '시간대',
  'ui.titleZone': '어장',
  'ui.titleMute': '소리',

  // ---- collection log (main.js) ----
  'log.progress': '도감 완성도 {caught} / {total}종 — 판매 보너스 +{bonus}%',
  'log.count': '{n}마리',
  'log.maxWeight': '최대 {w}kg',
  'log.level': 'Lv.{n}',
  'log.max': '(MAX)',

  // ---- fight floaters (fishing.js) ----
  'fight.perfect': 'PERFECT!',
  'fight.snap': '줄 끊어짐!',
  'fight.miss': '놓쳤다…!',
  'fight.enrage': '{name} 격노!!',
  'fight.newSpecies': 'NEW SPECIES!',

  // ---- scene overlay text (scenes.js) ----
  'scene.powerClick': '파워 클릭!',
  'scene.depth': '{band} 수심',
  'scene.tension': 'LINE TENSION — 초록 밴드를 유지!',
  'scene.fightHelp': '— 홀드: 릴링 / 해제: 휴식',
  'scene.newLog': '도감 신규 등록!',
  'scene.perfectHook': 'PERFECT HOOK x1.5',
  'scene.combo': 'COMBO x{n}',
  'scene.value': '+{n}🪙',

  // ---- depth bands (config.js DEPTH_BANDS) ----
  'depth.near': '가까움',
  'depth.mid': '중간',
  'depth.far': '깊음',

  // ---- intro (index.html) ----
  'intro.title': '몬스터 피싱 아케이드',
  'intro.howto1': '클릭으로 캐스트 → "!"가 뜨면 클릭으로 후킹 →',
  'intro.howto2': '긴장 게이지를 초록 밴드에 유지하며 릴링!',
  'intro.start': '출항하기',

  // ---- upgrade names & descriptions (config.js UPGRADES) ----
  'upg.rod.name': '낚싯대',
  'upg.rod.desc': '후킹 창 +{p1}%, 파이팅 진행 속도 +{p2}%',
  'upg.line.name': '낚싯줄',
  'upg.line.desc': '고속 회전(위험) 허용 시간 +{n}초',
  'upg.reel.name': '릴',
  'upg.reel.desc': '릴링 힘 +{n}% (스태미나 소모↑)',
  'upg.bait.name': '미끼',
  'upg.bait.desc': '입질 대기 -{n}%, 희귀 어종 확률 +{m}%',
};

// ============================================================
// EN table (must mirror every KO key)
// ============================================================
const EN = {
  // ---- toasts ----
  'toast.firstCast': '🎣 Time for your first cast!',
  'toast.snap': 'Line snapped! 🪢 Check your upgrades',
  'toast.miss': 'Missed the bite…',
  'toast.escape': 'It got away…! 🐟💨',
  'toast.needCoins': 'Need 🪙 {cost} (have: {have})',
  'toast.zoneMove': '📍 Heading to {zone}!',
  'toast.zoneUnlocked': '🗺️ New grounds unlocked: {zone}!',
  'toast.upgradeDone': '{icon} {name} upgraded!',
  'toast.sold': 'Sold! +🪙{n}',
  'toast.bossFound': '👑 Boss spotted: {name}!',

  // ---- state hints ----
  'hint.idle': '🖱️ Click to cast!',
  'hint.casting': '⚡ Click near max power! (deeper = rarer fish ↑)',
  'hint.bobbing': '…waiting for a bite (click: reel in)',
  'hint.strike': '❗ CLICK NOW!',
  'hint.fight': '🖱️ Hold: reel / Release: rest — stay in the green!',

  // ---- HUD buttons & panel headers ----
  'ui.tabUpgrades': 'Upgrades',
  'ui.tabCooler': 'Catch',
  'ui.tabLog': 'Log',
  'ui.tabShop': 'Shop',
  'ui.maxBtn': 'MAX',
  'ui.sellAll': 'Sell All — 🪙 {n}',
  'ui.sellEmpty': 'Nothing to sell',
  'ui.coolerEmpty': 'No fish yet. Go get some! 🎣',
  'ui.panelShop': 'Fishing Shop',
  'ui.panelLog': 'Fish Log',
  'ui.titleTime': 'Time',
  'ui.titleZone': 'Zone',
  'ui.titleMute': 'Sound',

  // ---- collection log ----
  'log.progress': 'Log {caught} / {total} species — sell bonus +{bonus}%',
  'log.count': '{n} caught',
  'log.maxWeight': 'max {w}kg',
  'log.level': 'Lv.{n}',
  'log.max': '(MAX)',

  // ---- fight floaters ----
  'fight.perfect': 'PERFECT!',
  'fight.snap': 'LINE SNAPPED!',
  'fight.miss': 'MISSED…!',
  'fight.enrage': '{name} ENRAGED!!',
  'fight.newSpecies': 'NEW SPECIES!',

  // ---- scene overlay text ----
  'scene.powerClick': 'CLICK FOR POWER!',
  'scene.depth': '{band} depth',
  'scene.tension': 'LINE TENSION — keep it in the green!',
  'scene.fightHelp': '— Hold: reel / Release: rest',
  'scene.newLog': 'NEW LOG ENTRY!',
  'scene.perfectHook': 'PERFECT HOOK x1.5',
  'scene.combo': 'COMBO x{n}',
  'scene.value': '+{n}🪙',

  // ---- depth bands ----
  'depth.near': 'Shallow',
  'depth.mid': 'Mid',
  'depth.far': 'Deep',

  // ---- intro ----
  'intro.title': 'MONSTER FISHING ARCADE',
  'intro.howto1': 'Click to cast → click to hook when "!" appears →',
  'intro.howto2': 'Reel while keeping the tension gauge in the green band!',
  'intro.start': 'SET SAIL!',

  // ---- upgrade names & descriptions ----
  'upg.rod.name': 'Rod',
  'upg.rod.desc': 'Hook window +{p1}%, fight progress +{p2}%',
  'upg.line.name': 'Line',
  'upg.line.desc': 'Overspin (danger) tolerance +{n}s',
  'upg.reel.name': 'Reel',
  'upg.reel.desc': 'Reel power +{n}% (stamina drain↑)',
  'upg.bait.name': 'Bait',
  'upg.bait.desc': 'Bite wait -{n}%, rare fish odds +{m}%',
};

// ============================================================
// Locale registry + state
// ============================================================
export const MESSAGES = { ko: KO, en: EN };

const LOCALE_KEY = 'reelrush.locale';
const SUPPORTED = ['ko', 'en'];

function isSupported(loc) {
  return SUPPORTED.includes(loc);
}

// localStorage is unavailable/blocked in some environments (Node, sandboxed iframes,
// privacy modes) — every access is guarded so the module still works in-memory.
function storageGet(key) {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch (_) { /* storage blocked */ }
  return null;
}
function storageSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch (_) { /* storage blocked */ }
}

export function detectLocale() {
  const saved = storageGet(LOCALE_KEY);
  if (saved === 'ko' || saved === 'en') return saved;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
      return navigator.language.startsWith('ko') ? 'ko' : 'en';
    }
  } catch (_) { /* navigator unavailable */ }
  return 'en';
}

let currentLocale = detectLocale();

export function getLocale() {
  return currentLocale;
}

export function setLocale(loc) {
  const next = typeof loc === 'string' ? loc.toLowerCase() : '';
  if (!isSupported(next)) return currentLocale;
  currentLocale = next;
  storageSet(LOCALE_KEY, next);
  // let the UI re-render on locale change (browser only)
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const Ctor = typeof CustomEvent === 'function' ? CustomEvent : window.Event;
      window.dispatchEvent(new Ctor('reelrush:locale', { detail: { locale: next } }));
    }
  } catch (_) { /* event dispatch unavailable */ }
  return currentLocale;
}

// ============================================================
// Translation lookup
// ============================================================
const TOKEN_RE = /\{(\w+)\}/g;

export function t(key, params) {
  let str = MESSAGES[currentLocale]?.[key];
  if (str == null) str = MESSAGES.ko[key]; // fallback: requested locale -> ko
  if (str == null) return key;             // last resort: the key itself
  if (params != null) {
    str = str.replace(TOKEN_RE, (token, name) =>
      params[name] != null ? String(params[name]) : token);
  }
  return str;
}

// ============================================================
// Domain helpers (fish / rarity / zone / time)
// ============================================================
export function fishName(fish) {
  if (fish == null) return '';
  return currentLocale === 'ko'
    ? (fish.nameKo ?? fish.name ?? '')
    : (fish.name ?? fish.nameKo ?? '');
}

const RARITY_NAMES = {
  common:    { ko: '흔함', en: 'Common' },
  uncommon:  { ko: '일반', en: 'Uncommon' },
  rare:      { ko: '희귀', en: 'Rare' },
  epic:      { ko: '에픽', en: 'Epic' },
  legendary: { ko: '전설', en: 'Legendary' },
  mythic:    { ko: '신화', en: 'Mythic' },
};

export function rarityName(rarity) {
  const entry = RARITY_NAMES[rarity];
  if (!entry) return rarity ?? '';
  return currentLocale === 'ko' ? entry.ko : entry.en;
}

const ZONE_NAMES = {
  pier:     { ko: '부둣가',   en: 'Pier' },
  shallows: { ko: '얕은만',   en: 'Shallows' },
  reef:     { ko: '산호초',   en: 'Reef' },
  open:     { ko: '대양',     en: 'Open Sea' },
  abyss:    { ko: '심해',     en: 'Abyss' },
};

export function zoneName(zoneId) {
  const entry = ZONE_NAMES[zoneId];
  if (!entry) return zoneId ?? '';
  return currentLocale === 'ko' ? entry.ko : entry.en;
}

const TIME_NAMES = {
  any:   { ko: '언제든', en: 'Anytime' },
  day:   { ko: '낮',     en: 'Day' },
  night: { ko: '밤',     en: 'Night' },
};

export function timeName(time) {
  const entry = TIME_NAMES[time];
  if (!entry) return time ?? '';
  return currentLocale === 'ko' ? entry.ko : entry.en;
}
