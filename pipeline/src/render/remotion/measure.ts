// Measures text in the render browser with the real fonts, for the dry layout
// pass (layout.ts). Runs inside calculateMetadata, before any frame renders.
import katex from 'katex';
import { reel, type FontFamily } from '@reels/tokens';
import type { EquationFit, FontSpec, Measure } from '../layout';
import { TEXT_WIDTH, VISUAL_BOX } from '../layout';
import { cssStack } from './theme';

const OFFSCREEN = 'position:absolute;left:-20000px;top:0;visibility:hidden;';
const TEXT_CSS =
  'white-space:pre;font-variant-ligatures:none;font-kerning:normal;font-synthesis:none;';

/** Width of one line of text, measured as the templates set it (TEXT in theme.ts). */
export function domTextMeasure(): Measure {
  const span = document.createElement('span');
  span.style.cssText = OFFSCREEN + TEXT_CSS;
  document.body.appendChild(span);
  const cache = new Map<string, number>();
  return (text: string, font: FontSpec) => {
    const key = `${font.stack.join(',')}|${font.size}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      span.style.fontFamily = cssStack(font.stack);
      span.style.fontSize = `${font.size}px`;
      span.textContent = text;
      width = span.getBoundingClientRect().width;
      cache.set(key, width);
    }
    return width;
  };
}

/** Distance from the top of a line box to the baseline, for the caption playhead. */
export function baselineOffset(stack: readonly FontFamily[], size: number, lineHeight: number) {
  const line = document.createElement('div');
  line.style.cssText = `${OFFSCREEN + TEXT_CSS}font-family:${cssStack(stack)};font-size:${size}px;line-height:${lineHeight}px`;
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline';
  line.append('Hg', probe);
  document.body.appendChild(line);
  const offset = probe.getBoundingClientRect().top - line.getBoundingClientRect().top;
  line.remove();
  return Math.round(offset * 10) / 10;
}

/** KaTeX sets `.katex { font-size: 1.21em }`; sizes in the layout are the rendered em. */
export const KATEX_EM = 1.21;

export function equationHtml(latex: string): string {
  return katex.renderToString(latex, { throwOnError: true, displayMode: false, output: 'html' });
}

const KATEX_FACES = [
  'KaTeX_Main',
  'italic 1em KaTeX_Math',
  'KaTeX_Size1',
  'KaTeX_Size2',
  'KaTeX_AMS',
] as const;

/** Waits until the KaTeX faces an equation uses have loaded. */
export async function katexFontsReady(): Promise<void> {
  await Promise.all(
    KATEX_FACES.map((face) => document.fonts.load(face.includes('1em') ? face : `1em ${face}`)),
  );
  await document.fonts.ready;
}

const EQUATION_SIZES = (() => {
  const sizes: number[] = [];
  for (let s = reel.equation.size; s >= reel.equation.floor; s -= 4) sizes.push(s);
  return sizes;
})();

/**
 * The largest size (56 down to the 32 floor) at which the formula fits the
 * visual box on one line; failing that, the largest at which KaTeX can break
 * it after operators into at most 2 lines (else into as many as fit). A string
 * is a problem.
 */
export async function measureEquation(latex: string): Promise<EquationFit | string> {
  let html: string;
  try {
    html = equationHtml(latex);
  } catch (error) {
    return `equation does not parse: ${(error as Error).message}`;
  }
  const box = document.createElement('div');
  box.style.cssText = OFFSCREEN;
  box.innerHTML = html;
  document.body.appendChild(box);
  const measureAt = (size: number, wrap: boolean) => {
    box.style.fontSize = `${size / KATEX_EM}px`;
    box.style.whiteSpace = wrap ? 'normal' : 'nowrap';
    box.style.display = wrap ? 'block' : 'inline-block';
    box.style.width = wrap ? `${TEXT_WIDTH}px` : 'auto';
    const rect = box.getBoundingClientRect();
    return { width: wrap ? box.scrollWidth : rect.width, height: rect.height };
  };
  try {
    void box.offsetWidth;
    await katexFontsReady();
    for (const size of EQUATION_SIZES) {
      const one = measureAt(size, false);
      if (one.width <= TEXT_WIDTH && one.height <= VISUAL_BOX.height)
        return { size, wrap: false, width: Math.ceil(one.width), height: Math.ceil(one.height) };
    }
    let fallback: EquationFit | null = null;
    for (const size of EQUATION_SIZES) {
      const lineHeight = measureAt(size, false).height;
      const wrapped = measureAt(size, true);
      if (wrapped.width > TEXT_WIDTH || wrapped.height > VISUAL_BOX.height) continue;
      const fit = {
        size,
        wrap: true,
        width: Math.ceil(wrapped.width),
        height: Math.ceil(wrapped.height),
      };
      if (wrapped.height <= 2.5 * lineHeight) return fit;
      fallback ??= fit;
    }
    return fallback ?? `equation does not fit the visual box at ${reel.equation.floor} px`;
  } finally {
    box.remove();
  }
}
