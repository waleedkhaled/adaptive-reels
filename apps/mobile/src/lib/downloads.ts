// File-first playback (docs/PERFORMANCE.md 2.4 and 6.4): every reel is
// downloaded once into the cache and played from file://. Until its file is
// complete, a reel streams from the network while the download is queued.
import type { ManifestReel } from '@reels/schemas';
import { Directory, File, Paths } from 'expo-file-system';
import { reelUrl } from './library';

const dir = () => new Directory(Paths.cache, 'reels');

function fileName(reel: ManifestReel): string {
  const last = reel.url.split('/').pop() ?? `${reel.reel_id}.mp4`;
  // Older manifests use video.mp4 for every reel: prefix the id so names stay unique.
  return last.startsWith(reel.reel_id) ? last : `${reel.reel_id}--${reel.sha256.slice(0, 12)}.mp4`;
}

export function localFile(reel: ManifestReel): File {
  return new File(dir(), fileName(reel));
}

/** Complete on disk: exists and has exactly the manifest's byte count. */
export function isOnDisk(reel: ManifestReel): boolean {
  try {
    const file = localFile(reel);
    return file.exists && file.size === reel.bytes;
  } catch {
    return false;
  }
}

export interface PlaybackSource {
  uri: string;
  contentType: 'progressive';
  useCaching: false;
}

export function sourceFor(reel: ManifestReel): {
  source: PlaybackSource;
  from: 'file' | 'network';
} {
  if (isOnDisk(reel))
    return {
      source: { uri: localFile(reel).uri, contentType: 'progressive', useCaching: false },
      from: 'file',
    };
  enqueue(reel);
  return {
    source: { uri: reelUrl(reel), contentType: 'progressive', useCaching: false },
    from: 'network',
  };
}

const MAX_PARALLEL = 2;
const queue: ManifestReel[] = [];
const inFlight = new Set<string>();

/** Queue a reel's download; duplicates and finished files are ignored. */
export function enqueue(reel: ManifestReel, front = false): void {
  if (inFlight.has(reel.reel_id) || isOnDisk(reel)) return;
  const at = queue.findIndex((r) => r.reel_id === reel.reel_id);
  if (at !== -1) {
    if (!front) return;
    queue.splice(at, 1);
  }
  if (front) queue.unshift(reel);
  else queue.push(reel);
  pump();
}

function pump(): void {
  while (inFlight.size < MAX_PARALLEL && queue.length > 0) {
    const reel = queue.shift()!;
    inFlight.add(reel.reel_id);
    void download(reel).finally(() => {
      inFlight.delete(reel.reel_id);
      pump();
    });
  }
}

/** How much of the library is saved on this device. */
export function savedStatus(reels: readonly ManifestReel[]): {
  saved: number;
  total: number;
  bytes: number;
  savedBytes: number;
} {
  let saved = 0;
  let bytes = 0;
  let savedBytes = 0;
  for (const reel of reels) {
    bytes += reel.bytes;
    if (isOnDisk(reel)) {
      saved++;
      savedBytes += reel.bytes;
    }
  }
  return { saved, total: reels.length, bytes, savedBytes };
}

/** Downloads waiting or running. */
export const pendingDownloads = () => queue.length + inFlight.size;

/**
 * Save every reel for offline use (PERFORMANCE.md 6.4 item 5: pre-download
 * before a demo). The missing ones queue behind the feed's own downloads.
 */
export function saveAll(reels: readonly ManifestReel[]): number {
  let queued = 0;
  for (const reel of reels) {
    if (isOnDisk(reel)) continue;
    enqueue(reel);
    queued++;
  }
  return queued;
}

/**
 * Delete saved files the current manifest no longer lists (a re-rendered reel
 * gets a new hashed name), and leftover partial downloads.
 */
export function pruneStale(reels: readonly ManifestReel[]): number {
  const folder = dir();
  if (!folder.exists) return 0;
  const keep = new Set(reels.map(fileName));
  let removed = 0;
  for (const entry of folder.list()) {
    if (!(entry instanceof File) || keep.has(entry.name)) continue;
    if (entry.name.endsWith('.part') && inFlight.size > 0) continue;
    try {
      entry.delete();
      removed++;
    } catch {
      // A file in use is removed on a later start.
    }
  }
  return removed;
}

async function download(reel: ManifestReel): Promise<void> {
  const folder = dir();
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  // Download to a temporary name and move into place, so a truncated file is never played.
  const tmp = new File(folder, `${fileName(reel)}.part`);
  try {
    if (tmp.exists) tmp.delete();
    const done = await File.downloadFileAsync(reelUrl(reel), tmp, { idempotent: true });
    if (done.size !== reel.bytes) {
      done.delete();
      return;
    }
    const target = localFile(reel);
    if (target.exists) target.delete();
    done.move(target);
  } catch {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      // ignore
    }
  }
}
