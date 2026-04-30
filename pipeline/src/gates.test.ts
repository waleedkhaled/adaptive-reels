import fs from 'node:fs';
import path from 'node:path';
import { ReelSpec } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { plantFalseClaim } from './canary';
import { flowProblems, layoutFlow } from './catalogue';
import { REPO_ROOT } from './config';
import { jobsFor, loadContent } from './content';
import { codeProblems, gateG1, gateG2, quoteProblems, runGates } from './gates';
import { CostLedger } from './ledger';
import { fakeProviders, fakeSpecJson } from './providers/fake';
import type { ChatRequest, LLM } from './providers/types';
import { LLMReviewer, type Answer, type Question, type Reviewer } from './reviewer';
import { writeSpec } from './writer';

const content = loadContent();
const fixture = ReelSpec.parse(
  JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/schemas/fixtures/reel-spec.valid.json'), 'utf8'),
  ),
);
const REEL = 'react-components-props--intro';
const job = jobsFor(content, { only: [REEL] })[0]!;
const fakeSpec = () => ReelSpec.parse(JSON.parse(fakeSpecJson(content, REEL)));

/** A reviewer that answers favourably, except for keys given in `overrides`. */
function scriptedReviewer(overrides: Record<string, Answer> = {}): Reviewer & { asked: string[] } {
  const asked: string[] = [];
  return {
    provider: 'test',
    model: 'test',
    asked,
    async ask(_reelId: string, gate: string, _state: string, questions: Record<string, Question>) {
      asked.push(gate);
      const out: Record<string, Answer> = {};
      for (const [key, q] of Object.entries(questions)) {
        const choice = key.startsWith('claim_')
          ? 'supported'
          : key.startsWith('code_')
            ? 'correct'
            : 'A';
        out[key] =
          overrides[key] ??
          (q.type === 'choice'
            ? { type: 'choice', choice, probability: 0.9, evidence: '' }
            : q.type === 'score'
              ? { type: 'score', level: 4, probability: 0.8, evidence: '' }
              : { type: 'noul', probability: 0.05, evidence: '' });
      }
      return out;
    },
  };
}

describe('G1 lint', () => {
  it('passes the fake writer output', () => {
    expect(gateG1(fakeSpec(), job).issues).toEqual([]);
  });

  it('flags symbols and "n1"-style tokens in narration', () => {
    const spec = structuredClone(fixture);
    spec.segments[0]!.narration = 'Set x = a1 + b to get it.';
    const issues = gateG1(spec, job).issues.join('\n');
    expect(issues).toContain('symbols a TTS voice cannot read');
    expect(issues).toContain('token like "n1"');
  });

  it('flags narration far too long for the target duration', () => {
    const spec = structuredClone(fixture);
    spec.segments[0]!.narration = 'word '.repeat(200).trim();
    expect(gateG1(spec, job).issues.join('\n')).toContain('spoken length');
  });
});

describe('code checks', () => {
  const code = (
    src: string,
    check: 'compiles' | 'should_error' | 'none',
    language: 'ts' | 'tsx' | 'bash' = 'ts',
  ) => ({
    kind: 'code' as const,
    language,
    code: src,
    highlight_lines: [],
    check,
    shows_mistake: false,
  });

  it('accepts code that compiles as claimed', () => {
    expect(codeProblems(code('const n: number = 1;', 'compiles'), 'segment 1')).toEqual([]);
  });

  it('rejects code claimed to compile that does not', () => {
    expect(codeProblems(code('const n: number = "one";', 'compiles'), 'segment 1')[0]).toMatch(
      /segment 1 code does not type-check: line 1/,
    );
  });

  it('rejects a "mistake" snippet that actually compiles', () => {
    expect(codeProblems(code('const n = 1;', 'should_error'), 'segment 2')).toEqual([
      'segment 2 code is marked should_error but type-checks cleanly',
    ]);
  });

  it('rejects lines too wide for the phone frame', () => {
    expect(
      codeProblems(code(`const s = "${'x'.repeat(40)}";`, 'compiles'), 'segment 1')[0],
    ).toMatch(/line 1 is \d+ characters/);
  });

  it('only type-checks ts/tsx', () => {
    expect(codeProblems(code('npm install', 'none', 'bash'), 's')).toEqual([]);
    expect(codeProblems(code('npm install', 'compiles', 'bash'), 's')[0]).toContain(
      'use check "none"',
    );
  });
});

