import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import type { Draft, Privacy, User } from '@/data/types';
import { PaymentError } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useCards, type FundingSource } from '@/store/cards-store';
import { useChat } from '@/store/chat-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';
import { smooth } from '@/utils/motion';

import { Avatar } from './avatar';
import { Button } from './button';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
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
  const { submitDraft, addMoney, balanceCents } = useApp();
  const { cards, defaultSource, sourceLabel, notePaidWith } = useCards();
  const { defaultPrivacy, setPrivacy } = useSocial();
  const authorize = useAuthorize();
  const { markSharePaid } = useChat();
  const reduceMotion = useReducedMotion();
  const [note, setNote] = useState(draft.note);
  const [privacy, setPrivacyChoice] = useState<Privacy>(draft.privacy ?? defaultPrivacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What pays: the balance, or a connected card (charged in test mode first, then sent).
  const short = draft.amountCents > balanceCents;
  const [source, setSource] = useState<FundingSource>(() => {
    let s = draft.source ?? defaultSource;
    if (s !== 'balance' && !cards.some((c) => c.id === s)) s = 'balance';
    if (s === 'balance' && short && cards[0]) s = cards[0].id;
    return s;
  });
  const [choosing, setChoosing] = useState(false);
  const withCard = source !== 'balance';

  const first = peer.name.split(' ')[0];
  const amount = formatShort(draft.amountCents);
  const payingRequest = draft.origin === 'qrRequest' || !!draft.requestId;
  const isSend = draft.mode === 'send';
  const action = payingRequest ? `Pay ${amount}` : isSend ? `Send ${amount}` : `Request ${amount}`;

  // Their photo zooms in when the panel appears.
  const zoom = useSharedValue(reduceMotion ? 1 : 0.7);
  useEffect(() => {
    zoom.set(withDelay(60, withTiming(1, smooth(460))));
  }, [zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  const go = async () => {
    if (busy) return;
    setError(null);
    const via = isSend && withCard ? ` with ${sourceLabel(source)}` : '';
    if (isSend && !(await authorize(`${payingRequest ? 'Pay' : 'Send'} ${amount} to ${peer.name}${via}`))) return;
    setBusy(true);
    try {
      // Paying with a card: charge it first (test mode), then send from Payvr as usual.
      if (isSend && withCard) await addMoney(draft.amountCents);
      const tx = await submitDraft({ ...patch, note: note.trim(), privacy });
      setPrivacy(tx.id, privacy);
      if (isSend) notePaidWith(tx.id, sourceLabel(source));
      if (draft.chatSplit) markSharePaid(draft.chatSplit.chatId, draft.chatSplit.splitId, tx.fromUser, tx.id);
      router.replace({ pathname: '/success', params: draft.chatSplit ? { id: tx.id, chat: '1' } : { id: tx.id } });
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

      {isSend && cards.length ? (
        <View style={[styles.payWith, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PressableScale
            scaleTo={0.98}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`Pay with ${sourceLabel(source)}. Change`}
            aria-expanded={choosing}
            onPress={() => setChoosing((c) => !c)}
            style={styles.payWithRow}>
            <Icon name={withCard ? 'card' : 'wallet'} size={20} color={colors.accent} />
            <View style={styles.flex}>
              <Text variant="caption" color="textSecondary">
                Pay with
              </Text>
              <Text variant="bodyMedium">{sourceLabel(source)}</Text>
            </View>
            <Icon name={choosing ? 'chevronUp' : 'chevronDown'} size={18} color={colors.textSecondary} />
          </PressableScale>
          {choosing
            ? (['balance', ...cards.map((c) => c.id)] as FundingSource[]).map((s) => {
                const off = s === 'balance' && short;
                const on = s === source;
                return (
                  <PressableScale
                    key={s}
                    scaleTo={0.98}
                    haptic="tap"
                    disabled={off}
                    accessibilityRole="radio"
                    aria-checked={on}
                    aria-disabled={off}
                    accessibilityLabel={sourceLabel(s)}
                    onPress={() => {
                      setSource(s);
                      setChoosing(false);
                    }}
                    style={[styles.option, { borderTopColor: colors.border, opacity: off ? 0.45 : 1 }]}>
                    <Text variant="bodyMedium" style={styles.flex}>
                      {sourceLabel(s)}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {s === 'balance' ? (off ? 'Not enough' : `${formatShort(balanceCents)} available`) : 'Test card'}
                    </Text>
                    {on ? <Icon name="check" size={18} color={colors.accent} /> : <View style={styles.checkSpace} />}
                  </PressableScale>
                );
              })
            : null}
        </View>
      ) : null}

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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${action} with Face ID`}
            accessibilityHint="Asks for Face ID or your PIN, then sends the money"
            onPress={() => {
              haptics.tap();
              go();
            }}
            disabled={busy}
            style={({ pressed }) => [styles.faceId, { opacity: pressed ? 0.75 : 1 }]}>
            <Icon name="faceId" size={20} color={colors.accent} />
            <Text variant="bodyMedium" color="accent">
              {busy ? 'Sending…' : 'Or use Face ID'}
            </Text>
          </PressableScale>
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
  flex: { flex: 1 },
  payWith: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  payWithRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP + 4, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  checkSpace: { width: 18 },
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
