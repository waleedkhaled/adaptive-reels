// Reads the shared TTF files directly: which characters each font covers
// (cmap) and how wide each glyph is (hmtx). Used by the glyph audit and to
// measure code, which is set in a monospace font without kerning, so the sum of
// advances is the rendered width.
import fs from 'node:fs';
import path from 'node:path';
import { FONT_FILES, type FontFamily } from '@reels/tokens';
import { FONTS_DIR } from '../config';
import type { Coverage } from './text';

export interface FontData {
  unitsPerEm: number;
  /** Code point -> glyph id, for every mapped character. */
  glyphs: Map<number, number>;
  /** Advance width of a glyph, in font units. */
  advance(glyph: number): number;
}

function tableOffsets(buf: Buffer): Map<string, number> {
  const count = buf.readUInt16BE(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    tables.set(buf.toString('latin1', record, record + 4), buf.readUInt32BE(record + 8));
  }
  return tables;
}

/** cmap formats 4 (BMP) and 12 (full range); other formats are skipped. */
function readCmap(buf: Buffer, base: number): Map<number, number> {
  const map = new Map<number, number>();
  const subtables = buf.readUInt16BE(base + 2);
  for (let i = 0; i < subtables; i++) {
    const offset = base + buf.readUInt32BE(base + 8 + i * 8);
    const format = buf.readUInt16BE(offset);
    if (format === 4) {
      const segCountX2 = buf.readUInt16BE(offset + 6);
      const ends = offset + 14;
      const starts = ends + segCountX2 + 2;
      const deltas = starts + segCountX2;
      const rangeOffsets = deltas + segCountX2;
      for (let s = 0; s < segCountX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        const delta = buf.readInt16BE(deltas + s * 2);
        const rangeOffset = buf.readUInt16BE(rangeOffsets + s * 2);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let glyph: number;
          if (rangeOffset === 0) glyph = (cp + delta) & 0xffff;
          else {
            glyph = buf.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (cp - start) * 2);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0 && !map.has(cp)) map.set(cp, glyph);
        }
      }
    } else if (format === 12) {
      const groups = buf.readUInt32BE(offset + 12);
      for (let g = 0; g < groups; g++) {
        const group = offset + 16 + g * 12;
        const start = buf.readUInt32BE(group);
        const end = buf.readUInt32BE(group + 4);
        const startGlyph = buf.readUInt32BE(group + 8);
        for (let cp = start; cp <= end; cp++) {
          const glyph = startGlyph + (cp - start);
          if (glyph !== 0 && !map.has(cp)) map.set(cp, glyph);
        }
      }
    }
  }
  return map;
}

export function parseFont(buf: Buffer): FontData {
  const tables = tableOffsets(buf);
  const need = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`font has no ${tag} table`);
    return offset;
  };
  const unitsPerEm = buf.readUInt16BE(need('head') + 18);
  const numberOfHMetrics = buf.readUInt16BE(need('hhea') + 34);
  const hmtx = need('hmtx');
  return {
    unitsPerEm,
    glyphs: readCmap(buf, need('cmap')),
    advance: (glyph) => buf.readUInt16BE(hmtx + Math.min(glyph, numberOfHMetrics - 1) * 4),
  };
}

const cache = new Map<FontFamily, FontData>();

/** The parsed font file for a family, from packages/fonts. */
export function fontData(family: FontFamily): FontData {
  let data = cache.get(family);
  if (!data) {
    data = parseFont(fs.readFileSync(path.join(FONTS_DIR, FONT_FILES[family])));
    cache.set(family, data);
  }
  return data;
}

/** Code points each family covers, for the glyph audit. */
export function fontCoverage(): Coverage {
  const families = Object.keys(FONT_FILES) as FontFamily[];
  return Object.fromEntries(
    families.map((f) => [f, new Set(fontData(f).glyphs.keys())]),
  ) as unknown as Coverage;
}

/**
 * Width in px of `text` set in `family` at `size`, from the glyph advances.
 * Exact for the monospace code font (no kerning, no ligatures); an
 * approximation for proportional fonts, which the browser measures instead.
 */
export function advanceWidth(text: string, family: FontFamily, size: number): number {
  const font = fontData(family);
  let units = 0;
  for (const ch of text) units += font.advance(font.glyphs.get(ch.codePointAt(0)!) ?? 0);
  return (units / font.unitsPerEm) * size;
}
