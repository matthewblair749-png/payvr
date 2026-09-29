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

/** A payment in the feed: two faces, who paid whom, the note (the star), and reactions. */
export function StoryCard({ story, detail }: { story: Story; detail?: boolean }) {
  const { colors } = useTheme();
  const { userById, me } = useApp();
  const { toggleLike } = useSocial();
  const from = userById(story.fromUser);
  const to = userById(story.toUser);
  const name = (id: string, u?: { name: string }) => (id === me.id ? 'You' : (u?.name.split(' ')[0] ?? 'Someone'));
  const fromName = name(story.fromUser, from);
  const toName = story.toUser === me.id ? 'you' : name(story.toUser, to);
  const received = story.mine && story.toUser === me.id;

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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale
        scaleTo={0.985}
        accessibilityRole={detail ? undefined : 'button'}
        accessibilityLabel={story.amountCents !== null ? `${summary}. ${formatCents(story.amountCents)}` : summary}
        disabled={detail}
        onPress={open}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.9 : 1 }]}>
        <View style={styles.head}>
          <View style={styles.faces}>
            <Avatar name={from?.name ?? '?'} uri={from?.avatarUrl} size={40} />
            <View style={[styles.second, { borderColor: colors.surface }]}>
              <Avatar name={to?.name ?? '?'} uri={to?.avatarUrl} size={40} />
            </View>
          </View>
          <View style={styles.flex}>
            <Text variant="bodyMedium" numberOfLines={1}>
              <Text variant="bodyMedium" style={styles.bold}>
                {fromName}
              </Text>{' '}
              paid{' '}
              <Text variant="bodyMedium" style={styles.bold}>
                {toName}
              </Text>
            </Text>
            <View style={styles.meta}>
              <Text variant="caption" color="textSecondary">
                {shortTime(story.createdAt)}
              </Text>
              <Icon name={privacyIcon(story.privacy)} size={13} color={colors.textSecondary} />
            </View>
          </View>
          {story.amountCents !== null ? (
            <Text variant="amount" color={received ? 'successText' : 'text'}>
              {received ? '+' : '−'}
              {formatCents(story.amountCents)}
            </Text>
          ) : null}
        </View>
        {story.note ? <Text style={[styles.note, { color: colors.text }]}>{story.note}</Text> : null}
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={story.likedByMe ? 'Unlike' : 'Like'}
          aria-pressed={story.likedByMe}
          onPress={like}
          style={styles.action}>
          <Animated.View style={heartStyle}>
            <Icon
              name={story.likedByMe ? 'heartFilled' : 'heart'}
              size={22}
              color={story.likedByMe ? colors.accent : colors.textSecondary}
            />
          </Animated.View>
          <Text variant="caption" color={story.likedByMe ? 'accent' : 'textSecondary'}>
            {story.likes || ''}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${story.comments.length} comments`}
          disabled={detail}
          onPress={open}
          style={styles.action}>
          <Icon name="comment" size={22} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary">
            {story.comments.length || ''}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 4 },
  main: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faces: { flexDirection: 'row', width: 68 },
  second: { marginLeft: -12, borderWidth: 2, borderRadius: 24 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontFamily: Fonts.bold },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { fontFamily: Fonts.medium, fontSize: 21, lineHeight: 28, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: -10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 10 },
});
