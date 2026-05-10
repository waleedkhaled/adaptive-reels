// Agent budget (PERFORMANCE.md section 1): p95 2 ms per next() and 10 ms per
// re-plan on the phones (Hermes, no JIT). This V8 run is a regression guard
// only: the whole re-plan (3 to 5 decisions) must stay well under 2 ms.
import { describe, expect, it } from 'vitest';
import { plan } from './queue';
import { persona, simulate } from './simulate';
import { T0 } from './testing/driver';
import { realCatalog } from './testing/fixtures';

declare const performance: { now(): number };
declare const console: { log(...args: unknown[]): void };

describe('plan() on the real graph', () => {
  it('takes well under 2 ms (median over many calls)', () => {
    const catalog = realCatalog();
    // A mid-session state: 30 items in, Focus on the demo clock, reviews in flight.
    const { state } = simulate({
      catalog,
      persona: persona('curious'),
      mode: 'focus',
      clock: 'demo',
      seed: 4,
      start: T0,
      slots: 30,
    });
    const now = state.session.last_active_at + 1_000;
    for (let i = 0; i < 200; i++) plan(state, catalog, now + i); // warm up
    const times: number[] = [];
    for (let i = 0; i < 2_000; i++) {
      const start = performance.now();
      plan(state, catalog, now + i);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    const p95 = times[Math.floor(times.length * 0.95)]!;
    console.log(
      `plan(): median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms over ${times.length} calls`,
    );
    expect(median).toBeLessThan(0.5);
    expect(p95).toBeLessThan(2);
  });
});
