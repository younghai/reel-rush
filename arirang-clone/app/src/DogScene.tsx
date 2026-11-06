// Dancing Pomeranian stage scene: original-video pose sprites on a beat grid.
import React, { useLayoutEffect, useRef } from 'react';
import { Audio, staticFile, useCurrentFrame } from 'remotion';
import onsetsDog from './onsets-dog.json';
import { preloadSprites, SPRITES } from './sprites';
import { clamp, lerp, H } from './engine';

preloadSprites();

const FPS = 30;
const DUR = 28.041666;
const DUR_F = Math.round(DUR * FPS);
const FLOOR_Y = 880;
const DOG_X = 360;

interface PoseDef {
  ax: number; // anchor x fraction (maps to DOG_X)
  feetY: number;
  scale: number;
}

const DOG_POSES: Record<string, PoseDef> = {
  dog_stand: { ax: 0.564, feetY: 1090, scale: 1 },
  dog_tongue: { ax: 0.482, feetY: 1100, scale: 1 },
  dog_shake: { ax: 0.48, feetY: 1100, scale: 1 },
  dog_side: { ax: 0.514, feetY: 1100, scale: 1 },
  dog_sniff: { ax: 0.586, feetY: 1042, scale: 1 },
  dog_front2: { ax: 0.4, feetY: 1085, scale: 1 },
};

const DANCER_POSES = ['dancer_stand', 'dancer_arms', 'dancer_back', 'dancer_bend'];

interface Phrase {
  until: number;
  poses: string[]; // cycled per step
  step: number; // seconds per pose
  flip?: boolean;
}

const PHRASES: Phrase[] = [
  { until: 1.3, poses: ['dog_sniff'], step: 2 },
  { until: 4.0, poses: ['dog_stand'], step: 0.62 },
  { until: 5.7, poses: ['dog_front2'], step: 0.62 },
  { until: 8.2, poses: ['dog_side'], step: 1.24, flip: true },
  { until: 10.6, poses: ['dog_shake'], step: 0.62 },
  { until: 14.2, poses: ['dog_tongue'], step: 0.62 },
  { until: 16.4, poses: ['dog_side'], step: 1.24, flip: true },
  { until: 23.5, poses: ['dog_tongue', 'dog_stand'], step: 1.24 },
  { until: 99, poses: ['dog_tongue'], step: 2 },
];

function phraseAt(t: number): { phrase: Phrase; idx: number } {
  let acc = 0;
  for (const p of PHRASES) {
    if (t < p.until) {
      const idx = Math.floor((t - acc) / p.step) % p.poses.length;
      return { phrase: p, idx };
    }
    acc = p.until;
  }
  const last = PHRASES[PHRASES.length - 1];
  return { phrase: last, idx: 0 };
}

function lastOnsetBefore(t: number): number {
  let last = -10;
  for (const o of onsetsDog) {
    if (o.t <= t) last = o.t;
    else break;
  }
  return last;
}

function drawImg(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  scale: number,
  opts: { ax?: number; ay?: number; rot?: number; flip?: boolean; alpha?: number },
) {
  const img = SPRITES[name];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -(opts.ax ?? 0.5) * w, -(opts.ay ?? 1) * h, w, h);
  ctx.restore();
}

