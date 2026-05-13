// Feed chrome, mounted once outside the pager (docs/PERFORMANCE.md 2.1):
// the running head and Sound control, the reason strip with the progress
// line, and the action row. It follows the active item.
import { copy } from '@reels/agent';
import type { FeedLayout } from '@reels/tokens';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { StateTile } from '../components/StateTile';
import { Txt } from '../components/Txt';
import { conceptTitle, topicOf, topicShort } from '../lib/graph';
import { color, fontScaleCap, size, stroke, topRowHeight } from '../lib/theme';
import { useApp } from '../lib/store';
import type { CardSlot, ReelSlot } from '../lib/types';
import { checkAnswer, leaveCard } from './cards';
import { noteInput, progress } from './controller';
import { cat, engine } from './engine';
import { confirmLeave } from './gap';
import { setMutedAll } from './players';
import { reasonSegments } from './reasonCopy';

interface Props {
  layout: FeedLayout;
  topInset: number;
  height: number;
}

export function Chrome({ layout, topInset, height }: Props) {
  const slot = useApp((s) => s.slots[s.activeIndex] ?? null);
  if (!slot) return null;
  const actions = slot.kind === 'card' ? size.cardActions : size.actions;
  const stripTop = height - actions - layout.strip;
  return (
    <>
      {slot.kind === 'reel' && <TopRow slot={slot} top={topInset} axis={layout.axis} />}
      {slot.kind !== 'summary' && (
        <ReasonStrip slot={slot} top={stripTop} height={layout.strip} axis={layout.axis} />
      )}
      {slot.kind !== 'summary' && (
        <View style={[styles.actions, { top: height - actions, height: actions }]}>
          {slot.kind === 'card' ? (
            <CardActions slot={slot} axis={layout.axis} />
          ) : (
            <QuickActions slot={slot} />
          )}
        </View>
      )}
    </>
  );
}

function TopRow({ slot, top, axis }: { slot: ReelSlot; top: number; axis: number }) {
  const soundOn = useApp((s) => s.settings.soundOn);
  // Re-read the tile whenever the learner state changes.
  useApp((s) => s.learner);
  const topic = topicOf(slot.conceptId);
  return (
    <View style={[styles.topRow, { top, height: topRowHeight, paddingLeft: axis }]}>
      <Pressable
        style={styles.head}
        accessibilityRole="button"
        accessibilityLabel={`${conceptTitle(slot.conceptId)} in ${topicShort(topic.id)}. Opens the concept and the transcript.`}
        onPress={() => useApp.getState().setPanel('concept')}
      >
        <StateTile size={18} surface={color.bg.base} {...engine.tile(slot.conceptId)} />
        <Txt
          variant="heading"
          numberOfLines={1}
          maxScale={fontScaleCap.runningHead}
          style={styles.headText}
        >
          {conceptTitle(slot.conceptId)}
          <Txt variant="heading" tone="secondary" maxScale={fontScaleCap.runningHead}>
            {` in ${topicShort(topic.id)}`}
          </Txt>
        </Txt>
      </Pressable>
      <Pressable
        style={styles.sound}
        accessibilityRole="switch"
        accessibilityState={{ checked: soundOn }}
        accessibilityLabel="Sound"
        onPress={() => {
          const next = !soundOn;
          setMutedAll(!next);
          const app = useApp.getState();
          app.updateSettings({ soundOn: next });
          app.log({ type: 'sound_changed', muted: !next });
          noteInput();
        }}
      >
        <Icon name={soundOn ? 'soundOn' : 'soundOff'} size={18} />
        <Txt variant="micro" maxScale={fontScaleCap.chromeLabel}>
          {soundOn ? 'Sound on' : 'Sound off'}
        </Txt>
      </Pressable>
    </View>
  );
}

