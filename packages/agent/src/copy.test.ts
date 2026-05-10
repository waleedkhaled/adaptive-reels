import type { FeedItem, Reason, ReasonCode } from '@reels/schemas';
import { ReasonCode as ReasonCodeSchema } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import {
  changedMarker,
  confirmationText,
  dockContent,
  explanationSuffix,
  formatCount,
  formatCountdown,
  formatElapsed,
  formatInterval,
  gapCounter,
  leadWord,
  needsLine,
  plain,
  progressChange,
  progressConsequence,
  railWord,
  reasonDetail,
  reasonSentence,
  runningHead,
  stateLongForm,
  stripText,
  summaryText,
  triggerLine,
} from './copy';
import { displayState, suggestions } from './map';
import type { AnswerResult } from './queue';
import { createProfile, EMPTY_MASTERY } from './state';
import { T0 } from './testing/driver';
import { realCatalog } from './testing/fixtures';

const catalog = realCatalog();
const R = (code: ReasonCode, params: Record<string, string> = {}): Reason => ({ code, params });
const item = (pool: FeedItem['pool'], reason: Reason): Pick<FeedItem, 'pool' | 'reason'> => ({
  pool,
  reason,
});

/** Every row, variant and trigger line of UX.md 5.1 (not the ReasonCode enum). */
const ROWS: {
  name: string;
  reason: Reason;
  kind?: 'reel' | 'card';
  pool: FeedItem['pool'];
  strip: string;
  strong: string[];
  detail: string[];
  trigger?: string;
  ctx?: { now?: number; nextDueAt?: number | null };
}[] = [
  {
    name: 'REVIEW_DUE box 1',
    reason: R('REVIEW_DUE', { concept: 'rn-core-components', box: '1', elapsed_ms: '69000' }),
    kind: 'card',
    pool: null,
    strip: 'Review. Answered Core components 1m 09s ago.',
    strong: ['Core components'],
    detail: ['Reviews come back after growing gaps. Correct now: Learned.'],
  },
  {
    name: 'REVIEW_DUE box 2+',
    reason: R('REVIEW_DUE', { concept: 'rn-core-components', box: '2', elapsed_ms: '185000' }),
    kind: 'card',
    pool: 'review',
    strip: 'Review. Learned Core components 3m 05s ago.',
    strong: ['Core components'],
    detail: ['Reviews come back after growing gaps. Correct now: Retained.'],
  },
  {
    name: 'REVIEW_DUE retry',
    reason: R('REVIEW_DUE', {
      concept: 'rn-core-components',
      box: '0',
      retry: 'true',
      elapsed_ms: '30000',
    }),
    kind: 'card',
    pool: null,
    strip: 'Review. Second try: Core components.',
    strong: ['Core components'],
    detail: ['Your last answer was wrong. Correct now: Checked.'],
  },
  {
    name: 'REVIEW_DUE after Too easy',
    reason: R('REVIEW_DUE', {
      concept: 'rn-core-components',
      box: '1',
      elapsed_ms: '70000',
      trigger: 'too_easy',
    }),
    kind: 'card',
    pool: null,
    strip: 'Review. Answered Core components 1m 10s ago.',
    strong: ['Core components'],
    detail: ['Reviews come back after growing gaps. Correct now: Learned.'],
    trigger: 'You tapped Too easy.',
  },
  {
    name: 'FIRST_CHECK',
    reason: R('FIRST_CHECK', { concept: 'rn-core-components', reels_ago: '2' }),
    kind: 'card',
    pool: null,
    strip: 'First check: Core components.',
    strong: ['Core components'],
    detail: ['You watched this 2 reels ago. Correct: Checked. Correct again later: Learned.'],
  },
  {
    name: 'FIRST_CHECK after Later',
    reason: R('FIRST_CHECK', {
      concept: 'rn-core-components',
      reels_ago: '4',
      trigger: 'later',
      later_reels: '2',
    }),
    kind: 'card',
    pool: null,
    strip: 'First check: Core components.',
    strong: ['Core components'],
    detail: ['You watched this 4 reels ago. Correct: Checked. Correct again later: Learned.'],
    trigger: 'You tapped Later 2 reels ago.',
  },
  {
    name: 'RETEACH',
    reason: R('RETEACH', { concept: 'caching', trigger: 'wrong_answer' }),
    pool: null,
    strip: 'Another angle. Your last answer here was wrong.',
    strong: ['wrong'],
    detail: ['A new question on this follows.'],
  },
  {
    name: 'PROVE_IT box 0',
    reason: R('PROVE_IT', { concept: 'caching', box: '0', trigger: 'too_easy' }),
    kind: 'card',
    pool: null,
    strip: 'You said too easy. One question.',
    strong: ['too easy'],
    detail: [
      'Correct: Checked, then a later check. Wrong: it stays Seen and another angle follows.',
    ],
  },
  {
    name: 'PROVE_IT box 1+',
    reason: R('PROVE_IT', {
      concept: 'caching',
      box: '1',
      due_at: String(T0 + 42_000),
      trigger: 'too_easy',
    }),
    kind: 'card',
    pool: null,
    strip: 'You said too easy. One question.',
    strong: ['too easy'],
    detail: [
      'Correct changes nothing before 0:42. Wrong: it drops one level and another angle follows.',
    ],
    ctx: { now: T0 },
  },
  {
    name: 'DEEPEN_UNLOCKED',
    reason: R('DEEPEN_UNLOCKED', {
      concept: 'rn-flexbox-layout',
      prereq: 'rn-core-components',
      topic: 'react-native',
    }),
    pool: 'deepen',
    strip: 'Deepen. Unlocked by Core components.',
    strong: ['Core components'],
    detail: ['You learned Core components, which this builds on.'],
  },
  {
    name: 'DEEPEN_INTEREST watched',
    reason: R('DEEPEN_INTEREST', { topic: 'react-native', cause: 'watched' }),
    pool: 'deepen',
    strip: 'Deepen. You keep watching React Native.',
    strong: ['React Native'],
    detail: ['You watched or liked React Native reels.'],
  },
  {
    name: 'DEEPEN_INTEREST picked',
    reason: R('DEEPEN_INTEREST', { topic: 'react-native', cause: 'picked' }),
    pool: 'deepen',
    strip: 'Deepen. From a topic you picked: React Native.',
    strong: ['React Native'],
    detail: ['You picked React Native at the start.'],
  },
  {
    name: 'DEEPEN_INTEREST default',
    reason: R('DEEPEN_INTEREST', { topic: 'react-typescript', cause: 'default' }),
    pool: 'deepen',
    strip: 'Deepen. Starting with React + TS.',
    strong: ['React + TS'],
    detail: ['You have not finished a React + TS reel yet.'],
  },
  {
    name: 'EXPLORE_NEW 0 seen',
    reason: R('EXPLORE_NEW', { topic: 'ai-engineering', seen: '0' }),
    pool: 'explore',
    strip: 'Explore. New topic: AI engineering.',
    strong: ['AI engineering'],
    detail: ['You have seen 0 reels in AI engineering.'],
  },
  {
    name: 'EXPLORE_NEW 1 seen',
    reason: R('EXPLORE_NEW', { topic: 'ai-engineering', seen: '1' }),
    pool: 'explore',
    strip: 'Explore. A topic you have barely seen: AI engineering.',
    strong: ['AI engineering'],
    detail: ['You have seen 1 reel in AI engineering.'],
  },
  {
    name: 'LATERAL_RELATED',
    reason: R('LATERAL_RELATED', {
      concept: 'react-components-props',
      source: 'rn-core-components',
    }),
    pool: 'lateral',
    strip: 'Lateral. Related to Core components.',
    strong: ['Core components'],
    detail: ['Core components is linked to this on the map and you liked it recently.'],
  },
  {
    name: 'LATERAL_BRIDGE',
    reason: R('LATERAL_BRIDGE', {
      concept: 'prompting-basics',
      target: 'tool-use-agents',
      source: 'x',
    }),
    pool: 'lateral',
    strip: 'Lateral. Builds toward Tool use and agents.',
    strong: ['Tool use and agents'],
    detail: [
      'Tool use and agents is related to something you liked but is locked. This is its first open prerequisite.',
    ],
  },
  {
    name: 'MORE_LIKE_THIS',
    reason: R('MORE_LIKE_THIS', {
      source: 'rn-core-components',
      concept: 'react-components-props',
      trigger: 'more_like_this',
    }),
    pool: null,
    strip: 'Because you tapped More like this.',
    strong: ['More like this'],
    detail: ['The closest related concept to Core components.'],
  },
  {
    name: 'CHANGE_OF_PACE',
    reason: R('CHANGE_OF_PACE', { topic: 'caching', trigger: 'skips' }),
    pool: 'explore',
    strip: 'Explore. Two quick skips. Trying something else.',
    strong: ['Two quick skips'],
    detail: ['You left the last two reels early.'],
  },
  {
    name: 'GAP_SESSION reel',
    reason: R('GAP_SESSION', {
      target: 'rn-flexbox-layout',
      concept: 'rn-core-components',
      step: '1',
      steps: '2',
    }),
    pool: null,
    strip: 'Gap session toward Flexbox layout.',
    strong: ['Flexbox layout'],
    detail: ['You started this from the map. Step 1 of 2 toward Flexbox layout.'],
  },
  {
    name: 'GAP_SESSION card',
    reason: R('GAP_SESSION', {
      target: 'rn-flexbox-layout',
      concept: 'rn-core-components',
      step: '1',
      steps: '2',
    }),
    kind: 'card',
    pool: null,
    strip: 'Gap session check: Core components.',
    strong: ['Core components'],
    detail: ['You started this from the map. Step 1 of 2 toward Flexbox layout.'],
  },
  {
    name: 'FALLBACK',
    reason: R('FALLBACK'),
    pool: null,
    strip: 'Next unlocked reel. Nothing is due.',
    strong: [],
    detail: ['Reviews open more concepts when they come due.'],
  },
  {
    name: 'FALLBACK with a review scheduled',
    reason: R('FALLBACK'),
    pool: null,
    strip: 'Next unlocked reel. Nothing is due.',
    strong: [],
    detail: ['Reviews open more concepts when they come due.', 'Next one in 0:42.'],
    ctx: { now: T0, nextDueAt: T0 + 42_000 },
  },
  {
    name: 'item after Not for me',
    reason: R('EXPLORE_NEW', { topic: 'caching', seen: '0', trigger: 'not_for_me' }),
    pool: 'explore',
    strip: 'Explore. New topic: caching.',
    strong: ['caching'],
    detail: ['You have seen 0 reels in caching.'],
    trigger: 'Re-planned after Not for me.',
  },
];

