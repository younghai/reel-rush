// REEL RUSH — fishing state machine: cast -> wait -> strike -> fight -> reveal
// Owns minigame logic + juice/audio triggers. Rendering lives in scenes.js.

import { FIGHT, CAST, COMBO, DEPTH_BANDS, RARITIES, WATER_Y } from './config.js';
import { t, fishName } from './i18n.js';
import { rollWeight, calcValue } from './economy.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// Time-of-day activity multiplier (Tidewater Bites.activity): dawn/dusk are
// gaussian peaks on a 0..30h cycle (day 6..18, night 18..30 ≡ 6). Returns ~0.15..1.
// 'dawnDusk' species peak at the golden-hour transitions but stay reachable all day.
export function activity(pref, hour) {
  const dawn = Math.exp(-((hour - 6.5) ** 2) / 2.5), dusk = Math.exp(-((hour - 18.5) ** 2) / 2.5);
  const night = hour < 5.5 || hour > 19.5 ? 1 : 0;
  const day = hour > 7 && hour < 18 ? 1 : 0.35;
  switch (pref) {
    case 'day': return 0.25 + 0.75 * day * (1 - night);
    case 'dawnDusk': return 0.3 + 0.7 * Math.max(dawn, dusk) + 0.1 * day;
    case 'night': return 0.15 + 0.85 * Math.max(night, dusk * 0.8);
    default: return 0.8 + 0.2 * Math.max(dawn, dusk);
  }
}

// Smoothstep habitat affinity for a species' preferred cast-depth band (0..1 power).
// Inside the band: 1; outside: fades over 0.3 of band width.
function inBandCheck(tension, F) { return tension >= F.greenLow && tension <= F.greenHigh; }

function depthAffinity(depth, p) {
  const [lo, hi] = depth;
  const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
  if (p >= lo && p <= hi) return 1;
  if (p < lo) return 1 - ss(lo - 0.3, lo, p);
  return 1 - ss(hi, hi + 0.3, p);
}

export class FishingGame {
  constructor({ juice, audio, economy, fishes, onEvent }) {
    this.juice = juice; this.audio = audio; this.economy = economy;
    this.fishes = fishes; this.onEvent = onEvent || (() => {});
    this.state = 'idle'; // idle|casting|flying|bobbing|strike|fight|reveal
    this.combo = 0; this.comboT = 0;
    this.t = 0;
    this.bobber = { x: 0, y: 0, vx: 0, vy: 0, inWater: false, depth: 0 };
    this.#resetCast();
    this.#resetFight();
    this.holdReeling = false;
    this.debugBite = false;
  }

