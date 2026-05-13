// The knowledge map's data in one shape (UX.md 3.5 and 5.5), read from the
// learning agent: rail order, display states, suggestions, the dock copy and
// gap-plan pins. The screens only read this file.
import * as agent from '@reels/agent';
import { copy } from '@reels/agent';
import type { TileState } from '../components/StateTile';
import type { TextColor } from '../components/Txt';
import { cat } from '../feed/engine';
import { useApp } from '../lib/store';

export interface RailRow {
  conceptId: string;
  title: string;
  depth: number;
  /** The rail row this one hangs under (its connector), or null at level 0. */
  parentId: string | null;
  /** "+ needs" lines, ready to show. */
  needs: string[];
  /** Level 0 with only cross-topic prerequisites: a dashed inbound stub. */
  stub: boolean;
  tile: TileState;
}

export interface TopicView {
  id: string;
  title: string;
  short: string;
  rows: RailRow[];
  learned: number;
  due: number;
}

export interface DockButton {
  label: string;
  kind: 'primary' | 'secondary';
  action: 'gap' | 'review' | 'rewatch';
}

export interface DockView {
  conceptId: string;
  title: string;
  /** Row-1 reason, at most 20 characters. */
  reason: string;
  reasonDue: boolean;
  /** One to three caption lines. */
  lines: string[];
  button: DockButton | null;
  /** Shown as "Comes back in {countdown}" when there is no button. */
  countdownTo: number | null;
}

export interface MapView {
  topics: TopicView[];
  learned: number;
  watched: number;
  total: number;
  /** Concept ids, best first (at most 3); the dock and the pins follow this order. */
  suggestions: string[];
  /** Topics with a level change since the last visit (their row's 8 pt mark). */
  changedTopics: string[];
  /** Topic of the latest level change, for "staged topic on open". */
  stagedTopicId: string | null;
}

export const RULE_LINE = copy.RULE_LINE;
export const LEGEND_LINE = copy.LEGEND_LINE;

const NONE: TileState = { level: 'none', locked: false, due: false, justUnlocked: false };

export function mapView(): MapView {
  const catalog = cat();
  const state = useApp.getState().learner;
  const now = Date.now();
  const tile = (id: string): TileState =>
    state ? agent.displayState(id, state, catalog, now) : NONE;
  const counts = state ? agent.mapCounts(state, catalog, now) : null;
  const changes = state ? agent.mapChanges(state, catalog) : null;
  const changedTopics = new Set(
    (changes?.levelChanged ?? [])
      .map((id) => catalog.conceptById.get(id)?.topicId)
      .filter((t): t is string => !!t),
  );
  const topics: TopicView[] = catalog.topics.map((t) => {
    const c = counts?.topics.find((x) => x.topicId === t.id);
    return {
      id: t.id,
      title: t.title,
      short: t.shortTitle,
      rows: t.rail.map((r) => ({
        conceptId: r.conceptId,
        title: copy.conceptName(catalog, r.conceptId),
        depth: r.level,
        parentId: r.parentId,
        needs: r.needs.map((n) => copy.needsLine(catalog, r.conceptId, n)),
        stub: r.stub,
        tile: tile(r.conceptId),
      })),
      learned: c?.learned ?? 0,
      due: c?.due ?? 0,
    };
  });
  return {
    topics,
    learned: counts?.learned ?? 0,
    watched: counts?.watched ?? 0,
    total: counts?.total ?? catalog.concepts.length,
    suggestions: state ? agent.suggestions(state, catalog, now).map((s) => s.conceptId) : [],
    changedTopics: [...changedTopics],
    stagedTopicId: changes?.stagedTopicId ?? null,
  };
}

/** Store what the map looked like, so the next visit marks only new changes. */
export function markMapSeen(): void {
  const app = useApp.getState();
  if (!app.learner) return;
  app.setLearner(agent.markMapSeen(app.learner, cat(), Date.now()));
  app.flush();
}

/** Number pins while a locked concept is selected: its unmet ancestors in gap order, then itself. */
export function gapPins(conceptId: string): string[] {
  const state = useApp.getState().learner;
  return state ? agent.gapPlan(conceptId, state, cat(), Date.now()).pins : [conceptId];
}

export function dockView(conceptId: string): DockView {
  const catalog = cat();
  const state = useApp.getState().learner;
  const title = copy.conceptName(catalog, conceptId);
  if (!state)
    return {
      conceptId,
      title,
      reason: 'Open',
      reasonDue: false,
      lines: [RULE_LINE],
      button: null,
      countdownTo: null,
    };
  const now = Date.now();
  const suggestion =
    agent.suggestions(state, catalog, now).find((s) => s.conceptId === conceptId) ?? null;
  const d = copy.dockContent(conceptId, state, catalog, now, suggestion);
  const tile = agent.displayState(conceptId, state, catalog, now);
  const action: DockButton['action'] = tile.due
    ? 'review'
    : tile.level === 'learned' || tile.level === 'retained'
      ? 'rewatch'
      : 'gap';
  return {
    conceptId,
    title,
    reason: d.reason,
    reasonDue: tile.due,
    lines: d.lines,
    button: d.button ? { ...d.button, action } : null,
    countdownTo: d.countdownTo,
  };
}

/** The rail's status word (DESIGN.md Mastery encoding) and its colour. */
export function stateWord(t: TileState): { word: string; tone: TextColor; due: boolean } {
  const word = copy.railWord(t);
  const tone: TextColor =
    word === 'DUE'
      ? 'due'
      : word === 'RETAINED' || word === 'LEARNED'
        ? 'proven'
        : word === 'CHECKED'
          ? 'provenDim'
          : word === 'NEW'
            ? 'primary'
            : 'secondary';
  return { word, tone, due: word === 'DUE' };
}

/** Rail row height at default text: 48, or 64 with a needs line (DESIGN.md Components). */
export const railRowHeight = (row: Pick<RailRow, 'needs'>) => (row.needs.length > 0 ? 64 : 48);

/** The stage height a topic needs: stage header plus its rail rows (the `need` of mapFit). */
export function stageNeed(topic: TopicView): number {
  return 48 + topic.rows.reduce((sum, r) => sum + railRowHeight(r), 0);
}
