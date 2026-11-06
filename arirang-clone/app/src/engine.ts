// Shared marble-on-keys engine: deterministic simulation + draw orchestration.
// A world is built once from onset timings; every frame is a pure function of time.

export const FPS = 30;
export const G = 2100;
export const W = 720;
export const H = 1280;

export interface Vec {
  x: number;
  y: number;
}

export interface Target {
  t: number; // hit time (s)
  x: number;
  y: number; // world hit point
  ang: number; // tilt (rad)
  col: number; // palette index
  s: number; // onset strength
  size: number; // scale
}

export interface Arc {
  t0: number;
  t1: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
}

export interface Decor {
  type: string;
  x: number;
  y: number; // attach/anchor point
  scale: number;
  side: number; // -1 left, 1 right
  phase: number;
  seed: number;
}

export interface Intro {
  from: Vec;
  t0: number;
  t1: number; // free fall from `from` to first target between t0..t1
}

export interface Finale {
  mouth: Vec; // where the ball enters
  rest: Vec; // where the ball comes to rest
  shelfY: number;
  camY: number; // camera y when settled
  data: Record<string, number>;
}

export interface World {
  targets: Target[];
  extras: Target[]; // decorative, never lit
  decors: Decor[];
  arcs: Arc[];
  intro: Intro;
  entryT: number;
  ripples: number[];
  chimes: number[];
  finale: Finale;
  cam: Float32Array;
  durF: number;
  seedBase: number;
}

export interface ThemeConfig {
  seed: number;
  onsets: { t: number; s: number }[];
  hitsFrom: number;
  hitsTo: number; // last hit must be < hitsTo
  mergeGap: number;
  entryT: number;
  firstPos: Vec;
  introFrom: Vec;
  introT0: number;
  xMin: number;
  xMax: number;
  stepMin: number;
  stepMax: number;
  dropK: [number, number];
  dropMax: number;
  ornStep: [number, number];
  ornTop: number;
  ornBottomPad: number;
  ornTypes: string[];
  mouthOffset: Vec; // finale mouth relative to last hit
  restDrop: number; // rest point below mouth (inside vessel)
  finaleDrop: number; // vessel base / shelf below mouth
  camSettle: number; // shelfY - camY
  ripples: number[];
  dur: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const smoothstep = (u: number) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

export function buildWorld(cfg: ThemeConfig): World {
  const rng = mulberry32(cfg.seed);

  // ---- merge onsets into note hits ----
  const notes: { t: number; s: number }[] = [];
  for (const o of cfg.onsets) {
    if (o.t < cfg.hitsFrom || o.t > cfg.hitsTo) continue;
    const last = notes[notes.length - 1];
    if (last && o.t - last.t < cfg.mergeGap) {
      last.s = Math.max(last.s, o.s);
      continue;
    }
    notes.push({ t: o.t, s: o.s });
  }

  // ---- lay out targets along a descending serpentine ----
  const targets: Target[] = [];
  let x = cfg.firstPos.x;
  let y = cfg.firstPos.y;
  let dir = rng() > 0.5 ? 1 : -1;
  let sinceFlip = 0;
  let col = 1; // force second palette color first (blue for arirang)
  let lastCol = -1;
  let sameCount = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const dt = i === 0 ? 0.3 : n.t - notes[i - 1].t;
    if (i > 0) {
      sinceFlip++;
      if (x < cfg.xMin + 40 && dir < 0) dir = 1;
      if (x > cfg.xMax - 40 && dir > 0) dir = -1;
      if (sinceFlip > 3 && rng() < 0.28) dir = -dir;
      if (dir > 0 && x > cfg.xMax - 60) dir = -1;
      if (dir < 0 && x < cfg.xMin + 60) dir = 1;
      const step = lerp(cfg.stepMin, cfg.stepMax, rng()) * dir;
      x = clamp(x + step, cfg.xMin, cfg.xMax);
      const f = lerp(cfg.dropK[0], cfg.dropK[1], rng());
      const dy = clamp(0.5 * G * dt * dt * f, 6, cfg.dropMax);
      y += dy;
    }
    // color with no 3-in-a-row repeats
    if (i === 0) col = 1;
    else {
      do {
        col = Math.floor(rng() * 5);
      } while (col === lastCol && sameCount >= 1);
      sameCount = col === lastCol ? sameCount + 1 : 0;
    }
    lastCol = col;
    // key angle: perpendicular-ish to incoming velocity
    const vyEnd = i === 0 ? 600 : 0.5 * G * dt;
    const ang = Math.atan2(vyEnd, 1) * 0.35 + (rng() - 0.5) * 0.5;
    targets.push({
      t: n.t,
      x,
      y,
      ang: clamp(ang, -0.85, 0.85),
      col,
      s: n.s,
      size: 0.85 + rng() * 0.4,
    });
  }

