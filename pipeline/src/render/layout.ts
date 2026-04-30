// The dry layout pass (DESIGN.md "Reel safe-zone contract", "Build checks").
// Pure: text widths come from a `measure` callback, which the Remotion bundle
// implements with the real fonts in the render browser and tests fake. Every
// block picks the largest type step that fits by measured width; when nothing
// fits, the reel gets a problem and fails instead of shrinking type.
import type { Visual } from '@reels/schemas';
import { reel, type FontFamily } from '@reels/tokens';
import { layoutFlow } from '../catalogue';
import type { PartWord, ReelPart } from './props';

export interface FontSpec {
  stack: readonly FontFamily[];
  size: number;
}
export type Measure = (text: string, font: FontSpec) => number;

export const AXIS_X = reel.inset;
export const TEXT_WIDTH = reel.canvas.width - 2 * reel.inset;
export const VISUAL_BOX = {
  top: reel.regions.visualBox.top,
  height: reel.regions.visualBox.bottom - reel.regions.visualBox.top,
};
export const HOOK_BOX = {
  top: reel.regions.hook.top,
  height: reel.regions.hook.bottom - reel.regions.hook.top,
};

export const STACK = {
  display600: reel.fontStack.display600,
  display700: reel.fontStack.display700,
  code: ['MonoNL-SemiBold'],
  codeKeyword: ['MonoNL-ExtraBold'],
  edgeLabel: ['MonoNL-SemiBold'],
  mistake: ['MonoNL-ExtraBold'],
} as const satisfies Record<string, readonly FontFamily[]>;

/** Code band geometry not covered by the tokens (DESIGN.md "Code block"). */
export const CODE_BAND = { rule: 2, padY: 24, labelGap: 12, xmark: 18, xmarkGap: 10 } as const;

/** Flow geometry not covered by the tokens (DESIGN.md "Flow diagram"). */
export const FLOW = {
  padX: 16,
  padY: 8,
  slotGap: 16,
  minBoxWidth: 120,
  head: { length: 14, halfWidth: 7 },
  gap: { min: 56, minWithLabels: 72, max: 112 },
  plate: { padX: 8, padY: 4 },
  loop: { clearance: 8, step: 40, bare: 32, corner: 16 },
  under: { depth: 48 },
  /** Arrows leaving one box fork from a shared point; arrows into one box land side by side. */
  spread: { start: 0, end: 40 },
} as const;

// ---------------------------------------------------------------------------
// Line breaking

/**
 * Breaks `n` tokens into lines no wider than `maxWidth`, with the fewest lines
 * and, among those, the narrowest widest line (a balanced rag). `width(i, j)`
 * measures tokens i..j-1 set as one line. Null when one token alone is too wide.
 */
export function wrapBalanced(
  n: number,
  width: (from: number, to: number) => number,
  maxWidth: number,
): number[][] | null {
  if (n === 0) return [];
  // Fewest lines, greedily.
  let lines = 0;
  for (let i = 0; i < n;) {
    let j = i + 1;
    if (width(i, j) > maxWidth) return null;
    while (j < n && width(i, j + 1) <= maxWidth) j++;
    lines++;
    i = j;
  }
  // Minimise the widest line over exactly `lines` lines.
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array(lines + 1).fill(Infinity));
  const from: number[][] = Array.from({ length: n + 1 }, () => new Array(lines + 1).fill(-1));
  best[0]![0] = 0;
  for (let l = 1; l <= lines; l++) {
    for (let j = 1; j <= n; j++) {
      for (let i = j - 1; i >= 0; i--) {
        const w = width(i, j);
        if (w > maxWidth) break;
        const cost = Math.max(best[i]![l - 1]!, w);
        if (cost < best[j]![l]! - 1e-6) {
          best[j]![l] = cost;
          from[j]![l] = i;
        }
      }
    }
  }
  const out: number[][] = [];
  for (let j = n, l = lines; l > 0; l--) {
    const i = from[j]![l]!;
    out.unshift(Array.from({ length: j - i }, (_, k) => i + k));
    j = i;
  }
  return out;
}

export interface Token {
  text: string;
  /** A space follows this token unless it ends the line. */
  space: boolean;
}

