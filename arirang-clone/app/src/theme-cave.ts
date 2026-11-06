// Cave theme: rock walls, energy lines, gem keys, torches / lanterns / chains /
// gargoyle faces / pickaxes / glow mushrooms, treasure chest + crystal crown finale.
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
  inView,
} from './engine';
import { rr, radial, glowDot, star4 } from './draw';
import { drawSprite } from './sprites';

// Designed per-second ambient: cool slate base, teal phase 8-23, warm gold phase 31-43,
// cool finale approach, warm chest glow 54-56, fade.
export const BG_CAVE: BgKeys = [
  [0, 12, 12, 18], [1, 15, 15, 24], [2, 16, 16, 25], [3, 15, 15, 23],
  [4, 14, 14, 21], [5, 15, 15, 23], [6, 16, 17, 26], [7, 15, 16, 24],
  [8, 16, 20, 28], [9, 15, 19, 27], [10, 17, 20, 29], [11, 17, 20, 29],
  [12, 16, 19, 28], [13, 17, 20, 29], [14, 18, 21, 30], [15, 17, 20, 29],
  [16, 16, 20, 28], [17, 15, 19, 27], [18, 17, 22, 30], [19, 18, 24, 32],
  [20, 18, 25, 33], [21, 19, 27, 35], [22, 18, 25, 33], [23, 17, 23, 31],
  [24, 15, 16, 26], [25, 16, 17, 27], [26, 16, 18, 28], [27, 17, 19, 29],
  [28, 16, 18, 28], [29, 16, 18, 27], [30, 17, 19, 29], [31, 26, 25, 26],
  [32, 24, 23, 24], [33, 25, 24, 25], [34, 27, 25, 26], [35, 26, 24, 25],
  [36, 28, 26, 26], [37, 30, 28, 28], [38, 25, 24, 25], [39, 24, 23, 24],
  [40, 25, 24, 25], [41, 26, 25, 25], [42, 28, 27, 27], [43, 27, 26, 26],
  [44, 23, 23, 29], [45, 23, 24, 32], [46, 24, 25, 33], [47, 25, 26, 34],
  [48, 24, 25, 32], [49, 26, 26, 32], [50, 27, 27, 33], [51, 28, 28, 34],
  [52, 32, 31, 36], [53, 26, 25, 30], [54, 34, 28, 25], [55, 30, 25, 22],
  [56, 24, 21, 19], [57, 8, 7, 8], [58, 8, 7, 8],
];

// right-side warm cast (gold torchlight phase)
const WARM_KEYS: [number, number][] = [
  [0, 0], [29, 0], [31, 0.55], [34, 0.8], [37, 0.95], [40, 0.85], [43, 0.55],
  [45, 0.15], [49, 0.05], [52, 0.1], [54, 0.35], [56, 0.2], [57, 0],
];

function warmAt(t: number): number {
  const i = clamp(Math.floor(t), 0, WARM_KEYS.length - 1);
  const a = WARM_KEYS[i];
  const b = WARM_KEYS[Math.min(i + 1, WARM_KEYS.length - 1)];
  return clamp(lerp(a[1], b[1], clamp(t - a[0], 0, 1)), 0, 1);
}

// gem palette: cyan, blue, purple, green, violet
const GEM: { fill: string; grey: string; glow: string }[] = [
  { fill: '127,224,220', grey: '92,128,132', glow: '110,225,220' },
  { fill: '143,180,242', grey: '102,116,150', glow: '120,160,255' },
  { fill: '168,142,240', grey: '112,100,150', glow: '160,120,255' },
  { fill: '143,232,176', grey: '96,132,110', glow: '120,235,160' },
  { fill: '200,162,240', grey: '126,108,152', glow: '190,150,255' },
];

export const CAVE_ORN = ['c_torch', 'c_lantern', 'c_chain', 'c_gargoyle', 'c_mushroom', 'c_torch', 'c_pickaxe', 'c_chain', 'c_lantern', 'c_gargoyle', 'c_mushroom', 'c_torch'];

