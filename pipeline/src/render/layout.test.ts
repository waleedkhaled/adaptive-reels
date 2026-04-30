import { reel } from '@reels/tokens';
import { describe, expect, it } from 'vitest';
import {
  fitCode,
  fitSteps,
  groupCaptions,
  layoutFlowDiagram,
  planLayout,
  TEXT_WIDTH,
  tokenize,
  VISUAL_BOX,
  wrapBalanced,
  type FlowLayout,
  type Measure,
} from './layout';
import type { ReelPart } from './props';

/** Display fonts at half an em per character, Mono NL at 0.6 em: close to the real fonts. */
const measure: Measure = (text, font) =>
  [...text].length * font.size * (font.stack[0]!.startsWith('Mono') ? 0.6 : 0.5);
const mono = (line: string, size: number) => [...line].length * size * 0.6;

describe('wrapBalanced', () => {
  const widths = [100, 100, 100, 100, 100, 100];
  const width = (i: number, j: number) =>
    widths.slice(i, j).reduce((s, w) => s + w, 0) + (j - i - 1) * 10;

  it('uses the fewest lines, then evens them out', () => {
    // Greedy would give 5 + 1 words at 550 px; balanced gives 3 + 3.
    expect(wrapBalanced(6, width, 550)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
    expect(wrapBalanced(6, width, 1000)).toEqual([[0, 1, 2, 3, 4, 5]]);
  });

  it('returns null when one token alone is too wide', () => {
    expect(wrapBalanced(6, width, 90)).toBeNull();
  });

  it('breaks long words after hyphens only when asked', () => {
    expect(tokenize('Idempotency-Key header')).toHaveLength(2);
    expect(tokenize('Idempotency-Key header', true).map((t) => t.text)).toEqual([
      'Idempotency-',
      'Key',
      'header',
    ]);
  });
});

describe('type steps', () => {
  const steps = reel.hookSteps;
  const maxLines = (s: { size: number }) => (s.size === 48 ? 6 : 5);
  const fit = (text: string) =>
    fitSteps(tokenize(text), steps, maxLines, TEXT_WIDTH, reel.fontStack.display700, measure);

  it('picks the largest hook step that fits 5 lines', () => {
    expect(fit('A short hook.')!.step.size).toBe(72);
    // 18 words take 6 lines at 72 px with this measure, 5 at 64 px.
    expect(fit('word '.repeat(18).trim())!.step.size).toBe(64);
  });

  it('fails instead of shrinking below the last step', () => {
    expect(fit('word '.repeat(80).trim())).toBeNull();
  });
});

describe('caption groups', () => {
  const words = (s: string) => s.split(' ');

  it('keeps groups to 7 words and about 48 characters within 2 lines', () => {
    const text =
      'If you mutate a state object directly and then call the setter, React may skip the re-render entirely.';
    const groups = groupCaptions(words(text), measure);
    if (typeof groups === 'string') throw new Error(groups);
    for (const g of groups) {
      expect(g.last - g.first + 1).toBeLessThanOrEqual(reel.caption.maxWords);
      const chars = words(text)
        .slice(g.first, g.last + 1)
        .join(' ').length;
      expect(chars).toBeLessThanOrEqual(reel.caption.maxChars);
      expect(g.lines.length).toBeLessThanOrEqual(reel.caption.maxLines);
    }
    // Every word appears exactly once, in order.
    expect(groups.flatMap((g) => g.lines.flatMap((l) => l.words))).toEqual(
      words(text).map((_, i) => i),
    );
  });

  it('never crosses a sentence end and splits a sentence evenly', () => {
    const groups = groupCaptions(words('One two three. a b c d e f g h'), measure);
    if (typeof groups === 'string') throw new Error(groups);
    expect(groups.map((g) => [g.first, g.last])).toEqual([
      [0, 2],
      [3, 6],
      [7, 10],
    ]);
  });

  it('gives each word its x offset and width for the playhead', () => {
    const groups = groupCaptions(words('Find it in about ten steps.'), measure);
    if (typeof groups === 'string') throw new Error(groups);
    const line = groups[0]!.lines[0]!;
    expect(line.x[0]).toBe(0);
    expect(line.x[1]).toBe(measure('Find ', { stack: reel.fontStack.display600, size: 42 }));
    expect(line.w[1]).toBe(measure('it', { stack: reel.fontStack.display600, size: 42 }));
  });

  it('reports a word wider than the rail', () => {
    expect(groupCaptions(['x'.repeat(40)], measure)).toMatch(/wider than the 640 px rail/);
  });
});

describe('code steps', () => {
  const lines = (cols: number, n = 5) => Array.from({ length: n }, () => 'x'.repeat(cols));

  it('uses 28 px on the axis up to 37 columns, 26 px at inset 24 up to 42', () => {
    expect(fitCode(lines(37), mono, { floor: 26, mistake: false })).toMatchObject({
      size: 28,
      inset: 40,
    });
    expect(fitCode(lines(38), mono, { floor: 26, mistake: false })).toMatchObject({
      size: 26,
      inset: 24,
    });
    expect(fitCode(lines(42), mono, { floor: 26, mistake: false })).toMatchObject({ size: 26 });
  });

  it('never goes under the floor; 25 and 24 px only for exceptions', () => {
    expect(fitCode(lines(43), mono, { floor: 26, mistake: false })).toHaveProperty('problem');
    expect(fitCode(lines(44), mono, { floor: 24, mistake: false })).toMatchObject({ size: 25 });
    expect(fitCode(lines(46), mono, { floor: 24, mistake: false })).toMatchObject({ size: 24 });
    expect(fitCode(lines(47), mono, { floor: 24, mistake: false })).toHaveProperty('problem');
  });

  it('counts the Mistake label against the 580 px box', () => {
    const tall = lines(30, 12);
    expect(fitCode(tall, mono, { floor: 26, mistake: false })).toMatchObject({ size: 28 });
    expect(fitCode(tall, mono, { floor: 26, mistake: true })).toMatchObject({ size: 26 });
    const band = fitCode(tall, mono, { floor: 26, mistake: true });
    expect('height' in band && band.height).toBeLessThanOrEqual(VISUAL_BOX.height);
  });
});

describe('flow diagrams', () => {
  const node = (id: string, label = id) => ({ id, label });
  const expectFlow = (f: FlowLayout | string): FlowLayout => {
    if (typeof f === 'string') throw new Error(f);
    return f;
  };
  const plates = (f: FlowLayout) => f.arrows.flatMap((a) => (a.label ? [a.label] : []));
  const apart = (p: { cx: number; cy: number; w: number; h: number }, q: typeof p) =>
    Math.abs(p.cx - q.cx) >= (p.w + q.w) / 2 || Math.abs(p.cy - q.cy) >= (p.h + q.h) / 2;

  it('lays a chain out top to bottom on the left axis, inside the visual box', () => {
    const f = expectFlow(
      layoutFlowDiagram(
        [node('a', 'Client'), node('b', 'Server'), node('c', 'Store')],
        [
          { from: 'a', to: 'b', label: 'POST' },
          { from: 'b', to: 'c' },
        ],
        measure,
      ),
    );
    expect(f.boxes.map((b) => b.x)).toEqual([0, 0, 0]);
    expect(f.boxes[1]!.y).toBeGreaterThan(f.boxes[0]!.y + f.boxes[0]!.h);
    expect(
      f.boxes.every((b) => b.w <= reel.flow.boxMaxWidth && b.h >= reel.flow.boxMinHeight),
    ).toBe(true);
    expect(f.top).toBeGreaterThanOrEqual(VISUAL_BOX.top);
    expect(f.top + f.height).toBeLessThanOrEqual(VISUAL_BOX.top + VISUAL_BOX.height);
    expect(f.arrows).toHaveLength(2);
  });

  it('keeps the labels of a fork apart', () => {
    const f = expectFlow(
      layoutFlowDiagram(
        [node('l', 'Rate Limiter'), node('s', 'Service'), node('r', '429 Response')],
        [
          { from: 'l', to: 's', label: 'within limit' },
          { from: 'l', to: 'r', label: 'over limit' },
        ],
        measure,
      ),
    );
    const [p, q] = plates(f);
    expect(apart(p!, q!)).toBe(true);
  });

  it('loops a back edge around the right side', () => {
    const f = expectFlow(
      layoutFlowDiagram(
        [node('w', 'Worker'), node('q', 'Queue'), node('c', 'Client')],
        [
          { from: 'w', to: 'q' },
          { from: 'q', to: 'c' },
          { from: 'c', to: 'w', label: 'result later' },
        ],
        measure,
      ),
    );
    const loop = f.arrows.find((a) => a.label)!;
    const right = Math.max(...f.boxes.map((b) => b.x + b.w));
    expect(loop.label!.cx - loop.label!.w / 2).toBeGreaterThan(right);
    expect(loop.label!.cx + loop.label!.w / 2).toBeLessThanOrEqual(TEXT_WIDTH);
  });

  it('runs an edge between neighbours on the last level underneath them', () => {
    const f = expectFlow(
      layoutFlowDiagram(
        [node('q', 'Request'), node('c', 'Cache'), node('r', 'Return'), node('x', 'Compute')],
        [
          { from: 'q', to: 'c' },
          { from: 'c', to: 'r', label: 'hit' },
          { from: 'c', to: 'x', label: 'miss' },
          { from: 'x', to: 'r', label: 'store' },
        ],
        measure,
      ),
    );
    const store = f.arrows.find((a) => a.label?.text === 'store')!;
    const bottom = Math.max(...f.boxes.map((b) => b.y + b.h));
    expect(store.label!.cy).toBeGreaterThan(bottom);
    const all = plates(f);
    for (const [i, p] of all.entries())
      for (const q of all.slice(i + 1)) expect(apart(p, q)).toBe(true);
  });

  it('fails instead of drawing what it cannot place', () => {
    expect(layoutFlowDiagram([node('a'), node('b')], [{ from: 'a', to: 'zzz' }], measure)).toMatch(
      /unknown/,
    );
    expect(
      layoutFlowDiagram(
        [node('a', 'W'.repeat(18)), node('b')],
        [{ from: 'a', to: 'b' }],
        (text, font) => [...text].length * font.size,
      ),
    ).toMatch(/does not fit its box/);
  });
});

describe('planLayout', () => {
  const part = (over: Partial<ReelPart>): ReelPart => ({
    kind: 'segment',
    startFrame: 9,
    durationFrames: 90,
    audio: 'a.mp3',
    onScreen: '',
    visual: { kind: 'kinetic_text' },
    image: null,
    codeFloor: 26,
    words: [{ text: 'Hello', startMs: 0, endMs: 300 }],
    ...over,
  });
  const m = { text: measure, equation: () => 'not used' };

  it('puts kinetic text in the visual box and leaves the on-screen region empty', () => {
    const layout = planLayout([part({ onScreen: 'Default ≠ optional' })], m);
    const seg = layout.parts[0]!;
    expect(layout.problems).toEqual([]);
    expect(seg.kind === 'segment' && seg.onScreen).toBeNull();
    expect(seg.kind === 'segment' && seg.kinetic?.size).toBe(72);
  });

  it('sets on-screen text under a visual at the first step that fits 2 lines', () => {
    const layout = planLayout(
      [
        part({
          onScreen: 'Direct mutation → React sees no change',
          visual: {
            kind: 'code',
            language: 'ts',
            code: 'const a = 1;',
            highlight_lines: [],
            check: 'compiles',
            shows_mistake: false,
          },
        }),
      ],
      m,
    );
    const seg = layout.parts[0]!;
    expect(seg.kind === 'segment' && seg.onScreen?.top).toBe(reel.regions.onScreen.top);
    expect(seg.kind === 'segment' && seg.code?.size).toBe(28);
  });

  it('fails on overflow instead of shrinking type', () => {
    const layout = planLayout(
      [
        part({
          onScreen: 'x'.repeat(60),
          visual: { kind: 'equation', latex: 'x' },
        }),
      ],
      m,
    );
    expect(layout.problems.join('\n')).toMatch(/does not fit 2 lines at 36 px/);
    expect(layout.problems.join('\n')).toMatch(/not used/);
  });
});
