import { describe, expect, it } from 'vitest';
import { alignToSilences, foldPunctuation } from './align';

const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs });

describe('foldPunctuation', () => {
  it('attaches punctuation tokens to the previous word', () => {
    expect(
      foldPunctuation([
        w('Hello', 0, 100),
        w(',', 100, 150),
        w('world', 150, 300),
        w('.', 300, 400),
      ]),
    ).toEqual([w('Hello,', 0, 100), w('world.', 150, 300)]);
  });
});

describe('alignToSilences', () => {
  // Kokoro-style drift: the word before the pause ends late, the next starts early.
  const words = [
    w('Light', 250, 500),
    w('bends', 500, 900),
    w('.', 900, 1300),
    w('Then', 1350, 1600),
    w('stops', 1600, 2100),
  ];
  const silences = [
    { startMs: 0, endMs: 300 }, // leading
    { startMs: 820, endMs: 1500 }, // the real pause between sentences
    { startMs: 2000, endMs: 2200 }, // trailing
  ];

  it('snaps the boundary at a pause to the real silence', () => {
    const out = alignToSilences(words, silences, 2200);
    expect(out.map((x) => x.text)).toEqual(['Light', 'bends.', 'Then', 'stops']);
    expect(out[1]!.endMs).toBe(820);
    expect(out[2]!.startMs).toBe(1500);
  });

  it('uses leading and trailing silence for the first start and last end', () => {
    const out = alignToSilences(words, silences, 2200);
    expect(out[0]!.startMs).toBe(300);
    expect(out[3]!.endMs).toBe(2000);
  });

  it('warps words between anchors proportionally and keeps them ordered', () => {
    const out = alignToSilences(words, silences, 2200);
    // "bends" started at 500 between anchors 250->300 and 1300(end of fold)->820.
    expect(out[1]!.startMs).toBeGreaterThan(out[0]!.startMs);
    expect(out[1]!.startMs).toBeLessThan(820);
    for (let i = 1; i < out.length; i++)
      expect(out[i]!.startMs).toBeGreaterThanOrEqual(out[i - 1]!.startMs);
  });

  it('ignores a pause too far from any boundary', () => {
    const out = alignToSilences(
      [w('One', 0, 400), w('two', 400, 800)],
      [{ startMs: 5000, endMs: 5200 }],
      6000,
      300,
    );
    expect(out[1]!.startMs).toBe(400);
  });

  it('handles no silences at all', () => {
    expect(alignToSilences([w('Solo', 100, 400)], [], 500)).toEqual([w('Solo', 100, 400)]);
  });
});
