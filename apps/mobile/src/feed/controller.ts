// Feed control (docs/PERFORMANCE.md 2.5 and 2.6). Two moments: activation
// (60% visible, mid-swipe) changes play state only; settle (95% for 100 ms)
// does the accounting: it closes the reel being left, tells the agent, logs,
// and loads the player window around the new anchor.
import type { ReelEndInput, ReelEndResult } from '@reels/agent';
import { Easing, cancelAnimation, makeMutable, withTiming } from 'react-native-reanimated';
import { POOL, useApp } from '../lib/store';
import type { FeedSlot, ReelSlot } from '../lib/types';
import { engine, onPlanned } from './engine';
import {
  armTimeout,
  armWatchdog,
  disarmTimeout,
  disarmWatchdog,
  loadFailed,
  notePlay,
  timingStart,
} from './health';
import { pagerRef } from './pagerRef';
import { assign, onLoadError, pauseAll, pool, slotFor, type PlayerSlot } from './players';
import { isFeedVisible } from './visibility';

/** Progress of the active reel, 0 to 1, drawn as the line on the strip's top edge. */
export const progress = makeMutable(0);

interface Impression {
  index: number;
  slot: ReelSlot;
  loops: number;
  /** Loop count at the learner's last input: two idle loops pause playback. */
  lastInputLoop: number;
  playedMs: number;
  playingSince: number | null;
  pausedAt: number | null;
  pausedMs: number;
}

/** A closed impression: what the agent needs, plus what only the log keeps. */
interface Closed {
  input: ReelEndInput;
  slot: ReelSlot;
  pausedMs: number;
}

let open: Impression | null = null;
let maxSettled = -1;
let attached = false;

const reelSlots = (slots: FeedSlot[]) => slots.filter((s): s is ReelSlot => s.kind === 'reel');

function reelByOrdinal(ordinal: number) {
  return reelSlots(useApp.getState().slots).find((s) => s.ordinal === ordinal) ?? null;
}

/**
 * The reel the players are anchored on: the settled reel, or the last reel
 * before a card; a list that starts with a card anchors on the first reel after it.
 */
function anchorOrdinal(index: number): number | null {
  const { slots } = useApp.getState();
  for (let i = index; i >= 0; i--) {
    const s = slots[i];
    if (s?.kind === 'reel') return s.ordinal;
  }
  return slots.slice(index + 1).find((s) => s.kind === 'reel')?.ordinal ?? null;
}

function isOpenPlayer(p: PlayerSlot) {
  return !!open && slotFor(open.slot.ordinal) === p && p.reelId === open.slot.reelId;
}

function startProgress(p: PlayerSlot) {
  if (!open) return;
  const total = open.slot.durationMs;
  const at = Math.min(Math.max(p.player.currentTime * 1000, 0), total);
  cancelAnimation(progress);
  progress.set(at / total);
  progress.set(withTiming(1, { duration: Math.max(total - at, 0), easing: Easing.linear }));
}

function holdProgress(p: PlayerSlot) {
  if (!open) return;
  cancelAnimation(progress);
  progress.set(Math.min(Math.max((p.player.currentTime * 1000) / open.slot.durationMs, 0), 1));
}

function activeReelOn(p: PlayerSlot, reelId: string | null) {
  const app = useApp.getState();
  const s = app.slots[app.activeIndex];
  return s?.kind === 'reel' && slotFor(s.ordinal) === p && s.reelId === reelId ? s : null;
}

export function attachPlayerListeners(): void {
  if (attached) return;
  attached = true;
  onLoadError((p, reelId) => {
    const s = activeReelOn(p, reelId);
    if (s) loadFailed(s, 'player_error');
  });
  // A re-plan (quick action, answer, due timer) may change the next reel: re-assert the window.
  onPlanned(() => {
    const app = useApp.getState();
    if (app.settledIndex >= 0) loadWindow(app.settledIndex);
  });
  for (const p of pool()) {
    p.player.addListener('statusChange', ({ status }) => {
      if (status !== 'error') return;
      const s = activeReelOn(p, p.reelId);
      if (s) loadFailed(s, 'player_error');
    });
    p.player.addListener('playingChange', ({ isPlaying }) => {
      if (!isOpenPlayer(p) || !open) return;
      const now = Date.now();
      if (isPlaying) {
        open.playingSince = now;
        startProgress(p);
      } else {
        if (open.playingSince !== null) open.playedMs += now - open.playingSince;
        open.playingSince = null;
        holdProgress(p);
      }
    });
    p.player.addListener('playToEnd', () => {
      if (!isOpenPlayer(p) || !open) return;
      open.loops += 1;
      cancelAnimation(progress);
      progress.set(0);
      if (open.loops - open.lastInputLoop >= 2) {
        // After two loops with no input the reel pauses (UX.md 3.2).
        p.player.pause();
        useApp.getState().setPaused(true);
      } else {
        startProgress(p);
      }
    });
  }
}

