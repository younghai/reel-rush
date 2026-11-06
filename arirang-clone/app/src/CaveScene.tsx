import React, { useLayoutEffect, useRef } from 'react';
import { Audio, staticFile, useCurrentFrame } from 'remotion';
import { buildWorld, ThemeConfig, Decor } from './engine';
import { drawWorldFrame, Theme } from './render';
import {
  buildWalls,
  WallData,
  caveBg,
  caveHitGlow,
  caveTarget,
  caveDecor,
  caveHitFX,
  caveFinale,
  caveBall,
  caveOverlay,
  CAVE_ORN,
} from './theme-cave';
import onsetsCave from './onsets-cave.json';
import { preloadSprites } from './sprites';

preloadSprites();

const CFG: ThemeConfig = {
  seed: 777,
  onsets: onsetsCave,
  hitsFrom: 1.4,
  hitsTo: 53.95,
  mergeGap: 0.13,
  entryT: 54.126,
  firstPos: { x: 380, y: 560 },
  introFrom: { x: 345, y: 370 },
  introT0: 0.2,
  xMin: 110,
  xMax: 610,
  stepMin: 85,
  stepMax: 250,
  dropK: [0.55, 0.95],
  dropMax: 145,
  ornStep: [250, 420],
  ornTop: 420,
  ornBottomPad: 700,
  ornTypes: CAVE_ORN,
  mouthOffset: { x: 55, y: 80 },
  restDrop: 72,
  finaleDrop: 143,
  camSettle: 1070,
  ripples: [55.38, 55.67, 56.483],
  dur: 1732 / 30,
};

export const caveWorld = buildWorld(CFG);
const walls: WallData = buildWalls(caveWorld.finale.shelfY + 900, 424242);

const theme: Theme = {
  bg: (ctx, _w, t, cam) => caveBg(ctx, _w, walls, t, cam),
  hitGlow: caveHitGlow,
  decor: (ctx, d: Decor, t, cam) => caveDecor(ctx, d, t, cam, walls),
  target: caveTarget,
  hitFX: caveHitFX,
  finale: caveFinale,
  ball: caveBall,
  overlay: caveOverlay,
};

export const CaveMarble: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    drawWorldFrame(ctx, caveWorld, theme, frame / 30);
  }, [frame]);
  return (
    <>
      <Audio src={staticFile('cave.m4a')} />
      <canvas ref={ref} width={720} height={1280} style={{ width: 720, height: 1280 }} />
    </>
  );
};