describe('flow layout', () => {
  const nodes = ['app', 'cache', 'model', 'db'].map((id) => ({ id, label: id }));

  it('layers nodes by longest path and ignores back edges', () => {
    const laid = layoutFlow(nodes, [
      { from: 'app', to: 'cache' },
      { from: 'cache', to: 'model' },
      { from: 'app', to: 'db' },
      { from: 'model', to: 'app' },
    ]);
    expect(laid.map((n) => [n.id, n.layer])).toEqual([
      ['app', 0],
      ['cache', 1],
      ['model', 2],
      ['db', 1],
    ]);
  });

  it('rejects too many boxes side by side and unknown nodes', () => {
    const wide = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id }));
    const edges = ['b', 'c', 'd', 'e'].map((to) => ({ from: 'a', to }));
    expect(flowProblems(wide, edges).join('\n')).toContain('more than 3 boxes side by side');
    expect(flowProblems(nodes, [{ from: 'app', to: 'ghost' }])).toContain(
      'flow edge app -> ghost references an unknown node',
    );
  });
});

describe('G2 claims vs source', () => {
  it('accepts quotes that are verbatim spans of the card', () => {
    expect(quoteProblems(fixture, job.concept.card.text)).toEqual([]);
  });

  it('rejects a quote that is not in the card, without asking the reviewer', async () => {
    const spec = structuredClone(fixture);
    spec.key_claims[0]!.quote = 'Props can be changed by the child.';
    const reviewer = scriptedReviewer();
    const result = await gateG2(spec, job, reviewer);
    expect(result.pass).toBe(false);
    expect(result.issues[0]).toContain('not a verbatim span');
    expect(reviewer.asked).toEqual([]);
  });

  it('rejects a planted false claim the reviewer marks contradicted', async () => {
    const reviewer = scriptedReviewer({
      claim_c1: {
        type: 'choice',
        choice: 'contradicted',
        probability: 0.95,
        evidence: 'card says props are read-only',
      },
    });
    const result = await gateG2(plantFalseClaim(fixture), job, reviewer);
    expect(result.pass).toBe(false);
    expect(result.issues).toContain(
      'claim c1 is contradicted by the source card: card says props are read-only',
    );
  });

  it('rejects a wrong answer key', async () => {
    const reviewer = scriptedReviewer({
      item_1: { type: 'choice', choice: 'B', probability: 0.9, evidence: '' },
    });
    const result = await gateG2(fixture, job, reviewer);
    expect(result.issues[0]).toContain('answer key says A but the reviewer picked B');
  });

  it('rejects code the reviewer says does not match its narration', async () => {
    const reviewer = scriptedReviewer({
      code_1: {
        type: 'choice',
        choice: 'incorrect',
        probability: 0.9,
        evidence: 'it never passes a prop',
      },
    });
    const result = await gateG2(fixture, job, reviewer);
    expect(result.issues).toContain(
      'segment 1 code does not match its narration: it never passes a prop',
    );
  });
});

