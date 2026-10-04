// REEL RUSH — ambient world rendering: sky, celestial bodies, sea, underwater life
// (incl. the abyss monster easter egg), pier, angler, line + bobber.
// Pure draw functions over (ctx, ...); Scene-owned mutable state arrives as `sc`
// (stars/clouds/bubbles/ambientFish/monster/monsterT — still constructed in scenes.js).
import { W, H, WATER_Y, DAY_LEN, CYCLE, FIGHT } from '../config.js';
import { drawFishShape } from './fishdraw.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixColor(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${(lerp(A[0], B[0], k)) | 0},${(lerp(A[1], B[1], k)) | 0},${(lerp(A[2], B[2], k)) | 0})`;
}

// silhouette-only descriptor for the abyss easter egg
const ABYSS_MONSTER = { shape: 'long', color1: '#000814', color2: '#000814' };

export function newBubble(anyY = false) {
  return { x: Math.random() * W, y: anyY ? WATER_Y + Math.random() * (H - WATER_Y) : H + 10, v: 18 + Math.random() * 30, r: 1 + Math.random() * 2.6, wob: Math.random() * TAU };
}

// ---------- sky ----------
export function drawSky(ctx, sc, zone, night, t, dt) {
  const grd = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  grd.addColorStop(0, mixColor(zone.sky[0], '#0a1230', night * zone.night));
  grd.addColorStop(0.55, mixColor(zone.sky[1], '#0d1838', night * zone.night));
  grd.addColorStop(1, mixColor(zone.sky[2], '#16224a', night * zone.night));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, WATER_Y);

  if (night > 0.05) {
    for (const s of sc.stars) {
      const a = night * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.tw)));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfeaff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // clouds
  for (const c of sc.clouds) {
    c.x += c.v * dt;
    if (c.x > W + 160) c.x = -160;
    ctx.globalAlpha = 0.75 - night * 0.45;
    ctx.fillStyle = mixColor('#ffffff', '#26325a', night);
    puff(ctx, c.x, c.y, c.s);
    ctx.globalAlpha = 1;
  }
}
function puff(ctx, x, y, s) {
  ctx.beginPath();
  ctx.ellipse(x, y, 44 * s, 15 * s, 0, 0, TAU);
  ctx.ellipse(x - 30 * s, y + 5 * s, 26 * s, 11 * s, 0, 0, TAU);
  ctx.ellipse(x + 34 * s, y + 4 * s, 30 * s, 12 * s, 0, 0, TAU);
  ctx.ellipse(x + 6 * s, y - 10 * s, 24 * s, 13 * s, 0, 0, TAU);
  ctx.fill();
}
export function drawCelestial(ctx, night, t) {
  const p = (t % CYCLE) / CYCLE;
  const dayP = clamp((t % CYCLE) / DAY_LEN, 0, 1);
  // sun arc during day
  if (night < 1) {
    const a = Math.PI - dayP * Math.PI;
    const x = W / 2 + Math.cos(a) * (W / 2 - 90);
    const y = WATER_Y - 60 - Math.sin(a) * 240;
    const gx = clamp(x, 40, W - 40), gy = clamp(y, 50, WATER_Y - 20);
    const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, 90);
    g.addColorStop(0, 'rgba(255,240,180,0.9)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.globalAlpha = 1 - night;
    ctx.fillStyle = g; ctx.fillRect(gx - 100, gy - 100, 200, 200);
    ctx.fillStyle = '#ffedb0';
    ctx.beginPath(); ctx.arc(gx, gy, 26, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // moon at night
  if (night > 0) {
    const nightP = clamp(((t % CYCLE) - DAY_LEN) / (CYCLE - DAY_LEN), 0, 1);
    const a = Math.PI - nightP * Math.PI;
    const mx = clamp(W / 2 + Math.cos(a) * (W / 2 - 90), 40, W - 40);
    const my = clamp(WATER_Y - 50 - Math.sin(a) * 220, 50, WATER_Y - 20);
    ctx.globalAlpha = night;
    const g = ctx.createRadialGradient(mx, my, 4, mx, my, 80);
    g.addColorStop(0, 'rgba(210,230,255,0.5)');
    g.addColorStop(1, 'rgba(210,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = '#e8efff';
    ctx.beginPath(); ctx.arc(mx, my, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,180,220,0.5)';
    ctx.beginPath(); ctx.arc(mx - 6, my - 4, 4, 0, TAU); ctx.arc(mx + 7, my + 6, 3, 0, TAU); ctx.arc(mx + 2, my - 9, 2.4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- sea ----------
export function drawSea(ctx, zone, night, t) {
  const grd = ctx.createLinearGradient(0, WATER_Y, 0, H);
  grd.addColorStop(0, mixColor(zone.sea[0], '#0a1e33', night * zone.night));
  grd.addColorStop(0.4, mixColor(zone.sea[1], '#071527', night * zone.night));
  grd.addColorStop(1, mixColor(zone.sea[2], '#040d1a', night * zone.night));
  ctx.fillStyle = grd;
  ctx.fillRect(0, WATER_Y, W, H - WATER_Y);

  // surface highlight waves
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${(0.32 - i * 0.09) * (1 - night * 0.55)})`;
    ctx.beginPath();
    const yy = WATER_Y + 3 + i * 9;
    for (let x = 0; x <= W; x += 26) {
      const y = yy + Math.sin(x * 0.02 + t * (1.4 + i * 0.35) + i * 2) * (3 - i * 0.7);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // sun/moon glitter path
  for (let i = 0; i < 24; i++) {
    const px = W / 2 + Math.sin(i * 7.3 + t * 0.8) * (30 + i * 8);
    const py = WATER_Y + 8 + i * 9;
    const w = 14 + Math.sin(i * 3.1 + t * 2) * 8;
    ctx.fillStyle = night > 0.5 ? '#bcd2ff' : '#fff2c0';
    ctx.globalAlpha = 0.14 + 0.1 * Math.sin(i + t * 3);
    ctx.fillRect(px - w / 2, py, w, 2);
  }
  ctx.globalAlpha = 1;
}

export function drawUnderwater(ctx, sc, zone, night, t, g, dt) {
  // light shafts (day)
  if (night < 0.7) {
    ctx.globalAlpha = 0.07 * (1 - night);
    ctx.fillStyle = '#cfeaff';
    for (let i = 0; i < 5; i++) {
      const sx = ((i * 307 + t * 6) % (W + 300)) - 150;
      ctx.beginPath();
      ctx.moveTo(sx, WATER_Y);
      ctx.lineTo(sx + 70, WATER_Y);
      ctx.lineTo(sx + 150, H);
      ctx.lineTo(sx - 10, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // abyss bioluminescent plankton
  if (zone.id === 'abyss') {
    for (let i = 0; i < 40; i++) {
      const px = (i * 173.3 + Math.sin(t * 0.5 + i) * 24) % W;
      const py = WATER_Y + 40 + ((i * 97.7) % (H - WATER_Y - 60)) + Math.sin(t * 0.9 + i * 2) * 8;
      const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.4 + i * 1.7));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 5 === 0 ? '#7ef0ff' : '#4d8dff';
      ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 3), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // THE MONSTER (DREDGE-style dread easter egg)
    sc.monsterT -= dt;
    if (sc.monsterT <= 0 && !sc.monster) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      sc.monster = { x: dir > 0 ? -400 : W + 400, v: dir * 60, y: H - 150 - Math.random() * 60 };
    }
    if (sc.monster) {
      sc.monster.x += sc.monster.v * dt;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#000814';
      drawFishShape(ctx, ABYSS_MONSTER, sc.monster.x, sc.monster.y + Math.sin(t) * 10, 380, sc.monster.v > 0 ? 1 : -1, true);
      ctx.globalAlpha = 1;
      if (sc.monster.x < -500 || sc.monster.x > W + 500) { sc.monster = null; sc.monsterT = 45 + Math.random() * 50; }
    }
  }
  // ambient bubbles
  for (const b of sc.bubbles) {
    b.y -= b.v * dt;
    b.x += Math.sin(t * 2 + b.wob) * 0.2;
    if (b.y < WATER_Y + 6) Object.assign(b, newBubble(false));
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // boids school: separation / alignment / cohesion + wander (O(n²), n=16 — fine)
  const F2 = sc.ambientFish;
  for (let i = 0; i < F2.length; i++) {
    const b = F2[i];
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
    for (let j = 0; j < F2.length; j++) {
      if (j === i) continue;
      const o = F2[j];
      const dx = o.x - b.x, dy = o.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 3600 || d2 < 1) continue; // neighbours within 60px
      n++;
      ax += o.vx; ay += o.vy;
      cx += o.x; cy += o.y;
      if (d2 < 400) { sx -= dx; sy -= dy; } // separate within 20px
    }
    if (n > 0) {
      b.vx += (sx * 2.2 + (ax / n - b.vx) * 0.8 + (cx / n - b.x) * 0.15) * dt * 3;
      b.vy += (sy * 2.2 + (ay / n - b.vy) * 0.8 + (cy / n - b.y) * 0.15) * dt * 3;
    }
    // wander + soft bounds
    b.vx += Math.sin(t * 0.7 + b.wob) * 6 * dt;
    b.vy += Math.cos(t * 0.5 + b.wob) * 3 * dt;
    if (b.x < 60) b.vx += 30 * dt; if (b.x > W - 60) b.vx -= 30 * dt;
    if (b.y < WATER_Y + 30) b.vy += 30 * dt; if (b.y > H - 40) b.vy -= 30 * dt;
    // speed clamp (cruise..max)
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tgt = 18 + b.s * 40;
    if (sp > tgt) { b.vx *= tgt / sp; b.vy *= tgt / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // draw: ellipse body angled to velocity
    const ang = Math.atan2(b.vy, b.vx);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#0c2334';
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(t * 2 + b.wob) * 2);
    ctx.rotate(ang);
    const sz = 14 * b.s;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz, sz * 0.32, 0, 0, TAU);
    ctx.moveTo(-sz, 0);
    ctx.lineTo(-sz * 1.5, -sz * 0.36);
    ctx.lineTo(-sz * 1.5, sz * 0.36);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // seabed
  ctx.fillStyle = mixColor('#123244', '#040a12', night * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 60) ctx.lineTo(x, H - 26 - Math.sin(x * 0.01) * 12);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // seaweed
  ctx.strokeStyle = mixColor('#1d5a44', '#07201c', night * 0.7);
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const sx = 80 + i * 130;
    const sw = Math.sin(t * 1.2 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(sx, H - 18);
    ctx.quadraticCurveTo(sx + sw, H - 55, sx + sw * 1.8, H - 92 - (i % 3) * 14);
    ctx.stroke();
  }
  // fighting fish shadow
  if (g.fg.state === 'fight' && g.fg.fish) {
    const fg = g.fg, fish = fg.fish;
    const fx = fg.bobber.x + Math.sin(fg.t * 2.4) * 46;
    const fy = WATER_Y + 60 + Math.cos(fg.t * 1.8) * 22;
    const s = 0.8 * fish.scale + 0.4;
    ctx.globalAlpha = 0.3 + (fg.fight.surging ? 0.15 : 0);
    ctx.fillStyle = '#04101c';
    drawFishShape(ctx, fish, fx, fy, 46 * s, Math.cos(fg.t * 2.4) > 0 ? 1 : -1, true);
    ctx.globalAlpha = 1;
  }
}

// ---------- pier + angler ----------
export function drawPier(ctx, zone, night) {
  const deckY = 330;
  // posts
  ctx.fillStyle = '#3a2c1e';
  for (const px of [60, 150, 240]) {
    ctx.fillRect(px, deckY, 16, WATER_Y - deckY + 16);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (const px of [60, 150, 240]) ctx.fillRect(px + 10, deckY, 6, WATER_Y - deckY + 16);
  // deck
  const grd = ctx.createLinearGradient(0, deckY - 14, 0, deckY + 12);
  grd.addColorStop(0, mixColor('#8a6a44', '#4a3a28', night * 0.6));
  grd.addColorStop(1, mixColor('#6a4e30', '#332417', night * 0.6));
  ctx.fillStyle = grd;
  ctx.fillRect(-10, deckY - 12, 320, 24);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
  for (let x = 0; x < 310; x += 34) { ctx.beginPath(); ctx.moveTo(x, deckY - 12); ctx.lineTo(x, deckY + 12); ctx.stroke(); }
  // lantern at night
  if (night > 0.3) {
    const lx = 268, ly = deckY - 46;
    ctx.strokeStyle = '#2c2118'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(lx, deckY - 12); ctx.lineTo(lx, ly - 14); ctx.stroke();
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
    g.addColorStop(0, `rgba(255,200,110,${0.5 * night})`);
    g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 70, ly - 70, 140, 140);
    ctx.fillStyle = '#ffd98a';
    ctx.globalAlpha = night;
    ctx.beginPath(); ctx.arc(lx, ly, 7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawAngler(ctx, g, night) {
  const fg = g.fg;
  const px = 170, py = 318; // feet position on deck
  const skin = '#e8b88a', vest = mixColor('#2e6e4e', '#1d4432', night * 0.4), pants = '#3a4a5e', hat = '#c8a23c';
  // legs
  ctx.strokeStyle = pants; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px - 6, py - 30); ctx.lineTo(px - 10, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px + 6, py - 30); ctx.lineTo(px + 12, py); ctx.stroke();
  // body
  ctx.fillStyle = vest;
  ctx.beginPath(); ctx.ellipse(px, py - 44, 15, 20, 0, 0, TAU); ctx.fill();
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(px, py - 74, 11, 0, TAU); ctx.fill();
  // bucket hat
  ctx.fillStyle = hat;
  ctx.beginPath(); ctx.ellipse(px, py - 80, 15, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(px, py - 82, 9, Math.PI, 0); ctx.fill();
  // arms toward rod
  const tensionK = fg.state === 'fight' ? fg.fight.tension / 100 : 0;
  const rodBaseX = px + 14, rodBaseY = py - 52;
  ctx.strokeStyle = skin; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(px, py - 50); ctx.lineTo(rodBaseX - 4, rodBaseY + 4); ctx.stroke();
  // rod: bends with tension
  const tipX = rodBaseX + 150 - tensionK * 26, tipY = rodBaseY - 96 + tensionK * 42;
  ctx.strokeStyle = '#241a10'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(rodBaseX, rodBaseY);
  ctx.quadraticCurveTo(rodBaseX + 90 - tensionK * 12, rodBaseY - 70 + tensionK * 26, tipX, tipY);
  ctx.stroke();
  // reel
  ctx.fillStyle = '#5a6a7a';
  ctx.beginPath(); ctx.arc(rodBaseX + 26, rodBaseY - 10, 6, 0, TAU); ctx.fill();
  fg.rodTip = { x: tipX, y: tipY };
}

export function drawLineAndBobber(ctx, g) {
  const fg = g.fg;
  if (fg.state === 'idle' || !fg.rodTip) return;
  const b = fg.bobber;
  const strain = fg.state === 'fight' ? fg.fight.tension / 100 : 0;
  // line sags when slack, snaps taut when strained
  const sag = fg.state === 'fight' ? lerp(60, 4, strain) : 60;
  const red = strain > FIGHT.greenHigh / 100;
  ctx.strokeStyle = red ? `rgba(255,120,120,${0.7 + 0.3 * Math.sin(fg.t * 30)})` : 'rgba(240,248,255,0.75)';
  ctx.lineWidth = red ? 2.4 : 1.6;
  ctx.beginPath();
  ctx.moveTo(fg.rodTip.x, fg.rodTip.y);
  ctx.quadraticCurveTo((fg.rodTip.x + b.x) / 2, Math.min(fg.rodTip.y, b.y) + sag, b.x, b.y - 10);
  ctx.stroke();
  // bobber
  const bob = fg.state === 'bobbing' ? Math.sin(fg.t * 4) * 1.5 : 0;
  ctx.fillStyle = '#f5f0e6';
  ctx.beginPath(); ctx.ellipse(b.x, b.y + bob, 7, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e64545';
  ctx.beginPath(); ctx.ellipse(b.x, b.y + bob - 3, 7, 6, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#e64545'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(b.x, b.y + bob - 9); ctx.lineTo(b.x, b.y + bob - 15); ctx.stroke();
  if (fg.state === 'strike') {
    // "!" telegraph, pulsing
    const k = 1 + Math.sin(fg.t * 22) * 0.15;
    ctx.save();
    ctx.translate(b.x, b.y - 46); ctx.scale(k, k);
    ctx.font = '900 44px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(6,20,32,0.9)';
    ctx.strokeText('!', 0, 0);
    ctx.fillStyle = '#ffd54a';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }
}
