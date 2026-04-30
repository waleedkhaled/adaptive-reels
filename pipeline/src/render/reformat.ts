// Code floor (owner decision 2026-10-04, minCode 26): a snippet that would
// need a code size under 26 px is reformatted with Prettier at 42 columns
// (ts, tsx, js) instead of being shrunk. The reformatted code is written back
// into the reel's text.json only when it fits at 26 px or larger, still
// passes G1's code checks (type check included), errors exactly as before when
// it is meant to error, keeps its highlighted lines, and the spec still parses.
// Anything else keeps its code and may use the 25 and 24 px steps.
import * as prettier from 'prettier';
import ts from 'typescript';
import { ReelSpec, type Visual } from '@reels/schemas';
import { reel } from '@reels/tokens';
import { typeCheckSnippet } from '../codecheck';
import { codeProblems } from '../gates';
import { advanceWidth } from './fontdata';
import { fitCode } from './layout';
import { displayCode } from './syntax';
import { replaceEmDashes } from './text';

type CodeVisual = Extract<Visual, { kind: 'code' }>;

/** Columns of the 26 px step (DESIGN.md code table). */
export const REFORMAT_COLUMNS = 42;
/** The smallest step, allowed only for snippets that cannot be reformatted. */
export const EXCEPTION_FLOOR = reel.codeSteps[reel.codeSteps.length - 1]!.size;

/** Rendered width of a code line: Mono NL advances, exact for a monospace font. */
export const codeLineWidth = (line: string, size: number) =>
  advanceWidth(line, 'MonoNL-SemiBold', size);

const isMistake = (v: CodeVisual) => v.check === 'should_error' || v.shows_mistake === true;

/** The code size this snippet gets at a given floor, or null if it fits no step. */
export function codeSize(v: CodeVisual, floor: number): number | null {
  const lines = replaceEmDashes(displayCode(v.code)).split('\n');
  const fit = fitCode(lines, codeLineWidth, { floor, mistake: isMistake(v) });
  return 'problem' in fit ? null : fit.size;
}

/** Style of the original snippet that Prettier should keep: quotes, semicolons, arrow parens. */
export function prettierOptions(code: string, language: 'ts' | 'tsx' | 'js'): prettier.Options {
  const kind = { ts: ts.ScriptKind.TS, tsx: ts.ScriptKind.TSX, js: ts.ScriptKind.JS }[language];
  const source = ts.createSourceFile(`s.${language}`, code, ts.ScriptTarget.Latest, true, kind);
  let single = 0;
  let double = 0;
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) && !ts.isJsxAttribute(node.parent)) {
      const quote = node.getText(source)[0];
      if (quote === "'") single++;
      if (quote === '"') double++;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    filepath: `snippet.${language}`,
    printWidth: REFORMAT_COLUMNS,
    tabWidth: 2,
    singleQuote: single >= double,
    semi: /;[ \t]*(\/\/.*)?$/m.test(code),
    arrowParens: /(^|[^\w)\s])\s*[A-Za-z_$][\w$]*\s*=>/m.test(code) ? 'avoid' : 'always',
  };
}

const squash = (s: string) => s.replace(/\s+/g, '');

/**
 * Maps 1-based highlighted lines of `before` onto `after`: first by identical
 * trimmed content (in order), then, for lines Prettier split or joined, by
 * aligning the non-space characters of both versions. Null when a highlighted
 * line cannot be found.
 */
export function remapHighlights(
  before: string,
  after: string,
  highlights: number[],
): number[] | null {
  const a = before.split('\n');
  const b = after.split('\n');
  // Character streams without whitespace, each char tagged with its line.
  const stream = (lines: string[]) => {
    const chars: string[] = [];
    const line: number[] = [];
    lines.forEach((l, i) => {
      for (const ch of squash(l)) {
        chars.push(ch);
        line.push(i);
      }
    });
    return { chars, line };
  };
  const sa = stream(a);
  const sb = stream(b);
  const n = sa.chars.length;
  const m = sb.chars.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] =
        sa.chars[i] === sb.chars[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const pairs = new Map<number, number[]>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (sa.chars[i] === sb.chars[j]) {
      const lineA = sa.line[i]!;
      pairs.set(lineA, [...(pairs.get(lineA) ?? []), sb.line[j]!]);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }

  const out = new Set<number>();
  let cursor = 0;
  for (const h of [...highlights].sort((x, y) => x - y)) {
    const content = a[h - 1]?.trim();
    if (content === undefined) return null;
    if (!content) {
      // A highlighted blank line follows the next blank line, or is dropped.
      const blank = b.findIndex((l, j) => j >= cursor && l.trim() === '');
      if (blank !== -1) {
        out.add(blank + 1);
        cursor = blank + 1;
      }
      continue;
    }
    const exact = b.findIndex((l, j) => j >= cursor && l.trim() === content);
    if (content && exact !== -1) {
      out.add(exact + 1);
      cursor = exact + 1;
      continue;
    }
    const matched = pairs.get(h - 1) ?? [];
    if (matched.length < 0.6 * squash(content).length) return null;
    for (let j = Math.min(...matched); j <= Math.max(...matched); j++) out.add(j + 1);
    cursor = Math.max(...matched) + 1;
  }
  return [...out].sort((x, y) => x - y);
}