/** Words of a string; with `hyphens`, long words may also break after a hyphen or slash. */
export function tokenize(text: string, hyphens = false): Token[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!hyphens) return words.map((w) => ({ text: w, space: true }));
  return words.flatMap((w) => {
    const parts = w.split(/(?<=[-/])(?=.)/);
    return parts.map((p, i) => ({ text: p, space: i === parts.length - 1 }));
  });
}

export function joinTokens(tokens: Token[]): string {
  return tokens.map((t, i) => t.text + (t.space && i < tokens.length - 1 ? ' ' : '')).join('');
}

/** Memoised width of token ranges in one font. */
function rangeWidth(tokens: Token[], font: FontSpec, measure: Measure) {
  const memo = new Map<number, number>();
  return (i: number, j: number) => {
    const key = i * 4096 + j;
    let w = memo.get(key);
    if (w === undefined) {
      w = measure(joinTokens(tokens.slice(i, j)), font);
      memo.set(key, w);
    }
    return w;
  };
}

export interface TypeStep {
  size: number;
  lineHeight: number;
}

/** A block of text: its type step and lines, top-left on the canvas. */
export interface TextBlock {
  size: number;
  lineHeight: number;
  top: number;
  lines: string[];
}

/**
 * The first (largest) step whose balanced wrap fits `maxLines(step)` lines in
 * `maxWidth`. Returns token-index lines, or null when no step fits.
 */
export function fitSteps(
  tokens: Token[],
  steps: readonly TypeStep[],
  maxLines: (step: TypeStep) => number,
  maxWidth: number,
  stack: readonly FontFamily[],
  measure: Measure,
): { step: TypeStep; lines: number[][] } | null {
  for (const step of steps) {
    const lines = wrapBalanced(
      tokens.length,
      rangeWidth(tokens, { stack, size: step.size }, measure),
      maxWidth,
    );
    if (lines && lines.length <= maxLines(step)) return { step, lines };
  }
  return null;
}

/** Hook and kinetic text: 5 lines, 6 at the smallest step (DESIGN.md "Baked text"). */
const hookLines = (step: TypeStep) =>
  step.size === reel.hookSteps[reel.hookSteps.length - 1]!.size ? 6 : 5;

// ---------------------------------------------------------------------------
// Captions

export interface CaptionLine {
  /** Word indices into the part's words. */
  words: number[];
  /** x of each word from the axis, and its width, for the playhead bar. */
  x: number[];
  w: number[];
}

export interface CaptionGroup {
  first: number;
  last: number;
  lines: CaptionLine[];
}

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

/**
 * Groups a part's caption words (DESIGN.md "Captions"): at most 7 words and
 * about 48 characters, at most 2 lines by measured width. Groups never cross a
 * sentence end; within a sentence the fewest groups are used, as even as
 * possible. Returns a problem string when a single word cannot fit a line.
 */
