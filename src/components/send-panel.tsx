import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import type { Draft, Privacy, User } from '@/data/types';
import { PaymentError } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

import { Avatar } from './avatar';
import { Button } from './button';
import { Icon } from './icon';
import { PrivacyPicker } from './privacy-picker';
import { SwipeToSend } from './swipe-to-send';
import { Text } from './text';

type Props = {
  peer: User;
  draft: Draft;
  /** Extra draft fields to lock in when sending (e.g. the peer found by a tap). */
  patch?: Partial<Draft>;
  /** Shown under the name, e.g. how the tap found them, or a mismatch warning. */
  children?: React.ReactNode;
};

/**
 * The last step of every payment: who, how much, a note, who can see it, and then
 * "swipe up to send" (or the Face ID button). Both paths ask for Face ID / PIN first.
 */
export function SendPanel({ peer, draft, patch, children }: Props) {
  const { colors } = useTheme();
  const { submitDraft } = useApp();
  const { defaultPrivacy, setPrivacy } = useSocial();
  const authorize = useAuthorize();
  const reduceMotion = useReducedMotion();
  const [note, setNote] = useState(draft.note);
  const [privacy, setPrivacyChoice] = useState<Privacy>(draft.privacy ?? defaultPrivacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = peer.name.split(' ')[0];
  const amount = formatShort(draft.amountCents);
  const payingRequest = draft.origin === 'qrRequest' || !!draft.requestId;
  const isSend = draft.mode === 'send';
  const action = payingRequest ? `Pay ${amount}` : isSend ? `Send ${amount}` : `Request ${amount}`;

  // Their photo zooms in when the panel appears.
  const zoom = useSharedValue(reduceMotion ? 1 : 0.4);
  useEffect(() => {
    zoom.set(withDelay(80, withSpring(1, { damping: 11, stiffness: 180 })));
  }, [zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  const go = async () => {
    if (busy) return;
    setError(null);
    if (isSend && !(await authorize(`${payingRequest ? 'Pay' : 'Send'} ${amount} to ${peer.name}`))) return;
    setBusy(true);
    try {
      const tx = await submitDraft({ ...patch, note: note.trim(), privacy });
      setPrivacy(tx.id, privacy);
      router.replace({ pathname: '/success', params: { id: tx.id } });
    } catch (e) {
      haptics.error();
      setError(e instanceof PaymentError ? e.message : 'Something went wrong. Nothing was sent.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.who}>
        <Animated.View style={zoomStyle}>
          <Avatar name={peer.name} uri={peer.avatarUrl} size={96} ring />
        </Animated.View>
        <Text variant="heading" align="center" accessibilityRole="header">
          {peer.name} · <Text variant="heading" color="textSecondary">@{peer.handle}</Text>
        </Text>
        {children}
      </View>

      <Text
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`${isSend ? 'Sending' : 'Requesting'} ${amount}`}
        style={[styles.amount, { color: colors.text }]}>
        {amount}
      </Text>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What’s it for?"
        placeholderTextColor={colors.textSecondary}
        maxLength={60}
        accessibilityLabel="Note"
        style={[styles.note, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
      />
      <PrivacyPicker value={privacy} onChange={setPrivacyChoice} />

      {error ? (
        <Text variant="small" color="error" align="center" accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}

      {isSend ? (
        <>
          <SwipeToSend label={`Swipe up to ${action.toLowerCase()}`} onComplete={go} disabled={busy} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action} with Face ID`}
            accessibilityHint="Asks for Face ID or your PIN, then sends the money"
            onPress={() => {
              haptics.tap();
              go();
            }}
            disabled={busy}
            style={({ pressed }) => [styles.faceId, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="faceId" size={20} color={colors.accent} />
            <Text variant="bodyMedium" color="accent">
              {busy ? 'Sending…' : 'Or use Face ID'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Button label={action} loading={busy} onPress={go} />
      )}

      <View style={styles.trust}>
        <Icon name="lock" size={14} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary">
          {isSend ? 'Encrypted · arrives in seconds' : `Encrypted · ${first} approves first`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, alignSelf: 'stretch' },
  who: { alignItems: 'center', gap: 8 },
  amount: {
    fontFamily: Fonts.bold,
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  note: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 17,
    textAlign: 'center',
  },
  faceId: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TAP },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
