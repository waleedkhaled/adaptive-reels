// The copy deck (UX.md section 5, 3.2, 3.3, 3.6, 3.7) as pure functions. Text
// comes back as segments so the app can set the cause in `text.primary`:
// [{ text: 'Unlocked by ' }, { text: 'Core components', strong: true }, { text: '.' }].
import type {
  ClockSetting,
  DisplayLevel,
  FeedItem,
  LearnerState,
  Reason,
  SessionSummary,
} from '@reels/schemas';
import type { Catalog } from './catalog';
import { INTERVALS } from './config';
import type { DisplayState, Suggestion } from './map';
import { displayState } from './map';
import type { QuickActionConfirmation, AnswerResult } from './queue';
import { gapPlan } from './gap';
import { isLearned, masteryOf } from './state';

export interface Segment {
  text: string;
  /** The cause: a concept, a topic or the learner's own action. */
  strong?: boolean;
}

export type LeadWord = 'Review' | 'Deepen' | 'Explore' | 'Lateral';

const t = (text: string): Segment => ({ text });
const b = (text: string): Segment => ({ text, strong: true });

/** Segments as one plain string. */
export function plain(segments: readonly Segment[]): string {
  return segments.map((s) => s.text).join('');
}

// ---------------------------------------------------------------- formats (UX.md 5)

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Elapsed: "45s", "1m 06s" (under 5 minutes), "9m", "3h", "2d". */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 300) return `${Math.floor(s / 60)}m ${pad2(s % 60)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Countdown: "0:42", "12:00", "1:02:03"; a day or more "2d 4h". Rounds up. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  if (s < 86400) return `${Math.floor(s / 3600)}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`;
  return `${Math.floor(s / 86400)}d ${Math.floor(s / 3600) % 24}h`;
}

/** An interval from the tables: "20 s", "1 min", "10 min", "1 day", "3 days". */
export function formatInterval(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

/** Counts: "1/40". */
export function formatCount(n: number, total: number): string {
  return `${n}/${total}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- names

export function conceptName(catalog: Catalog, id: string | undefined): string {
  return (id && catalog.conceptById.get(id)?.title) || id || '';
}

/** Topic names in sentences use the short title ("Systems design"). */
export function topicName(catalog: Catalog, id: string | undefined): string {
  return (id && catalog.topicById.get(id)?.shortTitle) || id || '';
}

/** Running head (UX.md 3.2): "{concept} in {topic short name}". */
export function runningHead(catalog: Catalog, conceptId: string): Segment[] {
  const topicId = catalog.conceptById.get(conceptId)?.topicId;
  return [b(conceptName(catalog, conceptId)), t(` in ${topicName(catalog, topicId)}`)];
}

/** Rail "+ needs" line: "+ needs Memoization (React + TS)"; no topic for the same topic. */
export function needsLine(catalog: Catalog, rowConceptId: string, needId: string): string {
  const row = catalog.conceptById.get(rowConceptId);
  const need = catalog.conceptById.get(needId);
  const label = need ? catalog.topicById.get(need.topicId)?.railLabel : undefined;
  const cross = need && row && need.topicId !== row.topicId;
  return `+ needs ${conceptName(catalog, needId)}${cross ? ` (${label})` : ''}`;
}

// ---------------------------------------------------------------- reasons (UX.md 5.1)

const LEAD: Record<NonNullable<FeedItem['pool']>, LeadWord> = {
  review: 'Review',
  deepen: 'Deepen',
  explore: 'Explore',
  lateral: 'Lateral',
};

/** The pool lead word: the logged pool when not null; REVIEW_DUE always shows Review. */
export function leadWord(item: Pick<FeedItem, 'pool' | 'reason'>): LeadWord | null {
  if (item.pool) return LEAD[item.pool];
  return item.reason?.code === 'REVIEW_DUE' ? 'Review' : null;
}

