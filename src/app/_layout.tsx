import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { IncomingBanner } from '@/components/incoming-banner';
import { AppStoreProvider } from '@/store/app-store';
import { AuthorizeProvider } from '@/store/authorize';
import { PayvrThemeProvider, useTheme } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <PayvrThemeProvider>
      <AppStoreProvider>
        <AuthorizeProvider>
          <Navigator />
        </AuthorizeProvider>
      </AppStoreProvider>
    </PayvrThemeProvider>
  );
}

function Navigator() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="amount" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="tap" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="confirm" />
        <Stack.Screen name="success" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="request/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="qr" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="wallet/[action]" options={{ presentation: 'modal' }} />
      </Stack>
      <IncomingBanner />
    </ThemeProvider>
  );
}
