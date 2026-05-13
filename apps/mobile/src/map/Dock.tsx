// The dock (DESIGN.md Components, "Dock"; UX.md 5.5): what to do next, or the
// selected concept. Its height changes only with the selection, unanimated.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { StateTile } from '../components/StateTile';
import { Txt } from '../components/Txt';
import { engine } from '../feed/engine';
import { color, size, stroke } from '../lib/theme';
import type { DockView } from './model';

interface Props {
  dock: DockView;
  /** 1-based rank when the shown concept is a suggestion, else null. */
  rank: number | null;
  count: number;
  pin: number | undefined;
  bottomInset: number;
  onStep: (delta: -1 | 1) => void;
  onNextUp: () => void;
  onDetail: () => void;
  onAction: (dock: DockView) => void;
}

export function Dock({
  dock,
  rank,
  count,
  pin,
  bottomInset,
  onStep,
  onNextUp,
  onDetail,
  onAction,
}: Props) {
  return (
    <View style={[styles.dock, { paddingBottom: 12 + bottomInset }]} accessibilityLabel="Next up">
      <View style={styles.row1}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${dock.title}. ${dock.reason}. Opens details.`}
          onPress={onDetail}
          style={styles.head}
        >
          <StateTile
            size={28}
            surface={color.bg.overlay}
            {...engine.tile(dock.conceptId)}
            pin={pin}
          />
          <View style={{ flex: 1 }}>
            <Txt variant="heading" numberOfLines={2}>
              {dock.title}
            </Txt>
            <View style={styles.reason}>
              {dock.reasonDue && <Icon name="clock" size={13} tint={color.due} />}
              <Txt variant="caption" tone={dock.reasonDue ? 'due' : 'secondary'} numberOfLines={1}>
                {dock.reason}
              </Txt>
            </View>
          </View>
          <Icon name="chevronRight" size={13} tint={color.text.secondary} />
        </Pressable>
        {rank !== null ? (
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous suggestion"
              disabled={count < 2}
              onPress={() => onStep(-1)}
              style={styles.step}
            >
              <Icon
                name="chevronLeft"
                size={18}
                tint={count < 2 ? color.line.control : color.text.primary}
              />
            </Pressable>
            <View style={styles.stepLabel}>
              <Txt variant="micro" tone="secondary">
                Next up
              </Txt>
              <Txt variant="dataS">
                {rank}/{count}
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next suggestion"
              disabled={count < 2}
              onPress={() => onStep(1)}
              style={styles.step}
            >
              <Icon
                name="chevronRight"
                size={18}
                tint={count < 2 ? color.line.control : color.text.primary}
              />
            </Pressable>
          </View>
        ) : (
          <Button kind="text" label="Next up" onPress={onNextUp} />
        )}
      </View>
      <View style={styles.lines}>
        {dock.lines.slice(0, 3).map((line) => (
          <Txt key={line} variant="caption" tone="secondary">
            {line}
          </Txt>
        ))}
      </View>
      {dock.button ? (
        <Button
          kind={dock.button.kind}
          label={dock.button.label}
          onPress={() => onAction(dock)}
          style={{ marginTop: 8 }}
        />
      ) : (
        <Countdown to={dock.countdownTo} />
      )}
    </View>
  );
}

/** "Comes back in 0:42": the map's one ticking element. */
function Countdown({ to }: { to: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (to === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [to]);
  const left = to === null ? null : Math.max(0, to - now);
  return (
    <View style={styles.countdown}>
      <Txt variant="caption" tone="secondary">
        Comes back in
      </Txt>
      <Txt variant="dataL">{left === null ? '--:--' : formatCountdown(left)}</Txt>
    </View>
  );
}

export function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg.overlay,
    borderTopWidth: stroke.rule,
    borderTopColor: color.line.hairline,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  row1: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  head: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  step: { width: size.target, height: size.target, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { alignItems: 'center' },
  lines: { marginTop: 8, gap: 2 },
  countdown: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
