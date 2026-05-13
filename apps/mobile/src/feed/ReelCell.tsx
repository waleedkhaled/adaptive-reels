// One reel page: the ground, the video (only near the active reel and only once
// its player holds this reel), a first-frame cover and the paused mark.
import type { FeedLayout } from '@reels/tokens';
import { VideoView } from 'expo-video';
import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { color, radius } from '../lib/theme';
import { POOL, useApp } from '../lib/store';
import type { FeedSlot, ReelSlot } from '../lib/types';
import { playIfReady, skipFailed, togglePause } from './controller';
import { noteFirstFrame, retryFailed } from './health';
import { slotFor } from './players';

interface Props {
  slot: ReelSlot;
  index: number;
  height: number;
  layout: FeedLayout;
}

export const ReelCell = memo(function ReelCell({ slot, index, height, layout }: Props) {
  const isActive = useApp((s) => s.activeIndex === index);
  const activeOrdinal = useApp((s) => activeReelOrdinal(s.slots, s.activeIndex));
  const holds = useApp((s) => s.loaded[slot.ordinal % POOL] === slot.reelId);
  const paused = useApp((s) => isActive && s.paused);
  const failed = useApp((s) => isActive && s.failed?.reelId === slot.reelId);
  const distance = activeOrdinal === null ? 99 : Math.abs(slot.ordinal - activeOrdinal);
  // iOS keeps the neighbours mounted for instant swipes; Android mounts the active reel only.
  const mount = holds && (Platform.OS === 'ios' ? distance <= 1 : distance === 0);
  const [covered, setCovered] = useState(true);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (mount) setCovered(true);
  }, [mount]);

  useEffect(() => {
    if (isActive && holds) playIfReady(slot);
  }, [isActive, holds, slot]);

  useEffect(() => {
    if (!isActive || !covered || paused) {
      setWaiting(false);
      return;
    }
    const timer = setTimeout(() => setWaiting(true), 400);
    return () => clearTimeout(timer);
  }, [isActive, covered, paused]);

  const { picture } = layout;
  return (
    <Pressable
      style={{ height, backgroundColor: color.bg.base }}
      onPress={isActive ? togglePause : undefined}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play' : 'Pause'}
      accessible={isActive}
    >
      {mount && (
        <VideoView
          player={slotFor(slot.ordinal).player}
          nativeControls={false}
          contentFit="contain"
          allowsVideoFrameAnalysis={false}
          onFirstFrameRender={() => {
            setCovered(false);
            noteFirstFrame(slot.key);
          }}
          style={{
            position: 'absolute',
            left: picture.x,
            top: picture.y,
            width: picture.width,
            height: picture.height,
          }}
        />
      )}
      {covered && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: picture.x,
            top: picture.y,
            width: picture.width,
            height: picture.height,
            backgroundColor: color.groundVideo.ios,
          }}
        />
      )}
      {failed && (
        <View style={[styles.failed, { top: picture.y + picture.height / 2 - 80 }]}>
          <View style={styles.failedLine}>
            <Icon name="warning" size={18} />
            <Txt variant="bodyS">This reel did not load.</Txt>
          </View>
          <View style={styles.failedButtons}>
            <Button kind="secondary" label="Skip" style={{ flex: 1 }} onPress={skipFailed} />
            <Button label="Try again" style={{ flex: 1 }} onPress={() => retryFailed(slot)} />
          </View>
        </View>
      )}
      {isActive && !failed && (paused || waiting) && (
        <View
          pointerEvents="none"
          style={[styles.markWrap, { top: picture.y + picture.height / 2 - 36 }]}
        >
          <View style={styles.mark}>
            {paused && <Icon name="play" size={28} />}
            <Txt variant="captionStrong" maxScale={1.2}>
              {paused ? 'Paused' : 'Loading'}
            </Txt>
          </View>
        </View>
      )}
    </Pressable>
  );
});

function activeReelOrdinal(slots: FeedSlot[], activeIndex: number): number | null {
  for (let i = activeIndex; i >= 0; i--) {
    const s = slots[i];
    if (s?.kind === 'reel') return s.ordinal;
  }
  return null;
}

const styles = StyleSheet.create({
  failed: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 12,
    padding: 16,
    borderRadius: radius.control,
    backgroundColor: color.bg.overlay,
  },
  failedLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  failedButtons: { flexDirection: 'row', gap: 8 },
  markWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  mark: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: radius.control,
    backgroundColor: color.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
});
