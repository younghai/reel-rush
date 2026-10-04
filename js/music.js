// REEL RUSH — ambient music engine: fully synthesized WebAudio beds (zero assets)
// The always-on ambient layer that runs alongside the SFX engine (js/audio.js)
// without touching it. All sound is generated from oscillators + one shared
// looped white-noise buffer + biquad filters + a feedback delay. No imports,
// no files, no fetches.
//
// Usage:
//   import { music } from './music.js';
//   music.init(sfxCtx);        // optional: share the SFX engine's AudioContext
//   music.start();             // on first user gesture; safe to call repeatedly
//   // every frame (cheap — retunes layer gains at most every 200ms):
//   music.setDayNight(scene.nightAmount(t));  // 0 = full day, 1 = full night
//   music.setVolume(0.5); music.setMuted(true);
//
// Graph (built once per start(), torn down ~0.7s after stop()):
//   bus (volume * mute) -> soft compressor -> destination
//   DAY layer   (dayGain -> bus)
//     wave washes + sparse soft plucks (NO sustained pad — a v1 pad drone
//       read as an unwanted "웅" hum at game start, removed in v2)
//       triangle/sine oscs per tone + slow coherent detune drift
//       -> lowpass swept by a very slow LFO -> dayGain
//     wave wash: shared looped noise buffer -> lowpass -> ~5-6s swell
//       envelope -> dayGain, rescheduled every ~6-9s (randomized, very quiet)
//   NIGHT layer (nightGain -> bus)
//     sub drone: C2 + G2 sines with slow detune drift -> nightGain
//     shimmer: sparse C-major-pentatonic plucks every ~4-8s -> shimmerBus
//       -> nightGain (dry) + feedback delay -> nightGain (soft echoes)
//
// Safety contract (same as the SFX engine):
//   - Module load touches no browser APIs. Every public method is internally
//     guarded and never throws to the caller; nothing console-errors.
//   - Before a context exists everything is a no-op; with no WebAudio at all
//     start() simply stays inert (isPlaying() stays false).
//   - A suspended context only triggers silent resume() attempts
//     (p.catch(() => {})) — never an error.
//   - Stable node budget: persistent voices are built once per start and
//     stopped on teardown; every scheduled note self-cleans via onended;
//     noise is one shared looped buffer; the per-frame setDayNight only
//     retunes AudioParams — it never creates nodes.

const EPS = 0.0001;         // stand-in for 0 in envelope ramps
const VOL_DEFAULT = 0.5;    // music bus volume until setVolume() says otherwise
const XFADE_TC = 0.16;      // crossfade time constant -> ~0.5s layer glide
const BUS_TC = 0.08;        // volume/mute glide time constant
const K_APPLY_MIN = 0.2;    // min seconds between day/night recalcs (throttle)

const F = {                 // equal-temperament pitch table (Hz)
  C2: 65.41, G2: 98.0,
  C3: 130.81, G3: 196.0, E4: 329.63, D5: 587.33,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
};
const SHIMMER = [F.C6, F.D6, F.E6, F.G6, F.A6]; // high C-major pentatonic

const S = {
  ctx: null,          // AudioContext (shared via init, or self-created on start)
  g: null,            // live graph bundle from build(), or null
  playing: false,
  muted: false,
  vol: VOL_DEFAULT,
  k: 0,               // latest requested day/night amount (0 day .. 1 night)
  kAppliedAt: -1,     // ctx time of the last layer-gain retune
  kTimer: 0,          // trailing-edge throttle timer for setDayNight
  washTimer: 0,       // wave-wash scheduler timer
  pluckTimer: 0,      // day-pluck scheduler timer
  shimTimer: 0,       // shimmer-pluck scheduler timer
  stopTimer: 0,       // deferred teardown timer after stop()
};

