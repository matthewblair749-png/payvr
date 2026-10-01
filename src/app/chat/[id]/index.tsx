import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { GroupAvatar } from '@/components/group-avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { IconTile } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { ChatMessage, Split } from '@/data/chat';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { dayLabel } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { formatCents, formatShort } from '@/utils/money';
import { smooth } from '@/utils/motion';

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { chatById, messagesFor, sendText, markRead, typing } = useChat();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const chat = chatById(id);
  const messages = messagesFor(id);
  const typingUser = typing[id] ? userById(typing[id]!) : undefined;

  // Reading the chat clears its unread count, including messages that arrive while open.
  useFocusEffect(
    useCallback(() => {
      markRead(id);
    }, [id, markRead]),
  );
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    markRead(id);
  }, [id, lastId, markRead]);

  if (!chat) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <Text color="textSecondary" align="center" style={styles.missing}>
          This chat isn’t available.
        </Text>
      </View>
    );
  }

  const members = chat.memberIds.map((m) => (m === me.id ? me : userById(m))).filter((u): u is User => !!u);
  const others = members.filter((u) => u.id !== me.id);

  const send = () => {
    if (!text.trim()) return;
    sendText(chat.id, text);
    setText('');
  };

  const canSend = !!text.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={[styles.head, { borderBottomColor: colors.border }]}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <GroupAvatar members={others} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyMedium" numberOfLines={1} accessibilityRole="header" style={styles.headTitle}>
            {chat.name}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {typingUser
              ? `${typingUser.name.split(' ')[0]} is typing…`
              : `${members.map((u) => (u.id === me.id ? 'You' : u.name.split(' ')[0])).join(', ')}`}
          </Text>
        </View>
        <PressableScale
          scaleTo={0.94}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Split a bill"
          onPress={() => router.push({ pathname: '/chat/[id]/split', params: { id: chat.id } })}
          style={[styles.splitBtn, { backgroundColor: colors.primary + '1F' }]}>
          <Icon name="users" size={16} color={colors.accent} />
          <Text variant="caption" color="accent">
            Split
          </Text>
        </PressableScale>
      </View>

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const showTime = !prev || new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() > GAP_MS;
          const nextShowsTime = !!next && new Date(next.createdAt).getTime() - new Date(item.createdAt).getTime() > GAP_MS;
          const firstOfRun = showTime || !sameRun(prev, item);
          const lastOfRun = !next || nextShowsTime || !sameRun(item, next);
          return (
            <>
              {showTime ? (
                <Text variant="caption" color="textSecondary" align="center" style={styles.time}>
                  {timeLabel(item.createdAt)}
                </Text>
              ) : null}
              <MessageItem m={item} firstOfRun={firstOfRun} lastOfRun={lastOfRun} chatId={chat.id} />
            </>
          );
        }}
        ListFooterComponent={typingUser ? <TypingBubble user={typingUser} /> : null}
      />

      <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <PressableScale
          scaleTo={0.92}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Split a bill"
          onPress={() => router.push({ pathname: '/chat/[id]/split', params: { id: chat.id } })}
          style={({ pressed }) => [styles.plus, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}>
          <Icon name="plus" size={22} color={colors.accent} />
        </PressableScale>
        <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`Message ${chat.name}`}
            placeholderTextColor={colors.textSecondary}
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
            accessibilityLabel="Message"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, { color: colors.text }]}
          />
          <PressableScale
            scaleTo={0.9}
            haptic={canSend ? 'tap' : undefined}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            aria-disabled={!canSend}
            onPress={send}
            style={styles.sendTap}>
            <View style={[styles.send, { backgroundColor: canSend ? colors.primary : colors.border }]}>
              <Icon name="send" size={18} color={canSend ? colors.onPrimary : colors.textSecondary} strokeWidth={2.6} />
            </View>
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** A new time divider appears after a quiet gap. */
const GAP_MS = 30 * 60_000;

const isBubble = (m?: ChatMessage) => !!m && (m.kind === 'text' || m.kind === 'split');
const sameRun = (a?: ChatMessage, b?: ChatMessage) => isBubble(a) && isBubble(b) && a!.userId === b!.userId;

function timeLabel(iso: string) {
  const day = dayLabel(iso);
  const time = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}

