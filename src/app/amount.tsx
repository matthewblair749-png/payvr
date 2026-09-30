import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Keypad } from '@/components/keypad';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import type { TapMode } from '@/data/types';
import { DAILY_SEND_LIMIT_CENTS } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useCards } from '@/store/cards-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatShort, toCents } from '@/utils/money';
import { smooth } from '@/utils/motion';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export default function Amount() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: TapMode; to?: string; source?: string }>();
  const { setDraft, balanceCents, sentTodayCents, userById } = useApp();
  const { cards } = useCards();
  // With a card connected, amounts above the balance are fine: the card pays.
  const canUseCard = cards.length > 0;
  const [mode, setMode] = useState<TapMode>(params.mode === 'request' ? 'request' : 'send');
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const peer = params.to ? userById(params.to) : undefined;

  const cents = toCents(amount);
  const leftToday = DAILY_SEND_LIMIT_CENTS - sentTodayCents;
  const overLimit = (c: number) => mode === 'send' && ((!canUseCard && c > balanceCents) || c > leftToday);
  const error =
    mode === 'send' && !canUseCard && cents > balanceCents
      ? 'That’s more than your balance.'
      : mode === 'send' && cents > leftToday
        ? `Daily limit: you can send ${formatShort(Math.max(0, leftToday))} more today.`
        : null;

  const size = amount.length > 8 ? 56 : amount.length > 5 ? 68 : 84;

  // The number bumps on every key, and shakes when it goes over the balance or daily limit.
  const bump = useSharedValue(1);
  const shake = useSharedValue(0);
  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bump.value }, { translateX: shake.value }],
  }));

  const react = (nextCents: number, key: string) => {
    if (overLimit(nextCents) && key !== 'back') {
      haptics.error();
      shake.set(
        withSequence(
          withTiming(-9, { duration: 45 }),
          withTiming(9, { duration: 45 }),
          withTiming(-5, { duration: 45 }),
          withTiming(0, { duration: 45 }),
        ),
      );
    } else {
      bump.set(withSequence(withTiming(1.03, smooth(70)), withTiming(1, smooth(200))));
    }
  };

  const press = (key: string) => {
    const nextAmount = applyKey(amount, key);
    setAmount(nextAmount);
    react(toCents(nextAmount), key);
  };

  const quick = (c: number) => {
    haptics.tap();
    setAmount(String(c / 100));
    react(c, 'quick');
  };

  const next = () => {
    setDraft({ mode, amountCents: cents, note: note.trim(), peerId: peer?.id, source: params.source });
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
        <Animated.View style={amountStyle}>
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
              fontVariant: ['tabular-nums'],
              color: error ? colors.error : cents === 0 ? colors.textSecondary : colors.text,
            }}>
            {displayTyped(amount)}
          </Text>
        </Animated.View>
        <Text variant="small" color={error ? 'error' : 'textSecondary'} style={styles.hint}>
          {error ?? (mode === 'send' ? `Balance ${formatShort(balanceCents)}` : 'They’ll get a request to approve')}
        </Text>
        {cents === 0 ? (
          <View style={styles.quick}>
            {QUICK_AMOUNTS.map((c) => (
              <PressableScale
                key={c}
                accessibilityRole="button"
                accessibilityLabel={formatShort(c)}
                onPress={() => quick(c)}
                style={({ pressed }) => [
                  styles.quickChip,
                  { borderColor: colors.border, backgroundColor: pressed ? colors.surface : 'transparent' },
                ]}>
                <Text variant="bodyMedium">{formatShort(c)}</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
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
        <Keypad onKey={press} />
        <Button label={peer ? 'Continue' : 'Ready to tap'} disabled={cents === 0 || !!error} onPress={next} />
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
  quick: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickChip: {
    minHeight: MIN_TAP,
    minWidth: 60,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: 14,
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
