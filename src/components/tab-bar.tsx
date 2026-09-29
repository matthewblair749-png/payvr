import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useApp } from '@/store/app-store';
import { runTapHandler } from '@/store/tap-intent';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { smooth } from '@/utils/motion';

import { Icon, type IconName } from './icon';
import { LogoGlyph } from './logo';
import { PressableScale } from './pressable-scale';
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
      <PressableScale
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
        <TabIcon name={meta.icon} color={color} focused={focused} />
        <Text variant="caption" style={{ color, fontSize: 11, lineHeight: 14 }}>
          {meta.label}
        </Text>
      </PressableScale>
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
        <PressableScale
          scaleTo={0.92}
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
            },
          ]}>
          <LogoGlyph size={34} color={colors.onPrimary} />
        </PressableScale>
        <Text variant="caption" color="textSecondary" style={styles.tapLabel}>
          Tap
        </Text>
      </View>
      {item('wallet')}
      {item('profile')}
    </View>
  );
}

/** The tab's icon eases up to full size when its tab becomes active (no bounce). */
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const reduceMotion = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!focused || reduceMotion) return;
    s.set(0.9);
    s.set(withTiming(1, smooth(280)));
  }, [focused, reduceMotion, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={style}>
      <Icon name={name} size={24} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    marginTop: -30,
    // A soft blue glow (a shadow, not a gradient).
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  tapLabel: { fontSize: 11, lineHeight: 14 },
});
