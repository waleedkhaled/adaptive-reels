// The feed: one vertical pager of reels, retrieval cards and summary items
// (docs/PERFORMANCE.md 2.1), with the chrome mounted once above it.
import { feedFit } from '@reels/tokens';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  FlatList,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, size } from '../lib/theme';
import { useApp } from '../lib/store';
import type { FeedSlot } from '../lib/types';
import { CardCell } from './CardCell';
import { cardShown } from './cards';
import { Chrome } from './Chrome';
import {
  activate,
  attachPlayerListeners,
  endSessionImpression,
  resume,
  settle,
  suspend,
} from './controller';
import { isFeedVisible, setFeedFocused, setForeground } from './visibility';
import { engine, setMoving } from './engine';
import { pagerRef } from './pagerRef';
import { Panels } from './Panels';
import { ReelCell } from './ReelCell';
import { resumeProfile } from './session';
import { SummaryCell, summaryShown } from './SummaryCell';

const keyExtractor = (slot: FeedSlot) => slot.key;

function firstVisible(viewableItems: ViewToken<FeedSlot>[]): number | null {
  const v = viewableItems.find((t) => t.isViewable && t.index !== null);
  return v?.index ?? null;
}

/** Settle the pending item when the feed is on screen, else just resume playback. */
function startOrResume() {
  const app = useApp.getState();
  if (!isFeedVisible() || app.slots.length === 0) return;
  if (app.settledIndex === -1) {
    activate(app.activeIndex);
    onSettleIndex(app.activeIndex);
  } else resume();
}

function onSettleIndex(index: number) {
  // A drag that snapped back to the same page: nothing to settle, the list is still.
  if (index === useApp.getState().settledIndex) {
    setMoving(false);
    return;
  }
  const slot = settle(index);
  if (slot?.kind === 'card') cardShown(slot);
  else if (slot?.kind === 'summary') summaryShown(slot);
}

// FlatList rejects new viewability pairs on a mounted list. A Fast Refresh of
// this module builds new ones, so the list's key changes with the module and
// the list remounts instead (development only: in production this runs once).
const listKey = `feed-${Date.now().toString(36)}`;

const viewabilityPairs = [
  {
    viewabilityConfig: { itemVisiblePercentThreshold: 60, minimumViewTime: 0 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<FeedSlot>[] }) => {
      const i = firstVisible(viewableItems);
      if (i !== null && isFeedVisible()) activate(i);
    },
  },
  {
    viewabilityConfig: { itemVisiblePercentThreshold: 95, minimumViewTime: 100 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<FeedSlot>[] }) => {
      const i = firstVisible(viewableItems);
      if (i !== null && isFeedVisible()) onSettleIndex(i);
    },
  },
];

export function Feed() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const slots = useApp((s) => s.slots);
  const listGen = useApp((s) => s.listGen);
  const inGap = useApp((s) => !!s.learner?.gap);
  // Cards and the session summary hold the pager until their buttons are used.
  const locked = useApp(
    (s) => s.slots[s.settledIndex]?.kind === 'card' || s.slots[s.settledIndex]?.kind === 'summary',
  );
  const [height, setHeight] = useState(0);

  const layout = useMemo(
    () =>
      feedFit(
        { width: window.width, height: window.height },
        { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
        window.fontScale,
        Platform.OS === 'android' ? 'android' : 'ios',
        inGap ? 0 : 48,
      ),
    [
      window.width,
      window.height,
      window.fontScale,
      insets.top,
      insets.bottom,
      insets.left,
      insets.right,
      inGap,
    ],
  );

  useEffect(() => {
    attachPlayerListeners();
  }, []);

  useEffect(() => {
    startOrResume();
  }, [slots.length, listGen]);

  useFocusEffect(
    useCallback(() => {
      setFeedFocused(true);
      startOrResume();
      return () => {
        setFeedFocused(false);
        suspend();
        useApp.getState().flush();
      };
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state === 'active') {
        // Back after 30 minutes away: a new session (UX.md 3.7).
        if (engine.sessionExpired()) {
          endSessionImpression();
          resumeProfile();
        } else startOrResume();
      } else {
        suspend();
        useApp.getState().flush();
      }
    });
    return () => sub.remove();
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedSlot; index: number }) => {
      if (item.kind === 'reel')
        return <ReelCell slot={item} index={index} height={height} layout={layout} />;
      if (item.kind === 'card') {
        return (
          <CardCell
            slot={item}
            index={index}
            height={height}
            layout={layout}
            topInset={insets.top}
            bottomChrome={layout.strip + size.cardActions}
          />
        );
      }
      return (
        <SummaryCell
          slot={item}
          index={index}
          height={height}
          layout={layout}
          topInset={insets.top}
        />
      );
    },
    [height, layout, insets.top],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<FeedSlot> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  return (
    <View style={styles.root} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {height > 0 && (
        <FlatList
          key={`${listKey}-${listGen}`}
          ref={pagerRef}
          // Read once at mount: a remount (above) keeps the learner's place.
          initialScrollIndex={Math.max(0, useApp.getState().activeIndex)}
          data={slots}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          pagingEnabled
          windowSize={5}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          scrollsToTop={false}
          scrollEnabled={!locked}
          viewabilityConfigCallbackPairs={viewabilityPairs}
          onScrollBeginDrag={() => setMoving(true)}
          onMomentumScrollEnd={() => setMoving(false)}
          decelerationRate="fast"
        />
      )}
      {height > 0 && <Chrome layout={layout} topInset={insets.top} height={height} />}
      <Panels />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.base },
});
