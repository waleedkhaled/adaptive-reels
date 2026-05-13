// The in-feed progress panel, shown after an answer only (UX.md 3.4): the
// concept, its topic's eight tiles in rail order, the change line and the
// consequence. A tap opens the map.
import { copy, type AnswerResult } from '@reels/agent';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { StateTile, type TileState } from '../components/StateTile';
import { Txt, type TextColor } from '../components/Txt';
import { conceptTitle } from '../lib/graph';
import { color, radius, stroke } from '../lib/theme';
import { useApp } from '../lib/store';
import type { CardSlot } from '../lib/types';
import { cat, engine } from './engine';

const toneOf = (level: TileState['level']): TextColor =>
  level === 'checked'
    ? 'provenDim'
    : level === 'learned' || level === 'retained'
      ? 'proven'
      : 'secondary';

const tileOf = (level: TileState['level']): TileState => ({
  level,
  locked: false,
  due: false,
  justUnlocked: false,
});

export function ProgressPanel({ slot, result }: { slot: CardSlot; result: AnswerResult }) {
  // Re-read the tiles when the learner state changes.
  useApp((s) => s.learner);
  const clock = useApp((s) => s.settings.clock);
  // The panel appears at the answer: its countdowns start from that moment.
  const [shownAt] = useState(() => Date.now());
  const catalog = cat();
  const topic = catalog.topicById.get(catalog.conceptById.get(slot.conceptId)?.topicId ?? '');
  const ids = topic?.conceptIds ?? [];
  const learned = ids.filter((c) => {
    const l = engine.tile(c).level;
    return l === 'learned' || l === 'retained';
  }).length;
  const change = copy.progressChange(result);
  const consequence = copy.progressConsequence(result, catalog, clock, shownAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${conceptTitle(slot.conceptId)}: ${change.from} to ${change.to}. ${consequence} Opens the map.`}
      onPress={() => router.push({ pathname: '/map', params: { from: 'progress_panel' } })}
      style={({ pressed }) => [styles.panel, pressed && { backgroundColor: color.bg.overlay }]}
    >
      <Txt variant="heading">{conceptTitle(slot.conceptId)}</Txt>
      <View style={styles.tiles}>
        {ids.map((c) => (
          <StateTile
            key={c}
            size={18}
            surface={color.bg.raised}
            {...engine.tile(c)}
            selected={c === slot.conceptId}
          />
        ))}
        <Txt variant="dataS" tone={learned > 0 ? 'proven' : 'secondary'} style={styles.count}>
          {learned}/{ids.length}
        </Txt>
      </View>
      <View style={styles.change}>
        <StateTile size={18} surface={color.bg.raised} {...tileOf(result.levelBefore)} />
        <Txt variant="captionStrong" tone={toneOf(result.levelBefore)}>
          {change.from}
        </Txt>
        <Icon name="arrowRight" size={13} tint={color.text.secondary} />
        <StateTile size={18} surface={color.bg.raised} {...tileOf(result.levelAfter)} />
        <Txt variant="captionStrong" tone={toneOf(result.levelAfter)}>
          {change.to}
        </Txt>
      </View>
      <Txt variant="caption" tone="secondary">
        {consequence}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 124,
    borderRadius: radius.control,
    borderWidth: stroke.outline,
    borderColor: color.line.control,
    backgroundColor: color.bg.raised,
    padding: 12,
    gap: 8,
  },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { marginLeft: 'auto' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
