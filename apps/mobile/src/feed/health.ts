// Reel start timing, the stall watchdog and load failures (docs/PERFORMANCE.md
// section 1, 2.3 and 6.4 item 4).
//
// Timing: one record per activation, logged as `reel_first_frame`. iOS passes
// on `playing_ms` (play() to the first currentTime > 0, polled once per frame
// for at most 1 s); `first_frame_ms` and `cover_lifted_ms` are recorded too.
// `hz` is a JS-thread frame-rate proxy sampled for 1 s after playback starts.
//
// Failure: a player error, a rejected load or no first frame 5 s after the reel
// settled. A file source is deleted and reloaded from the URL; a URL is
// retried once after 1 s; a second failure shows the failure state.
import type { ManifestReel } from '@reels/schemas';
import { localFile } from '../lib/downloads';
import { useApp } from '../lib/store';
import type { ReelSlot } from '../lib/types';
import { assign, slotFor } from './players';
import { isFeedVisible } from './visibility';

export type FailCause = 'timeout' | 'player_error';

interface Start {
  key: string;
  reelId: string;
  activatedAt: number;
  ready: boolean;
  source: 'file' | 'network' | 'cache';
  playingMs: number | null;
  polling: boolean;
  logged: boolean;
}

const TIMEOUT_MS = 5000;
const POLL_LIMIT_MS = 1000;
const HZ_WINDOW_MS = 1000;

let start: Start | null = null;
let timeout: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
const retried = new Set<string>();
const watchdogReloads = new Set<string>();
/**
 * Latest first-frame time per item. A preloaded neighbour draws its first
 * frame before it is activated, so first_frame_ms = max(0, frame - activation)
 * is 0 for it (PERFORMANCE.md section 1).
 */
const firstFrames = new Map<string, number>();

const reelOf = (slot: ReelSlot): ManifestReel | undefined => useApp.getState().reels[slot.reelId];

/** Activation of a reel page: open a timing record. */
export function timingStart(slot: ReelSlot): void {
  const p = slotFor(slot.ordinal);
  const ready = useApp.getState().loaded[p.index] === slot.reelId;
  start = {
    key: slot.key,
    reelId: slot.reelId,
    activatedAt: Date.now(),
    ready,
    source: p.source === 'file' ? 'file' : 'network',
    playingMs: null,
    polling: false,
    logged: false,
  };
}

