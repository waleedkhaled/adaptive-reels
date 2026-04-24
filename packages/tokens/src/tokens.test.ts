import { describe, expect, it } from 'vitest';
import { color, contrast, feedFit, mapFit, stripHeight } from './index';

const base = color.bg.base;

describe('colour contrast (DESIGN.md Colors table)', () => {
  const rows: [string, string, number][] = [
    ['text.primary', color.text.primary, 15.85],
    ['text.secondary', color.text.secondary, 8.35],
    ['line.control', color.line.control, 4.91],
    ['proven.dim', color.proven.dim, 6.35],
    ['proven', color.proven.base, 10.57],
    ['proven.bright', color.proven.bright, 13.8],
    ['due', color.due, 9.57],
    ['error', color.error.base, 7.04],
    ['syntax.literal', color.syntax.literal, 11.58],
    ['syntax.name', color.syntax.name, 9.24],
  ];
  it.each(rows)('%s on bg.base matches the documented ratio', (_name, hex, ratio) => {
    expect(contrast(hex, base)).toBeCloseTo(ratio, 1);
  });

  it('every text colour reaches 4.5:1 on all three surfaces', () => {
    for (const surface of [color.bg.base, color.bg.raised, color.bg.overlay]) {
      for (const text of [
        color.text.primary,
        color.text.secondary,
        color.proven.dim,
        color.proven.base,
        color.due,
        color.error.base,
      ]) {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('due and proven are not separable by lightness, so shape must carry "due"', () => {
    expect(contrast(color.due, color.proven.base)).toBeLessThan(1.2);
  });
});

describe('strip height', () => {
  it('matches DESIGN.md at the documented font scales', () => {
    expect(stripHeight(1)).toBe(60);
    expect(stripHeight(1.3)).toBe(98);
    expect(stripHeight(1, true)).toBe(76);
    expect(stripHeight(1.3, true)).toBe(121);
  });
});

describe('feed fit', () => {
  const ios = (w: number, h: number, top: number, bottom: number) =>
    feedFit({ width: w, height: h }, { top, bottom, left: 0, right: 0 }, 1, 'ios', 48);

  it('gives a full-width picture on common phones', () => {
    for (const layout of [ios(390, 844, 47, 34), ios(393, 852, 59, 34), ios(375, 812, 44, 34)]) {
      expect(layout.folded).toBe(false);
      expect(layout.picture.width).toBeCloseTo(layout.picture.width, 5);
      expect(layout.picture.x).toBeGreaterThanOrEqual(0);
    }
    const l = ios(390, 844, 47, 34);
    expect(l.picture.width).toBe(390);
    expect(l.axis).toBeCloseTo((390 * 40) / 720, 5);
  });

  it('keeps the content band inside the free region', () => {
    const l = ios(390, 844, 47, 34);
    const bandTop = l.picture.y + 120 * l.scale;
    const bandBottom = l.picture.y + 1120 * l.scale;
    expect(bandTop).toBeGreaterThanOrEqual(l.free.top - 0.001);
    expect(bandBottom).toBeLessThanOrEqual(l.free.bottom + 0.001);
  });

  it('folds the top row away on 16:9 phones', () => {
    const l = ios(375, 667, 20, 0);
    expect(l.folded).toBe(true);
    expect(l.topRow).toBe(0);
  });

  it('does not fold common phones at larger text', () => {
    for (const fs of [1.15, 1.235, 1.3]) {
      const l = feedFit(
        { width: 393, height: 852 },
        { top: 59, bottom: 34, left: 0, right: 0 },
        fs,
        'ios',
        48,
      );
      expect(l.folded).toBe(false);
    }
  });
});

describe('map fit (DESIGN.md "Map fit" table)', () => {
  const ios = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0 });
  const span = (
    w: number,
    h: number,
    insets: ReturnType<typeof ios>,
    platform: 'ios' | 'android',
  ) => ({
    full: mapFit({ width: w, height: h }, insets, 1, platform, 0).span,
    compact: mapFit({ width: w, height: h }, insets, 1, platform, 10_000).span,
  });

  it('matches the documented spans', () => {
    expect(span(390, 844, ios(47, 34), 'ios')).toEqual({ full: 455, compact: 489 });
    expect(span(393, 852, ios(59, 34), 'ios')).toEqual({ full: 451, compact: 485 });
    expect(span(375, 812, ios(44, 34), 'ios')).toEqual({ full: 426, compact: 460 });
    expect(span(360, 800, ios(24, 24), 'android')).toEqual({ full: 436, compact: 474 });
    expect(span(360, 800, ios(24, 48), 'android')).toEqual({ full: 412, compact: 450 });
    expect(span(412, 915, ios(32, 24), 'android').full).toBe(543);
    expect(span(412, 915, ios(32, 48), 'android').full).toBe(519);
  });

  it('opens React Native in full mode only where its rail fits', () => {
    expect(mapFit({ width: 390, height: 844 }, ios(47, 34), 1, 'ios', 448).mode).toBe('full');
    expect(mapFit({ width: 393, height: 852 }, ios(59, 34), 1, 'ios', 448).mode).toBe('full');
    expect(mapFit({ width: 375, height: 812 }, ios(44, 34), 1, 'ios', 452).mode).toBe('compact');
    expect(mapFit({ width: 390, height: 844 }, ios(47, 34), 1, 'ios', 468).mode).toBe('compact');
  });

  it('uses 22 pt tiles from 390 wide, 18 below, rows never under 42', () => {
    expect(mapFit({ width: 390, height: 844 }, ios(47, 34), 1, 'ios', 0).tile).toBe(22);
    const small = mapFit({ width: 360, height: 800 }, ios(24, 48), 1, 'android', 10_000);
    expect(small.tile).toBe(18);
    expect(small.matrixRow).toBe(42);
  });

  it('switches to tabs at large text and makes room for the sample band', () => {
    expect(mapFit({ width: 390, height: 844 }, ios(47, 34), 1.35, 'ios', 0).mode).toBe('tabs');
    const seeded = mapFit({ width: 390, height: 844 }, ios(47, 34), 1, 'ios', 0, true);
    expect(seeded.span).toBe(455 - 24);
    expect(seeded.stageTop).toBe(47 + 44 + 24 + 44 + 220);
  });
});
