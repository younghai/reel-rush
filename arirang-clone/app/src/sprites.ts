// Loads item sprites extracted from the original videos (public/sprites/*.png).
import { continueRender, delayRender, staticFile } from 'remotion';

export const SPRITE_NAMES = [
  'hourglass', 'lantern', 'norigae', 'flower', 'pouch', 'janggu', 'fan', 'beads', 'shelf',
  'c_torch', 'c_lantern', 'c_chain', 'c_gargoyle', 'c_mushroom', 'c_pickaxe', 'c_chest', 'c_crown',
  'dog_stand', 'dog_tongue', 'dog_shake', 'dog_side', 'dog_sniff', 'dog_front2',
  'dancer_stand', 'dancer_arms', 'dancer_bend', 'dancer_back',
];

export const SPRITES: Record<string, HTMLImageElement> = {};
let started = false;

export function preloadSprites() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('loading item sprites');
  let left = SPRITE_NAMES.length;
  for (const n of SPRITE_NAMES) {
    const img = new Image();
    img.onload = () => {
      if (--left === 0) continueRender(handle);
    };
    img.onerror = () => {
      if (--left === 0) continueRender(handle);
    };
    img.src = staticFile(`sprites/${n}.png`);
    SPRITES[n] = img;
  }
}

export interface SpriteOpts {
  ax?: number; // anchor fraction x (0..1)
  ay?: number; // anchor fraction y
  rot?: number;
  flip?: boolean;
  alpha?: number;
  scale?: number;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  scale: number,
  opts: SpriteOpts = {},
) {
  const img = SPRITES[name];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -(opts.ax ?? 0.5) * w, -(opts.ay ?? 0) * h, w, h);
  ctx.restore();
}
