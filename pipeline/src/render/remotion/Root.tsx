import { Composition, type CalculateMetadataFunction } from 'remotion';
import { reel } from '@reels/tokens';
import { planLayout } from '../layout';
import type { ReelProps } from '../props';
import { leadInFrames, VIDEO } from '../../video';
import { fontsReady } from './fonts';
import { baselineOffset, domTextMeasure, measureEquation } from './measure';
import { Reel } from './Reel';

const EMPTY: ReelProps = {
  reelId: 'empty--intro',
  title: 'Empty',
  topic: 'Software engineering',
  angle: 'intro',
  template: 'visual-focus',
  fps: VIDEO.fps,
  leadInFrames: leadInFrames(),
  totalFrames: leadInFrames() + 1,
  parts: [],
  layout: null,
};

/**
 * The dry layout pass, in the render browser with the real fonts loaded: every
 * block is measured and placed before any frame renders. Problems are returned
 * in the props, so the renderer can fail the reel without rendering it.
 */
const calculateMetadata: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  await fontsReady;
  const latex = [
    ...new Set(props.parts.flatMap((p) => (p.visual?.kind === 'equation' ? [p.visual.latex] : []))),
  ];
  const equations = Object.fromEntries(
    await Promise.all(latex.map(async (l) => [l, await measureEquation(l)] as const)),
  );
  const layout = planLayout(props.parts, {
    text: domTextMeasure(),
    equation: (l) => equations[l] ?? 'equation was not measured',
    captionBaseline: baselineOffset(
      reel.fontStack.display600,
      reel.caption.size,
      reel.caption.lineHeight,
    ),
  });
  return {
    durationInFrames: Math.max(1, props.totalFrames),
    fps: props.fps,
    props: { ...props, layout },
  };
};

export function Root() {
  return (
    <Composition
      id="Reel"
      component={Reel}
      width={VIDEO.width}
      height={VIDEO.height}
      fps={VIDEO.fps}
      durationInFrames={EMPTY.totalFrames}
      defaultProps={EMPTY}
      calculateMetadata={calculateMetadata}
    />
  );
}
