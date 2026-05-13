// The rail: the staged topic's concepts in rail order, with connectors drawn
// per row (DESIGN.md Components, "Rail row and connectors"). Rows grow with
// their text and are never measured.
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { color, fontScaleCap, size } from '../lib/theme';
import { railGuides, type Guide } from './guides';
import { PopTile } from './PopTile';
import { stateWord, type RailRow, type TopicView } from './model';

const LEVEL = 20;
const TILE = 22;
const TILE_TOP = 13;
const TILE_CENTRE = TILE_TOP + TILE / 2;
const DASH = 6;
const GAP = 4;

interface Props {
  topic: TopicView;
  selectedId: string | null;
  pins: Map<string, number>;
  bottomInset: number;
  onSelect: (conceptId: string) => void;
}

export function Rail({ topic, selectedId, pins, bottomInset, onSelect }: Props) {
  const { fontScale } = useWindowDimensions();
  const statusWidth = Math.round(6 + 58.1 * Math.min(Math.max(fontScale, 1), 1.3));
  const guides = useMemo(() => {
    const lit = new Map(
      topic.rows.map((r) => [
        r.conceptId,
        r.tile.level === 'learned' || r.tile.level === 'retained',
      ]),
    );
    return railGuides(topic.rows, (id) => lit.get(id) ?? false);
  }, [topic.rows]);
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottomInset }}
      showsVerticalScrollIndicator={false}
    >
      {topic.rows.map((row, i) => (
        <RailRowView
          key={row.conceptId}
          row={row}
          guides={guides[i] ?? []}
          selected={row.conceptId === selectedId}
          pin={pins.get(row.conceptId)}
          statusWidth={statusWidth}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

const RailRowView = memo(function RailRowView({
  row,
  guides,
  selected,
  pin,
  statusWidth,
  onSelect,
}: {
  row: RailRow;
  guides: Guide[];
  selected: boolean;
  pin: number | undefined;
  statusWidth: number;
  onSelect: (conceptId: string) => void;
}) {
  const status = stateWord(row.tile);
  const surface = selected ? color.bg.overlay : color.bg.raised;
  const needs = row.needs.join('. ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${row.title}, ${status.word.toLowerCase()}${needs ? `. ${needs}` : ''}`}
      onPress={() => onSelect(row.conceptId)}
      style={[
        styles.row,
        {
          minHeight: row.needs.length ? size.railRowNeeds : size.railRow,
          backgroundColor: surface,
        },
      ]}
    >
      {guides.map((g, n) => (
        <GuidePiece key={n} guide={g} />
      ))}
      <View style={{ width: row.depth * LEVEL }} />
      <View style={{ paddingTop: TILE_TOP }}>
        <PopTile size={22} surface={surface} {...row.tile} selected={selected} pin={pin} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Txt
            variant="rowTitle"
            tone={row.tile.locked && row.tile.level === 'none' ? 'secondary' : 'primary'}
            style={{ flex: 1 }}
          >
            {row.title}
          </Txt>
          <View style={[styles.status, { width: statusWidth }]}>
            {status.due && <Icon name="clock" size={11} tint={color.due} />}
            <Txt variant="tag" tone={status.tone} maxScale={fontScaleCap.tag} numberOfLines={1}>
              {status.word}
            </Txt>
          </View>
        </View>
        {row.needs.map((line) => (
          <Txt key={line} variant="caption" tone="secondary" style={styles.needs}>
            {line}
          </Txt>
        ))}
      </View>
    </Pressable>
  );
});

/** One connector piece, positioned on its column inside the row. */
function GuidePiece({ guide }: { guide: Guide }) {
  const x = size.gutter + guide.column * LEVEL + TILE / 2;
  const width = guide.lit ? 2 : 1;
  const tint = guide.lit ? color.proven.base : color.line.control;
  const vertical = (top: number | undefined, bottom: number | undefined, height?: number) => (
    <View
      style={{
        position: 'absolute',
        left: x - width / 2,
        width,
        top,
        bottom,
        height,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      {guide.lit ? (
        <View style={{ flex: 1, backgroundColor: tint }} />
      ) : (
        // Dashes as short Views (6 on, 4 off): enough for the tallest row, clipped.
        Array.from({ length: 24 }, (_, i) => (
          <View key={i} style={{ width, height: DASH, marginBottom: GAP, backgroundColor: tint }} />
        ))
      )}
    </View>
  );
  if (guide.kind === 'through') return vertical(0, 0);
  if (guide.kind === 'start') return vertical(TILE_TOP + TILE + 2, 0);
  // end: down to the tile's centre, then the elbow into the child's tile.
  const elbow = LEVEL - TILE / 2 - 1;
  return (
    <>
      {vertical(0, undefined, TILE_CENTRE)}
      {/* The elbow is shorter than one dash, so it is solid in both states. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x,
          top: TILE_CENTRE - width / 2,
          width: elbow,
          height: width,
          backgroundColor: tint,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: size.gutter },
  text: { flex: 1, marginLeft: 10, paddingTop: 14, paddingBottom: 14 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  status: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 3,
    paddingTop: 3,
  },
  needs: { marginTop: 2 },
});
