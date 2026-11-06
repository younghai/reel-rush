import React from 'react';
import { Composition } from 'remotion';
import { ArirangMarble } from './ArirangScene';
import { CaveMarble } from './CaveScene';
import { DogDance } from './DogScene';
import { DogRemix } from './DogRemix';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ArirangMarble"
        component={ArirangMarble}
        durationInFrames={1475}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="CaveMarble"
        component={CaveMarble}
        durationInFrames={1732}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="DogDance"
        component={DogDance}
        durationInFrames={841}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="DogRemix"
        component={DogRemix}
        durationInFrames={841}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="DogSwapRemix"
        component={DogRemix}
        defaultProps={{ src: 'dog-source-face.mp4' }}
        durationInFrames={841}
        fps={30}
        width={720}
        height={1280}
      />
    </>
  );
};
