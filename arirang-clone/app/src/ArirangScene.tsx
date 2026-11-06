import React, { useLayoutEffect, useRef } from 'react';
import { Audio, staticFile, useCurrentFrame } from 'remotion';
import { buildWorld, ThemeConfig } from './engine';
import { drawWorldFrame, Theme } from './render';
import {
  arirangBg,
  arirangHitGlow,
  arirangGrid,
  arirangTarget,
  arirangDecor,
  arirangFinale,
  arirangBall,
  arirangOverlay,
  ARIRANG_ORN,
} from './theme-arirang';
import { preloadSprites } from './sprites';
import onsetsArirang from './onsets-arirang.json';

preloadSprites();

const CFG: ThemeConfig = {
  seed: 20260101,
  onsets: onsetsArirang,
  hitsFrom: 2.15,
  hitsTo: 44.35,
  mergeGap: 0.13,
  entryT: 44.547,
  firstPos: { x: 408, y: 690 },
  introFrom: { x: 365, y: 435 },
  introT0: 0.15,
  xMin: 105,
  xMax: 615,
  stepMin: 90,
  stepMax: 260,
  dropK: [0.55, 0.95],
  dropMax: 150,
  ornStep: [260, 420],
  ornTop: 380,
  ornBottomPad: 620,
  ornTypes: ARIRANG_ORN,
  mouthOffset: { x: 30, y: 64 },
  restDrop: 90,
  finaleDrop: 150,
  camSettle: 640,
  ripples: [44.942, 46.045, 47.334],
  dur: 1475 / 30,
};

export const arirangWorld = buildWorld(CFG);

const theme: Theme = {
  bg: (ctx, _w, t, cam) => arirangBg(ctx, t, cam),
  hitGlow: arirangHitGlow,
  mid: arirangGrid,
  decor: arirangDecor,
  target: arirangTarget,
  finale: arirangFinale,
  ball: arirangBall,
  overlay: arirangOverlay,
};

export const ArirangMarble: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    drawWorldFrame(ctx, arirangWorld, theme, frame / 30);
  }, [frame]);
  return (
    <>
      <Audio src={staticFile('arirang.m4a')} />
      <canvas ref={ref} width={720} height={1280} style={{ width: 720, height: 1280 }} />
    </>
  );
};
