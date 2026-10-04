// REEL RUSH — audio engine: fully synthesized WebAudio SFX (zero assets)
// Every sound is built from oscillators + a shared white-noise buffer +
// biquad filters + exponential envelopes. No imports, no files, no fetches.
//
// Usage:
//   import { audio } from './audio.js';
//   // on the first user gesture (pointerdown/keydown/touchstart):
//   audio.unlock();
//   // then fire cues from game code; every call is a safe no-op until
//   // unlock() succeeds and never throws to the caller:
//   audio.cast(0.7); audio.splash(0.9); audio.catchSting('epic');
//
// Safety contract:
//   - The constructor touches no browser APIs. Only unlock() creates the
//     AudioContext (lazily, ideally inside a user-gesture handler), and it
//     is idempotent + internally try/catch'd.
//   - Master chain: masterGain(0.5) -> DynamicsCompressor -> destination.
//   - setMuted() ramps masterGain; while muted, scheduling is skipped so
//     muted gameplay costs zero voices.
//   - Voices stop themselves and disconnect via onended.

const EPS = 0.0001;        // stand-in for 0 in exponential ramps
const MASTER_LEVEL = 0.5;  // pre-compressor master gain
const NOTE = {             // equal-temperament pitch table (Hz)
  G4: 392.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
  B5: 987.77, C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0,
};

export class AudioEngine {
  constructor() {
    this._ctx = null;      // AudioContext — only ever created by unlock()
    this._master = null;   // master GainNode
    this._noise = null;    // shared 1s white-noise AudioBuffer
    this._muted = false;
    this._lastTick = -1;   // reelTick rate limiter (context time)
  }

  /* ------------------------------------------------------- lifecycle --- */

