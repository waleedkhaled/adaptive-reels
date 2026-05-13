// Custom solid tab bar (DESIGN.md Components): Feed and You are tabs; Map
// pushes the full-screen map route.
import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, fontScaleCap, size, stroke } from '../lib/theme';
import { useApp } from '../lib/store';
import { Icon } from './Icon';
import { Txt } from './Txt';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const mapChanged = useApp((s) => s.mapChanged);
  // A gap session has no tab bar (DESIGN.md Feed fit: tabBar 0 in a session).
  const inGap = useApp((s) => !!s.learner?.gap);
  const current = state.routes[state.index]?.name;
  if (inGap) return null;
  const go = (name: 'index' | 'you') => {
    if (current !== name) navigation.navigate(name);
  };
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      <Item label="Feed" icon="tabFeed" active={current === 'index'} onPress={() => go('index')} />
      <Item
        label={mapChanged > 0 ? `Map, ${mapChanged} changes` : 'Map'}
        icon="tabMap"
        active={false}
        changed={mapChanged > 0}
        onPress={() => router.push('/map')}
      />
      <Item label="You" icon="tabYou" active={current === 'you'} onPress={() => go('you')} />
    </View>
  );
}

function Item({
  label,
  icon,
  active,
  changed,
  onPress,
}: {
  label: string;
  icon: 'tabFeed' | 'tabMap' | 'tabYou';
  active: boolean;
  changed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}
    >
      {active && <View style={styles.mark} />}
      <View>
        <Icon name={icon} size={22} tint={active ? color.text.primary : color.text.secondary} />
        {changed && <View style={styles.changed} />}
      </View>
      <Txt
        variant="micro"
        tone={active ? 'primary' : 'secondary'}
        maxScale={fontScaleCap.chromeLabel}
      >
        {label.split(',')[0]}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.bg.base,
    borderTopWidth: stroke.rule,
    borderTopColor: color.line.hairline,
  },
  item: { flex: 1, height: size.tabBar, alignItems: 'center', justifyContent: 'center', gap: 2 },
  mark: {
    position: 'absolute',
    top: -1,
    width: 24,
    height: 2,
    backgroundColor: color.text.primary,
  },
  changed: {
    position: 'absolute',
    right: -6,
    top: -2,
    width: 8,
    height: 8,
    backgroundColor: color.text.primary,
  },
});