/** Activation: play state only. */
export function activate(index: number): void {
  const app = useApp.getState();
  if (app.activeIndex === index && app.settledIndex !== -1) return;
  app.setActive(index);
  disarmWatchdog();
  engine.refresh(index);
  const slot = useApp.getState().slots[index];
  if (slot?.kind === 'reel') timingStart(slot);
  if (app.failed && (slot?.kind !== 'reel' || slot.reelId !== app.failed.reelId))
    app.setFailed(null);
  for (const p of pool()) {
    if (slot?.kind === 'reel' && slotFor(slot.ordinal) === p) continue;
    try {
      p.player.pause();
      if (!isOpenPlayer(p)) p.player.currentTime = 0;
    } catch {
      // A player that is reloading may throw.
    }
  }
  // The line belongs to the new item from activation on; settle (or the first
  // playingChange after it) restarts it from the player's position.
  cancelAnimation(progress);
  progress.set(0);
  if (slot?.kind === 'reel') playIfReady(slot);
}

/** Play the active reel if its player already holds it and the learner has not paused. */
export function playIfReady(slot: ReelSlot): void {
  const app = useApp.getState();
  if (!isFeedVisible() || app.paused || app.slots[app.activeIndex]?.key !== slot.key) return;
  const p = slotFor(slot.ordinal);
  if (app.loaded[p.index] !== slot.reelId) return;
  try {
    p.player.play();
  } catch {
    // ignore: the watchdog or a retry will pick it up
    return;
  }
  notePlay(slot);
  armWatchdog(slot);
}

/** Close the open impression (PERFORMANCE.md 2.6): watched time = loops x duration + position. */
function closeImpression(endedBy: 'swipe' | 'blur' | 'skip_failed'): Closed | null {
  if (!open) return null;
  const p = slotFor(open.slot.ordinal);
  const now = Date.now();
  if (open.playingSince !== null) open.playedMs += now - open.playingSince;
  if (open.pausedAt !== null) open.pausedMs += now - open.pausedAt;
  const total = open.slot.durationMs;
  let t = 0;
  try {
    t = p.reelId === open.slot.reelId ? p.player.currentTime : 0;
  } catch {
    t = 0;
  }
  let loops = open.loops;
  // playToEnd reaches JS asynchronously: a swipe at the loop point counts the loop.
  if (loops === 0 && t < 1 && open.playedMs > 0.9 * total) loops = 1;
  const closed: Closed = {
    input: {
      key: open.slot.key,
      watchedMs: Math.max(0, Math.round(loops * total + t * 1000)),
      loops,
      durationMs: total,
      endedBy,
    },
    slot: open.slot,
    pausedMs: Math.round(open.pausedMs),
  };
  open = null;
  return closed;
}

function logReelEnd(closed: Closed, result: ReelEndResult | null): void {
  const app = useApp.getState();
  const { input } = closed;
  app.log({
    type: 'reel_end',
    reel_id: closed.slot.reelId,
    concept_id: closed.slot.conceptId,
    watched_ms: input.watchedMs,
    duration_ms: input.durationMs ?? closed.slot.durationMs,
    loops: input.loops,
    // The agent classifies (PLAN.md watch signals); an ignored end is a revisit, logged as partial.
    outcome: result?.outcome ?? 'partial',
    sound_on: app.settings.soundOn,
    paused_ms: closed.pausedMs,
    ended_by: input.endedBy ?? 'swipe',
  });
}

/** Players for the anchor reel, the next and the previous; the disk warms the two after. */
function loadWindow(index: number): void {
  const j = anchorOrdinal(index);
  if (j === null) return;
  const reels = useApp.getState().reels;
  [j, j + 1, j - 1].forEach((k, n) => {
    if (n === 2 && POOL < 3) return;
    const r = k >= 0 ? reelByOrdinal(k) : null;
    if (r) assign(slotFor(k), reels[r.reelId] ?? null);
  });
  for (const k of [j + 2, j + 3]) {
    const r = reelByOrdinal(k);
    if (r && reels[r.reelId])
      void import('../lib/downloads').then((d) => d.enqueue(reels[r.reelId]!));
  }
}

