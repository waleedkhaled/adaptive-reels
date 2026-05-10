import { LearnerState as LearnerStateSchema } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { createProfile } from './state';
import { persona, simulate, type Persona } from './simulate';
import { startGapSession } from './queue';
import { sampleProfile } from './sample';
import { T0 } from './testing/driver';
import { realCatalog } from './testing/fixtures';

const catalog = realCatalog();
const topicOf = (id: string | null) => (id ? catalog.conceptById.get(id)!.topicId : '');
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('personas (PLAN M4 and M6 acceptance, in simulation)', () => {
  for (const mode of ['light', 'focus'] as const) {
    it(`${mode}, demo clock: "likes AI engineering" gets at least twice the AI share of "skips AI engineering" over 30 slots`, () => {
      const share = (id: string, seed: number) => {
        const run = simulate({
          catalog,
          persona: persona(id),
          mode,
          clock: 'demo',
          seed,
          start: T0,
          slots: 30,
        });
        return run.rows.filter((r) => topicOf(r.item.conceptId) === 'ai-engineering').length / 30;
      };
      const seeds = [0, 1, 2, 3, 4, 5];
      const likes = mean(seeds.map((s) => share('likes-ai-engineering', s)));
      const skips = mean(seeds.map((s) => share('skips-ai-engineering', s)));
      expect(likes).toBeGreaterThanOrEqual(2 * skips);
    });
  }

  it('Focus serves more cards plus Deepen than Light over 40 slots', () => {
    const share = (mode: 'light' | 'focus', seed: number) => {
      const run = simulate({
        catalog,
        persona: persona('curious'),
        mode,
        clock: 'real',
        seed,
        start: T0,
        slots: 40,
      });
      return run.rows.filter((r) => r.item.kind === 'card' || r.item.pool === 'deepen').length / 40;
    };
    const seeds = [0, 1, 2, 3, 4];
    expect(mean(seeds.map((s) => share('focus', s)))).toBeGreaterThan(
      1.2 * mean(seeds.map((s) => share('light', s))),
    );
  });

  it('a watch-only session (every question put off) leaves mastery untouched', () => {
    const watcher: Persona = {
      ...persona('curious'),
      id: 'watcher',
      onCard: () => ({ correct: true, thinkMs: 2_000, later: true }),
    };
    for (const clock of ['real', 'demo'] as const) {
      const run = simulate({
        catalog,
        persona: watcher,
        mode: 'focus',
        clock,
        seed: 8,
        start: T0,
        slots: 40,
      });
      expect(run.rows.some((r) => r.item.kind === 'card')).toBe(true);
      expect(run.state.mastery).toEqual({});
      expect(Object.keys(run.state.exposure).length).toBeGreaterThan(0);
    }
  });

  it('the same seed gives the same sequence; another seed gives another', () => {
    const run = (seed: number) =>
      simulate({
        catalog,
        persona: persona('skipper'),
        mode: 'light',
        clock: 'real',
        seed,
        start: T0,
        slots: 30,
      }).rows.map((r) => r.item.key);
    expect(run(21)).toEqual(run(21));
    expect(run(21)).not.toEqual(run(22));
  });

  it('the demo persona closes the loop on the demo clock', () => {
    const run = simulate({
      catalog,
      persona: persona('demo'),
      mode: 'focus',
      clock: 'demo',
      seed: 14,
      start: T0,
      slots: 6,
    });
    expect(run.rows.map((r) => r.item.reason?.code)).toEqual([
      'DEEPEN_INTEREST',
      'MORE_LIKE_THIS',
      'FIRST_CHECK',
      'EXPLORE_NEW',
      'EXPLORE_NEW',
      'REVIEW_DUE',
    ]);
    expect(run.state.session.learned).toEqual(['rn-core-components']);
  });

  it('rejects an unknown persona', () => {
    expect(() => persona('nobody')).toThrow();
  });
});

describe('LearnerState is plain JSON and matches its schema', () => {
  const roundTrip = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

  it('createProfile output parses, in both clocks', () => {
    for (const clock of ['real', 'demo'] as const) {
      const state = createProfile({
        profileId: 'p',
        now: T0,
        seed: 14,
        topicIds: ['react-native'],
        clock,
      });
      const parsed = LearnerStateSchema.safeParse(state);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
      expect(roundTrip(state)).toEqual(state);
    }
  });

  it('states after simulated sessions parse and survive a JSON round trip', () => {
    for (const id of [
      'demo',
      'curious',
      'skipper',
      'struggler',
      'too-easy',
      'likes-react-native',
    ]) {
      for (const clock of ['real', 'demo'] as const) {
        const run = simulate({
          catalog,
          persona: persona(id),
          mode: 'focus',
          clock,
          seed: 3,
          start: T0,
          slots: 35,
        });
        const parsed = LearnerStateSchema.safeParse(run.state);
        expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
        expect(roundTrip(run.state)).toEqual(run.state);
      }
    }
  });

  it('a state in a gap session parses, and so do the sample profiles', () => {
    const state = createProfile({ profileId: 'p', now: T0, seed: 1, topicIds: ['react-native'] });
    const gap = startGapSession(state, catalog, { targetId: 'rn-performance-rerenders' }, T0);
    expect(LearnerStateSchema.safeParse(gap.state).success).toBe(true);
    for (const name of ['fresh', 'day3', 'week2'] as const) {
      expect(
        LearnerStateSchema.safeParse(
          sampleProfile(name, { profileId: 'p', now: T0, seed: 1 }, catalog),
        ).success,
      ).toBe(true);
    }
  });
});
