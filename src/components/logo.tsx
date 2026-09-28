import { useId } from 'react';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';

import { BRAND_BLUE } from '@/theme/colors';

/**
 * The Payvr "p": a rounded vertical stem (the phone) and a thick ring (the connection).
 * Where they overlap, the ring is cut by a thin gap so the two pieces read as locking
 * together. Drawn on a 100×100 grid.
 */
const STEM = { x: 21, y: 16, w: 19, h: 70, r: 9.5 };
const RING = { cx: 55, cy: 41, r: 18.5, stroke: 14 };
const CUT = 3.5;

function GlyphShapes({ color }: { color: string }) {
  const maskId = `payvr-cut-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <>
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <Rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
          <Rect
            x={STEM.x - CUT}
            y={STEM.y - CUT}
            width={STEM.w + CUT * 2}
            height={STEM.h + CUT * 2}
            rx={STEM.r + CUT}
            fill="#000000"
          />
        </Mask>
      </Defs>
      <Circle
        cx={RING.cx}
        cy={RING.cy}
        r={RING.r}
        stroke={color}
        strokeWidth={RING.stroke}
        fill="none"
        mask={`url(#${maskId})`}
      />
      <Rect x={STEM.x} y={STEM.y} width={STEM.w} height={STEM.h} rx={STEM.r} fill={color} />
    </>
  );
}

/** The bare "p" glyph in any color. */
export function LogoGlyph({ size = 64, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Payvr">
      <GlyphShapes color={color} />
    </Svg>
  );
}

/** App-icon mark: white "p" on a blue (#2150FF) rounded square. */
export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Payvr">
      <Rect x="0" y="0" width="100" height="100" rx="23" fill={BRAND_BLUE} />
      <Svg x="12" y="12" width="76" height="76" viewBox="0 0 100 100">
        <GlyphShapes color="#FFFFFF" />
      </Svg>
    </Svg>
  );
}
