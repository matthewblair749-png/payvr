import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useApp } from '@/store/app-store';
import { useSocial, type Story } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { shortTime } from '@/utils/dates';
import { formatCents } from '@/utils/money';
import { smooth } from '@/utils/motion';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { privacyIcon } from './privacy-picker';
import { Text } from './text';

/** Notes that are only emoji ("🍕", "🎉🎉") are shown extra large. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s)+$/u;
const isEmojiOnly = (s: string) => !!s && !/[0-9#*]/.test(s) && EMOJI_ONLY.test(s);

/**
 * A payment in the feed, like a post: the payer's face with the receiver's tucked on its
 * corner, "Jake → Sofia", the note as the star, then hearts and comments.
 */
export function StoryCard({ story, detail }: { story: Story; detail?: boolean }) {
  const { colors } = useTheme();
  const { userById, me } = useApp();
  const { toggleLike } = useSocial();
  const from = story.fromUser === me.id ? me : userById(story.fromUser);
  const to = story.toUser === me.id ? me : userById(story.toUser);
  const name = (id: string, u?: { name: string }) => (id === me.id ? 'You' : (u?.name.split(' ')[0] ?? 'Someone'));
  const fromName = name(story.fromUser, from);
  const toName = story.toUser === me.id ? 'you' : name(story.toUser, to);
  const received = story.mine && story.toUser === me.id;
  const emoji = isEmojiOnly(story.note.trim());

  const pop = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const like = () => {
    // A smooth swell and settle (no bounce).
    if (!story.likedByMe) pop.set(withSequence(withTiming(1.25, smooth(140)), withTiming(1, smooth(260))));
    toggleLike(story.id);
  };

  const open = () => router.push({ pathname: '/feed/[id]', params: { id: story.id } });
  const summary = `${fromName} paid ${toName}. ${story.note}. ${shortTime(story.createdAt)}`;

  return (
    <View style={[styles.post, styles.main]}>
      <View style={styles.faces} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Avatar name={from?.name ?? '?'} uri={from?.avatarUrl} size={46} />
        <View style={[styles.second, { borderColor: colors.background }]}>
          <Avatar name={to?.name ?? '?'} uri={to?.avatarUrl} size={26} />
        </View>
      </View>

      <View style={styles.body}>
        <PressableScale
          scaleTo={0.99}
          accessibilityRole={detail ? undefined : 'button'}
          accessibilityLabel={story.amountCents !== null ? `${summary}. ${formatCents(story.amountCents)}` : summary}
          disabled={detail}
          onPress={open}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <View style={styles.headRow}>
            <View style={styles.who}>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.name}>
                {fromName}
              </Text>
              <Icon name="chevronRight" size={14} color={colors.textSecondary} strokeWidth={2.6} />
              <Text variant="bodyMedium" numberOfLines={1} style={styles.name}>
                {toName === 'you' ? 'You' : toName}
              </Text>
            </View>
            {story.amountCents !== null ? (
              <Text variant="amount" color={received ? 'successText' : 'text'}>
                {received ? '+' : '−'}
                {formatCents(story.amountCents)}
              </Text>
            ) : (
              <Text variant="caption" color="textSecondary">
                {shortTime(story.createdAt)}
              </Text>
            )}
          </View>

          {story.note ? (
            <Text style={[emoji ? styles.emojiNote : styles.note, { color: colors.text }]}>{story.note}</Text>
          ) : null}
        </PressableScale>

        <View style={styles.actions}>
          <PressableScale
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={story.likedByMe ? 'Unlike' : 'Like'}
            aria-pressed={story.likedByMe}
            onPress={like}
            style={styles.action}>
            <Animated.View style={heartStyle}>
              <Icon name={story.likedByMe ? 'heartFilled' : 'heart'} size={20} color={story.likedByMe ? colors.accent : colors.textSecondary} />
            </Animated.View>
            <Text variant="caption" color={story.likedByMe ? 'accent' : 'textSecondary'} style={styles.count}>
              {story.likes || ''}
            </Text>
          </PressableScale>
          <PressableScale
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={`${story.comments.length} comments`}
            disabled={detail}
            onPress={open}
            style={styles.action}>
            <Icon name="comment" size={20} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary" style={styles.count}>
              {story.comments.length || ''}
            </Text>
          </PressableScale>
          <View style={styles.spacer} />
          <View style={styles.meta} accessibilityLabel={`Visible to ${story.privacy}`}>
            {story.amountCents !== null ? (
              <Text variant="caption" color="textSecondary">
                {shortTime(story.createdAt)}
              </Text>
            ) : null}
            <Icon name={privacyIcon(story.privacy)} size={14} color={colors.textSecondary} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { paddingVertical: 14 },
  main: { flexDirection: 'row', gap: 12 },
  faces: { width: 50, height: 50 },
  second: { position: 'absolute', right: -4, bottom: -2, borderWidth: 2, borderRadius: 15 },
  body: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  name: { fontFamily: Fonts.bold, flexShrink: 1 },
  note: { fontFamily: Fonts.medium, fontSize: 20, lineHeight: 27, letterSpacing: -0.3, marginTop: 4 },
  emojiNote: { fontSize: 40, lineHeight: 50, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: -10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 10 },
  count: { minWidth: 10 },
  spacer: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
