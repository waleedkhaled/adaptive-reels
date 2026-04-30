import { describe, expect, it } from 'vitest';
import { CostLedger } from './ledger';
import type { LLM } from './providers/types';
import { LLMReviewer, type Question } from './reviewer';

const replying = (reply: unknown): LLM => ({
  provider: 'test',
  model: 'test',
  estimateUsd: () => 0.001,
  async complete() {
    const text = JSON.stringify(reply);
    return { value: { text, inputTokens: 1, outputTokens: 1 }, costUsd: 0.001, units: {} };
  },
});

const flag: Question = { type: 'noul', instructions: 'Is it insecure?' };
const ask = (reply: unknown) =>
  new LLMReviewer(replying(reply), new CostLedger(1, 'run', false)).ask('reel', 'G4', 'state', {
    a: flag,
    b: flag,
  });

describe('LLMReviewer yes/no answers', () => {
  it('takes an answer without a usable confidence at face value', async () => {
    const answers = await ask({
      answers: { a: { answer: false }, b: { answer: 'true', confidence: 'high' } },
    });
    expect(answers.a).toMatchObject({ type: 'noul', probability: 0 });
    expect(answers.b).toMatchObject({ type: 'noul', probability: 1 });
  });

  it('turns a confident "no" into a low probability that the flag is true', async () => {
    const answers = await ask({
      answers: { a: { answer: false, confidence: 0.8 }, b: { answer: true, confidence: 0.7 } },
    });
    expect(answers.a?.probability).toBeCloseTo(0.2);
    expect(answers.b?.probability).toBeCloseTo(0.7);
  });
});
