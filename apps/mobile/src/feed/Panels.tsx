// In-screen panels over the feed (never native sheets): the reason panel and
// the concept panel with the scalable transcript (UX.md 3.2, DESIGN.md Panel).
import { nextDueAt } from '@reels/agent';
import { useEffect, useRef } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Txt } from '../components/Txt';
import { conceptTitle, topicOf, topicShort } from '../lib/graph';
import { graph } from '../lib/library';
import { color, stroke } from '../lib/theme';
import { useApp } from '../lib/store';
import { noteInput } from './controller';
import { reasonPanelLines } from './reasonCopy';

const HEIGHT = { reason: 240, concept: 340 } as const;

function reasonLines(slot: Parameters<typeof reasonPanelLines>[0]): string[] {
  const app = useApp.getState();
  const now = Date.now();
  return reasonPanelLines(slot, {
    now,
    nextDueAt: app.learner ? nextDueAt(app.learner, now) : null,
    demo: app.settings.clock === 'demo',
  });
}

export function Panels() {
  const panel = useApp((s) => s.panel);
  const slot = useApp((s) => s.slots[s.activeIndex] ?? null);
  const insets = useSafeAreaInsets();
  const scrolled = useRef(false);

  useEffect(() => {
    if (panel === 'none') return;
    noteInput();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      useApp.getState().setPanel('none');
      return true;
    });
    const app = useApp.getState();
    if (slot && slot.kind !== 'summary' && panel === 'reason') {
      app.log({
        type: 'reason_opened',
        item_id: slot.kind === 'card' ? slot.itemId : slot.reelId,
        code: slot.reason.code,
      });
    }
    scrolled.current = false;
    return () => {
      sub.remove();
      if (slot?.kind === 'reel' && panel === 'concept') {
        useApp.getState().log({
          type: 'concept_panel_opened',
          reel_id: slot.reelId,
          transcript_scrolled: scrolled.current,
        });
      }
    };
  }, [panel, slot]);

  if (panel === 'none' || !slot || slot.kind === 'summary') return null;
  const close = () => useApp.getState().setPanel('none');
  const reel = slot.kind === 'reel' ? useApp.getState().reels[slot.reelId] : undefined;
  const summary = graph.nodes.find((n) => n.id === slot.conceptId)?.summary ?? '';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close panel" />
      <View
        style={[styles.panel, { height: HEIGHT[panel] + insets.bottom }]}
        accessibilityViewIsModal
      >
        <View style={styles.header}>
          <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {panel === 'reason' ? 'Why this' : conceptTitle(slot.conceptId)}
          </Txt>
          <Button kind="text" label="Close" onPress={close} />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 16 + insets.bottom,
            gap: 8,
          }}
          onScrollBeginDrag={() => {
            scrolled.current = true;
          }}
        >
          {panel === 'reason' ? (
            reasonLines(slot).map((line) => (
              <Txt key={line} variant="bodyS">
                {line}
              </Txt>
            ))
          ) : (
            <>
              <Txt variant="caption" tone="secondary">
                {topicShort(topicOf(slot.conceptId).id)} · {summary}
              </Txt>
              {reel?.transcript ? (
                <Txt variant="bodyS">{reel.transcript}</Txt>
              ) : (
                <Txt variant="bodyS" tone="secondary">
                  The transcript appears here once the reels are re-rendered.
                </Txt>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
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
});