describe('reason strings (UX.md 5.1)', () => {
  for (const row of ROWS) {
    it(row.name, () => {
      const full = { ...item(row.pool, row.reason), kind: row.kind ?? 'reel' } as FeedItem;
      expect(stripText(full, catalog)).toBe(row.strip);
      expect(
        reasonSentence(row.reason, catalog, row.kind)
          .filter((s) => s.strong)
          .map((s) => s.text),
      ).toEqual(row.strong);
      expect(reasonDetail(row.reason, catalog, row.ctx)).toEqual(row.detail);
      expect(triggerLine(row.reason)).toBe(row.trigger ?? null);
    });
  }

  it('covers every code in ReasonCode', () => {
    expect(new Set(ROWS.map((r) => r.reason.code))).toEqual(new Set(ReasonCodeSchema.options));
  });

  it('lead words: the logged pool, and Review on every REVIEW_DUE', () => {
    expect(leadWord(item('deepen', R('DEEPEN_INTEREST')))).toBe('Deepen');
    expect(leadWord(item(null, R('REVIEW_DUE')))).toBe('Review');
    expect(leadWord(item(null, R('FIRST_CHECK')))).toBeNull();
  });

  it('changed marker: the lead word, else the span naming the action', () => {
    expect(changedMarker(item(null, R('MORE_LIKE_THIS', { trigger: 'more_like_this' })))).toEqual({
      target: 'span',
      text: 'More like this',
    });
    expect(changedMarker(item(null, R('PROVE_IT', { trigger: 'too_easy' })))).toEqual({
      target: 'span',
      text: 'too easy',
    });
    expect(changedMarker(item(null, R('RETEACH', { trigger: 'wrong_answer' })))).toEqual({
      target: 'span',
      text: 'wrong',
    });
    expect(changedMarker(item('explore', R('CHANGE_OF_PACE', { trigger: 'skips' })))).toEqual({
      target: 'lead',
    });
    expect(changedMarker(item(null, R('REVIEW_DUE', { trigger: 'too_easy' })))).toEqual({
      target: 'lead',
    });
    expect(changedMarker(item('deepen', R('DEEPEN_INTEREST', { trigger: 'not_for_me' })))).toEqual({
      target: 'lead',
    });
    expect(changedMarker(item(null, R('FALLBACK', { trigger: 'not_for_me' })))).toBeNull();
    expect(changedMarker(item('deepen', R('DEEPEN_INTEREST')))).toBeNull();
  });

  it('keeps every strip within 64 characters with the longest concept title (36), except one demo-clock case', () => {
    const longest = 'llm-unreliable-dependency';
    const overs: string[] = [];
    for (const row of ROWS) {
      const params = { ...row.reason.params };
      for (const k of ['concept', 'prereq', 'target', 'source']) if (params[k]) params[k] = longest;
      if (params.topic) params.topic = 'problem-solving';
      if (params.elapsed_ms) params.elapsed_ms = '299000'; // the longest elapsed: "4m 59s"
      const text = stripText(
        {
          ...item(row.pool, { code: row.reason.code, params }),
          kind: row.kind ?? 'reel',
        } as FeedItem,
        catalog,
      );
      if (text.length > 64) overs.push(`${text.length}: ${text}`);
    }
    // Two rows (box 1, and box 1 after Too easy) render the same strip.
    // "Review. Answered {36} 4m 59s ago." is 65: only on the demo clock (a box-1 review within 5 minutes).
    expect([...new Set(overs)]).toEqual([
      '65: Review. Answered LLM calls as unreliable dependencies 4m 59s ago.',
    ]);
  });
});