export function groupCaptions(words: string[], measure: Measure): CaptionGroup[] | string {
  const { maxWords, maxChars, maxLines, size } = reel.caption;
  const font: FontSpec = { stack: STACK.display600, size };
  const tokens: Token[] = words.map((w) => ({ text: w, space: true }));
  const width = rangeWidth(tokens, font, measure);
  const chars = (i: number, j: number) => joinTokens(tokens.slice(i, j)).length;
  const lineCache = new Map<number, number[][] | null>();
  const wrapGroup = (i: number, j: number) => {
    const key = i * 4096 + j;
    if (!lineCache.has(key)) {
      const lines = wrapBalanced(j - i, (a, b) => width(i + a, i + b), TEXT_WIDTH);
      lineCache.set(key, lines && lines.map((line) => line.map((k) => k + i)));
    }
    return lineCache.get(key)!;
  };
  const valid = (i: number, j: number) => {
    const lines = wrapGroup(i, j);
    if (!lines || lines.length > maxLines) return false;
    // A lone over-long word is still a valid group as long as it fits one line.
    return j - i === 1 || (j - i <= maxWords && chars(i, j) <= maxChars);
  };

  const groups: CaptionGroup[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start + 1;
    while (end < words.length && !SENTENCE_END.test(words[end - 1]!)) end++;
    // Fewest groups for words start..end-1, then the most even character counts.
    const n = end - start;
    const count = new Array<number>(n + 1).fill(Infinity);
    const cost = new Array<number>(n + 1).fill(Infinity);
    const prev = new Array<number>(n + 1).fill(-1);
    count[0] = 0;
    cost[0] = 0;
    for (let j = 1; j <= n; j++) {
      for (let i = j - 1; i >= 0 && j - i <= Math.max(maxWords, 1); i--) {
        if (count[i] === Infinity || !valid(start + i, start + j)) continue;
        const c = chars(start + i, start + j);
        const better =
          count[i]! + 1 < count[j]! || (count[i]! + 1 === count[j]! && cost[i]! + c * c < cost[j]!);
        if (better) {
          count[j] = count[i]! + 1;
          cost[j] = cost[i]! + c * c;
          prev[j] = i;
        }
      }
    }
    if (count[n] === Infinity) {
      const wide = words.slice(start, end).find((w) => measure(w, font) > TEXT_WIDTH);
      return `caption word "${wide ?? words[start]}" is wider than the ${TEXT_WIDTH} px rail at ${size} px`;
    }
    const cuts: number[] = [];
    for (let j = n; j > 0; j = prev[j]!) cuts.unshift(prev[j]!);
    cuts.push(n);
    for (let g = 0; g < cuts.length - 1; g++) {
      const first = start + cuts[g]!;
      const last = start + cuts[g + 1]! - 1;
      const lines = wrapGroup(first, last + 1)!.map((line) => ({
        words: line,
        x: line.map((k, idx) =>
          idx === 0 ? 0 : measure(`${joinTokens(tokens.slice(line[0]!, k))} `, font),
        ),
        w: line.map((k) => measure(words[k]!, font)),
      }));
      groups.push({ first, last, lines });
    }
    start = end;
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Code

export interface CodeLayout {
  size: number;
  inset: number;
  lineHeight: number;
  /** Band top on the canvas and its full height, rules included. */
  top: number;
  height: number;
  mistake: boolean;
  lines: string[];
  /** 1-based highlighted lines. */
  highlight: number[];
}

/**
 * The first code step (DESIGN.md "Code block") whose measured longest line fits
 * the band minus both insets and the guard, and whose band fits the visual box.
 * Steps below `floor` are not tried.
 */
export function fitCode(
  lines: string[],
  lineWidth: (line: string, size: number) => number,
  opts: { floor: number; mistake: boolean },
): { size: number; inset: number; lineHeight: number; height: number } | { problem: string } {
  let widest = 0;
  for (const step of reel.codeSteps) {
    if (step.size < opts.floor) break;
    const available = reel.canvas.width - 2 * step.inset - reel.codeGuard;
    widest = Math.max(...lines.map((l) => lineWidth(l, step.size)), 0);
    const lineHeight = step.size * reel.codeLineHeight;
    const height = codeBandHeight(lines.length, lineHeight, opts.mistake);
    if (widest <= available && height <= VISUAL_BOX.height)
      return { size: step.size, inset: step.inset, lineHeight, height };
  }
  const longest = Math.max(...lines.map((l) => [...l].length), 0);
  return {
    problem: `code does not fit at ${opts.floor} px or larger (${lines.length} lines, longest ${longest} columns)`,
  };
}

export function codeBandHeight(lines: number, lineHeight: number, mistake: boolean): number {
  const label = mistake ? reel.mistakeLabel.lineHeight + CODE_BAND.labelGap : 0;
  return 2 * CODE_BAND.rule + 2 * CODE_BAND.padY + label + lines * lineHeight;
}

// ---------------------------------------------------------------------------
// Flow diagram

export interface FlowBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** Entrance order (node order). */
  order: number;
}

export interface FlowPlate {
  text: string;
  /** Centre of the plate. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface FlowArrow {
  path: string;
  head: string;
  label: FlowPlate | null;
  order: number;
}

export interface FlowLayout {
  /** Diagram top on the canvas (x starts at the axis). */
  top: number;
  height: number;
  labelSize: number;
  labelLineHeight: number;
  boxes: FlowBox[];
  arrows: FlowArrow[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Boxes left-aligned on the axis, top to bottom by layer; arrows between
 * adjacent layers drop from the parent's bottom edge to the child's top edge;
 * arrows that go back up or skip a layer loop around the right side; an arrow
 * between neighbours on the last layer runs underneath. Labels sit on knockout
 * plates that may not touch a box or another plate.
 */
export function layoutFlowDiagram(
  nodes: { id: string; label: string }[],
  edges: { from: string; to: string; label?: string }[],
  measure: Measure,
): FlowLayout | string {
  const laid = layoutFlow(nodes, edges);
  const byId = new Map(laid.map((n) => [n.id, n]));
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) return `flow edge ${e.from} -> ${e.to} is unknown`;
    if (e.from === e.to) return `flow edge ${e.from} -> ${e.to} loops on itself`;
  }
  const layers = Math.max(...laid.map((n) => n.layer)) + 1;
  const edgeFont: FontSpec = { stack: STACK.edgeLabel, size: reel.flow.edgeLabel.size };
  const plateOf = (label: string | undefined) =>
    label
      ? {
          text: label,
          w: measure(label, edgeFont) + 2 * FLOW.plate.padX,
          h: reel.flow.edgeLabel.lineHeight + 2 * FLOW.plate.padY,
        }
      : null;

  type Kind = 'down' | 'loop' | 'under';
  const kindOf = (e: { from: string; to: string }): Kind => {
    const a = byId.get(e.from)!.layer;
    const b = byId.get(e.to)!.layer;
    return b === a + 1 ? 'down' : b === a ? 'under' : 'loop';
  };
  const loops = edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => kindOf(e) === 'loop')
    .sort(
      (p, q) =>
        Math.abs(byId.get(p.e.from)!.layer - byId.get(p.e.to)!.layer) -
        Math.abs(byId.get(q.e.from)!.layer - byId.get(q.e.to)!.layer),
    );
  // A loop needs room on the right, but only beside the levels it spans.
  const loopNeed = loops.map(
    ({ e }, k) =>
      FLOW.loop.clearance + (plateOf(e.label)?.w ?? FLOW.loop.bare) + k * FLOW.loop.step,
  );
  const spans = (e: { from: string; to: string }, layer: number) => {
    const a = byId.get(e.from)!.layer;
    const b = byId.get(e.to)!.layer;
    return layer >= Math.min(a, b) && layer <= Math.max(a, b);
  };
  const areaOf = (layer: number) =>
    TEXT_WIDTH - Math.max(0, ...loops.map(({ e }, k) => (spans(e, layer) ? loopNeed[k]! : 0)));

  // Boxes: slot per layer, left-aligned on the axis.
  const H = reel.flow.boxMinHeight;
  const boxWidth = (n: { layer: number; layerSize: number }) =>
    Math.min(reel.flow.boxMaxWidth, areaOf(n.layer) / n.layerSize - FLOW.slotGap);
  if (laid.some((n) => boxWidth(n) < FLOW.minBoxWidth))
    return 'flow boxes would be narrower than 120 px';

  // Labels: one step for the whole diagram, the largest at which every label
  // fits 2 lines; break at spaces first, after a hyphen or slash only if needed.
  const fitLabel = (label: string, inner: number, size: number) => {
    for (const hyphens of [false, true]) {
      const tokens = tokenize(label, hyphens);
      const lines = wrapBalanced(
        tokens.length,
        rangeWidth(tokens, { stack: STACK.display600, size }, measure),
        inner,
      );
      if (lines && lines.length <= 2)
        return lines.map((line) => joinTokens(line.map((k) => tokens[k]!)));
    }
    return null;
  };
  let labelStep: TypeStep | null = null;
  const labelLines = new Map<string, string[]>();
  for (const step of reel.flow.label) {
    labelLines.clear();
    const fitsAll = laid.every((n) => {
      const lines = fitLabel(n.label, boxWidth(n) - 2 * FLOW.padX, step.size);
      if (lines) labelLines.set(n.id, lines);
      return lines !== null;
    });
    if (fitsAll) {
      labelStep = step;
      break;
    }
  }
  if (!labelStep) {
    const smallest = reel.flow.label[reel.flow.label.length - 1]!.size;
    return `a flow label does not fit its box in 2 lines at ${smallest} px`;
  }

  // Vertical rhythm.
  const unders = edges.filter((e) => kindOf(e) === 'under');
  const underPlate = Math.max(0, ...unders.map((e) => plateOf(e.label)?.h ?? 0));
  const bottomExtra = unders.length ? FLOW.under.depth + underPlate / 2 + 2 : 0;
  const downLabels = edges.some((e) => kindOf(e) === 'down' && e.label);
  const minGap = downLabels ? FLOW.gap.minWithLabels : FLOW.gap.min;
  const free = VISUAL_BOX.height - layers * H - bottomExtra;
  const gap = layers > 1 ? Math.min(FLOW.gap.max, free / (layers - 1)) : 0;
  if (layers > 1 && gap < minGap)
    return `flow with ${layers} levels is too tall for the visual box`;
  const height = layers * H + (layers - 1) * gap + bottomExtra;

  const boxes: FlowBox[] = laid.map((n) => {
    const slot = areaOf(n.layer) / n.layerSize;
    return {
      id: n.id,
      x: r1(n.index * slot),
      y: r1(n.layer * (H + gap)),
      w: r1(boxWidth(n)),
      h: H,
      lines: labelLines.get(n.id)!,
      order: nodes.findIndex((m) => m.id === n.id),
    };
  });
  const box = new Map(boxes.map((b) => [b.id, b]));
  const cx = (b: FlowBox) => b.x + b.w / 2;
  const { length: HL, halfWidth: HW } = FLOW.head;

  /** An arrow before its label is placed: where a label may go, and what it must not cover. */
  interface Draft {
    order: number;
    path: string;
    head: string;
    headRect: Rect;
    /** Points along the line, for the "no line under another arrow's label" check. */
    points: [number, number][];
    /** Label anchor candidates, best first. */
    anchors: [number, number][];
    plate: { text: string; w: number; h: number } | null;
  }
  const drafts: Draft[] = [];
  const along = (pts: [number, number][], step = 6): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k]!;
      const [bx, by] = pts[k + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let j = 0; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
    }
    return out;
  };

  // Down edges: arrows leaving one box fork from its bottom centre; arrows into
  // one box land side by side on its top edge.
  const downs = edges.map((e, i) => ({ e, i })).filter(({ e }) => kindOf(e) === 'down');
  const spread = (centre: number, k: number, m: number, step: number, b: FlowBox) =>
    Math.min(Math.max(centre + (k - (m - 1) / 2) * step, b.x + 24), b.x + b.w - 24);
  for (const { e, i } of downs) {
    const p = box.get(e.from)!;
    const c = box.get(e.to)!;
    const siblingsOut = downs
      .filter((d) => d.e.from === e.from)
      .sort((a, b) => cx(box.get(a.e.to)!) - cx(box.get(b.e.to)!) || a.i - b.i);
    const siblingsIn = downs
      .filter((d) => d.e.to === e.to)
      .sort((a, b) => cx(box.get(a.e.from)!) - cx(box.get(b.e.from)!) || a.i - b.i);
    // Several arrows between the same two boxes run side by side across their width.
    const parallel = downs.filter((d) => d.e.from === e.from && d.e.to === e.to);
    const k = parallel.findIndex((d) => d.i === i);
    const across = (b: FlowBox) => b.x + 24 + (k * (b.w - 48)) / (parallel.length - 1);
    const x1 = r1(
      parallel.length > 1
        ? across(p)
        : spread(
            cx(p),
            siblingsOut.findIndex((d) => d.i === i),
            siblingsOut.length,
            FLOW.spread.start,
            p,
          ),
    );
    const x2 = r1(
      parallel.length > 1
        ? across(c)
        : spread(
            cx(c),
            siblingsIn.findIndex((d) => d.i === i),
            siblingsIn.length,
            FLOW.spread.end,
            c,
          ),
    );
    const y1 = p.y + p.h;
    const y2 = c.y;
    const y2h = y2 - HL;
    const ym = r1((y1 + y2h) / 2);
    const straight = Math.abs(x1 - x2) < 0.5;
    // Cubic with vertical tangents at both ends.
    const at = (t: number): [number, number] => {
      const u = 1 - t;
      const wEnd = 3 * t * t * u + t * t * t;
      const wMid = 3 * t * u * u + 3 * t * t * u;
      return [x1 + (x2 - x1) * wEnd, y1 * u * u * u + ym * wMid + y2h * t * t * t];
    };
    drafts.push({
      order: i,
      path: straight
        ? `M ${x1} ${y1} V ${y2h}`
        : `M ${x1} ${y1} C ${x1} ${ym} ${x2} ${ym} ${x2} ${y2h}`,
      head: `M ${x2} ${y2} L ${x2 - HW} ${y2h} L ${x2 + HW} ${y2h} Z`,
      headRect: { x0: x2 - HW, y0: y2h, x1: x2 + HW, y1: y2 },
      points: straight
        ? along([
            [x1, y1],
            [x2, y2h],
          ])
        : Array.from({ length: 41 }, (_, k) => at(k / 40)),
      anchors: [0.5, 0.62, 0.38, 0.72, 0.28].flatMap((t) => {
        // On the line (the plate knocks it out), else just right or left of it.
        const [x, y] = at(t);
        const w = plateOf(e.label)?.w ?? 0;
        const side: [number, number][] = [
          [x + FLOW.plate.padX + w / 2, y],
          [x - FLOW.plate.padX - w / 2, y],
        ];
        return parallel.length > 1 ? [...side, [x, y]] : [[x, y], ...side];
      }),
      plate: plateOf(e.label),
    });
  }

  // Edges between neighbours on the last layer run underneath both boxes.
  for (const e of unders) {
    const s = box.get(e.from)!;
    const t = box.get(e.to)!;
    const sl = byId.get(e.from)!;
    const tl = byId.get(e.to)!;
    if (sl.layer !== layers - 1 || Math.abs(sl.index - tl.index) !== 1)
      return `flow edge ${e.from} -> ${e.to} stays on one level away from the bottom; not supported`;
    const sx = r1(cx(s));
    const tx = r1(cx(t));
    const yb = s.y + s.h;
    const yd = r1(yb + FLOW.under.depth);
    const r = FLOW.loop.corner;
    const dir = Math.sign(tx - sx);
    const mid = (sx + tx) / 2;
    drafts.push({
      order: edges.indexOf(e),
      path: `M ${sx} ${yb} V ${yd - r} Q ${sx} ${yd} ${sx + dir * r} ${yd} H ${tx - dir * r} Q ${tx} ${yd} ${tx} ${yd - r} V ${yb + HL}`,
      head: `M ${tx} ${yb} L ${tx - HW} ${yb + HL} L ${tx + HW} ${yb + HL} Z`,
      headRect: { x0: tx - HW, y0: yb, x1: tx + HW, y1: yb + HL },
      points: along([
        [sx, yb],
        [sx, yd],
        [tx, yd],
        [tx, yb + HL],
      ]),
      anchors: [mid, mid - (tx - sx) / 4, mid + (tx - sx) / 4].map((x) => [r1(x), yd]),
      plate: plateOf(e.label),
    });
  }

  // Loops around the right side, innermost (shortest span) first.
  for (const [k, { e, i }] of loops.entries()) {
    const s = box.get(e.from)!;
    const t = box.get(e.to)!;
    const sl = byId.get(e.from)!;
    const tl = byId.get(e.to)!;
    if (sl.index !== sl.layerSize - 1 || tl.index !== tl.layerSize - 1)
      return `flow edge ${e.from} -> ${e.to} must loop around boxes beside it; not supported`;
    const lo = Math.min(sl.layer, tl.layer);
    const hi = Math.max(sl.layer, tl.layer);
    const right = Math.max(
      ...boxes.filter((_, j) => laid[j]!.layer >= lo && laid[j]!.layer <= hi).map((b) => b.x + b.w),
    );
    const plate = plateOf(e.label);
    const X = r1(
      right + FLOW.loop.clearance + (plate ? plate.w / 2 : FLOW.loop.bare / 2) + k * FLOW.loop.step,
    );
    if (X + (plate ? plate.w / 2 : 0) > TEXT_WIDTH)
      return `flow loop ${e.from} -> ${e.to} has no room on the right`;
    const ys = s.y + s.h / 2;
    const yt = t.y + t.h / 2;
    const sx = s.x + s.w;
    const tx = t.x + t.w;
    const dir = Math.sign(yt - ys);
    const r = FLOW.loop.corner;
    const mid = (ys + yt) / 2;
    drafts.push({
      order: i,
      path: `M ${sx} ${ys} H ${X - r} Q ${X} ${ys} ${X} ${ys + dir * r} V ${yt - dir * r} Q ${X} ${yt} ${X - r} ${yt} H ${tx + HL}`,
      head: `M ${tx} ${yt} L ${tx + HL} ${yt - HW} L ${tx + HL} ${yt + HW} Z`,
      headRect: { x0: tx, y0: yt - HW, x1: tx + HL, y1: yt + HW },
      points: along([
        [sx, ys],
        [X, ys],
        [X, yt],
        [tx + HL, yt],
      ]),
      anchors: [mid, mid - (yt - ys) / 4, mid + (yt - ys) / 4].map((y) => [X, r1(y)]),
      plate,
    });
  }

  // Labels: the first anchor whose plate stays inside the diagram and touches
  // no box, no arrowhead, no other plate and no other arrow's line.
  const rect = (p: FlowPlate): Rect => ({
    x0: p.cx - p.w / 2,
    y0: p.cy - p.h / 2,
    x1: p.cx + p.w / 2,
    y1: p.cy + p.h / 2,
  });
  const inflate = (q: Rect, d: number): Rect => ({
    x0: q.x0 - d,
    y0: q.y0 - d,
    x1: q.x1 + d,
    y1: q.y1 + d,
  });
  const placed: FlowPlate[] = [];
  const arrows: FlowArrow[] = [];
  for (const d of [...drafts].sort((a, b) => a.order - b.order)) {
    let label: FlowPlate | null = null;
    if (d.plate) {
      for (const [ax, ay] of d.anchors) {
        const candidate: FlowPlate = { ...d.plate, cx: r1(ax), cy: r1(ay) };
        const pr = rect(candidate);
        const clear =
          pr.x0 >= 0 &&
          pr.x1 <= TEXT_WIDTH &&
          pr.y0 >= -FLOW.gap.min / 2 &&
          pr.y1 <= height &&
          boxes.every(
            (b) =>
              !overlaps(pr, { x0: b.x - 4, y0: b.y - 4, x1: b.x + b.w + 4, y1: b.y + b.h + 4 }),
          ) &&
          drafts.every((o) => !overlaps(pr, inflate(o.headRect, 2))) &&
          placed.every((q) => !overlaps(pr, inflate(rect(q), 4))) &&
          drafts.every(
            (o) =>
              o === d ||
              o.points.every(([x, y]) => !overlaps(inflate(pr, 3), { x0: x, y0: y, x1: x, y1: y })),
          );
        if (clear) {
          label = candidate;
          break;
        }
      }
      if (!label) return `flow label "${d.plate.text}" has no free place beside its arrow`;
      placed.push(label);
    }
    arrows.push({ path: d.path, head: d.head, label, order: d.order });
  }

  return {
    top: r1(VISUAL_BOX.top + (VISUAL_BOX.height - height) / 2),
    height: r1(height),
    labelSize: labelStep.size,
    labelLineHeight: labelStep.lineHeight,
    boxes,
    arrows,
  };
}

