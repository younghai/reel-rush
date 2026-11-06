// Small canvas helpers shared by both themes.

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

export function radial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r0: number,
  r1: number,
  stops: [number, string][],
) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

export function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  const g = radial(ctx, x, y, 0, r, [
    [0, `rgba(${color},${alpha})`],
    [0.55, `rgba(${color},${alpha * 0.45})`],
    [1, `rgba(${color},0)`],
  ]);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function star4(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.lineWidth = 0.9;
  const d = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(x - d, y - d);
  ctx.lineTo(x + d, y + d);
  ctx.moveTo(x + d, y - d);
  ctx.lineTo(x - d, y + d);
  ctx.stroke();
  ctx.restore();
}

// taegeuk (yin-yang) used by fan / janggu
export function taegeuk(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e84545';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.fillStyle = '#3050c8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r / 2, r / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#e84545';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, r / 2, r / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#3050c8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r / 2, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#3050c8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, r / 2, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#e84545';
  ctx.fill();
  ctx.restore();
}

export function shelfBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(190,158,105,0.85)';
  rr(ctx, x - w / 2, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,68,42,0.9)';
  rr(ctx, x - w / 2, y + h * 0.55, w, h * 0.45, h * 0.2);
  ctx.fill();
  ctx.restore();
}

export function thread(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(220,220,230,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,196,120,0.9)';
  ctx.beginPath();
  ctx.arc(x, y0 + 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
