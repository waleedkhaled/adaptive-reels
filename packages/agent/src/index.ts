// @reels/agent: the pure, deterministic learning agent (docs/PLAN.md "Agent
// spec" with the amendments of docs/UX.md section 9 and the agent-to-player
// contract of docs/PERFORMANCE.md 2.5). No clock, no Math.random, no React
// Native or Node imports: time (`now`, epoch ms) and the seed are inputs.
// API and usage: packages/agent/README.md.

export {
  buildCatalog,
  railOrder,
  ANGLE_ORDER,
  type Catalog,
  type ConceptInfo,
  type ItemInfo,
  type RailRow,
  type ReelInfo,
  type TopicInfo,
} from './catalog';
export {
  DEFAULT_POOL_WEIGHTS,
  DEMO_SEED,
  INTEREST_DELTAS,
  INTERVALS,
  MODE_CONFIG,
  POOLS,
  PRIORS,
  RULES,
  WATCH,
  type IntervalTable,
  type ModeConfig,
} from './config';
export { AgentError } from './errors';
export {
  createProfile,
  interestOf,
  intervalMs,
  isUnlocked,
  levelOf,
  masteryOf,
  topicInterest,
  type CreateProfileInput,
} from './state';
export {
  classifyWatch,
  type EndedBy,
  type ReelOutcome,
  type WatchClassification,
} from './interest';
export { applyAnswerRule, opensCount, type AnswerRuleOutput } from './mastery';
export { cardOptions, pickItem } from './items';
export {
  computePools,
  decide,
  drawPool,
  makeCtx,
  sessionSummary,
  type Pools,
  type ReelCandidate,
  type ReviewCandidate,
} from './decide';
export {
  answerCard,
  deferCard,
  leaveGapSession,
  next,
  nextDueAt,
  plan,
  quickAction,
  reelEnded,
  refreshItem,
  sessionExpired,
  setClock,
  setMode,
  settle,
  shown,
  startGapSession,
  startSession,
  undoQuickAction,
  type AnswerInput,
  type AnswerResult,
  type AnswerStep,
  type ClockStep,
  type GapStep,
  type LeaveGapStep,
  type PlanTrigger,
  type QuickActionConfirmation,
  type QuickActionInput,
  type QuickActionStep,
  type ReelEndInput,
  type ReelEndResult,
  type SettleOptions,
  type SettleStep,
  type Step,
} from './queue';
export { gapPlan, type GapPlan, type GapStepPlan, type GapStepState } from './gap';
export {
  displayState,
  mapChanges,
  mapCounts,
  markMapSeen,
  suggestions,
  type DisplayState,
  type MapChanges,
  type MapCounts,
  type Suggestion,
  type TopicCounts,
} from './map';
export { orderedUnmetAncestors, unmetAncestors } from './walk';
export { keyedRandom, keyedShuffle } from './random';
export { sampleProfile, SAMPLE_PROFILES, type SampleProfileName } from './sample';
export * as copy from './copy';
export type {
  CardItem,
  FeedItem,
  LearnerState,
  ReelItem,
  SessionSummary,
  SummaryItem,
} from '@reels/schemas';