// ---------------------------------------------------------------------------
// The whole reel

export interface EquationFit {
  size: number;
  /** True when the formula breaks after an operator onto more than one line. */
  wrap: boolean;
  width: number;
  height: number;
}

export interface HookLayout {
  kind: 'hook';
  size: number;
  lineHeight: number;
  top: number;
  /** Word indices per line. */
  lines: number[][];
}

export interface SegmentLayout {
  kind: 'segment';
  /** On-screen text in its region (null when kinetic text shows it in the visual box). */
  onScreen: TextBlock | null;
  kinetic: TextBlock | null;
  code: CodeLayout | null;
  flow: FlowLayout | null;
  equation: (EquationFit & { top: number }) | null;
  image: { top: number; height: number } | null;
  captions: CaptionGroup[];
}

export type PartLayout = HookLayout | SegmentLayout;

export interface ReelLayout {
  parts: PartLayout[];
  /** Top of a caption line box to its baseline; the playhead sits 8 px below the baseline. */
  captionBaseline: number;
  /** Overflow and fit failures: the reel fails instead of shrinking type. */
  problems: string[];
}

export interface Measurers {
  text: Measure;
  /** Equations are measured in the browser beforehand (KaTeX needs the DOM). */
  equation: (latex: string) => EquationFit | string;
  /** Measured in the browser; defaults to Barlow's metrics (ascender 1.0 em, descender 0.2 em). */
  captionBaseline?: number;
}

