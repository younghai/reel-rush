// Arirang theme: Korean glass ornaments, obangsaek glass bar keys, moon jar finale.
import {
  World,
  Target,
  Decor,
  Vec,
  BgKeys,
  sampleBg,
  recentHits,
  litOf,
  mulberry32,
  clamp,
  lerp,
  H,
} from './engine';
import { rr, radial, glowDot, taegeuk, shelfBar, thread } from './draw';
import { drawSprite } from './sprites';

// Designed per-second ambient (matches the reference's warm/cool color arc).
export const BG_ARIRANG: BgKeys = [
  [0, 14, 13, 17], [1, 20, 19, 25], [2, 21, 20, 27], [3, 26, 24, 30],
  [4, 42, 32, 25], [5, 46, 34, 26], [6, 38, 29, 23], [7, 26, 24, 31],
  [8, 24, 24, 34], [9, 19, 18, 26], [10, 28, 28, 40], [11, 27, 25, 36],
  [12, 25, 25, 36], [13, 19, 18, 26], [14, 43, 34, 26], [15, 22, 21, 29],
  [16, 21, 21, 30], [17, 19, 19, 27], [18, 21, 21, 30], [19, 44, 34, 25],
  [20, 46, 35, 26], [21, 38, 30, 23], [22, 23, 22, 31], [23, 22, 22, 31],
  [24, 22, 21, 30], [25, 45, 35, 26], [26, 40, 31, 24], [27, 37, 30, 24],
  [28, 20, 20, 28], [29, 42, 33, 25], [30, 21, 21, 29], [31, 20, 20, 28],
  [32, 23, 23, 32], [33, 24, 24, 33], [34, 42, 33, 25], [35, 39, 31, 24],
  [36, 36, 29, 23], [37, 22, 22, 30], [38, 22, 22, 31], [39, 20, 19, 27],
  [40, 43, 34, 26], [41, 41, 32, 25], [42, 37, 30, 24], [43, 22, 21, 30],
  [44, 58, 45, 33], [45, 64, 49, 35], [46, 48, 38, 29], [47, 36, 29, 23],
  [48, 16, 14, 15], [49, 6, 5, 6],
];

// fill rgb + glow rgb per palette entry: cream, blue, pink, pale-blue, warm-white
const PAL: { fill: string; grey: string; glow: string }[] = [
  { fill: '242,227,184', grey: '168,160,148', glow: '255,210,130' },
  { fill: '169,198,242', grey: '150,162,184', glow: '130,170,255' },
  { fill: '240,182,198', grey: '178,158,166', glow: '255,150,190' },
  { fill: '230,238,248', grey: '162,170,182', glow: '185,215,255' },
  { fill: '246,238,226', grey: '172,168,160', glow: '255,228,180' },
];

export const ARIRANG_ORN = ['lantern', 'norigae', 'flower', 'pouch', 'janggu', 'fan', 'beads', 'hourglass', 'pouch', 'flower', 'lantern', 'norigae'];

// sprite anchors: [ax, ay] — the point that maps to the decor's (x, y)
const ORN_ANCHOR: Record<string, [number, number, number]> = {
  // ax, ay, default scale
  lantern: [0.5, 0.155, 1.0], // gold dot at top of string
  norigae: [0.5, 0.06, 1.0],
  pouch: [0.5, 0.03, 1.0],
  fan: [0.5, 0.03, 1.0],
  beads: [0.5, 0.5, 0.95],
  hourglass: [0.5, 0.905, 1.0], // shelf line inside sprite
  flower: [0.5, 0.92, 1.0],
  janggu: [0.5, 0.93, 1.0],
};

export function arirangDecor(ctx: CanvasRenderingContext2D, d: Decor, t: number, cam: number) {
  const y = d.y - cam;
  const sway = Math.sin(t * 0.45 + d.phase) * 0.02;
  const a = ORN_ANCHOR[d.type];
  if (!a) return;
  drawSprite(ctx, d.type, d.x, y, d.scale * a[2], { ax: a[0], ay: a[1], rot: sway });
}

