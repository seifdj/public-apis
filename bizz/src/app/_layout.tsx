import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useGate } from '@/features/account/hooks';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { state } = useGate();
  const ready = fontsReady && state !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!fontsReady) return null;

  const signedIn = state === 'needsShop' || state === 'client' || state === 'seller';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* `index` decides where to go; a screen whose guard turns false falls back to it. */}
      <Stack.Screen name="index" />
      <Stack.Protected guard={state === 'signedOut'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={state === 'needsProfile'}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={state === 'deleted'}>
        <Stack.Screen name="account-deleted" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(seller)" />
        <Stack.Screen name="open-shop" />
        <Stack.Screen name="verify-phone" />
        <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(gallery)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator fontsReady={fontsLoaded || !!fontError} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
