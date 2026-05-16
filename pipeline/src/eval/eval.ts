// Reviewer eval. Runs the three review gates over the golden set (good specs)
// and the planted defects (bad specs), then scores the reviewer the way you'd
// score any classifier: recall on defects, specificity on good specs. Every
// gate runs on every case (no fail-fast), so each gate gets its own numbers;
// the pipeline's verdict, reject when any gate fails, is scored as well.
//
// Recorded answers replay offline: ReplayReviewer returns the stored answers
// only while a gate would send exactly the same prompt. A change to a gate's
// decision logic is re-scored for free; a change to a prompt makes the
// recording stale, which says a live run is due.
import type { ReelSpec } from '@reels/schemas';
import type { Job } from '../content';
import { REVIEW_GATES, type ReviewGateId } from '../gates';
import { BudgetExceededError, type LedgerEntry } from '../ledger';
import { sha256 } from '../provenance';
import { buildReviewerPrompt, type Answer, type Question, type Reviewer } from '../reviewer';
import { forEachPool } from '../run';
import { caseId, DEFECTS, PLANTED, plant, type Defect, type PlantedCase } from './cases';
import { loadGolden, type Golden } from './golden';

/**
 * The regression bar for `npm run eval` and the replay test: a ratchet at the
 * first live run (2026-10-05: recall 16/24, specificity 15/16), so a change
 * that loses one catch or adds one false alarm fails. Raise it as the gates
 * improve; the target is recall 0.8 (docs/EVALS.md).
 */
export const EVAL_THRESHOLDS = { recall: 0.65, specificity: 0.9 };

export const GATE_IDS = Object.keys(REVIEW_GATES) as ReviewGateId[];

export interface EvalCase {
  id: string;
  label: 'good' | 'bad';
  defect: Defect | null;
  expectedGate: ReviewGateId | null;
  note: string;
  spec: ReelSpec;
  job: Job;
}

export function buildCases(
  golden: Golden[] = loadGolden(),
  planted: PlantedCase[] = PLANTED,
): EvalCase[] {
  const byId = new Map(golden.map((g) => [g.file.reel_id, g]));
  const good: EvalCase[] = golden.map((g) => ({
    id: `good/${g.file.reel_id}`,
    label: 'good',
    defect: null,
    expectedGate: null,
    note: g.file.label_source,
    spec: g.spec,
    job: g.job,
  }));
  const bad: EvalCase[] = planted.map((c) => {
    const g = byId.get(c.base);
    if (!g) throw new Error(`planted case ${caseId(c)}: no golden spec "${c.base}"`);
    return {
      id: caseId(c),
      label: 'bad',
      defect: c.defect,
      expectedGate: DEFECTS[c.defect].gate,
      note: c.note,
      spec: plant(c, g.spec),
      job: g.job,
    };
  });
  return [...good, ...bad];
}

export interface GateOutcome {
  pass: boolean;
  issues: string[];
  /** sha256 of the prompt the gate sent; a replay needs exactly this prompt. */
  prompt_sha256: string;
  answers: Record<string, Answer>;
}

export interface CaseResult {
  id: string;
  label: 'good' | 'bad';
  defect: Defect | null;
  expected_gate: ReviewGateId | null;
  gates: Partial<Record<ReviewGateId, GateOutcome>>;
  /** The pipeline's verdict: rejected when any gate fails. */
  rejected: boolean;
  caught_by: ReviewGateId[];
  /** Set when the case could not be scored (reviewer failure, stale recording). */
  error?: string;
  stale?: boolean;
}

const promptSha = (state: string, questions: Record<string, Question>) => {
  const prompt = buildReviewerPrompt(state, questions);
  return sha256(`${prompt.system}\n${prompt.user}`);
};

/** Tags each question with the case id (so ledger entries are per case) and keeps the prompt hash. */
class RecordingReviewer implements Reviewer {
  promptSha256 = '';
  constructor(
    private readonly inner: Reviewer,
    private readonly caseId: string,
  ) {}
  get provider() {
    return this.inner.provider;
  }
  get model() {
    return this.inner.model;
  }
  ask(_reelId: string, gate: string, state: string, questions: Record<string, Question>) {
    this.promptSha256 = promptSha(state, questions);
    return this.inner.ask(this.caseId, gate, state, questions);
  }
}

export class StaleRecordingError extends Error {
  constructor(id: string, gate: string) {
    super(
      `${id} ${gate}: the gate now sends a different prompt than the recording; run the live eval`,
    );
    this.name = 'StaleRecordingError';
  }
}

/** Answers from a recorded eval, only for prompts identical to the recorded ones. */
export class ReplayReviewer implements Reviewer {
  readonly provider = 'replay';
  private readonly recorded: Map<string, CaseResult>;
  constructor(
    readonly model: string,
    results: CaseResult[],
  ) {
    this.recorded = new Map(results.map((r) => [r.id, r]));
  }
  async ask(id: string, gate: string, state: string, questions: Record<string, Question>) {
    const outcome = this.recorded.get(id)?.gates[gate as ReviewGateId];
    if (!outcome || outcome.prompt_sha256 !== promptSha(state, questions))
      throw new StaleRecordingError(id, gate);
    return outcome.answers;
  }
}

