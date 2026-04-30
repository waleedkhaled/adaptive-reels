import fs from 'node:fs';
import path from 'node:path';
import { FONT_FILES } from '@reels/tokens';
import { describe, expect, it } from 'vitest';
import { FONTS_DIR } from '../config';
import { advanceWidth, fontCoverage, fontData } from './fontdata';

const cp = (ch: string) => ch.codePointAt(0)!;

describe('shared font files', () => {
  it('exist for every family of the token module', () => {
    for (const file of Object.values(FONT_FILES))
      expect(fs.existsSync(path.join(FONTS_DIR, file))).toBe(true);
  });

  it('are the files the Remotion bundle imports, under the same family names', () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, 'remotion/fonts.ts'), 'utf8');
    for (const [family, file] of Object.entries(FONT_FILES)) {
      const name = new RegExp(
        `import (\\w+) from '@reels/fonts/files/${file.replace('.', '\\.')}'`,
      ).exec(source)?.[1];
      expect(name, file).toBeTruthy();
      expect(source).toContain(`'${family}': ${name}`);
    }
  });

  it('report coverage as the glyph audit needs it', () => {
    const c = fontCoverage();
    // Barlow lacks arrows and ticks; Mono NL has them; nobody has the double arrow.
    expect(c['BarlowSC-Bold'].has(cp('→'))).toBe(false);
    expect(c['BarlowSC-Bold'].has(cp('≠'))).toBe(true);
    expect(c['MonoNL-ExtraBold'].has(cp('→'))).toBe(true);
    expect(c['MonoNL-ExtraBold'].has(cp('✓'))).toBe(true);
    expect(Object.values(c).some((set) => set.has(cp('⇄')))).toBe(false);
  });

  it('measure Mono NL at 0.6 em per column, in every weight', () => {
    expect(fontData('MonoNL-SemiBold').unitsPerEm).toBe(1000);
    expect(advanceWidth('const x = 1;', 'MonoNL-SemiBold', 26)).toBeCloseTo(12 * 0.6 * 26);
    expect(advanceWidth('→²—', 'MonoNL-ExtraBold', 10)).toBeCloseTo(18);
  });
});
