import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StartError } from '../components/StartError';
import { watchAccessibility } from '../lib/a11y';
import { color, fontFiles } from '../lib/theme';
import { useApp } from '../lib/store';

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(color.bg.base);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const phase = useApp((s) => s.phase);
  const segments = useSegments();

  useEffect(() => {
    watchAccessibility();
    void useApp.getState().boot();
  }, []);

  const ready = (fontsLoaded || !!fontError) && phase !== 'booting';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.bg.base }} />;

  const onOnboarding = segments[0] === 'onboarding';
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg.base }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {phase === 'error' ? (
          <StartError />
        ) : (
          <>
            {phase === 'onboarding' && !onOnboarding && <Redirect href="/onboarding" />}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.bg.base },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="map" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