/** The strip sentence for a reason, without the lead word. `kind` picks the GAP_SESSION variant. */
export function reasonSentence(
  reason: Reason,
  catalog: Catalog,
  kind: 'reel' | 'card' = 'reel',
): Segment[] {
  const p = reason.params;
  const concept = conceptName(catalog, p.concept);
  switch (reason.code) {
    case 'REVIEW_DUE':
      if (p.retry === 'true') return [t('Second try: '), b(concept), t('.')];
      return [
        t(Number(p.box ?? 1) >= 2 ? 'Learned ' : 'Answered '),
        b(concept),
        t(` ${formatElapsed(Number(p.elapsed_ms ?? 0))} ago.`),
      ];
    case 'FIRST_CHECK':
      return [t('First check: '), b(concept), t('.')];
    case 'RETEACH':
      // Interpretation: "Another angle" would be untrue on a replay (UX.md 1.2).
      return [
        t(p.replay === 'true' ? 'Same reel again. ' : 'Another angle. '),
        t('Your last answer here was '),
        b('wrong'),
        t('.'),
      ];
    case 'PROVE_IT':
      return [t('You said '), b('too easy'), t('. One question.')];
    case 'DEEPEN_UNLOCKED':
      return [t('Unlocked by '), b(conceptName(catalog, p.prereq)), t('.')];
    case 'DEEPEN_INTEREST': {
      const topic = b(topicName(catalog, p.topic));
      if (p.cause === 'watched') return [t('You keep watching '), topic, t('.')];
      if (p.cause === 'picked') return [t('From a topic you picked: '), topic, t('.')];
      return [t('Starting with '), topic, t('.')];
    }
    case 'EXPLORE_NEW':
      return [
        t(p.seen === '1' ? 'A topic you have barely seen: ' : 'New topic: '),
        b(topicName(catalog, p.topic)),
        t('.'),
      ];
    case 'LATERAL_RELATED':
      return [t('Related to '), b(conceptName(catalog, p.source)), t('.')];
    case 'LATERAL_BRIDGE':
      return [t('Builds toward '), b(conceptName(catalog, p.target)), t('.')];
    case 'MORE_LIKE_THIS':
      return [t('Because you tapped '), b('More like this'), t('.')];
    case 'CHANGE_OF_PACE':
      return [b('Two quick skips'), t('. Trying something else.')];
    case 'GAP_SESSION':
      return kind === 'card'
        ? [t('Gap session check: '), b(concept), t('.')]
        : [t('Gap session toward '), b(conceptName(catalog, p.target)), t('.')];
    case 'FALLBACK':
      return [t('Next unlocked reel. Nothing is due.')];
  }
}

/** The whole strip as plain text, lead word included ("Deepen. Unlocked by Core components."). */
export function stripText(item: FeedItem, catalog: Catalog): string {
  if (!item.reason) return '';
  const lead = leadWord(item);
  const sentence = plain(
    reasonSentence(item.reason, catalog, item.kind === 'card' ? 'card' : 'reel'),
  );
  return lead ? `${lead}. ${sentence}` : sentence;
}

const LEVEL_WORD: Record<DisplayLevel, string> = {
  none: 'Open',
  seen: 'Seen',
  checked: 'Checked',
  learned: 'Learned',
  retained: 'Retained',
};

function boxWord(box: number): string {
  return box >= 3 ? 'Retained' : box === 2 ? 'Learned' : box === 1 ? 'Checked' : 'Seen';
}

export interface DetailContext {
  /** For countdowns. */
  now?: number;
  /** `nextDueAt(state, now)`, for the FALLBACK line. */
  nextDueAt?: number | null;
}

