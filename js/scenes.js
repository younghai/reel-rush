// REEL RUSH — world renderer: sky/day-night/sea/pier/angler + fight UI + reveal card
import { W, H, DAY_LEN, CYCLE, FIGHT, DEPTH_BANDS, RARITIES, WATER_Y } from './config.js';
import { t, fishName, rarityName } from './i18n.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// silhouette-only descriptor for the abyss easter egg
const ABYSS_MONSTER = { shape: 'long', color1: '#000814', color2: '#000814' };

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixColor(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${(lerp(A[0], B[0], k)) | 0},${(lerp(A[1], B[1], k)) | 0},${(lerp(A[2], B[2], k)) | 0})`;
}


export class Scene {
  constructor() {
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * WATER_Y * 0.9, r: Math.random() * 1.4 + 0.4, tw: Math.random() * TAU }));
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: 40 + Math.random() * 130, s: 0.6 + Math.random() * 0.9, v: 4 + Math.random() * 7 }));
    this.bubbles = Array.from({ length: 26 }, () => this.#newBubble(true));
    this.ambientFish = Array.from({ length: 7 }, () => ({
      x: Math.random() * W, y: WATER_Y + 60 + Math.random() * 220, v: 12 + Math.random() * 26, s: 0.35 + Math.random() * 0.5, flip: Math.random() < 0.5, wob: Math.random() * TAU,
    }));
    this.worldT = 0;
    this.monsterT = 30 + Math.random() * 40; // abyss easter-egg timer
    this.monster = null;
  }
  #newBubble(anyY = false) {
    return { x: Math.random() * W, y: anyY ? WATER_Y + Math.random() * (H - WATER_Y) : H + 10, v: 18 + Math.random() * 30, r: 1 + Math.random() * 2.6, wob: Math.random() * TAU };
  }

  // amount of night: 0 day, 1 night, smooth over transitions
  nightAmount(t) {
    const p = t % CYCLE;
    const edge = 10; // sec fade
    if (p < DAY_LEN - edge) return 0;
    if (p < DAY_LEN) return (p - (DAY_LEN - edge)) / edge;
    if (p < CYCLE - edge) return 1;
    return 1 - (p - (CYCLE - edge)) / edge;
  }
  isNight(t) { return (t % CYCLE) > DAY_LEN; }

  draw(ctx, g, dt) {
    // g: { fg, juice, economy, zone, t }
    this.worldT += dt;
    const night = this.nightAmount(this.worldT);
    const zone = g.zone;
    const t = this.worldT;

    this.#sky(ctx, zone, night, t, dt);
    this.#celestial(ctx, night, t);
    this.#sea(ctx, zone, night, t);
    this.#underwater(ctx, zone, night, t, g, dt);
    this.#pier(ctx, zone, night);
    this.#angler(ctx, g, night);
    this.#lineAndBobber(ctx, g);
    if (g.fg.state === 'casting') this.#powerMeter(ctx, g.fg);
    if (g.fg.state === 'strike') this.#strikeUI(ctx, g.fg);
    if (g.fg.state === 'fight') this.#fightUI(ctx, g.fg);
    if (g.fg.state === 'reveal') this.#revealCard(ctx, g.fg);
  }

  // ---------- sky ----------
  #sky(ctx, zone, night, t, dt) {
    const grd = ctx.createLinearGradient(0, 0, 0, WATER_Y);
    grd.addColorStop(0, mixColor(zone.sky[0], '#0a1230', night * zone.night));
    grd.addColorStop(0.55, mixColor(zone.sky[1], '#0d1838', night * zone.night));
    grd.addColorStop(1, mixColor(zone.sky[2], '#16224a', night * zone.night));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, WATER_Y);

    if (night > 0.05) {
      for (const s of this.stars) {
        const a = night * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.tw)));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#dfeaff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // clouds
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > W + 160) c.x = -160;
      ctx.globalAlpha = 0.75 - night * 0.45;
      ctx.fillStyle = mixColor('#ffffff', '#26325a', night);
      this.#puff(ctx, c.x, c.y, c.s);
      ctx.globalAlpha = 1;
    }
  }
  #puff(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, 44 * s, 15 * s, 0, 0, TAU);
    ctx.ellipse(x - 30 * s, y + 5 * s, 26 * s, 11 * s, 0, 0, TAU);
    ctx.ellipse(x + 34 * s, y + 4 * s, 30 * s, 12 * s, 0, 0, TAU);
    ctx.ellipse(x + 6 * s, y - 10 * s, 24 * s, 13 * s, 0, 0, TAU);
    ctx.fill();
  }
  #celestial(ctx, night, t) {
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
  #sea(ctx, zone, night, t) {
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

  #underwater(ctx, zone, night, t, g, dt) {
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
      this.monsterT -= dt;
      if (this.monsterT <= 0 && !this.monster) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.monster = { x: dir > 0 ? -400 : W + 400, v: dir * 60, y: H - 150 - Math.random() * 60 };
      }
      if (this.monster) {
        this.monster.x += this.monster.v * dt;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#000814';
        this._drawFishShape(ctx, ABYSS_MONSTER, this.monster.x, this.monster.y + Math.sin(t) * 10, 380, this.monster.v > 0 ? 1 : -1, true);
        ctx.globalAlpha = 1;
        if (this.monster.x < -500 || this.monster.x > W + 500) { this.monster = null; this.monsterT = 45 + Math.random() * 50; }
      }
    }
    // ambient bubbles
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      b.x += Math.sin(t * 2 + b.wob) * 0.2;
      if (b.y < WATER_Y + 6) Object.assign(b, this.#newBubble(false));
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // ambient fish school
    for (const f of this.ambientFish) {
      f.x += (f.flip ? f.v : -f.v) * dt;
      if (f.x < -60) { f.x = W + 50; f.y = WATER_Y + 60 + Math.random() * 220; }
      if (f.x > W + 60) { f.x = -50; f.y = WATER_Y + 60 + Math.random() * 220; }
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#0c2334';
      const s = f.s;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + Math.sin(t * 2 + f.wob) * 3, 14 * s, 4.5 * s, 0, 0, TAU);
      ctx.moveTo(f.x + (f.flip ? -14 * s : 14 * s), f.y);
      ctx.lineTo(f.x + (f.flip ? -22 * s : 22 * s), f.y - 5 * s);
      ctx.lineTo(f.x + (f.flip ? -22 * s : 22 * s), f.y + 5 * s);
      ctx.fill();
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
      this._drawFishShape(ctx, fish, fx, fy, 46 * s, Math.cos(fg.t * 2.4) > 0 ? 1 : -1, true);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- pier + angler ----------
  #pier(ctx, zone, night) {
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

  #angler(ctx, g, night) {
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

  #lineAndBobber(ctx, g) {
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

  #powerMeter(ctx, fg) {
    const x = 250, y = 210, w = 150, h = 16;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(6,20,32,0.75)';
    ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 10); ctx.fill();
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, '#4db8ff'); grd.addColorStop(0.6, '#59d97e'); grd.addColorStop(1, '#ffd54a');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w * fg.cast.power, h);
    ctx.fillStyle = '#fff';
    ctx.font = '800 13px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('scene.powerClick'), x + w / 2, y - 12);
    // depth band hint
    const p = fg.cast.power;
    const bands = DEPTH_BANDS;
    const band = bands.find(b => p >= b.from && (p <= b.to || b === bands[bands.length - 1]));
    if (band) {
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      ctx.font = '700 12px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
      ctx.fillText(t('scene.depth', { band: t('depth.' + band.id) }), x + w / 2, y + h + 18);
    }
  }

  #strikeUI(ctx, fg) {
    const s = fg.strike;
    const frac = clamp(s.t / s.window, 0, 1);
    const x = fg.bobber.x, y = fg.bobber.y + 34, w = 90;
    ctx.fillStyle = 'rgba(6,20,32,0.75)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 8, 4); ctx.fill();
    // perfect zone
    ctx.fillStyle = 'rgba(89,217,126,0.85)';
    ctx.fillRect(x - w / 2, y, w * s.perfectFrac, 8);
    // shrinking marker
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - w / 2 + w * frac - 1.5, y - 3, 3, 14);
  }

  #fightUI(ctx, fg) {
    const F = FIGHT, st = fg.fight;
    const cx = W / 2, w = 420;
    // progress bar
    const py = 596, ph = 14;
    ctx.fillStyle = 'rgba(6,20,32,0.8)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2, py, w, ph, 7); ctx.fill();
    const pgrd = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    pgrd.addColorStop(0, '#2a8fd8'); pgrd.addColorStop(1, '#4dd8e8');
    ctx.fillStyle = pgrd;
    if (st.progress > 1) { ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2, py + 2, (w - 4) * clamp(st.progress / 100, 0, 1), ph - 4, 5); ctx.fill(); }
    // fish marker sliding with progress
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐟', cx - w / 2 + 6 + (w - 12) * clamp(st.progress / 100, 0, 1), py + ph - 1);
    if (fg.fish?.boss) {
      ctx.strokeStyle = `rgba(255,93,158,${0.5 + 0.4 * Math.sin(fg.t * 6)})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - w / 2 - 4, py - 4, w + 8, ph + 8);
    }
    // tension bar
    const ty = 622, th = 22;
    ctx.fillStyle = 'rgba(6,20,32,0.8)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2, ty, w, th, 8); ctx.fill();
    // safe band with diagonal hatch (colorblind-safe safe-zone cue, not color-only)
    const gx = cx - w / 2 + w * (F.greenLow / 100), gw = w * ((F.greenHigh - F.greenLow) / 100);
    ctx.save();
    ctx.beginPath(); ctx.rect(gx, ty + 2, gw, th - 4); ctx.clip();
    ctx.fillStyle = 'rgba(89,217,126,0.35)';
    ctx.fillRect(gx, ty + 2, gw, th - 4);
    ctx.strokeStyle = 'rgba(16,56,32,0.85)'; ctx.lineWidth = 3;
    for (let hx = gx - th; hx < gx + gw + th; hx += 9) {
      ctx.beginPath(); ctx.moveTo(hx, ty + th); ctx.lineTo(hx + th, ty); ctx.stroke();
    }
    ctx.restore();
    // boundary ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    for (const bx of [gx, gx + gw]) {
      ctx.beginPath(); ctx.moveTo(bx, ty - 4); ctx.lineTo(bx, ty + th + 4); ctx.stroke();
    }
    // red zone fill from strain
    if (st.strain > 0) {
      const limit = F.strainBase + fg.economy.upgrades.line * 0.45;
      ctx.fillStyle = 'rgba(255,93,93,0.75)';
      ctx.fillRect(cx - w / 2, ty + th - 3, w * clamp(st.strain / limit, 0, 1), 3);
    }
    // tension fill
    const tk = st.tension / 100;
    const col = tk <= F.greenHigh / 100 ? '#59d97e' : (tk < 0.92 ? '#ffd54a' : '#ff5d5d');
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2, ty + 2, (w - 4) * tk, th - 4, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - w / 2 + w * tk, ty); ctx.lineTo(cx - w / 2 + w * tk, ty + th); ctx.stroke();
    // danger glyph above the band (colorblind: shape + blink cue)
    if (tk * 100 > F.greenHigh) {
      ctx.font = '900 17px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(fg.t * 18);
      ctx.fillText('⚠', cx - w / 2 + w * tk + 12, ty + th / 2);
      ctx.globalAlpha = 1;
    }
    // labels
    ctx.fillStyle = 'rgba(220,240,255,0.9)';
    ctx.font = '800 13px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fg.fish ? `${fg.fish.boss ? '👑 ' : ''}${fishName(fg.fish)} ${t('scene.fightHelp')}` : '', cx, ty - 44);
    ctx.fillStyle = st.tension > F.greenHigh ? '#ff8a8a' : 'rgba(220,240,255,0.6)';
    ctx.font = '700 11px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.fillText(t('scene.tension'), cx, ty + th + 16);
    // stamina pips
    if (fg.fish) {
      const sk = clamp(st.stamina / fg.fish.stamina, 0, 1);
      ctx.fillStyle = 'rgba(255,180,80,0.9)';
      ctx.fillRect(cx - w / 2, ty - 10, w * sk, 4);
    }
  }

  #revealCard(ctx, fg) {
    const r = fg.reveal;
    if (!r) return;
    const R = RARITIES[r.fish.rarity];
    const t = r.t;
    // dark overlay
    ctx.fillStyle = `rgba(4,14,24,${clamp(t * 2, 0, 0.55)})`;
    ctx.fillRect(0, 0, W, H);
    // card flip-in with overshoot
    const k = clamp(t / 0.5, 0, 1);
    const ease = 1 - Math.pow(1 - k, 3);
    const scale = 0.6 + ease * 0.5 + (k >= 1 ? Math.sin((t - 0.5) * 8) * 0.02 : 0);
    const flip = Math.abs(Math.cos((1 - ease) * Math.PI)); // 0 -> 1 flip
    ctx.save();
    ctx.translate(W / 2, 300);
    ctx.scale(scale * flip, scale);
    // glow for big rarity
    if (R.order >= 3) {
      const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 260);
      g.addColorStop(0, R.color + '88');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-260, -260, 520, 520);
    }
    // card body
    const cw = 300, ch = 360;
    ctx.fillStyle = '#0e2739';
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 18); ctx.fill();
    ctx.strokeStyle = R.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 18); ctx.stroke();
    // rarity header band
    ctx.fillStyle = R.color;
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, 42, [18, 18, 0, 0]); ctx.fill();
    ctx.fillStyle = R.order >= 3 ? '#12042a' : '#062033';
    ctx.font = '900 20px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★'.repeat(R.order + 1) + ' ' + rarityName(r.fish.rarity), 0, -ch / 2 + 22);
    // fish drawing
    this._drawFishShape(ctx, r.fish, 0, -30, 110 * clamp(r.fish.scale, 0.7, 1.6), 1, false, true);
    // name
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '900 24px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.fillText(fishName(r.fish), 0, 62);
    ctx.fillStyle = '#8fb4cc';
    ctx.font = '700 13px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.fillText(`${r.fish.name} · ${(r.weight).toFixed(2)}kg`, 0, 84);
    // value
    ctx.fillStyle = '#ffd54a';
    ctx.font = '900 30px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.fillText(`+${r.value.toLocaleString()}🪙`, 0, 122);
    if (r.perfect) {
      ctx.fillStyle = '#ffd54a';
      ctx.font = '900 15px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
      ctx.fillText(t('scene.perfectHook'), 0, 148);
    }
    if (r.combo > 1) {
      ctx.fillStyle = '#ff9c40';
      ctx.font = '900 15px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
      ctx.fillText(`COMBO x${r.combo}`, 0, 168);
    }
    ctx.restore();
    // shine sweep for epic+
    if (R.order >= 3 && t > 0.4) {
      const sk = ((t - 0.4) * 1.6) % 1.6;
      ctx.save();
      ctx.globalAlpha = 0.5;
      const gx = W / 2 - 300 + sk * 600;
      const g = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - 60, 130, 120, 350);
      ctx.restore();
    }
    if (r.isNew) {
      ctx.fillStyle = '#59d97e';
      ctx.font = '900 22px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
      ctx.textAlign = 'center';
      const bounce = Math.abs(Math.sin(t * 5)) * 6;
      ctx.fillText(t('scene.newLog'), W / 2, 100 - bounce);
    }
  }

  // ---------- fish silhouettes (shared with log cards via drawFishPreview) ----------
  _drawFishShape(ctx, fish, x, y, size, flip = 1, silhouette = false, detailed = false) {
    const L = size, Hh = size * 0.42;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    const body = silhouette ? '#04101c' : fish.color1;
    const belly = silhouette ? '#04101c' : fish.color2;
    const shape = fish.shape;
    const tail = (tx, ty, s, dir = -1) => {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + dir * 16 * s, ty - 12 * s, tx + dir * 22 * s, ty - 14 * s);
      ctx.quadraticCurveTo(tx + dir * 14 * s, ty, tx + dir * 22 * s, ty + 14 * s);
      ctx.quadraticCurveTo(tx + dir * 16 * s, ty + 12 * s, tx, ty);
      ctx.fill();
    };
    if (shape === 'slim') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L / 2, 0);
      ctx.quadraticCurveTo(0, -Hh, -L / 2, -Hh * 0.25);
      ctx.quadraticCurveTo(0, Hh * 0.5, L / 2, 0);
      ctx.fill();
      tail(-L / 2, 0, 0.8);
    } else if (shape === 'long') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L / 2, 0);
      ctx.quadraticCurveTo(L / 4, -Hh * 0.6, -L / 2, -Hh * 0.22);
      ctx.quadraticCurveTo(L / 4, Hh * 0.4, L / 2, 0);
      ctx.fill();
      tail(-L / 2, 0, 0.55);
      ctx.fillStyle = belly;
      ctx.fillRect(-L / 4, Hh * 0.06, L * 0.6, Hh * 0.14);
    } else if (shape === 'flat') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, L / 2, Hh * 0.85, 0, 0, TAU); ctx.fill();
      tail(-L / 2, 0, 0.5);
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(L * 0.1, Hh * 0.25, L * 0.3, Hh * 0.3, 0, 0, TAU); ctx.fill();
    } else if (shape === 'deep') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L / 2, 0);
      ctx.quadraticCurveTo(L * 0.2, -Hh * 1.15, -L * 0.3, -Hh * 0.7);
      ctx.quadraticCurveTo(-L / 2, -Hh * 0.3, -L / 2, 0);
      ctx.quadraticCurveTo(-L / 2, Hh * 0.3, -L * 0.3, Hh * 0.7);
      ctx.quadraticCurveTo(L * 0.2, Hh * 1.05, L / 2, 0);
      ctx.fill();
      tail(-L / 2, 0, 0.7);
      // dorsal
      ctx.beginPath();
      ctx.moveTo(-L * 0.1, -Hh * 0.85);
      ctx.quadraticCurveTo(L * 0.05, -Hh * 1.5, L * 0.18, -Hh * 0.7);
      ctx.fill();
    } else if (shape === 'fancy') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, L / 2, Hh * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = silhouette ? body : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-L * 0.05, Hh * 0.1, L * 0.16, Hh * 0.28, 0.4, 0, TAU);
      ctx.ellipse(L * 0.22, -Hh * 0.1, L * 0.08, Hh * 0.2, 0, 0, TAU);
      ctx.fill();
      tail(-L / 2, 0, 0.6);
    } else if (shape === 'shark') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L / 2, 0);
      ctx.quadraticCurveTo(L * 0.15, -Hh * 0.75, -L * 0.25, -Hh * 0.4);
      ctx.quadraticCurveTo(-L / 2, -Hh * 0.15, -L * 0.55, 0);
      ctx.quadraticCurveTo(-L * 0.3, Hh * 0.45, L * 0.2, Hh * 0.45);
      ctx.quadraticCurveTo(L * 0.42, Hh * 0.3, L / 2, 0);
      ctx.fill();
      // dorsal fin
      ctx.beginPath();
      ctx.moveTo(L * 0.05, -Hh * 0.55);
      ctx.quadraticCurveTo(L * 0.12, -Hh * 1.6, -L * 0.12, -Hh * 0.5);
      ctx.fill();
      tail(-L * 0.55, 0, 0.8);
    } else if (shape === 'squid') {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L * 0.45, -Hh * 0.4);
      ctx.quadraticCurveTo(-L * 0.1, -Hh * 0.75, -L * 0.4, 0);
      ctx.quadraticCurveTo(-L * 0.1, Hh * 0.75, L * 0.45, Hh * 0.4);
      ctx.quadraticCurveTo(L * 0.25, 0, L * 0.45, -Hh * 0.4);
      ctx.fill();
      // tentacles
      ctx.lineWidth = Hh * 0.14; ctx.strokeStyle = body; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-L * 0.35, i * Hh * 0.16);
        ctx.quadraticCurveTo(-L * 0.55, i * Hh * 0.3, -L * 0.62, i * Hh * 0.36 + Math.sin(i) * Hh * 0.2);
        ctx.stroke();
      }
      // fins
      ctx.beginPath();
      ctx.moveTo(L * 0.42, -Hh * 0.35);
      ctx.quadraticCurveTo(L * 0.62, -Hh * 0.5, L * 0.55, -Hh * 0.05);
      ctx.fill();
    } else { // weird: angler/hatchet/goblin vibes
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(L * 0.5, 0);
      ctx.quadraticCurveTo(L * 0.2, -Hh * 1.1, -L * 0.3, -Hh * 0.6);
      ctx.quadraticCurveTo(-L / 2, 0, -L * 0.3, Hh * 0.6);
      ctx.quadraticCurveTo(L * 0.2, Hh * 0.9, L * 0.5, 0);
      ctx.fill();
      tail(-L * 0.42, 0, 0.6);
      if (!silhouette) {
        // illicium (lure)
        ctx.strokeStyle = fish.color2; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(L * 0.15, -Hh * 0.8);
        ctx.quadraticCurveTo(L * 0.4, -Hh * 1.5, L * 0.52, -Hh * 0.9);
        ctx.stroke();
        ctx.fillStyle = '#7ef0ff';
        ctx.beginPath(); ctx.arc(L * 0.52, -Hh * 0.9, 3.4, 0, TAU); ctx.fill();
        // teeth
        ctx.strokeStyle = '#e8f2f8'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(L * 0.28 + i * L * 0.05, Hh * 0.28);
          ctx.lineTo(L * 0.30 + i * L * 0.05, Hh * 0.5);
          ctx.stroke();
        }
      }
    }
    if (!silhouette) {
      // eye
      ctx.fillStyle = '#f5f8ff';
      const ex = L * (shape === 'squid' ? 0.18 : 0.3), ey = shape === 'flat' ? -Hh * 0.3 : -Hh * 0.15;
      ctx.beginPath(); ctx.arc(ex, ey, size * 0.045 + 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a1a26';
      ctx.beginPath(); ctx.arc(ex + 1, ey, size * 0.022 + 0.7, 0, TAU); ctx.fill();
      if (detailed) {
        // fin sheen
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.ellipse(-L * 0.05, -Hh * 0.25, L * 0.2, Hh * 0.18, -0.2, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// preview renderer for DOM log cards (silhouette=true for uncaught species)
export function drawFishPreview(canvas, fish, silhouette = false) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 130, h = 54;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const scene = drawFishPreview._s ||= new Scene();
  const size = Math.min(w * 0.8, 46 * clamp(fish.scale, 0.6, 1.5));
  scene._drawFishShape(ctx, fish, w / 2, h / 2, size, 1, silhouette, !silhouette);
}