async function runCase(c: EvalCase, reviewer: Reviewer): Promise<CaseResult> {
  const gates: CaseResult['gates'] = {};
  for (const id of GATE_IDS) {
    const recorder = new RecordingReviewer(reviewer, c.id);
    const result = await REVIEW_GATES[id](c.spec, c.job, recorder);
    gates[id] = {
      pass: result.pass,
      issues: result.issues,
      prompt_sha256: recorder.promptSha256,
      answers: result.answers ?? {},
    };
  }
  const caught = GATE_IDS.filter((id) => gates[id] && !gates[id].pass);
  return {
    id: c.id,
    label: c.label,
    defect: c.defect,
    expected_gate: c.expectedGate,
    gates,
    rejected: caught.length > 0,
    caught_by: caught,
  };
}

export async function runEval(opts: {
  reviewer: Reviewer;
  cases: EvalCase[];
  concurrency?: number;
  log?: (line: string) => void;
}): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const indexed = opts.cases.map((c, i) => ({ c, i }));
  await forEachPool(indexed, Math.max(1, opts.concurrency ?? 6), async ({ c, i }) => {
    try {
      results[i] = await runCase(c, opts.reviewer);
    } catch (error) {
      if (error instanceof BudgetExceededError) throw error;
      results[i] = {
        id: c.id,
        label: c.label,
        defect: c.defect,
        expected_gate: c.expectedGate,
        gates: {},
        rejected: false,
        caught_by: [],
        error: (error as Error).message.split('\n')[0],
        ...(error instanceof StaleRecordingError ? { stale: true } : {}),
      };
    }
    const r = results[i]!;
    opts.log?.(
      `  ${r.error ? 'ERROR' : r.rejected === (r.label === 'bad') ? 'ok   ' : 'MISS '} ${r.id}${r.caught_by.length ? ` (${r.caught_by.join(', ')})` : ''}${r.error ? `: ${r.error}` : ''}`,
    );
  });
  return results;
}

const ratio = (n: number, d: number) => (d ? n / d : null);

export interface Rates {
  tp: number;
  fn: number;
  tn: number;
  fp: number;
  /** Share of planted defects the pipeline rejects. */
  recall: number | null;
  /** Share of good specs the pipeline passes. */
  specificity: number | null;
  precision: number | null;
}

export interface EvalScore {
  cases: { good: number; bad: number; errors: number; stale: number };
  pipeline: Rates;
  gates: Record<
    ReviewGateId,
    {
      /** Good specs this gate rejected. */
      false_alarms: number;
      good: number;
      /** Planted defects of this gate's own types that it rejected. */
      caught_own: number;
      own: number;
      /** Planted defects of any type that it rejected. */
      caught_any: number;
      bad: number;
    }
  >;
  defects: Partial<
    Record<
      Defect,
      {
        caught: number;
        total: number;
        by_expected_gate: number;
        flagged_by: Partial<Record<ReviewGateId, number>>;
      }
    >
  >;
}

export function score(results: CaseResult[]): EvalScore {
  const scored = results.filter((r) => !r.error);
  const good = scored.filter((r) => r.label === 'good');
  const bad = scored.filter((r) => r.label === 'bad');
  const tp = bad.filter((r) => r.rejected).length;
  const fp = good.filter((r) => r.rejected).length;
  const pipeline: Rates = {
    tp,
    fn: bad.length - tp,
    tn: good.length - fp,
    fp,
    recall: ratio(tp, bad.length),
    specificity: ratio(good.length - fp, good.length),
    precision: ratio(tp, tp + fp),
  };
  const gates = Object.fromEntries(
    GATE_IDS.map((id) => {
      const own = bad.filter((r) => r.expected_gate === id);
      return [
        id,
        {
          false_alarms: good.filter((r) => r.caught_by.includes(id)).length,
          good: good.length,
          caught_own: own.filter((r) => r.caught_by.includes(id)).length,
          own: own.length,
          caught_any: bad.filter((r) => r.caught_by.includes(id)).length,
          bad: bad.length,
        },
      ];
    }),
  ) as EvalScore['gates'];
  const defects: EvalScore['defects'] = {};
  for (const r of bad) {
    const d = (defects[r.defect!] ??= { caught: 0, total: 0, by_expected_gate: 0, flagged_by: {} });
    d.total++;
    if (r.rejected) d.caught++;
    if (r.expected_gate && r.caught_by.includes(r.expected_gate)) d.by_expected_gate++;
    for (const g of r.caught_by) d.flagged_by[g] = (d.flagged_by[g] ?? 0) + 1;
  }
  return {
    cases: {
      good: good.length,
      bad: bad.length,
      errors: results.length - scored.length,
      stale: results.filter((r) => r.stale).length,
    },
    pipeline,
    gates,
    defects,
  };
}

export const meetsThresholds = (s: EvalScore) =>
  s.cases.errors === 0 &&
  (s.pipeline.recall ?? 0) >= EVAL_THRESHOLDS.recall &&
  (s.pipeline.specificity ?? 0) >= EVAL_THRESHOLDS.specificity;

