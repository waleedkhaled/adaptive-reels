// Gap sessions on the feed's pager (UX.md 3.6): started from the map dock,
// left with "Leave session" (confirmed) or the summary's buttons. The feed
// list is put aside meanwhile and comes back where the learner left it.
import { copy } from '@reels/agent';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useApp } from '../lib/store';
import { endSessionImpression, resetFeedState } from './controller';
import { engine } from './engine';
import { pauseAll } from './players';

export function startGapFromMap(conceptId: string, action: 'gap' | 'review' | 'rewatch'): boolean {
  const app = useApp.getState();
  const source = action === 'review' ? 'map_review' : 'map_dock';
  endSessionImpression();
  pauseAll();
  let plan;
  try {
    plan = engine.startGap(conceptId, source);
  } catch (error) {
    console.warn('gap session not started', error);
    return false;
  }
  resetFeedState();
  if (plan.kind !== 'none') {
    app.log({
      type: 'gap_session_started',
      target_concept_id: conceptId,
      planned_concept_ids: plan.pins,
      source,
      kind: plan.kind,
      planned_items: plan.items,
    });
  }
  app.flush();
  router.navigate('/');
  return true;
}

/** Back to the feed; with `openMap` the map opens after (the summary's "Open map", or a one-card review ending). */
export function leaveGap(openMap?: 'summary' | 'map_review'): void {
  const app = useApp.getState();
  endSessionImpression();
  pauseAll();
  const result = engine.leaveGap();
  resetFeedState();
  if (result) {
    app.log({
      type: 'gap_session_ended',
      target_concept_id: result.targetId,
      items_served: result.itemsServed,
      reason: result.ended as 'target_checked' | 'plan_done' | 'wrong_at_cap' | 'left',
    });
  }
  app.setCard(null);
  app.flush();
  if (openMap) router.push({ pathname: '/map', params: { from: openMap } });
}

/** "Leave session" asks first: answers are kept either way. */
export function confirmLeave(): void {
  Alert.alert(copy.QUIZ.leaveConfirm, undefined, [
    { text: copy.QUIZ.stay, style: 'cancel' },
    { text: copy.QUIZ.leave, style: 'destructive', onPress: () => leaveGap() },
  ]);
}
