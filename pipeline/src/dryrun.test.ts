import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Manifest } from '@reels/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { run } from './run';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-dry-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('dry run', () => {
  // Type-checks every fake snippet: allow for a slow CI machine.
  it(
    'runs generate -> images offline, projects a cost, and writes a report',
    { timeout: 60_000 },
    async () => {
      const realFetch = globalThis.fetch;
      const spy = vi.fn(realFetch);
      globalThis.fetch = spy as typeof fetch;
      try {
        const summary = await run({
          stages: ['generate', 'tts', 'images', 'report'],
          dryRun: true,
          limit: 5,
          budgetUsd: 10,
          force: true,
          libraryDir: dir,
          log: () => {},
        });
        expect(spy).not.toHaveBeenCalled();
        expect(summary.jobs).toHaveLength(5);
        expect(summary.spentUsd).toBe(0);
        expect(summary.estimatedUsd).toBeGreaterThan(0);
        expect(summary.estimatedUsd).toBeLessThan(1);
        const ledger = fs
          .readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        const llmCalls = ledger.filter(
          (e) => e.stage === 'generate' || e.stage.startsWith('review:'),
        );
        expect(llmCalls.length).toBeGreaterThan(0);
        for (const e of llmCalls) {
          expect(e.prompt_version).toMatch(/^[0-9a-f]{12}$/);
          expect(e.request_sha256).toMatch(/^[0-9a-f]{64}$/);
          expect(e.latency_ms).toBeGreaterThanOrEqual(0);
        }
        for (const job of summary.jobs) {
          const text = JSON.parse(
            fs.readFileSync(path.join(dir, 'reels', job.reelId, 'text.json'), 'utf8'),
          );
          expect(text.status).toBe('passed');
          expect(text.provenance.writer.prompt_version).toMatch(/^[0-9a-f]{12}$/);
          expect(Object.keys(text.provenance.reviewer.prompt_versions)).toEqual(['G2', 'G3', 'G4']);
          expect(fs.existsSync(path.join(dir, 'reels', job.reelId, 'timing.json'))).toBe(true);
        }
        expect(fs.readFileSync(summary.reportPath!, 'utf8')).toContain('rn-core-components--intro');
        // Nothing rendered yet, so the manifest is valid but empty.
        expect(
          Manifest.parse(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')))
            .reels,
        ).toEqual([]);
      } finally {
        globalThis.fetch = realFetch;
      }
    },
  );

  it('stops at the budget cap and still writes the report', async () => {
    const summary = await run({
      stages: ['generate', 'report'],
      dryRun: true,
      limit: 5,
      budgetUsd: 0.02,
      force: true,
      libraryDir: dir,
      log: () => {},
    });
    expect(summary.stoppedByBudget).toMatch(/Budget cap reached/);
    expect(summary.estimatedUsd).toBeLessThanOrEqual(0.02);
    expect(fs.existsSync(summary.reportPath!)).toBe(true);
  });
});
