// Knowledge map (UX.md 3.5): a pushed route with no tab bar. Matrix of five
// topic rows, the staged topic's rail, and the dock with what to do next.
import * as agent from '@reels/agent';
import { mapFit } from '@reels/tokens';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type Text,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { motionMode } from '../lib/a11y';
import { topicOf } from '../lib/graph';
import { color, motion, size, stroke } from '../lib/theme';
import { useApp } from '../lib/store';
import { cat } from '../feed/engine';
import { startGapFromMap } from '../feed/gap';
import { Dock } from '../map/Dock';
import { DetailPanel, KeyPanel } from '../map/MapPanels';
import { Matrix } from '../map/Matrix';
import {
  dockView,
  gapPins,
  LEGEND_LINE,
  mapView,
  markMapSeen,
  stageNeed,
  type DockView,
} from '../map/model';
import { Rail } from '../map/Rail';
import { planReplay, replayView, useReplayStep } from '../map/replay';

/** The last concept selected on the map, for "staged topic on open". */
let lastSelected: string | null = null;

function dockHeight(dock: DockView): number {
  const lines = Math.min(dock.lines.length, 3);
  return dock.button ? 136 + 18 * lines : 80 + 18 * lines + 32;
}

const SOURCES = ['tab', 'progress_panel', 'summary', 'map_review'] as const;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const source = SOURCES.find((x) => x === from) ?? 'tab';
  const window = useWindowDimensions();
  const reduceMotion = useApp((s) => s.reduceMotion);
  const sample = useApp((s) => !!s.learner?.sample);
  // The map reads the learner state when it opens and whenever it regains focus.
  const [map, setMap] = useState(mapView);
  useFocusEffect(useCallback(() => setMap(mapView()), []));
  // The replay, planned once from the last-visit snapshot (UX.md 3.5).
  const [replay] = useState(() => {
    const learner = useApp.getState().learner;
    if (!learner) return null;
    const changes = agent.mapChanges(learner, cat());
    const old = (learner.map_seen?.levels ?? {}) as Record<
      string,
      'none' | 'seen' | 'checked' | 'learned' | 'retained'
    >;
    const plan = planReplay(
      map.topics.find((t) => t.id === map.stagedTopicId),
      changes,
      old,
    );
    return { plan, changed: changes.levelChanged };
  });
  const step = useReplayStep(replay?.plan ?? null, reduceMotion);
  const shown = useMemo(() => replayView(map, replay?.plan ?? null, step), [map, replay, step]);
  // Staged topic on open: the latest level change, else the last selection, else suggestion 1's.
  const [staged, setStaged] = useState(() => {
    if (map.stagedTopicId) return map.stagedTopicId;
    const first = lastSelected ?? map.suggestions[0];
    return first ? topicOf(first).id : (map.topics[0]?.id ?? '');
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [rank, setRank] = useState(0);
  const [panel, setPanel] = useState<'none' | 'key' | 'detail'>('none');
  // Changing topic moves screen-reader focus to the stage header (UX.md 3.5).
  const stageTitle = useRef<Text>(null);
  const focusStage = useRef(false);
  useEffect(() => {
    if (!focusStage.current || !stageTitle.current) return;
    focusStage.current = false;
    AccessibilityInfo.sendAccessibilityEvent(stageTitle.current, 'focus');
  }, [staged]);
  const stageTopic = (topicId: string) => {
    focusStage.current = true;
    setStaged(topicId);
  };

  // Leaving the map stores what it looked like, so the next visit marks only new changes.
  useEffect(() => {
    useApp.setState({ mapChanged: 0 });
    useApp.getState().log({
      type: 'map_opened',
      source,
      replayed: !!replay?.plan,
      staged_topic_id: staged,
      changed_concept_ids: replay?.changed ?? [],
    });
    return () => markMapSeen();
    // Logged once per open, with the state the map opened in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit once on open: the mode never changes while the map is open.
  const [fit] = useState(() => {
    const topic = shown.topics.find((t) => t.id === staged) ?? shown.topics[0]!;
    return mapFit(
      { width: window.width, height: window.height },
      { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
      window.fontScale,
      Platform.OS === 'android' ? 'android' : 'ios',
      stageNeed(topic),
      sample,
    );
  });

  const topic = map.topics.find((t) => t.id === staged) ?? map.topics[0]!;
  const shownId =
    selected ?? map.suggestions[rank] ?? map.suggestions[0] ?? topic.rows[0]?.conceptId ?? null;
  const dock = shownId ? dockView(shownId) : null;
  const shownRank = shownId ? map.suggestions.indexOf(shownId) : -1;

  // One pin set at a time: a selected locked concept's chain, else the suggestion ranks.
  const pins = useMemo(() => {
    const m = new Map<string, number>();
    const chainFor =
      selected &&
      map.topics.some((t) => t.rows.some((r) => r.conceptId === selected && r.tile.locked));
    if (selected && chainFor) gapPins(selected).forEach((c, i) => m.set(c, i + 1));
    else map.suggestions.forEach((c, i) => m.set(c, i + 1));
    return m;
  }, [map, selected]);

  const selectConcept = (conceptId: string) => {
    lastSelected = conceptId;
    setSelected(conceptId);
    setStaged(topicOf(conceptId).id);
    setPanel('none');
  };
  const stepTopic = (delta: -1 | 1) => {
    const i = map.topics.findIndex((t) => t.id === staged);
    const next = map.topics[(i + delta + map.topics.length) % map.topics.length];
    if (next) stageTopic(next.id);
  };
  const act = (d: DockView) => {
    setPanel('none');
    startGapFromMap(d.conceptId, d.button?.action ?? 'gap');
  };

  const compact = fit.mode !== 'full';
  const learnedTone = map.learned > 0 ? 'proven' : 'secondary';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { height: fit.header }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Icon name="chevronLeft" size={22} />
        </Pressable>
        <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
          Knowledge map
        </Txt>
        {compact ? (
          <Button kind="text" label="Key" onPress={() => setPanel('key')} />
        ) : (
          window.width >= 375 && (
            <Txt variant="caption" tone="secondary" style={{ marginRight: 8 }}>
              {map.watched} watched
            </Txt>
          )
        )}
        <Txt variant="dataS" tone={learnedTone}>
          {map.learned}/{map.total}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {' learned'}
        </Txt>
      </View>

      {fit.sampleBand > 0 && (
        <View style={[styles.sampleBand, { height: fit.sampleBand }]}>
          <View style={styles.sampleTag}>
            <Txt variant="tag" tone="inverse">
              Sample data
            </Txt>
          </View>
        </View>
      )}
      {compact ? (
        <View style={[styles.legendLine, { height: fit.legend }]}>
          <Txt variant="caption" tone="secondary" numberOfLines={1}>
            {LEGEND_LINE}
          </Txt>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${LEGEND_LINE} Key`}
          onPress={() => setPanel('key')}
          style={[styles.legend, { height: fit.legend }]}
        >
          <Txt variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
            {LEGEND_LINE}
          </Txt>
          <Txt variant="captionStrong">Key</Txt>
          <Icon name="chevronRight" size={13} tint={color.text.secondary} />
        </Pressable>
      )}

      <Matrix
        topics={shown.topics}
        fit={fit}
        stagedId={staged}
        selectedId={selected}
        pins={pins}
        changed={new Set(map.changedTopics)}
        onTopic={stageTopic}
        onConcept={(c) => selectConcept(c)}
      />

      <View style={styles.stage}>
        <View style={styles.stageHeader}>
          <Txt
            ref={stageTitle}
            variant="heading"
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {topic.title}
          </Txt>
          <Txt
            variant="dataS"
            tone={topic.learned > 0 ? 'proven' : 'secondary'}
            style={{ marginLeft: 8, flex: 1 }}
          >
            {topic.learned}/{topic.rows.length}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous topic"
            onPress={() => stepTopic(-1)}
            style={styles.chevron}
          >
            <Icon name="chevronLeft" size={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next topic"
            onPress={() => stepTopic(1)}
            style={styles.chevron}
          >
            <Icon name="chevronRight" size={18} />
          </Pressable>
        </View>
        <Animated.View
          key={topic.id}
          entering={FadeIn.duration(motion.color.slow).reduceMotion(motionMode(reduceMotion))}
          style={{ flex: 1 }}
        >
          <Rail
            topic={topic}
            selectedId={selected}
            pins={pins}
            bottomInset={(dock ? dockHeight(dock) : 0) + insets.bottom}
            onSelect={selectConcept}
          />
        </Animated.View>
      </View>

      {dock && step === 'done' && (
        <Dock
          dock={dock}
          rank={shownRank >= 0 ? shownRank + 1 : null}
          count={map.suggestions.length}
          pin={pins.get(dock.conceptId)}
          bottomInset={insets.bottom}
          onStep={(d) => {
            setSelected(null);
            setRank((r) => (r + d + map.suggestions.length) % Math.max(1, map.suggestions.length));
          }}
          onNextUp={() => {
            setSelected(null);
            setRank(0);
          }}
          onDetail={() => setPanel('detail')}
          onAction={act}
        />
      )}

      {panel === 'key' && <KeyPanel map={map} onClose={() => setPanel('none')} />}
      {panel === 'detail' && dock && (
        <DetailPanel
          dock={dock}
          onClose={() => setPanel('none')}
          onSelect={selectConcept}
          onAction={act}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.base },
  header: { flexDirection: 'row', alignItems: 'center', paddingRight: size.gutter },
  back: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: size.gutter },
  legendLine: { justifyContent: 'center', paddingHorizontal: size.gutter },
  sampleBand: { justifyContent: 'center', paddingHorizontal: size.gutter },
  sampleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: color.text.primary,
  },
  stage: {
    flex: 1,
    backgroundColor: color.bg.raised,
    borderTopWidth: stroke.current,
    borderTopColor: color.text.primary,
  },
  stageHeader: { height: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: size.gutter },
  chevron: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
