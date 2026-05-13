// Card actions: select, Check answer, Continue, Later (UX.md 3.3). The pager
// is locked on a card; Continue and Later are the only ways forward.
import { copy } from '@reels/agent';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useApp } from '../lib/store';
import type { CardSlot } from '../lib/types';
import { engine } from './engine';
import { leaveGap } from './gap';
import { pagerRef } from './pagerRef';

let shownAt = 0;
let selectionChanges = 0;

/** Called when a card settles. */
export function cardShown(slot: CardSlot): void {
  shownAt = Date.now();
  selectionChanges = 0;
  useApp.getState().setCard({ key: slot.key, selected: null, result: null });
}

function haptic(kind: 'select' | 'correct' | 'wrong') {
  if (!useApp.getState().settings.haptics) return;
  if (Platform.OS === 'ios') {
    if (kind === 'select') void Haptics.selectionAsync();
    else
      void Haptics.notificationAsync(
        kind === 'correct'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
  } else {
    const map = {
      select: Haptics.AndroidHaptics.Segment_Tick,
      correct: Haptics.AndroidHaptics.Confirm,
      wrong: Haptics.AndroidHaptics.Reject,
    };
    void Haptics.performAndroidHapticsAsync(map[kind]);
  }
}

export function selectOption(slot: CardSlot, optionIndex: number): void {
  const app = useApp.getState();
  const card =
    app.card?.key === slot.key ? app.card : { key: slot.key, selected: null, result: null };
  if (card.result) return;
  if (card.selected !== null && card.selected !== optionIndex) selectionChanges += 1;
  app.setCard({ ...card, selected: optionIndex });
  haptic('select');
}

export function checkAnswer(): void {
  const app = useApp.getState();
  const slot = app.slots[app.activeIndex];
  const card = app.card;
  if (
    slot?.kind !== 'card' ||
    !card ||
    card.key !== slot.key ||
    card.selected === null ||
    card.result
  )
    return;
  const choiceIndex = slot.options[card.selected]!;
  let result;
  try {
    result = engine.answer(slot, choiceIndex);
  } catch (error) {
    console.warn('answer failed', error);
    return;
  }
  app.setCard({
    ...card,
    result: { correct: result.correct, chosen: card.selected, answer: result },
  });
  haptic(result.correct ? 'correct' : 'wrong');
  app.log({
    type: 'card_answered',
    item_id: slot.itemId,
    concept_id: slot.conceptId,
    choice_index: card.selected,
    correct: result.correct,
    latency_ms: Math.max(0, Date.now() - shownAt),
    box_before: result.boxBefore,
    box_after: result.boxAfter,
    scheduled_gap_ms: result.scheduledGapMs,
    actual_gap_ms: result.actualGapMs,
    is_delayed: result.isDelayed,
    options_order: result.optionsOrder,
    selection_changes: selectionChanges,
    source: result.source,
    prove_it: result.proveIt,
    retry: result.retry,
  });
  if (result.levelAfter !== result.levelBefore)
    useApp.setState((s) => ({ mapChanged: s.mapChanged + 1 }));
  app.flush();
}

/** Continue (after an answer) or Later (before one): move to the next page. */
export function leaveCard(kind: 'continue' | 'later'): void {
  const app = useApp.getState();
  const slot = app.slots[app.activeIndex];
  if (slot?.kind !== 'card') return;
  if (kind === 'later') {
    app.log({
      type: 'card_deferred',
      item_id: slot.itemId,
      concept_id: slot.conceptId,
      slot: app.activeIndex,
    });
    try {
      engine.defer(slot);
    } catch (error) {
      console.warn('defer failed', error);
    }
    app.setNotice({ segments: [{ text: copy.QUIZ.saved }], until: Date.now() + 4000 });
  }
  // A one-card review from the map has nothing after it: back to the map (UX.md 3.6).
  if (slot.gap && !app.slots[app.activeIndex + 1]) {
    leaveGap('map_review');
    return;
  }
  // The card state stays until the next settle, so the action row keeps
  // "Continue" while the pager scrolls away instead of flipping back.
  pagerRef.current?.scrollToIndex({ index: app.activeIndex + 1, animated: true });
}