/** Three softly pulsing dots in a bubble. */
function TypingBubble({ user }: { user: User }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.msgRow, styles.runGap]} accessibilityLiveRegion="polite">
      <View style={styles.msgAvatar}>
        <Avatar name={user.name} uri={user.avatarUrl} size={30} />
      </View>
      <View
        accessibilityLabel={`${user.name.split(' ')[0]} is typing`}
        style={[styles.bubble, styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 160} />
        ))}
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.set(withDelay(delay, withRepeat(withSequence(withTiming(1, smooth(380)), withTiming(0.35, smooth(380))), -1)));
  }, [delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.textSecondary }, style]} />;
}

function MessageItem({ m, firstOfRun, lastOfRun, chatId }: { m: ChatMessage; firstOfRun: boolean; lastOfRun: boolean; chatId: string }) {
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const mine = m.userId === me.id;
  const author = mine ? me : userById(m.userId);
  const first = (id: string) => (id === me.id ? 'you' : (userById(id)?.name.split(' ')[0] ?? 'someone'));

  if (m.kind === 'system') {
    return (
      <Text variant="caption" color="textSecondary" align="center" style={styles.system}>
        {m.text}
      </Text>
    );
  }

  if (m.kind === 'payment') {
    const who = mine ? 'You' : (author?.name.split(' ')[0] ?? 'Someone');
    return (
      <Animated.View
        entering={FadeInUp.duration(260)}
        accessibilityLabel={`${who} paid ${first(m.toUser)} ${formatShort(m.cents)} for ${m.note}`}
        style={[styles.payment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.payIcon, { backgroundColor: colors.success + '22' }]}>
          <Icon name="check" size={13} color={colors.success} strokeWidth={3} />
        </View>
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.payText}>
          <Text variant="caption">{who}</Text> paid <Text variant="caption">{first(m.toUser)}</Text>{' '}
          <Text variant="caption" style={styles.payAmount}>
            {formatShort(m.cents)}
          </Text>{' '}
          · {m.note}
        </Text>
      </Animated.View>
    );
  }

  // Bubbles in a run hug each other: the corners facing the neighbor get tighter.
  const tight = 6;
  const round = 20;
  const shape = mine
    ? { borderTopRightRadius: firstOfRun ? round : tight, borderBottomRightRadius: lastOfRun ? round : tight }
    : { borderTopLeftRadius: firstOfRun ? round : tight, borderBottomLeftRadius: lastOfRun ? round : tight };

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={[styles.msgRow, mine && styles.msgRowMine, firstOfRun && styles.runGap]}>
      {!mine ? (
        <View style={styles.msgAvatar}>
          {lastOfRun && author ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${author.name}'s profile`}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: author.id } })}
              style={styles.avatarTap}>
              <Avatar name={author.name} uri={author.avatarUrl} size={30} />
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.msgCol, mine && styles.msgColMine]}>
        {!mine && firstOfRun ? (
          <Text variant="caption" color="textSecondary" style={styles.author}>
            {author?.name.split(' ')[0]}
          </Text>
        ) : null}
        {m.kind === 'text' ? (
          <View
            style={[
              styles.bubble,
              shape,
              mine ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <Text style={mine ? { color: colors.onPrimary } : undefined}>{m.text}</Text>
          </View>
        ) : (
          <SplitCard split={m.split} chatId={chatId} />
        )}
      </View>
    </Animated.View>
  );
}

function SplitCard({ split, chatId }: { split: Split; chatId: string }) {
  const { colors } = useTheme();
  const { me, userById, setDraft } = useApp();
  const paid = split.shares.filter((s) => s.paidTxId).length;
  const owner = split.ownerId === me.id ? me : userById(split.ownerId);
  const ownerFirst = split.ownerId === me.id ? 'You' : (owner?.name.split(' ')[0] ?? 'Someone');
  const done = paid === split.shares.length;

  const payShare = (cents: number) => {
    haptics.tap();
    setDraft({ mode: 'send', amountCents: cents, note: split.note, peerId: split.ownerId, chatSplit: { chatId, splitId: split.id } });
    router.push('/confirm');
  };

  return (
    <View
      style={[styles.split, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${split.note}, ${formatCents(split.totalCents)}, split ${split.shares.length} ways. ${paid} of ${split.shares.length} paid.`}>
      <View style={styles.splitHead}>
        <IconTile icon="users" size={38} />
        <View style={styles.flex}>
          <Text variant="caption" color="textSecondary">
            {ownerFirst} paid · split {split.shares.length} ways
          </Text>
          <Text variant="bodyMedium" numberOfLines={1}>
            {split.note}
          </Text>
        </View>
        <Text style={[styles.splitTotal, { color: colors.text }]}>{formatShort(split.totalCents)}</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fillBar, { backgroundColor: done ? colors.success : colors.primary, width: `${(paid / split.shares.length) * 100}%` }]} />
      </View>
      <View style={styles.progressLine}>
        <Text variant="caption" color={done ? 'successText' : 'textSecondary'}>
          {done ? 'Everyone’s paid' : `${paid} of ${split.shares.length} paid`}
        </Text>
        <Text variant="caption" color="textSecondary">
          {formatShort(split.totalCents - split.shares.filter((x) => x.paidTxId || x.userId === split.ownerId).reduce((a, x) => a + x.cents, 0))} left
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {split.shares.map((s) => {
        const u = s.userId === me.id ? me : userById(s.userId);
        const isOwner = s.userId === split.ownerId;
        const mineToPay = s.userId === me.id && !s.paidTxId && !isOwner;
        return (
          <View key={s.userId} style={styles.share}>
            <Avatar name={u?.name ?? '?'} uri={u?.avatarUrl} size={28} />
            <Text variant="small" numberOfLines={1} style={styles.flex}>
              {s.userId === me.id ? 'You' : u?.name.split(' ')[0]}
            </Text>
            <Text variant="amount">{formatShort(s.cents)}</Text>
            {mineToPay ? (
              <PressableScale
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityLabel={`Pay your share, ${formatShort(s.cents)} to ${ownerFirst}`}
                onPress={() => payShare(s.cents)}
                style={({ pressed }) => [styles.payPill, { backgroundColor: colors.primary }]}>
                <Text variant="caption" style={{ color: colors.onPrimary }}>
                  Pay
                </Text>
              </PressableScale>
            ) : isOwner ? (
              <Chip label="Paid bill" tone="muted" />
            ) : s.paidTxId ? (
              <Chip label="Paid" tone="success" />
            ) : (
              <Chip label="Waiting" tone="muted" />
            )}
          </View>
        );
      })}
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'success' | 'muted' }) {
  const { colors } = useTheme();
  const success = tone === 'success';
  return (
    <View style={[styles.chip, { backgroundColor: success ? colors.success + '22' : colors.border + '80' }]}>
      {success ? <Icon name="check" size={12} color={colors.success} strokeWidth={3} /> : null}
      <Text variant="caption" color={success ? 'successText' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  missing: { marginTop: 64 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
    paddingRight: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headTitle: { fontFamily: Fonts.bold },
  splitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, paddingHorizontal: 14, borderRadius: 999 },
  time: { marginTop: 18, marginBottom: 6 },
  messages: { paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  system: { marginVertical: 10 },
  payment: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '92%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    marginVertical: 10,
  },
  payIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  payText: { flexShrink: 1 },
  payAmount: { fontFamily: Fonts.bold },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  msgRowMine: { justifyContent: 'flex-end' },
  runGap: { marginTop: 8 },
  msgAvatar: { width: 30 },
  // 44pt tap area around the 30pt face, without moving it.
  avatarTap: { width: MIN_TAP, height: MIN_TAP, margin: -7, alignItems: 'center', justifyContent: 'center' },
  msgCol: { maxWidth: '78%', gap: 3 },
  msgColMine: { alignItems: 'flex-end' },
  author: { marginLeft: 12 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  typingBubble: { flexDirection: 'row', gap: 5, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  split: { width: 288, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  progressLine: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 72, height: 26, borderRadius: 13, paddingHorizontal: 10 },
  splitHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitTotal: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillBar: { height: 8, borderRadius: 4 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  payPill: { minHeight: MIN_TAP, minWidth: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginVertical: -4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  plus: { width: MIN_TAP, height: MIN_TAP, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP + 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 16, paddingRight: 2 },
  // The pill's border shows focus, so the web's default outline is turned off.
  input: { flex: 1, minHeight: MIN_TAP, fontFamily: Fonts.regular, fontSize: 16, outlineWidth: 0 },
  sendTap: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