/** The reason panel's 2 to 3 detail lines. */
export function reasonDetail(reason: Reason, catalog: Catalog, ctx: DetailContext = {}): string[] {
  const p = reason.params;
  const now = ctx.now ?? 0;
  const topic = topicName(catalog, p.topic);
  switch (reason.code) {
    case 'REVIEW_DUE': {
      const next = boxWord(Math.min(4, Number(p.box ?? 0) + 1));
      return p.retry === 'true'
        ? [`Your last answer was wrong. Correct now: ${next}.`]
        : [`Reviews come back after growing gaps. Correct now: ${next}.`];
    }
    case 'FIRST_CHECK':
      return [
        `You watched this ${plural(Number(p.reels_ago ?? 1), 'reel', 'reels')} ago. Correct: Checked. Correct again later: Learned.`,
      ];
    case 'RETEACH':
      return ['A new question on this follows.'];
    case 'PROVE_IT':
      return Number(p.box ?? 0) === 0
        ? ['Correct: Checked, then a later check. Wrong: it stays Seen and another angle follows.']
        : [
            `Correct changes nothing before ${formatCountdown(Number(p.due_at ?? now) - now)}. Wrong: it drops one level and another angle follows.`,
          ];
    case 'DEEPEN_UNLOCKED':
      return [`You learned ${conceptName(catalog, p.prereq)}, which this builds on.`];
    case 'DEEPEN_INTEREST':
      if (p.cause === 'watched') return [`You watched or liked ${topic} reels.`];
      if (p.cause === 'picked') return [`You picked ${topic} at the start.`];
      return [`You have not finished a ${topic} reel yet.`];
    case 'EXPLORE_NEW':
      return [`You have seen ${plural(Number(p.seen ?? 0), 'reel', 'reels')} in ${topic}.`];
    case 'LATERAL_RELATED':
      return [
        `${conceptName(catalog, p.source)} is linked to this on the map and you liked it recently.`,
      ];
    case 'LATERAL_BRIDGE':
      return [
        `${conceptName(catalog, p.target)} is related to something you liked but is locked. This is its first open prerequisite.`,
      ];
    case 'MORE_LIKE_THIS':
      return [`The closest related concept to ${conceptName(catalog, p.source)}.`];
    case 'CHANGE_OF_PACE':
      return ['You left the last two reels early.'];
    case 'GAP_SESSION':
      return [
        `You started this from the map. Step ${p.step ?? 1} of ${p.steps ?? 1} toward ${conceptName(catalog, p.target)}.`,
      ];
    case 'FALLBACK':
      return ctx.nextDueAt != null
        ? [
            'Reviews open more concepts when they come due.',
            `Next one in ${formatCountdown(ctx.nextDueAt - now)}.`,
          ]
        : ['Reviews open more concepts when they come due.'];
  }
}

/** The reason panel's trigger line for items served because of a tap (UX.md 5.1). */
export function triggerLine(reason: Reason): string | null {
  const p = reason.params;
  if (p.trigger === 'later') {
    return `You tapped Later ${plural(Number(p.later_reels ?? 2), 'reel', 'reels')} ago.`;
  }
  if (p.trigger === 'too_easy' && reason.code === 'REVIEW_DUE') return 'You tapped Too easy.';
  if (p.trigger === 'not_for_me') return 'Re-planned after Not for me.';
  return null;
}

/** While the demo clock is on, the reason panel adds this line (UX.md section 2). */
export const DEMO_CLOCK_LINE = 'Demo clock: reviews return in about 1 min.';
export const OFFLINE_LINE = 'Offline. Saved reels still play.';

/**
 * The changed marker (UX.md 3.2): items that exist because of a tap or skip
 * reverse the lead word, or without one the span naming the action.
 */
export function changedMarker(
  item: Pick<FeedItem, 'pool' | 'reason'>,
): { target: 'lead' } | { target: 'span'; text: string } | null {
  const trigger = item.reason?.params.trigger;
  if (!item.reason || !trigger || trigger === 'later') return null;
  if (leadWord(item)) return { target: 'lead' };
  const span: Partial<Record<string, string>> = {
    MORE_LIKE_THIS: 'More like this',
    PROVE_IT: 'too easy',
    CHANGE_OF_PACE: 'Two quick skips',
    RETEACH: 'wrong',
  };
  const text = span[item.reason.code];
  return text ? { target: 'span', text } : null;
}

