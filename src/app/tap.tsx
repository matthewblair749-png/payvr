import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LogoGlyph } from '@/components/logo';
import { PressableScale } from '@/components/pressable-scale';
import { PulseRings } from '@/components/pulse-rings';
import { TappingPhone } from '@/components/tapping-phone';
import { SendPanel } from '@/components/send-panel';
import { Text } from '@/components/text';
import type { Draft } from '@/data/types';
import { demoFound, startTap, TAP_SESSION_MS, type TapFound, type TapStatus } from '@/services/nearby';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';
import { smooth } from '@/utils/motion';

type Phase = 'searching' | 'found' | 'expired' | 'blocked';
type Blocked = { status: Exclude<TapStatus, 'starting' | 'searching'>; message?: string };

export default function Tap() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft, tapCandidates, addPeople } = useApp();
  const [phase, setPhase] = useState<Phase>('searching');
  const [starting, setStarting] = useState(true);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [found, setFound] = useState<TapFound | null>(null);
  const [remaining, setRemaining] = useState(TAP_SESSION_MS / 1000);
  const [attempt, setAttempt] = useState(0);
  const sheet = useSharedValue(900);
  const startedAt = useRef(0);

  const showFound = useCallback(
    (f: TapFound) => {
      addPeople([f.user]);
      haptics.success();
      setFound(f);
      setPhase('found');
      sheet.set(withTiming(0, smooth(420)));
    },
    [addPeople, sheet],
  );

  // One tap session per `attempt` (retry / "not them"). Only this screen advertises and
  // scans; leaving the screen stops the radios and ends the session on the server.
  useEffect(() => {
    if (!draft) return;
    startedAt.current = Date.now();
    const tap = startTap(
      { amountCents: draft.amountCents, mode: draft.mode, mockCandidates: tapCandidates },
      {
        onStatus: (status, message) => {
          if (status === 'starting') return;
          setStarting(false);
          if (status !== 'searching') {
            setBlocked({ status, message });
            setPhase('blocked');
          }
        },
        onFound: showFound,
      },
    );
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((TAP_SESSION_MS - (Date.now() - startedAt.current)) / 1000));
      setRemaining(left);
      if (left === 0) {
        tap.stop();
        setPhase((p) => (p === 'searching' ? 'expired' : p));
        clearInterval(tick);
      }
    }, 500);
    return () => {
      tap.stop();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheet.value }] }));

  const restart = useCallback(() => {
    sheet.set(withTiming(900, { duration: 200 }));
    setRemaining(TAP_SESSION_MS / 1000);
    setPhase('searching');
    setStarting(true);
    setBlocked(null);
    setFound(null);
    setAttempt((a) => a + 1);
  }, [sheet]);

  const simulateTap = useCallback(async () => {
    if (!draft) return;
    const people = await tapCandidates().catch(() => []);
    const pick = people[0];
    if (pick) showFound(demoFound(pick, draft.mode));
  }, [draft, tapCandidates, showFound]);

  if (!draft) {
    return null;
  }

  const verb = draft.mode === 'send' ? 'Sending' : 'Requesting';
  const showQr = () => router.push({ pathname: '/qr', params: { tab: draft.mode === 'send' ? 'scan' : 'mine' } });

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        <Text variant="caption" color="textSecondary">
          {verb} {formatShort(draft.amountCents)}
          {draft.note ? ` · ${draft.note}` : ''}
        </Text>
        {phase === 'searching' && !starting ? (
          <Text variant="caption" color="textSecondary" accessibilityLabel={`Session expires in ${remaining} seconds`}>
            {`0:${String(remaining).padStart(2, '0')}`}
          </Text>
        ) : null}
      </View>

      <View style={styles.center}>
        {phase === 'expired' ? (
          <Notice
            title="Didn’t find anyone"
            body="Tap sessions close after 60 seconds to keep you safe. Make sure their Payvr is open on the Tap screen, then try again."
            actions={<Button label="Try again" onPress={restart} style={styles.stretch} />}
          />
        ) : phase === 'blocked' && blocked ? (
          <BlockedNotice blocked={blocked} onRetry={restart} onQr={showQr} onSimulate={simulateTap} />
        ) : (
          <>
            <View style={styles.rings}>
              <PulseRings size={140} spread={1.5} thickness={3} glow active={phase === 'searching' && !starting}>
                <TappingPhone size={132} active={phase === 'searching' && !starting} />
              </PulseRings>
            </View>
            <Text variant="title" align="center" style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
              {phase === 'found' ? 'Found them' : starting ? 'Getting ready…' : 'Hold phones together'}
            </Text>
            <PressableScale accessibilityRole="link" onPress={showQr} style={styles.qrLink}>
              <Icon name="qr" size={18} color={colors.accent} />
              <Text variant="bodyMedium" color="accent">
                Show QR code instead
              </Text>
            </PressableScale>
          </>
        )}
      </View>

      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => {
          setDraft(null);
          router.back();
        }}
        style={styles.cancel}
      />

      {found ? (
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 },
            sheetStyle,
          ]}
          accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <SendPanel peer={found.user} draft={draft} patch={{ peerId: found.user.id, viaTap: true }}>
            <HowFound found={found} />
            <IntentHint found={found} draft={draft} />
          </SendPanel>
          <Button label="Not them? Keep looking" variant="ghost" size="md" onPress={restart} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function HowFound({ found }: { found: TapFound }) {
  const text =
    found.via === 'uwb' && found.distanceCm !== null
      ? `${Math.max(1, found.distanceCm)} cm away · Ultra Wideband`
      : found.via === 'bluetooth'
        ? 'Right next to you · Bluetooth'
        : 'Found by tap';
  return (
    <Text variant="caption" color="accent" align="center">
      {text}
    </Text>
  );
}

