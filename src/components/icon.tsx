import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

/** Minimal 24px stroke icon set (no emoji, no icon fonts). */
export type IconName =
  | 'home'
  | 'activity'
  | 'user'
  | 'plus'
  | 'arrowDown'
  | 'arrowUpRight'
  | 'arrowDownLeft'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'qr'
  | 'scan'
  | 'bank'
  | 'shield'
  | 'bell'
  | 'moon'
  | 'help'
  | 'file'
  | 'lock'
  | 'logout'
  | 'check'
  | 'camera'
  | 'faceId'
  | 'delete'
  | 'send'
  | 'request'
  | 'sparkle'
  | 'flash'
  | 'image'
  | 'bluetooth'
  | 'heart'
  | 'heartFilled'
  | 'comment'
  | 'search'
  | 'star'
  | 'starFilled'
  | 'globe'
  | 'users'
  | 'wallet'
  | 'card'
  | 'bolt'
  | 'phone'
  | 'chevronUp'
  | 'feed'
  | 'tap'
  | 'call'
  | 'callEnd'
  | 'video'
  | 'videoOff'
  | 'mic'
  | 'micOff'
  | 'flip'
  | 'eye'
  | 'eyeOff';

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

export function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const p = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(name, p, color)}
    </Svg>
  );
}

function render(name: IconName, p: object, color: string) {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...p} />
        </>
      );
    case 'activity':
      return <Polyline points="3 12 7 12 10 4 14 20 17 12 21 12" {...p} />;
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="4" {...p} />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" {...p} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'arrowDown':
      return <Path d="M12 5v14M6 13l6 6 6-6" {...p} />;
    case 'arrowUpRight':
      return <Path d="M7 17 17 7M8 7h9v9" {...p} />;
    case 'arrowDownLeft':
      return <Path d="M17 7 7 17M16 17H7V8" {...p} />;
    case 'chevronRight':
      return <Path d="m9 6 6 6-6 6" {...p} />;
    case 'chevronLeft':
      return <Path d="m15 6-6 6 6 6" {...p} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
    case 'qr':
      return (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.5" {...p} />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" {...p} />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" {...p} />
          <Path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" {...p} />
        </>
      );
    case 'scan':
      return <Path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" {...p} />;
    case 'bank':
      return <Path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" {...p} />;
    case 'shield':
      return <Path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" {...p} />;
    case 'bell':
      return <Path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4" {...p} />;
    case 'moon':
      return <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />;
    case 'help':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" {...p} />
        </>
      );
    case 'file':
      return <Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6" {...p} />;
    case 'lock':
      return (
        <>
          <Rect x="4" y="10" width="16" height="11" rx="2.5" {...p} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} />
        </>
      );
    case 'logout':
      return <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" {...p} />;
    case 'check':
      return <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />;
    case 'camera':
      return (
        <>
          <Path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" {...p} />
          <Circle cx="12" cy="13" r="3.5" {...p} />
        </>
      );
    case 'faceId':
      return <Path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0" {...p} />;
    case 'delete':
      return <Path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9.5l-5 5M12 9.5l5 5" {...p} />;
    case 'send':
      return <Path d="M12 19V5M6 11l6-6 6 6" {...p} />;
    case 'request':
      return <Path d="M12 5v14M6 13l6 6 6-6" {...p} />;
    case 'sparkle':
      return <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...p} />;
    case 'heart':
      return <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />;
    case 'heartFilled':
      return <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} fill={color} />;
    case 'comment':
      return <Path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" {...p} />;
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="7" {...p} />
          <Path d="m20 20-4-4" {...p} />
        </>
      );
    case 'star':
      return <Path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z" {...p} />;
    case 'starFilled':
      return <Path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z" {...p} fill={color} />;
    case 'globe':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9s-1.2 6.3-3.7 9c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3z" {...p} />
        </>
      );
    case 'users':
      return (
        <>
          <Circle cx="9" cy="8" r="3.5" {...p} />
          <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.8 3.5 6" {...p} />
        </>
      );
    case 'wallet':
      return <Path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 7l12-3v3M16 13.5h.01" {...p} />;
    case 'card':
      return (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2.5" {...p} />
          <Path d="M3 10h18M7 15h4" {...p} />
        </>
      );
    case 'bolt':
      return <Path d="M13 2 4 14h7l-1 8 9-12h-7z" {...p} />;
    case 'call':
      return <Path d="M5 4h3.5l1.8 4.4-2.3 1.4a11 11 0 0 0 6.2 6.2l1.4-2.3L20 15.5V19a2 2 0 0 1-2.1 2A17 17 0 0 1 3 6.1 2 2 0 0 1 5 4z" {...p} />;
    case 'callEnd':
      // The handset turned on its side.
      return <Path d="M3.5 13.6c4.8-4.4 12.2-4.4 17 0l-1.9 2.7-3.3-1.2-.3-2.6a10 10 0 0 0-6 0l-.3 2.6-3.3 1.2z" {...p} />;
    case 'video':
      return (
        <>
          <Rect x="2.5" y="6" width="13" height="12" rx="2.5" {...p} />
          <Path d="m15.5 10.5 6-3.5v10l-6-3.5" {...p} />
        </>
      );
    case 'videoOff':
      return (
        <>
          <Path d="M10.5 6h2.5a2.5 2.5 0 0 1 2.5 2.5v2l6-3.5v10l-3-1.75M15.5 15.5A2.5 2.5 0 0 1 13 18H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 4.5 6" {...p} />
          <Path d="m3 3 18 18" {...p} />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...p} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...p} />
        </>
      );
    case 'micOff':
      return (
        <>
          <Path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.4 12.5a6.4 6.4 0 0 0 .1-1.5M12 17.5V21" {...p} />
          <Path d="m3 3 18 18" {...p} />
        </>
      );
    case 'flip':
      return (
        <>
          <Path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4" {...p} />
          <Path d="M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" {...p} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" {...p} />
          <Circle cx="12" cy="12" r="3" {...p} />
        </>
      );
    case 'eyeOff':
      return (
        <>
          <Path d="M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" {...p} />
          <Path d="m3 3 18 18" {...p} />
        </>
      );
    case 'phone':
      return (
        <>
          <Rect x="6" y="2" width="12" height="20" rx="3" {...p} />
          <Path d="M11 18h2" {...p} />
        </>
      );
    case 'chevronUp':
      return <Path d="m6 15 6-6 6 6" {...p} />;
    case 'feed':
      return <Path d="M4 6h16M4 12h16M4 18h10" {...p} />;
    case 'tap':
      return (
        <>
          <Rect x="3" y="6" width="7" height="12" rx="2" {...p} />
          <Rect x="14" y="6" width="7" height="12" rx="2" {...p} />
          <Path d="M10.5 12h3" {...p} />
        </>
      );
    case 'bluetooth':
      return <Path d="m7 7 10 10-5 4V3l5 4L7 17" {...p} />;
    case 'flash':
      return <Path d="M13 2 4 14h7l-1 8 9-12h-7z" {...p} />;
    case 'image':
      return (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="2.5" {...p} />
          <Circle cx="9" cy="10" r="1.8" {...p} />
          <Path d="m21 16-5-5-9 9" {...p} />
        </>
      );
    default:
      return <Circle cx="12" cy="12" r="2" fill={color} />;
  }
}