describe('formats (UX.md 5)', () => {
  it('elapsed, countdown, interval, count', () => {
    expect(formatCount(1, 40)).toBe('1/40');
    expect(
      [45_000, 66_000, 185_000, 540_000, 3 * 3_600_000, 2 * 86_400_000].map(formatElapsed),
    ).toEqual(['45s', '1m 06s', '3m 05s', '9m', '3h', '2d']);
    expect(
      [42_000, 41_200, 720_000, 3_723_000, 2 * 86_400_000 + 4 * 3_600_000, -5].map(formatCountdown),
    ).toEqual(['0:42', '0:42', '12:00', '1:02:03', '2d 4h', '0:00']);
    expect([20_000, 60_000, 600_000, 86_400_000, 3 * 86_400_000].map(formatInterval)).toEqual([
      '20 s',
      '1 min',
      '10 min',
      '1 day',
      '3 days',
    ]);
  });

  it('running head and rail lines', () => {
    expect(plain(runningHead(catalog, 'rn-core-components'))).toBe(
      'Core components in React Native',
    );
    expect(needsLine(catalog, 'rn-performance-rerenders', 'react-memoization')).toBe(
      '+ needs Memoization (React + TS)',
    );
    expect(needsLine(catalog, 'llm-unreliable-dependency', 'structured-output')).toBe(
      '+ needs Structured output (AI)',
    );
    expect(needsLine(catalog, 'binary-search-debugging', 'reproduce-before-fixing')).toBe(
      '+ needs Reproduce before fixing',
    );
    expect(gapCounter({ index: 2, total: 6 })).toBe('Item 2 of 6');
  });
});

