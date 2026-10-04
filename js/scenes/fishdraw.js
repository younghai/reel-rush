// REEL RUSH — fish silhouette renderer: one vector painter for every species shape.
// Shared by the world renderer (monster / fight shadows), the reveal card, and DOM log previews.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- fish silhouettes (shared with log cards via drawFishPreview) ----------
export function drawFishShape(ctx, fish, x, y, size, flip = 1, silhouette = false, detailed = false) {
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

// preview renderer for DOM log cards (silhouette=true for uncaught species)
export function drawFishPreview(canvas, fish, silhouette = false) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 130, h = 54;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const size = Math.min(w * 0.8, 46 * clamp(fish.scale, 0.6, 1.5));
  drawFishShape(ctx, fish, w / 2, h / 2, size, 1, silhouette, !silhouette);
}
