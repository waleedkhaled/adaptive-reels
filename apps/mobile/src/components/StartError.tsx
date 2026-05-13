// Shown when the reel library cannot be reached and no copy is cached (UX.md 3.9).
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { libraryBaseUrl } from '../lib/library';
import { color, size } from '../lib/theme';
import { useApp } from '../lib/store';
import { Button } from './Button';
import { Icon } from './Icon';
import { Txt } from './Txt';

export function StartError() {
  const insets = useSafeAreaInsets();
  const error = useApp((s) => s.error);
  const empty = error === 'empty-library';
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg.base,
        paddingTop: insets.top + 48,
        paddingHorizontal: size.gutter,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="warning" size={20} tint={color.error.base} />
        <Txt variant="title">{empty ? 'No reels yet.' : 'Could not load the lessons.'}</Txt>
      </View>
      <Txt variant="bodyS" tone="secondary">
        {empty
          ? 'The library has no approved reels. Approve reels in the review report, or switch to all reels in development.'
          : `Check the connection and try again. ${libraryBaseUrl()}`}
      </Txt>
      <Button
        kind="secondary"
        label="Try again"
        onPress={() => {
          useApp.setState({ phase: 'booting', error: null });
          void useApp.getState().boot();
        }}
      />
    </View>
  );
}