const errorMessages = (code: string, language: 'ts' | 'tsx') =>
  typeCheckSnippet(code, language)
    .map((e) => e.replace(/^line \d+: /, ''))
    .sort();

/** Reformats one snippet; returns the new code and highlights, or why not. */
export async function reformatSnippet(
  v: CodeVisual,
): Promise<{ code: string; highlight_lines: number[] } | { reason: string }> {
  if (v.language !== 'ts' && v.language !== 'tsx' && v.language !== 'js')
    return { reason: `no formatter for ${v.language}` };
  let code: string;
  try {
    code = (await prettier.format(v.code, prettierOptions(v.code, v.language))).replace(/\n+$/, '');
  } catch (error) {
    return { reason: `Prettier could not parse it: ${(error as Error).message.split('\n')[0]}` };
  }
  const wide = code.split('\n').find((l) => [...l].length > REFORMAT_COLUMNS);
  if (wide) return { reason: `a line stays at ${[...wide].length} columns after Prettier` };
  const highlight_lines = remapHighlights(v.code, code, v.highlight_lines ?? []);
  if (!highlight_lines) return { reason: 'highlighted lines could not be matched after Prettier' };
  const next: CodeVisual = { ...v, code, highlight_lines };
  if (codeSize(next, reel.minCode) === null)
    return {
      reason: `${code.split('\n').length} lines after Prettier do not fit the box at ${reel.minCode} px`,
    };
  const problems = codeProblems(next, 'reformatted');
  if (problems.length) return { reason: problems[0]! };
  if (v.check === 'should_error' && v.language !== 'js') {
    const was = errorMessages(v.code, v.language);
    const now = errorMessages(code, v.language);
    if (JSON.stringify(was) !== JSON.stringify(now))
      return { reason: 'the type errors changed after Prettier' };
  }
  return { code, highlight_lines };
}

export interface SnippetOutcome {
  segment: number;
  language: string;
  status: 'fits' | 'reformatted' | 'exception';
  /** Smallest code size the layout may use for this snippet. */
  floor: number;
  /** Size the snippet will render at (null: overflows even at the exception floor). */
  size: number | null;
  reason?: string;
  before?: { code: string; highlight_lines: number[] };
}

/**
 * Checks every code visual of a spec against the code floor and reformats the
 * ones that need it. Returns the outcomes and, when something was reformatted
 * and the whole spec still parses, the updated spec to write back.
 */
export async function prepareSnippets(
  spec: ReelSpec,
): Promise<{ outcomes: SnippetOutcome[]; spec: ReelSpec | null }> {
  const segments = structuredClone(spec.segments);
  const outcomes: SnippetOutcome[] = [];
  for (const [i, segment] of segments.entries()) {
    const v = segment.visual;
    if (v.kind !== 'code') continue;
    const size = codeSize(v, reel.minCode);
    if (size !== null) {
      outcomes.push({
        segment: i,
        language: v.language,
        status: 'fits',
        floor: reel.minCode,
        size,
      });
      continue;
    }
    const result = await reformatSnippet(v);
    if ('code' in result) {
      const before = { code: v.code, highlight_lines: v.highlight_lines ?? [] };
      segment.visual = { ...v, ...result };
      outcomes.push({
        segment: i,
        language: v.language,
        status: 'reformatted',
        floor: reel.minCode,
        size: codeSize(segment.visual as CodeVisual, reel.minCode),
        before,
      });
    } else {
      outcomes.push({
        segment: i,
        language: v.language,
        status: 'exception',
        floor: EXCEPTION_FLOOR,
        size: codeSize(v, EXCEPTION_FLOOR),
        reason: result.reason,
      });
    }
  }
  if (!outcomes.some((o) => o.status === 'reformatted')) return { outcomes, spec: null };
  // Validate, but write back the original shape (no schema defaults filled in).
  const updated = ReelSpec.safeParse({ ...spec, segments });
  if (updated.success) return { outcomes, spec: { ...spec, segments } };
  // Keep the original code everywhere; the reformatted snippets become exceptions.
  const reason = `the spec no longer parses: ${updated.error.issues[0]?.message ?? 'invalid'}`;
  return {
    outcomes: outcomes.map((o) => {
      if (o.status !== 'reformatted') return o;
      const v = spec.segments[o.segment]!.visual as CodeVisual;
      return {
        segment: o.segment,
        language: o.language,
        status: 'exception' as const,
        floor: EXCEPTION_FLOOR,
        size: codeSize(v, EXCEPTION_FLOOR),
        reason,
      };
    }),
    spec: null,
  };
}
