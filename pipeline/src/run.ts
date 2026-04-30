// Runs the stages in order over the selected reels. Each stage skips reels it
// already finished (unless force), so a rerun only pays for what is missing.
// layout, render, gate and report are offline: they read the records already
// in library/reels/<id>/, need no API key and may not reach the network.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, REPO_ROOT, useLibrary } from './config';
import { jobsFor, loadContent, type Job } from './content';
import { readDecisions } from './decisions';
import { gatePromptVersions, runGates } from './gates';
import { BudgetExceededError, CostLedger } from './ledger';
import { writeManifests } from './manifest';
import { illustrate, narrate } from './media';
import { guardNetwork } from './network';
import { deepInfraProviders } from './providers/deepinfra';
import { blockNetwork, fakeProviders } from './providers/fake';
import type { Providers } from './providers/types';
import type { LaidOut } from './render/render';
import { writeReport } from './report';
import { LLMReviewer, type Reviewer } from './reviewer';
import {
  isCurrentRender,
  readRecord,
  writeRecord,
  type GateRecord,
  type ImagesRecord,
  type LayoutRecord,
  type Provenance,
  type RenderRecord,
  type TextRecord,
  type TimingRecord,
} from './store';
import { WRITER_PROMPT_VERSION, writeSpec } from './writer';

export const STAGES = [
  'generate',
  'review',
  'tts',
  'images',
  'layout',
  'render',
  'gate',
  'report',
] as const;
export type Stage = (typeof STAGES)[number];
/** Stages that call a paid provider; every other stage runs offline. */
export const PAID_STAGES: readonly Stage[] = ['generate', 'review', 'tts', 'images'];

export interface RunOptions {
  stages: Stage[];
  dryRun: boolean;
  limit?: number;
  only?: string[];
  budgetUsd: number;
  force: boolean;
  /** Reels processed in parallel (default 4). Rendering always runs one reel at a time. */
  concurrency?: number;
  /** Frames Remotion renders in parallel for one reel (default: Remotion's own). */
  renderConcurrency?: number;
  /** Overrides the library directory (tests use a temp dir). */
  libraryDir?: string;
  log?: (line: string) => void;
}

export interface RunSummary {
  runId: string;
  jobs: Job[];
  spentUsd: number;
  estimatedUsd: number;
  stoppedByBudget: string | null;
  reportPath: string | null;
  /** Reels that failed a stage for a reason other than the budget. */
  failures: string[];
  /** Reels that failed the dry layout pass or the glyph audit, never rendered. */
  layoutFailures: { reelId: string; problems: string[] }[];
  rendered: string[];
  gateFailures: { reelId: string; checks: string[] }[];
  manifest: { approved: number; all: number } | null;
}

const MAX_REWRITES = 1;

async function textStage(
  job: Job,
  providers: Providers,
  reviewer: Reviewer,
  ledger: CostLedger,
  provenance: Provenance,
  log: (l: string) => void,
) {
  const record: TextRecord = {
    reel_id: job.reelId,
    status: 'invalid',
    spec: null,
    gates: [],
    earlier_drafts: [],
    writer_calls: 0,
    problems: [],
    at: new Date().toISOString(),
    provenance,
  };
  let feedback: { previous: unknown; issues: string[] } | undefined;
  for (let draft = 0; draft <= MAX_REWRITES; draft++) {
    const written = await writeSpec(providers.writer, ledger, job, feedback);
    record.writer_calls += written.calls;
    if (!written.spec) {
      record.problems = written.problems;
      break;
    }
    if (record.spec) record.earlier_drafts.push({ spec: record.spec, gates: record.gates });
    record.spec = written.spec;
    record.gates = await runGates(written.spec, job, reviewer);
    const failed = record.gates.filter((g) => !g.pass);
    record.status = failed.length ? 'rejected' : 'passed';
    record.problems = failed.flatMap((g) => g.issues);
    if (!failed.length) break;
    feedback = { previous: written.spec, issues: record.problems };
    if (draft < MAX_REWRITES)
      log(`  ${job.reelId}: ${failed.map((g) => g.gate).join(', ')} failed, rewriting once`);
  }
  writeRecord(job.reelId, 'text', record);
  log(
    `  ${job.reelId}: ${record.status}${record.problems.length ? ` (${record.problems.length} issue(s))` : ''}`,
  );
}

