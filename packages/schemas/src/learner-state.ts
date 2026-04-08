import * as z from 'zod';
import {
  Angle,
  Box,
  ClockSetting,
  ConceptId,
  EpochMs,
  Mode,
  NodeId,
  Pool,
  QuickAction,
  Reason,
  ReasonCode,
  ReelId,
  SchemaVersion,
} from './common';

// The learner state owned by @reels/agent (docs/PLAN.md "Agent spec", docs/UX.md
// section 9, docs/PERFORMANCE.md 2.5 and 3). Plain JSON, persisted on device as
// one snapshot. Learner records use snake_case like the other schemas; feed
// items use camelCase because they are the agent-to-app contract
// (PERFORMANCE.md section 3, `FeedSlot`).

const Count = z.int().nonnegative();
const Key = z.string().min(1);
const ItemId = z.string().min(1);
const Unit = z.number().min(0).max(1);

/** Map and progress-panel level of a concept (UX.md 5.2). */
export const DisplayLevel = z.enum(['none', 'seen', 'checked', 'learned', 'retained']);
export type DisplayLevel = z.infer<typeof DisplayLevel>;

/** Where an item was served: the feed, a gap session, or a one-card review from the map. */
export const ItemSource = z.enum(['feed', 'gap_session', 'map_review']);
export type ItemSource = z.infer<typeof ItemSource>;

/** What a summary item reports (UX.md 3.7). */
export const SessionSummary = z.object({
  reelsWatched: Count,
  questionsAnswered: Count,
  correct: Count,
  /** Concepts that went from Seen to Checked this session. */
  checkedIds: z.array(ConceptId),
  /** Concepts that became Learned this session. */
  learnedIds: z.array(ConceptId),
  /** Earliest scheduled review after `now`, or null. */
  nextReviewAt: EpochMs.nullable(),
});
export type SessionSummary = z.infer<typeof SessionSummary>;

/** "Item 2 of 6" in a gap session. */
export const GapItemInfo = z.object({ index: z.int().positive(), total: z.int().positive() });
export type GapItemInfo = z.infer<typeof GapItemInfo>;

export const ReelItem = z.object({
  kind: z.literal('reel'),
  /** Stable, unique slot key ("r<ordinal>:<reel_id>"). */
  key: Key,
  conceptId: ConceptId,
  reelId: ReelId,
  angle: Angle,
  /** Reel ordinal in the profile: the player key and the key of every random draw for this slot. */
  ordinal: Count,
  durationMs: z.int().positive(),
  /** null when a slot rule (reteach, echo, gap session, fallback) chose the reel. */
  pool: Pool.nullable(),
  reason: Reason,
  source: ItemSource,
  gap: GapItemInfo.nullable(),
});
export type ReelItem = z.infer<typeof ReelItem>;

export const CardItem = z.object({
  kind: z.literal('card'),
  /** "c<card ordinal>:<item_id>". */
  key: Key,
  conceptId: ConceptId,
  itemId: ItemId,
  /** The reel this retrieval item belongs to. */
  reelId: ReelId,
  ordinal: Count,
  /** Box when planned: 3 options at box 0, 4 from box 1. */
  box: Box,
  /** Authored choice indices in the order to show (3 or 4). */
  options: z.array(Count).min(3).max(4),
  proveIt: z.boolean(),
  /** The re-check after a wrong answer. */
  retry: z.boolean(),
  pool: Pool.nullable(),
  reason: Reason,
  source: ItemSource,
  gap: GapItemInfo.nullable(),
});
export type CardItem = z.infer<typeof CardItem>;

export const SummaryItem = z.object({
  kind: z.literal('summary'),
  /** "s<ordinal>". */
  key: Key,
  conceptId: z.null(),
  pool: z.null(),
  /** A summary is not a content decision, so it has no reason code. */
  reason: z.null(),
  source: ItemSource,
  ordinal: Count,
  trigger: z.enum(['count', 'exhausted', 'gap_end']),
  summary: SessionSummary,
});
export type SummaryItem = z.infer<typeof SummaryItem>;

export const FeedItem = z.discriminatedUnion('kind', [ReelItem, CardItem, SummaryItem]);
export type FeedItem = z.infer<typeof FeedItem>;

/** Moves only from retrieval answers. Missing entry = box 0, never answered. */
export const ConceptMastery = z.object({
  box: Box,
  due_at: EpochMs.nullable(),
  /** When the current interval started (the answer that set `due_at`); used to rescale on a clock switch. */
  scheduled_at: EpochMs.nullable(),
  /** True while `due_at` is a retry after a wrong answer. */
  retry: z.boolean(),
  last_answered_at: EpochMs.nullable(),
  correct_count: Count,
  wrong_count: Count,
  /** Item of this concept's previous answered card (never asked twice in a row). */
  last_item_id: ItemId.nullable(),
});
export type ConceptMastery = z.infer<typeof ConceptMastery>;

/** Moves only from reel ends. Missing entry = never Seen. */
export const ConceptExposure = z.object({
  first_at: EpochMs,
  /** Reels shown in the profile when first exposed: a first check needs one more reel. */
  at_reel: Count,
  /** Reels of this concept that ended without an early skip (the item rule draws from these). */
  finished: z.array(ReelId),
});
export type ConceptExposure = z.infer<typeof ConceptExposure>;

export const WatchSignal = z.enum(['completed', 'rewatch', 'partial', 'early_skip', 'none']);
export type WatchSignal = z.infer<typeof WatchSignal>;

/** One item the learner settled on in this session. */
export const HistoryEntry = z.object({
  key: Key,
  kind: z.enum(['reel', 'card', 'summary']),
  concept_id: ConceptId.nullable(),
  reel_id: ReelId.nullable(),
  item_id: ItemId.nullable(),
  pool: Pool.nullable(),
  code: ReasonCode.nullable(),
  source: ItemSource,
  /** Reel, card or summary ordinal of the item. */
  ordinal: Count,
  /** Settle time. */
  at: EpochMs,
  /** Interest signal of a reel, set when it ends; null while open. */
  signal: WatchSignal.nullable(),
  /** Last quick action on this impression (the last tap wins; null after Undo). */
  action: QuickAction.nullable(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const Session = z.object({
  index: Count,
  started_at: EpochMs,
  last_active_at: EpochMs,
  /** "Not for me" for the rest of the session. */
  hidden: z.array(ConceptId),
  /** No reel twice per session. */
  shown_reels: z.array(ReelId),
  /** Settled items, oldest first (capped). */
  history: z.array(HistoryEntry),
  reels: Count,
  reels_since_card: Count,
  items_since_summary: Count,
  cards_answered: Count,
  cards_correct: Count,
  checked: z.array(ConceptId),
  learned: z.array(ConceptId),
  exhausted_summary: z.boolean(),
  /** Key of the newer early skip that already caused a change of pace. */
  pace_used_key: Key.nullable(),
  /**
   * Wrong feed answers per concept this session. At RULES.missCap the concept
   * rests until the next session (owner decision #8). Optional: older states lack it.
   */
  misses: z.record(ConceptId, Count).optional(),
});
export type Session = z.infer<typeof Session>;

/** A card the learner put off with "Later": back after 2 reels with its original sentence. */
export const Deferral = z.object({
  key: Key,
  concept_id: ConceptId,
  item_id: ItemId,
  code: ReasonCode,
  params: z.record(z.string(), z.string()),
  pool: Pool.nullable(),
  prove_it: z.boolean(),
  at: EpochMs,
  /** Reels shown in the profile when deferred. */
  at_reels: Count,
});
export type Deferral = z.infer<typeof Deferral>;

export const Pending = z.object({
  /** Rule 1: the reel after a wrong answer. */
  reteach: z.object({ concept_id: ConceptId, reel_id: ReelId, replay: z.boolean() }).nullable(),
  /** Rule 2: "Too easy" was tapped on this reel. */
  prove_it: z.object({ concept_id: ConceptId, from_reel_id: ReelId.nullable() }).nullable(),
  /** Rule 5: "More like this" was tapped; survives an intervening card. */
  echo: z.object({ concept_id: ConceptId, key: Key }).nullable(),
  /** "Too easy" makes the next reel of these concepts the pitfall angle. */
  pitfall_next: z.array(ConceptId),
  deferred: z.array(Deferral),
  /** Cards settled but not answered or deferred yet. */
  awaiting: z.array(z.object({ key: Key, concept_id: ConceptId, item_id: ItemId })),
});
export type Pending = z.infer<typeof Pending>;

export const Interest = z.object({
  /** Topic interest; a missing topic is at its onboarding prior. */
  topic: z.record(NodeId, Unit),
  concept_offset: z.record(ConceptId, z.number().min(-1).max(1)),
  /** Topics with a reel completed, rewatched or liked (DEEPEN_INTEREST cause "watched"). */
  engaged_topics: z.array(NodeId),
});
export type Interest = z.infer<typeof Interest>;

export const QueueState = z.object({
  /** The item on screen (the last settled one). */
  active: FeedItem.nullable(),
  /** The next unplayed reel: assigned to a player, replaced only by an explicit action. */
  committed: ReelItem.nullable(),
  /** Keys of the last plan, in order (to tell which planned items a flick passed over). */
  upcoming: z.array(Key),
});
export type QueueState = z.infer<typeof QueueState>;

export const UndoRecord = z.object({
  key: Key,
  action: QuickAction,
  before: z.object({
    interest: Interest,
    hidden: z.array(ConceptId),
    pending: Pending,
    committed: ReelItem.nullable(),
    entry_action: QuickAction.nullable(),
  }),
});
export type UndoRecord = z.infer<typeof UndoRecord>;

/** What the map looked like at the last visit: the replay and "just opened" read it. */
export const MapSnapshot = z.object({
  at: EpochMs,
  levels: z.record(ConceptId, DisplayLevel),
  unlocked: z.array(ConceptId),
});
export type MapSnapshot = z.infer<typeof MapSnapshot>;

export const GapScriptEntry = z.object({
  type: z.enum(['reel', 'card']),
  concept_id: ConceptId,
  /** 1-based step: the unmet ancestors in gap order, then the target. */
  step: z.int().positive(),
  role: z.enum(['learn', 'more', 'check', 'review', 'reteach', 'recheck', 'rewatch']),
});
export type GapScriptEntry = z.infer<typeof GapScriptEntry>;

export const GapEnd = z.enum(['target_checked', 'plan_done', 'wrong_at_cap', 'left']);
export type GapEnd = z.infer<typeof GapEnd>;

export const GapState = z.object({
  target_id: ConceptId,
  kind: z.enum(['gap', 'review', 'rewatch']),
  source: z.enum(['map_dock', 'map_review']),
  started_at: EpochMs,
  /** n = unmet ancestors + 1 when the session started. */
  steps_total: z.int().positive(),
  script: z.array(GapScriptEntry),
  /** Script entries settled so far (the summary is not counted). */
  served: Count,
  ended: GapEnd.nullable(),
  summary_shown: z.boolean(),
  /** Reels shown in the profile when the session started. */
  at_reels: Count,
  /** The feed's queue, restored when the session ends. */
  saved_queue: QueueState,
});
export type GapState = z.infer<typeof GapState>;

/** Everything the agent needs between slots. Plain JSON, persisted on device. */
export const LearnerState = z.object({
  schema_version: SchemaVersion,
  profile_id: z.string().min(1),
  created_at: EpochMs,
  /** Every random draw is a pure function of this seed, an ordinal and a purpose (no RNG state). */
  seed: z.int().nonnegative(),
  /** Name of the sample profile this state was loaded from, or null. */
  sample: z.string().nullable(),
  settings: z.object({
    mode: Mode,
    clock: ClockSetting,
    /** The mode to restore when the demo clock is switched off. */
    mode_before_demo: Mode.nullable(),
  }),
  onboarding: z.object({ topic_ids: z.array(NodeId), skipped: z.boolean() }),
  /** Moves only from behaviour: completion, skips, rewatches, quick actions. */
  interest: Interest,
  /** Moves only from retrieval answers. */
  mastery: z.record(ConceptId, ConceptMastery),
  /** Moves only from reel ends (Seen, first-check eligibility, the item rule). */
  exposure: z.record(ConceptId, ConceptExposure),
  /** Sticky unlocks of non-root concepts, with the prerequisite that completed them. */
  unlocked: z.record(ConceptId, z.object({ at: EpochMs, by: ConceptId })),
  reels: z.record(ReelId, z.object({ shown: Count, last_ordinal: Count, last_at: EpochMs })),
  items: z.record(ItemId, z.object({ shown: Count, answered_at: EpochMs.nullable() })),
  /** Reels shown per topic (Explore). */
  topic_reels: z.record(NodeId, Count),
  /** Profile-wide ordinals; never reused, so slot keys stay unique. */
  counters: z.object({ reels: Count, cards: Count, summaries: Count }),
  session: Session,
  pending: Pending,
  queue: QueueState,
  undo: UndoRecord.nullable(),
  map_seen: MapSnapshot.nullable(),
  gap: GapState.nullable(),
});
export type LearnerState = z.infer<typeof LearnerState>;
