// Where reels come from: the curriculum graph is bundled with the app; the
// manifest and the videos are served by the pipeline's review server (or the
// tester host). The last good manifest is kept on disk for offline starts.
import { KnowledgeGraph, Manifest, type ManifestReel } from '@reels/schemas';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import graphJson from '../../../../content/software-engineering/graph.json';

export const graph: KnowledgeGraph = KnowledgeGraph.parse(graphJson);

export type ReelSet = 'all' | 'approved';

/**
 * Development builds default to every reel that passed the checks; production
 * to approved reels only. EXPO_PUBLIC_REEL_SET (inlined at build time) overrides
 * it, e.g. "all" for a device build made before the approve pass.
 */
const reelSetFromEnv = process.env.EXPO_PUBLIC_REEL_SET;
export const defaultReelSet: ReelSet =
  reelSetFromEnv === 'all' || reelSetFromEnv === 'approved'
    ? reelSetFromEnv
    : __DEV__
      ? 'all'
      : 'approved';

/** The default port of `npm run pipeline -- serve`. */
const LIBRARY_PORT = 8090;

/** Base URL of the reel library: EXPO_PUBLIC_LIBRARY_URL, else the dev machine's address on the review server port. */
export function libraryBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LIBRARY_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri ?? '127.0.0.1:8081';
  const host = hostUri.split(':')[0] ?? '127.0.0.1';
  return `http://${host}:${LIBRARY_PORT}`;
}

export function manifestFile(set: ReelSet): string {
  return set === 'all' ? 'manifest.all.json' : 'manifest.json';
}

export function reelUrl(reel: ManifestReel): string {
  return /^https?:\/\//.test(reel.url) ? reel.url : `${libraryBaseUrl()}/${reel.url}`;
}

const cachedManifest = (set: ReelSet) => new File(Paths.document, `cached-${manifestFile(set)}`);

export interface LoadedManifest {
  manifest: Manifest;
  source: 'network' | 'disk';
}

/** Fetch the manifest; fall back to the copy saved from the last successful start. */
export async function loadManifest(set: ReelSet): Promise<LoadedManifest> {
  const url = `${libraryBaseUrl()}/${manifestFile(set)}`;
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const manifest = Manifest.parse(JSON.parse(text));
    try {
      const file = cachedManifest(set);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
    } catch {
      // A failed cache write only costs the offline start.
    }
    return { manifest, source: 'network' };
  } catch (error) {
    const file = cachedManifest(set);
    if (file.exists) {
      return { manifest: Manifest.parse(JSON.parse(await file.text())), source: 'disk' };
    }
    throw error;
  }
}