const mb = (bytes: number) => (bytes / 1e6).toFixed(2);

export async function run(opts: RunOptions): Promise<RunSummary> {
  const log = opts.log ?? ((l: string) => process.stdout.write(`${l}\n`));
  if (opts.libraryDir) useLibrary(opts.libraryDir);
  else if (opts.dryRun) useLibrary(path.join(REPO_ROOT, 'library/dry-run'));
  fs.mkdirSync(PATHS.reels, { recursive: true });

  const content = loadContent();
  const jobs = jobsFor(content, { only: opts.only, limit: opts.limit });
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const want = (s: Stage) => opts.stages.includes(s);
  const paid = opts.stages.some((s) => PAID_STAGES.includes(s));

  let providers: Providers | null = null;
  let restoreNetwork = () => {};
  if (opts.dryRun) {
    providers = fakeProviders(content);
    restoreNetwork = blockNetwork();
  } else if (paid) {
    const key = process.env.DEEPINFRA_API_KEY;
    if (!key)
      throw new Error('DEEPINFRA_API_KEY is not set. Copy .env.example to .env and fill it in.');
    providers = deepInfraProviders(key);
  } else {
    restoreNetwork = guardNetwork('offline stages read existing records only');
  }
  const ledger = new CostLedger(opts.budgetUsd, runId, opts.dryRun, (entry) =>
    fs.appendFileSync(PATHS.ledger, `${JSON.stringify(entry)}\n`),
  );
  const gateVersions = await gatePromptVersions();
  const reviewer = providers ? new LLMReviewer(providers.reviewer, ledger, gateVersions) : null;
  const provenance: Provenance | null = providers && {
    writer: { model: providers.writer.model, prompt_version: WRITER_PROMPT_VERSION },
    reviewer: { model: providers.reviewer.model, prompt_versions: gateVersions },
  };
  const passed = () =>
    jobs.filter((j) => readRecord<TextRecord>(j.reelId, 'text')?.status === 'passed');
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  log(
    `${opts.dryRun ? 'DRY RUN (no network, fake providers) · ' : paid ? '' : 'OFFLINE (no API calls) · '}${jobs.length} reel(s) · ${paid ? `budget $${opts.budgetUsd.toFixed(2)} · ${concurrency} at a time · ` : ''}library ${path.relative(REPO_ROOT, PATHS.library)}/`,
  );
  const failures: string[] = [];
  const layoutFailures: RunSummary['layoutFailures'] = [];
  const rendered: string[] = [];
  const gateFailures: RunSummary['gateFailures'] = [];
  const firstLine = (error: unknown) => (error as Error).message.split('\n')[0];
  /** One reel failing (after provider retries) must not stop the other reels. */
  const isolated = (stage: string, fn: (job: Job) => Promise<void>) => async (job: Job) => {
    try {
      await fn(job);
    } catch (error) {
      if (error instanceof BudgetExceededError) throw error;
      const message = `${job.reelId} ${stage}: ${firstLine(error)}`;
      failures.push(message);
      log(`  ERROR ${message}`);
    }
  };

  let stoppedByBudget: string | null = null;
  try {
    if (want('generate')) {
      log('generate + review gates');
      const todo = jobs.filter((j) => opts.force || !readRecord(j.reelId, 'text'));
      await forEachPool(
        todo,
        concurrency,
        isolated('generate', (job) =>
          textStage(job, providers!, reviewer!, ledger, provenance!, log),
        ),
      );
    }
    if (want('review')) {
      log('review gates (existing specs, no rewrite)');
      await forEachPool(
        jobs.filter((j) => readRecord<TextRecord>(j.reelId, 'text')?.spec),
        concurrency,
        isolated('review', async (job) => {
          const text = readRecord<TextRecord>(job.reelId, 'text')!;
          text.gates = await runGates(text.spec!, job, reviewer!);
          const failed = text.gates.filter((g) => !g.pass);
          text.status = failed.length ? 'rejected' : 'passed';
          text.problems = failed.flatMap((g) => g.issues);
          // The spec keeps its writer; only the review is new.
          if (text.provenance) text.provenance.reviewer = provenance!.reviewer;
          writeRecord(job.reelId, 'text', text);
          log(`  ${job.reelId}: ${text.status}`);
        }),
      );
    }
    if (want('tts')) {
      log('tts');
      const todo = passed().filter((j) => opts.force || !readRecord(j.reelId, 'timing'));
      await forEachPool(
        todo,
        concurrency,
        isolated('tts', async (job) => {
          const timing = await narrate(
            readRecord<TextRecord>(job.reelId, 'text')!.spec!,
            providers!.tts,
            ledger,
          );
          writeRecord(job.reelId, 'timing', timing);
          log(
            `  ${job.reelId}: ${timing.parts.length} parts, ${(timing.parts.reduce((s, p) => s + p.duration_ms, 0) / 1000).toFixed(1)} s of speech`,
          );
        }),
      );
    }
    if (want('images')) {
      log('images');
      const todo = passed().filter((j) => opts.force || !readRecord(j.reelId, 'images'));
      await forEachPool(
        todo,
        concurrency,
        isolated('images', async (job) => {
          const images = await illustrate(
            readRecord<TextRecord>(job.reelId, 'text')!.spec!,
            providers!.images,
            ledger,
          );
          writeRecord(job.reelId, 'images', images);
          log(`  ${job.reelId}: ${Object.keys(images.images).length} image(s)`);
        }),
      );
    }
    if (want('layout') || want('render')) {
      // A layout-only run checks every selected reel; a render skips reels
      // already rendered with the current templates unless forced.
      const todo = passed().filter(
        (j) =>
          readRecord(j.reelId, 'timing') &&
          (opts.force ||
            !want('render') ||
            !isCurrentRender(readRecord<RenderRecord>(j.reelId, 'render'))),
      );
      if (todo.length) {
        // Imported lazily: Remotion is heavy and only these stages need it.
        const { LayoutError, openRenderer, prepareReel } = await import('./render/render');
        log(`layout pass: ${todo.length} reel(s), real fonts in the render browser`);
        const renderer = await openRenderer({ concurrency: opts.renderConcurrency ?? null });
        try {
          const ready: LaidOut[] = [];
          for (const job of todo) {
            try {
              const prepared = await prepareReel(
                job,
                readRecord<TextRecord>(job.reelId, 'text')!,
                readRecord<TimingRecord>(job.reelId, 'timing')!,
                readRecord<ImagesRecord>(job.reelId, 'images'),
                renderer.coverage,
              );
              const laid = await renderer.layout(prepared);
              ready.push(laid);
              writeRecord(job.reelId, 'layout', {
                reel_id: job.reelId,
                pass: true,
                problems: [],
                snippets: laid.snippets,
                at: new Date().toISOString(),
              } satisfies LayoutRecord);
              const notes = laid.snippets
                .filter((s) => s.status !== 'fits')
                .map((s) => `segment ${s.segment + 1} code ${s.status} at ${s.size} px`);
              log(`  ${job.reelId}: ok${notes.length ? ` (${notes.join('; ')})` : ''}`);
            } catch (error) {
              const problems =
                error instanceof LayoutError ? error.problems : [`error: ${firstLine(error)}`];
              layoutFailures.push({ reelId: job.reelId, problems });
              failures.push(`${job.reelId} layout: ${problems.join(' | ')}`);
              writeRecord(job.reelId, 'layout', {
                reel_id: job.reelId,
                pass: false,
                problems,
                snippets: [],
                at: new Date().toISOString(),
              } satisfies LayoutRecord);
              log(`  FAIL ${job.reelId}: ${problems.join(' | ')}`);
            }
          }
          log(`layout pass: ${ready.length} ok, ${todo.length - ready.length} failed`);
          if (want('render') && ready.length) {
            log(`render: ${ready.length} reel(s), one at a time`);
            const started = Date.now();
            for (const [n, laid] of ready.entries()) {
              const id = laid.job.reelId;
              try {
                const record = await renderer.render(laid);
                rendered.push(id);
                const l = record.probe?.loudness;
                log(
                  `  [${n + 1}/${ready.length}] ${id}: ${record.duration_s.toFixed(1)} s, ${mb(record.bytes)} MB, ${record.probe?.kbps} kb/s, ${l?.integrated_lufs} LUFS, ${l?.true_peak_dbtp} dBTP, rendered in ${record.render_s} s`,
                );
              } catch (error) {
                failures.push(`${id} render: ${firstLine(error)}`);
                log(`  ERROR ${id} render: ${firstLine(error)}`);
              }
            }
            log(
              `render: ${rendered.length} done in ${((Date.now() - started) / 60000).toFixed(1)} min`,
            );
          }
        } finally {
          await renderer.close();
        }
      }
    }
    if (want('gate')) {
      const todo = jobs.filter((j) => {
        const render = readRecord<RenderRecord>(j.reelId, 'render');
        if (!isCurrentRender(render)) return false;
        const gate = readRecord<GateRecord>(j.reelId, 'gate');
        return opts.force || rendered.includes(j.reelId) || gate?.sha256 !== render.sha256;
      });
      if (todo.length) {
        log(`encode gate: ${todo.length} reel(s)`);
        const { runEncodeGate } = await import('./encode-gate');
        for (const job of todo) {
          try {
            const gate = runEncodeGate(readRecord<RenderRecord>(job.reelId, 'render')!);
            writeRecord(job.reelId, 'gate', gate);
            const failed = gate.checks.filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`);
            if (failed.length) {
              gateFailures.push({ reelId: job.reelId, checks: failed });
              failures.push(`${job.reelId} gate: ${failed.join(' | ')}`);
              log(`  FAIL ${job.reelId}: ${failed.join(' | ')}`);
            } else log(`  ${job.reelId}: pass`);
          } catch (error) {
            failures.push(`${job.reelId} gate: ${firstLine(error)}`);
            log(`  ERROR ${job.reelId} gate: ${firstLine(error)}`);
          }
        }
      }
    }
  } catch (error) {
    if (!(error instanceof BudgetExceededError)) throw error;
    stoppedByBudget = error.message;
    log(error.message);
  } finally {
    restoreNetwork();
  }

  let reportPath: string | null = null;
  let manifest: RunSummary['manifest'] = null;
  if (want('report') || want('render') || want('gate')) {
    // Cover every reel in the library, not just this run's selection.
    const everything = jobsFor(content).filter((j) => readRecord(j.reelId, 'text'));
    manifest = writeManifests(content, everything, readDecisions());
    reportPath = writeReport(everything, `${opts.dryRun ? 'Dry run' : 'Run'} ${runId}`);
    log(
      `manifest.json: ${manifest.approved} approved reel(s) · manifest.all.json: ${manifest.all} reel(s)`,
    );
  }
  return {
    runId,
    jobs,
    spentUsd: ledger.spentUsd,
    estimatedUsd: ledger.estimatedUsd,
    stoppedByBudget,
    reportPath,
    failures,
    layoutFailures,
    rendered,
    gateFailures,
    manifest,
  };
}

/**
 * Runs `fn` over `items` with at most `limit` in flight. Stops handing out new
 * items once one throws, then rethrows that error after in-flight work settles.
 */
export async function forEachPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (failure === null && next < items.length) {
      const item = items[next++]!;
      try {
        await fn(item);
      } catch (error) {
        failure ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure !== null) throw failure;
}
