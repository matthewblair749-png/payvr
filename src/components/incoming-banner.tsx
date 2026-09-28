import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { formatShort } from '@/utils/money';

import { Avatar } from './avatar';
import { Text } from './text';

/**
 * In-app realtime banner, shown the moment money or a request arrives
 * ("Jake paid you $20 · Pizza"). Push notifications carry the same text in build step 7.
 */
export function IncomingBanner() {
  const { incoming, dismissIncoming, userById, me } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(dismissIncoming, 5000);
    return () => clearTimeout(t);
  }, [incoming, dismissIncoming]);

  if (!incoming) return null;
  const tx = incoming.transaction;
  const other = userById(tx.fromUser === me.id ? tx.toUser : tx.fromUser);
  const first = other?.name.split(' ')[0] ?? 'Someone';
  const amount = formatShort(tx.amountCents);
  const title =
    incoming.kind === 'payment'
      ? `${first} paid you ${amount}`
      : incoming.kind === 'requestPaid'
        ? `${first} paid your ${amount} request`
        : `${first} is requesting ${amount}`;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + 8, pointerEvents: 'box-none' }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${title}${tx.note ? `, ${tx.note}` : ''}`}
        onPress={() => {
          dismissIncoming();
          if (incoming.kind === 'request') router.push({ pathname: '/request/[id]', params: { id: tx.id } });
          else router.push({ pathname: '/transaction/[id]', params: { id: tx.id } });
        }}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={other?.name ?? '?'} uri={other?.avatarUrl} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {title}
          </Text>
          {tx.note ? (
            <Text variant="small" color="textSecondary" numberOfLines={1}>
              {tx.note}
            </Text>
          ) : null}
        </View>
        {incoming.kind !== 'request' ? (
          <Text variant="amount" color="successText">
            +{formatShort(tx.amountCents)}
          </Text>
        ) : (
          <Text variant="bodyMedium" color="accent">
            Review
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
  },
  flex: { flex: 1 },
});
