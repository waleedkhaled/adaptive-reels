import * as z from 'zod';
import {
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
} from './common';

/** Fields on every logged event. */
const base = {
  id: z.string().min(1),
  session_id: z.string().min(1),
  at: EpochMs,
};

const Ms = z.number().nonnegative();
const Level = z.enum(['none', 'seen', 'checked', 'learned', 'retained']);

// The event log answers the demo's two questions (do testers keep swiping, do
// they get delayed reviews right) plus the UX and performance questions in
// docs/UX.md section 8 and docs/PERFORMANCE.md section 9.
export const LearnerEvent = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('session_start'),
    app_version: z.string(),
    mode: Mode,
    clock: ClockSetting,
    seed: z.int().optional(),
    sample_data: z.boolean().optional(),
    font_scale: z.number().optional(),
    reduce_motion: z.boolean().optional(),
    screen_reader: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('onboarding_done'),
    /** May be empty: "Skip" is a valid answer. */
    topic_ids: z.array(NodeId),
    skipped: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('reel_impression'),
    reel_id: ReelId,
    concept_id: ConceptId,
    slot: z.int().nonnegative(),
    /** null when a rule (reteach, echo, gap session...) chose the item instead of the pool draw. */
    pool: Pool.nullable(),
    reason: Reason,
    /** True when the learner swiped back to a reel already shown. */
    revisit: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('reel_end'),
    reel_id: ReelId,
    concept_id: ConceptId,
    watched_ms: z.int().nonnegative(),
    duration_ms: z.int().positive(),
    loops: z.int().nonnegative(),
    outcome: z.enum(['completed', 'partial', 'early_skip']),
    sound_on: z.boolean().optional(),
    paused_ms: z.int().nonnegative().optional(),
    /** skip_failed and blur change no interest. */
    ended_by: z.enum(['swipe', 'skip_failed', 'blur']).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('quick_action'),
    reel_id: ReelId,
    concept_id: ConceptId,
    action: QuickAction,
  }),
  z.object({
    ...base,
    type: z.literal('quick_action_undone'),
    reel_id: ReelId,
    concept_id: ConceptId,
    action: QuickAction,
  }),
  z.object({
    ...base,
    type: z.literal('card_shown'),
    item_id: z.string().min(1),
    concept_id: ConceptId,
    slot: z.int().nonnegative(),
    reason: Reason,
  }),
  z.object({
    ...base,
    type: z.literal('card_deferred'),
    item_id: z.string().min(1),
    concept_id: ConceptId,
    slot: z.int().nonnegative(),
  }),
  z.object({
    ...base,
    type: z.literal('card_answered'),
    item_id: z.string().min(1),
    concept_id: ConceptId,
    /** Index into options_order when present, else into the authored choices. */
    choice_index: z.int().nonnegative(),
    correct: z.boolean(),
    latency_ms: z.int().nonnegative(),
    box_before: Box,
    box_after: Box,
    /** Interval the scheduler set for this review; null on a first check. */
    scheduled_gap_ms: z.int().nonnegative().nullable(),
    /** Time since the previous answer on this concept; null on a first check. */
    actual_gap_ms: z.int().nonnegative().nullable(),
    /** True when this answer was a delayed review, not a first check. */
    is_delayed: z.boolean(),
    /** Authored choice indices in the order shown (3 or 4). */
    options_order: z.array(z.int().nonnegative()).optional(),
    selection_changes: z.int().nonnegative().optional(),
    source: z.enum(['feed', 'gap_session', 'map_review']).optional(),
    prove_it: z.boolean().optional(),
    retry: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('reason_opened'),
    item_id: z.string().min(1),
    code: ReasonCode,
  }),
  z.object({
    ...base,
    type: z.literal('concept_panel_opened'),
    reel_id: ReelId,
    transcript_scrolled: z.boolean(),
  }),
  z.object({ ...base, type: z.literal('mode_changed'), from: Mode, to: Mode }),
  z.object({
    ...base,
    type: z.literal('clock_changed'),
    from: ClockSetting,
    to: ClockSetting,
    rescaled_concept_ids: z.array(ConceptId).optional(),
  }),
  z.object({ ...base, type: z.literal('sound_changed'), muted: z.boolean() }),
  z.object({
    ...base,
    type: z.literal('setting_changed'),
    key: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    ...base,
    type: z.literal('map_opened'),
    /** map_review: back on the map after a one-card review started from it. */
    source: z.enum(['tab', 'progress_panel', 'summary', 'map_review']),
    replayed: z.boolean(),
    staged_topic_id: NodeId,
    changed_concept_ids: z.array(ConceptId),
  }),
  z.object({
    ...base,
    type: z.literal('map_topic_selected'),
    topic_id: NodeId,
    via: z.enum(['row', 'header_button', 'auto']),
  }),
  z.object({
    ...base,
    type: z.literal('map_cell_tapped'),
    concept_id: ConceptId,
    level: Level,
    due: z.boolean(),
    locked: z.boolean(),
    source: z.enum(['matrix', 'rail', 'dock']),
  }),
  z.object({
    ...base,
    type: z.literal('gap_session_started'),
    target_concept_id: ConceptId,
    planned_concept_ids: z.array(ConceptId).min(1),
    source: z.enum(['map_dock', 'map_review']).optional(),
    kind: z.enum(['gap', 'review', 'rewatch']).optional(),
    planned_items: z.int().nonnegative().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('gap_session_ended'),
    target_concept_id: ConceptId,
    items_served: z.int().nonnegative(),
    reason: z.enum(['target_checked', 'plan_done', 'wrong_at_cap', 'left']),
  }),
  z.object({
    ...base,
    type: z.literal('summary_shown'),
    items: z.int().nonnegative(),
    cards_answered: z.int().nonnegative(),
    learned_ids: z.array(ConceptId),
  }),
  z.object({
    ...base,
    type: z.literal('summary_action'),
    action: z.enum(['keep_going', 'open_map', 'left']),
  }),
  z.object({
    ...base,
    type: z.literal('reel_load_failed'),
    reel_id: ReelId,
    cause: z.enum(['offline', 'timeout', 'player_error']),
    retried: z.boolean(),
  }),
  z.object({ ...base, type: z.literal('profile_reset') }),
  z.object({ ...base, type: z.literal('sample_profile_loaded'), profile: z.string().min(1) }),
  z.object({ ...base, type: z.literal('log_exported'), events: z.int().nonnegative() }),
  // Performance events (docs/PERFORMANCE.md section 9).
  z.object({
    ...base,
    type: z.literal('reel_first_frame'),
    reel_id: ReelId,
    playing_ms: Ms.nullable(),
    first_frame_ms: Ms.nullable(),
    cover_lifted_ms: Ms.nullable(),
    ready_at_activation: z.boolean(),
    source: z.enum(['file', 'network', 'cache']),
    hz: z.number().nullable(),
  }),
  z.object({
    ...base,
    type: z.literal('swipe_frames'),
    n: z.int().nonnegative(),
    over_budget: z.int().nonnegative(),
    max_ms: Ms,
    hz: z.number().nullable(),
  }),
  z.object({
    ...base,
    type: z.literal('agent_next'),
    ms: Ms,
    calls: z.int().nonnegative(),
    trigger: z.string(),
  }),
  z.object({ ...base, type: z.literal('replan_ready'), ms: Ms, source: z.string() }),
  z.object({
    ...base,
    type: z.literal('player_watchdog'),
    slot: z.int().nonnegative(),
    reel_id: ReelId.nullable(),
    action: z.string(),
  }),
]);
export type LearnerEvent = z.infer<typeof LearnerEvent>;
export type LearnerEventType = LearnerEvent['type'];