  // ---- arcs between hits (parabolic, fixed gravity) ----
  const arcs: Arc[] = [];
  for (let i = 1; i < targets.length; i++) {
    const a = targets[i - 1];
    const b = targets[i];
    const dt = b.t - a.t;
    arcs.push({
      t0: a.t,
      t1: b.t,
      x0: a.x,
      y0: a.y,
      vx: (b.x - a.x) / dt,
      vy: (b.y - a.y - 0.5 * G * dt * dt) / dt,
    });
  }

  // ---- finale geometry ----
  const last = targets[targets.length - 1];
  const mouth: Vec = { x: last.x + cfg.mouthOffset.x, y: last.y + cfg.mouthOffset.y };
  const rest: Vec = { x: mouth.x + 4, y: mouth.y + cfg.restDrop };
  const shelfY = mouth.y + cfg.finaleDrop;
  const entryT = cfg.entryT;
  const dtE = entryT - last.t;
  arcs.push({
    t0: last.t,
    t1: entryT,
    x0: last.x,
    y0: last.y,
    vx: (mouth.x - last.x) / dtE,
    vy: (mouth.y - last.y - 0.5 * G * dtE * dtE) / dtE,
  });

  // ---- decorative unlit targets scattered off-path ----
  const extras: Target[] = [];
  for (let i = 4; i < targets.length - 4; i += 3) {
    if (rng() < 0.42) continue;
    const t0 = targets[i];
    const side = rng() > 0.5 ? 1 : -1;
    extras.push({
      t: -1,
      x: clamp(t0.x + side * lerp(120, 300, rng()), 40, W - 40),
      y: t0.y + lerp(-80, 160, rng()),
      ang: (rng() - 0.5) * 1.6,
      col: Math.floor(rng() * 5),
      s: 0,
      size: 0.55 + rng() * 0.45,
    });
  }

  // ---- ornaments along the descent ----
  const decors: Decor[] = [];
  const types = cfg.ornTypes;
  let oy = cfg.ornTop;
  let k = 0;
  const bottom = rest.y - cfg.ornBottomPad;
  while (oy < bottom) {
    const side = k % 2 === 0 ? -1 : 1;
    const jx = side === -1 ? lerp(70, 200, rng()) : lerp(W - 200, W - 70, rng());
    decors.push({
      type: types[k % types.length],
      x: jx,
      y: oy,
      scale: 0.85 + rng() * 0.35,
      side,
      phase: rng() * Math.PI * 2,
      seed: Math.floor(rng() * 1e9),
    });
    oy += lerp(cfg.ornStep[0], cfg.ornStep[1], rng());
    k++;
  }

  // ---- chimes = onsets after entry ----
  const chimes = cfg.onsets.filter((o) => o.t > entryT + 0.12).map((o) => o.t);

  // ---- camera track ----
  const durF = Math.round(cfg.dur * FPS);
  const cam = new Float32Array(durF + 4);
  const finaleCamY = shelfY - cfg.camSettle;
  const bY = (t: number) => ballPos(world0(t), t).y;
  let c = -60;
  for (let f = 0; f <= durF + 3; f++) {
    const t = f / FPS;
    const tgt = bY(Math.min(t, cfg.dur) + 0.3) - 470;
    c += (tgt - c) * (1 - Math.exp(-1 / 2.8));
    let eff = c;
    const w = smoothstep((t - (entryT - 1.1)) / 1.3);
    if (w > 0) eff = lerp(c, finaleCamY, w);
    cam[f] = Math.max(eff, -80);
  }

