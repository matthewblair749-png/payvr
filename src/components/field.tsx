import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

import { Text } from './text';

type Props = TextInputProps & { label?: string; prefix?: string; error?: string | null };

export const Field = forwardRef<TextInput, Props>(function Field({ label, prefix, error, style, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border },
        ]}>
        {prefix ? <Text variant="bodyMedium" color="textSecondary">{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          {...rest}
          style={[styles.input, { color: colors.text }, style]}
        />
      </View>
      {error ? (
        <Text variant="small" color="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: { flex: 1, fontFamily: Fonts.medium, fontSize: 18, paddingVertical: 14, outlineStyle: 'none' } as object,
});