/** Settle on a page: close the reel being left, tell the agent, log, load the player window. */
export function settle(index: number): FeedSlot | null {
  const app = useApp.getState();
  if (index === app.settledIndex) return app.slots[index] ?? null;
  // Undo lasts until the next settle (the agent drops it there too).
  if (app.notice?.undo) app.setNotice(null);
  const closed = closeImpression('swipe');
  let settled;
  try {
    settled = engine.settle(index, closed?.input);
  } catch (error) {
    console.warn('settle failed', error);
    if (closed) logReelEnd(closed, null);
    return null;
  }
  if (closed) logReelEnd(closed, settled.ended);
  if (settled.active.kind !== 'card') app.setCard(null);
  app.setSettled(index);
  app.setPaused(false);
  const slot = settled.active;
  const revisit = settled.revisit || index <= maxSettled;
  maxSettled = Math.max(maxSettled, index);
  if (slot.kind === 'reel') {
    open = {
      index,
      slot,
      loops: 0,
      lastInputLoop: 0,
      playedMs: 0,
      playingSince: null,
      pausedAt: null,
      pausedMs: 0,
    };
    app.log({
      type: 'reel_impression',
      reel_id: slot.reelId,
      concept_id: slot.conceptId,
      slot: index,
      pool: slot.pool,
      reason: slot.reason,
      revisit,
    });
    const p = slotFor(slot.ordinal);
    if (p.player.playing) {
      open.playingSince = Date.now();
      startProgress(p);
    }
    armTimeout(slot);
  } else {
    disarmTimeout();
    if (slot.kind === 'card' && !revisit) {
      app.log({
        type: 'card_shown',
        item_id: slot.itemId,
        concept_id: slot.conceptId,
        slot: index,
        reason: slot.reason,
      });
    }
  }
  loadWindow(index);
  app.flush();
  return slot;
}

/** The learner tapped the picture: toggle pause. Counts as input for the idle-loop rule. */
export function togglePause(): void {
  const app = useApp.getState();
  const slot = app.slots[app.activeIndex];
  if (slot?.kind !== 'reel') return;
  const p = slotFor(slot.ordinal);
  if (open) open.lastInputLoop = open.loops;
  if (app.paused) {
    app.setPaused(false);
    if (open && open.pausedAt !== null) {
      open.pausedMs += Date.now() - open.pausedAt;
      open.pausedAt = null;
    }
    playIfReady(slot);
  } else {
    app.setPaused(true);
    if (open) open.pausedAt = Date.now();
    p.player.pause();
  }
}

/** Feed blur or app background: pause everything, keep the open impression. */
export function suspend(): void {
  disarmWatchdog();
  pauseAll();
}

export function resume(): void {
  const app = useApp.getState();
  const slot = app.slots[app.activeIndex];
  if (slot?.kind === 'reel') playIfReady(slot);
}

/** Learner input that should reset the idle-loop count (quick actions, panels). */
export function noteInput(): void {
  if (open) open.lastInputLoop = open.loops;
}

/** The session ends with a reel on screen: close it without a settle (no interest signal). */
export function endSessionImpression(): void {
  const closed = closeImpression('blur');
  if (!closed) return;
  let result: ReelEndResult | null = null;
  try {
    result = engine.reelEnded(closed.input);
  } catch {
    result = null;
  }
  logReelEnd(closed, result);
}

/** "Skip" on a reel that failed to load: no interest penalty (ended_by skip_failed). */
export function skipFailed(): void {
  const app = useApp.getState();
  const closed = closeImpression('skip_failed');
  if (closed) {
    let result: ReelEndResult | null = null;
    try {
      result = engine.reelEnded(closed.input);
    } catch {
      result = null;
    }
    logReelEnd(closed, result);
  }
  app.setFailed(null);
  pagerRef.current?.scrollToIndex({ index: app.activeIndex + 1, animated: true });
}

/** A new session or profile: forget the open impression and the revisit mark. */
export function resetFeedState(): void {
  open = null;
  maxSettled = -1;
}