describe('quick-action confirmations (UX.md 3.2)', () => {
  const base = {
    conceptId: 'rn-core-components',
    topicId: 'react-native',
    next: null,
    nextReel: { conceptId: 'react-components-props' } as never,
    cardFirst: false,
    countdownMs: null,
  };
  it('More like this, Too easy, Not for me', () => {
    expect(plain(confirmationText({ ...base, action: 'more_like_this' }, catalog))).toBe(
      'Next: Components and props.',
    );
    expect(
      plain(confirmationText({ ...base, action: 'more_like_this', cardFirst: true }, catalog)),
    ).toBe('After the question: Components and props.');
    expect(plain(confirmationText({ ...base, action: 'too_easy' }, catalog))).toBe(
      'Prove it: 1 question next.',
    );
    expect(
      plain(confirmationText({ ...base, action: 'too_easy', countdownMs: 42_000 }, catalog)),
    ).toBe('Prove it: 1 question next. It cannot count before 0:42.');
    expect(plain(confirmationText({ ...base, action: 'not_for_me' }, catalog))).toBe(
      'Hidden this session. Less React Native.',
    );
  });
});

describe('quiz feedback and progress panel (UX.md 5.3, 5.4)', () => {
  const result = (over: Partial<AnswerResult>): AnswerResult => ({
    conceptId: 'rn-core-components',
    itemId: 'x',
    correct: true,
    boxBefore: 0,
    boxAfter: 1,
    levelBefore: 'seen',
    levelAfter: 'checked',
    unlocked: [],
    scheduledGapMs: null,
    actualGapMs: null,
    isDelayed: false,
    nextDueAt: T0 + 60_000,
    early: false,
    promoted: true,
    proveIt: false,
    retry: false,
    reteach: null,
    rested: false,
    optionsOrder: [0, 1, 2],
    source: 'feed',
    gapEnded: null,
    ...over,
  });
  const line = (r: AnswerResult, clock: 'real' | 'demo' = 'demo') =>
    progressConsequence(r, catalog, clock, T0);

  it('every consequence line', () => {
    expect(line(result({}))).toBe('Back in about 1 min. Correct then: Learned.');
    expect(line(result({}), 'real')).toBe('Back in about 10 min. Correct then: Learned.');
    const six = [
      'rn-flexbox-layout',
      'rn-lists-virtualization',
      'rn-navigation',
      'rn-platform-code',
      'rn-new-architecture',
      'rn-expo-workflow',
    ];
    expect(line(result({ boxBefore: 1, boxAfter: 2, unlocked: six }))).toBe(
      '6 more open in React Native.',
    );
    expect(line(result({ boxBefore: 1, boxAfter: 2 }))).toBe('Next review in about 3 min.');
    expect(line(result({ boxBefore: 2, boxAfter: 3 }), 'real')).toBe(
      'Next review in about 3 days.',
    );
    expect(
      line(
        result({ boxBefore: 1, boxAfter: 1, early: true, promoted: false, nextDueAt: T0 + 42_000 }),
      ),
    ).toBe('Correct, but too soon to count. Back in 0:42.');
    const wrong = { correct: false, reteach: { reelId: 'r', replay: false }, promoted: false };
    expect(line(result({ ...wrong, boxBefore: 0, boxAfter: 0 }))).toBe(
      'Still Seen. Another angle is next.',
    );
    expect(line(result({ ...wrong, boxBefore: 1, boxAfter: 0 }))).toBe(
      'Checked to Seen. Another angle is next.',
    );
    expect(line(result({ ...wrong, boxBefore: 2, boxAfter: 1 }))).toBe(
      'Learned to Checked. What it opened stays open. Another angle is next.',
    );
    expect(line(result({ ...wrong, boxBefore: 3, boxAfter: 2 }))).toBe(
      'Retained to Learned. What it opened stays open. Another angle is next.',
    );
    expect(line(result({ ...wrong, boxBefore: 4, boxAfter: 3 }))).toBe(
      'Still Retained. What it opened stays open. Another angle is next.',
    );
    expect(
      line(result({ ...wrong, boxBefore: 0, boxAfter: 0, reteach: { reelId: 'r', replay: true } })),
    ).toBe('Still Seen. The same reel is next.');
    // Second miss this session (owner decision #8): no reteach, the concept rests.
    expect(line(result({ ...wrong, boxBefore: 1, boxAfter: 0, reteach: null, rested: true }))).toBe(
      'Checked to Seen. Moving on. It comes back next session.',
    );
  });

  it('verdict suffix and change line', () => {
    expect(explanationSuffix({ correct: true, reteach: null })).toBeNull();
    expect(explanationSuffix({ correct: false, reteach: { reelId: 'r', replay: false } })).toBe(
      'Another angle is next.',
    );
    expect(explanationSuffix({ correct: false, reteach: { reelId: 'r', replay: true } })).toBe(
      'The same reel is next.',
    );
    expect(explanationSuffix({ correct: false, reteach: null, rested: true })).toBe(
      'Moving on. It comes back next session.',
    );
    expect(progressChange({ levelBefore: 'seen', levelAfter: 'checked' })).toEqual({
      from: 'Seen',
      to: 'Checked',
    });
  });
});

