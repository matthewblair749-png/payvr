import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type Props = { stream: unknown; mirror?: boolean; style?: ViewStyle };

/** A live camera stream in the browser: a plain <video> element inside the view. */
export function CallVideo({ stream, mirror, style }: Props) {
  const host = useRef<View>(null);

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el || !stream) return;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    // Your own preview is muted so you don't hear yourself; remote audio plays.
    video.muted = !!mirror;
    video.srcObject = stream as MediaStream;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: mirror ? 'scaleX(-1)' : 'none',
      display: 'block',
    });
    el.appendChild(video);
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
      video.remove();
    };
  }, [stream, mirror]);

  return <View ref={host} style={[styles.fill, style]} />;
}

const styles = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });
