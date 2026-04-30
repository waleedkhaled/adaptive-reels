// The reel (DESIGN.md "Reel safe-zone contract"): flat bg.base ground, one
// left axis at x 40, nothing baked in the top 120 or bottom 160 px, frames 0
// to 8 empty. The hook fills y 120 to 1120, each word fading in as it is
// spoken. A segment shows its visual in the box at y 136 to 716, on-screen
// text at 748, the 2 px rule at 916 and the caption rail bottom-anchored at
// 1096. Every position and size comes from the dry layout pass (layout.ts);
// every entrance is opacity only.
import { Fragment, useEffect, useMemo, useState } from 'react';
import 'katex/dist/katex.min.css';
import { reel } from '@reels/tokens';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Html5Audio,
  Img,
  Sequence,
  staticFile,
} from 'remotion';
import {
  AXIS_X,
  STACK,
  TEXT_WIDTH,
  type CaptionGroup,
  type EquationFit,
  type HookLayout,
  type SegmentLayout,
  type TextBlock,
} from '../layout';
import type { PartWord, ReelPart, ReelProps } from '../props';
import { CodeBand } from './Code';
import { FlowDiagram } from './Flow';
import { equationHtml, KATEX_EM, katexFontsReady } from './measure';
import { color, cssStack, msToFrame, TEXT, useMotion } from './theme';

function Hook({ words, layout }: { words: PartWord[]; layout: HookLayout }) {
  const { fps, fade } = useMotion();
  return (
    <div
      style={{
        ...TEXT,
        position: 'absolute',
        left: AXIS_X,
        top: layout.top,
        width: TEXT_WIDTH,
        color: color.text.primary,
        fontFamily: cssStack(STACK.display700),
        fontSize: layout.size,
        lineHeight: `${layout.lineHeight}px`,
      }}
    >
      {layout.lines.map((line, i) => (
        <div key={i} style={{ height: layout.lineHeight }}>
          {line.map((k, j) => (
            <Fragment key={k}>
              {j > 0 ? ' ' : null}
              <span style={{ opacity: fade(msToFrame(words[k]!.startMs, fps)) }}>
                {words[k]!.text}
              </span>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function TextLines({ block }: { block: TextBlock }) {
  const { fade } = useMotion();
  return (
    <div
      style={{
        ...TEXT,
        position: 'absolute',
        left: AXIS_X,
        top: block.top,
        width: TEXT_WIDTH,
        color: color.text.primary,
        fontFamily: cssStack(STACK.display700),
        fontSize: block.size,
        lineHeight: `${block.lineHeight}px`,
        opacity: fade(),
      }}
    >
      {block.lines.map((line, i) => (
        <div key={i} style={{ height: block.lineHeight }}>
          {line}
        </div>
      ))}
    </div>
  );
}

/**
 * Two levels: words up to and including the active one in text.primary,
 * upcoming words in text.secondary, and a 4 px playhead 8 px under the active
 * word's baseline. A group appears (fades in) when its first word is spoken.
 */
function Captions({
  words,
  groups,
  baseline,
}: {
  words: PartWord[];
  groups: CaptionGroup[];
  baseline: number;
}) {
  const { frame, fps, fade } = useMotion();
  const ms = (frame / fps) * 1000;
  let g = 0;
  for (let i = 1; i < groups.length; i++) if (words[groups[i]!.first]!.startMs <= ms) g = i;
  const group = groups[g];
  if (!group) return null;
  const appear = g === 0 ? 0 : msToFrame(words[group.first]!.startMs, fps);
  let active = -1;
  for (let k = group.first; k <= group.last; k++) if (words[k]!.startMs <= ms) active = k;
  const { size, lineHeight, playhead } = reel.caption;
  return (
    <div
      style={{
        ...TEXT,
        position: 'absolute',
        left: AXIS_X,
        top: reel.regions.captionRail.bottom - group.lines.length * lineHeight,
        width: TEXT_WIDTH,
        fontFamily: cssStack(STACK.display600),
        fontSize: size,
        lineHeight: `${lineHeight}px`,
        opacity: fade(appear),
      }}
    >
      {group.lines.map((line, li) => {
        const at = line.words.indexOf(active);
        return (
          <div key={li} style={{ position: 'relative', height: lineHeight }}>
            {line.words.map((k, j) => (
              <Fragment key={k}>
                {j > 0 ? ' ' : null}
                <span style={{ color: k <= active ? color.text.primary : color.text.secondary }}>
                  {words[k]!.text}
                </span>
              </Fragment>
            ))}
            {at !== -1 && (
              <div
                style={{
                  position: 'absolute',
                  left: line.x[at],
                  width: line.w[at],
                  top: baseline + 8,
                  height: playhead,
                  background: color.text.primary,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Equation({ latex, fit }: { latex: string; fit: EquationFit & { top: number } }) {
  const { fade } = useMotion();
  const [handle] = useState(() => delayRender(`KaTeX fonts for ${latex}`));
  useEffect(() => {
    katexFontsReady().then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  }, [handle]);
  const html = useMemo(() => equationHtml(latex), [latex]);
  return (
    <div
      style={{
        position: 'absolute',
        left: AXIS_X,
        top: fit.top,
        width: TEXT_WIDTH,
        color: color.text.primary,
        fontSize: fit.size / KATEX_EM,
        whiteSpace: fit.wrap ? 'normal' : 'nowrap',
        opacity: fade(),
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Segment({
  part,
  layout,
  baseline,
}: {
  part: ReelPart;
  layout: SegmentLayout;
  baseline: number;
}) {
  const { fade } = useMotion();
  const v = part.visual;
  return (
    <>
      {layout.code && v?.kind === 'code' && <CodeBand code={layout.code} language={v.language} />}
      {layout.flow && <FlowDiagram flow={layout.flow} />}
      {layout.equation && v?.kind === 'equation' && (
        <Equation latex={v.latex} fit={layout.equation} />
      )}
      {layout.image && part.image && (
        <Img
          src={staticFile(part.image)}
          style={{
            position: 'absolute',
            left: AXIS_X,
            top: layout.image.top,
            width: TEXT_WIDTH,
            height: layout.image.height,
            objectFit: 'cover',
            borderRadius: reel.flow.radius,
            opacity: fade(),
          }}
        />
      )}
      {layout.kinetic && <TextLines block={layout.kinetic} />}
      {layout.onScreen && <TextLines block={layout.onScreen} />}
      <Captions words={part.words} groups={layout.captions} baseline={baseline} />
    </>
  );
}

/** The 2 px rule between what is shown and what is spoken. */
function Rule() {
  const { fade } = useMotion();
  return (
    <div
      style={{
        position: 'absolute',
        left: AXIS_X,
        top: reel.regions.rule.y,
        width: TEXT_WIDTH,
        height: reel.regions.rule.height,
        background: color.line.hairline,
        opacity: fade(),
      }}
    />
  );
}

export function Reel(props: ReelProps) {
  const layout = props.layout;
  const firstSegment = props.parts.find((p) => p.kind === 'segment');
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg.base, ...TEXT }}>
      {layout &&
        props.parts.map((part, i) => {
          const laid = layout.parts[i]!;
          return (
            <Sequence key={i} from={part.startFrame} durationInFrames={part.durationFrames}>
              {laid.kind === 'hook' ? (
                <Hook words={part.words} layout={laid} />
              ) : (
                <Segment part={part} layout={laid} baseline={layout.captionBaseline} />
              )}
              <Html5Audio src={staticFile(part.audio)} />
            </Sequence>
          );
        })}
      {layout && firstSegment && (
        <Sequence from={firstSegment.startFrame}>
          <Rule />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
