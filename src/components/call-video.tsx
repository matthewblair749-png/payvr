import { StyleSheet, View, type ViewStyle } from 'react-native';

type Props = { stream: unknown; mirror?: boolean; style?: ViewStyle };

type RTCViewType = React.ComponentType<{ streamURL: string; style?: ViewStyle; objectFit?: 'cover' | 'contain'; mirror?: boolean }>;

function loadRTCView(): RTCViewType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webrtc').RTCView as RTCViewType;
  } catch {
    return null;
  }
}
const RTCView = loadRTCView();

/** A live camera stream on iOS/Android (react-native-webrtc). */
export function CallVideo({ stream, mirror, style }: Props) {
  const url = (stream as { toURL?: () => string } | null)?.toURL?.();
  if (!RTCView || !url) return <View style={[styles.fill, style]} />;
  return <RTCView streamURL={url} objectFit="cover" mirror={mirror} style={StyleSheet.flatten([styles.fill, style])} />;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