// sprite anchors: [ax, ay, scale, wallMode] — wallMode: 1 = mount on rock edge
const ORN_ANCHOR: Record<string, [number, number, number, number]> = {
  c_torch: [0.32, 0.45, 1.0, 1], // bracket back
  c_lantern: [0.5, 0.04, 1.0, 0],
  c_chain: [0.5, 0.03, 1.0, 0],
  c_gargoyle: [0.5, 0.42, 1.0, 1],
  c_mushroom: [0.5, 0.93, 1.0, 0],
  c_pickaxe: [0.5, 0.5, 1.0, 0],
};

const W_CAVE = 720;

// ---- world-space rock edges (built once) ----
export interface WallData {
  ys: number[];
  left: number[];
  right: number[];
  height: number;
}

export function buildWalls(height: number, seed: number): WallData {
  const rng = mulberry32(seed);
  const ys: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  let l = 74;
  let r = W_CAVE - 80;
  let lr = 0.4;
  let rr2 = -0.4;
  for (let y = -400; y <= height + 600; y += 110) {
    lr += (rng() - 0.5) * 0.7;
    rr2 += (rng() - 0.5) * 0.7;
    lr = clamp(lr, -1, 1);
    rr2 = clamp(rr2, -1, 1);
    l = clamp(l + lr * 26, 16, 128);
    r = clamp(r + rr2 * 26, W_CAVE - 128, W_CAVE - 16);
    ys.push(y);
    left.push(l);
    right.push(r);
  }
  return { ys, left, right, height };
}

function edgeAt(w: WallData, arr: number[], y: number): number {
  const step = 110;
  const u = clamp((y + 400) / step, 0, w.ys.length - 1.001);
  const i = Math.floor(u);
  return lerp(arr[i], arr[i + 1], u - i);
}

