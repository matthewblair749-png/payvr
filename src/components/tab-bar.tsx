import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useApp } from '@/store/app-store';
import { runTapHandler } from '@/store/tap-intent';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './icon';
import { LogoGlyph } from './logo';
import { Text } from './text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  feed: { label: 'Feed', icon: 'feed' },
  wallet: { label: 'Wallet', icon: 'wallet' },
  profile: { label: 'Profile', icon: 'user' },
};

/** Home · Feed · [Tap] · Wallet · Profile — Tap is a raised, glowing blue circle that starts a tap payment. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { setDraft } = useApp();

  const item = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    const route = state.routes[index];
    const focused = state.index === index;
    const meta = TABS[routeName];
    const color = focused ? colors.accent : colors.textSecondary;
    return (
      <Pressable
        key={routeName}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        aria-selected={focused}
        onPress={() => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name);
          }
        }}
        style={styles.item}>
        <Icon name={meta.icon} size={24} color={color} />
        <Text variant="caption" style={{ color, fontSize: 11, lineHeight: 14 }}>
          {meta.label}
        </Text>
        <View style={[styles.activeDot, { backgroundColor: focused ? colors.accent : 'transparent' }]} />
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) },
      ]}>
      {item('home')}
      {item('feed')}
      <View style={styles.item}>
        <View style={styles.tapWrap}>
        <TapGlow />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap to pay"
          onPress={() => {
            haptics.medium();
            if (runTapHandler()) return;
            setDraft(null);
            router.push('/amount');
          }}
          style={({ pressed }) => [
            styles.tap,
            {
              backgroundColor: colors.primary,
              borderColor: colors.background,
              shadowColor: colors.primary,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}>
          <LogoGlyph size={34} color={colors.onPrimary} />
        </Pressable>
        </View>
        <Text variant="caption" color="textSecondary" style={styles.tapLabel}>
          Tap
        </Text>
      </View>
      {item('wallet')}
      {item('profile')}
    </View>
  );
}

/** A soft blue halo that slowly breathes behind the Tap button (still when Reduce Motion is on). */
function TapGlow() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [t, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: 0.16 + t.value * 0.16, transform: [{ scale: 1 + t.value * 0.14 }] }));
  return <Animated.View style={[styles.glow, { backgroundColor: colors.primary }, style]} />;
}

const styles = StyleSheet.create({
  // Sits behind the Tap circle, 6px bigger all round.
  glow: { position: 'absolute', width: 76, height: 76, borderRadius: 38, top: -6, left: -6, pointerEvents: 'none' },
  tapWrap: { width: 64, height: 64, marginTop: -30 },
  activeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: MIN_TAP + 6 },
  tap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // A soft blue glow (a shadow, not a gradient).
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  tapLabel: { fontSize: 11, lineHeight: 14, marginBottom: 5 },
});
