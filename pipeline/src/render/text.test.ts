import { describe, expect, it } from 'vitest';
import {
  auditGlyphs,
  emDashReplacement,
  replaceEmDashes,
  replaceEmDashesInWords,
  type Coverage,
} from './text';

describe('em dashes in visible strings', () => {
  it.each([
    // A colon by default.
    ['State is a snapshot — stale reads', 'State is a snapshot: stale reads'],
    ['getUser() — fast reads, never refreshes', 'getUser(): fast reads, never refreshes'],
    [
      "Your app crashed. Don't guess—read the stack trace first.",
      "Your app crashed. Don't guess: read the stack trace first.",
    ],
    [
      'Same code ≠ same behavior — test both platforms',
      'Same code ≠ same behavior: test both platforms',
    ],
    // A comma when the clause already has a colon.
    ['size: number — still required', 'size: number, still required'],
    ['Cache key: q:${q} — missing userId!', 'Cache key: q:${q}, missing userId!'],
    ['// Error: none — missing Set', '// Error: none, missing Set'],
    // A comma before a connector.
    [
      'Your component renders fine — but how do you start a timer?',
      'Your component renders fine, but how do you start a timer?',
    ],
    ['outside React — like a network request', 'outside React, like a network request'],
    // A full stop at the end; nothing extra after existing punctuation; dropped at the start.
    ['Verify outputs —', 'Verify outputs.'],
    ['Done! —', 'Done!'],
    ['— leading', 'leading'],
    ['no dash here', 'no dash here'],
  ])('%s', (input, expected) => {
    expect(replaceEmDashes(input)).toBe(expected);
  });

  it('never leaves an em dash behind, and never two colons in one clause', () => {
    expect(replaceEmDashes('a — b — c — d')).not.toContain('—');
    expect(replaceEmDashes('a — b — c — d')).toBe('a: b, c, d');
  });

  it('keeps the word count of timed caption words', () => {
    const words = ["That's", 'called', 'a', 'hallucination—', 'a', 'fluent', 'output.'];
    const out = replaceEmDashesInWords(words);
    expect(out).toHaveLength(words.length);
    expect(out[3]).toBe('hallucination:');
    expect(replaceEmDashesInWords(['renders', 'fine—', 'but', 'how'])[1]).toBe('fine,');
    expect(replaceEmDashesInWords(["Don't", 'guess—read', 'it.'])[1]).toBe('guess: read');
    expect(replaceEmDashesInWords(['the', 'end—'])[1]).toBe('end.');
  });

  it('reads context on both sides', () => {
    expect(emDashReplacement('', 'x')).toBe('');
    expect(emDashReplacement('Set a timebox', 'thirty minutes.')).toBe(': ');
    expect(emDashReplacement('Note: one thing', 'another')).toBe(', ');
    expect(emDashReplacement('First. Second', 'third')).toBe(': ');
    // In code, a colon on an earlier line does not count.
    expect(replaceEmDashes(`const r = '{"a":1}';\n// data is any — no checking!`)).toBe(
      `const r = '{"a":1}';\n// data is any: no checking!`,
    );
  });
});

describe('glyph audit', () => {
  const coverage = {
    'BarlowSC-SemiBold': new Set([...'abc '].map((c) => c.codePointAt(0)!)),
    'BarlowSC-Bold': new Set([...'abc≠ '].map((c) => c.codePointAt(0)!)),
    'MonoNL-Medium': new Set<number>(),
    'MonoNL-SemiBold': new Set([...'abc→'].map((c) => c.codePointAt(0)!)),
    'MonoNL-ExtraBold': new Set([...'abc→'].map((c) => c.codePointAt(0)!)),
  } satisfies Coverage;

  it('passes characters covered by any font of the stack', () => {
    expect(
      auditGlyphs(
        [{ where: 'on-screen', text: 'a ≠ b → c', stack: ['BarlowSC-Bold', 'MonoNL-ExtraBold'] }],
        coverage,
      ),
    ).toEqual([]);
  });

  it('fails a character no font in the stack covers, once per string', () => {
    const problems = auditGlyphs(
      [
        {
          where: 'segment 2 on-screen text',
          text: 'a ⇄ b ⇄ c',
          stack: ['BarlowSC-Bold', 'MonoNL-ExtraBold'],
        },
      ],
      coverage,
    );
    expect(problems).toEqual([
      'segment 2 on-screen text: "⇄" (U+21C4) is in no font of BarlowSC-Bold, MonoNL-ExtraBold',
    ]);
  });

  it('checks the stack the string is set in', () => {
    // ≠ is in Barlow Bold but not in the SemiBold stack used for captions.
    expect(
      auditGlyphs(
        [{ where: 'captions', text: 'a ≠ b', stack: ['BarlowSC-SemiBold', 'MonoNL-SemiBold'] }],
        coverage,
      ),
    ).toHaveLength(1);
  });
});
