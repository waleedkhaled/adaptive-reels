// In-screen panels over the map (never native sheets): the Key, which names
// every mark with a live count, and the dock detail (UX.md 3.5).
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { StateTile, type TileState } from '../components/StateTile';
import { Txt } from '../components/Txt';
import { engine } from '../feed/engine';
import {
  conceptSummary,
  conceptTitle,
  dependentsOf,
  prerequisitesOf,
  topicOf,
  topicShort,
} from '../lib/graph';
import { color, stroke } from '../lib/theme';
import { RULE_LINE, stateWord, type DockView, type MapView } from './model';

function Panel({
  title,
  height,
  onClose,
  children,
}: {
  title: string;
  height: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close panel"
      />
      <View style={[styles.panel, { height: height + insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Txt>
          <Button kind="text" label="Close" onPress={onClose} />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 16 + insets.bottom,
            gap: 12,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const MARKS: {
  word: string;
  meaning: string;
  tile: TileState;
  match: (t: TileState) => boolean;
}[] = [
  {
    word: 'LOCKED',
    meaning: 'Needs a prerequisite Learned first.',
    tile: { level: 'none', locked: true, due: false, justUnlocked: false },
    match: (t) => t.locked && t.level === 'none',
  },
  {
    word: 'OPEN',
    meaning: 'Ready to start.',
    tile: { level: 'none', locked: false, due: false, justUnlocked: false },
    match: (t) => !t.locked && t.level === 'none',
  },
  {
    word: 'SEEN',
    meaning: 'Watched, not answered.',
    tile: { level: 'seen', locked: false, due: false, justUnlocked: false },
    match: (t) => t.level === 'seen',
  },
  {
    word: 'CHECKED',
    meaning: 'One correct answer.',
    tile: { level: 'checked', locked: false, due: false, justUnlocked: false },
    match: (t) => t.level === 'checked',
  },
  {
    word: 'LEARNED',
    meaning: 'Correct again after a delay.',
    tile: { level: 'learned', locked: false, due: false, justUnlocked: false },
    match: (t) => t.level === 'learned',
  },
  {
    word: 'RETAINED',
    meaning: 'Two or more delayed reviews passed.',
    tile: { level: 'retained', locked: false, due: false, justUnlocked: false },
    match: (t) => t.level === 'retained',
  },
  {
    word: 'DUE',
    meaning: 'Review now: the folded corner.',
    tile: { level: 'checked', locked: false, due: true, justUnlocked: false },
    match: (t) => t.due,
  },
];

export function KeyPanel({ map, onClose }: { map: MapView; onClose: () => void }) {
  const tiles = map.topics.flatMap((t) => t.rows.map((r) => r.tile));
  return (
    <Panel title="Key" height={580} onClose={onClose}>
      {MARKS.map((m) => (
        <View
          key={m.word}
          style={styles.mark}
          accessible
          accessibilityLabel={`${m.word}, ${tiles.filter(m.match).length}. ${m.meaning}`}
        >
          <StateTile size={22} surface={color.bg.overlay} {...m.tile} />
          <Txt variant="tag" style={styles.word}>
            {m.word}
          </Txt>
          <Txt variant="dataS" tone="secondary" style={styles.count}>
            {tiles.filter(m.match).length}
          </Txt>
          <Txt variant="caption" tone="secondary" style={{ flex: 1 }}>
            {m.meaning}
          </Txt>
        </View>
      ))}
      <View style={styles.mark}>
        <StateTile
          size={22}
          surface={color.bg.overlay}
          level="none"
          locked={false}
          due={false}
          justUnlocked
        />
        <Txt variant="tag" style={styles.word}>
          NEW
        </Txt>
        <View style={styles.count} />
        <Txt variant="caption" tone="secondary" style={{ flex: 1 }}>
          Just opened.
        </Txt>
      </View>
      <View style={styles.mark}>
        <StateTile
          size={22}
          surface={color.bg.overlay}
          level="none"
          locked={false}
          due={false}
          justUnlocked={false}
          pin={1}
        />
        <Txt variant="tag" style={styles.word}>
          PIN
        </Txt>
        <View style={styles.count} />
        <Txt variant="caption" tone="secondary" style={{ flex: 1 }}>
          Suggestion order, or the steps to a locked concept.
        </Txt>
      </View>
      <Txt variant="bodyS">{RULE_LINE}</Txt>
    </Panel>
  );
}

export function DetailPanel({
  dock,
  onClose,
  onSelect,
  onAction,
}: {
  dock: DockView;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAction: (d: DockView) => void;
}) {
  const id = dock.conceptId;
  const tile = engine.tile(id);
  const related = (ids: string[], heading: string) =>
    ids.length > 0 && (
      <View style={{ gap: 4 }}>
        <Txt variant="label" tone="secondary">
          {heading}
        </Txt>
        {ids.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            onPress={() => onSelect(c)}
            style={styles.link}
          >
            <StateTile size={18} surface={color.bg.overlay} {...engine.tile(c)} />
            <Txt variant="rowTitle" style={{ flex: 1 }}>
              {conceptTitle(c)}
            </Txt>
            <Txt variant="tag" tone={stateWord(engine.tile(c)).tone}>
              {stateWord(engine.tile(c)).word}
            </Txt>
          </Pressable>
        ))}
      </View>
    );
  return (
    <Panel title={dock.title} height={460} onClose={onClose}>
      <Txt variant="caption" tone="secondary">
        {topicShort(topicOf(id).id)} · {stateWord(tile).word.toLowerCase()}
        {engine.box(id) > 0 ? `, box ${engine.box(id)}` : ''}
      </Txt>
      <Txt variant="bodyS">{conceptSummary(id)}</Txt>
      {related(prerequisitesOf(id), 'Needs')}
      {related(dependentsOf(id), 'Opens')}
      {dock.button && (
        <Button kind={dock.button.kind} label={dock.button.label} onPress={() => onAction(dock)} />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg.overlay,
    borderTopWidth: stroke.rule,
    borderTopColor: color.line.hairline,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  word: { width: 72 },
  count: { width: 24, textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
});