function drawStage(ctx: CanvasRenderingContext2D, t: number) {
  // wall
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, '#150e0a');
  g.addColorStop(0.35, '#1e140d');
  g.addColorStop(0.62, '#261910');
  g.addColorStop(1, '#2c1c10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, FLOOR_Y);

  // floor
  const fg = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  fg.addColorStop(0, '#292520');
  fg.addColorStop(0.35, '#413a31');
  fg.addColorStop(0.75, '#332d26');
  fg.addColorStop(1, '#221e19');
  ctx.fillStyle = fg;
  ctx.fillRect(0, FLOOR_Y, 720, H - FLOOR_Y);
  const pool = ctx.createRadialGradient(360, 1060, 40, 360, 1060, 520);
  pool.addColorStop(0, 'rgba(120,105,84,0.18)');
  pool.addColorStop(1, 'rgba(120,105,84,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, FLOOR_Y, 720, H - FLOOR_Y);
  // boundary
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, FLOOR_Y - 2, 720, 3);
  ctx.fillStyle = 'rgba(120,80,40,0.18)';
  ctx.fillRect(0, FLOOR_Y - 6, 720, 4);

  // light cones + glows
  const xs = [36, 181, 326, 470, 625];
  xs.forEach((lx, i) => {
    const flick = 0.9 + 0.1 * Math.sin(t * 3.1 + i * 1.7) * Math.sin(t * 1.3 + i);
    // cone
    const cg = ctx.createLinearGradient(0, 330, 0, FLOOR_Y);
    cg.addColorStop(0, `rgba(255,208,140,${0.17 * flick})`);
    cg.addColorStop(1, 'rgba(255,208,140,0.02)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(lx - 16, 332);
    ctx.lineTo(lx + 16, 332);
    ctx.lineTo(lx + 95, FLOOR_Y);
    ctx.lineTo(lx - 95, FLOOR_Y);
    ctx.closePath();
    ctx.fill();
    // halo
    const halo = ctx.createRadialGradient(lx, 322, 8, lx, 322, 135);
    halo.addColorStop(0, `rgba(255,196,120,${0.24 * flick})`);
    halo.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(lx - 140, 182, 280, 280);
    // glow
    const gl = ctx.createRadialGradient(lx, 322, 4, lx, 322, 62);
    gl.addColorStop(0, `rgba(255,214,150,${0.75 * flick})`);
    gl.addColorStop(0.45, `rgba(255,180,100,${0.32 * flick})`);
    gl.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 66, 256, 132, 132);
    // core
    ctx.fillStyle = `rgba(255,238,205,${0.95 * flick})`;
    ctx.beginPath();
    ctx.arc(lx, 322, 13, 0, Math.PI * 2);
    ctx.fill();
  });
  // haze band across the light row
  const band = ctx.createLinearGradient(0, 250, 0, 480);
  band.addColorStop(0, 'rgba(255,190,120,0)');
  band.addColorStop(0.45, 'rgba(255,190,120,0.09)');
  band.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 250, 720, 230);
  // broad warm wash on the wall behind the performers
  const wash = ctx.createRadialGradient(360, 520, 60, 360, 520, 430);
  wash.addColorStop(0, 'rgba(190,140,90,0.14)');
  wash.addColorStop(1, 'rgba(190,140,90,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 120, 720, 760);
}

// solid-pixel-only cache for reflections: kills semi-transparent junk
const reflectCache = new Map<string, HTMLCanvasElement>();
function solidCanvas(name: string): HTMLCanvasElement | null {
  if (reflectCache.has(name)) return reflectCache.get(name)!;
  const img = SPRITES[name];
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const c2 = cv.getContext('2d')!;
  c2.drawImage(img, 0, 0);
  const data = c2.getImageData(0, 0, cv.width, cv.height);
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 235) px[i] = 0;
  }
  c2.putImageData(data, 0, 0);
  reflectCache.set(name, cv);
  return cv;
}

function drawReflection(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  feetY: number,
  scale: number,
  ax: number,
  flip: boolean,
  alpha: number,
) {
  const img = solidCanvas(name);
  if (!img) return;
  const w = img.width * scale;
  const h = img.height * scale * 0.8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, feetY + 3);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(1, -0.8);
  ctx.drawImage(img, -ax * w, -h, w, h);
  ctx.restore();
}