// ---------------------------------------------------------------- quick actions (UX.md 3.2)

export const UNDO = 'Undo';
export const UNDONE = 'Undone.';
export const QUICK_ACTION_LABELS = {
  more_like_this: 'More like this',
  too_easy: 'Too easy',
  not_for_me: 'Not for me',
} as const;

/** The strip confirmation before "Undo". */
export function confirmationText(conf: QuickActionConfirmation, catalog: Catalog): Segment[] {
  if (conf.action === 'more_like_this') {
    const name = b(conceptName(catalog, conf.nextReel?.conceptId));
    return conf.cardFirst ? [t('After the question: '), name, t('.')] : [t('Next: '), name, t('.')];
  }
  if (conf.action === 'too_easy') {
    return conf.countdownMs !== null
      ? [
          t(
            `Prove it: 1 question next. It cannot count before ${formatCountdown(conf.countdownMs)}.`,
          ),
        ]
      : [t('Prove it: 1 question next.')];
  }
  return [t('Hidden this session. Less '), b(topicName(catalog, conf.topicId)), t('.')];
}

// ---------------------------------------------------------------- cards (UX.md 3.3, 5.3, 5.4)

export const QUIZ = {
  later: 'Later',
  check: 'Check answer',
  continue: 'Continue',
  leaveSession: 'Leave session',
  verdictCorrect: 'Correct.',
  verdictWrong: 'Not quite.',
  rowChosenCorrect: 'Correct',
  rowYourAnswer: 'Your answer',
  rowCorrectAnswer: 'Correct answer',
  blockedUnanswered: 'Answer, or tap Later.',
  blockedAnswered: 'Tap Continue.',
  saved: 'Saved for later. Back after 2 reels.',
  anotherAngle: 'Another angle is next.',
  sameReel: 'The same reel is next.',
  /** Second miss on a concept this session (owner decision #8). */
  rested: 'Moving on. It comes back next session.',
  leaveConfirm: 'Leave this gap session? Your answers are kept.',
  leave: 'Leave',
  stay: 'Stay',
} as const;

/** Explanation ending after a wrong answer; null after a right one. */
export function explanationSuffix(
  result: Pick<AnswerResult, 'correct' | 'reteach'> & { rested?: boolean },
): string | null {
  if (result.correct) return null;
  if (result.rested) return QUIZ.rested;
  return result.reteach?.replay ? QUIZ.sameReel : QUIZ.anotherAngle;
}

/** Progress panel change line words: "Seen" to "Checked". */
export function progressChange(result: Pick<AnswerResult, 'levelBefore' | 'levelAfter'>): {
  from: string;
  to: string;
} {
  return { from: LEVEL_WORD[result.levelBefore], to: LEVEL_WORD[result.levelAfter] };
}

/** Progress panel consequence line (UX.md 5.4). */
export function progressConsequence(
  result: AnswerResult,
  catalog: Catalog,
  clock: ClockSetting,
  now: number,
): string {
  const next = explanationSuffix(result);
  if (!result.correct) {
    if (result.boxBefore === 0) return `Still Seen. ${next}`;
    if (result.boxBefore === 1) return `Checked to Seen. ${next}`;
    const first =
      result.boxBefore === 4
        ? 'Still Retained.'
        : `${boxWord(result.boxBefore)} to ${boxWord(result.boxAfter)}.`;
    return `${first} What it opened stays open. ${next}`;
  }
  if (result.early) {
    return `Correct, but too soon to count. Back in ${formatCountdown((result.nextDueAt ?? now) - now)}.`;
  }
  if (result.boxBefore === 0) {
    return `Back in about ${formatInterval(INTERVALS[clock].boxMs[1])}. Correct then: Learned.`;
  }
  if (result.unlocked.length > 0) {
    const topics = new Set(result.unlocked.map((id) => catalog.conceptById.get(id)?.topicId));
    const topicId =
      topics.size === 1 ? [...topics][0] : catalog.conceptById.get(result.conceptId)?.topicId;
    return `${result.unlocked.length} more open in ${topicName(catalog, topicId)}.`;
  }
  return `Next review in about ${formatInterval(INTERVALS[clock].boxMs[result.boxAfter] ?? 0)}.`;
}