  #resetCast() {
    this.cast = { power: 0, t: 0, dir: 1, locked: 0 };
  }
  #resetFight() {
    this.fight = {
      tension: 30, progress: 0, strain: 0, escapeT: 0,
      surgeT: rnd(0.6, 1.4), surging: false, surge: 0, // surge: smoothed 0..1 (inertia)
      stamina: 0, staminaMax: 1, phase: 1, reelTick: 0, slack: 0,
    };
  }

  // ---------- input (called from main) ----------
  press() {
    switch (this.state) {
      case 'idle': this.#beginCast(); break;
      case 'casting': this.#lockPower(); break;
      case 'bobbing': this.#cancelCast('reelin'); break;
      case 'strike': this.#hookAttempt(false); break;
      case 'fight': this.holdReeling = true; break;
      case 'reveal': this.#endReveal(); break;
    }
  }
  release() { this.holdReeling = false; }

  #beginCast() {
    this.state = 'casting';
    this.cast = { power: 0, t: 0, dir: 1, locked: 0 };
    this.audio.castStart();
  }
  #lockPower() {
    this.cast.locked = clamp(this.cast.power, 0.05, 1);
    this.state = 'flying';
    this.audio.cast(this.cast.locked);
    // ballistic lob from rod tip to landing point
    const zone = this.economy.zone;
    const dist = CAST.minDist + (CAST.maxDist - CAST.minDist) * this.cast.locked;
    this.bobber.x = 260; this.bobber.y = 300;
    this.bobber.targetX = 260 + dist;
    const flight = 0.55 + 0.45 * this.cast.locked;
    this.bobber.vx = (this.bobber.targetX - this.bobber.x) / flight;
    this.bobber.vy = -420 - 180 * this.cast.locked;
    this.bobber.g = 900 + 500 * this.cast.locked;
    this.bobber.inWater = false;
    this.economy.recordCast();
  }

  // ---------- fish selection ----------
  // zoneId, hour (0..30, dawn/dusk live at the 6/18 edges), castPower 0..1
  pickFish(zoneId, hour, castPower) {
    const band = DEPTH_BANDS.find(b => castPower >= b.from && (castPower <= b.to || b === DEPTH_BANDS[DEPTH_BANDS.length - 1])) ?? DEPTH_BANDS[0];
    const baitLvl = this.economy.upgrades.bait;
    const pool = [];
    for (const f of this.fishes) {
      if (f.zone !== zoneId) continue;
      let w = RARITIES[f.rarity].weight
        * activity(f.time, hour)                       // gaussian day/dawnDusk/night activity
        * depthAffinity(f.depth ?? [0, 1], castPower); // smoothstep habitat band
      if (RARITIES[f.rarity].order >= 2) w *= band.rareBias;   // deep casts favor rare+
      if (RARITIES[f.rarity].order >= 2) w *= 1 + baitLvl * 0.15;
      pool.push({ f, w });
    }
    if (!pool.length) return null;
    let total = pool.reduce((a, p) => a + p.w, 0);
    let r = Math.random() * total;
    for (const p of pool) { r -= p.w; if (r <= 0) return p.f; }
    return pool[pool.length - 1].f;
  }

  #beginWait(castPower) {
    const hour = this._hour ?? 12;
    this.fish = this.pickFish(this.economy.zone, hour, castPower);
    if (!this.fish) { this.#cancelCast('nofish'); return; }
    this.fishWeight = rollWeight(this.fish);
    // roll a consistent length from the same skew (heavy fish are long fish)
    const sk = Math.pow(clamp((this.fishWeight - this.fish.weight[0]) / ((this.fish.weight[1] - this.fish.weight[0]) || 1), 0, 1), 1 / 1.7);
    this.fishCm = +(this.fish.len[0] + (this.fish.len[1] - this.fish.len[0]) * sk).toFixed(1);
    // exponential bite delay (Tidewater biteDelay): richer water bites sooner, 1.6s floor
    const baitLvl = this.economy.upgrades.bait;
    const rich = 0.45 + activity(this.fish.time, hour) + baitLvl * 0.18;
    const mean = 3.0 / Math.min(rich, 1.8);
    let wait = 2 + -Math.log(1 - Math.random() * 0.98) * mean * 0.55;
    if (RARITIES[this.fish.rarity].order >= 3) wait *= 0.8; // big fish commit faster
    this.biteT = clamp(wait, 1.6, 9);
    this.bobbedT = 0;
    this.state = 'bobbing';
  }

  #beginStrike() {
    this.state = 'strike';
    const rodLvl = this.economy.upgrades.rod;
    const win = clamp(FIGHT.windowBase - this.fish.speed * 0.0022 - rodLvl * 0.03, FIGHT.windowMin, FIGHT.windowBase);
    this.strike = { t: 0, window: win, perfectFrac: FIGHT.perfectFrac, done: false };
    this.audio.bite();
    this.juice.shake(7, 0.25);
    this.juice.ring(this.bobber.x, this.bobber.y, { r0: 4, r1: 46, color: 'rgba(255,220,120,0.95)', width: 4, life: 0.5 });
  }

  #hookAttempt(isAuto) {
    if (this.state !== 'strike') return;
    const s = this.strike;
    if (s.done) return;
    s.done = true;
    const perfect = !isAuto && (s.t / s.window) <= s.perfectFrac;
    this.#beginFight(perfect);
  }

  #beginFight(perfect) {
    const f = this.fish;
    this.state = 'fight';
    this.lastPerfect = perfect;
    this.#resetFight();
    // trophy scaling: bigger individuals of a species fight noticeably longer
    this.fight.staminaMax = f.stamina * Math.pow(clamp(this.fishWeight / f.weight[1], 0.15, 1), FIGHT.trophyPow);
    this.fight.stamina = this.fight.staminaMax;
    if (perfect) {
      this.fight.progress = FIGHT.perfectSeed;
      this.fight.tension = FIGHT.perfectTension;
      this.economy.recordPerfect();
      this.audio.hookset(true);
      this.juice.hitstop(90);
      this.juice.flash('#ffffff', 0.35, 120);
      this.juice.shake(10, 0.3);
      this.juice.pulse(0.6);
      this.juice.burst(this.bobber.x, this.bobber.y, { count: 26, speed: 300, color: ['#ffe98a', '#ffd54a', '#fff'], glow: true, size: 4 });
      this.juice.floatText(this.bobber.x, this.bobber.y - 50, t('fight.perfect'), { color: '#ffd54a', size: 40 });
    } else {
      this.audio.hookset(false);
      this.juice.shake(6, 0.22);
      this.juice.burst(this.bobber.x, this.bobber.y, { count: 12, speed: 200, color: ['#bfe8ff', '#8fd4e8'] });
    }
    this.juice.ring(this.bobber.x, this.bobber.y, { r1: 90, width: 5 });
    this.onEvent('fightstart', { fish: f, perfect });
  }

  // ---------- fight update ----------
  #updateFight(dt) {
    const F = FIGHT, st = this.fight, fish = this.fish;
    const up = this.economy.upgrades;
    const reeling = this.holdReeling;

    const tired = clamp(1 - st.stamina / st.staminaMax, 0, 1); // 0 fresh .. 1 spent

    // fish surge scheduling (pattern-driven; Tidewater: rarer and weaker as the fish tires)
    st.surgeT -= dt;
    if (st.surgeT <= 0) {
      st.surging = !st.surging;
      if (st.surging) {
        const dur = { steady: rnd(0.5, 0.9), darting: rnd(0.25, 0.5), diver: rnd(0.6, 1.0), runner: rnd(0.8, 1.4), thrasher: rnd(0.3, 0.7) }[fish.pattern] ?? 0.6;
        st.surgeT = dur;
        this.juice.shake(2 + fish.strength * 0.12, 0.2);
      } else {
        const rest = { steady: rnd(0.7, 1.2), darting: rnd(0.25, 0.55), diver: rnd(0.9, 1.5), runner: rnd(0.5, 0.9), thrasher: rnd(0.2, 0.45) }[fish.pattern] ?? 0.7;
        st.surgeT = rest * (1 + tired * 0.9); // tired fish rests longer between runs
      }
    }
    st.surge += ((st.surging ? 1 : 0) - st.surge) * (1 - Math.exp(-dt * 6)); // smoothed surge

    // stamina: drains while the fish fights anywhere — 1x in the band, 0.3x outside.
    // In-band pressure tires it 3.3x faster: the band is where the fight is won.
    st.stamina -= dt / st.staminaMax * st.staminaMax * (inBandCheck(st.tension, F) ? F.bandDrain : F.offBandDrain) * (0.55 + up.reel * 0.12);

    const exhausted = st.stamina <= 0;
    // continuous tiring (replaces the old binary exhausted flip)
    const effStrength = fish.strength * (1 - 0.65 * tired) * (st.phase === 2 ? 1.15 : 1); // phase 2: bosses genuinely enrage

    // tension inertia (Tidewater): tension chases a target exponentially —
    // reeling pushes it up (fish pull + surge), releasing lets it fall toward the pull.
    const pull = effStrength * (0.35 + 0.65 * st.surge);
    const target = reeling ? F.reelBase + pull * F.pullScale : pull * F.freeScale;
    const rate = reeling ? F.rateReel : F.rateFree;
    st.tension += (target - st.tension) * (1 - Math.exp(-dt * rate));
    st.tension = clamp(st.tension, 0, F.hardMax);

    const inGreen = st.tension >= F.greenLow && st.tension <= F.greenHigh;
    const inRed = st.tension > F.greenHigh;

    // progress
    if (inGreen) {
      st.progress += F.progressRate * (1 + up.rod * 0.22) * (exhausted ? F.progressStaminaBonus : 1) * dt;
      st.escapeT = 0;
    } else if (st.tension < F.greenLow) {
      st.progress = Math.max(0, st.progress - F.progressDecayLow * dt);
      st.escapeT += dt;
    }
    if (inRed) {
      st.progress = Math.max(0, st.progress - F.progressDecayRed * dt);
      st.strain += dt;
      st.strainSfx = (st.strainSfx ?? 0) - dt;
      if (st.strainSfx <= 0) { this.audio.strain(); st.strainSfx = 0.16; }
      this.juice.shake(3, 0.1);
      if (this.t % 0.25 < dt) this.juice.flash('#ff5d5d', 0.12, 90);
    } else {
      st.strain = Math.max(0, st.strain - dt * 1.6);
    }

    // reel click sfx by tension/progress rhythm
    if (reeling && !inRed) {
      st.reelTick = (st.reelTick ?? 0) - dt;
      if (st.reelTick <= 0) { this.audio.reelTick(inGreen ? 0.5 : 0.25); st.reelTick = 0.09 - (inGreen ? 0.02 : 0); }
    }

    // snap: sustained red zone (overload)
    const strainLimit = F.strainBase + up.line * 0.45;
    if (st.strain >= strainLimit) { this.#fail('snap'); return; }
    // slack: released too long and the hook slips out (the missing counter-pressure)
    st.slack = st.tension < F.slackLow ? st.slack + dt : Math.max(0, st.slack - dt * 2);
    if (st.slack >= F.slackLimit) { this.#fail('slack'); return; }
    // backstop: no progress for a long stretch
    if (st.escapeT >= F.escapeSeconds) { this.#fail('escape'); return; }

    // phase 2 for bosses at half stamina
    if (fish.boss && st.phase === 1 && st.stamina <= fish.stamina * 0.5) {
      st.phase = 2;
      this.juice.flash('#ff5d9e', 0.3, 200);
      this.juice.shake(14, 0.5);
      this.juice.pulse(1);
      this.juice.floatText(this.bobber.x, this.bobber.y - 70, t('fight.enrage', { name: fishName(fish) }), { color: '#ff5d9e', size: 34 });
      this.audio.bigCatch();
    }

    // caught!
    if (st.progress >= 100) { this.#catch(); return; }

    // per-frame fight FX: line strain particles at high tension
    if (st.tension > F.greenHigh - 8 && Math.random() < dt * 18) {
      this.juice.burst(this.bobber.x, this.bobber.y, { count: 2, speed: 90, color: '#cfe3ee', size: 2, grav: 200, life: 0.4 });
    }
  }

  #fail(kind) {
    this.state = 'idle';
    this.economy.recordEscape(kind);
    this.combo = 0; this.comboT = 0;
    this.onEvent('onCombo', { combo: 0 });
    if (kind === 'snap') {
      this.audio.snap();
      this.juice.hitstop(70);
      this.juice.shake(16, 0.4);
      this.juice.flash('#ff5d5d', 0.25, 150);
      this.juice.floatText(this.bobber.x, this.bobber.y - 40, t('fight.snap'), { color: '#ff5d5d', size: 34 });
      this.juice.burst(this.bobber.x, this.bobber.y, { count: 14, speed: 260, color: ['#e8f2f8', '#c0d8e8'] });
    } else {
      this.audio.escape();
      this.juice.shake(6, 0.3);
      this.juice.floatText(this.bobber.x, this.bobber.y - 40, t('fight.miss'), { color: '#9fbccd', size: 30 });
    }
    this.onEvent('fail', { kind, fishId: this.fish?.id });
    this.fish = null;
  }

  #catch() {
    const fish = this.fish, st = this.fight;
    this.comboT = COMBO.windowSec;
    this.combo++;
    this.economy.recordCombo(this.combo);
    const comboMult = this.economy.comboMult(this.combo);
    const perfect = this.lastPerfect;
    const value = calcValue(fish, this.fishWeight, { comboMult, perfect, logBonus: this.economy.logBonus() });
    const { isNew } = this.economy.addCatch(fish, this.fishWeight, value, this.fishCm);

    const R = RARITIES[fish.rarity];
    // ---- 타격감: hitstop scales with rarity ----
    this.juice.hitstop(R.hitstop);
    this.juice.shake(R.shake, 0.5);
    this.juice.pulse(R.order / 4);
    if (R.order >= 2) {
      this.juice.slowmo(R.order >= 4 ? 0.18 : 0.35, 420);
      this.juice.flash(R.color, R.order >= 4 ? 0.5 : 0.3, 220);
    }
    this.juice.burst(this.bobber.x, this.bobber.y, {
      count: 20 + R.order * 10, speed: 200 + R.order * 60, up: 160,
      color: ['#bfe8ff', '#e8f7ff', R.color], glow: R.order >= 2, size: 5,
    });
    this.juice.ring(this.bobber.x, this.bobber.y, { r1: 120, width: 6, color: R.color });
    if (R.order >= 3) this.juice.confetti(this.bobber.x, this.bobber.y - 30, 40 + R.order * 20);

    this.audio.catchSting(fish.rarity);
    if (R.order >= 4) this.audio.bigCatch();

    this.juice.floatText(this.bobber.x, this.bobber.y - 46, `+${value.toLocaleString()}`, { color: '#ffd54a', size: 34 });
    // cm floater under the value (trophy sizes stand out)
    if (this.fishCm) this.juice.floatText(this.bobber.x, this.bobber.y - 4, `${this.fishCm}cm`, { color: '#bfe8ff', size: 20 });
    if (this.combo > 1) this.juice.floatText(this.bobber.x, this.bobber.y - 92, `COMBO x${this.combo}`, { color: '#ff9c40', size: 26 });
    if (isNew) this.juice.floatText(640, 566, t('fight.newSpecies'), { color: '#59d97e', size: 40 });

    this.reveal = { fish, weight: this.fishWeight, cm: this.fishCm, value, perfect, combo: this.combo, isNew, t: 0 };
    this.state = 'reveal';
    this.onEvent('catch', { fish, weight: this.fishWeight, cm: this.fishCm, value, perfect, combo: this.combo, isNew });
    this.fish = null;
  }

  #endReveal() {
    this.state = 'idle';
    this.reveal = null;
    this.onEvent('revealEnd', {});
  }

  #cancelCast(reason) {
    this.state = 'idle';
    this.fish = null;
    if (reason === 'reelin') {
      this.juice.ring(this.bobber.x, this.bobber.y, { r1: 30, width: 2, color: 'rgba(200,230,250,0.6)' });
      this.audio.ui();
    }
    this.onEvent('cancel', { reason });
  }

  // ---------- main update ----------
  update(dt) {
    this.t += dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) { this.combo = 0; this.onEvent('onCombo', { combo: 0 }); }
    }
    const b = this.bobber;
    switch (this.state) {
      case 'casting':
        this.cast.t += dt;
        const ph = (this.cast.t % CAST.cycleTime) / CAST.cycleTime;
        this.cast.power = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        break;
      case 'flying':
        b.vy += b.g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= WATER_Y && b.vy > 0) { // water surface
          b.y = WATER_Y;
          const intensity = clamp(b.vy / 900, 0.2, 1);
          this.audio.splash(intensity);
          this.juice.burst(b.x, b.y, { count: 10 + intensity * 12, speed: 120 + intensity * 160, up: 120, color: ['#bfe8ff', '#e8f7ff', '#8fd4e8'], size: 4 });
          this.juice.ring(b.x, b.y, { r1: 40 + intensity * 40 });
          this.juice.shake(2 + intensity * 3, 0.15);
          b.inWater = true;
          this.#beginWait(this.cast.locked);
        }
        break;
      case 'bobbing':
        this.bobbedT += dt;
        b.y = WATER_Y + Math.sin(this.t * 2.2) * 2.5;
        if (this.debugBite || this.bobbedT >= this.biteT) { this.debugBite = false; this.#beginStrike(); }
        break;
      case 'strike': {
        this.strike.t += dt;
        if (this.strike.t >= this.strike.window) { this.#fail('miss'); }
        break;
      }
      case 'fight':
        this.#updateFight(dt);
        if (this.state === 'fight') {
          // fish visual darts around bobber
          b.y = WATER_Y + Math.sin(this.t * 3) * 3 + (this.fight.surging ? 4 : 0);
        }
        break;
      case 'reveal':
        this.reveal.t += dt;
        if (this.reveal.t > 2.6) this.#endReveal();
        break;
    }
  }

  // set by main each frame before update
  isNight() { return this._night ?? false; }
}
