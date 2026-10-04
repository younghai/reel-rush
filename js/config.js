// REEL RUSH — balance & tuning constants (GDD: .omo/plans/reel-rush-gdd.md)

export const W = 1280, H = 720;
export const WATER_Y = 392; // sea surface line — single source of truth (scenes + fishing)

export const SAVE_KEY = 'reelrush.save.v1';

// Day/night cycle: 150s day + 90s night
export const DAY_LEN = 150, NIGHT_LEN = 90, CYCLE = DAY_LEN + NIGHT_LEN;

export const RARITIES = {
  common:    { order: 0, name: 'COMMON',    nameKo: '흔함',   color: '#cfe3ee', weight: 100,  mult: 1.0,  hitstop: 90,  shake: 6 },
  uncommon:  { order: 1, name: 'UNCOMMON',  nameKo: '일반',   color: '#59d97e', weight: 42,   mult: 1.35, hitstop: 130, shake: 9 },
  rare:      { order: 2, name: 'RARE',      nameKo: '희귀',   color: '#4db8ff', weight: 15,   mult: 1.8,  hitstop: 190, shake: 13 },
  epic:      { order: 3, name: 'EPIC',      nameKo: '에픽',   color: '#b06bff', weight: 5,    mult: 2.5,  hitstop: 260, shake: 18 },
  legendary: { order: 4, name: 'LEGENDARY', nameKo: '전설',   color: '#ffb02e', weight: 1.1,  mult: 3.6,  hitstop: 340, shake: 26 },
  mythic:    { order: 5, name: 'MYTHIC',    nameKo: '신화',   color: '#ff5d9e', weight: 0.22, mult: 5.0,  hitstop: 450, shake: 34 },
};

export const ZONES = [
  { id: 'pier',     nameKo: '부둣가',   cost: 0,     sky: ['#7ec8e8', '#bfe6f5', '#e8f7ff'], sea: ['#2a7ea8', '#174a68', '#0c2a3e'], sand: '#c9b48a', night: 0.55 },
  { id: 'shallows', nameKo: '얕은만',   cost: 800,   sky: ['#8fd4e8', '#cdf2f8', '#f0fbff'], sea: ['#2fa0b8', '#1a6a80', '#0e3d4e'], sand: '#d8c89a', night: 0.55 },
  { id: 'reef',     nameKo: '산호초',   cost: 3500,  sky: ['#6fc2e0', '#aee6f2', '#eafcff'], sea: ['#2088a8', '#16607e', '#0b3547'], sand: '#e0b890', night: 0.5 },
  { id: 'open',     nameKo: '대양',     cost: 12000, sky: ['#5aaee0', '#9cd4f0', '#d8f2ff'], sea: ['#1a6898', '#0f4468', '#082a42'], sand: '#b8a882', night: 0.45 },
  { id: 'abyss',    nameKo: '심해',     cost: 40000, sky: ['#3a5a7e', '#2a4260', '#1a2c44'], sea: ['#10304a', '#0a1e34', '#050f1c'], sand: '#4a5568', night: 0.3 },
];

// Cast distance within a zone maps to depth bands — deeper = rarer bias
export const DEPTH_BANDS = [
  { id: 'near', nameKo: '가까움', from: 0.0, to: 0.45, rareBias: 1.0 },
  { id: 'mid',  nameKo: '중간',   from: 0.45, to: 0.75, rareBias: 1.35 },
  { id: 'far',  nameKo: '깊음',   from: 0.75, to: 1.0,  rareBias: 1.9 },
];

export const UPGRADES = [
  { id: 'rod',  icon: '🎣', nameKo: '낚싯대', desc: lv => `후킹 창 +${lv * 10}%, 파이팅 진행 속도 +${lv * 22}%`, costs: [150, 600, 2200, 8000] },
  { id: 'line', icon: '🧵', nameKo: '낚싯줄', desc: lv => `고속 회전(위험) 허용 시간 +${(lv * 0.45).toFixed(2)}초`, costs: [120, 500, 1800, 6500] },
  { id: 'reel', icon: '🌀', nameKo: '릴',     desc: lv => `릴링 힘 +${lv * 25}% (스태미나 소모↑)`, costs: [200, 750, 2600, 9500] },
  { id: 'bait', icon: '🪱', nameKo: '미끼',   desc: lv => `입질 대기 -${lv * 18}%, 희귀 어종 확률 +${lv * 15}%`, costs: [250, 900, 3200, 11000] },
];

export const FIGHT = {
  tensionRise: 52,        // base tension/sec while reeling
  tensionFall: 95,        // tension/sec while NOT reeling
  fishPullScale: 0.5,     // fish strength contribution while reeling
  surgePullScale: 0.9,    // extra tension during fish surge
  greenLow: 25, greenHigh: 80,
  redHigh: 100,
  strainBase: 1.25,       // sec of sustained red before snap (line lvl adds)
  progressRate: 17,       // %/sec in green band at rod 0
  progressStaminaBonus: 1.9, // multiplier when fish stamina depleted
  progressDecayLow: 5,    // %/sec decay when tension below green
  progressDecayRed: 11,   // %/sec decay in red
  reelStaminaDrain: 13,   // fish stamina/sec at reel 0
  escapeSeconds: 9,       // progress<=0 this long -> escape
  perfectSeed: 15,        // progress % from PERFECT hookset
  perfectTension: 38,     // starting tension on perfect
  windowBase: 0.62,       // strike window sec (minus fish speed/rod factors)
  windowMin: 0.3,
  perfectFrac: 0.42,      // first fraction of window counts as PERFECT
};

export const CAST = {
  cycleTime: 1.15,        // power meter oscillation period
  minDist: 360, maxDist: 920, // px bobber landing range (keeps bobber on-canvas)
};

export const WAIT = {
  baseMin: 1.8, baseMax: 5.5, // sec before bite (bait reduces)
};

export const COMBO = {
  windowSec: 14,          // catch within this window to keep combo
  multPer: 0.12,          // +12%/stack
  maxMult: 2.5,
};

export const LOG_BONUS = { perNewSpecies: 0.02, max: 0.3 }; // +2% sell per new species