function ReasonStrip({
  slot,
  top,
  height,
  axis,
}: {
  slot: ReelSlot | CardSlot;
  top: number;
  height: number;
  axis: number;
}) {
  const notice = useApp((s) => s.notice);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => {
        if (useApp.getState().notice === notice) useApp.getState().setNotice(null);
      },
      Math.max(0, notice.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [notice]);

  const segments = reasonSegments(slot);
  const lead = segments[0]?.lead ? segments[0] : null;
  return (
    <View style={[styles.strip, { top, height }]}>
      <View style={styles.track}>
        {slot.kind === 'reel' && <Animated.View style={[styles.fill, fill]} />}
      </View>
      <Pressable
        style={[styles.stripBody, { paddingLeft: axis, paddingRight: axis }]}
        accessibilityRole="button"
        accessibilityLabel={
          notice
            ? copy.plain(notice.segments) + (notice.undo ? ` ${copy.UNDO}` : '')
            : copy.stripText(slot, cat())
        }
        onPress={() => {
          if (notice?.undo) {
            notice.undo();
            return;
          }
          useApp.getState().setPanel('reason');
        }}
      >
        {notice ? (
          <Txt
            variant="sentence"
            tone="secondary"
            maxScale={fontScaleCap.strip}
            style={{ flex: 1 }}
          >
            {notice.segments.map((s, i) => (
              <Txt
                key={i}
                variant={s.strong ? 'sentenceStrong' : 'sentence'}
                tone={s.strong ? 'primary' : 'secondary'}
                maxScale={fontScaleCap.strip}
              >
                {s.text}
              </Txt>
            ))}
            {notice.undo ? (
              <Txt variant="sentenceStrong" style={styles.underline} maxScale={fontScaleCap.strip}>
                {` ${copy.UNDO}`}
              </Txt>
            ) : null}
          </Txt>
        ) : (
          <>
            {lead?.icon && (
              <Icon name={lead.icon} size={18} tint={lead.due ? color.due : color.text.primary} />
            )}
            <Txt
              variant="sentence"
              tone="secondary"
              maxScale={fontScaleCap.strip}
              style={{ flex: 1 }}
            >
              {segments.map((s, i) => (
                <Txt
                  key={i}
                  variant={s.strong || s.lead ? 'sentenceStrong' : 'sentence'}
                  tone={
                    s.changed
                      ? 'inverse'
                      : s.lead && s.due
                        ? 'due'
                        : s.strong || s.lead
                          ? 'primary'
                          : 'secondary'
                  }
                  maxScale={fontScaleCap.strip}
                  style={s.changed ? styles.changed : undefined}
                >
                  {s.text}
                </Txt>
              ))}
            </Txt>
            <Icon name="chevronRight" size={13} tint={color.text.secondary} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function QuickActions({ slot }: { slot: ReelSlot }) {
  if (slot.gap) return <GapRow label={copy.gapCounter(slot.gap)} />;
  const fire = (action: 'more_like_this' | 'too_easy' | 'not_for_me') => {
    const app = useApp.getState();
    noteInput();
    if (app.settings.haptics) {
      if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click);
    }
    let confirmation;
    try {
      confirmation = engine.quickAction(slot, action);
    } catch (error) {
      console.warn('quick action failed', error);
      return;
    }
    app.log({ type: 'quick_action', reel_id: slot.reelId, concept_id: slot.conceptId, action });
    const notice = {
      segments: copy.confirmationText(confirmation, cat()),
      until: Date.now() + 4000,
      undo: () => {
        try {
          engine.undoQuickAction(slot);
        } catch (error) {
          console.warn('undo failed', error);
          return;
        }
        const a = useApp.getState();
        a.log({
          type: 'quick_action_undone',
          reel_id: slot.reelId,
          concept_id: slot.conceptId,
          action,
        });
        a.setNotice({ segments: [{ text: copy.UNDONE }], until: Date.now() + 2000 });
        a.flush();
      },
    };
    app.setNotice(notice);
    app.flush();
  };
  return (
    <View style={styles.quick}>
      <QuickCell
        icon="moreLikeThis"
        label={copy.QUICK_ACTION_LABELS.more_like_this}
        onPress={() => fire('more_like_this')}
      />
      <QuickCell
        icon="tooEasy"
        label={copy.QUICK_ACTION_LABELS.too_easy}
        onPress={() => fire('too_easy')}
      />
      <QuickCell
        icon="notForMe"
        label={copy.QUICK_ACTION_LABELS.not_for_me}
        onPress={() => fire('not_for_me')}
      />
    </View>
  );
}

/** In a gap session the action row is the only counter on screen, with "Leave session" (UX.md 3.6). */
function GapRow({ label }: { label: string }) {
  return (
    <View style={styles.gapRow}>
      <Txt variant="captionStrong" tone="secondary" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Button kind="text" label={copy.QUIZ.leaveSession} onPress={confirmLeave} />
    </View>
  );
}

function QuickCell({
  icon,
  label,
  onPress,
}: {
  icon: 'moreLikeThis' | 'tooEasy' | 'notForMe';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quickCell, pressed && { backgroundColor: color.bg.overlay }]}
    >
      <Icon name={icon} size={18} />
      <Txt variant="captionStrong" maxScale={fontScaleCap.chromeLabel} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

function CardActions({ slot, axis }: { slot: CardSlot; axis: number }) {
  const card = useApp((s) => (s.card?.key === slot.key ? s.card : null));
  const answered = !!card?.result;
  return (
    <View style={[styles.cardActions, { paddingHorizontal: axis }]}>
      {!answered &&
        (slot.gap ? (
          <Button kind="text" label={copy.QUIZ.leaveSession} onPress={confirmLeave} />
        ) : (
          <Button kind="text" label={copy.QUIZ.later} onPress={() => leaveCard('later')} />
        ))}
      <Button
        style={{ flex: 1 }}
        label={answered ? copy.QUIZ.continue : copy.QUIZ.check}
        disabled={!answered && card?.selected == null}
        onPress={answered ? () => leaveCard('continue') : checkAnswer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bg.base,
  },
  head: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  headText: { flexShrink: 1 },
  sound: {
    width: size.sound,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  strip: { position: 'absolute', left: 0, right: 0, backgroundColor: color.bg.base },
  track: { height: stroke.track, backgroundColor: color.line.hairline, overflow: 'hidden' },
  fill: {
    height: stroke.track,
    width: '100%',
    backgroundColor: color.text.primary,
    transformOrigin: 'left',
  },
  stripBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  underline: { textDecorationLine: 'underline' },
  changed: { backgroundColor: color.text.primary },
  actions: { position: 'absolute', left: 0, right: 0, backgroundColor: color.bg.base },
  quick: { flex: 1, flexDirection: 'row' },
  quickCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  gapRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: size.gutter,
    paddingRight: 8,
  },
  cardActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
