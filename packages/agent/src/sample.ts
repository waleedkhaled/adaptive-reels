// Sample profiles (UX.md 3.8): shared fixtures for the app and the tests. Each
// due time is an offset from load time. They describe the real curriculum;
// concepts missing from the catalog are skipped.
import type { ConceptMastery, LearnerState } from '@reels/schemas';
import type { Catalog } from './catalog';
import { markMapSeen } from './map';
import { createProfile, intervalMs, type CreateProfileInput } from './state';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Spec = Record<string, { box: number; due: number } | 'seen'>;

export const SAMPLE_PROFILES = {
  fresh: {} as Spec,
  day3: {
    'rn-core-components': { box: 2, due: DAY },
    'react-components-props': { box: 2, due: -2 * HOUR },
    'rn-flexbox-layout': { box: 1, due: -5 * MIN },
    'react-state': { box: 1, due: 6 * MIN },
    'tokens-context-windows': { box: 1, due: 8 * MIN },
    'rn-lists-virtualization': 'seen',
    'rn-navigation': 'seen',
    caching: 'seen',
    'reproduce-before-fixing': 'seen',
    'react-memoization': 'seen',
  } as Spec,
  week2: {
    'rn-core-components': { box: 4, due: 5 * DAY },
    'react-components-props': { box: 3, due: 2 * DAY },
    'tokens-context-windows': { box: 3, due: -HOUR },
    'rn-flexbox-layout': { box: 2, due: DAY },
    'react-state': { box: 2, due: DAY },
    'break-down-problems': { box: 2, due: DAY },
    caching: { box: 2, due: -3 * HOUR },
    'rn-lists-virtualization': { box: 1, due: -10 * MIN },
    'prompting-basics': { box: 1, due: 4 * MIN },
    'ts-typing-props': { box: 1, due: 6 * MIN },
    'rn-performance-rerenders': { box: 1, due: 7 * MIN },
    'rn-navigation': 'seen',
    'react-effects': 'seen',
    'react-memoization': 'seen',
    hallucinations: 'seen',
    'time-complexity': 'seen',
    'queues-async-work': 'seen',
  } as Spec,
} as const;

export type SampleProfileName = keyof typeof SAMPLE_PROFILES;

/** Build a sample profile at `input.now`; it shows "Sample data" until Reset. */
export function sampleProfile(
  name: SampleProfileName,
  input: CreateProfileInput,
  catalog: Catalog,
): LearnerState {
  const now = input.now;
  let state = createProfile({ ...input, skipped: input.skipped ?? true });
  const clock = state.settings.clock;
  const mastery: Record<string, ConceptMastery> = {};
  const exposure: LearnerState['exposure'] = {};
  for (const [id, spec] of Object.entries(SAMPLE_PROFILES[name])) {
    const concept = catalog.conceptById.get(id);
    if (!concept) continue;
    const intro = concept.reels[0];
    exposure[id] = { first_at: now - DAY, at_reel: 0, finished: intro ? [intro.id] : [] };
    if (spec === 'seen') continue;
    const dueAt = now + spec.due;
    const scheduledAt = dueAt - intervalMs(clock, spec.box, false);
    mastery[id] = {
      box: spec.box,
      due_at: dueAt,
      scheduled_at: scheduledAt,
      retry: false,
      last_answered_at: scheduledAt,
      correct_count: spec.box,
      wrong_count: 0,
      last_item_id: null,
    };
  }
  state = { ...state, sample: name, mastery, exposure };
  // Unlocks follow from what is Learned, in prerequisite order (sticky from here on).
  const unlocked: LearnerState['unlocked'] = {};
  const learned = (id: string) => (mastery[id]?.box ?? 0) >= 2;
  let changed = true;
  while (changed) {
    changed = false;
    for (const concept of catalog.concepts) {
      if (concept.isRoot || unlocked[concept.id]) continue;
      if (concept.prereqs.every(learned)) {
        const by = concept.prereqs[concept.prereqs.length - 1] as string;
        unlocked[concept.id] = { at: now, by };
        changed = true;
      }
    }
  }
  return markMapSeen({ ...state, unlocked }, catalog, now);
}
