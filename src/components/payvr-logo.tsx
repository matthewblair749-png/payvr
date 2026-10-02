import { useId } from 'react';
import Svg, { Circle, Defs, G, Mask, Rect } from 'react-native-svg';

import { BRAND_BLUE } from '@/theme/colors';

/**
 * The Payvr "p" on a 100×100 grid: a rounded vertical stem plus a thick ring, with a thin
 * cut where they overlap. Geometry matches the brand SVG exactly:
 *
 *   stem  rect x=22 y=22 w=20 h=66 rx=10
 *   cut   circle cx=56 cy=42 r=19, stroke 24
 *   ring  circle cx=56 cy=42 r=19, stroke 16
 *   all shifted left by 2.5 to sit centered.
 */
const STEM = { x: 22, y: 22, w: 20, h: 66, rx: 10 };
const RING = { cx: 56, cy: 42, r: 19 };
const CUT_STROKE = 24;
const RING_STROKE = 16;

type Props = {
  size?: number;
  /** Color of the "p". */
  color?: string;
  /**
   * Color painted in the cut between ring and stem, as in the brand SVG. Pass the color the
   * logo sits on. Leave it out and the cut is truly transparent, so it works on any background.
   */
  cutColor?: string;
  accessibilityLabel?: string;
};

export function PayvrLogo({ size = 64, color = '#FFFFFF', cutColor, accessibilityLabel = 'Payvr' }: Props) {
  const maskId = `payvr-cut-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={accessibilityLabel}>
      {cutColor ? null : (
        <Defs>
          {/* Everything visible except the cut ring, so the stem gets a real gap. The mask is in
              the stem's own (shifted) coordinates. */}
          <Mask id={maskId} maskUnits="userSpaceOnUse" x="-10" y="0" width="120" height="100">
            <Rect x="-10" y="0" width="120" height="100" fill="#FFFFFF" />
            <Circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke="#000000" strokeWidth={CUT_STROKE} />
          </Mask>
        </Defs>
      )}
      <G transform="translate(-2.5,0)">
        <Rect
          x={STEM.x}
          y={STEM.y}
          width={STEM.w}
          height={STEM.h}
          rx={STEM.rx}
          fill={color}
          mask={cutColor ? undefined : `url(#${maskId})`}
        />
        {cutColor ? <Circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={cutColor} strokeWidth={CUT_STROKE} /> : null}
        <Circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={color} strokeWidth={RING_STROKE} />
      </G>
    </Svg>
  );
}

/** The app-icon look: the white "p" on a brand-blue rounded square. */
export function PayvrAppIcon({ size = 96, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Payvr">
      <Rect x="0" y="0" width="100" height="100" rx={rounded ? 23 : 0} fill={BRAND_BLUE} />
      <PayvrLogo size={100} color="#FFFFFF" cutColor={BRAND_BLUE} />
    </Svg>
  );
}