export const DogDance: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const t = frame / FPS;

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    drawStage(ctx, t);

    // ----- dancers -----
    const danceBeat = Math.floor(t / 1.24);
    const poses = [
      DANCER_POSES[(danceBeat + 2) % 4],
      DANCER_POSES[danceBeat % 4],
    ];
    const onset = lastOnsetBefore(t);
    const bounce = Math.exp(-Math.max(0, t - onset) / 0.14);
    const dancers: { x: number; flip: boolean }[] = [
      { x: 148, flip: true },
      { x: 560, flip: false },
    ];
    dancers.forEach((d, i) => {
      const sw = Math.sin(t * 1.9 + i * 2.4) * 0.022;
      // reflection
      drawReflection(ctx, poses[i], d.x, 950, 0.98, 0.5, d.flip, 0.14);
      drawImg(ctx, poses[i], d.x, 950 - bounce * 5, 0.98, {
        ax: 0.5,
        ay: 0.988,
        rot: sw,
        flip: d.flip,
      });
    });
    // floor fade over reflections
    const fade = ctx.createLinearGradient(0, 960, 0, 1280);
    fade.addColorStop(0, 'rgba(64,56,47,0.12)');
    fade.addColorStop(1, 'rgba(58,51,43,0.75)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 960, 720, H - 960);

    // ----- dog -----
    const { phrase, idx } = phraseAt(t);
    const pose = phrase.poses[idx];
    const def = DOG_POSES[pose];
    const growth = lerp(0.82, 1.0, clamp((t - 1.2) / 8, 0, 1));
    const flip = !!phrase.flip && Math.floor((t % 2.48) / 1.24) === 1;
    const dogBounce = Math.exp(-Math.max(0, t - onset) / 0.12);
    const bob = Math.sin((t * Math.PI * 2) / 0.62) * 0.025;
    const swayX = Math.sin(t * 0.9) * 6;
    const scale = def.scale * growth * (1 + dogBounce * 0.045);
    const rot = bob + (pose === 'dog_shake' ? Math.sin(t * 18) * 0.05 * Math.exp(-((t - 8.2) % 2.4)) : 0);

    // dog reflection
    drawReflection(ctx, pose, DOG_X + swayX, def.feetY, scale, def.ax, flip, 0.18);

    drawImg(ctx, pose, DOG_X + swayX, def.feetY - dogBounce * 7, scale, {
      ax: def.ax,
      ay: 0.995,
      rot,
      flip,
    });

    // re-fade floor below dog reflection
    const fade2 = ctx.createLinearGradient(0, 1130, 0, 1280);
    fade2.addColorStop(0, 'rgba(62,54,45,0.05)');
    fade2.addColorStop(1, 'rgba(56,49,41,0.6)');
    ctx.fillStyle = fade2;
    ctx.fillRect(0, 1130, 720, H - 1130);

    // ----- sparkle dust in beams -----
    for (let i = 0; i < 26; i++) {
      const seed = i * 97.13;
      const lx = 36 + (i % 5) * 147 + ((seed * 7.3) % 60) - 30;
      const ly = 350 + ((seed * 13.7) % 480);
      const tw = 0.5 + 0.5 * Math.sin(t * 2.6 + seed);
      const drift = Math.sin(t * 0.35 + seed) * 10;
      ctx.fillStyle = `rgba(255,230,190,${0.12 + tw * 0.2})`;
      ctx.beginPath();
      ctx.arc(lx + drift, ly + Math.sin(t * 0.5 + seed) * 14, 1.4 + (seed % 1), 0, Math.PI * 2);
      ctx.fill();
    }

    // vignette
    const vg = ctx.createRadialGradient(360, 640, 380, 360, 640, 780);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 720, H);

    // intro / outro
    if (t < 0.3) {
      ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.3})`;
      ctx.fillRect(0, 0, 720, H);
    }
    if (t > 23.8) {
      const a = clamp((t - 23.8) / 2.3, 0, 1) * 0.97;
      ctx.fillStyle = `rgba(2,1,1,${a})`;
      ctx.fillRect(0, 0, 720, H);
    }
  }, [frame]);

  return (
    <>
      <Audio src={staticFile('dog.m4a')} />
      <canvas ref={ref} width={720} height={1280} style={{ width: 720, height: 1280 }} />
    </>
  );
};