function block(
  text: string,
  steps: readonly TypeStep[],
  maxLines: (step: TypeStep) => number,
  stack: readonly FontFamily[],
  measure: Measure,
): { size: number; lineHeight: number; lines: string[] } | null {
  const tokens = tokenize(text);
  const fit = fitSteps(tokens, steps, maxLines, TEXT_WIDTH, stack, measure);
  if (!fit) return null;
  return {
    size: fit.step.size,
    lineHeight: fit.step.lineHeight,
    lines: fit.lines.map((line) => joinTokens(line.map((k) => tokens[k]!))),
  };
}

const centred = (height: number, box: { top: number; height: number }) =>
  r1(box.top + (box.height - height) / 2);

function segmentLayout(
  part: ReelPart,
  m: Measurers,
  problems: string[],
  where: string,
): SegmentLayout {
  const out: SegmentLayout = {
    kind: 'segment',
    onScreen: null,
    kinetic: null,
    code: null,
    flow: null,
    equation: null,
    image: null,
    captions: [],
  };
  const v: Visual | null = part.visual;
  const kinetic = !v || v.kind === 'kinetic_text' || (v.kind === 'image' && !part.image);
  if (kinetic) {
    if (part.onScreen.trim()) {
      const fit = block(part.onScreen, reel.hookSteps, hookLines, STACK.display700, m.text);
      if (!fit)
        problems.push(`${where} kinetic text "${part.onScreen}" does not fit 6 lines at 48 px`);
      else out.kinetic = { ...fit, top: centred(fit.lines.length * fit.lineHeight, VISUAL_BOX) };
    }
  } else if (part.onScreen.trim()) {
    const fit = block(part.onScreen, reel.onScreenSteps, () => 2, STACK.display700, m.text);
    if (!fit)
      problems.push(`${where} on-screen text "${part.onScreen}" does not fit 2 lines at 36 px`);
    else out.onScreen = { ...fit, top: reel.regions.onScreen.top };
  }

  if (v?.kind === 'code') {
    const lines = v.code.split('\n');
    const mistake = v.check === 'should_error' || v.shows_mistake === true;
    const fit = fitCode(lines, (line, size) => m.text(line, { stack: STACK.code, size }), {
      floor: part.codeFloor,
      mistake,
    });
    if ('problem' in fit) problems.push(`${where} ${fit.problem}`);
    else
      out.code = {
        ...fit,
        top: centred(fit.height, VISUAL_BOX),
        mistake,
        lines,
        highlight: v.highlight_lines ?? [],
      };
  } else if (v?.kind === 'flow') {
    const flow = layoutFlowDiagram(v.nodes, v.edges, m.text);
    if (typeof flow === 'string') problems.push(`${where} ${flow}`);
    else out.flow = flow;
  } else if (v?.kind === 'equation') {
    const fit = m.equation(v.latex);
    if (typeof fit === 'string') problems.push(`${where} ${fit}`);
    else out.equation = { ...fit, top: centred(fit.height, VISUAL_BOX) };
  } else if (v?.kind === 'image' && part.image) {
    out.image = { top: VISUAL_BOX.top, height: VISUAL_BOX.height };
  }

  const captions = groupCaptions(
    part.words.map((w) => w.text),
    m.text,
  );
  if (typeof captions === 'string') problems.push(`${where} ${captions}`);
  else out.captions = captions;
  return out;
}