/** play() was called for the active reel: poll for the first advancing frame and sample the frame rate. */
export function notePlay(slot: ReelSlot): void {
  if (!start || start.key !== slot.key || start.polling || start.logged) return;
  const record = start;
  record.polling = true;
  const player = slotFor(slot.ordinal).player;
  const calledAt = Date.now();
  const frames: number[] = [];
  let last = 0;
  let playingAt = 0;
  const tick = (t: number) => {
    if (start !== record) return;
    if (last) frames.push(t - last);
    last = t;
    let time = 0;
    try {
      time = player.currentTime;
    } catch {
      time = 0;
    }
    if (record.playingMs === null && time > 0) {
      record.playingMs = Date.now() - calledAt;
      playingAt = t;
    }
    const pollingDone = record.playingMs !== null || Date.now() - calledAt > POLL_LIMIT_MS;
    const hzDone = playingAt > 0 && t - playingAt >= HZ_WINDOW_MS;
    if (pollingDone && (hzDone || record.playingMs === null)) {
      finish(record, frames);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The video view drew its first frame; the cover lifts at the same moment. */
export function noteFirstFrame(key: string): void {
  firstFrames.delete(key);
  firstFrames.set(key, Date.now());
  // Evict the oldest entries only: the active reel's entry must survive until its timeout checks it.
  for (const old of firstFrames.keys()) {
    if (firstFrames.size <= 50) break;
    firstFrames.delete(old);
  }
  useApp.getState().setFailed(null);
}

function finish(record: Start, frames: number[]): void {
  if (record.logged) return;
  record.logged = true;
  const sorted = frames.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Read, don't delete: armTimeout's check 5 s after settle still needs this entry.
  const frame = firstFrames.get(record.key) ?? null;
  const sinceActivation = (at: number | null) =>
    at === null ? null : Math.max(0, at - record.activatedAt);
  useApp.getState().log({
    type: 'reel_first_frame',
    reel_id: record.reelId,
    playing_ms: record.playingMs,
    first_frame_ms: sinceActivation(frame),
    cover_lifted_ms: sinceActivation(frame),
    ready_at_activation: record.ready,
    source: record.source,
    hz: median ? Math.round(1000 / median) : null,
  });
}

/** Settle on a reel: arm the 5 s timeout for its first frame. */
export function armTimeout(slot: ReelSlot): void {
  disarmTimeout();
  timeout = setTimeout(() => {
    const app = useApp.getState();
    const active = app.slots[app.activeIndex];
    if (active?.key !== slot.key || app.paused || !isFeedVisible()) return;
    // Either signal proves the reel is showing: a drawn frame, or a clock that moved.
    if (firstFrames.has(slot.key)) return;
    if (start?.key === slot.key && start.playingMs !== null) return;
    loadFailed(slot, 'timeout');
  }, TIMEOUT_MS);
}

export function disarmTimeout(): void {
  if (timeout) clearTimeout(timeout);
  timeout = null;
}

/** First failure: reload from the URL (or retry it once). Second: show the failure state. */
export function loadFailed(slot: ReelSlot, cause: FailCause): void {
  const reel = reelOf(slot);
  const app = useApp.getState();
  if (!reel || app.slots[app.activeIndex]?.key !== slot.key) return;
  const p = slotFor(slot.ordinal);
  if (!retried.has(slot.reelId)) {
    retried.add(slot.reelId);
    const fromFile = p.source === 'file';
    if (fromFile) {
      try {
        const file = localFile(reel);
        if (file.exists) file.delete();
      } catch {
        // A file we cannot delete is retried from the URL anyway on the next start.
      }
    }
    setTimeout(
      () => {
        assign(p, reel, true);
        armTimeout(slot);
      },
      fromFile ? 0 : 1000,
    );
    return;
  }
  disarmTimeout();
  app.setFailed({ reelId: slot.reelId, cause });
  app.log({ type: 'reel_load_failed', reel_id: slot.reelId, cause, retried: true });
  app.flush();
}

/** "Try again" on the failure state. */
export function retryFailed(slot: ReelSlot): void {
  const reel = reelOf(slot);
  if (!reel) return;
  retried.delete(slot.reelId);
  useApp.getState().setFailed(null);
  assign(slotFor(slot.ordinal), reel, true);
  armTimeout(slot);
}

/**
 * Stall watchdog: armed once the player is ready after play(); reloads a player
 * whose clock does not move. One timer at a time; a second stall on the same
 * item goes to the load-failure path instead of reloading forever.
 */
export function armWatchdog(slot: ReelSlot): void {
  disarmWatchdog();
  const p = slotFor(slot.ordinal);
  let before = 0;
  try {
    if (p.player.status !== 'readyToPlay') return;
    before = p.player.currentTime;
  } catch {
    return;
  }
  watchdog = setTimeout(() => {
    watchdog = null;
    const app = useApp.getState();
    if (
      !isFeedVisible() ||
      app.paused ||
      app.slots[app.activeIndex]?.key !== slot.key ||
      p.reelId !== slot.reelId
    )
      return;
    let now = 0;
    try {
      now = p.player.currentTime;
    } catch {
      return;
    }
    // Any movement counts (a loop resets the clock to 0).
    if (now !== before) return;
    const reel = reelOf(slot);
    if (!reel) return;
    if (watchdogReloads.has(slot.key)) {
      loadFailed(slot, 'timeout');
      return;
    }
    watchdogReloads.add(slot.key);
    assign(p, reel, true);
    app.log({ type: 'player_watchdog', slot: p.index, reel_id: slot.reelId, action: 'reload' });
  }, 1000);
}

export function disarmWatchdog(): void {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}
