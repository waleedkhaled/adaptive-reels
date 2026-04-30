import { reel } from '@reels/tokens';
import { describe, expect, it } from 'vitest';
import { leadInFrames, VIDEO } from '../video';
import { absoluteCaptions, buildReelProps } from './props';

const input = () => ({
  reelId: 'x--intro',
  title: 'X',
  topic: 'T',
  angle: 'intro' as const,
  template: 'visual-focus',
  hook: 'Your app crashed — read the trace.',
  segments: [
    {
      on_screen_text: 'State is a snapshot — stale reads',
      visual: {
        kind: 'code' as const,
        language: 'ts' as const,
        code: 'const a = 1; // a — b\n\n',
        highlight_lines: [],
        check: 'compiles' as const,
        shows_mistake: false,
      },
    },
  ],
  timing: [
    {
      kind: 'hook' as const,
      segment: -1,
      file: 'reels/x--intro/audio/part-0.mp3',
      duration_ms: 1000,
      words: [
        { text: 'crashed—', startMs: 300, endMs: 600 },
        { text: 'read', startMs: 600, endMs: 900 },
      ],
    },
    {
      kind: 'segment' as const,
      segment: 0,
      file: 'reels/x--intro/audio/part-1.mp3',
      duration_ms: 2000,
      words: [{ text: 'State', startMs: 310, endMs: 700 }],
    },
  ],
  images: {},
  fps: VIDEO.fps,
  gapMs: VIDEO.gapMs,
  leadInFrames: leadInFrames(),
});

describe('reel props', () => {
  it('starts with 0.3 s of empty ground (9 frames at 30 fps)', () => {
    expect(leadInFrames()).toBe(reel.leadInFrames);
    const props = buildReelProps(input());
    expect(props.parts[0]!.startFrame).toBe(9);
    // (1000 + 250) ms at 30 fps = 37.5 -> 38 frames.
    expect(props.parts[1]!.startFrame).toBe(9 + 38);
    expect(props.totalFrames).toBe(9 + 38 + 68);
  });

  it('shifts caption timings by the lead-in', () => {
    const captions = absoluteCaptions(buildReelProps(input()));
    expect(captions[0]).toEqual({ word: 'crashed:', start_ms: 600, end_ms: 900 });
    expect(captions[2]!.start_ms).toBe(Math.round((47 / 30) * 1000) + 310);
  });

  it('shows strings without em dashes; the code is trimmed for display', () => {
    const props = buildReelProps(input());
    expect(props.parts[0]!.onScreen).toBe('Your app crashed: read the trace.');
    expect(props.parts[1]!.onScreen).toBe('State is a snapshot: stale reads');
    const v = props.parts[1]!.visual!;
    expect(v.kind === 'code' && v.code).toBe('const a = 1; // a: b');
  });

  it('applies a lower code floor only to listed segments', () => {
    expect(buildReelProps(input()).parts[1]!.codeFloor).toBe(reel.minCode);
    expect(buildReelProps({ ...input(), codeFloors: { 0: 24 } }).parts[1]!.codeFloor).toBe(24);
  });
});
