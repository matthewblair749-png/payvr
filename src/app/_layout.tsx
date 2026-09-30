import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CallBanner } from '@/components/call-banner';
import { CallOverlay } from '@/components/call-overlay';
import { IncomingBanner } from '@/components/incoming-banner';
import { PressableScale } from '@/components/pressable-scale';
import { configurePush, onNotificationTap } from '@/services/push';
import { AppStoreProvider, useApp } from '@/store/app-store';
import { AuthorizeProvider } from '@/store/authorize';
import { CallProvider } from '@/store/call-store';
import { CardsProvider } from '@/store/cards-store';
import { ChatProvider } from '@/store/chat-store';
import { SocialProvider } from '@/store/social-store';
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
        <SocialProvider>
          <ChatProvider>
            <CallProvider>
              <CardsProvider>
                <AuthorizeProvider>
                  <Navigator />
                </AuthorizeProvider>
              </CardsProvider>
            </CallProvider>
          </ChatProvider>
        </SocialProvider>
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
          // Native iOS-style push, and swipe back from anywhere on the screen (not just the edge).
          animation: 'ios_from_right',
          fullScreenGestureEnabled: true,
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
        <Stack.Screen name="money/[action]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="people" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cards/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]/split" options={{ presentation: 'modal' }} />
      </Stack>
      <CallOverlay />
      <IncomingBanner />
      <CallBanner />
      <NotificationRouter />
    </ThemeProvider>
  );
}

/** Opens the transaction / request a push notification is about, once the account is loaded. */
function NotificationRouter() {
  const { status } = useApp();
  const pending = useRef<string | null>(null);
  const signedIn = useRef(false);

  useEffect(() => {
    configurePush();
    return onNotificationTap((url) => {
      if (signedIn.current) router.push(url as never);
      else pending.current = url;
    });
  }, []);

  useEffect(() => {
    signedIn.current = status === 'signedIn';
    if (status === 'signedIn' && pending.current) {
      router.push(pending.current as never);
      pending.current = null;
    }
  }, [status]);

  return null;
}

/** Shown if a screen crashes. Plain styles on purpose: the theme may be what broke. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={errorStyles.wrap}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.body}>
        No money moved because of this. Try again, and if it keeps happening, restart Payvr.
      </Text>
      {__DEV__ ? <Text style={errorStyles.dev}>{error.message}</Text> : null}
      <PressableScale accessibilityRole="button" onPress={retry} style={errorStyles.button}>
        <Text style={errorStyles.buttonText}>Try again</Text>
      </PressableScale>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  body: { color: '#A1A1AA', fontSize: 16, textAlign: 'center', maxWidth: 320 },
  dev: { color: '#EF4444', fontSize: 12, textAlign: 'center' },
  button: { marginTop: 12, backgroundColor: '#2150FF', borderRadius: 16, minHeight: 48, paddingHorizontal: 28, justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
