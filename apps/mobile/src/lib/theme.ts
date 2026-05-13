// Bridges the shared design tokens (@reels/tokens) to React Native styles.
// Components import colours and type from here and never hard-code values.
import {
  color,
  fontScaleCap,
  motion,
  radius,
  size,
  space,
  stroke,
  type,
  type TypeName,
} from '@reels/tokens';
import { Platform, type TextStyle } from 'react-native';

export { color, fontScaleCap, motion, radius, size, space, stroke };
export type { TypeName };

/** Font files loaded with useFonts; the keys are the family names used in styles. */
export const fontFiles = {
  'BarlowSC-SemiBold': require('../../../../packages/fonts/files/BarlowSemiCondensed-SemiBold.ttf'),
  'BarlowSC-Bold': require('../../../../packages/fonts/files/BarlowSemiCondensed-Bold.ttf'),
  'MonoNL-Medium': require('../../../../packages/fonts/files/JetBrainsMonoNL-Medium.ttf'),
  'MonoNL-SemiBold': require('../../../../packages/fonts/files/JetBrainsMonoNL-SemiBold.ttf'),
} as const;

/** A token type style as a React Native text style. Custom families carry their weight in the file. */
export function textStyle(name: TypeName): TextStyle {
  const t = type[name];
  const style: TextStyle = { fontSize: t.size, lineHeight: t.lineHeight };
  if (t.family === 'System') style.fontWeight = t.weight ?? '400';
  else style.fontFamily = t.family;
  if (t.letterSpacing) style.letterSpacing = t.letterSpacing;
  if (t.uppercase) style.textTransform = 'uppercase';
  return style;
}

export const topRowHeight = Platform.OS === 'android' ? size.topRow.android : size.topRow.ios;

/** Precomputed styles for every type token, so components never rebuild them. */
export const typeStyles = Object.fromEntries(
  (Object.keys(type) as TypeName[]).map((name) => [name, textStyle(name)]),
) as Record<TypeName, TextStyle>;