describe('state labels (UX.md 5.2)', () => {
  it('rail words and long forms', () => {
    const s = {
      ...createProfile({ profileId: 'p', now: T0, seed: 1 }),
      exposure: { caching: { first_at: T0, at_reel: 1, finished: ['caching--intro'] } },
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 4,
          due_at: T0 + 9e6,
          scheduled_at: T0,
          last_answered_at: T0,
        },
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 - 1,
          scheduled_at: T0 - 9,
          last_answered_at: T0 - 9,
        },
        'tokens-context-windows': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 9e6,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
      unlocked: { 'rn-flexbox-layout': { at: T0, by: 'rn-core-components' } },
    };
    const word = (id: string) => railWord(displayState(id, s, catalog, T0));
    const long = (id: string) => stateLongForm(id, s, catalog, T0);
    expect(word('rn-core-components')).toBe('RETAINED');
    expect(long('rn-core-components')).toBe('Retained, box 4. 3 delayed reviews passed.');
    expect(word('react-components-props')).toBe('DUE');
    expect(long('react-components-props')).toBe('Due. Review now.');
    expect(long('tokens-context-windows')).toBe('Learned. Correct again after a delay.');
    expect(word('caching')).toBe('SEEN');
    expect(long('caching')).toBe('Seen. Watched, not answered.');
    expect(word('rn-flexbox-layout')).toBe('NEW');
    expect(long('rn-flexbox-layout')).toBe('Just opened.');
    expect(long('break-down-problems')).toBe('Open. Ready to start.');
    expect(long('rn-performance-rerenders')).toBe(
      'Locked. Needs Lists and virtualization, and Memoization.',
    );
    expect(long('react-state')).toBe('Locked. Needs Components and props.');
    const checked = {
      ...s,
      mastery: {
        ...s.mastery,
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 1,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
    };
    expect(stateLongForm('react-components-props', checked, catalog, T0)).toBe(
      'Checked. One correct answer.',
    );
  });
});

