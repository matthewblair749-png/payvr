import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { storage, StorageKeys } from '@/services/storage';

import { Colors, type ColorScheme, type Palette, type ThemePreference } from './colors';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const FADE_MS = 200;

export function PayvrThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // Dark is the default until the saved preference loads.
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.get(StorageKeys.theme).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') setPreferenceState(saved);
      setReady(true);
    });
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const colors = Colors[scheme];

  // 200ms fade: when the scheme changes, lay the previous background over the
  // new UI and fade it out so the switch reads as a soft cross-fade.
  const [fadeColor, setFadeColor] = useState<string | null>(null);
  const overlay = useSharedValue(0);
  const prevScheme = useRef(scheme);
  useEffect(() => {
    if (prevScheme.current === scheme) return;
    setFadeColor(Colors[prevScheme.current].background);
    prevScheme.current = scheme;
    overlay.value = 1;
    overlay.value = withTiming(0, { duration: FADE_MS });
    const t = setTimeout(() => setFadeColor(null), FADE_MS + 20);
    return () => clearTimeout(t);
  }, [scheme, overlay]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    storage.set(StorageKeys.theme, p);
  }, []);

  const value = useMemo(
    () => ({ scheme, colors, preference, setPreference, ready }),
    [scheme, colors, preference, setPreference, ready],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        {children}
        {fadeColor ? (
          <Animated.View
            style={[{ pointerEvents: 'none' }, StyleSheet.absoluteFill, { backgroundColor: fadeColor }, overlayStyle]}
          />
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside PayvrThemeProvider');
  return ctx;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
