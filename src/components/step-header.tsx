import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Text } from './text';

export function StepHeader({ step, total, title, subtitle }: { step?: number; total?: number; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {step && total ? (
        <View style={styles.bars} accessibilityLabel={`Step ${step} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.primary : colors.border }]} />
          ))}
        </View>
      ) : null}
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text color="textSecondary">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8, marginBottom: 28 },
  bars: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