export interface Usage {
  calls: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  latency_ms: { p50: number; p95: number; max: number };
  retried_calls: number;
}

const percentile = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! : 0;

export function usageOf(entries: LedgerEntry[]): Usage {
  const latencies = entries.map((e) => e.latency_ms).sort((a, b) => a - b);
  return {
    calls: entries.length,
    cost_usd: entries.reduce((s, e) => s + e.cost_usd, 0),
    input_tokens: entries.reduce((s, e) => s + (e.units.input_tokens ?? 0), 0),
    output_tokens: entries.reduce((s, e) => s + (e.units.output_tokens ?? 0), 0),
    latency_ms: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
    retried_calls: entries.filter((e) => (e.attempts ?? 1) > 1).length,
  };
}

export interface EvalReport {
  schema_version: 1;
  run_id: string;
  at: string;
  mode: 'live' | 'dry-run' | 'replay';
  reviewer: { provider: string; model: string };
  prompt_versions: Record<ReviewGateId, string>;
  git_commit: string | null;
  /** Calls, cost and latency; for a replay, those of the recording. */
  usage: Usage | null;
  thresholds: typeof EVAL_THRESHOLDS;
  passed: boolean;
  score: EvalScore;
  results: CaseResult[];
}

const pct = (r: number | null) => (r === null ? 'n/a' : `${Math.round(r * 100)}%`);

export function formatSummary(report: EvalReport, cases: EvalCase[]): string {
  const s = report.score;
  const p = s.pipeline;
  const lines = [
    `Reviewer eval (${report.mode}) · ${report.reviewer.model} · prompts ${GATE_IDS.map((g) => `${g} ${report.prompt_versions[g]}`).join(', ')}`,
    `${s.cases.good + s.cases.bad + s.cases.errors} cases: ${s.cases.good} good, ${s.cases.bad} planted defects${s.cases.errors ? `, ${s.cases.errors} not scored (${s.cases.stale} stale)` : ''}`,
    '',
    'Pipeline verdict (reject when any gate fails)',
    `  recall: defects caught        ${p.tp}/${p.tp + p.fn}  ${pct(p.recall)}`,
    `  specificity: good specs passed ${p.tn}/${p.tn + p.fp}  ${pct(p.specificity)}`,
    `  precision                     ${p.tp}/${p.tp + p.fp}  ${pct(p.precision)}`,
    '',
    'By defect type                caught  by its gate  flagged by',
    ...Object.entries(s.defects).map(
      ([d, v]) =>
        `  ${d.padEnd(28)}${`${v.caught}/${v.total}`.padEnd(8)}${`${v.by_expected_gate}/${v.total} ${DEFECTS[d as Defect].gate}`.padEnd(13)}${Object.entries(
          v.flagged_by,
        )
          .map(([g, n]) => `${g}×${n}`)
          .join(' ')}`,
    ),
    '',
    'By gate    false alarms on good   own defects caught   any defect caught',
    ...GATE_IDS.map((g) => {
      const v = s.gates[g];
      return `  ${g}       ${`${v.false_alarms}/${v.good}`.padEnd(23)}${`${v.caught_own}/${v.own}`.padEnd(21)}${v.caught_any}/${v.bad}`;
    }),
  ];
  if (report.usage) {
    const u = report.usage;
    lines.push(
      '',
      `Usage: ${u.calls} calls, $${u.cost_usd.toFixed(4)} ($${(u.cost_usd / Math.max(1, cases.length)).toFixed(4)} per case), latency p50 ${(u.latency_ms.p50 / 1000).toFixed(1)} s, p95 ${(u.latency_ms.p95 / 1000).toFixed(1)} s, ${u.retried_calls} call(s) retried`,
    );
  }
  const byId = new Map(cases.map((c) => [c.id, c]));
  const missed = report.results.filter((r) => !r.error && r.label === 'bad' && !r.rejected);
  const alarms = report.results.filter((r) => !r.error && r.label === 'good' && r.rejected);
  if (missed.length)
    lines.push(
      '',
      'Missed defects:',
      ...missed.map((r) => `  ${r.id}: ${byId.get(r.id)?.note ?? ''}`),
    );
  if (alarms.length)
    lines.push(
      '',
      'False alarms:',
      ...alarms.map(
        (r) =>
          `  ${r.id}: ${r.caught_by.map((g) => `${g} ${r.gates[g]?.issues.join('; ')}`).join(' | ')}`,
      ),
    );
  const errors = report.results.filter((r) => r.error);
  if (errors.length) lines.push('', 'Not scored:', ...errors.map((r) => `  ${r.id}: ${r.error}`));
  lines.push(
    '',
    report.mode === 'dry-run'
      ? 'Dry run: the fake reviewer gives every spec the same answers, so these numbers only show that the harness runs.'
      : `${report.passed ? 'PASS' : 'FAIL'}: bar is recall >= ${pct(EVAL_THRESHOLDS.recall)} and specificity >= ${pct(EVAL_THRESHOLDS.specificity)} with no unscored cases`,
  );
  return lines.join('\n');
}
