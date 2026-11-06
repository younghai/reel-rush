// REEL RUSH — in-canvas gameplay UI: power meter, strike window, fight HUD, reveal card.
import { W, H, FIGHT, DEPTH_BANDS, RARITIES } from '../config.js';
import { t, fishName, rarityName } from '../i18n.js';
import { drawFishShape } from './fishdraw.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const PHOS = '#ffb547', CYAN = '#4dd8e8', GRN = '#57e6a8', ALERT = '#ff6b57', DIMT = '#6f93a8';
// 어군탐지기 베젤: 눈금 프레임 + 라벨
function bezel(ctx, x, y, w, h, label) {
  ctx.fillStyle = 'rgba(4, 15, 23, 0.78)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(45, 90, 120, 0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.stroke();
  if (label) {
    ctx.fillStyle = DIMT;
    ctx.font = '700 9px ' + MONO;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + 8, y - 5);
  }
}

export function drawPowerMeter(ctx, fg) {
  const x = 250, y = 214, w = 150, h = 14;
  bezel(ctx, x - 6, y - 6, w + 12, h + 12, 'CAST POWER');
  // 눈금 (0/25/50/75/100)
  ctx.strokeStyle = 'rgba(111, 147, 168, 0.6)'; ctx.lineWidth = 1;
  for (const tk of [0, 0.25, 0.5, 0.75, 1]) {
    const tx = x + w * tk;
    ctx.beginPath(); ctx.moveTo(tx, y - 8); ctx.lineTo(tx, y - 4); ctx.stroke();
  }
  // fill: 세 구간 단색 (그라데이션 제거 — 계기 스타일)
  const p = fg.cast.power;
  ctx.fillStyle = CYAN;
  ctx.fillRect(x, y, w * p, h);
  // 수심 밴드 경계 눈금
  ctx.fillStyle = 'rgba(255, 181, 71, 0.8)';
  for (const b of DEPTH_BANDS.slice(1)) ctx.fillRect(x + w * b.from - 1, y, 2, h);
  // 퍼센트 판독값
  ctx.fillStyle = CYAN;
  ctx.font = '700 11px ' + MONO;
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(Math.round(p * 100) + '%', x + w, y - 8);
  const band = DEPTH_BANDS.find(b => p >= b.from && (p <= b.to || b === DEPTH_BANDS[DEPTH_BANDS.length - 1]));
  if (band) {
    ctx.fillStyle = PHOS;
    ctx.font = '700 11px ' + MONO;
    ctx.textAlign = 'center';
    ctx.fillText(t('scene.depth', { band: t('depth.' + band.id) }), x + w / 2, y + h + 16);
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
  const cx = W / 2, w = 440;
  const bx = cx - w / 2 - 14, by = 566, bh = 108;
  // 베젤 프레임
  ctx.fillStyle = 'rgba(4, 15, 23, 0.82)';
  ctx.beginPath(); ctx.roundRect(bx, by, w + 28, bh, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(45, 90, 120, 0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, w + 28, bh, 9); ctx.stroke();
  // 어종 라벨 (좌상단)
  ctx.fillStyle = PHOS;
  ctx.font = '800 12px ' + MONO;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (fg.fish) ctx.fillText((fg.fish.boss ? 'BOSS · ' : 'TARGET · ') + fishName(fg.fish).toUpperCase(), bx + 12, by + 18);

  // ── LINE (progress) 게이지: 눈금 프레임 + 시안 필 ──
  const py = by + 30, ph = 13;
  ctx.fillStyle = 'rgba(10, 30, 42, 0.9)';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, py, w, ph, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(45, 90, 120, 0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, py, w, ph, 3); ctx.stroke();
  ctx.fillStyle = CYAN;
  if (st.progress > 1) { ctx.beginPath(); ctx.roundRect(cx - w / 2 + 1, py + 1, (w - 2) * clamp(st.progress / 100, 0, 1), ph - 2, 2); ctx.fill(); }
  ctx.fillStyle = DIMT;
  ctx.font = '700 9px ' + MONO;
  ctx.textAlign = 'left';
  ctx.fillText('LINE', cx - w / 2, py - 4);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(clamp(st.progress, 0, 100)) + '%', cx + w / 2, py - 4);

  // ── TENSION 게이지: 눈금 + 초록 밴드(해칭) + 판독값 ──
  const ty = py + ph + 16, th = 18;
  ctx.fillStyle = 'rgba(10, 30, 42, 0.9)';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, ty, w, th, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(45, 90, 120, 0.9)';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, ty, w, th, 3); ctx.stroke();
  // 초록 밴드 + 해칭 (색약 안전)
  const gx = cx - w / 2 + w * (F.greenLow / 100), gw = w * ((F.greenHigh - F.greenLow) / 100);
  ctx.save();
  ctx.beginPath(); ctx.rect(gx, ty + 2, gw, th - 4); ctx.clip();
  ctx.fillStyle = 'rgba(87, 230, 168, 0.22)';
  ctx.fillRect(gx, ty + 2, gw, th - 4);
  ctx.strokeStyle = 'rgba(87, 230, 168, 0.4)'; ctx.lineWidth = 2;
  for (let hx = gx - th; hx < gx + gw + th; hx += 8) {
    ctx.beginPath(); ctx.moveTo(hx, ty + th); ctx.lineTo(hx + th, ty); ctx.stroke();
  }
  ctx.restore();
  // 25/50/75 눈금
  ctx.strokeStyle = 'rgba(111, 147, 168, 0.7)'; ctx.lineWidth = 1;
  for (const tk of [0.25, 0.5, 0.75]) {
    const tx = cx - w / 2 + w * tk;
    ctx.beginPath(); ctx.moveTo(tx, ty - 5); ctx.lineTo(tx, ty - 1); ctx.stroke();
  }
  // 밴드 경계 흰 눈금
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 1.5;
  for (const bx2 of [cx - w / 2 + w * (F.greenLow / 100), cx - w / 2 + w * (F.greenHigh / 100)]) {
    ctx.beginPath(); ctx.moveTo(bx2, ty - 4); ctx.lineTo(bx2, ty + th + 4); ctx.stroke();
  }
  // tension fill
  const tk = st.tension / 100;
  ctx.fillStyle = tk * 100 <= F.greenHigh ? GRN : (tk < 0.92 ? PHOS : ALERT);
  ctx.beginPath(); ctx.roundRect(cx - w / 2 + 1, ty + 1, (w - 2) * tk, th - 2, 2); ctx.fill();
  // 판독 바 + 수치
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 + w * tk, ty - 2); ctx.lineTo(cx - w / 2 + w * tk, ty + th + 2); ctx.stroke();
  ctx.fillStyle = tk * 100 > F.greenHigh ? ALERT : '#ffffff';
  ctx.font = '800 11px ' + MONO;
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(st.tension), cx + w / 2, ty - 6);
  ctx.fillStyle = DIMT;
  ctx.font = '700 9px ' + MONO;
  ctx.textAlign = 'left';
  ctx.fillText('TENSION', cx - w / 2, ty - 6);
  // 경고 글리프 (밴드 초과 시 점멸)
  if (tk * 100 > F.greenHigh) {
    ctx.fillStyle = ALERT;
    ctx.font = '900 13px ' + MONO;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(fg.t * 16);
    ctx.fillText('! OVERLOAD', cx, ty + th + 14);
    ctx.globalAlpha = 1;
  }
  // 슬랙 경고
  if (st.slack > 0.3) {
    ctx.fillStyle = PHOS;
    ctx.font = '800 12px ' + MONO;
    ctx.textAlign = 'center';
    ctx.fillText('REEL! (SLACK ' + Math.round(st.slack * 10) / 10 + 's)', cx, ty + th + 14);
  }
}