describe('G2 code bug check', () => {
  it('rejects code the reviewer flags as buggy', async () => {
    const reviewer = scriptedReviewer({
      bug_1: { type: 'noul', probability: 0.8, evidence: 'if (hit) misses empty strings' },
    });
    const result = await gateG2(fixture, job, reviewer);
    expect(result.issues).toContain(
      'segment 1 code has a bug or bad practice: if (hit) misses empty strings',
    );
  });

  it('does not ask about bugs in compiling code flagged shows_mistake', async () => {
    const spec = structuredClone(fixture);
    const v = spec.segments[0]!.visual;
    if (v.kind === 'code') v.shows_mistake = true;
    let keys: string[] = [];
    const reviewer = scriptedReviewer();
    const ask = reviewer.ask.bind(reviewer);
    reviewer.ask = async (r, g, s, q) => {
      keys = Object.keys(q);
      return ask(r, g, s, q);
    };
    await gateG2(spec, job, reviewer);
    expect(keys).toContain('code_1');
    expect(keys).not.toContain('bug_1');
  });

  it('does not ask about bugs in snippets shown as deliberate mistakes', async () => {
    const spec = structuredClone(fixture);
    const v = spec.segments[0]!.visual;
    if (v.kind === 'code') v.check = 'should_error';
    let keys: string[] = [];
    const reviewer = scriptedReviewer();
    const ask = reviewer.ask.bind(reviewer);
    reviewer.ask = async (r, g, s, q) => {
      keys = Object.keys(q);
      return ask(r, g, s, q);
    };
    await gateG2(spec, job, reviewer);
    expect(keys).toContain('code_1');
    expect(keys).not.toContain('bug_1');
  });
});

describe('runGates', () => {
  it('stops at the first failing gate', async () => {
    const reviewer = scriptedReviewer({
      hook: { type: 'score', level: 1, probability: 0.9, evidence: 'flat' },
    });
    const results = await runGates(fakeSpec(), job, reviewer);
    expect(results.map((r) => [r.gate, r.pass])).toEqual([
      ['G1', true],
      ['G2', true],
      ['G3', false],
    ]);
    expect(reviewer.asked).toEqual(['G2', 'G3']);
  });
});

describe('writer repair loop', () => {
  it('feeds schema errors back and accepts the corrected draft', async () => {
    const good = fakeSpecJson(content, REEL);
    const prompts: string[] = [];
    const writer: LLM = {
      provider: 'test',
      model: 'test',
      estimateUsd: () => 0.001,
      async complete(req: ChatRequest) {
        prompts.push(req.user);
        const text =
          prompts.length === 1 ? JSON.stringify({ ...JSON.parse(good), difficulty: 9 }) : good;
        return { value: { text, inputTokens: 1, outputTokens: 1 }, costUsd: 0.001, units: {} };
      },
    };
    const result = await writeSpec(writer, new CostLedger(1, 'run', false), job);
    expect(result.spec?.reel_id).toBe(REEL);
    expect(result.calls).toBe(2);
    expect(prompts[1]).toContain('failed schema validation');
    expect(prompts[1]).toContain('difficulty');
  });

  it('keeps the review feedback when a rewrite needs a schema repair', async () => {
    const good = fakeSpecJson(content, REEL);
    const prompts: string[] = [];
    const writer: LLM = {
      provider: 'test',
      model: 'test',
      estimateUsd: () => 0.001,
      async complete(req: ChatRequest) {
        prompts.push(req.user);
        const text = prompts.length === 1 ? 'not json' : good;
        return { value: { text, inputTokens: 1, outputTokens: 1 }, costUsd: 0.001, units: {} };
      },
    };
    const feedback = { previous: { hook: 'old' }, issues: ['claim c1 is unsupported'] };
    const result = await writeSpec(writer, new CostLedger(1, 'run', false), job, feedback);
    expect(result.calls).toBe(2);
    for (const prompt of prompts) expect(prompt).toContain('claim c1 is unsupported');
    expect(prompts[1]).toContain('not valid JSON');
  });

  it('the fake providers produce a spec that passes every gate', async () => {
    const providers = fakeProviders(content);
    const ledger = new CostLedger(1, 'run', true);
    const written = await writeSpec(providers.writer, ledger, job);
    const results = await runGates(written.spec!, job, new LLMReviewer(providers.reviewer, ledger));
    expect(results.every((r) => r.pass)).toBe(true);
  });
});
