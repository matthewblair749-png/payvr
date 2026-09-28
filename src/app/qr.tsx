import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { parseQrPayload, qrPayloadFor } from '@/services/nearby';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { BRAND_BLUE } from '@/theme/colors';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

type Tab = 'mine' | 'scan';

export default function Qr() {
  const [tab, setTab] = useState<Tab>('mine');
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
      <View style={styles.body}>{tab === 'mine' ? <MyCode /> : <Scanner />}</View>
    </Screen>
  );
}

function MyCode() {
  const { me, draft } = useApp();
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      {/* QR stays dark-on-white in both themes so every camera can read it. */}
      <View style={[styles.qrCard, { borderColor: colors.border }]}>
        <QRCode value={qrPayloadFor(me.handle)} size={220} color="#0A0A0A" backgroundColor="#FFFFFF" />
        <View style={styles.qrBadge}>
          <Avatar name={me.name} uri={me.avatarUrl} size={48} />
        </View>
      </View>
      <Text variant="heading">{me.name}</Text>
      <Text color="textSecondary">@{me.handle}</Text>
      {draft ? (
        <Text variant="small" color="accent" align="center" style={styles.hint}>
          {draft.mode === 'send' ? 'Sending' : 'Requesting'} {formatShort(draft.amountCents)} · ask them to scan this
        </Text>
      ) : (
        <Text variant="small" color="textSecondary" align="center" style={styles.hint}>
          Anyone with Payvr can scan this to pay you or request from you.
        </Text>
      )}
    </View>
  );
}

function Scanner() {
  const { colors } = useTheme();
  const { lookupHandle, draft, setDraft, rememberContact, me, backendMode } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const onCode = async (data: string) => {
    if (handled.current) return;
    const handle = parseQrPayload(data);
    if (!handle) {
      setError('That’s not a Payvr code.');
      return;
    }
    handled.current = true;
    const user = await lookupHandle(handle).catch(() => null);
    if (!user || user.id === me.id) {
      handled.current = false;
      setError(user ? 'That’s your own code.' : 'We couldn’t find that person.');
      return;
    }
    haptics.success();
    rememberContact(user.id);
    if (draft) {
      setDraft({ ...draft, peerId: user.id });
      router.replace('/confirm');
    } else {
      router.replace({ pathname: '/amount', params: { to: user.id } });
    }
  };

  const camera =
    permission?.granted ? (
      <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onCode(data)}
        />
        <View style={[styles.frame, { borderColor: BRAND_BLUE }]} />
      </View>
    ) : (
      <View style={[styles.cameraWrap, styles.center, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text color="textSecondary" align="center" style={styles.hint}>
          Payvr needs your camera to scan codes.
        </Text>
        <Button label="Allow camera" size="md" onPress={requestPermission} style={styles.allow} />
      </View>
    );

  return (
    <View style={styles.center}>
      {camera}
      <Text variant="small" color={error ? 'error' : 'textSecondary'} align="center" style={styles.hint}>
        {error ?? 'Point your camera at their Payvr code.'}
      </Text>
      {/* Prototype helper: lets one phone (or the web preview) walk the flow. */}
      <Button
        label={Platform.OS === 'web' || backendMode === 'live' ? 'Prototype: scan Jake’s code' : 'Prototype: simulate a scan'}
        variant="ghost"
        size="md"
        onPress={() => onCode(qrPayloadFor('jake'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: 28 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  qrBadge: {
    position: 'absolute',
    top: 20 + 110 - 28,
    left: 20 + 110 - 28,
    padding: 4,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  hint: { maxWidth: 300, marginTop: 8 },
  cameraWrap: {
    width: 280,
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 200, height: 200, borderRadius: 20, borderWidth: 3 },
  allow: { marginTop: 12 },
});
