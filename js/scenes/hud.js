// REEL RUSH — in-canvas gameplay UI: power meter, strike window, fight HUD, reveal card.
import { W, H, FIGHT, DEPTH_BANDS, RARITIES } from '../config.js';
import { t, fishName, rarityName } from '../i18n.js';
import { drawFishShape } from './fishdraw.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function drawPowerMeter(ctx, fg) {
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

export function drawStrikeUI(ctx, fg) {
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

export function drawFightUI(ctx, fg) {
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
    const sk = clamp(st.stamina / (st.staminaMax || fg.fish.stamina), 0, 1);
    ctx.fillStyle = 'rgba(255,180,80,0.9)';
    ctx.fillRect(cx - w / 2, ty - 10, w * sk, 4);
  }
}

export function drawRevealCard(ctx, fg) {
  const r = fg.reveal;
  if (!r) return;
  const R = RARITIES[r.fish.rarity];
  const rt = r.t; // reveal elapsed time (renamed from t: it shadowed the i18n t() import)
  // dark overlay
  ctx.fillStyle = `rgba(4,14,24,${clamp(rt * 2, 0, 0.55)})`;
  ctx.fillRect(0, 0, W, H);
  // card flip-in with overshoot
  const k = clamp(rt / 0.5, 0, 1);
  const ease = 1 - Math.pow(1 - k, 3);
  const scale = 0.6 + ease * 0.5 + (k >= 1 ? Math.sin((rt - 0.5) * 8) * 0.02 : 0);
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
  drawFishShape(ctx, r.fish, 0, -30, 110 * clamp(r.fish.scale, 0.7, 1.6), 1, false, true);
  // name
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '900 24px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
  ctx.fillText(fishName(r.fish), 0, 62);
  ctx.fillStyle = '#8fb4cc';
  ctx.font = '700 13px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif';
  ctx.fillText(`${r.fish.name} · ${(r.weight).toFixed(2)}kg${r.cm ? ' · ' + r.cm + 'cm' : ''}`, 0, 84);
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
  if (R.order >= 3 && rt > 0.4) {
    const sk = ((rt - 0.4) * 1.6) % 1.6;
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
    const bounce = Math.abs(Math.sin(rt * 5)) * 6;
    ctx.fillText(t('scene.newLog'), W / 2, 100 - bounce);
  }
}
