import type { Ref } from 'react';
import { Text, type TextProps } from 'react-native';
import { color, type TypeName, typeStyles } from '../lib/theme';

export type TextColor =
  'primary' | 'secondary' | 'inverse' | 'proven' | 'provenDim' | 'due' | 'error';

const colors: Record<TextColor, string> = {
  primary: color.text.primary,
  secondary: color.text.secondary,
  inverse: color.text.inverse,
  proven: color.proven.base,
  provenDim: color.proven.dim,
  due: color.due,
  error: color.error.base,
};

interface Props extends TextProps {
  variant: TypeName;
  tone?: TextColor;
  /** Dynamic Type cap for this text (DESIGN.md Typography); undefined = no cap. */
  maxScale?: number;
  /** React 19 passes refs as props; this one reaches the native Text. */
  ref?: Ref<Text>;
}

/** Text in a token style. Every visible string in the app goes through this. */
export function Txt({ variant, tone = 'primary', maxScale, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxScale}
      style={[typeStyles[variant], { color: colors[tone] }, style]}
    />
  );
}
