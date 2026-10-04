// REEL RUSH — economy: coins, upgrades, zone unlocks, cooler, collection log, save/load
// Pure logic — no DOM. Node-importable.

import { SAVE_KEY, UPGRADES, ZONES, RARITIES, COMBO, LOG_BONUS } from './config.js';

// Pure value formula: base * weight ratio * rarity * combo * perfect * collection bonus
export function calcValue(fish, weight, { comboMult = 1, perfect = false, logBonus = 0 } = {}) {
  const ratio = weight / fish.weight[0];
  const v = fish.baseValue * (0.4 + 0.6 * ratio) * RARITIES[fish.rarity].mult
    * comboMult * (perfect ? 1.5 : 1) * (1 + logBonus);
  // finite-guard: a corrupted upstream value must never brick the economy with NaN
  return Number.isFinite(v) ? Math.max(1, Math.round(v)) : 1;
}

export function rollWeight(fish, rng = Math.random) {
  const [lo, hi] = fish.weight;
  const r = rng();
  const skewed = r ** 1.7; // most fish near the small end, trophies rare
  return +(lo + (hi - lo) * skewed).toFixed(2);
}

const finiteInt = (v, dflt, lo = 0, hi = 1e12) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export class Economy {
  constructor(saveKey = SAVE_KEY) {
    this.saveKey = saveKey;
    this.cooler = []; // session catch bag: {fishId, weight, value, rarity}
    this.#load();
  }

  #fresh() {
    return {
      coins: 30,
      upgrades: { rod: 0, line: 0, reel: 0, bait: 0 },
      zones: ['pier'],
      zone: 'pier',
      log: {}, // id -> {count, maxW, best:{weight,value}}
      stats: { casts: 0, catches: 0, escapes: 0, snaps: 0, perfects: 0, earned: 0, bestCombo: 0, species: 0, nightCatches: 0 },
      muted: false,
      // v2 (saveVer 2): retention layer
      saveVer: 2,
      quests: null,        // { dateKey, list: serialize() output } — hydrated by quests.js at runtime
      achievements: {},    // id -> true (unlocked)
      musicVolume: 0.5,
      musicOn: false,      // ambient music is opt-in (a droning pad at boot read as an unwanted hum)
      locale: null,        // 'ko' | 'en' | null (auto)
    };
  }

  // Coerce a (possibly hand-tampered or version-drifted) save into valid shapes.
  // Anything non-finite or out of range falls back to fresh defaults — a poisoned
  // save must never produce NaN game math (jammed bite timers, NaN catch values).
  #sanitize(s) {
    const fresh = this.#fresh();
    const out = { ...fresh, ...s };
    out.coins = finiteInt(s.coins, fresh.coins, 0, 1e8);
    out.upgrades = { ...fresh.upgrades };
    for (const k of Object.keys(fresh.upgrades)) out.upgrades[k] = finiteInt(s.upgrades?.[k], 0, 0, UPGRADES.find(u => u.id === k).costs.length);
    out.zones = Array.isArray(s.zones) ? [...new Set(s.zones.filter(z => ZONES.some(z2 => z2.id === z)))] : [];
    if (!out.zones.includes('pier')) out.zones.unshift('pier');
    out.zone = ZONES.some(z => z.id === s.zone) ? s.zone : 'pier';
    out.log = {};
    if (s.log && typeof s.log === 'object') {
      for (const [id, e] of Object.entries(s.log)) {
        if (!e || typeof e !== 'object') continue;
        out.log[id] = { count: finiteInt(e.count, 0, 0), maxW: Number.isFinite(Number(e.maxW)) ? Number(e.maxW) : 0 };
      }
    }
    out.stats = { ...fresh.stats };
    for (const k of Object.keys(fresh.stats)) out.stats[k] = finiteInt(s.stats?.[k], 0, 0);
    out.muted = !!s.muted;
    // v2 retention layer: tolerate v1 saves (fields absent -> defaults) and malformed values
    out.saveVer = 2;
    out.quests = (s.quests && typeof s.quests === 'object' && typeof s.quests.dateKey === 'string') ? s.quests : null;
    out.achievements = {};
    if (s.achievements && typeof s.achievements === 'object') {
      for (const [id, v] of Object.entries(s.achievements)) if (v === true) out.achievements[id] = true;
    }
    const mv = Number(s.musicVolume);
    out.musicVolume = Number.isFinite(mv) ? Math.min(1, Math.max(0, mv)) : 0.5;
    out.musicOn = !!s.musicOn;
    out.locale = (s.locale === 'ko' || s.locale === 'en') ? s.locale : null;
    return out;
  }

  #load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      this.s = this.#sanitize(raw ? JSON.parse(raw) : {});
    } catch {
      this.s = this.#fresh();
    }
  }
  save() {
    try { localStorage.setItem(this.saveKey, JSON.stringify(this.s)); } catch { /* storage unavailable */ }
  }
  reset() { this.s = this.#fresh(); this.cooler = []; this.save(); }

  get coins() { return this.s.coins; }
  get upgrades() { return this.s.upgrades; }
  get zone() { return this.s.zone; }
  get stats() { return this.s.stats; }

  addCoins(n) { n = Number(n); if (!Number.isFinite(n)) return; this.s.coins += n; if (n > 0) this.s.stats.earned += n; }

  upgradeCost(id) {
    const u = UPGRADES.find(u => u.id === id);
    const lv = this.s.upgrades[id];
    return lv >= u.costs.length ? null : u.costs[lv];
  }
  buyUpgrade(id) {
    const cost = this.upgradeCost(id);
    if (cost == null || this.s.coins < cost) return false;
    this.s.coins -= cost;
    this.s.upgrades[id]++;
    this.save();
    return true;
  }

  zoneUnlocked(id) { return this.s.zones.includes(id); }
  unlockZone(id) {
    const z = ZONES.find(z => z.id === id);
    if (!z || this.zoneUnlocked(id) || this.s.coins < z.cost) return false;
    this.s.coins -= z.cost;
    this.s.zones.push(id);
    this.save();
    return true;
  }
  selectZone(id) { if (this.zoneUnlocked(id)) { this.s.zone = id; this.save(); return true; } return false; }

  // combo multiplier from consecutive catches
  comboMult(combo) { return Math.min(COMBO.maxMult, 1 + (combo - 1) * COMBO.multPer); }

  addCatch(fish, weight, value) {
    this.cooler.push({ fishId: fish.id, weight, value, rarity: fish.rarity });
    const entry = this.s.log[fish.id] || { count: 0, maxW: 0 };
    const isNew = entry.count === 0;
    entry.count++;
    entry.maxW = Math.max(entry.maxW, weight);
    this.s.log[fish.id] = entry;
    this.s.stats.catches++;
    if (isNew) this.s.stats.species = Object.keys(this.s.log).length;
    this.save();
    return { isNew };
  }

  // collection completion bonus: +2%/new species up to +30%
  logBonus() { return Math.min(LOG_BONUS.max, this.s.stats.species * LOG_BONUS.perNewSpecies); }

  coolerValue() { return this.cooler.reduce((a, c) => a + c.value, 0); }
  sellAll() {
    const total = this.coolerValue();
    this.cooler = [];
    this.addCoins(total);
    this.save();
    return total;
  }

  recordCast() { this.s.stats.casts++; }
  recordEscape(kind) { if (kind === 'snap') this.s.stats.snaps++; else this.s.stats.escapes++; }
  recordPerfect() { this.s.stats.perfects++; }
  recordCombo(n) { this.s.stats.bestCombo = Math.max(this.s.stats.bestCombo, n); }
}