describe('map dock (UX.md 5.5)', () => {
  const fresh = createProfile({ profileId: 'p', now: T0, seed: 1, topicIds: ['react-native'] });
  const dock = (id: string, s = fresh, now = T0) => {
    const sug = suggestions(s, catalog, now).find((x) => x.conceptId === id) ?? null;
    return dockContent(id, s, catalog, now, sug);
  };
  it('fresh map: "Core components", "Opens 6 concepts"', () => {
    expect(dock('rn-core-components')).toEqual({
      reason: 'Opens 6 concepts',
      lines: [
        'Correct once: Checked. Again later: Learned.',
        '3 items: a reel, one more, a question.',
      ],
      button: { label: 'Start Core components', kind: 'primary' },
      countdownTo: null,
    });
    expect(dock('react-components-props').reason).toBe('Open');
  });

  it('due, Checked not due, Learned, Retained, Seen', () => {
    const s = {
      ...fresh,
      exposure: { caching: { first_at: T0, at_reel: 1, finished: ['caching--intro'] } },
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 - 66_000,
          scheduled_at: T0 - 126_000,
          last_answered_at: T0 - 126_000,
        },
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 42_000,
          scheduled_at: T0 - 18_000,
          last_answered_at: T0 - 18_000,
        },
        'tokens-context-windows': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 180_000,
          scheduled_at: T0,
          last_answered_at: T0,
        },
        'break-down-problems': {
          ...EMPTY_MASTERY,
          box: 3,
          due_at: T0 + 360_000,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
    };
    expect(dock('rn-core-components', s)).toEqual({
      reason: 'Review due now',
      lines: ['Due 1m 06s ago. Correct now makes it Learned.'],
      button: { label: 'Review now, 1 question', kind: 'primary' },
      countdownTo: null,
    });
    expect(dock('react-components-props', s)).toEqual({
      reason: 'Checked',
      lines: ['A later correct answer makes it Learned.', 'Answering early does not count.'],
      button: null,
      countdownTo: T0 + 42_000,
    });
    expect(dock('tokens-context-windows', s)).toMatchObject({
      reason: 'Learned',
      lines: ['Next review in 3:00.'],
      button: { label: 'Rewatch a reel', kind: 'secondary' },
    });
    expect(dock('break-down-problems', s).reason).toBe('Retained, box 3');
    expect(dock('caching', s).reason).toBe('Seen, not answered');
  });

  it('just opened, and the locked rows', () => {
    const learnedCore = {
      ...fresh,
      mastery: {
        'rn-core-components': {
          ...EMPTY_MASTERY,
          box: 2,
          due_at: T0 + 180_000,
          scheduled_at: T0,
          last_answered_at: T0,
        },
      },
      unlocked: Object.fromEntries(
        [
          'rn-flexbox-layout',
          'rn-lists-virtualization',
          'rn-navigation',
          'rn-platform-code',
          'rn-new-architecture',
          'rn-expo-workflow',
        ].map((id) => [id, { at: T0, by: 'rn-core-components' }]),
      ),
    };
    expect(dock('rn-flexbox-layout', learnedCore)).toEqual({
      reason: 'New',
      lines: [
        'Just opened by Core components.',
        'Correct once: Checked. Again later: Learned.',
        '3 items: a reel, one more, a question.',
      ],
      button: { label: 'Start Flexbox layout', kind: 'primary' },
      countdownTo: null,
    });
    expect(dock('rn-performance-rerenders', learnedCore)).toEqual({
      reason: 'Locked. 4 before it.',
      lines: [
        '6 items: steps 1-2 of 5. Stops before this unlocks.',
        'Correct once: Checked. Again later: Learned.',
      ],
      button: { label: 'Start with Lists and virtualization', kind: 'primary' },
      countdownTo: null,
    });
    expect(dock('react-state')).toEqual({
      reason: 'Locked. 1 before it.',
      lines: [
        '6 items, ends with a check on this. Stays locked until Components and props is Learned.',
        'Correct once: Checked. Again later: Learned.',
      ],
      button: { label: 'Start with Components and props', kind: 'primary' },
      countdownTo: null,
    });
    const branchB = {
      ...learnedCore,
      mastery: {
        ...learnedCore.mastery,
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 50_000,
          scheduled_at: T0 - 10_000,
          last_answered_at: T0 - 10_000,
        },
      },
    };
    expect(dock('rn-performance-rerenders', branchB).lines[0]).toBe(
      '3 items: step 1 of 5. Stops before this unlocks.',
    );
    const blocked = {
      ...fresh,
      mastery: {
        'react-components-props': {
          ...EMPTY_MASTERY,
          box: 1,
          due_at: T0 + 50_000,
          scheduled_at: T0 - 10_000,
          last_answered_at: T0 - 10_000,
        },
      },
    };
    expect(dock('react-state', blocked)).toEqual({
      reason: 'Locked. 1 before it.',
      lines: ['Needs Components and props Learned: one later correct answer.'],
      button: null,
      countdownTo: T0 + 50_000,
    });
    const seenLocked = {
      ...fresh,
      exposure: { 'react-state': { first_at: T0, at_reel: 1, finished: ['react-state--intro'] } },
    };
    expect(dock('react-state', seenLocked).reason).toBe('Seen, locked');
    for (const c of catalog.concepts)
      expect(dockContent(c.id, learnedCore, catalog, T0).reason.length).toBeLessThanOrEqual(20);
  });
});

describe('session summary (UX.md 3.7)', () => {
  it('title, line, rows, buttons', () => {
    const text = summaryText(
      {
        reelsWatched: 9,
        questionsAnswered: 3,
        correct: 2,
        checkedIds: ['rn-core-components'],
        learnedIds: ['rn-core-components'],
        nextReviewAt: T0 + 42_000,
      },
      catalog,
      T0,
    );
    expect(text).toEqual({
      title: '1 checked, 1 learned this session.',
      line: 'Next review in 0:42.',
      rows: ['Reels watched 9', 'Questions answered 3, 2 correct', 'Now Learned: Core components'],
      buttons: ['Keep going', 'Open map'],
    });
    const gap = summaryText(
      {
        reelsWatched: 2,
        questionsAnswered: 1,
        correct: 1,
        checkedIds: [],
        learnedIds: [],
        nextReviewAt: null,
      },
      catalog,
      T0,
      'gap_session',
    );
    expect(gap).toMatchObject({
      line: null,
      rows: ['Reels watched 2', 'Questions answered 1, 1 correct'],
      buttons: ['Back to feed', 'Open map'],
    });
  });
});
