// A fixed pool of video players (docs/PERFORMANCE.md 2.2), created once and
// re-pointed with replaceAsync. Reel k always uses pool[k % POOL], so the
// previous, current and next reels hold three different players.
import type { ManifestReel } from '@reels/schemas';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { sourceFor } from '../lib/downloads';
import { POOL, useApp } from '../lib/store';

export interface PlayerSlot {
  index: number;
  player: VideoPlayer;
  /** The reel this player is assigned to (by id: the URI changes between http and file://). */
  reelId: string | null;
  /** Generation token: only the latest assignment may finish. */
  gen: number;
  chain: Promise<void>;
  source: 'file' | 'network' | null;
}

let slots: PlayerSlot[] | null = null;
let loadError: ((slot: PlayerSlot, reelId: string) => void) | null = null;

/** Called when a load for the player's current reel is rejected. */
export function onLoadError(handler: (slot: PlayerSlot, reelId: string) => void): void {
  loadError = handler;
}

export function pool(): PlayerSlot[] {
  if (!slots) {
    const muted = !useApp.getState().settings.soundOn;
    slots = Array.from({ length: POOL }, (_, index) => {
      const player = createVideoPlayer(null);
      player.loop = true;
      player.muted = muted;
      player.audioMixingMode = 'auto';
      player.timeUpdateEventInterval = 0;
      player.bufferOptions = {
        preferredForwardBufferDuration: 40,
        minBufferForPlayback: 0.5,
        waitsToMinimizeStalling: true,
      };
      return { index, player, reelId: null, gen: 0, chain: Promise.resolve(), source: null };
    });
  }
  return slots;
}

export const slotFor = (ordinal: number): PlayerSlot => pool()[((ordinal % POOL) + POOL) % POOL]!;

/** Point a player at a reel. Loads are serialised per player; a newer request makes older ones no-ops. */
export function assign(slot: PlayerSlot, reel: ManifestReel | null, force = false): void {
  const id = reel?.reel_id ?? null;
  if (slot.reelId === id && !force) return;
  const gen = ++slot.gen;
  slot.reelId = id;
  useApp.getState().setLoaded(slot.index, null);
  const picked = reel ? sourceFor(reel) : null;
  slot.source = picked?.from ?? null;
  slot.chain = slot.chain
    .then(async () => {
      if (gen !== slot.gen) return;
      try {
        slot.player.pause();
      } catch {
        // ignore
      }
      await slot.player.replaceAsync(picked ? picked.source : null);
    })
    .then(() => {
      if (gen === slot.gen) useApp.getState().setLoaded(slot.index, id);
    })
    .catch(() => {
      if (gen === slot.gen) {
        slot.reelId = null;
        useApp.getState().setLoaded(slot.index, null);
        if (id) loadError?.(slot, id);
      }
    });
}

export function setMutedAll(muted: boolean): void {
  for (const s of pool()) s.player.muted = muted;
}

export function pauseAll(): void {
  for (const s of pool()) {
    try {
      s.player.pause();
    } catch {
      // A released or reloading player may throw; nothing to pause then.
    }
  }
}
