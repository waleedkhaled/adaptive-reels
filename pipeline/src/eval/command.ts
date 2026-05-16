// npm run eval [-- --dry-run | --replay <results.json> | --only <case ids or defect types>]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config';
import { loadContent } from '../content';
import { gatePromptVersions } from '../gates';
import { CostLedger } from '../ledger';
import { deepInfraProviders } from '../providers/deepinfra';
import { blockNetwork, fakeProviders } from '../providers/fake';
import type { LLM } from '../providers/types';
import { LLMReviewer, type Reviewer } from '../reviewer';
import {
  buildCases,
  EVAL_THRESHOLDS,
  formatSummary,
  meetsThresholds,
  ReplayReviewer,
  runEval,
  score,
  usageOf,
  type EvalReport,
} from './eval';
import { RESULTS_DIR } from './golden';

export interface EvalCommandOptions {
  dryRun: boolean;
  /** A results file to re-score offline. */
  replay?: string;
  only?: string[];
  budgetUsd: number;
  concurrency?: number;
}

function gitCommit(): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** Returns the exit code: 1 when a live or replayed eval misses the bar. */
export async function evalCommand(opts: EvalCommandOptions): Promise<number> {
  let cases = buildCases();
  if (opts.only?.length) {
    const only = opts.only;
    cases = cases.filter((c) => only.some((o) => c.id === o || c.id.startsWith(`${o}/`)));
  }
  if (!cases.length) throw new Error('No eval cases selected.');
  const mode: EvalReport['mode'] = opts.replay ? 'replay' : opts.dryRun ? 'dry-run' : 'live';
  const runId = `eval-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const promptVersions = await gatePromptVersions();

  let reviewer: Reviewer;
  let ledger: CostLedger | null = null;
  let recorded: EvalReport | null = null;
  let restoreNetwork = () => {};
  if (opts.replay) {
    recorded = JSON.parse(fs.readFileSync(opts.replay, 'utf8')) as EvalReport;
    reviewer = new ReplayReviewer(recorded.reviewer.model, recorded.results);
  } else {
    let llm: LLM;
    if (opts.dryRun) {
      llm = fakeProviders(loadContent()).reviewer;
      restoreNetwork = blockNetwork();
    } else {
      const key = process.env.DEEPINFRA_API_KEY;
      if (!key) throw new Error('DEEPINFRA_API_KEY is not set. Copy .env.example to .env.');
      llm = deepInfraProviders(key).reviewer;
    }
    ledger = new CostLedger(opts.budgetUsd, runId, opts.dryRun, (entry) => {
      if (opts.dryRun) return;
      fs.mkdirSync(PATHS.library, { recursive: true });
      fs.appendFileSync(
        path.join(PATHS.library, 'eval-ledger.jsonl'),
        `${JSON.stringify(entry)}\n`,
      );
    });
    reviewer = new LLMReviewer(llm, ledger, promptVersions);
  }

  process.stdout.write(
    `Reviewer eval (${mode}): ${cases.length} case(s), 3 gates each${mode === 'live' ? `, budget $${opts.budgetUsd.toFixed(2)}` : ''}\n`,
  );
  let results;
  try {
    results = await runEval({
      reviewer,
      cases,
      concurrency: opts.concurrency,
      log: (line) => process.stdout.write(`${line}\n`),
    });
  } finally {
    restoreNetwork();
  }

  const s = score(results);
  const report: EvalReport = {
    schema_version: 1,
    run_id: runId,
    at: new Date().toISOString(),
    mode,
    reviewer: {
      provider: recorded?.reviewer.provider ?? reviewer.provider,
      model: reviewer.model,
    },
    prompt_versions: promptVersions,
    git_commit: gitCommit(),
    usage: recorded ? recorded.usage : ledger ? usageOf(ledger.entries) : null,
    thresholds: EVAL_THRESHOLDS,
    passed: meetsThresholds(s),
    score: s,
    results,
  };
  process.stdout.write(`\n${formatSummary(report, cases)}\n`);

  // Only a full live run becomes the recording that CI replays.
  if (mode === 'live' && !opts.only?.length) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const model = report.reviewer.model.split('/').at(-1)!.toLowerCase();
    const dated = path.join(RESULTS_DIR, `${report.at.slice(0, 10)}-${model}.json`);
    const body = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(dated, body);
    fs.writeFileSync(path.join(RESULTS_DIR, 'latest.json'), body);
    process.stdout.write(`Results: ${path.relative(process.cwd(), dated)} and latest.json\n`);
  }
  return mode === 'dry-run' || report.passed ? 0 : 1;
}
