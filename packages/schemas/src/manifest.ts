import * as z from 'zod';
import { Angle, ConceptId, EpochMs, NodeId, ReelId, SchemaVersion } from './common';
import { RetrievalItem } from './reel-spec';

export const WordTiming = z.object({
  word: z.string().min(1),
  start_ms: z.int().nonnegative(),
  end_ms: z.int().nonnegative(),
});
export type WordTiming = z.infer<typeof WordTiming>;

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'expected a hex sha256');

/** One human-approved, rendered reel. */
export const ManifestReel = z.object({
  reel_id: ReelId,
  concept_id: ConceptId,
  angle: Angle,
  difficulty: z.int().min(1).max(3),
  /** Relative to the manifest URL, or absolute. */
  url: z.string().min(1),
  duration_s: z.number().positive().max(60),
  bytes: z.int().positive(),
  sha256: Sha256,
  captions: z.array(WordTiming),
  retrieval_items: z.array(RetrievalItem).min(1),
  /** Plain narration, hook first: the scalable transcript in the app (UX.md 6.2). */
  transcript: z.string().optional(),
  /** On-screen text per segment, as shown in the reel. */
  on_screen_text: z.array(z.string()).optional(),
  /** Code shown in the reel, for the transcript. */
  code: z
    .array(z.object({ language: z.string(), code: z.string(), shows_mistake: z.boolean() }))
    .optional(),
  /** Rendered size, so the player can size the picture before the first frame. */
  video: z
    .object({ width: z.int().positive(), height: z.int().positive(), fps: z.number().positive() })
    .optional(),
});
export type ManifestReel = z.infer<typeof ManifestReel>;

/** The only thing the app reads from the pipeline (plus the graph). */
export const Manifest = z
  .object({
    schema_version: SchemaVersion,
    generated_at: EpochMs,
    domain_id: NodeId,
    /** sha256 of the graph.json this library was built from. */
    graph_sha256: Sha256,
    reels: z.array(ManifestReel),
  })
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>();
    manifest.reels.forEach((reel, i) => {
      if (seen.has(reel.reel_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['reels', i, 'reel_id'],
          message: `duplicate reel "${reel.reel_id}"`,
        });
      }
      seen.add(reel.reel_id);
    });
  });
export type Manifest = z.infer<typeof Manifest>;
