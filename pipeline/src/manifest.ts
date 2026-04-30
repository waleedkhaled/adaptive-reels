// Stage 6a: the manifests the app reads.
// - manifest.json: reels that passed the gates, rendered with the current
//   templates, passed the encode gate, and that you approved for that exact video.
// - manifest.all.json: the same without the approval (development only).
import fs from 'node:fs';
import { Manifest, SCHEMA_VERSION, type ManifestReel, type ReelSpec } from '@reels/schemas';
import { PATHS } from './config';
import type { Content, Job } from './content';
import { currentDecision, type Decisions } from './decisions';
import { displayCode } from './render/syntax';
import { replaceEmDashes } from './render/text';
import {
  gatePassed,
  readRecord,
  type GateRecord,
  type RenderRecord,
  type TextRecord,
} from './store';

/** Plain narration, hook first, one paragraph per part, as the captions show it. */
export function transcriptOf(spec: ReelSpec): string {
  return [spec.hook, ...spec.segments.map((s) => s.narration)].map(replaceEmDashes).join('\n\n');
}

/** On-screen text per segment, as shown in the reel. */
export function onScreenTextOf(spec: ReelSpec): string[] {
  return spec.segments.map((s) => replaceEmDashes(s.on_screen_text));
}

/** Code shown in the reel, for the transcript. */
export function codeOf(spec: ReelSpec): NonNullable<ManifestReel['code']> {
  return spec.segments.flatMap((s) => {
    const v = s.visual;
    if (v.kind !== 'code') return [];
    return [
      {
        language: v.language,
        code: replaceEmDashes(displayCode(v.code)),
        shows_mistake: v.check === 'should_error' || v.shows_mistake === true,
      },
    ];
  });
}

export function manifestReel(job: Job, spec: ReelSpec, render: RenderRecord): ManifestReel {
  return {
    reel_id: job.reelId,
    concept_id: job.concept.node.id,
    angle: job.angle,
    difficulty: spec.difficulty,
    url: render.file,
    duration_s: render.duration_s,
    bytes: render.bytes,
    sha256: render.sha256,
    captions: render.captions,
    retrieval_items: spec.retrieval_items,
    transcript: transcriptOf(spec),
    on_screen_text: onScreenTextOf(spec),
    code: codeOf(spec),
    ...(render.video ? { video: render.video } : {}),
  };
}

/** Reels that passed the text gates, rendered with the current templates and passed the encode gate. */
export function shippableReels(jobs: Job[]): { job: Job; spec: ReelSpec; render: RenderRecord }[] {
  return jobs.flatMap((job) => {
    const text = readRecord<TextRecord>(job.reelId, 'text');
    const render = readRecord<RenderRecord>(job.reelId, 'render');
    const gate = readRecord<GateRecord>(job.reelId, 'gate');
    if (text?.status !== 'passed' || !text.spec || !gatePassed(render, gate)) return [];
    return [{ job, spec: text.spec, render: render! }];
  });
}

export function buildManifest(
  content: Content,
  jobs: Job[],
  decisions: Decisions,
  opts: { approvedOnly: boolean } = { approvedOnly: true },
): Manifest {
  const reels = shippableReels(jobs)
    .filter(
      ({ job, render }) =>
        !opts.approvedOnly ||
        currentDecision(decisions, job.reelId, render.sha256)?.decision === 'approved',
    )
    .map(({ job, spec, render }) => manifestReel(job, spec, render));
  return Manifest.parse({
    schema_version: SCHEMA_VERSION,
    generated_at: Date.now(),
    domain_id: content.domainId,
    graph_sha256: content.graphSha256,
    reels,
  });
}

export function writeManifest(manifest: Manifest, file: string = PATHS.manifest): void {
  fs.mkdirSync(PATHS.library, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
}

/** Writes manifest.json (approved only) and manifest.all.json (every shippable reel). */
export function writeManifests(
  content: Content,
  jobs: Job[],
  decisions: Decisions,
): { approved: number; all: number } {
  const approved = buildManifest(content, jobs, decisions, { approvedOnly: true });
  const all = buildManifest(content, jobs, decisions, { approvedOnly: false });
  writeManifest(approved, PATHS.manifest);
  writeManifest(all, PATHS.manifestAll);
  return { approved: approved.reels.length, all: all.reels.length };
}
