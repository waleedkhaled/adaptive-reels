// Stage 5: render each reel with Remotion (PERFORMANCE.md 6.1), from the
// records already in library/reels/<id>/ (no network, no paid API).
// 1. prepare: reformat snippets that would need code under 26 px, build the
//    props, run the glyph audit;
// 2. layout: the dry layout pass in the render browser (Root.tsx);
// 3. render: PNG frames at scale 1.5, H.264 CRF 20, BT.709 limited range, then
//    ffmpeg re-encodes the audio (mono, loudness-normalised, 64k AAC at 48 kHz,
//    faststart, video copied) and the file is named by its content hash.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import {
  openBrowser,
  renderMedia,
  selectComposition,
  type HeadlessBrowser,
} from '@remotion/renderer';
import { PATHS, VIDEO } from '../config';
import type { Job } from '../content';
import {
  libraryRel,
  reelDir,
  RENDER_VERSION,
  writeRecord,
  type ImagesRecord,
  type RenderLayoutSummary,
  type RenderRecord,
  type TextRecord,
  type TimingRecord,
} from '../store';
import { leadInFrames, outputSize } from '../video';
import { audioPassArgs, hashedName, REMOTION_ENCODE } from './encode';
import { fontCoverage } from './fontdata';
import type { ReelLayout } from './layout';
import { STACK } from './layout';
import { probeFile } from './probe';
import { absoluteCaptions, buildReelProps, type ReelProps } from './props';
import { prepareSnippets, type SnippetOutcome } from './reformat';
import { auditGlyphs, type Coverage, type VisibleText } from './text';

const ENTRY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'remotion/index.ts');

/** A reel that cannot be laid out or fails the glyph audit: listed, never rendered. */
export class LayoutError extends Error {
  constructor(
    readonly reelId: string,
    readonly problems: string[],
  ) {
    super(`${problems.length} layout problem(s): ${problems.join(' | ')}`);
  }
}

export interface Prepared {
  job: Job;
  props: ReelProps;
  snippets: SnippetOutcome[];
}

export interface LaidOut extends Prepared {
  composition: Awaited<ReturnType<typeof selectComposition>>;
  layout: ReelLayout;
}

/** Every visible string of a reel with the font stack it is set in (DESIGN.md "Glyphs"). */
export function visibleTexts(props: ReelProps): VisibleText[] {
  const items: VisibleText[] = [];
  let segment = 0;
  for (const part of props.parts) {
    if (part.kind === 'hook') {
      items.push({
        where: 'hook',
        text: part.words.map((w) => w.text).join(' '),
        stack: STACK.display700,
      });
      continue;
    }
    segment++;
    const where = `segment ${segment}`;
    items.push({ where: `${where} on-screen text`, text: part.onScreen, stack: STACK.display700 });
    items.push({
      where: `${where} captions`,
      text: part.words.map((w) => w.text).join(' '),
      stack: STACK.display600,
    });
    const v = part.visual;
    if (v?.kind === 'code') items.push({ where: `${where} code`, text: v.code, stack: STACK.code });
    if (v?.kind === 'flow') {
      for (const n of v.nodes)
        items.push({ where: `${where} flow box`, text: n.label, stack: STACK.display600 });
      for (const e of v.edges)
        if (e.label)
          items.push({ where: `${where} flow arrow`, text: e.label, stack: STACK.edgeLabel });
    }
  }
  return items;
}

/** Node-side preparation: snippets, props and the glyph audit. Writes text.json on reformat. */
export async function prepareReel(
  job: Job,
  text: TextRecord,
  timing: TimingRecord,
  images: ImagesRecord | null,
  coverage: Coverage,
): Promise<Prepared> {
  let spec = text.spec!;
  const prepared = await prepareSnippets(spec);
  const reformatted = prepared.spec;
  // A snippet reformatted on an earlier run now fits; keep saying how it got there.
  const outcomes = prepared.outcomes.map((o) =>
    o.status === 'fits' && text.reformats?.some((r) => r.segment === o.segment)
      ? { ...o, status: 'reformatted' as const }
      : o,
  );
  if (reformatted) {
    const at = new Date().toISOString();
    // Only this run's reformats (the derived ones above are already logged).
    const reformats = prepared.outcomes
      .filter((o) => o.status === 'reformatted')
      .map((o) => {
        const v = reformatted.segments[o.segment]!.visual as {
          code: string;
          highlight_lines: number[];
        };
        return {
          segment: o.segment,
          before: o.before!,
          after: { code: v.code, highlight_lines: v.highlight_lines },
          at,
        };
      });
    writeRecord(job.reelId, 'text', {
      ...text,
      spec: reformatted,
      reformats: [...(text.reformats ?? []), ...reformats],
    } satisfies TextRecord);
    spec = reformatted;
  }
  const props = buildReelProps({
    reelId: spec.reel_id,
    title: job.concept.node.title,
    topic: job.concept.topic.title,
    angle: spec.angle,
    template: spec.template,
    hook: spec.hook,
    segments: spec.segments,
    timing: timing.parts,
    images: images?.images ?? {},
    fps: VIDEO.fps,
    gapMs: VIDEO.gapMs,
    leadInFrames: leadInFrames(),
    codeFloors: Object.fromEntries(outcomes.map((o) => [o.segment, o.floor])),
  });
  const problems = auditGlyphs(visibleTexts(props), coverage);
  for (const o of outcomes)
    if (o.size === null)
      problems.push(`segment ${o.segment + 1} code overflows even at ${o.floor} px (${o.reason})`);
  const durationS = props.totalFrames / VIDEO.fps;
  if (durationS > VIDEO.maxDurationS)
    problems.push(`would run ${durationS.toFixed(1)} s, over the ${VIDEO.maxDurationS} s cap`);
  if (problems.length) throw new LayoutError(job.reelId, problems);
  return { job, props, snippets: outcomes };
}

