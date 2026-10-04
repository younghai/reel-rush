// REEL RUSH — Scene shell: owns the ambient world state (stars / clouds / bubbles /
// ambient fish / abyss monster timer + worldT) and orchestrates the draw order.
// Rendering bodies live in ./scenes/{world,hud,fishdraw}.js; main.js keeps importing
// Scene + drawFishPreview from here (single import point).
import { W, WATER_Y, DAY_LEN, CYCLE } from './config.js';
import { drawSky, drawCelestial, drawSea, drawUnderwater, drawPier, drawAngler, drawLineAndBobber, newBubble } from './scenes/world.js';
import { drawPowerMeter, drawStrikeUI, drawFightUI, drawRevealCard } from './scenes/hud.js';
import { drawFishPreview } from './scenes/fishdraw.js';

export { drawFishPreview };

const TAU = Math.PI * 2;

export class Scene {
  constructor() {
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * WATER_Y * 0.9, r: Math.random() * 1.4 + 0.4, tw: Math.random() * TAU }));
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: 40 + Math.random() * 130, s: 0.6 + Math.random() * 0.9, v: 4 + Math.random() * 7 }));
    this.bubbles = Array.from({ length: 26 }, () => newBubble(true));
    // boids school (Tidewater Fish.js-style steering, 2D budget): 16 fish with
    // separation / alignment / cohesion + wander, stepped in world.js
    this.ambientFish = Array.from({ length: 16 }, () => ({
      x: Math.random() * W, y: WATER_Y + 60 + Math.random() * 220,
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 12,
      s: 0.35 + Math.random() * 0.5, wob: Math.random() * TAU,
    }));
    this.worldT = 0;
    this.monsterT = 30 + Math.random() * 40; // abyss easter-egg timer
    this.monster = null;
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

  // golden-hour phases: 'dusk' (day->night fade) and 'dawn' (night->day fade)
  phaseOf(t) {
    const p = t % CYCLE;
    if (p >= DAY_LEN - 10 && p < DAY_LEN) return 'dusk';
    if (p >= CYCLE - 10) return 'dawn';
    return this.isNight(t) ? 'night' : 'day';
  }

  // game-clock hour 0..30 on the cycle (day 6..18, night 18..30 ≡ 6) — feeds activity()
  hourOf(t) {
    const p = t % CYCLE;
    let h = p < DAY_LEN ? 6 + 12 * (p / DAY_LEN) : 18 + 12 * ((p - DAY_LEN) / (CYCLE - DAY_LEN));
    return h > 24 ? h - 24 : h; // wrap 24..30 -> 0..6 so dawn peaks at 6.5
  }

  draw(ctx, g, dt) {
    // g: { fg, juice, economy, zone, t }
    this.worldT += dt;
    const night = this.nightAmount(this.worldT);
    const zone = g.zone;
    const t = this.worldT;

    drawSky(ctx, this, zone, night, t, dt);
    drawCelestial(ctx, night, t);
    drawSea(ctx, zone, night, t);
    drawUnderwater(ctx, this, zone, night, t, g, dt);
    drawPier(ctx, zone, night);
    drawAngler(ctx, g, night);
    drawLineAndBobber(ctx, g);
    if (g.fg.state === 'casting') drawPowerMeter(ctx, g.fg);
    if (g.fg.state === 'strike') drawStrikeUI(ctx, g.fg);
    if (g.fg.state === 'fight') drawFightUI(ctx, g.fg);
    if (g.fg.state === 'reveal') drawRevealCard(ctx, g.fg);
  }
}
