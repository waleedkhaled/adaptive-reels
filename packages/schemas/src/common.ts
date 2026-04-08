import * as z from 'zod';

/** Bumped on any breaking change to a schema in this package. */
export const SCHEMA_VERSION = 1;
export const SchemaVersion = z.literal(SCHEMA_VERSION);

/** Lowercase kebab-case slug, e.g. "react-state". Used for graph nodes. */
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected a kebab-case slug');
export type Slug = z.infer<typeof Slug>;

export const NodeId = Slug;
export const ConceptId = Slug;
export type ConceptId = z.infer<typeof ConceptId>;

/** "<concept-id>--<angle>", e.g. "react-state--pitfall". */
export const ReelId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--(?:intro|example|pitfall)$/, 'expected <concept-id>--<angle>');
export type ReelId = z.infer<typeof ReelId>;

/** The three reels made per concept. */
export const Angle = z.enum(['intro', 'example', 'pitfall']);
export type Angle = z.infer<typeof Angle>;

/** Milliseconds since the Unix epoch. */
export const EpochMs = z.int().nonnegative();

/** Leitner box: 0 = never answered correctly, 4 = highest. Learned means box >= 2. */
export const Box = z.int().min(0).max(4);
export type Box = z.infer<typeof Box>;

export const Mode = z.enum(['light', 'focus']);
export type Mode = z.infer<typeof Mode>;

/** "demo" compresses review intervals to minutes. */
export const ClockSetting = z.enum(['real', 'demo']);
export type ClockSetting = z.infer<typeof ClockSetting>;

export const Pool = z.enum(['review', 'deepen', 'explore', 'lateral']);
export type Pool = z.infer<typeof Pool>;

/** "Why this reel" codes. The app turns code + params into text. */
export const ReasonCode = z.enum([
  'REVIEW_DUE',
  'FIRST_CHECK',
  'RETEACH',
  'PROVE_IT',
  'DEEPEN_UNLOCKED',
  'DEEPEN_INTEREST',
  'EXPLORE_NEW',
  'LATERAL_RELATED',
  'LATERAL_BRIDGE',
  'MORE_LIKE_THIS',
  'CHANGE_OF_PACE',
  'GAP_SESSION',
  'FALLBACK',
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

export const Reason = z.object({
  code: ReasonCode,
  params: z.record(z.string(), z.string()).default({}),
});
export type Reason = z.infer<typeof Reason>;

export const QuickAction = z.enum(['more_like_this', 'too_easy', 'not_for_me']);
export type QuickAction = z.infer<typeof QuickAction>;
