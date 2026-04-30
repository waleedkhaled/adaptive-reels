import { describe, expect, it } from 'vitest';
import { BudgetExceededError, CostLedger, type Charged } from './ledger';

const meta = { reelId: 'caching--intro', stage: 'generate', provider: 'test', model: 'm' };
const paid = (costUsd: number) => async () => ({ value: costUsd, costUsd, units: {} });

describe('CostLedger', () => {
  it('records actual cost per call', async () => {
    const ledger = new CostLedger(1, 'run', false);
    await ledger.charge(meta, 0.2, paid(0.05));
    await ledger.charge({ ...meta, stage: 'tts' }, 0.01, paid(0.002));
    expect(ledger.spentUsd).toBeCloseTo(0.052);
    expect(ledger.entries.map((e) => e.stage)).toEqual(['generate', 'tts']);
  });

  it('halts before the call that would cross the cap, without making it', async () => {
    const ledger = new CostLedger(0.1, 'run', false);
    let calls = 0;
    const call = async () => {
      calls++;
      return { value: null, costUsd: 0.04, units: {} };
    };
    await ledger.charge(meta, 0.05, call);
    await ledger.charge(meta, 0.05, call);
    await expect(ledger.charge(meta, 0.05, call)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(2);
    expect(ledger.spentUsd).toBeCloseTo(0.08);
  });

  it('in a dry run spends nothing but enforces the cap on projected cost', async () => {
    const ledger = new CostLedger(0.1, 'run', true);
    await ledger.charge(meta, 0.06, paid(0.06));
    expect(ledger.spentUsd).toBe(0);
    expect(ledger.estimatedUsd).toBeCloseTo(0.06);
    await expect(ledger.charge(meta, 0.06, paid(0.06))).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it('counts calls still in flight against the cap', async () => {
    const ledger = new CostLedger(0.1, 'run', false);
    let release!: () => void;
    const slow = ledger.charge(
      meta,
      0.06,
      () =>
        new Promise<Charged<number>>(
          (r) => (release = () => r({ value: 1, costUsd: 0.06, units: {} })),
        ),
    );
    await expect(ledger.charge(meta, 0.06, paid(0.06))).rejects.toBeInstanceOf(BudgetExceededError);
    release();
    await slow;
    expect(ledger.spentUsd).toBeCloseTo(0.06);
  });

  it('records latency, attempts and prompt provenance on each entry', async () => {
    const ledger = new CostLedger(1, 'run', false);
    await ledger.charge(
      { ...meta, promptVersion: 'abc123def456', requestSha256: 'f'.repeat(64) },
      0.01,
      async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { value: null, costUsd: 0.001, units: {}, attempts: 2 };
      },
    );
    await ledger.charge({ ...meta, stage: 'tts' }, 0.01, paid(0.001));
    const [llm, tts] = ledger.entries;
    expect(llm).toMatchObject({
      prompt_version: 'abc123def456',
      request_sha256: 'f'.repeat(64),
      attempts: 2,
    });
    expect(llm!.latency_ms).toBeGreaterThanOrEqual(15);
    expect(tts).not.toHaveProperty('prompt_version');
    expect(tts).not.toHaveProperty('attempts');
    expect(tts!.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('streams every entry to the sink', async () => {
    const seen: string[] = [];
    const ledger = new CostLedger(1, 'run-7', false, (e) =>
      seen.push(`${e.run_id}:${e.reel_id}:${e.cost_usd}`),
    );
    await ledger.charge(meta, 0.01, paid(0.003));
    expect(seen).toEqual(['run-7:caching--intro:0.003']);
  });
});
