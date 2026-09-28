/**
 * Push notifications ("Jake paid you $20 · Pizza").
 * The server writes notifications to an outbox in the same transaction as the money move,
 * and the push-send Edge Function delivers them via Expo. This file handles the phone side:
 * permission, the Expo push token, Android channels, and opening the right screen on tap.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushRegistration = { token: string } | { error: 'unsupported' | 'denied' | 'no_project' | 'failed' };

let configured = false;

/** Call once at startup. While the app is open the in-app banner is shown instead of a system alert. */
export function configurePush() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Money received',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#2150FF',
  });
  await Notifications.setNotificationChannelAsync('requests', {
    name: 'Requests',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#2150FF',
  });
}

/** Asks for permission (if needed) and returns this phone's Expo push token. */
export async function registerForPush(): Promise<PushRegistration> {
  if (Platform.OS === 'web' || !Device.isDevice) return { error: 'unsupported' };
  try {
    await ensureChannels();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { error: 'denied' };
    // Expo push tokens are tied to an EAS project (run `npx eas-cli@latest init` once).
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return { error: 'no_project' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data };
  } catch {
    return { error: 'failed' };
  }
}

/** Only these in-app paths may be opened from a notification. */
export function safeNotificationUrl(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  return typeof url === 'string' && /^\/(transaction|request)\/[A-Za-z0-9_-]{1,64}$/.test(url) ? url : null;
}

export function onNotificationTap(open: (url: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const handle = (response: Notifications.NotificationResponse | null) => {
    const url = safeNotificationUrl(response?.notification.request.content.data);
    if (url) open(url);
  };
  // Tapped while the app was closed.
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