export function arirangBg(ctx: CanvasRenderingContext2D, t: number, cam: number) {
  const c0 = sampleBg(BG_ARIRANG, t);
  const c = [c0[0] * 1.3 + 7, c0[1] * 1.28 + 6, c0[2] * 1.28 + 8];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${c[0] * 0.8},${c[1] * 0.82},${c[2] * 0.86})`);
  g.addColorStop(0.45, `rgb(${c[0]},${c[1]},${c[2]})`);
  g.addColorStop(1, `rgb(${c[0] * 0.72},${c[1] * 0.74},${c[2] * 0.8})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, H);
  void cam;
}

export function arirangHitGlow(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const hits = recentHits(world, t, 1.6, 2);
  for (const h of hits) {
    const d = Math.exp(-h.age / 0.8);
    const p = PAL[h.target.col] || PAL[0];
    glowDot(ctx, h.target.x, h.target.y - cam, 470, p.glow, 0.2 * d);
  }
}

// faint grid + crosshair rings around the most recent hit
export function arirangGrid(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const hits = recentHits(world, t, 1.7, 1);
  for (const h of hits) {
    const d = Math.exp(-h.age / 1.0);
    const x = h.target.x;
    const y = h.target.y - cam;
    const sp = 130;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.05 * d})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.floor((x - 300) / sp) * sp; gx <= x + 300; gx += sp) {
      ctx.moveTo(gx, y - 300);
      ctx.lineTo(gx, y + 300);
    }
    for (let gy = Math.floor((y - 300) / sp) * sp; gy <= y + 300; gy += sp) {
      ctx.moveTo(x - 300, gy);
      ctx.lineTo(x + 300, gy);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.2 * d})`;
    ctx.beginPath();
    ctx.arc(x, y, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // drifting particles
    const rng = mulberry32(h.target.t * 1000 | 0);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * d})`;
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const r0 = 14 + rng() * 40;
      const drift = h.age * (8 + rng() * 16);
      const px = x + Math.cos(a) * (r0 + drift);
      const py = y + Math.sin(a) * (r0 + drift) - drift * 0.35;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function arirangTarget(ctx: CanvasRenderingContext2D, tg: Target, t: number, cam: number) {
  const lit = litOf(tg, t);
  const pal = PAL[tg.col] || PAL[0];
  const len = 104 * tg.size;
  const th = 16 * Math.min(tg.size, 1.1);
  const x = tg.x;
  const y = tg.y - cam + 9; // hit point on top face
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tg.ang);
  if (lit > 0.02) {
    ctx.shadowColor = `rgba(${pal.glow},${0.9 * lit})`;
    ctx.shadowBlur = 30 * lit;
  }
  // unlit bars keep a hint of their obangsaek color; lit bars take it fully
  const fr = lerp(parseInt(pal.grey.split(',')[0]), parseInt(pal.fill.split(',')[0]), 0.5 + lit * 0.5);
  const fg = lerp(parseInt(pal.grey.split(',')[1]), parseInt(pal.fill.split(',')[1]), 0.5 + lit * 0.5);
  const fb = lerp(parseInt(pal.grey.split(',')[2]), parseInt(pal.fill.split(',')[2]), 0.5 + lit * 0.5);
  const g = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
  g.addColorStop(0, `rgba(255,255,255,${0.42 + 0.4 * lit})`);
  g.addColorStop(0.5, `rgba(${fr | 0},${fg | 0},${fb | 0},${0.3 + 0.42 * lit})`);
  g.addColorStop(1, `rgba(${fr | 0},${fg | 0},${fb | 0},${0.14 + 0.28 * lit})`);
  ctx.fillStyle = g;
  rr(ctx, -len / 2, -th / 2, len, th, th / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${0.42 + 0.46 * lit})`;
  ctx.lineWidth = 1.4;
  rr(ctx, -len / 2, -th / 2, len, th, th / 2);
  ctx.stroke();
  if (lit > 0.02) {
    ctx.fillStyle = `rgba(255,250,236,${0.82 * lit})`;
    rr(ctx, -len * 0.36, -th * 0.24, len * 0.72, th * 0.48, th * 0.24);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChorong(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number, t: number) {
  const top = y - 60 * s;
  thread(ctx, x, top - 210 * s, top);
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(sway);
  const w = 58 * s;
  const h = 90 * s;
  const cy = h * 0.72;
  // cap
  ctx.fillStyle = 'rgba(216,90,70,0.85)';
  rr(ctx, -w * 0.18, 2, w * 0.36, 9 * s, 3);
  ctx.fill();
  // body (relative coords after translate)
  const g = ctx.createLinearGradient(0, 10 * s, 0, 10 * s + h);
  g.addColorStop(0, 'rgba(255,96,64,0.6)');
  g.addColorStop(0.52, 'rgba(255,120,80,0.3)');
  g.addColorStop(0.55, 'rgba(90,120,255,0.38)');
  g.addColorStop(1, 'rgba(70,100,255,0.55)');
  ctx.shadowColor = 'rgba(255,110,70,0.55)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = g;
  rr(ctx, -w / 2, 10 * s, w, h, 7 * s);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.6;
  rr(ctx, -w / 2, 10 * s, w, h, 7 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 7 * s, 10 * s + cy - h * 0.36);
  ctx.lineTo(w / 2 - 7 * s, 10 * s + cy - h * 0.36);
  ctx.stroke();
  const fl = 0.85 + 0.15 * Math.sin(t * 6 + x);
  glowDot(ctx, 0, 10 * s + cy - h * 0.1, 26 * s * fl, '255,200,120', 0.9);
  glowDot(ctx, 0, 10 * s + cy - h * 0.1, 9 * s, '255,240,200', 0.95);
  ctx.restore();
}

function drawNorigae(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  const top = y - 30 * s;
  thread(ctx, x, top - 180 * s, top);
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(sway);
  const knotY = 42 * s;
  ctx.strokeStyle = 'rgba(220,220,235,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, knotY - 16 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(222,178,96,0.95)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 11 * s, knotY + Math.sin(a) * 11 * s, 8.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, knotY, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240,140,70,0.95)';
  ctx.beginPath();
  ctx.arc(0, knotY, 6.5 * s, 0, Math.PI * 2);
  ctx.fill();
  const tw = 19 * s;
  const th2 = 66 * s;
  const g = ctx.createLinearGradient(0, knotY + 12 * s, 0, knotY + 12 * s + th2);
  g.addColorStop(0, 'rgba(245,150,90,0.9)');
  g.addColorStop(0.45, 'rgba(120,150,235,0.85)');
  g.addColorStop(1, 'rgba(200,120,220,0.8)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-tw, knotY + 12 * s);
  ctx.lineTo(tw, knotY + 12 * s);
  ctx.lineTo(tw * 0.62, knotY + 12 * s + th2);
  ctx.lineTo(-tw * 0.62, knotY + 12 * s + th2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (const u of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(tw * u, knotY + 12 * s);
    ctx.lineTo(tw * 0.62 * u * 1.4, knotY + 12 * s + th2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPouch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  const top = y - 26 * s;
  thread(ctx, x, top - 170 * s, top);
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(sway);
  const w = 40 * s;
  // gathered top
  ctx.shadowColor = 'rgba(255,190,120,0.45)';
  ctx.shadowBlur = 22;
  const g = radial(ctx, 0, 66 * s, 4, w * 1.5, [
    [0, 'rgba(255,214,150,0.6)'],
    [0.55, 'rgba(255,236,214,0.22)'],
    [1, 'rgba(255,255,255,0.05)'],
  ]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-16 * s, 26 * s);
  ctx.quadraticCurveTo(-w * 1.15, 52 * s, -w * 0.92, 80 * s);
  ctx.quadraticCurveTo(-w * 0.6, 110 * s, 0, 112 * s);
  ctx.quadraticCurveTo(w * 0.6, 110 * s, w * 0.92, 80 * s);
  ctx.quadraticCurveTo(w * 1.15, 52 * s, 16 * s, 26 * s);
  ctx.quadraticCurveTo(0, 16 * s, -16 * s, 26 * s);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // cinch gather lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  for (const u of [-0.5, -0.17, 0.17, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(u * 26 * s, 22 * s);
    ctx.quadraticCurveTo(u * 34 * s, 44 * s, u * 30 * s, 62 * s);
    ctx.stroke();
  }
  // bow
  ctx.strokeStyle = 'rgba(230,110,110,0.92)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(-9 * s, 26 * s, 7.5 * s, Math.PI * 0.35, Math.PI * 1.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9 * s, 26 * s, 7.5 * s, -Math.PI * 0.55, Math.PI * 0.65);
  ctx.stroke();
  ctx.fillStyle = 'rgba(110,140,235,0.92)';
  ctx.beginPath();
  ctx.arc(0, 27 * s, 4.2 * s, 0, Math.PI * 2);
  ctx.fill();
  const cols = ['255,120,110', '240,200,110', '120,150,240', '245,245,245', '120,150,240', '240,200,110', '255,120,110'];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.3 + (i / 6) * 0.4);
    const bx = Math.cos(a) * w * 0.86;
    const by = 84 * s + Math.sin(a) * w * 0.55;
    ctx.fillStyle = `rgba(${cols[i]},0.95)`;
    ctx.beginPath();
    ctx.arc(bx, by, 3.1 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  const py = 64 * s;
  const R = 82 * s;
  ctx.fillStyle = 'rgba(250,250,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.arc(0, py, R, -Math.PI * 0.86, -Math.PI * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI * 0.86 + (i / 14) * Math.PI * 0.72;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(Math.cos(a) * R, py + Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(0, py, R, -Math.PI * 0.86, -Math.PI * 0.14);
  ctx.stroke();
  taegeuk(ctx, 0, py - 44 * s, 19 * s, Math.PI * 0.5);
  ctx.fillStyle = 'rgba(230,190,110,0.95)';
  ctx.beginPath();
  ctx.arc(0, py, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,130,230,0.9)';
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(0, py + 26 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,130,230,0.9)';
  ctx.beginPath();
  ctx.moveTo(-4 * s, py + 26 * s);
  ctx.lineTo(4 * s, py + 26 * s);
  ctx.lineTo(2.4 * s, py + 44 * s);
  ctx.lineTo(-2.4 * s, py + 44 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawJangguBody(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  const w = 42 * s;
  const h = 58 * s;
  const nw = 13 * s; // waist half-width
  ctx.shadowColor = 'rgba(255,190,130,0.35)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(240,226,200,0.28)';
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.lineTo(w, -h);
  ctx.lineTo(nw, -h * 0.08);
  ctx.lineTo(nw, h * 0.08);
  ctx.lineTo(w, h);
  ctx.lineTo(-w, h);
  ctx.lineTo(-nw, h * 0.08);
  ctx.lineTo(-nw, -h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // drum heads
  for (const sy of [-1, 1]) {
    ctx.fillStyle = 'rgba(250,240,220,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, sy * h, w, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
  }
  // V lacing along the slant edges
  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.lineWidth = 1;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const u = i / 4;
        const x1 = sx * lerp(nw, w, u);
        const y1 = sy * lerp(h * 0.08, h, u);
        ctx.beginPath();
        ctx.moveTo(x1 - 8 * s * sx, y1);
        ctx.lineTo(x1 + 8 * s * sx, y1 - sy * 10 * s);
        ctx.stroke();
      }
    }
  }
  taegeuk(ctx, 0, 0, 11 * s, Math.PI * 0.5);
  const cols = ['235,110,80', '235,200,80', '90,140,235'];
  cols.forEach((c, i) => {
    ctx.strokeStyle = `rgba(${c},0.8)`;
    ctx.lineWidth = 4.2 * s;
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.5);
    ctx.bezierCurveTo(w * (1.5 + i * 0.25), h * (0.2 + i * 0.3), w * (0.9 + i * 0.2), h * (1.2 + i * 0.15), w * (1.7 + i * 0.3), h * (1.05 + i * 0.1));
    ctx.stroke();
  });
  ctx.restore();
}

function drawJangguShelf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  shelfBar(ctx, x, y + 46 * s, 122 * s, 9 * s);
  drawJangguBody(ctx, x, y - 10 * s, s);
}

function drawFlowerShelf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number) {
  shelfBar(ctx, x, y + 40 * s, 108 * s, 8 * s);
  const rng = mulberry32(seed);
  ctx.save();
  ctx.translate(x, y + 40 * s);
  ctx.strokeStyle = 'rgba(140,170,150,0.8)';
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(-8 * s, 0);
  ctx.quadraticCurveTo(-14 * s, -22 * s, -20 * s, -40 * s);
  ctx.moveTo(6 * s, 0);
  ctx.quadraticCurveTo(10 * s, -26 * s, 22 * s, -44 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,155,135,0.75)';
  for (let i = 0; i < 4; i++) {
    const lx = lerp(-18, 20, i / 3) * s;
    const ly = -14 * s - rng() * 16 * s;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rng() * 1.2 - 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const [bx, by, br] of [[-22, -46, 15], [24, -52, 16.5], [2, -30, 11]] as number[][]) {
    drawBlossom(ctx, bx * s, by * s, br * s);
  }
  ctx.restore();
}

function drawBlossom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(255,160,190,0.5)';
  ctx.shadowBlur = 12;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(a);
    const g = radial(ctx, 0, -r * 0.75, 1, r * 0.8, [
      [0, 'rgba(255,238,244,0.95)'],
      [0.55, 'rgba(244,150,180,0.9)'],
      [1, 'rgba(228,104,146,0.85)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.34, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,228,238,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,80,90,0.9)';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBeads(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  const top = y - 40 * s;
  thread(ctx, x, top - 150 * s, top);
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(sway * 0.7);
  const cols = ['235,110,95', '240,200,110', '120,150,240', '245,245,245'];
  const n = 15;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const bx = lerp(-64, 64, u) * s;
    const by = Math.sin(u * Math.PI) * 26 * s + u * 14 * s;
    ctx.fillStyle = `rgba(${cols[i % 4]},0.92)`;
    ctx.beginPath();
    ctx.arc(bx, by, 4.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- finale ----------

export function arirangFinale(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const f = world.finale;
  const shelfY = f.shelfY - cam;
  const cx = f.rest.x;
  if (shelfY < -420 || shelfY > H + 720) return;
  const entry = world.entryT;
  const light = t < entry ? 0.15 : clamp(0.72 + 0.28 * Math.exp(-(t - entry) / 0.55), 0, 1);
  const chimeBump = world.chimes.reduce((acc, c) => acc + Math.exp(-Math.max(0, t - c) / 0.4) * (t >= c ? 0.14 : 0), 0);
  const lightA = light + chimeBump;

  glowDot(ctx, cx, shelfY, 470, '216,170,110', 0.24 * lightA);

  // original shelf group sprite: jar mouth sits ~150px above the shelf line,
  // at ax 0.509 of the sprite; align it to the sim's mouth point.
  const mx = f.mouth.x;
  drawSprite(ctx, 'shelf', mx, shelfY, 1, { ax: 0.509, ay: 0.885 });
  const mouthY = shelfY - 150;

  for (const tr of world.ripples) {
    for (let k = 0; k < 2; k++) {
      const age = t - tr - k * 0.55;
      if (age <= 0) continue;
      const rad = 42 + age * 86 - k * 34;
      if (rad <= 42) continue;
      const a = Math.max(0, (1 - age / 3.8) * 0.45 - k * 0.1);
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(232,200,138,${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(mx, mouthY, rad, rad * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (t > entry) {
    const rng = mulberry32(77);
    for (let i = 0; i < 9; i++) {
      const u = rng();
      const life = ((t - entry) * (0.35 + u * 0.3) + u * 4) % 4;
      const a = Math.sin((life / 4) * Math.PI) * 0.5;
      const ex = cx + (u - 0.5) * 220;
      const ey = mouthY - 20 - life * 34;
      glowDot(ctx, ex, ey, 5, '255,214,150', a);
    }
  }
}

// ---------- ball ----------

export function arirangBall(ctx: CanvasRenderingContext2D, p: Vec, alpha: number, ghost: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!ghost) {
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 16;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function arirangOverlay(ctx: CanvasRenderingContext2D, t: number, dur: number) {
  const g = radial(ctx, 360, 640, 380, 760, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.27)'],
  ]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, H);
  if (t < 0.4) {
    ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`;
    ctx.fillRect(0, 0, 720, H);
  }
  if (t > dur - 0.75) {
    ctx.fillStyle = `rgba(0,0,0,${clamp((t - (dur - 0.75)) / 0.75, 0, 1)})`;
    ctx.fillRect(0, 0, 720, H);
  }
}
