// Starting, resuming and resetting a learner profile.
import { DEMO_SEED, SAMPLE_PROFILES, type SampleProfileName } from '@reels/agent';
import * as Application from 'expo-application';
import { accessibilitySnapshot } from '../lib/a11y';
import { clearSnapshot } from '../lib/db';
import { useApp } from '../lib/store';
import { endSessionImpression, resetFeedState } from './controller';
import { engine } from './engine';
import { pauseAll } from './players';

function logSessionStart(seed: number): void {
  const app = useApp.getState();
  app.newSession();
  app.log({
    type: 'session_start',
    app_version: Application.nativeApplicationVersion ?? 'dev',
    mode: app.settings.mode,
    clock: app.settings.clock,
    seed,
    ...accessibilitySnapshot(),
  });
}

export function startProfile(topicIds: string[], skipped: boolean): void {
  const app = useApp.getState();
  const now = Date.now();
  // Profiles made under the demo clock use the seed the demo script was pinned with.
  const seed = app.settings.clock === 'demo' ? DEMO_SEED : Math.floor(Math.random() * 2 ** 31);
  const id = `p${now.toString(36)}`;
  app.setProfile({ id, createdAt: now, topicIds, skipped, seed }, null);
  logSessionStart(seed);
  app.log({ type: 'onboarding_done', topic_ids: topicIds, skipped });
  resetFeedState();
  engine.createProfile({
    profileId: id,
    topicIds,
    skipped,
    seed,
    mode: app.settings.mode,
    clock: app.settings.clock,
  });
  app.setPhase('ready');
  app.flush();
}

/** A cold start, or a return after 30 minutes away, starts a new session (UX.md 3.7). */
export function resumeProfile(): void {
  const app = useApp.getState();
  if (!app.learner || !app.profile) return;
  logSessionStart(app.profile.seed);
  resetFeedState();
  engine.startSession();
  app.flush();
}

/** One line per sample, counted from the agent's fixture so it cannot drift. */
function sampleLine(name: SampleProfileName): string {
  const specs = Object.values(SAMPLE_PROFILES[name]);
  const boxes = specs.flatMap((x) => (typeof x === 'string' ? [] : [x.box]));
  const count = (n: number, word: string) => (n > 0 ? [`${n} ${word}`] : []);
  const parts = [
    ...count(boxes.filter((b) => b === 2).length, 'learned'),
    ...count(boxes.filter((b) => b >= 3).length, 'retained'),
    ...count(boxes.filter((b) => b === 1).length, 'checked'),
  ];
  return parts.length > 0 ? `${parts.join(', ')}. Some reviews due.` : 'Nothing watched yet.';
}

export const SAMPLES = [
  { name: 'fresh', title: 'Fresh', body: sampleLine('fresh') },
  { name: 'day3', title: 'Day 3', body: sampleLine('day3') },
  { name: 'week2', title: 'Week 2', body: sampleLine('week2') },
] as const;

/** Replace progress with a sample profile (UX.md 3.8); "Sample data" shows until Reset. */
export function loadSampleProfile(name: (typeof SAMPLES)[number]['name']): void {
  const app = useApp.getState();
  pauseAll();
  endSessionImpression();
  const now = Date.now();
  const seed = app.settings.clock === 'demo' ? DEMO_SEED : Math.floor(Math.random() * 2 ** 31);
  const id = `s${now.toString(36)}`;
  app.setProfile({ id, createdAt: now, topicIds: [], skipped: true, seed }, null);
  app.log({ type: 'sample_profile_loaded', profile: name });
  logSessionStart(seed);
  resetFeedState();
  engine.loadSample(name, {
    profileId: id,
    seed,
    mode: app.settings.mode,
    clock: app.settings.clock,
  });
  useApp.setState({
    card: null,
    notice: null,
    panel: 'none',
    paused: false,
    failed: null,
    mapChanged: 0,
  });
  app.setPhase('ready');
  app.flush();
}

/** Reset progress: keeps settings and the event log, returns to onboarding. */
export async function resetProfile(): Promise<void> {
  pauseAll();
  endSessionImpression();
  const app = useApp.getState();
  app.log({ type: 'profile_reset' });
  app.flush();
  await clearSnapshot();
  useApp.setState({
    profile: null,
    learner: null,
    slots: [],
    activeIndex: 0,
    settledIndex: -1,
    card: null,
    notice: null,
    panel: 'none',
    paused: false,
    failed: null,
  });
  app.setPhase('onboarding');
}
