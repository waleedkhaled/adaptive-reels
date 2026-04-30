import { describe, expect, it } from 'vitest';
import { analyze, format, quantile } from './analyze-log';

const base = (type: string, extra: Record<string, unknown>, at = 1_791_000_000_000) =>
  JSON.stringify({ id: `e${Math.random()}`, session_id: 's1', at, type, ...extra });

const reason = { code: 'DEEPEN_INTEREST', params: {} };

describe('tester log analysis', () => {
  it('quantile picks the nearest rank', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([300, 100, 200], 0.5)).toBe(200);
    expect(quantile([100, 200, 300, 400, 900], 0.95)).toBe(900);
  });

  it('counts skips, delayed-review accuracy and reel starts, and flags invalid lines', () => {
    const lines = [
      base('reel_impression', {
        reel_id: 'a--intro',
        concept_id: 'a',
        slot: 0,
        pool: 'deepen',
        reason,
      }),
      base('reel_end', {
        reel_id: 'a--intro',
        concept_id: 'a',
        watched_ms: 30000,
        duration_ms: 30000,
        loops: 1,
        outcome: 'completed',
      }),
      base('reel_impression', {
        reel_id: 'b--intro',
        concept_id: 'b',
        slot: 1,
        pool: 'explore',
        reason,
      }),
      base('reel_end', {
        reel_id: 'b--intro',
        concept_id: 'b',
        watched_ms: 1000,
        duration_ms: 30000,
        loops: 0,
        outcome: 'early_skip',
      }),
      base('card_answered', {
        item_id: 'a--intro--q1',
        concept_id: 'a',
        choice_index: 0,
        correct: true,
        latency_ms: 4000,
        box_before: 0,
        box_after: 1,
        scheduled_gap_ms: null,
        actual_gap_ms: null,
        is_delayed: false,
      }),
      base('card_answered', {
        item_id: 'a--intro--q2',
        concept_id: 'a',
        choice_index: 1,
        correct: true,
        latency_ms: 5000,
        box_before: 1,
        box_after: 2,
        scheduled_gap_ms: 60000,
        actual_gap_ms: 70000,
        is_delayed: true,
      }),
      base('reel_first_frame', {
        reel_id: 'a--intro',
        playing_ms: 300,
        first_frame_ms: 0,
        cover_lifted_ms: 0,
        ready_at_activation: true,
        source: 'file',
        hz: 60,
      }),
      base('reel_first_frame', {
        reel_id: 'b--intro',
        playing_ms: 450,
        first_frame_ms: 200,
        cover_lifted_ms: 200,
        ready_at_activation: false,
        source: 'network',
        hz: 60,
      }),
      '{"type":"reel_end"}',
      'not json',
    ];
    const r = analyze(lines);
    expect(r.events).toBe(10);
    expect(r.invalid.map((x) => x.line)).toEqual([9, 10]);
    expect(r.sessions).toBe(1);
    expect(r.reelsPerSession).toBe(2);
    expect(r.completedRate).toBe(0.5);
    expect(r.earlySkipRate).toBe(0.5);
    expect(r.firstChecks).toEqual({ answered: 1, correct: 1 });
    expect(r.delayedReviews).toEqual({ answered: 1, correct: 1 });
    expect(r.learned).toBe(1);
    expect(r.start).toMatchObject({
      n: 2,
      playingP50: 300,
      playingP95: 450,
      readyAtActivation: 0.5,
      hzMedian: 60,
    });
    expect(format(r)).toContain('start p95 under 500 ms → PASS');
  });
});