export function caveBg(ctx: CanvasRenderingContext2D, world: World, walls: WallData, t: number, cam: number) {
  const c0 = sampleBg(BG_CAVE, t);
  let r = c0[0] * 1.28 + 6;
  let g = c0[1] * 1.28 + 6;
  let b = c0[2] * 1.28 + 7;
  if (t >= 7.5 && t <= 23.5) {
    g = g * 1.32 + 8;
    b = b * 1.26 + 8;
  } else if (t < 7.5 || (t >= 23.5 && t <= 30.5)) {
    b = b * 1.32 + 9;
  }
  const c = [r, g, b];
  const lg = ctx.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, `rgb(${c[0] * 0.72},${c[1] * 0.74},${c[2] * 0.82})`);
  lg.addColorStop(0.5, `rgb(${c[0]},${c[1]},${c[2]})`);
  lg.addColorStop(1, `rgb(${c[0] * 0.66},${c[1] * 0.68},${c[2] * 0.76})`);
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W_CAVE, H);

  const warm = warmAt(t);

  // right-side warm cast during the gold phase
  if (warm > 0.02) {
    const wg = radial(ctx, 720, 640 - cam * 0.02, 60, 720, [
      [0, `rgba(150,110,55,${0.34 * warm})`],
      [0.6, `rgba(140,105,55,${0.16 * warm})`],
      [1, 'rgba(120,90,50,0)'],
    ]);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W_CAVE, H);
  }

  // rock walls
  const y0 = cam - 200;
  const y1 = cam + H + 200;
  ctx.fillStyle = 'rgba(4,5,9,0.94)';
  ctx.beginPath();
  ctx.moveTo(-10, y0);
  for (let y = y0; y <= y1; y += 55) ctx.lineTo(edgeAt(walls, walls.left, y), y);
  ctx.lineTo(-10, y1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W_CAVE + 10, y0);
  for (let y = y0; y <= y1; y += 55) ctx.lineTo(edgeAt(walls, walls.right, y), y);
  ctx.lineTo(W_CAVE + 10, y1);
  ctx.closePath();
  ctx.fill();

  // wall texture: faint speckles inside the rock
  const rngT = mulberry32(818);
  ctx.fillStyle = 'rgba(90,100,125,0.06)';
  for (let i = 0; i < 130; i++) {
    const wy = Math.floor(rngT() * (walls.height + 1200)) - 400;
    if (!inView(wy, cam)) continue;
    const side = rngT() > 0.5 ? -1 : 1;
    const ex = side === -1 ? edgeAt(walls, walls.left, wy) : edgeAt(walls, walls.right, wy);
    const tx = side === -1 ? ex - rngT() * 60 : ex + rngT() * 60;
    ctx.beginPath();
    ctx.arc(tx, wy - cam + (rngT() - 0.5) * 60, 5 + rngT() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // rim light on edges
  ctx.strokeStyle = `rgba(140,170,215,${0.16 + warm * 0.08})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 40) {
    const ex = edgeAt(walls, walls.left, y);
    if (y === y0) ctx.moveTo(ex, y - cam);
    else ctx.lineTo(ex, y - cam);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 40) {
    const ex = edgeAt(walls, walls.right, y);
    if (y === y0) ctx.moveTo(ex, y - cam);
    else ctx.lineTo(ex, y - cam);
  }
  ctx.stroke();

  drawEnergy(ctx, walls, cam, -1, t, warm);
  drawEnergy(ctx, walls, cam, 1, t, warm);

  // dust bokeh near edges
  const rng = mulberry32(4242);
  for (let i = 0; i < 90; i++) {
    const wy = Math.floor(rng() * (walls.height + 1200)) - 400;
    if (!inView(wy, cam)) continue;
    const side = rng() > 0.5 ? -1 : 1;
    const ex = side === -1 ? edgeAt(walls, walls.left, wy) : edgeAt(walls, walls.right, wy);
    const bx = side === -1 ? ex + 30 + rng() * 90 : ex - 30 - rng() * 90;
    const r = 26 + rng() * 44;
    const col = rng() < 0.5 + warm * 0.3 ? (side === -1 ? '110,200,230' : '230,190,110') : '150,170,230';
    const drift = Math.sin(t * 0.2 + i) * 8;
    glowDot(ctx, bx + drift, wy - cam + drift, r, col, 0.06 + rng() * 0.045);
  }
}

function drawEnergy(ctx: CanvasRenderingContext2D, walls: WallData, cam: number, side: number, t: number, warm: number) {
  const y0 = cam - 120;
  const y1 = cam + H + 120;
  const col =
    side === -1
      ? `rgba(120,225,240,0.62)`
      : `rgba(${lerp(120, 245, warm) | 0},${lerp(225, 185, warm) | 0},${lerp(240, 115, warm) | 0},0.62)`;
  const xAt = (y: number) => {
    const ex = side === -1 ? edgeAt(walls, walls.left, y) : edgeAt(walls, walls.right, y);
    return ex + side * (30 + Math.sin(y * 0.012 + side * 2) * 22 + Math.sin(y * 0.03 + 1.7) * 10);
  };
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 9;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 16) {
    const x = xAt(y);
    if (y === y0) ctx.moveTo(x, y - cam);
    else ctx.lineTo(x, y - cam);
  }
  ctx.stroke();
  ctx.restore();
  // twinkles along the line
  const rng = mulberry32(side === -1 ? 11 : 22);
  for (let i = 0; i < 40; i++) {
    const wy = Math.floor(rng() * (walls.height + 1200)) - 400;
    if (!inView(wy, cam)) continue;
    const x = xAt(wy);
    const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.4);
    star4(ctx, x, wy - cam, 4.5, '220,245,255', 0.28 + tw * 0.42);
  }
}

export function caveHitGlow(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const hits = recentHits(world, t, 1.4, 2);
  for (const h of hits) {
    const d = Math.exp(-h.age / 0.7);
    const p = GEM[h.target.col] || GEM[0];
    glowDot(ctx, h.target.x, h.target.y - cam, 330, p.glow, 0.16 * d);
  }
}

// gem target: flat "UFO lens" crystal
export function caveTarget(ctx: CanvasRenderingContext2D, tg: Target, t: number, cam: number) {
  const lit = litOf(tg, t);
  const pal = GEM[tg.col] || GEM[0];
  const s = tg.size;
  const x = tg.x;
  const y = tg.y - cam;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tg.ang * 0.35);
  const rx = 25 * s;
  const ry = 10.5 * s;
  if (lit > 0.02) {
    ctx.shadowColor = `rgba(${pal.glow},${0.95 * lit})`;
    ctx.shadowBlur = 32 * lit;
  }
  // base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, ry + 4, rx * 0.8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const fr = lerp(parseInt(pal.grey.split(',')[0]), parseInt(pal.fill.split(',')[0]), 0.55 + lit * 0.45);
  const fg = lerp(parseInt(pal.grey.split(',')[1]), parseInt(pal.fill.split(',')[1]), 0.55 + lit * 0.45);
  const fb = lerp(parseInt(pal.grey.split(',')[2]), parseInt(pal.fill.split(',')[2]), 0.55 + lit * 0.45);
  // bottom (darker)
  ctx.fillStyle = `rgba(${fr | 0},${fg | 0},${fb | 0},${0.26 + 0.3 * lit})`;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.42, rx, ry * 0.72, 0, 0, Math.PI);
  ctx.fill();
  // top face
  const g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, `rgba(255,255,255,${0.5 + 0.42 * lit})`);
  g.addColorStop(0.7, `rgba(${fr | 0},${fg | 0},${fb | 0},${0.46 + 0.46 * lit})`);
  g.addColorStop(1, `rgba(${fr | 0},${fg | 0},${fb | 0},${0.26 + 0.3 * lit})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${0.46 + 0.46 * lit})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.22 + 0.3 * lit})`;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.28, rx * 0.8, ry * 0.5, 0, 0, Math.PI);
  ctx.stroke();
  if (lit > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * lit})`;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.2, rx * 0.45, ry * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    star4(ctx, 0, -ry * 0.2, 6 * lit + 2, '255,255,255', lit * 0.9);
  }
  ctx.restore();
}