export function drawRevealCard(ctx, fg) {
  const r = fg.reveal;
  if (!r) return;
  const R = RARITIES[r.fish.rarity];
  const rt = r.t;
  // dark overlay
  ctx.fillStyle = `rgba(4,14,24,${clamp(rt * 2, 0, 0.55)})`;
  ctx.fillRect(0, 0, W, H);
  // card flip-in with overshoot
  const k = clamp(rt / 0.5, 0, 1);
  const ease = 1 - Math.pow(1 - k, 3);
  const scale = 0.6 + ease * 0.5 + (k >= 1 ? Math.sin((rt - 0.5) * 8) * 0.02 : 0);
  const flip = Math.abs(Math.cos((1 - ease) * Math.PI));
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
  // card body — 어획 기록표 (catch record)
  const cw = 300, ch = 360;
  ctx.fillStyle = '#0b1e2a';
  ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 6); ctx.fill();
  ctx.strokeStyle = R.color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 6); ctx.stroke();
  // 레어도 스탬프 (기울인 각인)
  ctx.fillStyle = R.color;
  ctx.font = '900 15px ' + MONO;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(72, -ch / 2 + 32); ctx.rotate(-0.12);
  ctx.globalAlpha = 0.92;
  ctx.fillText('◆ ' + rarityName(r.fish.rarity), 0, 0);
  ctx.restore();
  // 기록 구분선
  ctx.strokeStyle = 'rgba(111, 147, 168, 0.35)'; ctx.lineWidth = 1;
  ctx.textBaseline = 'alphabetic';
  for (const ly of [-ch / 2 + 58, -4, 52]) {
    ctx.beginPath(); ctx.moveTo(-cw / 2 + 18, ly); ctx.lineTo(cw / 2 - 18, ly); ctx.stroke();
  }
  // fish drawing
  drawFishShape(ctx, r.fish, 0, -32, 108 * clamp(r.fish.scale, 0.7, 1.6), 1, false, true);
  // name
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '900 23px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fishName(r.fish), 0, 60);
  // data rows (mono 계기 판독)
  ctx.font = '700 12.5px ' + MONO;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const rows = [
    ['WEIGHT', r.weight.toFixed(2) + ' kg'],
    ['LENGTH', r.cm ? r.cm + ' cm' : '—'],
  ];
  rows.forEach(([kk, vv], i) => {
    const ry = 88 + i * 20;
    ctx.fillStyle = DIMT;
    ctx.fillText(kk, -cw / 2 + 24, ry);
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'right';
    ctx.fillText(vv, cw / 2 - 24, ry);
    ctx.textAlign = 'left';
  });
  // value
  ctx.fillStyle = PHOS;
  ctx.font = '900 27px ' + MONO;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+' + r.value.toLocaleString() + ' G', 0, 134);
  if (r.perfect) {
    ctx.fillStyle = PHOS;
    ctx.font = '900 13px ' + MONO;
    ctx.fillText('PERFECT HOOK x1.5', 0, 158);
  }
  if (r.combo > 1) {
    ctx.fillStyle = '#ff9c40';
    ctx.font = '900 13px ' + MONO;
    ctx.fillText('COMBO x' + r.combo, 0, 178);
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
    ctx.fillStyle = GRN;
    ctx.font = '900 19px ' + MONO;
    ctx.textAlign = 'center';
    const bounce = Math.abs(Math.sin(rt * 5)) * 6;
    ctx.fillText(t('scene.newLog'), W / 2, 96 - bounce);
  }
}
