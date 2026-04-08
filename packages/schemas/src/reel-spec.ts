import * as z from 'zod';
import { Angle, ConceptId, ReelId, SchemaVersion, Slug } from './common';

export const CodeLanguage = z.enum(['ts', 'tsx', 'js', 'json', 'python', 'sql', 'yaml', 'bash']);
export type CodeLanguage = z.infer<typeof CodeLanguage>;

/**
 * How the pipeline verifies a code visual: "compiles" must type-check cleanly,
 * "should_error" must fail to type-check (a pitfall shown on purpose), "none"
 * skips the check (shell, config, pseudo-code). Type checks apply to ts/tsx only.
 */
export const CodeCheck = z.enum(['compiles', 'should_error', 'none']);

export const FlowNode = z.object({ id: Slug, label: z.string().min(1).max(18) });
export const FlowEdge = z.object({ from: Slug, to: Slug, label: z.string().max(14).optional() });

/** What fills the screen during a segment. */
export const Visual = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('kinetic_text') }),
  z.object({
    kind: z.literal('code'),
    language: CodeLanguage,
    code: z.string().min(1).max(600),
    /** 1-based lines to emphasise. */
    highlight_lines: z.array(z.int().positive()).default([]),
    check: CodeCheck,
    /** True when the code is deliberately wrong to teach a pitfall (it may still compile). */
    shows_mistake: z.boolean().default(false),
  }),
  z.object({
    /** Boxes and arrows, laid out top to bottom. */
    kind: z.literal('flow'),
    nodes: z.array(FlowNode).min(2).max(6),
    edges: z.array(FlowEdge).min(1).max(8),
  }),
  z.object({ kind: z.literal('image'), prompt: z.string().min(10).max(400) }),
  z.object({ kind: z.literal('equation'), latex: z.string().min(1).max(200) }),
]);
export type Visual = z.infer<typeof Visual>;

export const Segment = z.object({
  narration: z.string().min(1).max(400),
  on_screen_text: z.string().max(60),
  visual: Visual,
});
export type Segment = z.infer<typeof Segment>;

/** One factual claim, tied to a quoted span of a source card so the claims gate can check it. */
export const KeyClaim = z.object({
  id: z.string().regex(/^c\d+$/, 'expected c1, c2, ...'),
  text: z.string().min(1),
  source_id: z.string().min(1),
  quote: z.string().min(1),
});
export type KeyClaim = z.infer<typeof KeyClaim>;

export const Source = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Where it lives, e.g. "content/software-engineering/sources/caching.md". */
  ref: z.string().min(1),
});
export type Source = z.infer<typeof Source>;

export const RetrievalItem = z
  .object({
    id: z.string().min(1),
    type: z.literal('mcq'),
    prompt: z.string().min(1).max(200),
    choices: z.array(z.string().min(1).max(80)).min(3).max(4),
    answer_index: z.int().nonnegative(),
    /** Shown after answering. */
    explanation: z.string().min(1).max(300),
    /** Which key claims this item tests. */
    claim_ids: z.array(z.string()).min(1),
  })
  .superRefine((item, ctx) => {
    if (item.answer_index >= item.choices.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer_index'],
        message: 'answer_index is out of range',
      });
    }
    const normalized = item.choices.map((c) => c.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({ code: 'custom', path: ['choices'], message: 'choices must be distinct' });
    }
  });
export type RetrievalItem = z.infer<typeof RetrievalItem>;

/** What the writer LLM produces. Reviewed as text before any media is made. */
export const ReelSpec = z
  .object({
    schema_version: SchemaVersion,
    reel_id: ReelId,
    concept_id: ConceptId,
    lang: z.literal('en'),
    angle: Angle,
    /** Render template id from the pipeline's template catalogue. */
    template: Slug,
    target_duration_s: z.int().min(10).max(60),
    hook: z.string().min(1).max(120),
    segments: z.array(Segment).min(1).max(8),
    key_claims: z.array(KeyClaim).min(1),
    sources: z.array(Source).min(1),
    difficulty: z.int().min(1).max(3),
    retrieval_items: z.array(RetrievalItem).min(1).max(3),
  })
  .superRefine((spec, ctx) => {
    if (spec.reel_id !== `${spec.concept_id}--${spec.angle}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['reel_id'],
        message: 'reel_id must be <concept_id>--<angle>',
      });
    }
    const sourceIds = new Set(spec.sources.map((s) => s.id));
    spec.key_claims.forEach((claim, i) => {
      if (!sourceIds.has(claim.source_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['key_claims', i, 'source_id'],
          message: `unknown source "${claim.source_id}"`,
        });
      }
    });
    const claimIds = new Set(spec.key_claims.map((c) => c.id));
    if (claimIds.size !== spec.key_claims.length) {
      ctx.addIssue({ code: 'custom', path: ['key_claims'], message: 'claim ids must be unique' });
    }
    spec.retrieval_items.forEach((item, i) => {
      item.claim_ids.forEach((id, j) => {
        if (!claimIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['retrieval_items', i, 'claim_ids', j],
            message: `unknown claim "${id}"`,
          });
        }
      });
    });
  });
export type ReelSpec = z.infer<typeof ReelSpec>;