export function caveHitFX(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const hits = recentHits(world, t, 2.6, 3);
  for (const h of hits) {
    const x = h.target.x;
    const y = h.target.y - cam;
    for (let k = 0; k < 2; k++) {
      const age = h.age - k * 0.12;
      if (age < 0) continue;
      const r = 36 + age * 60 + k * 32;
      const a = Math.max(0, (1 - h.age / 2.6) * 0.46 - k * 0.08);
      ctx.strokeStyle = `rgba(228,242,255,${a})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const rng = mulberry32((h.target.t * 977) | 0);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * Math.exp(-h.age / 0.9)})`;
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2;
      const r0 = 10 + rng() * 30;
      const drift = h.age * (10 + rng() * 22);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * (r0 + drift), y + Math.sin(a) * (r0 + drift) * 0.8, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function caveDecor(ctx: CanvasRenderingContext2D, d: Decor, t: number, cam: number, walls: WallData) {
  const y = d.y - cam;
  const sway = Math.sin(t * 0.4 + d.phase) * 0.018;
  const a = ORN_ANCHOR[d.type];
  if (!a) return;
  let x = d.x;
  if (a[3] === 1) {
    // wall-mounted: anchor onto the rock edge on its side
    const ex = d.side === -1 ? edgeAt(walls, walls.left, d.y) : edgeAt(walls, walls.right, d.y);
    x = ex + d.side * 26;
  }
  drawSprite(ctx, d.type, x, y, d.scale * a[2], {
    ax: a[0],
    ay: a[1],
    rot: a[3] === 1 ? 0 : sway,
    flip: a[3] === 1 && d.side === -1,
  });
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, worldY: number, s: number, side: number, t: number, walls: WallData) {
  const ex = side === -1 ? edgeAt(walls, walls.left, worldY) : edgeAt(walls, walls.right, worldY);
  const bx = ex + side * 4;
  ctx.save();
  ctx.translate(bx, y);
  ctx.scale(side === -1 ? 1 : -1, 1);
  ctx.strokeStyle = 'rgba(150,135,110,0.85)';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.lineTo(0, 30 * s);
  ctx.moveTo(0, 30 * s);
  ctx.lineTo(10 * s, 44 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,125,100,0.9)';
  rr(ctx, -5 * s, -16 * s, 12 * s, 50 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,105,85,0.95)';
  ctx.beginPath();
  ctx.moveTo(-9 * s, -30 * s);
  ctx.lineTo(9 * s, -30 * s);
  ctx.lineTo(6 * s, -18 * s);
  ctx.lineTo(-6 * s, -18 * s);
  ctx.closePath();
  ctx.fill();
  const fl = 1 + 0.09 * Math.sin(t * 7.3 + x) + 0.05 * Math.sin(t * 11.7 + x * 2);
  glowDot(ctx, 0, -44 * s, 64 * s * fl, '255,140,50', 0.42);
  glowDot(ctx, 0, -46 * s, 26 * s * fl, '255,160,60', 0.75);
  for (const [r, col, a] of [[17, '255,120,30', 0.95], [11, '255,180,70', 0.95], [5.5, '255,240,190', 1]] as number[][]) {
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath();
    ctx.moveTo(0, -46 * s - r * s * 1.75 * fl);
    ctx.bezierCurveTo(r * s, -46 * s - r * s * 0.4, r * s * 0.7, -46 * s + r * s * 0.6, 0, -46 * s + r * s * 0.7);
    ctx.bezierCurveTo(-r * s * 0.7, -46 * s + r * s * 0.6, -r * s, -46 * s - r * s * 0.4, 0, -46 * s - r * s * 1.75 * fl);
    ctx.fill();
  }
  ctx.restore();
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number, t: number) {
  const top = y - 50 * s;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,220,230,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top - 190 * s);
  ctx.lineTo(x, top);
  ctx.stroke();
  ctx.translate(x, top);
  ctx.rotate(sway);
  ctx.strokeStyle = 'rgba(160,145,120,0.9)';
  ctx.lineWidth = 2.4 * s;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 8 * s + i * 9 * s, 3.2 * s, 5.4 * s, i % 2 ? 0.5 : 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ly = 44 * s;
  const w = 30 * s;
  const h = 36 * s;
  const fl = 0.92 + 0.08 * Math.sin(t * 5.1 + x);
  glowDot(ctx, 0, ly + h * 0.4, 78 * s * fl, '255,170,80', 0.42);
  ctx.fillStyle = 'rgba(20,16,10,0.55)';
  rr(ctx, -w, ly, w * 2, h, 5 * s);
  ctx.fill();
  const g = radial(ctx, 0, ly + h / 2, 2, w, [
    [0, 'rgba(255,205,120,0.95)'],
    [0.7, 'rgba(235,150,60,0.8)'],
    [1, 'rgba(200,110,40,0.6)'],
  ]);
  ctx.fillStyle = g;
  rr(ctx, -w, ly, w * 2, h, 5 * s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,70,45,0.9)';
  ctx.lineWidth = 2.6 * s;
  ctx.strokeRect(-w, ly, w * 2, h);
  ctx.beginPath();
  ctx.moveTo(-w, ly);
  ctx.lineTo(w, ly + h);
  ctx.moveTo(w, ly);
  ctx.lineTo(-w, ly + h);
  ctx.moveTo(0, ly);
  ctx.lineTo(0, ly + h);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(205,170,110,0.95)';
  ctx.lineWidth = 3 * s;
  rr(ctx, -w, ly, w * 2, h, 5 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(205,170,110,0.95)';
  ctx.beginPath();
  ctx.arc(0, ly - 8 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  rr(ctx, -7 * s, ly + h, 14 * s, 6 * s, 2 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4 * s, ly + h + 6 * s);
  ctx.lineTo(4 * s, ly + h + 6 * s);
  ctx.lineTo(0, ly + h + 13 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawChainRings(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  const top = y - 70 * s;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,220,230,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top - 200 * s);
  ctx.lineTo(x, top);
  ctx.stroke();
  ctx.translate(x, top);
  ctx.rotate(sway);
  ctx.strokeStyle = 'rgba(175,158,130,0.9)';
  ctx.lineWidth = 4.2 * s;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 12 * s + i * 15 * s, 4.5 * s, 9 * s, i % 2 ? 0.45 : -0.45, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ry = 12 * s + 6 * 15 * s + 16 * s;
  ctx.lineWidth = 6.5 * s;
  ctx.beginPath();
  ctx.arc(0, ry, 20 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,215,185,0.5)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(0, ry, 22.5 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGargoyle(ctx: CanvasRenderingContext2D, x: number, y: number, worldY: number, s: number, side: number, walls: WallData) {
  const ex = side === -1 ? edgeAt(walls, walls.left, worldY) : edgeAt(walls, walls.right, worldY);
  const bx = ex - side * 46;
  ctx.save();
  ctx.translate(bx, y);
  ctx.scale(side === -1 ? 1 : -1, 1);
  const w = 34 * s;
  const h = 43 * s;
  ctx.fillStyle = 'rgba(148,136,120,0.95)';
  for (const hx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx * w * 0.45, -h * 0.62);
    ctx.quadraticCurveTo(hx * w * 0.95, -h * 1.15, hx * w * 0.62, -h * 1.32);
    ctx.quadraticCurveTo(hx * w * 0.7, -h * 0.95, hx * w * 0.16, -h * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(156,144,128,0.96)';
  ctx.beginPath();
  ctx.moveTo(-w, -h * 0.7);
  ctx.quadraticCurveTo(-w * 1.12, h * 0.2, -w * 0.62, h * 0.9);
  ctx.quadraticCurveTo(0, h * 1.18, w * 0.62, h * 0.9);
  ctx.quadraticCurveTo(w * 1.12, h * 0.2, w, -h * 0.7);
  ctx.quadraticCurveTo(w * 0.5, -h * 0.92, 0, -h * 0.88);
  ctx.quadraticCurveTo(-w * 0.5, -h * 0.92, -w, -h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(110,100,88,0.9)';
  rr(ctx, -w * 0.78, -h * 0.42, w * 1.56, h * 0.2, h * 0.08);
  ctx.fill();
  for (const exo of [-1, 1]) {
    ctx.fillStyle = 'rgba(30,26,22,0.95)';
    ctx.beginPath();
    ctx.ellipse(exo * w * 0.42, -h * 0.18, w * 0.24, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    glowDot(ctx, exo * w * 0.42, -h * 0.18, 5 * s, '255,190,120', 0.35);
  }
  ctx.fillStyle = 'rgba(120,110,96,0.9)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, -h * 0.05);
  ctx.lineTo(w * 0.14, -h * 0.05);
  ctx.lineTo(0, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,35,30,0.9)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.5);
  ctx.quadraticCurveTo(0, h * 0.32, w * 0.5, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,26,22,0.85)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * w * 0.2 - w * 0.055, h * 0.38, w * 0.11, h * 0.12);
  }
  ctx.strokeStyle = 'rgba(70,62,52,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.8);
  ctx.lineTo(-w * 0.2, -h * 0.4);
  ctx.lineTo(-w * 0.34, -h * 0.1);
  ctx.moveTo(w * 0.4, h * 0.7);
  ctx.lineTo(w * 0.3, h * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawMushrooms(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, t: number) {
  const shelfY = y + 52 * s;
  ctx.fillStyle = 'rgba(96,104,118,0.9)';
  rr(ctx, x - 56 * s, shelfY, 112 * s, 9 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,46,58,0.9)';
  rr(ctx, x - 56 * s, shelfY + 5 * s, 112 * s, 4 * s, 2 * s);
  ctx.fill();
  const rng = mulberry32(seed);
  const pulse = 0.9 + 0.1 * Math.sin(t * 1.7 + x);
  glowDot(ctx, x, shelfY - 30 * s, 84 * s * pulse, '255,170,80', 0.34);
  const caps: number[][] = [
    [-16, -34, 17],
    [14, -44, 21],
    [26, -22, 13],
  ];
  caps.forEach((c) => {
    const cx2 = x + c[0] * s + (rng() - 0.5) * 8 * s;
    const cy2 = shelfY + c[1] * s;
    const cr = c[2] * s;
    ctx.strokeStyle = 'rgba(226,214,190,0.85)';
    ctx.lineWidth = 5.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx2, shelfY - 2 * s);
    ctx.quadraticCurveTo(cx2 - 2 * s, cy2 + cr * 0.6, cx2, cy2 + cr * 0.2);
    ctx.stroke();
    const g = radial(ctx, cx2 - cr * 0.3, cy2 - cr * 0.4, 2, cr * 1.5, [
      [0, 'rgba(255,220,160,0.98)'],
      [0.6, 'rgba(245,160,80,0.95)'],
      [1, 'rgba(200,110,50,0.9)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cr, cr * 0.78, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(cx2, cy2, cr, cr * 0.3, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,35,0.6)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx2 + i * cr * 0.3, cy2 + cr * 0.05);
      ctx.lineTo(cx2 + i * cr * 0.16, cy2 + cr * 0.24);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,240,210,0.7)';
    ctx.beginPath();
    ctx.arc(cx2 - cr * 0.3, cy2 - cr * 0.35, 1.6 * s, 0, Math.PI * 2);
    ctx.arc(cx2 + cr * 0.25, cy2 - cr * 0.5, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPickaxe(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.62);
  // handle
  ctx.strokeStyle = 'rgba(168,136,94,0.95)';
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 88 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,95,62,0.8)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-3 * s, i * 14 * s);
    ctx.lineTo(3 * s, i * 14 * s + 4 * s);
    ctx.stroke();
  }
  // pick head: filled crescent across the handle top
  ctx.fillStyle = 'rgba(200,188,160,0.95)';
  ctx.beginPath();
  ctx.moveTo(-38 * s, -18 * s);
  ctx.quadraticCurveTo(0, -46 * s, 38 * s, -18 * s);
  ctx.quadraticCurveTo(0, -26 * s, -38 * s, -18 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,110,92,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(150,138,114,0.95)';
  rr(ctx, -5 * s, -26 * s, 10 * s, 16 * s, 3 * s);
  ctx.fill();
  ctx.restore();
}

// ---------- finale ----------

export function caveFinale(ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) {
  const f = world.finale;
  const shelfY = f.shelfY - cam;
  if (shelfY < -420 || shelfY > H + 720) return;
  const entry = world.entryT;
  const light = t < entry ? 0.12 : clamp(0.72 + 0.28 * Math.exp(-(t - entry) / 0.5), 0, 1);
  const chimeBump = world.chimes.reduce((acc, c) => acc + Math.exp(-Math.max(0, t - c) / 0.4) * (t >= c ? 0.16 : 0), 0);

  glowDot(ctx, f.mouth.x, shelfY, 260, '255,190,90', 0.3 * light + chimeBump * 0.4);

  // chest group sprite (shelf + open chest + gold): shelf line at ay 0.92,
  // chest opening at ax 0.46, ~143px above the shelf line
  const mx = f.mouth.x;
  drawSprite(ctx, 'c_chest', mx, shelfY, 1, { ax: 0.46, ay: 0.92 });
  const openY = shelfY - 143;

  // crown pedestal + crown sprite on the right
  const crownX = mx + 345;
  drawPedestal(ctx, crownX, shelfY, 138);
  drawSprite(ctx, 'c_crown', crownX, shelfY - 8, 1, { ax: 0.5, ay: 0.82 });

  // ripples: chest (gold) + crown (purple) + final gold
  const rippleSets: number[][] = [
    [world.ripples[0], 0],
    [world.ripples[1], 1],
    [world.ripples[2] ?? world.ripples[0], 0],
  ];
  for (const [tr, which] of rippleSets) {
    if (!tr) continue;
    const col = which === 1 ? '190,150,245' : '232,200,138';
    const cxx = which === 1 ? crownX : mx;
    const cyy = which === 1 ? shelfY - 30 : openY;
    for (let k = 0; k < 2; k++) {
      const age = t - tr - k * 0.5;
      if (age <= 0) continue;
      const rad = 30 + age * 82 - k * 26;
      if (rad <= 30) continue;
      const a = Math.max(0, (1 - age / 3.6) * 0.45 - k * 0.1);
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(${col},${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cxx, cyy, rad, rad * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (t > entry + 0.3) {
    const rng2 = mulberry32(31);
    for (let i = 0; i < 8; i++) {
      const u = rng2();
      const life = ((t - entry) * (0.4 + u * 0.35) + u * 3.4) % 3.4;
      const a = Math.sin((life / 3.4) * Math.PI) * 0.7;
      star4(ctx, mx + (u - 0.5) * 160, openY - 20 - life * 44, 5 + u * 4, '255,225,150', a);
    }
  }
}

function drawPedestal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(88,96,112,0.95)';
  rr(ctx, x - w / 2, y, w, 12, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,46,60,0.95)';
  rr(ctx, x - w / 2, y + 7, w, 5, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, w * 0.42, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glow: number) {
  ctx.save();
  ctx.translate(x, y);
  glowDot(ctx, 0, -20 * s, 74 * s, '170,120,255', 0.35 * glow + 0.15);
  const w = 36 * s;
  const h = 36 * s;
  ctx.fillStyle = 'rgba(60,50,90,0.9)';
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  for (let i = 0; i < 5; i++) {
    const px = -w + (i / 4) * w * 2;
    ctx.lineTo(px + w * 0.2, -h * (i === 2 ? 1.25 : 0.75));
    ctx.lineTo(px + w * 0.4, 0);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,184,104,0.95)';
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();
  const cols = ['150,90,250', '200,120,255', '150,90,250', '200,120,255', '150,90,250'];
  for (let i = 0; i < 5; i++) {
    const px = -w + (i / 4) * w * 2 + w * 0.2;
    const py = -h * (i === 2 ? 1.25 : 0.75) * 0.6;
    ctx.fillStyle = `rgba(${cols[i]},0.95)`;
    ctx.beginPath();
    ctx.arc(px, py, 3.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(216,184,104,0.9)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(w, 0);
  ctx.stroke();
  ctx.restore();
}

// ---------- ball ----------

export function caveBall(ctx: CanvasRenderingContext2D, p: Vec, alpha: number, ghost: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!ghost) {
    ctx.shadowColor = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = '#181b22';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12.5, 0, Math.PI * 2);
  ctx.stroke();
  if (!ghost) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8.6, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

export function caveOverlay(ctx: CanvasRenderingContext2D, t: number, dur: number) {
  const g = radial(ctx, 360, 640, 360, 740, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.4)'],
  ]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, H);
  if (t < 0.45) {
    ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.45})`;
    ctx.fillRect(0, 0, 720, H);
  }
  if (t > dur - 0.55) {
    ctx.fillStyle = `rgba(0,0,0,${clamp((t - (dur - 0.55)) / 0.55, 0, 0.5)})`;
    ctx.fillRect(0, 0, 720, H);
  }
}
