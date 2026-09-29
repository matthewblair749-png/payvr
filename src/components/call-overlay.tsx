import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CallSnapshot, EndReason } from '@/services/calls/types';
import { useApp } from '@/store/app-store';
import { useCall } from '@/store/call-store';
import { BRAND_BLUE } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

import { Avatar } from './avatar';
import { CallVideo } from './call-video';
import { Icon, type IconName } from './icon';
import { PulseRings } from './pulse-rings';
import { Text } from './text';

const END_TEXT: Record<EndReason, string> = {
  hangup: 'Call ended',
  remoteHangup: 'Call ended',
  declined: 'Call declined',
  noAnswer: 'No answer',
  busy: 'They’re on another call',
  failed: 'Call dropped',
  permission: 'Allow the microphone and camera to call',
};

/**
 * The call screen: outgoing (ringing), incoming, connected, ended; voice or video. It sits above
 * the whole app rather than in the navigation stack, so stepping away (to pay them) and coming
 * back never tangles the history. Android's back button steps away; it never hangs up.
 */
export function CallOverlay() {
  const { call, expanded, setExpanded } = useCall();
  const visible = !!call && expanded;
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (call?.phase === 'incoming') return true;
      setExpanded(false);
      return true;
    });
    return () => sub.remove();
  }, [visible, call?.phase, setExpanded]);
  if (!visible || !call) return null;
  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <CallView call={call} />
    </View>
  );
}

