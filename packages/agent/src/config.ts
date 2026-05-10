// Every tunable number of the agent, with the document it comes from.
import type { ClockSetting, Mode, Pool } from '@reels/schemas';

/** Pool order for the weighted draw (PLAN "Pools"). The order fixes the cumulative draw. */
export const POOLS: readonly Pool[] = ['review', 'deepen', 'explore', 'lateral'];

/** Default pool weights per mode (PLAN "Default weights per mode"). */
export const DEFAULT_POOL_WEIGHTS: Record<Mode, Record<Pool, number>> = {
  light: { review: 0.15, deepen: 0.25, explore: 0.35, lateral: 0.25 },
  focus: { review: 0.35, deepen: 0.45, explore: 0.05, lateral: 0.15 },
};

export interface ModeConfig {
  weights: Record<Pool, number>;
  /** Cadence: a card after this many reels since the last card (PLAN rule 4). */
  cardEvery: number;
  /**
   * Overdue guard (UX.md 9.2): the review must be at most this many items after
   * the one on screen when it fell due. Focus 1 = "next slot", Light 2 = "within 2 slots".
   */
  overdueSlots: number;
  /** Session summary after this many items (UX.md 3.7). */
  summaryAfter: number;
}

export const MODE_CONFIG: Record<Mode, ModeConfig> = {
  light: { weights: DEFAULT_POOL_WEIGHTS.light, cardEvery: 4, overdueSlots: 2, summaryAfter: 10 },
  focus: { weights: DEFAULT_POOL_WEIGHTS.focus, cardEvery: 2, overdueSlots: 1, summaryAfter: 14 },
};

export interface IntervalTable {
  /** Due again after a wrong answer. */
  retryMs: number;
  /** Interval after reaching box 0..4 (box 0 is never scheduled by a correct answer). */
  boxMs: readonly [number, number, number, number, number];
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

/** PLAN "Mastery" interval tables. */
export const INTERVALS: Record<ClockSetting, IntervalTable> = {
  real: { retryMs: MINUTE, boxMs: [0, 10 * MINUTE, DAY, 3 * DAY, 7 * DAY] },
  demo: { retryMs: 20 * SECOND, boxMs: [0, 60 * SECOND, 3 * MINUTE, 6 * MINUTE, 12 * MINUTE] },
};

/** Onboarding priors (UX.md 3.1): picked 0.7, others 0.3; "Skip" 0.5 everywhere. */
export const PRIORS = { picked: 0.7, other: 0.3, skipped: 0.5 } as const;

export interface InterestDelta {
  concept: number;
  topic: number;
  /** Added to the concept offset of every RELATED_TO neighbour. */
  related: number;
}

/** PLAN "Interest" signal table. "Too easy" and "Partial" move nothing. */
export const INTEREST_DELTAS = {
  completed: { concept: 0.05, topic: 0.03, related: 0.02 },
  rewatch: { concept: 0.1, topic: 0.05, related: 0.03 },
  early_skip: { concept: -0.1, topic: -0.05, related: 0 },
  more_like_this: { concept: 0.25, topic: 0.15, related: 0.1 },
  not_for_me: { concept: -0.4, topic: -0.15, related: 0 },
} as const satisfies Record<string, InterestDelta>;

/** Watch-signal thresholds (PLAN "Interest", PERFORMANCE.md 2.6). */
export const WATCH = {
  completedFraction: 0.9,
  rewatchFraction: 1.5,
  earlySkipFraction: 0.25,
  earlySkipMaxMs: 5 * SECOND,
} as const;

export const RULES = {
  /** Deepen: I(c) at least this (PLAN "Pools"). */
  deepenMinInterest: 0.5,
  deepenJustUnlockedBonus: 0.2,
  deepenStartedBonus: 0.1,
  /** Explore: topics with at most this many reels seen and topic interest above the floor. */
  exploreMaxSeen: 1,
  exploreMinTopicInterest: 0.15,
  exploreInterestWeight: 0.25,
  /** Lateral looks at liked reels among the last this many reels. */
  lateralWindow: 5,
  /** No-repeat filter: a concept is not among the previous this many reels (UX.md 9.7). */
  noRepeatReels: 2,
  /** Honesty gap: no reel of a concept whose review is due or due within this many ms (UX.md 9.8). */
  honestyGapMs: 90 * SECOND,
  /** "Later": back after this many reels (UX.md 3.3). */
  deferReels: 2,
  /** A first check comes at least this many reels after exposure (PLAN "Mastery"). */
  firstCheckAfterReels: 1,
  /** Re-plan: at most this many cards or summaries go before the committed reel (PERFORMANCE.md 2.5). */
  maxNonReelsBeforeReel: 2,
  /** Re-plan: provisional items after the committed reel. */
  provisional: 2,
  /** Gap session cap (UX.md 3.6). */
  gapCap: 6,
  /**
   * Wrong feed answers on one concept in a session before it rests: no
   * reteach and no card for it until the next session (owner decision #8,
   * 2026-10-05). The map can still start it on purpose.
   */
  missCap: 2,
  /** A return after this long away starts a new session (UX.md 3.7). */
  sessionIdleMs: 30 * MINUTE,
  /** Session history kept in the persisted state. */
  historyCap: 500,
} as const;

/** Score ties closer than this are broken by the seeded draw. */
export const SCORE_EPSILON = 1e-9;

/** Short rail labels where the topic short title is still too long (UX.md 5.5: "AI" for AI engineering). */
export const RAIL_TOPIC_LABELS: Readonly<Record<string, string>> = { 'ai-engineering': 'AI' };

/**
 * Demo seed (UX.md section 7), the smallest that works: slot 0 draws Deepen
 * (90/10 against Explore), the slot-1 draw before "More like this" is not
 * Components and props (so the tap visibly changes the next reel), and the
 * Explore ties pick Tokens and context windows for reel 3 and Caching for
 * reel 4. Profiles created under the demo clock, and "Reset progress" with the
 * demo clock on, use it. Pinned by `demo.test.ts`; a change to the draw keys
 * or candidate order needs a new seed (`npm run simulate -- --find-demo-seed`).
 */
export const DEMO_SEED = 14;
