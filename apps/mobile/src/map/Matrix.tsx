// The matrix: five topic rows, each one tab-role target (DESIGN.md Components,
// "Matrix row and tile"). Eight tiles in rail order; a tap on a tile selects
// its concept too. The selected row shares the stage's surface.
import type { MapLayout } from '@reels/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { color, fontScaleCap, size } from '../lib/theme';
import type { TopicView } from './model';
import { PopTile } from './PopTile';

interface Props {
  topics: TopicView[];
  fit: MapLayout;
  stagedId: string;
  selectedId: string | null;
  pins: Map<string, number>;
  changed: Set<string>;
  onTopic: (topicId: string) => void;
  onConcept: (conceptId: string, topicId: string) => void;
}

export function Matrix({
  topics,
  fit,
  stagedId,
  selectedId,
  pins,
  changed,
  onTopic,
  onConcept,
}: Props) {
  if (fit.mode === 'tabs') {
    return (
      <View style={[styles.tabs, { height: fit.matrixHeight }]} accessibilityRole="tablist">
        {topics.map((t) => {
          const on = t.id === stagedId;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.title}, ${t.learned} of ${t.rows.length} learned${t.due ? `, ${t.due} due` : ''}`}
              onPress={() => onTopic(t.id)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Txt
                variant="label"
                tone={on ? 'primary' : 'secondary'}
                numberOfLines={2}
                maxScale={1.1}
                style={{ textAlign: 'center' }}
              >
                {t.short}
              </Txt>
              <View style={styles.tabCount}>
                {t.due > 0 && <Icon name="clock" size={13} tint={color.due} />}
                <Txt variant="dataS" tone="secondary" maxScale={1.1}>
                  {t.learned}/{t.rows.length}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View accessibilityRole="tablist">
      {topics.map((t) => {
        const on = t.id === stagedId;
        const surface = on ? color.bg.raised : color.bg.base;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.title}, ${t.learned} of ${t.rows.length} learned${t.due ? `, ${t.due} due` : ''}${changed.has(t.id) ? ', changed' : ''}`}
            onPress={() => onTopic(t.id)}
            style={[styles.row, { height: fit.matrixRow, backgroundColor: surface }]}
          >
            <View style={styles.caretSlot}>{on && <View style={styles.caret} />}</View>
            <View style={styles.label}>
              <Txt
                variant="label"
                tone={on ? 'primary' : 'secondary'}
                numberOfLines={2}
                maxScale={fontScaleCap.matrix}
                style={{ flexShrink: 1 }}
              >
                {t.short}
              </Txt>
              {changed.has(t.id) && <View style={styles.changed} />}
            </View>
            <View
              style={styles.tiles}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {t.rows.map((r) => (
                <Pressable
                  key={r.conceptId}
                  onPress={() => onConcept(r.conceptId, t.id)}
                  style={{
                    width: fit.pitch,
                    height: fit.matrixRow,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PopTile
                    size={fit.tile}
                    surface={surface}
                    {...r.tile}
                    selected={r.conceptId === selectedId}
                    pin={pins.get(r.conceptId)}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.count}>
              <Txt
                variant="dataS"
                tone={t.learned > 0 ? 'proven' : 'secondary'}
                maxScale={fontScaleCap.matrix}
              >
                {t.learned}/{t.rows.length}
              </Txt>
              {t.due > 0 && (
                <View style={styles.dueCount}>
                  <Icon name="clock" size={13} tint={color.due} />
                  <Txt variant="dataS" tone="due" maxScale={fontScaleCap.matrix}>
                    {t.due}
                  </Txt>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: size.gutter },
  caretSlot: { width: size.gutter, alignItems: 'center', justifyContent: 'center' },
  // An 8 pt triangle pointing at the row's label.
  caret: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: color.text.primary,
  },
  label: { width: 88, flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  changed: { width: 8, height: 8, backgroundColor: color.text.primary },
  // Pitch includes the 6 pt gap, so the outer tiles sit 3 pt in from the column edges.
  tiles: { flexDirection: 'row', marginHorizontal: -3 },
  count: { width: 32, marginLeft: 8, alignItems: 'flex-end', justifyContent: 'center' },
  dueCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tabs: { flexDirection: 'row' },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  tabOn: {
    backgroundColor: color.bg.raised,
    borderTopWidth: 2,
    borderTopColor: color.text.primary,
  },
  tabCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
