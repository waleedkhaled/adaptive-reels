import { LearnerState as LearnerStateSchema } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { displayState, mapChanges, mapCounts, markMapSeen, suggestions } from './map';
import { sampleProfile } from './sample';
import { createProfile, EMPTY_MASTERY } from './state';
import { T0 } from './testing/driver';
import { realCatalog } from './testing/fixtures';

const catalog = realCatalog();
const fresh = createProfile({ profileId: 'p', now: T0, seed: 1, topicIds: ['react-native'] });

describe('displayState (UX.md 9.11)', () => {
  it('fresh map: 6 Open roots, 34 Locked, nothing due or new', () => {
    const states = catalog.concepts.map((c) => displayState(c.id, fresh, catalog, T0));
    expect(states.filter((d) => !d.locked)).toHaveLength(6);
    expect(states.filter((d) => d.locked)).toHaveLength(34);
    expect(states.every((d) => d.level === 'none' && !d.due && !d.justUnlocked)).toBe(true);
  });

  it('levels: Seen from a reel end, Checked box 1, Learned box 2, Retained 3-4; due only from Checked up', () => {
    const s = {
      ...fresh,
      exposure: { caching: { first_at: T0, at_reel: 1, finished: ['caching--intro'] } },
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 3,
          due_at: T0 - 1,
          scheduled_at: T0 - 9,
          last_answered_at: T0 - 9,
        },
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 1,
          scheduled_at: T0 - 9,
          last_answered_at: T0 - 9,
        },
        'tokens-context-windows': {
          ...EMPTY_MASTERY,
          box: 0,
          retry: true,
          due_at: T0 - 1,
          scheduled_at: T0 - 9,
          last_answered_at: T0 - 9,
        },
      },
    };
    expect(displayState('caching', s, catalog, T0)).toMatchObject({ level: 'seen', due: false });
    expect(displayState('rn-core-components', s, catalog, T0)).toMatchObject({
      level: 'retained',
      due: true,
    });
    expect(displayState('react-components-props', s, catalog, T0)).toMatchObject({
      level: 'checked',
      due: false,
    });
    expect(displayState('react-components-props', s, catalog, T0 + 1)).toMatchObject({ due: true });
    expect(displayState('tokens-context-windows', s, catalog, T0)).toMatchObject({
      level: 'seen',
      due: false,
    });
  });

  it('just opened until the next map visit; unlocks are sticky', () => {
    const s = {
      ...fresh,
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 1,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
      unlocked: { 'rn-flexbox-layout': { at: T0, by: 'rn-core-components' } },
    };
    expect(displayState('rn-flexbox-layout', s, catalog, T0)).toMatchObject({
      locked: false,
      justUnlocked: true,
    });
    const visited = markMapSeen(s, catalog, T0 + 5);
    expect(displayState('rn-flexbox-layout', visited, catalog, T0)).toMatchObject({
      locked: false,
      justUnlocked: false,
    });
    const lapsed = {
      ...visited,
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 1,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
    };
    expect(displayState('rn-flexbox-layout', lapsed, catalog, T0).locked).toBe(false);
  });
});

describe('suggestions (UX.md 3.5)', () => {
  it('fresh map: Core components first, opening 6', () => {
    const top = suggestions(fresh, catalog, T0);
    expect(top[0]).toEqual({ conceptId: 'rn-core-components', kind: 'opens', opens: 6 });
    expect(top).toHaveLength(3);
    // Ties at 3 opens go to topic interest, then rail order.
    expect(top.slice(1).map((s) => s.opens)).toEqual([3, 3]);
  });

  it('due now, then just opened, then opens the most', () => {
    const s = {
      ...fresh,
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 99_999,
          scheduled_at: T0,
          last_answered_at: T0,
        },
        caching: {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 - 1,
          scheduled_at: T0 - 9,
          last_answered_at: T0 - 9,
        },
      },
      unlocked: {
        'rn-flexbox-layout': { at: T0, by: 'rn-core-components' },
        'rn-navigation': { at: T0, by: 'rn-core-components' },
      },
    };
    expect(suggestions(s, catalog, T0).map((x) => `${x.kind}:${x.conceptId}`)).toEqual([
      'due:caching',
      'new:rn-flexbox-layout',
      'new:rn-navigation',
    ]);
  });
});

describe('map snapshot and counts', () => {
  it('changes since the last visit: level changes, new Seen dots, unlocks, staged topic', () => {
    const s = {
      ...fresh,
      exposure: { caching: { first_at: T0, at_reel: 1, finished: ['caching--intro'] } },
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 1,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
      unlocked: { 'rn-flexbox-layout': { at: T0, by: 'rn-core-components' } },
    };
    expect(mapChanges(s, catalog)).toEqual({
      levelChanged: ['rn-core-components'],
      seenAdded: ['caching'],
      unlocked: ['rn-flexbox-layout'],
      stagedTopicId: 'react-native',
    });
    expect(mapChanges(markMapSeen(s, catalog, T0), catalog)).toEqual({
      levelChanged: [],
      seenAdded: [],
      unlocked: [],
      stagedTopicId: null,
    });
  });

  it('counts learned, watched, open and due per topic', () => {
    const s = sampleProfile('day3', { profileId: 'p', now: T0, seed: 1 }, catalog);
    const counts = mapCounts(s, catalog, T0);
    expect(counts).toMatchObject({ learned: 2, watched: 10, total: 40 });
    const rn = counts.topics.find((t) => t.topicId === 'react-native')!;
    expect(rn).toMatchObject({ learned: 1, open: 6, due: 1, total: 8 });
  });
});

describe('sample profiles (UX.md 3.8)', () => {
  it('Day 3 and Week 2 load with the listed states and parse', () => {
    const day3 = sampleProfile('day3', { profileId: 'p', now: T0, seed: 1 }, catalog);
    expect(LearnerStateSchema.safeParse(day3).success).toBe(true);
    expect(day3.sample).toBe('day3');
    const d = (id: string) => displayState(id, day3, catalog, T0);
    expect(d('react-components-props')).toMatchObject({ level: 'learned', due: true });
    expect(d('rn-flexbox-layout')).toMatchObject({ level: 'checked', due: true });
    expect(d('react-memoization')).toMatchObject({ level: 'seen', locked: true });
    const week2 = sampleProfile('week2', { profileId: 'p', now: T0, seed: 1 }, catalog);
    expect(LearnerStateSchema.safeParse(week2).success).toBe(true);
    const w = (id: string) => displayState(id, week2, catalog, T0);
    expect(w('rn-core-components')).toMatchObject({ level: 'retained', due: false });
    expect(w('tokens-context-windows')).toMatchObject({ level: 'retained', due: true });
    expect(w('rn-performance-rerenders')).toMatchObject({ level: 'checked', locked: true });
    expect(mapCounts(week2, catalog, T0).learned).toBe(7);
    expect(mapChanges(week2, catalog).levelChanged).toEqual([]);
  });
});
