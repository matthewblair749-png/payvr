import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './icon';
import { LogoGlyph } from './logo';
import { Text } from './text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  activity: { label: 'Activity', icon: 'activity' },
  profile: { label: 'Profile', icon: 'user' },
};

/** Home · Activity · [Tap] · Profile — Tap is a raised blue circle that starts a payment. */
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
      {item('activity')}
      <View style={styles.item}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap to pay"
          onPress={() => {
            haptics.medium();
            setDraft(null);
            router.push('/amount');
          }}
          style={({ pressed }) => [
            styles.tap,
            { backgroundColor: colors.primary, borderColor: colors.background, transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}>
          <LogoGlyph size={34} color={colors.onPrimary} />
        </Pressable>
        <Text variant="caption" color="textSecondary" style={styles.tapLabel}>
          Tap
        </Text>
      </View>
      {item('profile')}
    </View>
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
  },
  tapLabel: { fontSize: 11, lineHeight: 14 },
});
