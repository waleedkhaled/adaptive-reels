// Turns a reel's text, timing and image records into Remotion input props.
// Pure: imported by both the Node renderer and the Remotion bundle.
// Every visible string is the display version (em dashes replaced); the
// narration audio is untouched. All timings include the empty lead-in.
import type { Angle, Visual } from '@reels/schemas';
import { reel } from '@reels/tokens';
import type { ReelLayout } from './layout';
import { displayCode } from './syntax';
import { replaceEmDashes, replaceEmDashesInWords } from './text';

export interface PartWord {
  text: string;
  /** Relative to the start of the part. */
  startMs: number;
  endMs: number;
}

export interface ReelPart {
  kind: 'hook' | 'segment';
  startFrame: number;
  durationFrames: number;
  /** Path inside the bundle's public dir (library/). */
  audio: string;
  /** The hook (hook part) or the segment's on-screen text, as shown. */
  onScreen: string;
  /** The visual as shown: code with tabs expanded and em dashes replaced. */
  visual: Visual | null;
  image: string | null;
  /** Smallest code size this part's snippet may use (reel.minCode unless listed as an exception). */
  codeFloor: number;
  /** Spoken words as shown (captions, or the hook's words). */
  words: PartWord[];
}

export interface ReelProps {
  [key: string]: unknown;
  reelId: string;
  title: string;
  topic: string;
  angle: Angle;
  template: string;
  fps: number;
  /** Frames of empty ground before the hook (0.3 s). */
  leadInFrames: number;
  totalFrames: number;
  parts: ReelPart[];
  /** Filled by the dry layout pass in the render browser (Root.tsx calculateMetadata). */
  layout: ReelLayout | null;
}

export interface PropsInput {
  reelId: string;
  title: string;
  topic: string;
  angle: Angle;
  template: string;
  hook: string;
  segments: { on_screen_text: string; visual: Visual }[];
  timing: {
    kind: 'hook' | 'segment';
    segment: number;
    file: string;
    duration_ms: number;
    words: PartWord[];
  }[];
  images: Record<string, string>;
  fps: number;
  gapMs: number;
  leadInFrames: number;
  /** Segment index -> code floor, for snippets allowed below reel.minCode. */
  codeFloors?: Record<number, number>;
}

/** A visual as it is shown in the reel. */
export function displayVisual(visual: Visual): Visual {
  if (visual.kind === 'code') return { ...visual, code: replaceEmDashes(displayCode(visual.code)) };
  if (visual.kind === 'flow') {
    return {
      ...visual,
      nodes: visual.nodes.map((n) => ({ ...n, label: replaceEmDashes(n.label) })),
      edges: visual.edges.map((e) => (e.label ? { ...e, label: replaceEmDashes(e.label) } : e)),
    };
  }
  return visual;
}

export function buildReelProps(input: PropsInput): ReelProps {
  let frame = input.leadInFrames;
  const parts = input.timing.map((t) => {
    const durationFrames = Math.ceil(((t.duration_ms + input.gapMs) / 1000) * input.fps);
    const segment = t.kind === 'segment' ? input.segments[t.segment] : undefined;
    const shown = replaceEmDashesInWords(t.words.map((w) => w.text));
    const part: ReelPart = {
      kind: t.kind,
      startFrame: frame,
      durationFrames,
      audio: t.file,
      onScreen: replaceEmDashes(segment ? segment.on_screen_text : input.hook),
      visual: segment ? displayVisual(segment.visual) : null,
      image: segment ? (input.images[String(t.segment)] ?? null) : null,
      codeFloor: (segment && input.codeFloors?.[t.segment]) ?? reel.minCode,
      words: t.words.map((w, i) => ({ ...w, text: shown[i]! })),
    };
    frame += durationFrames;
    return part;
  });
  return {
    reelId: input.reelId,
    title: input.title,
    topic: input.topic,
    angle: input.angle,
    template: input.template,
    fps: input.fps,
    leadInFrames: input.leadInFrames,
    totalFrames: frame,
    parts,
    layout: null,
  };
}

/** Word timings on the whole-reel timeline (lead-in included), for the manifest and in-app captions. */
export function absoluteCaptions(
  props: ReelProps,
): { word: string; start_ms: number; end_ms: number }[] {
  return props.parts.flatMap((p) => {
    const offset = Math.round((p.startFrame / props.fps) * 1000);
    return p.words.map((w) => ({
      word: w.text,
      start_ms: offset + w.startMs,
      end_ms: offset + w.endMs,
    }));
  });
}
