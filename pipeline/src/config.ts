// Model IDs and list prices, checked against provider docs on 2026-10-03.
// Prices drift: the cost ledger prefers the cost each provider returns and
// falls back to these numbers only when a response has none.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODELS = {
  writer: {
    provider: 'deepinfra',
    model: 'zai-org/GLM-5.2',
    usdPerMTokIn: 0.5625,
    usdPerMTokOut: 1.8,
    /** Generous: GLM-5.2 may spend output tokens on reasoning before the JSON. */
    maxTokens: 8000,
  },
  reviewer: {
    provider: 'deepinfra',
    model: 'deepseek-ai/DeepSeek-V4-Pro-0813',
    usdPerMTokIn: 1.3,
    usdPerMTokOut: 2.6,
    maxTokens: 4000,
  },
  /** Optional second reviewer backend, compared against hand labels in M2. */
  reviewerJev: {
    provider: 'openrouter',
    model: 'typesafe/jev-1.13',
    usdPerMTokIn: 0.042,
    usdPerMTokOut: 0,
  },
  tts: {
    provider: 'deepinfra',
    model: 'hexgrad/Kokoro-82M',
    usdPerMChars: 0.62,
    voice: 'af_heart',
  },
  images: {
    provider: 'deepinfra',
    model: 'black-forest-labs/FLUX-1-schnell',
    /** $ per (1024x1024 image x step). */
    usdPerMegapixelStep: 0.0005,
    width: 768,
    height: 1344,
    steps: 4,
  },
} as const;

export const DEFAULT_BUDGET_CAP_USD = 10;

// Video settings live in a module with no Node imports so the Remotion bundle can share them.
export { VIDEO } from './video';

/** Kokoro at speed 1 speaks about 2.5 words per second. */
export const WORDS_PER_SECOND = 2.5;

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');
const libraryPaths = (library: string) => ({
  library,
  reels: path.join(library, 'reels'),
  ledger: path.join(library, 'ledger.jsonl'),
  /** Approved reels only: what the app ships with. */
  manifest: path.join(library, 'manifest.json'),
  /** Every reel that passed the gates and the encode gate, approved or not (development). */
  manifestAll: path.join(library, 'manifest.all.json'),
  report: path.join(library, 'report.html'),
});

/** The shared font files (packages/fonts), read by the glyph audit and bundled into the templates. */
export const FONTS_DIR = path.join(REPO_ROOT, 'packages/fonts/files');

export const PATHS = {
  content: path.join(REPO_ROOT, 'content/software-engineering'),
  ...libraryPaths(path.join(REPO_ROOT, 'library')),
};

/** Dry runs write to library/dry-run/ so fake reels never mix with real ones. */
export function useLibrary(library: string): void {
  Object.assign(PATHS, libraryPaths(library));
}
