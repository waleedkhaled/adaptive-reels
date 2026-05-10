// Interest moves only from behaviour (PLAN "Interest", PERFORMANCE.md 2.6).
import type { LearnerState, WatchSignal } from '@reels/schemas';
import type { Catalog } from './catalog';
import { conceptOf } from './catalog';
import { WATCH, type InterestDelta } from './config';
import { clamp, clamp01, round6, topicInterest } from './state';

export type ReelOutcome = 'completed' | 'partial' | 'early_skip';
export type EndedBy = 'swipe' | 'skip_failed' | 'blur';

export interface WatchInput {
  /** loops * duration + position at close (PERFORMANCE.md 2.6). */
  watchedMs: number;
  durationMs: number;
  /** playToEnd count. */
  loops: number;
  endedBy: EndedBy;
}

export interface WatchClassification {
  /** The logged `reel_end.outcome`. */
  outcome: ReelOutcome;
  /** The interest signal; one per impression ("none" for skip_failed and blur). */
  signal: WatchSignal;
  /** Seen, and eligible for a first check (UX.md 9.6). */
  exposed: boolean;
}

/**
 * Completed: watched >= 90%. Early skip: no loop and left before min(25%, 5 s).
 * Rewatch (watched >= 150%) replaces the Completed signal; the outcome stays
 * "completed". skip_failed and blur change no interest (UX.md section 8);
 * blur still exposes by position, a failed reel never does.
 */
export function classifyWatch(input: WatchInput): WatchClassification {
  const { watchedMs, durationMs, loops } = input;
  const completed = watchedMs >= WATCH.completedFraction * durationMs;
  const earlySkip =
    !completed &&
    loops === 0 &&
    watchedMs < Math.min(WATCH.earlySkipFraction * durationMs, WATCH.earlySkipMaxMs);
  const byPosition: ReelOutcome = completed ? 'completed' : earlySkip ? 'early_skip' : 'partial';
  if (input.endedBy === 'skip_failed')
    return { outcome: 'partial', signal: 'none', exposed: false };
  if (input.endedBy === 'blur') return { outcome: 'partial', signal: 'none', exposed: !earlySkip };
  const rewatch = watchedMs >= WATCH.rewatchFraction * durationMs;
  return {
    outcome: byPosition,
    signal: rewatch ? 'rewatch' : byPosition,
    exposed: !earlySkip,
  };
}

/** Apply a delta to the concept, its topic and its RELATED_TO neighbours. */
export function applyInterest(
  state: LearnerState,
  catalog: Catalog,
  conceptId: string,
  delta: InterestDelta,
): LearnerState {
  const concept = conceptOf(catalog, conceptId);
  const offsets = { ...state.interest.concept_offset };
  const bump = (id: string, d: number) => {
    if (d !== 0) offsets[id] = round6(clamp((offsets[id] ?? 0) + d, -1, 1));
  };
  bump(conceptId, delta.concept);
  for (const n of concept.related) bump(n, delta.related);
  const topic =
    delta.topic === 0
      ? state.interest.topic
      : {
          ...state.interest.topic,
          [concept.topicId]: round6(clamp01(topicInterest(state, concept.topicId) + delta.topic)),
        };
  return { ...state, interest: { ...state.interest, topic, concept_offset: offsets } };
}
