// REEL RUSH — juice engine: screen shake, hit-stop, slow-mo, particles, floating text (타격감 core)

const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// vestibular safety: users who opt out of motion get calmer effects (never fully off —
// feedback still needed, but magnitude is capped)
const REDUCED = (() => {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
})();
export const prefersReducedMotion = () => REDUCED;
const SCALE = REDUCED ? 0.35 : 1;

export const VIEW = { w: 1280, h: 720 };

export class Juice {
  constructor() {
    this.shakeMag = 0; this.shakeTime = 0; this.shakeDur = 0; this.shakeX = 0; this.shakeY = 0; this.shakeRot = 0;
    this.hitstopLeft = 0;
    this.slowScale = 1; this.slowLeft = 0;
    this.flashes = [];
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.chromatic = 0; // 0..1 color-edge pulse on big hits
  }

  // --- triggers ---
  shake(mag, dur = 0.35) {
    mag *= SCALE;
    if (mag >= this.shakeMag) { this.shakeMag = mag; this.shakeDur = this.shakeTime = dur; }
    else this.shakeTime = Math.max(this.shakeTime, dur * 0.6);
  }
  hitstop(ms) { this.hitstopLeft = Math.max(this.hitstopLeft, ms * SCALE); }
  slowmo(scale, ms) { this.slowScale = Math.min(this.slowScale, scale); this.slowLeft = Math.max(this.slowLeft, ms / 1000); }
  flash(color = '#ffffff', alpha = 0.5, ms = 140) { this.flashes.push({ color, alpha, life: ms / 1000, max: ms / 1000 }); }
  pulse(strength = 1) { this.chromatic = Math.max(this.chromatic, strength); }

  burst(x, y, o = {}) {
    if (this.particles.length > 420) return; // pool cap: bound worst-case frame cost (shadowBlur path)
    const n = Math.min(o.count ?? 18, 420 - this.particles.length);
    for (let i = 0; i < n; i++) {
      const ang = o.angle != null ? o.angle + rnd(-(o.spread ?? 0.9), o.spread ?? 0.9) : rnd(0, TAU);
      const sp = rnd((o.speed ?? 120) * 0.4, o.speed ?? 120);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (o.up ?? 60),
        life: rnd(0.35, o.life ?? 0.9),
        size: rnd(2, o.size ?? 5), color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : (o.color ?? '#bfe8ff'),
        grav: o.grav ?? 340, drag: o.drag ?? 0.99, shape: o.shape ?? 'dot', glow: o.glow ?? false,
        spin: 0, spinV: o.shape === 'rect' ? rnd(-9, 9) : 0,
      });
    }
  }
  confetti(x, y, count = 60) {
    if (this.particles.length > 420) return; // pool cap
    count = Math.min(count, 420 - this.particles.length);
    const palette = ['#ffd54a', '#ff5d9e', '#4db8ff', '#59d97e', '#b06bff', '#ff9c40'];
    for (let i = 0; i < count; i++) {
      const ang = rnd(0, TAU), sp = rnd(140, 420);
      this.particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 180,
        life: rnd(0.8, 1.7), size: rnd(3, 6),
        color: palette[(Math.random() * palette.length) | 0],
        grav: 460, drag: 0.985, shape: 'rect', glow: false, spin: rnd(0, TAU), spinV: rnd(-9, 9),
      });
    }
  }
  ring(x, y, o = {}) {
    this.rings.push({ x, y, r0: o.r0 ?? 6, r1: o.r1 ?? 70, life: o.life ?? 0.6, max: o.life ?? 0.6, color: o.color ?? 'rgba(220,245,255,0.9)', width: o.width ?? 3 });
  }
  floatText(x, y, text, o = {}) {
    this.texts.push({
      x, y, text, life: o.life ?? 1.1, max: o.life ?? 1.1,
      color: o.color ?? '#ffffff', size: o.size ?? 26,
      vy: o.vy ?? -70, pop: 0, weight: o.weight ?? 900, stroke: o.stroke ?? 'rgba(6,20,32,0.85)',
    });
  }

  // --- update: returns dt the GAME should use this frame (0 during hitstop) ---
  update(dt) {
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= dt * 1000;
      this.#decayVisuals(dt * 0.12); // visuals age a little so it feels punchy, not frozen dead
      return 0;
    }
    if (this.slowLeft > 0) {
      this.slowLeft -= dt;
      if (this.slowLeft <= 0) this.slowScale = 1;
      this.#decayVisuals(dt);
      return dt * this.slowScale;
    }
    this.#decayVisuals(dt);
    return dt;
  }

  #decayVisuals(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const k = Math.max(0, this.shakeTime / this.shakeDur);
      const e = k * k;
      this.shakeX = rnd(-1, 1) * this.shakeMag * e;
      this.shakeY = rnd(-1, 1) * this.shakeMag * e;
      this.shakeRot = rnd(-1, 1) * this.shakeMag * 0.0022 * e;
      if (this.shakeTime <= 0) { this.shakeMag = 0; this.shakeX = this.shakeY = this.shakeRot = 0; }
    }
    this.chromatic = Math.max(0, this.chromatic - dt * 3.2);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += p.spinV * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.96;
      t.pop = Math.min(1, t.pop + dt * 9); // scale-in bounce 0 -> 1
    }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  // --- draw ---
  applyCamera(ctx) {
    const { w, h } = VIEW;
    ctx.translate(w / 2 + this.shakeX, h / 2 + this.shakeY);
    ctx.rotate(this.shakeRot);
    ctx.translate(-w / 2, -h / 2);
  }
  drawWorld(ctx) {
    const { w, h } = VIEW;
    for (const p of this.particles) {
      const a = Math.min(1, p.life * 2.4);
      ctx.globalAlpha = a;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 2), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  drawUI(ctx) {
    const { w, h } = VIEW;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const fade = Math.min(1, (t.life / t.max) * 2.4);
      const scale = 0.5 + t.pop * 0.5 + (t.pop >= 1 ? Math.sin((t.max - t.life) * 6) * 0.03 : 0);
      ctx.globalAlpha = fade;
      ctx.save();
      ctx.translate(t.x, t.y); ctx.scale(scale, scale);
      ctx.font = `${t.weight} ${t.size}px "SF Pro KR","Pretendard","Apple SD Gothic Neo",sans-serif`;
      ctx.lineWidth = t.size * 0.18; ctx.strokeStyle = t.stroke; ctx.lineJoin = 'round';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const f of this.flashes) {
      ctx.globalAlpha = (f.life / f.max) * f.alpha;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    if (this.chromatic > 0.01) {
      const cx = w / 2, cy = h / 2;
      let g = ctx.createRadialGradient(cx, cy, h * 0.44, cx, cy, h * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(255,60,120,${0.35 * this.chromatic})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      g = ctx.createRadialGradient(cx, cy, h * 0.4, cx, cy, h * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(60,180,255,${0.28 * this.chromatic})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}
