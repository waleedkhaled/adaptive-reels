// One source for Reduce Motion and the screen reader (DESIGN.md Motion). The
// store follows the system settings live, so a mid-session toggle changes
// every animation at once; Reanimated's own ReduceMotion.System is never used.
import { AccessibilityInfo, PixelRatio } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useApp } from './store';

let watching = false;

export function watchAccessibility(): void {
  if (watching) return;
  watching = true;
  void AccessibilityInfo.isReduceMotionEnabled().then((on) =>
    useApp.setState({ reduceMotion: on }),
  );
  void AccessibilityInfo.isScreenReaderEnabled().then((on) =>
    useApp.setState({ screenReader: on }),
  );
  AccessibilityInfo.addEventListener('reduceMotionChanged', (on) =>
    useApp.setState({ reduceMotion: on }),
  );
  AccessibilityInfo.addEventListener('screenReaderChanged', (on) =>
    useApp.setState({ screenReader: on }),
  );
}

/** The `reduceMotion` value for every withSpring and withTiming config. */
export const motionMode = (reduce: boolean) => (reduce ? ReduceMotion.Always : ReduceMotion.Never);

/** What session_start records about the reading conditions. */
export function accessibilitySnapshot() {
  const { reduceMotion, screenReader } = useApp.getState();
  return {
    font_scale: PixelRatio.getFontScale(),
    reduce_motion: reduceMotion,
    screen_reader: screenReader,
  };
}
