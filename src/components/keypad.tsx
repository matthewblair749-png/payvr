import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon } from './icon';
import { Text } from './text';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

type Props = { onKey: (key: string) => void; /** Hide the decimal key (PIN entry). */ integer?: boolean };

export function Keypad({ onKey, integer }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((k) => {
            const hidden = integer && k === '.';
            return (
              <Pressable
                key={k}
                disabled={hidden}
                accessibilityRole="button"
                accessibilityLabel={k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}
                onPress={() => {
                  haptics.tap();
                  onKey(k);
                }}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: pressed ? colors.surface : 'transparent',
                    opacity: hidden ? 0 : 1,
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  },
                ]}>
                {k === 'back' ? (
                  <Icon name="delete" size={26} color={colors.text} />
                ) : (
                  <Text style={[styles.label, { color: colors.text }]}>{k}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: Fonts.medium, fontSize: 30, lineHeight: 36 },
});
