import { router } from 'expo-router';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

import { IconButton } from './icon-button';
import { Text } from './text';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  title?: string;
  /** Show a back (or close) button in the header. */
  back?: 'back' | 'close' | false;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  padded?: boolean;
  contentStyle?: ViewStyle;
  /** Set when the screen sits above the tab bar (tab bar handles the bottom inset). */
  inTabs?: boolean;
};

export function Screen({
  children,
  scroll,
  title,
  back = false,
  headerRight,
  footer,
  padded = true,
  contentStyle,
  inTabs,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const hasHeader = !!(title || back || headerRight);
  const bottom = inTabs ? 0 : Math.max(insets.bottom, 16);

  const body = (
    <View style={[padded && styles.padded, !scroll && styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {hasHeader ? (
        <View style={styles.header}>
          <View style={styles.side}>
            {back ? (
              <IconButton
                icon={back === 'close' ? 'close' : 'chevronLeft'}
                label={back === 'close' ? 'Close' : 'Back'}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
              />
            ) : null}
          </View>
          {title ? (
            <Text variant="bodyMedium" accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <View style={[styles.side, styles.right]}>{headerRight}</View>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{ paddingBottom: footer ? 16 : bottom + 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { paddingHorizontal: 24 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  side: { width: 88, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 12 },
});