/** What the other phone is doing, so mismatches are obvious before confirming. */
function IntentHint({ found, draft }: { found: TapFound; draft: Draft }) {
  if (found.via === 'demo') return null;
  const first = found.user.name.split(' ')[0];
  let text: string | null = null;
  let warn = false;
  if (draft.mode === 'send' && found.mode === 'request') {
    warn = found.amountCents !== draft.amountCents;
    text = warn
      ? `${first} is requesting ${formatShort(found.amountCents)}, but you’re sending ${formatShort(draft.amountCents)}.`
      : `${first} is requesting ${formatShort(found.amountCents)}.`;
  } else if (draft.mode === found.mode) {
    warn = true;
    text = draft.mode === 'send' ? `${first} is also trying to send money.` : `${first} is also requesting money.`;
  }
  return text ? (
    <Text variant="small" align="center" color={warn ? 'error' : 'textSecondary'} accessibilityLiveRegion="polite">
      {text}
    </Text>
  ) : null;
}

function BlockedNotice({
  blocked,
  onRetry,
  onQr,
  onSimulate,
}: {
  blocked: Blocked;
  onRetry: () => void;
  onQr: () => void;
  onSimulate: () => void;
}) {
  switch (blocked.status) {
    case 'bluetooth_off':
      return (
        <Notice
          icon="bluetooth"
          title="Turn on Bluetooth"
          body="Payvr uses Bluetooth to find the phone you’re tapping. Turn it on in Control Center or Settings."
          actions={
            <>
              <Button label="Try again" onPress={onRetry} style={styles.stretch} />
              <Button label="Show QR code instead" variant="ghost" onPress={onQr} style={styles.stretch} />
            </>
          }
        />
      );
    case 'unauthorized':
      return (
        <Notice
          icon="bluetooth"
          title="Allow Bluetooth"
          body="Bluetooth permission is off for Payvr, so it can’t find the phone you’re tapping."
          actions={
            <>
              <Button label="Open Settings" onPress={() => Linking.openSettings()} style={styles.stretch} />
              <Button label="Try again" variant="ghost" onPress={onRetry} style={styles.stretch} />
            </>
          }
        />
      );
    case 'unsupported':
      return (
        <Notice
          icon="qr"
          title="Tap isn’t available here"
          body="Tapping needs Bluetooth and the Payvr app build (not Expo Go or the web preview). Use a QR code instead."
          actions={
            <>
              <Button label="Show QR code" onPress={onQr} style={styles.stretch} />
              <Button label="Prototype: simulate a tap" variant="ghost" onPress={onSimulate} style={styles.stretch} />
            </>
          }
        />
      );
    default:
      return (
        <Notice
          title="Something went wrong"
          body={blocked.message ?? 'Tapping stopped unexpectedly.'}
          actions={
            <>
              <Button label="Try again" onPress={onRetry} style={styles.stretch} />
              <Button label="Show QR code instead" variant="ghost" onPress={onQr} style={styles.stretch} />
            </>
          }
        />
      );
  }
}

function Notice({
  icon,
  title,
  body,
  actions,
}: {
  icon?: 'bluetooth' | 'qr';
  title: string;
  body: string;
  actions: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.notice}>
      <View style={[styles.noticeIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {icon ? <Icon name={icon} size={44} color={colors.textSecondary} strokeWidth={1.6} /> : <LogoGlyph size={56} color={colors.textSecondary} />}
      </View>
      <Text variant="title" align="center" accessibilityRole="header">
        {title}
      </Text>
      <Text color="textSecondary" align="center" style={styles.noticeBody}>
        {body}
      </Text>
      <View style={styles.noticeActions}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, minHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The rings fill the screen and may run off its edges.
  rings: { height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  title: { marginTop: 8, marginBottom: 4 },
  qrLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TAP, paddingHorizontal: 12 },
  cancel: { marginHorizontal: 24 },
  notice: { alignItems: 'center', paddingHorizontal: 24, gap: 10, alignSelf: 'stretch' },
  noticeIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noticeBody: { maxWidth: 320 },
  noticeActions: { marginTop: 18, alignSelf: 'stretch', gap: 4 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
});
