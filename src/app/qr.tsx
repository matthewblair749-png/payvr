import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useOpenPayvrCode } from '@/hooks/use-open-payvr-code';
import { buildQr, parseQr, REQUEST_CODE_REFRESH_S } from '@/services/qr';
import { useApp } from '@/store/app-store';
import { BRAND_BLUE } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { formatShort } from '@/utils/money';

type Tab = 'mine' | 'scan';

export default function Qr() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { draft } = useApp();
  // Requesting → show your code. Sending → scan theirs.
  const [tab, setTab] = useState<Tab>(params.tab ?? (draft?.mode === 'send' ? 'scan' : 'mine'));
  return (
    <Screen back="close" title="QR code">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: 'My code' },
          { value: 'scan', label: 'Scan' },
        ]}
      />
      <View style={styles.body}>{tab === 'mine' ? <MyCode onScanInstead={() => setTab('scan')} /> : <Scanner />}</View>
    </Screen>
  );
}

// ─────────────────────────────────────────────── My code

function MyCode({ onScanInstead }: { onScanInstead: () => void }) {
  const { me, draft, incoming, dismissIncoming, userById, simulateIncomingPayment } = useApp();
  const { colors } = useTheme();
  const request = draft?.mode === 'request' ? draft : null;

  // Request codes expire, so re-issue a fresh one every minute while it's on screen.
  const [issuedAt, setIssuedAt] = useState(() => Date.now());
  useEffect(() => {
    if (!request) return;
    const t = setInterval(() => setIssuedAt(Date.now()), REQUEST_CODE_REFRESH_S * 1000);
    return () => clearInterval(t);
  }, [request]);

  const payload = request
    ? buildQr(me.handle, { amountCents: request.amountCents, note: request.note }, issuedAt)
    : buildQr(me.handle);

  // When the matching payment lands (realtime), jump straight to success.
  useEffect(() => {
    if (!request || incoming?.kind !== 'payment') return;
    const tx = incoming.transaction;
    if (tx.toUser !== me.id || tx.amountCents !== request.amountCents) return;
    dismissIncoming();
    router.replace({ pathname: '/success', params: { id: tx.id } });
  }, [incoming, request, me.id, dismissIncoming]);

  return (
    <View style={styles.center}>
      {request ? (
        <View style={styles.requestHead}>
          <Text variant="display" align="center">
            {formatShort(request.amountCents)}
          </Text>
          {request.note ? (
            <Text variant="bodyMedium" color="textSecondary" align="center">
              {request.note}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* QR stays dark-on-white in both themes so every camera can read it. */}
      <View
        style={[styles.qrCard, { borderColor: colors.border }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={request ? `QR code requesting ${formatShort(request.amountCents)}` : `Your Payvr QR code, @${me.handle}`}>
        <QRCode value={payload} size={request ? 200 : 220} color="#0A0A0A" backgroundColor="#FFFFFF" ecl="M" />
        <View style={[styles.qrBadge, request ? styles.qrBadgeSmall : null]}>
          <Avatar name={me.name} uri={me.avatarUrl} size={44} />
        </View>
      </View>

      {request ? (
        <>
          <View style={styles.waiting} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text variant="bodyMedium">Waiting for them to pay…</Text>
          </View>
          <Text variant="small" color="textSecondary" align="center" style={styles.hint}>
            Ask them to open Payvr and scan this. The code refreshes every minute.
          </Text>
          <Button
            label="Prototype: Jake pays this code"
            variant="ghost"
            size="md"
            onPress={() => simulateIncomingPayment({ amountCents: request.amountCents, note: request.note })}
          />
        </>
      ) : (
        <>
          <Text variant="heading">{me.name}</Text>
          <Text color="textSecondary">@{me.handle}</Text>
          {draft?.mode === 'send' ? (
            <>
              <Text variant="small" color="textSecondary" align="center" style={styles.hint}>
                You’re sending {formatShort(draft.amountCents)}
                {draft.peerId ? ` to ${userById(draft.peerId)?.name.split(' ')[0]}` : ''}. Scan their code to pick who gets it.
              </Text>
              <Button label="Scan their code" icon="scan" size="md" variant="secondary" onPress={onScanInstead} />
            </>
          ) : (
            <Text variant="small" color="textSecondary" align="center" style={styles.hint}>
              Anyone with Payvr can scan this to pay you or request from you.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────── Scanner

function Scanner() {
  const { colors } = useTheme();
  const { draft } = useApp();
  const open = useOpenPayvrCode();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const lastBad = useRef<{ raw: string; at: number } | null>(null);

  const onData = async (raw: string) => {
    // The camera reports the same code many times a second: handle one at a time,
    // and don't re-announce the same bad code over and over.
    if (busyRef.current) return;
    const now = Date.now();
    if (lastBad.current && lastBad.current.raw === raw && now - lastBad.current.at < 2500) return;
    busyRef.current = true;
    setBusy(true);
    const err = await open(parseQr(raw));
    if (err) {
      lastBad.current = { raw, at: Date.now() };
      setError(err);
    }
    busyRef.current = false;
    setBusy(false);
  };

  const fromPhotos = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    try {
      const found = await scanFromURLAsync(res.assets[0].uri, ['qr']);
      if (found[0]) await onData(found[0].data);
      else setError('No QR code found in that photo.');
    } catch {
      setError('Couldn’t read that photo.');
    }
  };

  const hint = draft
    ? `Scan their code to ${draft.mode === 'send' ? 'send' : 'request'} ${formatShort(draft.amountCents)}.`
    : 'Point your camera at a Payvr code.';

  let camera: React.ReactNode;
  if (!permission) {
    camera = <ActivityIndicator color={colors.accent} />;
  } else if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    camera = (
      <View style={styles.permission}>
        <Icon name="camera" size={32} color={colors.textSecondary} />
        <Text color="textSecondary" align="center" style={styles.hint}>
          {blocked ? 'Camera access is turned off for Payvr.' : 'Payvr needs your camera to scan codes.'}
        </Text>
        <Button
          label={blocked ? 'Open Settings' : 'Allow camera'}
          size="md"
          onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
        />
      </View>
    );
  } else {
    camera = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy ? undefined : ({ data }) => onData(data)}
        />
        <View style={[styles.frame, { borderColor: BRAND_BLUE }]} />
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : null}
        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Flashlight"
            accessibilityState={{ checked: torch }}
            onPress={() => setTorch((t) => !t)}
            style={[styles.torch, { backgroundColor: torch ? '#FFFFFF' : 'rgba(0,0,0,0.55)' }]}>
            <Icon name="flash" size={20} color={torch ? '#0A0A0A' : '#FFFFFF'} />
          </Pressable>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.center}>
      <View style={[styles.cameraWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>{camera}</View>
      <Text
        variant="small"
        color={error ? 'error' : 'textSecondary'}
        align="center"
        style={styles.hint}
        accessibilityLiveRegion="polite">
        {error ?? hint}
      </Text>
      {Platform.OS !== 'web' ? <SmallAction icon="image" label="Choose from photos" onPress={fromPhotos} /> : null}
      {/* Prototype helpers: let one phone (or the web preview) walk both QR flows. */}
      <View style={styles.protoRow}>
        <Button label="Prototype: Jake’s code" variant="ghost" size="md" onPress={() => onData(buildQr('jake'))} />
        <Button
          label="Jake’s $12 request"
          variant="ghost"
          size="md"
          onPress={() => onData(buildQr('jake', { amountCents: 1200, note: 'Lunch' }))}
        />
      </View>
    </View>
  );
}

function SmallAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.smallAction}>
      <Icon name={icon} size={18} color={colors.accent} />
      <Text variant="bodyMedium" color="accent">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: 24 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  requestHead: { alignItems: 'center', marginBottom: 12 },
  qrCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  qrBadge: {
    position: 'absolute',
    top: 18 + 110 - 26,
    left: 18 + 110 - 26,
    padding: 4,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  qrBadgeSmall: { top: 18 + 100 - 26, left: 18 + 100 - 26 },
  hint: { maxWidth: 300, marginTop: 4 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  cameraWrap: {
    width: 280,
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { alignItems: 'center', gap: 12, padding: 20 },
  frame: { width: 200, height: 200, borderRadius: 20, borderWidth: 3 },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  torch: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TAP, paddingHorizontal: 12 },
  protoRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
