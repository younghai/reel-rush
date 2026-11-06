// Frame renderer: pure function of time, shared by both themes.
import {
  World,
  ballPos,
  inView,
  clamp,
  FPS,
  H,
} from './engine';

export interface Theme {
  bg: (ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) => void;
  hitGlow: (ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) => void;
  mid?: (ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) => void;
  decor: (ctx: CanvasRenderingContext2D, d: import('./engine').Decor, t: number, cam: number) => void;
  target: (ctx: CanvasRenderingContext2D, tg: import('./engine').Target, t: number, cam: number) => void;
  hitFX?: (ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) => void;
  finale: (ctx: CanvasRenderingContext2D, world: World, t: number, cam: number) => void;
  ball: (ctx: CanvasRenderingContext2D, p: { x: number; y: number }, alpha: number, ghost: boolean) => void;
  overlay: (ctx: CanvasRenderingContext2D, t: number, dur: number) => void;
}

export function drawWorldFrame(ctx: CanvasRenderingContext2D, world: World, theme: Theme, t: number) {
  const f = clamp(Math.round(t * FPS), 0, world.cam.length - 1);
  const cam = world.cam[f];
  const dur = world.durF / FPS;

  theme.bg(ctx, world, t, cam);
  theme.hitGlow(ctx, world, t, cam);
  if (theme.mid) theme.mid(ctx, world, t, cam);

  for (const d of world.decors) {
    if (inView(d.y, cam)) theme.decor(ctx, d, t, cam);
  }
  for (const e of world.extras) {
    if (inView(e.y, cam)) theme.target(ctx, e, -1, cam);
  }
  for (const tg of world.targets) {
    if (inView(tg.y, cam)) theme.target(ctx, tg, t, cam);
  }
  if (theme.hitFX) theme.hitFX(ctx, world, t, cam);
  theme.finale(ctx, world, t, cam);

  // ball (with trail)
  const bp = ballPos(world, t);
  const sp = { x: bp.x, y: bp.y - cam };
  if (t < world.entryT + 0.05) {
    for (const [dt, a] of [
      [0.05, 0.2],
      [0.1, 0.12],
      [0.16, 0.07],
    ] as number[][]) {
      const gp = ballPos(world, Math.max(0, t - dt));
      theme.ball(ctx, { x: gp.x, y: gp.y - cam }, a, true);
    }
    const alpha = clamp((t - 0.2) / 0.4, 0, 1);
    theme.ball(ctx, sp, alpha, false);
  } else {
    theme.ball(ctx, sp, 0.78, false);
  }

  theme.overlay(ctx, t, dur);
  void H;
}
