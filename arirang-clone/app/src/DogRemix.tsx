// Footage remix: the ORIGINAL video (continuous motion) as the base, with
// beat-synced cinematic effects layered on top — punch-in zooms, camera shake,
// flash hits, spotlight pulses, light sweeps, grade, vignette.
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import onsetsDog from './onsets-dog.json';

const FPS = 30;
const LIGHTS = [36, 181, 326, 470, 625];

// strong hits: onsets spaced >= 1.1s apart drive zoom/shake (phrase accents)
const STRONG: number[] = [];
{
  let last = -10;
  for (const o of onsetsDog) {
    if (o.t - last >= 1.1) {
      STRONG.push(o.t);
      last = o.t;
    }
  }
}

function lastBefore(arr: number[], t: number): number {
  let v = -10;
  for (const x of arr) {
    if (x <= t) v = x;
    else break;
  }
  return v;
}

// deterministic pseudo-random from a seed
function rnd(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const DogRemix: React.FC<{ src?: string }> = ({ src = 'dog-source.mp4' }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const onset = lastBefore(onsetsDog.map((o) => o.t), t);
  const strong = lastBefore(STRONG, t);

  // punch-in zoom on phrase accents, alternating anchor left/right
  const su = Math.max(0, t - strong);
  const phraseIdx = STRONG.indexOf(strong);
  const zoom = 1 + 0.045 * Math.exp(-su / 0.16);
  const anchorX = 50 + (phraseIdx % 2 === 0 ? 2.5 : -2.5);
  const anchorY = 52 + (phraseIdx % 3 === 0 ? 2 : -1.5);

  // camera shake, strongest right on the accent
  const sh = Math.exp(-su / 0.1) * 3;
  const shx = (rnd(strong * 3.1) - 0.5) * 2 * sh;
  const shy = (rnd(strong * 7.7) - 0.5) * 2 * sh;

  // flash hits: tiny on every onset, bigger on accents
  const ou = Math.max(0, t - onset);
  const flashSmall = 0.05 * Math.exp(-ou / 0.07);
  const flashBig = 0.1 * Math.exp(-su / 0.12);

  // light sweep at each phrase start
  const sw = su < 0.5 ? (su - 0.1) / 0.4 : -1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom}) translate(${shx}px, ${shy}px)`,
          transformOrigin: `${anchorX}% ${anchorY}%`,
          filter: 'contrast(1.07) saturate(1.1) brightness(1.02)',
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          style={{ width: 720, height: 1280, objectFit: 'cover' }}
        />
      </AbsoluteFill>

      {/* spotlight pulses on every onset */}
      <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
        {LIGHTS.map((lx, i) => {
          const flick = 0.9 + 0.1 * Math.sin(t * 3.1 + i * 1.7);
          const a = 0.16 * Math.exp(-ou / 0.22) * flick;
          const g = `radial-gradient(circle at ${lx}px 322px, rgba(255,205,130,${a}) 0%, rgba(255,190,110,${a * 0.4}) 34%, rgba(255,180,100,0) 62%)`;
          return <AbsoluteFill key={i} style={{ background: g }} />;
        })}
      </AbsoluteFill>

      {/* light sweep on phrase starts */}
      {sw >= 0 && sw <= 1 ? (
        <AbsoluteFill style={{ mixBlendMode: 'screen', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              top: -100,
              left: -300 + sw * 1320,
              width: 240,
              height: 1600,
              transform: 'rotate(14deg)',
              background:
                'linear-gradient(90deg, rgba(255,220,160,0) 0%, rgba(255,220,160,0.14) 50%, rgba(255,220,160,0) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* warm grade wash */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'soft-light',
          background:
            'linear-gradient(180deg, rgba(255,150,60,0.16) 0%, rgba(120,80,160,0.10) 100%)',
        }}
      />

      {/* flash */}
      <AbsoluteFill
        style={{ backgroundColor: '#fff8ec', opacity: flashSmall + flashBig }}
      />

      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.34) 100%)',
        }}
      />

      <Audio src={staticFile('dog.m4a')} />
    </AbsoluteFill>
  );
};
