// A drawn, monochrome switch. The native iOS 26 switch ignores thumbColor,
// which left a white thumb on the light "on" track.
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { motionMode } from '../lib/a11y';
import { useApp } from '../lib/store';
import { color, motion, stroke } from '../lib/theme';

const TRACK = { width: 51, height: 31 };
const THUMB = 25;
const PAD = (TRACK.height - 2 * stroke.outline - THUMB) / 2;
const TRAVEL = TRACK.width - 2 * stroke.outline - THUMB - 2 * PAD;

/** Visual only: the row around it carries the switch role, label and state. */
export function SwitchMark({ on }: { on: boolean }) {
  const reduceMotion = useApp((s) => s.reduceMotion);
  const spring = { ...motion.spring.fast, reduceMotion: motionMode(reduceMotion) };
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(on ? TRAVEL : 0, spring) }],
  }));
  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: on ? color.text.primary : color.bg.overlay,
          borderColor: on ? color.text.primary : color.line.control,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: on ? color.bg.base : color.text.secondary },
          thumb,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { ...TRACK, borderRadius: TRACK.height / 2, borderWidth: stroke.outline },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
});
