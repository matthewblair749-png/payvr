import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';

import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

/** Confirmation after a report or dispute is sent. */
export function TicketDone({ ticket, title, body }: { ticket: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.check, { backgroundColor: colors.success + '22' }]}>
        <Icon name="check" size={36} color={colors.success} strokeWidth={3} />
      </View>
      <Text variant="title" align="center" accessibilityRole="header">
        {title}
      </Text>
      <Text color="textSecondary" align="center">
        {body}
      </Text>
      <View style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="caption" color="textSecondary">
          Case number
        </Text>
        <Text variant="heading" selectable>
          {ticket}
        </Text>
      </View>
      <Button label="Done" onPress={() => router.back()} style={styles.done} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, marginTop: 48 },
  check: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ticket: { alignItems: 'center', gap: 2, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  done: { alignSelf: 'stretch', marginTop: 24 },
});