function CallView({ call }: { call: CallSnapshot }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { userById, setDraft } = useApp();
  const { accept, decline, hangup, setMuted, setCameraOff, flipCamera, setExpanded } = useCall();
  const peer = userById(call.peerId);
  const name = peer?.name ?? 'Someone';
  const first = name.split(' ')[0];
  const video = call.kind === 'video';
  const live = call.phase === 'connected';
  const elapsed = useElapsed(call.connectedAt);
  const onVideoBg = video; // Video calls sit on black; voice calls follow the theme.
  const fg = onVideoBg ? '#FFFFFF' : colors.text;
  const muted2 = onVideoBg ? 'rgba(255,255,255,0.72)' : colors.textSecondary;

  const status =
    call.phase === 'outgoing'
      ? 'Calling…'
      : call.phase === 'incoming'
        ? video
          ? 'Payvr video call'
          : 'Payvr call'
        : call.phase === 'connecting'
          ? 'Connecting…'
          : call.phase === 'connected'
            ? elapsed
            : END_TEXT[call.endReason ?? 'hangup'];

  const pay = () => {
    setDraft(null);
    setExpanded(false);
    router.push({ pathname: '/amount', params: { to: call.peerId } });
  };

  const remote = call.remoteStream && !call.demo ? call.remoteStream : null;
  const showRemoteVideo = video && live && !!remote;

  return (
    <View style={[styles.fill, { backgroundColor: onVideoBg ? '#000000' : colors.background }]}>
      {/* Remote video fills the screen; otherwise their photo sits in the middle. */}
      {showRemoteVideo ? <CallVideo stream={remote} style={StyleSheet.absoluteFill} /> : null}
      {!video && remote && Platform.OS === 'web' ? (
        // Voice call in a browser: an invisible player for their audio.
        <CallVideo stream={remote} style={styles.hidden} />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
        <View style={styles.lock} accessible accessibilityLabel="Encrypted call">
          <Icon name="lock" size={13} color={muted2} />
          <Text variant="caption" style={{ color: muted2 }}>
            {call.demo ? 'Demo call · no one is on the line' : 'Encrypted'}
          </Text>
        </View>
        {showRemoteVideo ? (
          <>
            <Text variant="heading" style={[styles.shadowText, { color: fg }]}>
              {name}
            </Text>
            <Text variant="bodyMedium" style={[styles.shadowText, styles.tabular, { color: muted2 }]}>
              {status}
            </Text>
          </>
        ) : null}
      </View>

      {!showRemoteVideo ? (
        <View style={styles.center}>
          <PulseRings size={132} spread={1.4} active={call.phase === 'outgoing' || call.phase === 'incoming'}>
            <Avatar name={name} uri={peer?.avatarUrl} size={132} />
          </PulseRings>
          <Text variant="title" align="center" style={{ color: fg }}>
            {name}
          </Text>
          <Text
            variant="bodyMedium"
            align="center"
            accessibilityLiveRegion="polite"
            style={[styles.tabular, { color: call.phase === 'ended' ? muted2 : muted2 }]}>
            {status}
          </Text>
          {video && live && call.demo ? (
            <Text variant="caption" align="center" style={[styles.demoNote, { color: muted2 }]}>
              In demo mode {first} has no camera. Your own camera is real.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.flex} />
      )}

      {/* Your camera, top right. */}
      {video && call.phase !== 'ended' && call.phase !== 'incoming' ? (
        <Animated.View entering={FadeIn} style={[styles.self, { top: insets.top + 64, borderColor: 'rgba(255,255,255,0.25)' }]}>
          {call.localStream && !call.cameraOff ? (
            <CallVideo stream={call.localStream} mirror />
          ) : (
            <View style={[styles.selfOff, { backgroundColor: '#1C1C1E' }]}>
              <Icon name="videoOff" size={22} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </Animated.View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        {call.phase === 'incoming' ? (
          <View style={styles.answerRow}>
            <RoundButton icon="callEnd" label="Decline" color="#FFFFFF" bg={colors.error} onPress={decline} caption="Decline" captionColor={fg} big />
            <RoundButton
              icon={video ? 'video' : 'call'}
              label="Accept"
              color="#FFFFFF"
              bg={BRAND_BLUE}
              onPress={accept}
              caption="Accept"
              captionColor={fg}
              big
            />
          </View>
        ) : call.phase === 'ended' ? null : (
          <View style={styles.row}>
            <RoundButton
              icon={call.muted ? 'micOff' : 'mic'}
              label={call.muted ? 'Unmute' : 'Mute'}
              selected={call.muted}
              onPress={() => setMuted(!call.muted)}
              caption={call.muted ? 'Unmute' : 'Mute'}
              captionColor={fg}
              onDark={onVideoBg}
            />
            {video ? (
              <RoundButton
                icon={call.cameraOff ? 'videoOff' : 'video'}
                label={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}
                selected={call.cameraOff}
                onPress={() => setCameraOff(!call.cameraOff)}
                caption="Camera"
                captionColor={fg}
                onDark={onVideoBg}
              />
            ) : null}
            {video && Platform.OS !== 'web' ? (
              <RoundButton icon="flip" label="Flip camera" onPress={flipCamera} caption="Flip" captionColor={fg} onDark={onVideoBg} />
            ) : null}
            <RoundButton icon="send" label={`Pay ${first}`} onPress={pay} caption="Pay" captionColor={fg} onDark={onVideoBg} />
            <RoundButton icon="callEnd" label="End call" color="#FFFFFF" bg={colors.error} onPress={hangup} caption="End" captionColor={fg} />
          </View>
        )}
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  caption,
  captionColor,
  color,
  bg,
  selected,
  onDark,
  big,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  caption: string;
  captionColor: string;
  color?: string;
  bg?: string;
  selected?: boolean;
  onDark?: boolean;
  big?: boolean;
}) {
  const { colors } = useTheme();
  const size = big ? 76 : 60;
  const base = onDark ? 'rgba(255,255,255,0.16)' : colors.surface;
  const background = bg ?? (selected ? (onDark ? '#FFFFFF' : colors.text) : base);
  const tint = color ?? (selected ? (onDark ? '#000000' : colors.background) : onDark ? '#FFFFFF' : colors.text);
  return (
    <View style={styles.btnWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-pressed={selected}
        onPress={onPress}
        style={({ pressed }) => [
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background, transform: [{ scale: pressed ? 0.92 : 1 }] },
          styles.btn,
          !bg && !onDark && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        ]}>
        <Icon name={icon} size={big ? 30 : 26} color={tint} />
      </Pressable>
      <Text variant="caption" style={{ color: captionColor }}>
        {caption}
      </Text>
    </View>
  );
}

/** "0:42", "12:05", "1:02:10" since the call connected. */
function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return '0:00';
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  top: { alignItems: 'center', gap: 4, paddingHorizontal: 24 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shadowText: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  tabular: { fontVariant: ['tabular-nums'], fontFamily: Fonts.medium },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  demoNote: { maxWidth: 260, marginTop: 4 },
  self: { position: 'absolute', right: 16, width: 104, height: 148, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  selfOff: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  answerRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingHorizontal: 24 },
  btnWrap: { alignItems: 'center', gap: 8 },
  btn: { alignItems: 'center', justifyContent: 'center' },
});
