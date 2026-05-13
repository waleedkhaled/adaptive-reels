// The session summary item (UX.md 3.7): an honest count and an explicit
// choice to continue, so sessions can end. No streaks, no loss framing.
import { copy } from '@reels/agent';
import type { FeedLayout } from '@reels/tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Txt } from '../components/Txt';
import { color } from '../lib/theme';
import { useApp } from '../lib/store';
import type { SummarySlot } from '../lib/types';
import { cat } from './engine';
import { leaveGap } from './gap';
import { pagerRef } from './pagerRef';

interface Props {
  slot: SummarySlot;
  index: number;
  height: number;
  layout: FeedLayout;
  topInset: number;
}

export function summaryShown(slot: SummarySlot): void {
  const s = slot.summary;
  useApp.getState().log({
    type: 'summary_shown',
    items: s.reelsWatched + s.questionsAnswered,
    cards_answered: s.questionsAnswered,
    learned_ids: s.learnedIds,
  });
}

export function SummaryCell({ slot, index, height, layout, topInset }: Props) {
  const [shownAt] = useState(() => Date.now());
  const text = copy.summaryText(slot.summary, cat(), shownAt, slot.source);
  return (
    <View
      style={{
        height,
        backgroundColor: color.bg.base,
        paddingTop: topInset + 48,
        paddingHorizontal: layout.axis,
        gap: 16,
      }}
    >
      <Txt variant="display" accessibilityRole="header">
        {text.title}
      </Txt>
      {text.line && (
        <Txt variant="bodyS" tone="secondary">
          {text.line}
        </Txt>
      )}
      <View style={{ gap: 4 }}>
        {text.rows.map((row) => (
          <Txt key={row} variant="bodyS">
            {row}
          </Txt>
        ))}
      </View>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button
          label={text.buttons[0]}
          onPress={() => {
            useApp.getState().log({ type: 'summary_action', action: 'keep_going' });
            if (slot.source === 'feed')
              pagerRef.current?.scrollToIndex({ index: index + 1, animated: true });
            else leaveGap();
          }}
        />
        <Button
          kind="secondary"
          label={text.buttons[1]}
          onPress={() => {
            useApp.getState().log({ type: 'summary_action', action: 'open_map' });
            if (slot.source === 'feed')
              router.push({ pathname: '/map', params: { from: 'summary' } });
            else leaveGap('summary');
          }}
        />
      </View>
    </View>
  );
}