function layoutSummary(layout: ReelLayout, snippets: SnippetOutcome[]): RenderLayoutSummary {
  const hook = layout.parts.find((p) => p.kind === 'hook');
  let index = -1;
  return {
    hook_px: hook?.kind === 'hook' ? hook.size : 0,
    segments: layout.parts.flatMap((p) => {
      if (p.kind !== 'segment') return [];
      index++;
      const snippet = snippets.find((s) => s.segment === index);
      return [
        {
          visual: p.code
            ? 'code'
            : p.flow
              ? 'flow'
              : p.equation
                ? 'equation'
                : p.image
                  ? 'image'
                  : 'kinetic_text',
          on_screen_px: p.onScreen?.size ?? null,
          kinetic_px: p.kinetic?.size ?? null,
          code_px: p.code?.size ?? null,
          code_status: snippet?.status ?? null,
          flow_label_px: p.flow?.labelSize ?? null,
          equation_px: p.equation?.size ?? null,
        },
      ];
    }),
  };
}

const sha256File = (file: string) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export interface Renderer {
  coverage: Coverage;
  layout(prepared: Prepared): Promise<LaidOut>;
  render(laid: LaidOut, onProgress?: (progress: number) => void): Promise<RenderRecord>;
  close(): Promise<void>;
}

/** Bundles the templates once and keeps one browser open for the layout pass and every render. */
export async function openRenderer(opts: { concurrency?: number | null } = {}): Promise<Renderer> {
  // library/ is the public dir so staticFile() resolves audio and images; it is
  // symlinked, not copied, into the throwaway bundle.
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: PATHS.library,
    symlinkPublicDir: true,
  });
  const browser: HeadlessBrowser = await openBrowser('chrome', { logLevel: 'error' });
  const coverage = fontCoverage();

  return {
    coverage,
    async layout(prepared) {
      const composition = await selectComposition({
        serveUrl,
        id: 'Reel',
        inputProps: prepared.props,
        puppeteerInstance: browser,
        logLevel: 'error',
      });
      const layout = (composition.props as ReelProps).layout;
      if (!layout) throw new LayoutError(prepared.job.reelId, ['the layout pass returned nothing']);
      if (layout.problems.length) throw new LayoutError(prepared.job.reelId, layout.problems);
      return { ...prepared, composition, layout };
    },
    async render(laid, onProgress) {
      const started = Date.now();
      const id = laid.job.reelId;
      const dir = reelDir(id);
      const raw = path.join(dir, '.render.raw.mp4');
      const encoded = path.join(dir, '.render.out.mp4');
      await renderMedia({
        serveUrl,
        composition: laid.composition,
        inputProps: laid.props,
        puppeteerInstance: browser,
        ...REMOTION_ENCODE,
        concurrency: opts.concurrency ?? null,
        outputLocation: raw,
        overwrite: true,
        logLevel: 'error',
        onProgress: onProgress && (({ progress }) => onProgress(progress)),
      });
      execFileSync('ffmpeg', audioPassArgs(raw, encoded));
      fs.rmSync(raw);

      const sha256 = sha256File(encoded);
      const final = path.join(dir, hashedName(id, sha256));
      fs.renameSync(encoded, final);
      const probe = probeFile(final);
      const { width, height } = outputSize();
      const record: RenderRecord = {
        reel_id: id,
        file: libraryRel(final),
        duration_s: probe.duration_s,
        bytes: probe.bytes,
        sha256,
        captions: absoluteCaptions(laid.props),
        at: new Date().toISOString(),
        version: RENDER_VERSION,
        video: { width, height, fps: VIDEO.fps },
        lead_in_ms: Math.round((laid.props.leadInFrames / VIDEO.fps) * 1000),
        probe,
        layout: layoutSummary(laid.layout, laid.snippets),
        render_s: Math.round((Date.now() - started) / 100) / 10,
      };
      writeRecord(id, 'render', record);
      // Only now that the new render exists: drop older videos of this reel.
      for (const name of fs.readdirSync(dir))
        if (name.endsWith('.mp4') && name !== path.basename(final)) fs.rmSync(path.join(dir, name));
      return record;
    },
    async close() {
      await browser.close({ silent: true });
    },
  };
}
