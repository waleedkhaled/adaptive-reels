import type { LearnerState } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { applyAnswerRule } from './mastery';
import { cardOptions, chooseReel, chooseReteachReel, pickItem } from './items';
import { createProfile, masteryOf } from './state';
import { fixtureCatalog, realCatalog } from './testing/fixtures';

const NOW = 1_791_000_000_000;
const real = realCatalog();
const catalog = fixtureCatalog();

function answered(
  state: LearnerState,
  conceptId: string,
  itemId: string,
  now: number,
): LearnerState {
  const m = applyAnswerRule(masteryOf(state, conceptId), {
    correct: true,
    now,
    clock: 'demo',
    proveIt: false,
    itemId,
  }).mastery;
  return {
    ...state,
    mastery: { ...state.mastery, [conceptId]: m },
    items: {
      ...state.items,
      [itemId]: { shown: (state.items[itemId]?.shown ?? 0) + 1, answered_at: now },
    },
  };
}

describe('the item rule (UX.md 3.3)', () => {
  it('six consecutive cards on one concept never repeat the previous item', () => {
    for (let seed = 0; seed < 25; seed++) {
      let state = createProfile({ profileId: 'p', now: NOW, seed, clock: 'demo' });
      state = {
        ...state,
        exposure: {
          'rn-core-components': {
            first_at: NOW,
            at_reel: 1,
            finished: ['rn-core-components--intro'],
          },
        },
      };
      let previous: string | null = null;
      for (let card = 0; card < 6; card++) {
        const item = pickItem(state, real, 'rn-core-components', card)!;
        expect(item.id).not.toBe(previous);
        expect(item.conceptId).toBe('rn-core-components');
        previous = item.id;
        state = answered(state, 'rn-core-components', item.id, NOW + card * 60_000);
      }
    }
  });

  it('draws from finished reels, least recently answered first, never answered winning', () => {
    let state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    state = {
      ...state,
      exposure: {
        'rn-core-components': {
          first_at: NOW,
          at_reel: 1,
          finished: ['rn-core-components--example'],
        },
      },
    };
    const first = pickItem(state, real, 'rn-core-components', 0)!;
    expect(first.reelId).toBe('rn-core-components--example');
    state = answered(state, 'rn-core-components', first.id, NOW);
    const second = pickItem(state, real, 'rn-core-components', 1)!;
    expect(second.reelId).toBe('rn-core-components--example');
    expect(second.id).not.toBe(first.id);
    state = answered(state, 'rn-core-components', second.id, NOW + 1);
    // Both answered: the older one comes back, never the previous one.
    expect(pickItem(state, real, 'rn-core-components', 2)!.id).toBe(first.id);
  });

  it('falls back to the least recently answered item of any angle when no finished reel qualifies', () => {
    const state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    const item = pickItem(state, catalog, 'a1', 0)!;
    expect(['a1--intro--q1', 'a1--example--q1', 'a1--pitfall--q1']).toContain(item.id);
  });

  it('prove-it: an angle other than the reel on screen, pitfall first', () => {
    const state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    expect(pickItem(state, real, 'caching', 0, 'caching--intro')!.reelId).toBe('caching--pitfall');
    expect(pickItem(state, real, 'caching', 0, 'caching--pitfall')!.reelId).toBe(
      'caching--example',
    );
    // The concept with 2 reels (no example in the library).
    expect(
      pickItem(state, real, 'llm-unreliable-dependency', 0, 'llm-unreliable-dependency--pitfall')!
        .reelId,
    ).toBe('llm-unreliable-dependency--intro');
  });

  it('items of reels missing from the manifest do not exist', () => {
    const state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    for (let i = 0; i < 20; i++) {
      expect(pickItem(state, real, 'llm-unreliable-dependency', i)!.reelId).not.toBe(
        'llm-unreliable-dependency--example',
      );
    }
  });
});

describe('options (UX.md 3.3)', () => {
  it('always include the correct answer: 3 at box 0 (one distractor dropped), 4 from box 1', () => {
    for (const item of [...real.itemById.values()].slice(0, 60)) {
      for (let presentation = 0; presentation < 5; presentation++) {
        const three = cardOptions(9, item, presentation, 0);
        expect(three).toHaveLength(3);
        expect(three).toContain(item.answerIndex);
        expect(new Set(three).size).toBe(3);
        const four = cardOptions(9, item, presentation, 2);
        expect([...four].sort()).toEqual([0, 1, 2, 3]);
      }
    }
  });

  it('drop every distractor sometimes, and reshuffle per presentation', () => {
    const item = real.itemById.get('rn-core-components--intro--q1')!;
    const dropped = new Set<number>();
    const firsts = new Set<number>();
    for (let p = 0; p < 60; p++) {
      const shown = cardOptions(3, item, p, 0);
      dropped.add([0, 1, 2, 3].find((i) => !shown.includes(i))!);
      firsts.add(shown[0]!);
    }
    expect([...dropped].sort()).toEqual([1, 2, 3]);
    expect(firsts.size).toBe(4); // every option leads in some presentation
    expect(cardOptions(3, item, 7, 0)).toEqual(cardOptions(3, item, 7, 0));
  });
});

describe('which reel of a concept', () => {
  it('intro, example, pitfall; the pitfall after "Too easy"; never twice per session', () => {
    const concept = real.conceptById.get('caching')!;
    let state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    expect(chooseReel(state, concept, new Set())!.angle).toBe('intro');
    state = { ...state, reels: { 'caching--intro': { shown: 1, last_ordinal: 0, last_at: NOW } } };
    expect(chooseReel(state, concept, new Set(['caching--intro']))!.angle).toBe('example');
    const tooEasy = { ...state, pending: { ...state.pending, pitfall_next: ['caching'] } };
    expect(chooseReel(tooEasy, concept, new Set(['caching--intro']))!.angle).toBe('pitfall');
    expect(chooseReel(state, concept, new Set(concept.reels.map((r) => r.id)))).toBeNull();
    // Next session: the least recently shown comes back.
    const all = {
      ...state,
      reels: {
        'caching--intro': { shown: 1, last_ordinal: 5, last_at: NOW },
        'caching--example': { shown: 1, last_ordinal: 2, last_at: NOW },
        'caching--pitfall': { shown: 1, last_ordinal: 9, last_at: NOW },
      },
    };
    expect(chooseReel(all, concept, new Set())!.angle).toBe('example');
  });

  it('reteach: an unplayed angle, else the same reel the question came from', () => {
    let state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    state = { ...state, reels: { 'caching--intro': { shown: 1, last_ordinal: 0, last_at: NOW } } };
    expect(chooseReteachReel(state, real, 'caching', 'caching--intro')).toMatchObject({
      reel: { id: 'caching--example' },
      replay: false,
    });
    state = {
      ...state,
      reels: {
        'caching--intro': { shown: 1, last_ordinal: 0, last_at: NOW },
        'caching--example': { shown: 1, last_ordinal: 1, last_at: NOW },
        'caching--pitfall': { shown: 1, last_ordinal: 2, last_at: NOW },
      },
    };
    expect(chooseReteachReel(state, real, 'caching', 'caching--example')).toMatchObject({
      reel: { id: 'caching--example' },
      replay: true,
    });
  });
});