/* --------------------------------------------------------- helpers ----- */

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Silent resume attempt; safe on running contexts (no-op) and on failure.
function safeResume(ctx) {
  try {
    if (ctx && ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) { /* ignore */ }
}

// Bus gain = volume * (muted ? 0 : 1), click-free via setTargetAtTime.
function applyBus() {
  try {
    const G = S.g;
    if (!G || !S.ctx) return;
    const t = S.ctx.currentTime;
    G.bus.gain.cancelScheduledValues(t);
    G.bus.gain.setTargetAtTime(S.muted ? 0 : S.vol, t, BUS_TC);
  } catch (e) { /* ignore */ }
}

// Retune both layer gains toward the current day/night amount.
// Only schedules param targets — creates no nodes. force skips the throttle.
function applyK(force) {
  try {
    const G = S.g;
    if (!G || !S.ctx) return;
    safeResume(S.ctx);
    const t = S.ctx.currentTime;
    if (!force && t - S.kAppliedAt < K_APPLY_MIN) return;
    S.kAppliedAt = t;
    const day = G.day.gain, night = G.night.gain;
    day.cancelScheduledValues(t);
    night.cancelScheduledValues(t);
    day.setTargetAtTime(Math.max(1 - S.k, EPS), t, XFADE_TC);
    night.setTargetAtTime(Math.max(S.k, EPS), t, XFADE_TC);
  } catch (e) { /* ignore */ }
}

/* ----------------------------------------------------- graph build ----- */

// Build the whole persistent graph for the current context. Returns a bundle
// (G) whose .oscs get stopped and whose .nodes get disconnected on teardown.
function build() {
  const ctx = S.ctx;
  const t = ctx.currentTime + 0.05;
  const G = { oscs: [], nodes: [] };
  const keep = (n) => { G.nodes.push(n); return n; };

  // One shared 2s mono white-noise buffer; every wash voice loops a slice.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  G.noise = buf;

  // Music bus -> gentle compressor -> destination (own chain, not the SFX one).
  G.bus = keep(ctx.createGain());
  G.bus.gain.value = S.muted ? 0 : S.vol;
  G.comp = keep(ctx.createDynamicsCompressor());
  G.comp.threshold.value = -20;
  G.comp.knee.value = 20;
  G.comp.ratio.value = 4;
  G.comp.attack.value = 0.01;
  G.comp.release.value = 0.3;
  G.bus.connect(G.comp);
  G.comp.connect(ctx.destination);

  // Layer gains (the crossfade targets).
  G.day = keep(ctx.createGain());
  G.night = keep(ctx.createGain());
  G.day.gain.value = Math.max(1 - S.k, EPS);
  G.night.gain.value = Math.max(S.k, EPS);
  G.day.connect(G.bus);
  G.night.connect(G.bus);

  // v2: no sustained pad/drone oscillators — continuous low tones read as an
  // unwanted hum at game start. Ambience is 100% event-based (washes + sparse
  // plucks), so between events the music is genuinely silent.

  /* -- NIGHT: feedback delay for the shimmer plucks -- */

  G.shim = keep(ctx.createGain()); // shimmer dry+wet send bus
  G.shim.connect(G.night);         // dry path
  G.delay = keep(ctx.createDelay(2));
  G.delay.delayTime.value = 0.42;
  G.delayFilter = keep(ctx.createBiquadFilter()); // tames each echo pass
  G.delayFilter.type = 'lowpass';
  G.delayFilter.frequency.value = 2400;
  G.delayFilter.Q.value = 0.6;
  G.fb = keep(ctx.createGain());
  G.fb.gain.value = 0.32;
  G.wet = keep(ctx.createGain());
  G.wet.gain.value = 0.75;
  G.shim.connect(G.delay);
  G.delay.connect(G.delayFilter);
  G.delayFilter.connect(G.fb);
  G.fb.connect(G.delay);           // feedback loop
  G.delayFilter.connect(G.wet);
  G.wet.connect(G.night);

  // Everything is wired — start the persistent voices once.
  for (const o of G.oscs) o.start(t);

  return G;
}

/* --------------------------------------------------- event voices ------ */

function scheduleWash(first) {
  try {
    if (!S.playing || S.washTimer) return;
    const ms = first ? 1200 + Math.random() * 1600 : 6000 + Math.random() * 3000;
    S.washTimer = setTimeout(washTick, ms);
  } catch (e) { /* ignore */ }
}

// One soft "wave wash": looped noise through a lowpass, ~5-6s swell, then a
// fully self-cleaning voice (stops itself; onended disconnects everything).
function washTick() {
  S.washTimer = 0;
  try {
    const G = S.g;
    if (!G || !S.playing) return;
    safeResume(S.ctx);
    if (S.k < 0.98) { // skip inaudible voices while the day layer is silent
      const ctx = S.ctx;
      const t = ctx.currentTime + 0.05;
      const src = ctx.createBufferSource();
      src.buffer = G.noise;
      src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = (S.k > 0.5 ? 300 : 480) + Math.random() * 420; // darker washes at night
      flt.Q.value = 0.5;
      const g = ctx.createGain();
      const peak = 0.035 + Math.random() * 0.025;
      const a = 2.2 + Math.random() * 1.1;
      const r = 2.4 + Math.random() * 1.2;
      g.gain.setValueAtTime(EPS, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + a + 0.4);
      g.gain.linearRampToValueAtTime(EPS, t + a + 0.4 + r);
      src.connect(flt);
      flt.connect(g);
      g.connect(G.day);
      src.start(t, Math.random() * 1.5); // random slice so washes differ
      src.stop(t + a + 0.4 + r + 0.1);
      src.onended = () => {
        try { src.disconnect(); flt.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
      };
    }
  } catch (e) { /* ignore */ }
  scheduleWash();
}

function schedulePluck(first) {
  try {
    if (!S.playing || S.pluckTimer) return;
    const ms = first ? 1800 + Math.random() * 2200 : 6000 + Math.random() * 6000;
    S.pluckTimer = setTimeout(pluckTick, ms);
  } catch (e) { /* ignore */ }
}

// One sparse soft marimba-ish day pluck (C-major pentatonic, mid register).
// Fully self-cleaning via onended; skipped while the day layer is silent.
function pluckTick() {
  S.pluckTimer = 0;
  try {
    const G = S.g;
    if (!G || !S.playing) return;
    safeResume(S.ctx);
    if (S.k < 0.98) {
      const ctx = S.ctx;
      const t = ctx.currentTime + 0.05;
      const DAY_PLUCK = [523.25, 587.33, 659.25, 783.99, 880.0];
      const f = DAY_PLUCK[(Math.random() * DAY_PLUCK.length) | 0];
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 1800;
      const g = ctx.createGain();
      const peak = 0.028 + Math.random() * 0.02;
      g.gain.setValueAtTime(EPS, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(EPS, t + 0.9 + Math.random() * 0.5);
      o.connect(flt); flt.connect(g); g.connect(G.day);
      o.start(t);
      o.stop(t + 1.5);
      o.onended = () => { try { o.disconnect(); flt.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
    }
  } catch (e) { /* ignore */ }
  schedulePluck();
}

function scheduleShimmer(first) {
  try {
    if (!S.playing || S.shimTimer) return;
    const ms = first ? 900 + Math.random() * 1400 : 4000 + Math.random() * 4000;
    S.shimTimer = setTimeout(shimmerTick, ms);
  } catch (e) { /* ignore */ }
}

// One sparse high shimmer pluck (occasionally answered by a soft octave-below
// echo), fed into the feedback delay. Fully self-cleaning via onended.
function shimmerTick() {
  S.shimTimer = 0;
  try {
    const G = S.g;
    if (!G || !S.playing) return;
    safeResume(S.ctx);
    if (S.k > 0.02) { // skip inaudible voices while the night layer is silent
      const ctx = S.ctx;
      const t = ctx.currentTime + 0.05;
      const f = SHIMMER[(Math.random() * SHIMMER.length) | 0];
      const pluck = (freq, at, peak, dec) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(EPS, at);
        g.gain.linearRampToValueAtTime(peak, at + 0.03);
        g.gain.exponentialRampToValueAtTime(EPS, at + 0.03 + dec);
        o.connect(g);
        g.connect(G.shim);
        o.start(at);
        o.stop(at + 0.03 + dec + 0.15);
        o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
      };
      pluck(f, t, 0.03 + Math.random() * 0.025, 1.3 + Math.random() * 1.2);
      if (Math.random() < 0.3) {
        pluck(f / 2, t + 0.22, 0.018, 1.6);
      }
    }
  } catch (e) { /* ignore */ }
  scheduleShimmer();
}

/* ------------------------------------------------------- lifecycle ----- */

function clearTimers() {
  try { if (S.washTimer) { clearTimeout(S.washTimer); S.washTimer = 0; } } catch (e) { /* ignore */ }
  try { if (S.shimTimer) { clearTimeout(S.shimTimer); S.shimTimer = 0; } } catch (e) { /* ignore */ }
  try { if (S.pluckTimer) { clearTimeout(S.pluckTimer); S.pluckTimer = 0; } } catch (e) { /* ignore */ }
  try { if (S.kTimer) { clearTimeout(S.kTimer); S.kTimer = 0; } } catch (e) { /* ignore */ }
}

// Stop persistent voices and disconnect the graph. Only touches the captured
// bundle, so a rebuild that already happened is never torn down by mistake.
function teardown(G) {
  try {
    for (const o of G.oscs) {
      try { o.stop(); } catch (e) { /* ignore */ }
      try { o.disconnect(); } catch (e) { /* ignore */ }
    }
    for (const n of G.nodes) {
      try { n.disconnect(); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  if (S.g === G) S.g = null;
}

export const music = {
  /**
   * Optionally adopt an external AudioContext (e.g. the SFX engine's) so both
   * layers share one clock. Idempotent: the first valid context wins; later
   * calls are ignored. Never throws.
   */
  init(ctx) {
    try {
      if (S.ctx) return;
      if (!ctx || typeof ctx.createGain !== 'function') return;
      S.ctx = ctx;
      safeResume(S.ctx);
    } catch (e) { /* ignore */ }
  },

  /**
   * Start the ambient loop (idempotent). Without a context it lazily creates
   * its own; if WebAudio is unavailable it stays an inert no-op. A suspended
   * context gets silent resume() attempts.
   */
  start() {
    try {
      if (!S.ctx) {
        const AC = (typeof AudioContext !== 'undefined' && AudioContext)
          || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
        if (!AC) return; // no WebAudio (tests, ancient browsers): stay inert
        try { S.ctx = new AC(); } catch (e) { S.ctx = null; return; }
      }
      if (typeof S.ctx.createGain !== 'function') return;
      safeResume(S.ctx);
      if (S.stopTimer) { // restarting mid-fade: keep the live graph
        clearTimeout(S.stopTimer);
        S.stopTimer = 0;
      }
      if (!S.g) {
        try {
          S.g = build();
        } catch (e) {
          S.g = null;
          return; // build failed: stay inert rather than half-play
        }
        scheduleWash(true);
        schedulePluck(true);
        scheduleShimmer(true);
      }
      S.playing = true;
      applyK(true);
      applyBus();
      if (!S.washTimer) scheduleWash();
      if (!S.pluckTimer) schedulePluck();
      if (!S.shimTimer) scheduleShimmer();
    } catch (e) { /* never throw */ }
  },

  /** Fade the bus out, stop scheduling, then tear the graph down. */
  stop() {
    try {
      if (!S.playing) return;
      S.playing = false;
      clearTimers();
      const G = S.g;
      if (G && S.ctx) {
        const t = S.ctx.currentTime;
        G.bus.gain.cancelScheduledValues(t);
        G.bus.gain.setTargetAtTime(0, t, 0.12); // ~0.4s fade-out
        S.stopTimer = setTimeout(() => {
          S.stopTimer = 0;
          teardown(G);
        }, 700);
      }
    } catch (e) { /* never throw */ }
  },

  /**
   * Day/night crossfade: k = 0 full day, 1 full night. Called every frame, so
   * it only stores the value and retunes the two layer gains at most every
   * 200ms (trailing-edge throttled) — never creates nodes or oscillators.
   */
  setDayNight(k) {
    try {
      const v = clamp01(Number(k) || 0);
      S.k = v;
      if (!S.playing || !S.g) return;
      const now = S.ctx ? S.ctx.currentTime : 0;
      if (now - S.kAppliedAt >= K_APPLY_MIN) {
        if (S.kTimer) { clearTimeout(S.kTimer); S.kTimer = 0; }
        applyK(true);
      } else if (!S.kTimer) {
        S.kTimer = setTimeout(() => {
          S.kTimer = 0;
          try { if (S.playing && S.g) applyK(true); } catch (e) { /* ignore */ }
        }, K_APPLY_MIN * 1000 + 30);
      }
    } catch (e) { /* never throw */ }
  },

  /** Music bus volume, 0..1, independent of the SFX engine. */
  setVolume(v) {
    try {
      S.vol = clamp01(Number(v) || 0);
      applyBus();
    } catch (e) { /* never throw */ }
  },

  getVolume() { return S.vol; },

  setMuted(m) {
    try {
      S.muted = !!m;
      applyBus();
    } catch (e) { /* never throw */ }
  },

  isMuted() { return S.muted; },

  /** True between start() and stop() (even while the context is suspended). */
  isPlaying() { return S.playing; },
};
