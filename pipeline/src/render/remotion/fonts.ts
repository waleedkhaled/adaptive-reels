// Loads the five shared font files (packages/fonts) under the family names of
// @reels/tokens. loadFont() holds every frame with delayRender until its face
// is loaded, so no frame is ever rendered with a fallback font.
import { loadFont } from '@remotion/fonts';
import type { FontFamily } from '@reels/tokens';
import barlowBold from '@reels/fonts/files/BarlowSemiCondensed-Bold.ttf';
import barlowSemiBold from '@reels/fonts/files/BarlowSemiCondensed-SemiBold.ttf';
import monoExtraBold from '@reels/fonts/files/JetBrainsMonoNL-ExtraBold.ttf';
import monoMedium from '@reels/fonts/files/JetBrainsMonoNL-Medium.ttf';
import monoSemiBold from '@reels/fonts/files/JetBrainsMonoNL-SemiBold.ttf';

/** Must match FONT_FILES in @reels/tokens (fonts.test.ts checks it). */
export const FONT_URLS: Record<FontFamily, string> = {
  'BarlowSC-SemiBold': barlowSemiBold,
  'BarlowSC-Bold': barlowBold,
  'MonoNL-Medium': monoMedium,
  'MonoNL-SemiBold': monoSemiBold,
  'MonoNL-ExtraBold': monoExtraBold,
};

export const fontsReady: Promise<void> = Promise.all(
  (Object.entries(FONT_URLS) as [FontFamily, string][]).map(([family, url]) =>
    loadFont({ family, url, format: 'truetype' }),
  ),
).then(() => {
  // loadFont() reports a failure through cancelRender() and still resolves.
  const loaded = new Set(
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  );
  const missing = Object.keys(FONT_URLS).filter((family) => !loaded.has(family));
  if (missing.length) throw new Error(`fonts did not load: ${missing.join(', ')}`);
});
