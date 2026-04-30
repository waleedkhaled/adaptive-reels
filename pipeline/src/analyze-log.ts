// Tester log analysis (docs/PLAN.md M7): reads the JSON Lines file the app
// exports from You > Export log, checks every event against the schema, and
// prints the numbers the demo is judged on.
// Usage: npm run analyze -- <log.jsonl> [more.jsonl ...]
import { readFileSync } from 'node:fs';
import { LearnerEvent } from '@reels/schemas';

type Event = LearnerEvent;
type Of<T extends Event['type']> = Extract<Event, { type: T }>;

export interface LogReport {
  events: number;
  invalid: { line: number; type: string; issue: string }[];
  sessions: number;
  reelsPerSession: number | null;
  reelEnds: number;
  completedRate: number | null;
  earlySkipRate: number | null;
  firstChecks: { answered: number; correct: number };
  delayedReviews: { answered: number; correct: number };
  learned: number;
  quickActions: Record<string, number>;
  start: {
    n: number;
    playingP50: number | null;
    playingP95: number | null;
    readyAtActivation: number | null;
    hzMedian: number | null;
  };
  watchdog: number;
  loadFailures: number;
}

export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[at] ?? null;
}

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

export function analyze(lines: readonly string[]): LogReport {
  const events: Event[] = [];
  const invalid: LogReport['invalid'] = [];
  lines.forEach((text, i) => {
    if (!text.trim()) return;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      invalid.push({ line: i + 1, type: '?', issue: 'not JSON' });
      return;
    }
    const parsed = LearnerEvent.safeParse(raw);
    if (parsed.success) events.push(parsed.data);
    else {
      const type = (raw as { type?: string }).type ?? '?';
      const issue = parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ');
      invalid.push({ line: i + 1, type, issue });
    }
  });
  const of = <T extends Event['type']>(type: T) =>
    events.filter((e): e is Of<T> => e.type === type);

  const sessions = new Set(events.map((e) => e.session_id));
  const reelsBySession = new Map<string, number>();
  for (const e of of('reel_impression')) {
    if (e.revisit) continue;
    reelsBySession.set(e.session_id, (reelsBySession.get(e.session_id) ?? 0) + 1);
  }
  const ends = of('reel_end').filter((e) => e.ended_by !== 'skip_failed');
  const answers = of('card_answered');
  const first = answers.filter((e) => !e.is_delayed);
  const delayed = answers.filter((e) => e.is_delayed);
  const quickActions: Record<string, number> = {};
  for (const e of of('quick_action')) quickActions[e.action] = (quickActions[e.action] ?? 0) + 1;
  const starts = of('reel_first_frame');
  const playing = starts.map((e) => e.playing_ms).filter((v): v is number => v !== null);
  const hz = starts.map((e) => e.hz).filter((v): v is number => v !== null);

  return {
    events: events.length + invalid.length,
    invalid,
    sessions: sessions.size,
    reelsPerSession: quantile([...reelsBySession.values()], 0.5),
    reelEnds: ends.length,
    completedRate: ratio(ends.filter((e) => e.outcome === 'completed').length, ends.length),
    earlySkipRate: ratio(ends.filter((e) => e.outcome === 'early_skip').length, ends.length),
    firstChecks: { answered: first.length, correct: first.filter((e) => e.correct).length },
    delayedReviews: { answered: delayed.length, correct: delayed.filter((e) => e.correct).length },
    learned: answers.filter((e) => e.box_before < 2 && e.box_after >= 2).length,
    quickActions,
    start: {
      n: starts.length,
      playingP50: quantile(playing, 0.5),
      playingP95: quantile(playing, 0.95),
      readyAtActivation: ratio(starts.filter((e) => e.ready_at_activation).length, starts.length),
      hzMedian: quantile(hz, 0.5),
    },
    watchdog: of('player_watchdog').length,
    loadFailures: of('reel_load_failed').length,
  };
}

const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const ms = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v)} ms`);
const of = (x: { answered: number; correct: number }) =>
  x.answered === 0 ? 'none' : `${x.correct}/${x.answered} (${pct(x.correct / x.answered)})`;

export function format(r: LogReport): string {
  const lines = [
    `Events: ${r.events}, ${r.invalid.length} invalid`,
    `Sessions: ${r.sessions}; new reels per session (median): ${r.reelsPerSession ?? 'n/a'}`,
    `Reels ended: ${r.reelEnds}; completed ${pct(r.completedRate)}; early skips ${pct(r.earlySkipRate)}`,
    `First checks correct: ${of(r.firstChecks)}`,
    `Delayed reviews correct: ${of(r.delayedReviews)}; reached Learned: ${r.learned}`,
    `Quick actions: ${
      Object.entries(r.quickActions)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || 'none'
    }`,
    `Reel start (play() to first moving frame): p50 ${ms(r.start.playingP50)}, p95 ${ms(r.start.playingP95)} over ${r.start.n}; preloaded ${pct(r.start.readyAtActivation)}; frame rate ${r.start.hzMedian ?? 'n/a'} Hz`,
    `Stall reloads: ${r.watchdog}; load failures: ${r.loadFailures}`,
    `Pass line (PERFORMANCE.md): start p95 under 500 ms → ${r.start.playingP95 === null ? 'n/a' : r.start.playingP95 < 500 ? 'PASS' : 'FAIL'}`,
  ];
  for (const bad of r.invalid.slice(0, 10))
    lines.push(`  invalid line ${bad.line} (${bad.type}): ${bad.issue}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    process.stderr.write('Usage: npm run analyze -- <log.jsonl> [more.jsonl ...]\n');
    process.exit(1);
  }
  for (const file of files) {
    process.stdout.write(
      `== ${file}\n${format(analyze(readFileSync(file, 'utf8').split('\n')))}\n`,
    );
  }
}
