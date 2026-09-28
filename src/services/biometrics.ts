import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricKind = 'Face ID' | 'Touch ID' | 'Fingerprint' | 'Biometrics' | null;

export async function biometricKind(): Promise<BiometricKind> {
  if (Platform.OS === 'web') return null;
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hasHardware || !enrolled) return null;
    const T = LocalAuthentication.AuthenticationType;
    if (types.includes(T.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : 'Biometrics';
    if (types.includes(T.FINGERPRINT)) return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    return 'Biometrics';
  } catch {
    return null;
  }
}

/** Prompts Face ID / fingerprint. Returns false if unavailable or cancelled (caller falls back to PIN). */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  }
}