  /**
   * Create the AudioContext if needed and resume it. Call from any user
   * gesture. Idempotent; never throws (failure leaves the engine inert).
   */
  unlock() {
    try {
      if (this._ctx) {
        if (this._ctx.state !== 'running') {
          const p = this._ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        return;
      }

      const AC = (typeof AudioContext !== 'undefined' && AudioContext)
        || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
      if (!AC) return; // no WebAudio (tests, ancient browsers): stay inert

      const ctx = new AC();

      const master = ctx.createGain();
      master.gain.value = this._muted ? EPS : MASTER_LEVEL;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;

      master.connect(comp);
      comp.connect(ctx.destination);

      // One shared 1-second white-noise buffer for every noise voice.
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this._ctx = ctx;
      this._master = master;
      this._noise = buf;

      if (ctx.state !== 'running') { // may start 'suspended' without gesture
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) {
      this._ctx = null;
      this._master = null;
      this._noise = null;
    }
  }

  /** Ramp the master gain up/down. Never throws. */
  setMuted(m) {
    this._muted = !!m;
    try {
      if (!this._ctx || !this._master) return;
      const t = this._ctx.currentTime;
      const g = this._master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(g.value, EPS), t);
      g.exponentialRampToValueAtTime(this._muted ? EPS : MASTER_LEVEL, t + 0.06);
    } catch (e) { /* ignore */ }
  }

  isMuted() { return this._muted; }

  /** Per-frame hook. Reserved; intentionally a cheap no-op. */
  update(dt) { /* reserved */ }

  /* --------------------------------------------------- voice helpers --- */

  _ready() {
    return !!(this._ctx && this._master && this._noise) && !this._muted;
  }

  _t0() { return this._ctx.currentTime + 0.001; }

  // Clamped attack/decay pair -> { a, d, dur }.
  _ad(o) {
    const a = Math.max(o.attack != null ? o.attack : 0.005, 0.002);
    const d = Math.max(o.decay != null ? o.decay : 0.2, 0.01);
    return { a, d, dur: a + d };
  }

  // Percussive exponential A/D envelope on an AudioParam (0-guarded).
  _env(param, t0, peak, a, d) {
    param.setValueAtTime(EPS, t0);
    param.exponentialRampToValueAtTime(Math.max(peak, EPS), t0 + a);
    param.exponentialRampToValueAtTime(EPS, t0 + a + d);
  }

  // Biquad filter with optional exponential frequency sweep.
  _filter(f, t0, dur) {
    const node = this._ctx.createBiquadFilter();
    node.type = f.type || 'lowpass';
    node.Q.value = f.q != null ? f.q : 1;
    node.frequency.setValueAtTime(Math.max(f.freq != null ? f.freq : 1000, 10), t0);
    if (f.endFreq != null) {
      node.frequency.exponentialRampToValueAtTime(Math.max(f.endFreq, 10), t0 + dur);
    }
    return node;
  }

  // One oscillator voice: { at, type, freq, endFreq, attack, decay, gain,
  // filter:{type,freq,endFreq,q}, dest }. Self-cleans via onended.
  _tone(o) {
    try {
      const ctx = this._ctx;
      const t0 = o.at != null ? o.at : this._t0();
      const { a, d, dur } = this._ad(o);

      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(o.freq != null ? o.freq : 440, 1), t0);
      if (o.endFreq != null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(o.endFreq, 1), t0 + dur);
      }

      const g = ctx.createGain();
      this._env(g.gain, t0, o.gain != null ? o.gain : 0.25, a, d);

      let head = osc;
      if (o.filter) {
        const flt = this._filter(o.filter, t0, dur);
        osc.connect(flt); flt.connect(g); head = flt;
      } else {
        osc.connect(g);
      }
      g.connect(o.dest || this._master);

      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); if (head !== osc) head.disconnect(); } catch (e) { /* ignore */ }
      };
      return osc;
    } catch (e) { return null; }
  }

  // One looped-white-noise voice: { at, attack, decay, gain, rate,
  // filter:{...}, dest }. Self-cleans via onended.
  _noiseVoice(o) {
    try {
      const ctx = this._ctx;
      const t0 = o.at != null ? o.at : this._t0();
      const { a, d, dur } = this._ad(o);

      const src = ctx.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;
      if (o.rate) src.playbackRate.value = o.rate;

      const g = ctx.createGain();
      this._env(g.gain, t0, o.gain != null ? o.gain : 0.2, a, d);

      let head = src;
      if (o.filter) {
        const flt = this._filter(o.filter, t0, dur);
        src.connect(flt); flt.connect(g); head = flt;
      } else {
        src.connect(g);
      }
      g.connect(o.dest || this._master);

      src.start(t0, Math.random() * 0.5); // random slice so repeats differ
      src.stop(t0 + dur + 0.05);
      src.onended = () => {
        try { src.disconnect(); g.disconnect(); if (head !== src) head.disconnect(); } catch (e) { /* ignore */ }
      };
      return src;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------- SFX ------- */

  // Whoosh: bandpass noise sweep; stronger casts are louder, longer, higher.
  cast(power = 0.5) {
    if (!this._ready()) return;
    try {
      const p = Math.min(1, Math.max(0, power || 0));
      const dur = 0.22 + 0.38 * p;
      this._noiseVoice({
        attack: dur * 0.55, decay: dur * 0.45,
        gain: 0.1 + 0.22 * p,
        filter: { type: 'bandpass', freq: 220 + 180 * p, endFreq: 900 + 2600 * p, q: 0.9 },
      });
    } catch (e) { /* ignore */ }
  }

  // Splash: lowpass noise burst + HF spray + rising "blub" sine chirps.
  splash(intensity = 0.7) {
    if (!this._ready()) return;
    try {
      const i = Math.min(1, Math.max(0, intensity || 0));
      const t0 = this._t0();
      this._noiseVoice({
        at: t0, attack: 0.006, decay: 0.22 + 0.25 * i,
        gain: 0.18 + 0.3 * i,
        filter: { type: 'lowpass', freq: 700 + 1600 * i, q: 0.7 },
      });
      this._noiseVoice({
        at: t0 + 0.01, attack: 0.004, decay: 0.1 + 0.1 * i,
        gain: 0.06 + 0.1 * i,
        filter: { type: 'highpass', freq: 3000, q: 0.7 },
      });
      const blips = 3 + Math.round(i * 2);
      for (let k = 0; k < blips; k++) {
        const f = 350 + k * 120 + Math.random() * 220;
        this._tone({
          at: t0 + 0.05 + k * (0.055 + Math.random() * 0.03),
          type: 'sine', freq: f, endFreq: f * 2.2,
          attack: 0.004, decay: 0.07, gain: 0.06 + 0.03 * i,
        });
      }
    } catch (e) { /* ignore */ }
  }

  // "!" telegraph: 180Hz sine drop + click transient.
  bite() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._tone({ at: t0, type: 'sine', freq: 180, endFreq: 80, attack: 0.004, decay: 0.16, gain: 0.5 });
      this._tone({ at: t0 + 0.02, type: 'triangle', freq: 520, endFreq: 260, attack: 0.002, decay: 0.06, gain: 0.18 });
      this._noiseVoice({ at: t0, attack: 0.001, decay: 0.03, gain: 0.25, filter: { type: 'highpass', freq: 1800, q: 0.7 } });
    } catch (e) { /* ignore */ }
  }

  // Reel zing (fast rising saw sweep); perfect adds a C-major arpeggio stab.
  hookset(perfect = false) {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._tone({ at: t0, type: 'sawtooth', freq: 240, endFreq: 920, attack: 0.01, decay: 0.22, gain: 0.16 });
      this._tone({ at: t0, type: 'square', freq: 480, endFreq: 1840, attack: 0.01, decay: 0.14, gain: 0.05 });
      if (perfect) {
        [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, k) => {
          this._tone({ at: t0 + 0.02 + k * 0.055, type: 'triangle', freq: f, attack: 0.003, decay: 0.12, gain: 0.16 });
        });
      }
    } catch (e) { /* ignore */ }
  }

  // Mechanical ratchet click, rate-limited so per-frame callers stay cheap.
  reelTick(intensity = 0.5) {
    if (!this._ready()) return;
    try {
      const now = this._ctx.currentTime;
      if (now - this._lastTick < 0.028) return; // ratchet can't spin faster
      this._lastTick = now;
      const i = Math.min(1, Math.max(0, intensity || 0));
      this._noiseVoice({
        attack: 0.001, decay: 0.018 + 0.02 * i,
        gain: 0.045 + 0.095 * i,
        filter: { type: 'bandpass', freq: 2300 + 1900 * i, q: 2.2 },
      });
    } catch (e) { /* ignore */ }
  }

  // Tension red zone: two thin detuned saws a semitone apart + vibrato LFO.
  strain() {
    if (!this._ready()) return;
    try {
      const ctx = this._ctx;
      const t0 = this._t0();

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 21;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 40; // cents of detune wobble
      lfo.connect(lfoGain);
      lfo.start(t0);
      lfo.stop(t0 + 0.55);
      lfo.onended = () => { try { lfoGain.disconnect(); lfo.disconnect(); } catch (e) { /* ignore */ } };

      [1244.5, 1318.5].forEach((f, k) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        lfoGain.connect(osc.detune);
        const g = ctx.createGain();
        this._env(g.gain, t0 + k * 0.03, 0.055 - k * 0.015, 0.06, 0.42);
        osc.connect(g);
        g.connect(this._master);
        osc.start(t0);
        osc.stop(t0 + 0.55);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
      });
    } catch (e) { /* ignore */ }
  }

  // Line break: harsh HF noise crack + steep pitch drop.
  snap() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._noiseVoice({ at: t0, attack: 0.001, decay: 0.09, gain: 0.5, filter: { type: 'highpass', freq: 1200, q: 0.7 } });
      this._noiseVoice({ at: t0, attack: 0.001, decay: 0.04, gain: 0.35, filter: { type: 'bandpass', freq: 4000, q: 1.2 } });
      this._tone({ at: t0 + 0.01, type: 'sine', freq: 520, endFreq: 70, attack: 0.005, decay: 0.35, gain: 0.35 });
      this._tone({ at: t0 + 0.01, type: 'sawtooth', freq: 260, endFreq: 45, attack: 0.005, decay: 0.3, gain: 0.12 });
    } catch (e) { /* ignore */ }
  }

  // Fish escaped: sad descending two-tone womp (second tone bends down).
  escape() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._tone({ at: t0, type: 'triangle', freq: 330, endFreq: 294, attack: 0.015, decay: 0.22, gain: 0.22 });
      this._tone({ at: t0 + 0.24, type: 'triangle', freq: 247, endFreq: 185, attack: 0.015, decay: 0.4, gain: 0.22 });
      this._tone({ at: t0 + 0.24, type: 'sine', freq: 123, endFreq: 92, attack: 0.02, decay: 0.4, gain: 0.14 });
    } catch (e) { /* ignore */ }
  }

  // Catch fanfare, escalating by rarity:
  //   common    = single pluck
  //   uncommon  = 2-note rise
  //   rare      = 3-note major (C-E-G)
  //   epic      = 4-note octave jump + noise shimmer + high tinkle pair
  //   legendary = timpani thump + 5-note square/triangle fanfare + chord
  //   mythic    = sub drop + 7-note 2-octave arpeggio + chord + sparkle cascade
  catchSting(rarity = 'common') {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      const pluck = (f, at, gain, dur, type) => this._tone({
        at, type: type || 'triangle', freq: f, attack: 0.004, decay: dur || 0.3, gain: gain || 0.16,
      });

      switch ((rarity || 'common').toLowerCase()) {
        case 'uncommon':
          pluck(NOTE.C5, t0, 0.16, 0.25);
          pluck(NOTE.E5, t0 + 0.1, 0.18, 0.3);
          break;

        case 'rare':
          [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, k) => pluck(f, t0 + k * 0.1, 0.18, 0.3));
          break;

        case 'epic':
          [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, k) => pluck(f, t0 + k * 0.09, 0.18, 0.32));
          this._noiseVoice({ at: t0 + 0.28, attack: 0.02, decay: 0.5, gain: 0.06, filter: { type: 'highpass', freq: 6000, q: 0.7 } });
          pluck(NOTE.E6, t0 + 0.36, 0.08, 0.4, 'sine');
          pluck(NOTE.G6, t0 + 0.42, 0.06, 0.45, 'sine');
          break;

        case 'legendary': {
          // timpani-ish thump: pitch-dropping sine + low noise thud
          this._tone({ at: t0, type: 'sine', freq: 100, endFreq: 42, attack: 0.004, decay: 0.5, gain: 0.45 });
          this._noiseVoice({ at: t0, attack: 0.002, decay: 0.08, gain: 0.18, filter: { type: 'lowpass', freq: 300, q: 0.8 } });
          [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, k) => {
            const at = t0 + 0.06 + k * 0.11;
            this._tone({ at, type: 'square', freq: f, attack: 0.004, decay: 0.32, gain: 0.08, filter: { type: 'lowpass', freq: 3800, q: 0.8 } });
            this._tone({ at, type: 'triangle', freq: f, attack: 0.004, decay: 0.4, gain: 0.12 });
          });
          [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => pluck(f, t0 + 0.66, 0.1, 0.8));
          break;
        }

        case 'mythic': {
          // sub drop under the whole sting
          this._tone({ at: t0, type: 'sine', freq: 72, endFreq: 30, attack: 0.01, decay: 0.9, gain: 0.4 });
          // full arpeggio up two octaves
          [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, k) => {
            const at = t0 + 0.05 + k * 0.07;
            this._tone({ at, type: 'square', freq: f, attack: 0.003, decay: 0.18, gain: 0.09, filter: { type: 'lowpass', freq: 4200, q: 0.8 } });
            this._tone({ at, type: 'triangle', freq: f, attack: 0.003, decay: 0.25, gain: 0.1 });
          });
          // closing chord
          [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) => pluck(f, t0 + 0.56, 0.09, 0.9));
          // sparkle cascade: descending-gain random high chirps
          for (let k = 0; k < 9; k++) {
            const f = 1400 + Math.random() * 1900;
            this._tone({
              at: t0 + 0.6 + k * 0.09 + Math.random() * 0.03,
              type: 'sine', freq: f, endFreq: f * 1.5,
              attack: 0.003, decay: 0.18, gain: 0.05 * (1 - k / 12),
            });
          }
          break;
        }

        case 'common':
        default:
          pluck(NOTE.C5, t0, 0.2, 0.3);
          break;
      }
    } catch (e) { /* ignore */ }
  }

  // Extra hit for legendary+: sub-bass drop + long shimmer wash + slow rise.
  bigCatch() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._tone({ at: t0, type: 'sine', freq: 90, endFreq: 28, attack: 0.01, decay: 0.9, gain: 0.5 });
      this._noiseVoice({ at: t0 + 0.05, attack: 0.25, decay: 1.4, gain: 0.1, filter: { type: 'highpass', freq: 5200, q: 0.7 } });
      this._tone({ at: t0 + 0.1, type: 'sine', freq: NOTE.C6, endFreq: NOTE.C7, attack: 0.4, decay: 0.8, gain: 0.05 });
    } catch (e) { /* ignore */ }
  }

  // Coin in a burst: bright square blip rising one semitone per coin (capped).
  coin(i = 0) {
    if (!this._ready()) return;
    try {
      const k = Math.max(0, i | 0);
      const base = 880 * Math.pow(1.059463, Math.min(k, 12));
      this._tone({ type: 'square', freq: base, endFreq: base * 1.5, attack: 0.002, decay: 0.11, gain: 0.1, filter: { type: 'lowpass', freq: 6000, q: 0.7 } });
      this._tone({ type: 'sine', freq: base * 2, endFreq: base * 3, attack: 0.002, decay: 0.09, gain: 0.05 });
    } catch (e) { /* ignore */ }
  }

  // Purchase: cash-register double click + bright ding.
  buy() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._noiseVoice({ at: t0, attack: 0.001, decay: 0.02, gain: 0.2, filter: { type: 'bandpass', freq: 3200, q: 1.5 } });
      this._noiseVoice({ at: t0 + 0.07, attack: 0.001, decay: 0.02, gain: 0.16, filter: { type: 'bandpass', freq: 2600, q: 1.5 } });
      this._tone({ at: t0 + 0.1, type: 'sine', freq: 1318.51, attack: 0.002, decay: 0.5, gain: 0.2 });
      this._tone({ at: t0 + 0.1, type: 'sine', freq: 1975.53, attack: 0.002, decay: 0.35, gain: 0.08 });
    } catch (e) { /* ignore */ }
  }

  // Not enough money: low double-buzz (beating square pair, twice).
  deny() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      const buzz = (at) => {
        this._tone({ at, type: 'square', freq: 110, attack: 0.004, decay: 0.1, gain: 0.14, filter: { type: 'lowpass', freq: 900, q: 0.7 } });
        this._tone({ at, type: 'square', freq: 116, attack: 0.004, decay: 0.1, gain: 0.08, filter: { type: 'lowpass', freq: 900, q: 0.7 } });
      };
      buzz(t0);
      buzz(t0 + 0.16);
    } catch (e) { /* ignore */ }
  }

  // Soft UI click: tiny downward triangle blip.
  ui() {
    if (!this._ready()) return;
    try {
      this._tone({ type: 'triangle', freq: 1400, endFreq: 1000, attack: 0.001, decay: 0.045, gain: 0.06 });
    } catch (e) { /* ignore */ }
  }

  // Rod flex twang: quick pitch-dip pair + faint creak of noise.
  castStart() {
    if (!this._ready()) return;
    try {
      const t0 = this._t0();
      this._tone({ at: t0, type: 'triangle', freq: 300, endFreq: 170, attack: 0.003, decay: 0.14, gain: 0.2 });
      this._tone({ at: t0, type: 'sine', freq: 620, endFreq: 340, attack: 0.002, decay: 0.08, gain: 0.07 });
      this._noiseVoice({ at: t0, attack: 0.002, decay: 0.05, gain: 0.05, filter: { type: 'bandpass', freq: 1800, q: 1.2 } });
    } catch (e) { /* ignore */ }
  }
}

export const audio = new AudioEngine();
