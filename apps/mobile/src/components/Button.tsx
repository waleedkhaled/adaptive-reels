import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, radius, stroke } from '../lib/theme';
import { Txt } from './Txt';

type Kind = 'primary' | 'secondary' | 'text';

interface Props {
  label: string;
  onPress: () => void;
  kind?: Kind;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/** Primary: light fill with dark text. Secondary: outline. Text: underlined label. One primary per screen. */
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, look(kind, !!disabled, pressed), style]}
    >
      <View style={styles.inner}>
        <Txt
          variant="button"
          tone={disabled ? 'secondary' : kind === 'primary' ? 'inverse' : 'primary'}
          numberOfLines={2}
          style={[styles.label, kind === 'text' && styles.underline]}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

function look(kind: Kind, disabled: boolean, pressed: boolean): ViewStyle {
  if (disabled) {
    return {
      backgroundColor: color.bg.overlay,
      borderWidth: stroke.outline,
      borderColor: color.line.control,
    };
  }
  if (kind === 'primary')
    return { backgroundColor: pressed ? color.text.settled : color.text.primary };
  if (kind === 'secondary') {
    return {
      backgroundColor: pressed ? color.bg.overlay : 'transparent',
      borderWidth: stroke.outline,
      borderColor: color.line.control,
    };
  }
  return { backgroundColor: pressed ? color.bg.overlay : 'transparent', paddingHorizontal: 8 };
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  inner: { alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
});
