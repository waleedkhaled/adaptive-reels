// Display rules for baked reel text (DESIGN.md "Glyphs"). Pure: imported by
// the Node renderer and the Remotion bundle.
// - Em dashes are banned in visible strings: each becomes a colon, a comma or
//   a full stop at render time. The narration audio is unchanged.
// - Glyph audit: every character must be covered by a font in its line's
//   stack, or the reel fails (no silent system-font fallback).
import type { FontFamily } from '@reels/tokens';

const EM_DASH = '—';

/** Words after a dash that continue the sentence: a comma reads better than a colon. */
const CONNECTORS = new Set([
  'and',
  'but',
  'or',
  'nor',
  'so',
  'yet',
  'like',
  'which',
  'while',
  'whereas',
  'because',
  'although',
  'though',
  'unless',
  'until',
  'then',
  'plus',
]);

/**
 * The punctuation (with its trailing space) that replaces one em dash and the
 * spaces around it, given the text before and after it.
 * - at the end of a string: a full stop (nothing if punctuation is already there);
 * - before a connector ("fine, but how"): a comma;
 * - when the clause already has a colon ("size: number, still required"): a comma;
 * - otherwise a colon ("State is a snapshot: stale reads").
 */
export function emDashReplacement(before: string, after: string): string {
  const head = before.trimEnd();
  if (!head) return '';
  if (!after.trim()) return /[.!?…:;,]$/.test(head) ? '' : '.';
  const next = /^[\p{L}']+/u.exec(after.trimStart())?.[0]?.toLowerCase();
  if (next && CONNECTORS.has(next)) return ', ';
  // A clause ends at a sentence end or a line break (code comments are one line each).
  const clause = head.split(/[.!?]\s|\n/).pop() ?? head;
  return clause.includes(':') ? ', ' : ': ';
}

/** Replaces every em dash in a visible string. */
export function replaceEmDashes(text: string): string {
  if (!text.includes(EM_DASH)) return text;
  let out = '';
  let rest = text;
  for (;;) {
    const match = /\s*—\s*/.exec(rest);
    if (!match) return out + rest;
    const before = out + rest.slice(0, match.index);
    const after = rest.slice(match.index + match[0].length);
    out = before.trimEnd() + emDashReplacement(before, after);
    rest = after;
    if (!rest) return out.trimEnd();
  }
}

/**
 * Replaces em dashes inside timed caption words without changing the word
 * count, so every word keeps its timing. Kokoro folds a dash into the word
 * before it ("hallucination—"); a dash inside a word ("guess—read") keeps both
 * halves in that one word.
 */
export function replaceEmDashesInWords(words: string[]): string[] {
  return words.map((word, i) => {
    if (!word.includes(EM_DASH)) return word;
    const pieces = word.split(EM_DASH);
    let out = pieces[0]!;
    for (let k = 1; k < pieces.length; k++) {
      const rest = pieces.slice(k).join(EM_DASH);
      const before = [...words.slice(0, i), out].join(' ');
      const after = [rest, ...words.slice(i + 1)].join(' ');
      const replacement = emDashReplacement(before, after);
      out = pieces[k] ? out.trimEnd() + replacement + pieces[k] : out + replacement.trimEnd();
    }
    return out;
  });
}

export type Coverage = Readonly<Record<FontFamily, ReadonlySet<number>>>;

export interface VisibleText {
  /** Where the string appears, for the error message. */
  where: string;
  text: string;
  /** The CSS font stack the string is set in, first choice first. */
  stack: readonly FontFamily[];
}

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Every character (spaces and line breaks aside) that no font in its stack
 * covers. One problem per string and character.
 */
export function auditGlyphs(items: VisibleText[], coverage: Coverage): string[] {
  const problems: string[] = [];
  for (const item of items) {
    const missing = new Set<string>();
    for (const ch of item.text) {
      if (ch === '\n' || ch === ' ') continue;
      const cp = ch.codePointAt(0)!;
      if (!item.stack.some((family) => coverage[family].has(cp))) missing.add(ch);
    }
    for (const ch of missing) {
      problems.push(
        `${item.where}: "${ch}" (${hex(ch.codePointAt(0)!)}) is in no font of ${item.stack.join(', ')}`,
      );
    }
  }
  return problems;
}
