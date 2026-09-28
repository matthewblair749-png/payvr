import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Keypad } from '@/components/keypad';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import type { TapMode } from '@/data/types';
import { DAILY_SEND_LIMIT_CENTS } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';
import { applyKey, displayTyped, formatShort, toCents } from '@/utils/money';

export default function Amount() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: TapMode; to?: string }>();
  const { setDraft, balanceCents, sentTodayCents, userById } = useApp();
  const [mode, setMode] = useState<TapMode>(params.mode === 'request' ? 'request' : 'send');
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const peer = params.to ? userById(params.to) : undefined;

  const cents = toCents(amount);
  const leftToday = DAILY_SEND_LIMIT_CENTS - sentTodayCents;
  const error =
    mode === 'send' && cents > balanceCents
      ? 'That’s more than your balance.'
      : mode === 'send' && cents > leftToday
        ? `Daily limit: you can send ${formatShort(Math.max(0, leftToday))} more today.`
        : null;

  const size = amount.length > 8 ? 56 : amount.length > 5 ? 68 : 84;

  const next = () => {
    setDraft({ mode, amountCents: cents, note: note.trim(), peerId: peer?.id });
    if (peer) router.push('/confirm');
    else router.push('/tap');
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <View style={styles.toggle}>
          <Segmented<TapMode>
            compact
            value={mode}
            onChange={setMode}
            options={[
              { value: 'send', label: 'Send' },
              { value: 'request', label: 'Request' },
            ]}
          />
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.display}>
        {peer ? (
          <View style={[styles.peer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Avatar name={peer.name} uri={peer.avatarUrl} size={28} />
            <Text variant="bodyMedium">
              {mode === 'send' ? 'To' : 'From'} {peer.name.split(' ')[0]}
            </Text>
          </View>
        ) : null}
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Amount ${displayTyped(amount)}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: Fonts.bold,
            fontSize: size,
            lineHeight: size * 1.1,
            letterSpacing: -size * 0.04,
            color: cents === 0 ? colors.textSecondary : colors.text,
          }}>
          {displayTyped(amount)}
        </Text>
        <Text variant="small" color={error ? 'error' : 'textSecondary'} style={styles.hint}>
          {error ?? (mode === 'send' ? `Balance ${formatShort(balanceCents)}` : 'They’ll get a request to approve')}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          placeholderTextColor={colors.textSecondary}
          maxLength={60}
          accessibilityLabel="Add a note"
          style={[styles.note, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      </View>

      <View style={styles.bottom}>
        <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />
        <Button
          label={peer ? (mode === 'send' ? 'Continue' : 'Continue') : 'Ready to tap'}
          disabled={cents === 0 || !!error}
          onPress={next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 64 },
  toggle: { flex: 1, maxWidth: 240 },
  display: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  peer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  hint: { minHeight: 20 },
  note: {
    marginTop: 18,
    minHeight: 44,
    minWidth: 200,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    fontFamily: Fonts.medium,
    fontSize: 16,
    textAlign: 'center',
  },
  bottom: { paddingHorizontal: 20, gap: 12 },
});