  const world: World = {
    targets,
    extras,
    decors,
    arcs,
    intro: { from: cfg.introFrom, t0: cfg.introT0, t1: targets[0].t },
    entryT,
    ripples: cfg.ripples,
    chimes,
    finale: { mouth, rest, shelfY, camY: finaleCamY, data: {} },
    cam,
    durF,
    seedBase: cfg.seed,
  };
  return world;

  // world0 placeholder so camera builder can reference ballY before world exists
  function world0(_t: number): World {
    return {
      targets,
      extras,
      decors,
      arcs,
      intro: { from: cfg.introFrom, t0: cfg.introT0, t1: targets[0].t },
      entryT,
      ripples: cfg.ripples,
      chimes,
      finale: { mouth, rest, shelfY, camY: finaleCamY, data: {} },
      cam,
      durF,
      seedBase: cfg.seed,
    };
  }
}

// ---------- ball path ----------

export function ballArcAt(world: World, t: number): Arc | null {
  if (t < world.targets[0].t || t >= world.entryT) return null;
  // binary search
  let lo = 0;
  let hi = world.arcs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (world.arcs[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = world.arcs[lo];
  return t >= a.t0 && t < a.t1 ? a : null;
}

export function ballPos(world: World, t: number): Vec {
  if (t < world.intro.t1) {
    const u = clamp((t - world.intro.t0) / (world.intro.t1 - world.intro.t0), 0, 1);
    const e = u * u; // ease-in fall
    const p0 = world.intro.from;
    const p1 = world.targets[0];
    return { x: lerp(p0.x, p1.x, u), y: lerp(p0.y, p1.y, e) };
  }
  if (t < world.entryT) {
    const a = ballArcAt(world, t);
    if (!a) return { x: world.targets[0].x, y: world.targets[0].y };
    const tau = t - a.t0;
    return { x: a.x0 + a.vx * tau, y: a.y0 + a.vy * tau + 0.5 * G * tau * tau };
  }
  // finale settle: fall into vessel, two damped bounces, rest
  const tau = t - world.entryT;
  const f = world.finale;
  const drop = f.rest.y - f.mouth.y;
  const g2 = 1500;
  const tf = Math.sqrt((2 * drop) / g2); // fall time
  if (tau < tf) return { x: lerp(f.mouth.x, f.rest.x, tau / tf), y: f.mouth.y + 0.5 * g2 * tau * tau };
  let tr = tau - tf;
  const b1 = 0.26; // up
  const up1 = 30;
  if (tr < b1) {
    const u = tr / b1;
    return { x: f.rest.x, y: f.rest.y - up1 * 4 * u * (1 - u) * 1.0 - up1 * 0 + Math.sin(u * Math.PI) * up1 };
  }
  tr -= b1;
  if (tr < b1) {
    const u = tr / b1;
    return { x: f.rest.x, y: f.rest.y - Math.sin(u * Math.PI) * up1 * Math.pow(1 - u, 1) * 0.32 };
  }
  tr -= b1;
  if (tr < 0.2) {
    const u = tr / 0.2;
    return { x: f.rest.x, y: f.rest.y - Math.sin(u * Math.PI) * 6 };
  }
  return { x: f.rest.x, y: f.rest.y };
}

// ---------- background tint ----------

export type BgKeys = [number, number, number, number][];

export function sampleBg(keys: BgKeys, t: number): [number, number, number] {
  const i = clamp(Math.floor(t), 0, keys.length - 1);
  const j = clamp(i + 1, 0, keys.length - 1);
  const u = clamp(t - i, 0, 1);
  const a = keys[i];
  const b = keys[j];
  return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
}

// ---------- recent hits helper ----------

export interface ActiveHit {
  target: Target;
  age: number;
}

export function recentHits(world: World, t: number, window = 2.6, max = 4): ActiveHit[] {
  const out: ActiveHit[] = [];
  for (let i = world.targets.length - 1; i >= 0 && out.length < max; i--) {
    const tg = world.targets[i];
    if (tg.t > t) continue;
    const age = t - tg.t;
    if (age > window) break;
    out.push({ target: tg, age });
  }
  return out;
}

export function litOf(tg: Target, t: number): number {
  if (tg.t < 0 || t < tg.t) return 0;
  return Math.exp(-(t - tg.t) / 0.55);
}

// ---------- culling ----------

export function inView(y: number, cam: number, pad = 260): boolean {
  return y > cam - pad && y < cam + H + pad;
}
