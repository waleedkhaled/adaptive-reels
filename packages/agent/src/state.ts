// Profile creation and read helpers over LearnerState. Every update elsewhere
// is immutable and structurally shared: only changed entries are new objects.
import {
  SCHEMA_VERSION,
  type ClockSetting,
  type ConceptMastery,
  type DisplayLevel,
  type LearnerState,
  type Mode,
  type Pending,
  type Session,
} from '@reels/schemas';
import type { Catalog, ConceptInfo } from './catalog';
import { conceptOf } from './catalog';
import { INTERVALS, PRIORS } from './config';

export interface CreateProfileInput {
  profileId: string;
  /** Epoch ms. */
  now: number;
  /** Seed of every random draw. Use DEMO_SEED for profiles created under the demo clock. */
  seed: number;
  /** Topics picked at onboarding (priors 0.7 picked, 0.3 others). */
  topicIds?: readonly string[];
  /** "Skip" at onboarding: prior 0.5 everywhere. Also implied by an empty pick. */
  skipped?: boolean;
  /** Defaults to Light, or Focus when the demo clock is on. */
  mode?: Mode;
  clock?: ClockSetting;
  /** With the demo clock on: the mode to restore when it is switched off (default Light). */
  modeBeforeDemo?: Mode | null;
}

/** A fresh profile. Topic priors and root unlocks are implied, so no catalog is needed. */
export function createProfile(input: CreateProfileInput): LearnerState {
  const clock = input.clock ?? 'real';
  const topicIds = [...(input.topicIds ?? [])];
  const mode = input.mode ?? (clock === 'demo' ? 'focus' : 'light');
  return {
    schema_version: SCHEMA_VERSION,
    profile_id: input.profileId,
    created_at: input.now,
    seed: input.seed >>> 0,
    sample: null,
    settings: {
      mode,
      clock,
      mode_before_demo: clock === 'demo' ? (input.modeBeforeDemo ?? 'light') : null,
    },
    onboarding: { topic_ids: topicIds, skipped: input.skipped === true || topicIds.length === 0 },
    interest: { topic: {}, concept_offset: {}, engaged_topics: [] },
    mastery: {},
    exposure: {},
    unlocked: {},
    reels: {},
    items: {},
    topic_reels: {},
    counters: { reels: 0, cards: 0, summaries: 0 },
    session: newSession(0, input.now),
    pending: emptyPending(),
    queue: { active: null, committed: null, upcoming: [] },
    undo: null,
    map_seen: null,
    gap: null,
  };
}

export function newSession(index: number, now: number): Session {
  return {
    index,
    started_at: now,
    last_active_at: now,
    hidden: [],
    shown_reels: [],
    history: [],
    reels: 0,
    reels_since_card: 0,
    items_since_summary: 0,
    cards_answered: 0,
    cards_correct: 0,
    checked: [],
    learned: [],
    exhausted_summary: false,
    pace_used_key: null,
    misses: {},
  };
}

export function emptyPending(): Pending {
  return {
    reteach: null,
    prove_it: null,
    echo: null,
    pitfall_next: [],
    deferred: [],
    awaiting: [],
  };
}

export const EMPTY_MASTERY: ConceptMastery = Object.freeze({
  box: 0,
  due_at: null,
  scheduled_at: null,
  retry: false,
  last_answered_at: null,
  correct_count: 0,
  wrong_count: 0,
  last_item_id: null,
});

export function masteryOf(state: LearnerState, conceptId: string): ConceptMastery {
  return state.mastery[conceptId] ?? EMPTY_MASTERY;
}

/** Interval for a box (or the retry interval) on the profile's clock. */
export function intervalMs(clock: ClockSetting, box: number, retry: boolean): number {
  const table = INTERVALS[clock];
  return retry ? table.retryMs : (table.boxMs[Math.max(0, Math.min(4, box))] ?? table.retryMs);
}

export function isDue(mastery: ConceptMastery, now: number): boolean {
  return mastery.due_at !== null && mastery.due_at <= now;
}

/** Learned means box >= 2 (PLAN "Mastery"). */
export function isLearned(state: LearnerState, conceptId: string): boolean {
  return masteryOf(state, conceptId).box >= 2;
}

/** Roots are always unlocked; others once all prerequisites were Learned (sticky). */
export function isUnlocked(state: LearnerState, concept: ConceptInfo): boolean {
  return concept.isRoot || state.unlocked[concept.id] !== undefined;
}

/** Topic interest, or the onboarding prior while it has not moved. */
export function topicInterest(state: LearnerState, topicId: string): number {
  const value = state.interest.topic[topicId];
  if (value !== undefined) return value;
  if (state.onboarding.skipped) return PRIORS.skipped;
  return state.onboarding.topic_ids.includes(topicId) ? PRIORS.picked : PRIORS.other;
}

/** I(c) = clamp01(topicInterest[topic(c)] + conceptOffset[c]) (PLAN "Interest"). */
export function interestOf(state: LearnerState, catalog: Catalog, conceptId: string): number {
  const concept = conceptOf(catalog, conceptId);
  return clamp01(
    topicInterest(state, concept.topicId) + (state.interest.concept_offset[conceptId] ?? 0),
  );
}

/** Seen and above come from evidence: a non-early-skip reel end, or any answer. */
export function levelOf(state: LearnerState, conceptId: string): DisplayLevel {
  const m = state.mastery[conceptId];
  if (m && m.box >= 3) return 'retained';
  if (m && m.box === 2) return 'learned';
  if (m && m.box === 1) return 'checked';
  if (m || state.exposure[conceptId]) return 'seen';
  return 'none';
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Rounds away float noise so persisted interest stays readable (6 decimals). */
export function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** `list` itself when it already holds `value` (structural sharing), else a copy with it. */
export function addUnique<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value];
}
