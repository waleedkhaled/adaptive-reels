import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Answer, Question, Reviewer } from '../reviewer';
import {
  buildCases,
  meetsThresholds,
  ReplayReviewer,
  runEval,
  score,
  type CaseResult,
  type EvalCase,
  type EvalReport,
} from './eval';
import { RESULTS_DIR } from './golden';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Answers like a reviewer that knows the truth: passes good cases, flags each
 * planted case at its expected gate, except the cases listed in `misses`.
 */
class ScriptedReviewer implements Reviewer {
  readonly provider = 'scripted';
  readonly model = 'scripted';
  calls = 0;
  private readonly byId: Map<string, EvalCase>;
  constructor(
    cases: EvalCase[],
    private readonly misses: Set<string> = new Set(),
  ) {
    this.byId = new Map(cases.map((c) => [c.id, c]));
  }
  async ask(id: string, gate: string, _state: string, questions: Record<string, Question>) {
    this.calls++;
    const c = this.byId.get(id)!;
    const flag = c.expectedGate === gate && !this.misses.has(id);
    return Object.fromEntries(
      Object.entries(questions).map(([key, q]): [string, Answer] => {
        if (q.type === 'score')
          return [key, { type: 'score', level: flag ? 1 : 5, probability: 0.9, evidence: '' }];
        if (q.type === 'noul')
          return [key, { type: 'noul', probability: flag ? 0.95 : 0.05, evidence: '' }];
        const item = /^item_(\d+)$/.exec(key);
        const choice = item
          ? LETTERS[c.spec.retrieval_items[Number(item[1]) - 1]!.answer_index]!
          : key.startsWith('claim_')
            ? flag
              ? 'contradicted'
              : 'supported'
            : 'correct';
        return [key, { type: 'choice', choice, probability: 0.9, evidence: '' }];
      }),
    );
  }
}

const result = (over: Partial<CaseResult>): CaseResult => ({
  id: 'x',
  label: 'good',
  defect: null,
  expected_gate: null,
  gates: {},
  rejected: false,
  caught_by: [],
  ...over,
});

describe('eval scoring', () => {
  it('scores the pipeline verdict and each gate, leaving unscored cases out', () => {
    const s = score([
      result({ id: 'good/a' }),
      result({ id: 'good/b', rejected: true, caught_by: ['G3'] }),
      result({
        id: 'wrong_answer_key/a',
        label: 'bad',
        defect: 'wrong_answer_key',
        expected_gate: 'G2',
        rejected: true,
        caught_by: ['G2', 'G4'],
      }),
      result({
        id: 'insecure_practice/a',
        label: 'bad',
        defect: 'insecure_practice',
        expected_gate: 'G4',
        rejected: true,
        caught_by: ['G2'],
      }),
      result({
        id: 'subtle_bug/a',
        label: 'bad',
        defect: 'subtle_bug',
        expected_gate: 'G2',
      }),
      result({ id: 'subtle_bug/b', label: 'bad', defect: 'subtle_bug', error: 'timeout' }),
    ]);
    expect(s.cases).toEqual({ good: 2, bad: 3, errors: 1, stale: 0 });
    expect(s.pipeline).toMatchObject({ tp: 2, fn: 1, tn: 1, fp: 1 });
    expect(s.pipeline.recall).toBeCloseTo(2 / 3);
    expect(s.pipeline.specificity).toBe(0.5);
    expect(s.gates.G2).toMatchObject({ false_alarms: 0, caught_own: 1, own: 2, caught_any: 2 });
    expect(s.gates.G3).toMatchObject({ false_alarms: 1, caught_own: 0, own: 0 });
    expect(s.gates.G4).toMatchObject({ caught_own: 0, own: 1, caught_any: 1 });
    expect(s.defects.insecure_practice).toEqual({
      caught: 1,
      total: 1,
      by_expected_gate: 0,
      flagged_by: { G2: 1 },
    });
    expect(meetsThresholds(s)).toBe(false);
  });
});

const cases = buildCases();

describe.skipIf(!cases.some((c) => c.label === 'bad'))('eval run and replay', () => {
  it('runs every gate on every case and replays the recording without calling the reviewer', async () => {
    const missed = cases.find((c) => c.label === 'bad')!.id;
    const scripted = new ScriptedReviewer(cases, new Set([missed]));
    const results = await runEval({ reviewer: scripted, cases });
    expect(scripted.calls).toBe(cases.length * 3);
    const s = score(results);
    const bad = cases.filter((c) => c.label === 'bad').length;
    expect(s.pipeline).toMatchObject({ tp: bad - 1, fn: 1, fp: 0 });
    expect(results.find((r) => r.id === missed)?.rejected).toBe(false);
    for (const r of results.filter((x) => x.label === 'bad' && x.id !== missed))
      expect(r.caught_by).toEqual([r.expected_gate]);

    const replayed = await runEval({ reviewer: new ReplayReviewer('scripted', results), cases });
    expect(replayed).toEqual(results);
  });

  it('marks a case stale when its prompt changed since the recording', async () => {
    const results = await runEval({ reviewer: new ScriptedReviewer(cases), cases });
    const edited = cases.map((c, i) =>
      i === 0 ? { ...c, spec: { ...c.spec, hook: `${c.spec.hook} Edited.` } } : c,
    );
    const replayed = await runEval({
      reviewer: new ReplayReviewer('scripted', results),
      cases: edited,
    });
    expect(replayed.filter((r) => r.stale).map((r) => r.id)).toEqual([edited[0]!.id]);
    expect(score(replayed).cases.stale).toBe(1);
  });
});

const latest = path.join(RESULTS_DIR, 'latest.json');

// The CI regression gate: re-score the last live run with today's gate logic, offline.
describe.skipIf(!fs.existsSync(latest))(
  'recorded live eval (pipeline/evals/results/latest.json)',
  () => {
    it('is current with the prompts and still meets the bar', async () => {
      const recording = JSON.parse(fs.readFileSync(latest, 'utf8')) as EvalReport;
      const replayed = await runEval({
        reviewer: new ReplayReviewer(recording.reviewer.model, recording.results),
        cases,
      });
      const stale = replayed.filter((r) => r.stale).map((r) => r.id);
      expect(
        stale,
        'prompts changed since the last live eval: run `npm run eval` and commit the results',
      ).toEqual([]);
      const s = score(replayed);
      expect(s.cases.errors).toBe(0);
      expect(meetsThresholds(s), JSON.stringify(s.pipeline)).toBe(true);
    });
  },
);
