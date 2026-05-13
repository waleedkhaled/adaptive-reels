// A state tile that springs in when its state changes after mount (the map
// replay's fill and unlock). The first render never animates.
import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { StateTile } from '../components/StateTile';
import { motionMode } from '../lib/a11y';
import { useApp } from '../lib/store';
import { motion } from '../lib/theme';

type Props = Parameters<typeof StateTile>[0];

export function PopTile(props: Props) {
  const reduceMotion = useApp((s) => s.reduceMotion);
  const scale = useSharedValue(1);
  const first = useRef(true);
  const stateKey = `${props.level}|${props.locked}|${props.justUnlocked}`;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    scale.set(0.55);
    scale.set(withSpring(1, { ...motion.spring.default, reduceMotion: motionMode(reduceMotion) }));
  }, [stateKey, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={style}>
      <StateTile {...props} />
    </Animated.View>
  );
}