/** "Item 2 of 6" in a gap session's action row. */
export function gapCounter(info: { index: number; total: number }): string {
  return `Item ${info.index} of ${info.total}`;
}

// ---------------------------------------------------------------- state labels (UX.md 5.2)

export const LEGEND_LINE = 'Watched: dot. Correct: half. Again later: full.';
export const RULE_LINE = 'Correct once: Checked. Again later: Learned.';

export type RailWord =
  'LOCKED' | 'OPEN' | 'NEW' | 'SEEN' | 'CHECKED' | 'LEARNED' | 'RETAINED' | 'DUE';

/** The rail's status column word. */
export function railWord(d: DisplayState): RailWord {
  if (d.due) return 'DUE';
  if (d.level !== 'none') return d.level.toUpperCase() as RailWord;
  if (d.locked) return 'LOCKED';
  return d.justUnlocked ? 'NEW' : 'OPEN';
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Long form for the Key, the dock detail and the screen reader. */
export function stateLongForm(
  conceptId: string,
  state: LearnerState,
  catalog: Catalog,
  now: number,
): string {
  const d = displayState(conceptId, state, catalog, now);
  const word = railWord(d);
  switch (word) {
    case 'DUE':
      return 'Due. Review now.';
    case 'LOCKED': {
      const unmet = (catalog.conceptById.get(conceptId)?.prereqs ?? []).filter(
        (p) => !isLearned(state, p),
      );
      return `Locked. Needs ${joinNames(unmet.map((id) => conceptName(catalog, id)))}.`;
    }
    case 'NEW':
      return 'Just opened.';
    case 'OPEN':
      return 'Open. Ready to start.';
    case 'SEEN':
      return 'Seen. Watched, not answered.';
    case 'CHECKED':
      return 'Checked. One correct answer.';
    case 'LEARNED':
      return 'Learned. Correct again after a delay.';
    case 'RETAINED': {
      const box = masteryOf(state, conceptId).box;
      return `Retained, box ${box}. ${box - 1} delayed reviews passed.`;
    }
  }
}

// ---------------------------------------------------------------- map dock (UX.md 5.5)

export interface DockContent {
  /** Row-1 reason, at most 20 characters. */
  reason: string;
  /** The text block (1 to 3 lines). */
  lines: string[];
  button: { label: string; kind: 'primary' | 'secondary' } | null;
  /** "Comes back in {countdown}" target when there is no button; else null. */
  countdownTo: number | null;
}

export function dockContent(
  conceptId: string,
  state: LearnerState,
  catalog: Catalog,
  now: number,
  suggestion: Suggestion | null = null,
): DockContent {
  const d = displayState(conceptId, state, catalog, now);
  const m = masteryOf(state, conceptId);
  const name = conceptName(catalog, conceptId);
  const start = { label: `Start ${name}`, kind: 'primary' as const };
  const threeItems = '3 items: a reel, one more, a question.';
  if (d.due) {
    return {
      reason: 'Review due now',
      lines: [
        `Due ${formatElapsed(now - (m.due_at ?? now))} ago. Correct now makes it ${boxWord(Math.min(4, m.box + 1))}.`,
      ],
      button: { label: 'Review now, 1 question', kind: 'primary' },
      countdownTo: null,
    };
  }
  if (m.box === 1) {
    return {
      reason: d.locked ? 'Checked, locked' : 'Checked',
      lines: ['A later correct answer makes it Learned.', 'Answering early does not count.'],
      button: null,
      countdownTo: m.due_at,
    };
  }
  if (m.box >= 2) {
    return {
      reason: m.box >= 3 ? `Retained, box ${m.box}` : 'Learned',
      lines: [`Next review in ${formatCountdown((m.due_at ?? now) - now)}.`],
      button: { label: 'Rewatch a reel', kind: 'secondary' },
      countdownTo: null,
    };
  }
  if (!d.locked) {
    if (d.justUnlocked) {
      const by = state.unlocked[conceptId]?.by;
      return {
        reason: 'New',
        lines: [`Just opened by ${conceptName(catalog, by)}.`, RULE_LINE, threeItems],
        button: start,
        countdownTo: null,
      };
    }
    // Evidence first: a Seen concept says so; an untouched one names what it opens
    // when it is shown as an "opens the most" suggestion.
    const opens =
      suggestion?.conceptId === conceptId && suggestion.kind === 'opens' ? suggestion.opens : 0;
    const reason =
      d.level !== 'none'
        ? 'Seen, not answered'
        : opens > 0
          ? `Opens ${plural(opens, 'concept', 'concepts')}`
          : 'Open';
    return { reason, lines: [RULE_LINE, threeItems], button: start, countdownTo: null };
  }
  // Locked (UX.md 5.5 locked rows).
  const gp = gapPlan(conceptId, state, catalog, now);
  const unmet = gp.pins.length - 1;
  const reason = d.level === 'seen' ? 'Seen, locked' : `Locked. ${unmet} before it.`;
  if (gp.kind === 'none' || gp.firstStep === null) {
    const ancestor = gp.blockedBy ?? gp.pins[0] ?? conceptId;
    return {
      reason,
      lines: [`Needs ${conceptName(catalog, ancestor)} Learned: one later correct answer.`],
      button: null,
      countdownTo: masteryOf(state, ancestor).due_at,
    };
  }
  const button = {
    label: `Start with ${conceptName(catalog, gp.firstStep)}`,
    kind: 'primary' as const,
  };
  if (gp.reachesTarget) {
    const stays = gp.steps.find((s) => s.conceptId !== conceptId && s.state !== 'due');
    const first = stays
      ? `${gp.items} items, ends with a check on this. Stays locked until ${conceptName(catalog, stays.conceptId)} is Learned.`
      : `${gp.items} items, ends with a check on this.`;
    return { reason, lines: [first, RULE_LINE], button, countdownTo: null };
  }
  const j = gp.steps.length;
  const steps = j === 1 ? `step 1 of ${gp.pins.length}` : `steps 1-${j} of ${gp.pins.length}`;
  return {
    reason,
    lines: [`${gp.items} items: ${steps}. Stops before this unlocks.`, RULE_LINE],
    button,
    countdownTo: null,
  };
}

// ---------------------------------------------------------------- summary (UX.md 3.7)

export function summaryText(
  summary: SessionSummary,
  catalog: Catalog,
  now: number,
  source: 'feed' | 'gap_session' | 'map_review' = 'feed',
): { title: string; line: string | null; rows: string[]; buttons: [string, string] } {
  const rows = [
    `Reels watched ${summary.reelsWatched}`,
    `Questions answered ${summary.questionsAnswered}, ${summary.correct} correct`,
  ];
  if (summary.learnedIds.length > 0) {
    rows.push(
      `Now Learned: ${summary.learnedIds.map((id) => conceptName(catalog, id)).join(', ')}`,
    );
  }
  return {
    title: `${summary.checkedIds.length} checked, ${summary.learnedIds.length} learned this session.`,
    line:
      summary.nextReviewAt !== null
        ? `Next review in ${formatCountdown(summary.nextReviewAt - now)}.`
        : null,
    rows,
    buttons: source === 'feed' ? ['Keep going', 'Open map'] : ['Back to feed', 'Open map'],
  };
}
