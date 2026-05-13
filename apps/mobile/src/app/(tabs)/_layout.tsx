import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { color } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg.base } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
