import { icon, type IconName } from '@reels/tokens';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { color } from '../lib/theme';

interface Props {
  name: IconName;
  size: number;
  tint?: string;
}

/** SF Symbols on iOS, Material Symbols on Android. Every icon sits beside a text label. */
export function Icon({ name, size, tint = color.text.primary }: Props) {
  const names = icon[name];
  return (
    <SymbolView
      name={{ ios: names.ios as SFSymbol, android: names.android as AndroidSymbol }}
      size={size}
      tintColor={tint}
      weight="medium"
      style={{ width: size, height: size }}
    />
  );
}