function hookLayout(words: PartWord[], m: Measurers, problems: string[]): HookLayout {
  const tokens: Token[] = words.map((w) => ({ text: w.text, space: true }));
  const fit = fitSteps(tokens, reel.hookSteps, hookLines, TEXT_WIDTH, STACK.display700, m.text);
  if (!fit) {
    problems.push(`hook does not fit 6 lines at 48 px`);
    const last = reel.hookSteps[reel.hookSteps.length - 1]!;
    return {
      kind: 'hook',
      size: last.size,
      lineHeight: last.lineHeight,
      top: HOOK_BOX.top,
      lines: [],
    };
  }
  return {
    kind: 'hook',
    size: fit.step.size,
    lineHeight: fit.step.lineHeight,
    top: centred(fit.lines.length * fit.step.lineHeight, HOOK_BOX),
    lines: fit.lines,
  };
}

/** Lays out every part; `problems` lists everything that does not fit. */
export function planLayout(parts: ReelPart[], m: Measurers): ReelLayout {
  const problems: string[] = [];
  let segment = 0;
  const laid = parts.map((part): PartLayout => {
    if (part.kind === 'hook') return hookLayout(part.words, m, problems);
    segment++;
    return segmentLayout(part, m, problems, `segment ${segment}`);
  });
  const { size, lineHeight } = reel.caption;
  const captionBaseline = m.captionBaseline ?? (lineHeight - 1.2 * size) / 2 + size;
  return { parts: laid, captionBaseline, problems };
}
