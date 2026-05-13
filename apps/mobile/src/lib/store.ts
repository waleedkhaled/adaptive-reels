// The in-memory source of truth (docs/PERFORMANCE.md section 3). Selectors
// must return primitives or stable references: never build objects in them.
import type { AnswerResult } from '@reels/agent';
import { LearnerState, type LearnerEvent, type Manifest, type ManifestReel } from '@reels/schemas';
import { create } from 'zustand';
import { openStore, persist } from './db';
import { pruneStale } from './downloads';
import { defaultReelSet, loadManifest } from './library';
import { defaultSettings, type FeedSlot, type Settings } from './types';

export type Phase = 'booting' | 'onboarding' | 'ready' | 'error';

/** What survives a restart (written to the snapshot row). */
export interface Snapshot {
  settings: Settings;
  profile: {
    id: string;
    createdAt: number;
    topicIds: string[];
    skipped: boolean;
    seed: number;
  } | null;
  learner: LearnerState | null;
}

type NewEvent = { type: LearnerEvent['type'] } & Record<string, unknown>;

interface State {
  phase: Phase;
  error: string | null;
  settings: Settings;
  profile: Snapshot['profile'];
  learner: LearnerState | null;
  manifest: Manifest | null;
  manifestSource: 'network' | 'disk' | null;
  reels: Record<string, ManifestReel>;
  sessionId: string;
  slots: FeedSlot[];
  activeIndex: number;
  settledIndex: number;
  /** Per player: the reel id it has fully loaded, or null. */
  loaded: (string | null)[];
  /** A panel over the feed: reason, concept or none. */
  panel: 'none' | 'reason' | 'concept';
  /** Confirmation shown in the reason strip instead of the reason, with optional Undo. */
  notice: {
    segments: { text: string; strong?: boolean }[];
    undo?: () => void;
    until: number;
  } | null;
  paused: boolean;
  /** The card on screen: the selected option (an index into its options) and the result once checked. */
  card: {
    key: string;
    selected: number | null;
    result: { correct: boolean; chosen: number; answer: AnswerResult } | null;
  } | null;
  /** Concepts whose level changed since the map was last opened (the tab bar's changed mark). */
  mapChanged: number;
  /** System settings, kept live by lib/a11y. */
  reduceMotion: boolean;
  screenReader: boolean;
  /** The active reel failed to load after its retry (UX.md 3.9). */
  failed: { reelId: string; cause: 'timeout' | 'player_error' } | null;
  /** Bumped when the pager's list is swapped (gap session in or out): the list remounts. */
  listGen: number;
}

interface Actions {
  boot(): Promise<void>;
  setPhase(phase: Phase): void;
  setSlots(slots: FeedSlot[]): void;
  setActive(index: number): void;
  setSettled(index: number): void;
  setLoaded(slot: number, reelId: string | null): void;
  setPanel(panel: State['panel']): void;
  setNotice(notice: State['notice']): void;
  setPaused(paused: boolean): void;
  setCard(card: State['card']): void;
  setFailed(failed: State['failed']): void;
  /** A new session id: called with every session_start, so events group by session. */
  newSession(): void;
  updateSettings(patch: Partial<Settings>): void;
  setProfile(profile: Snapshot['profile'], learner: LearnerState | null): void;
  setLearner(learner: LearnerState | null): void;
  /** Queue an event; it is written with the next flush. */
  log(event: NewEvent): void;
  /** Write queued events and the snapshot in one transaction (not awaited by callers). */
  flush(): void;
}

export const POOL = 3;

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

let queued: LearnerEvent[] = [];
let saveFailShown = false;

export const useApp = create<State & Actions>()((set, get) => ({
  phase: 'booting',
  error: null,
  settings: defaultSettings(defaultReelSet),
  profile: null,
  learner: null,
  manifest: null,
  manifestSource: null,
  reels: {},
  sessionId: randomId(),
  slots: [],
  activeIndex: 0,
  settledIndex: -1,
  loaded: Array.from({ length: POOL }, () => null),
  panel: 'none',
  notice: null,
  paused: false,
  card: null,
  mapChanged: 0,
  reduceMotion: false,
  screenReader: false,
  failed: null,
  listGen: 0,

  async boot() {
    try {
      const { snapshot } = openStore();
      const snap = snapshot as Snapshot | null;
      if (snap?.settings)
        set({ settings: { ...defaultSettings(defaultReelSet), ...snap.settings } });
      // A learner that no longer matches the schema starts over at onboarding.
      if (snap?.profile && LearnerState.safeParse(snap.learner).success)
        set({ profile: snap.profile, learner: snap.learner });
      const { manifest, source } = await loadManifest(get().settings.reelSet);
      const reels: Record<string, ManifestReel> = {};
      for (const r of manifest.reels) reels[r.reel_id] = r;
      set({ manifest, manifestSource: source, reels });
      // Files of re-rendered or removed reels are dead weight: drop them.
      try {
        pruneStale(manifest.reels);
      } catch {
        // Cleanup is best effort.
      }
      if (manifest.reels.length === 0) {
        set({ phase: 'error', error: 'empty-library' });
        return;
      }
      set({ phase: get().profile ? 'ready' : 'onboarding' });
    } catch (error) {
      set({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },
  setPhase: (phase) => set({ phase }),
  setSlots: (slots) => set({ slots }),
  setActive: (index) => set({ activeIndex: index }),
  setSettled: (index) => set({ settledIndex: index }),
  setLoaded: (slot, reelId) => {
    const loaded = get().loaded.slice();
    loaded[slot] = reelId;
    set({ loaded });
  },
  setPanel: (panel) => set({ panel }),
  setNotice: (notice) => set({ notice }),
  setPaused: (paused) => set({ paused }),
  setCard: (card) => set({ card }),
  newSession: () => set({ sessionId: randomId() }),
  setFailed: (failed) => {
    if (get().failed !== failed) set({ failed });
  },
  updateSettings(patch) {
    set({ settings: { ...get().settings, ...patch } });
    get().flush();
  },
  setProfile(profile, learner) {
    set({ profile, learner });
    get().flush();
  },
  setLearner: (learner) => set({ learner }),
  log(event) {
    queued.push({
      id: randomId(),
      session_id: get().sessionId,
      at: Date.now(),
      ...event,
    } as LearnerEvent);
  },
  flush() {
    const events = queued;
    queued = [];
    const { settings, profile, learner } = get();
    persist(events, { settings, profile, learner } satisfies Snapshot).catch(() => {
      // Kept for the next flush (the next swipe); the strip says so once if an answer was in it (UX.md 3.9).
      queued = [...events, ...queued];
      if (!saveFailShown && events.some((e) => e.type === 'card_answered')) {
        saveFailShown = true;
        set({
          notice: {
            segments: [{ text: 'Could not save your last answer.' }],
            until: Date.now() + 4000,
          },
        });
      }
    });
  },
}));
