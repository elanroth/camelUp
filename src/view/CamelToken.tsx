// ---------------------------------------------------------------------------
// CamelToken — wooden camel meeple silhouette, matching the real game pieces
// ---------------------------------------------------------------------------

import type { CamelColor } from '../model/types';
import { CAMEL_HEX } from '../model/constants';

interface Props {
  color: CamelColor;
  size?: 'sm' | 'md' | 'lg';
  /** Unused — kept for API compat */
  showLabel?: boolean;
}

// Width × height for each size (aspect ratio preserved from viewBox 40×30)
const SIZES = {
  sm: { w: 28, h: 21 },
  md: { w: 36, h: 27 },
  lg: { w: 44, h: 33 },
};

/**
 * SVG camel silhouette (viewBox 0 0 40 30, right-facing).
 * Key landmarks:
 *   Hump peak  ≈ (20, 2)
 *   Neck       ≈ x28, y12→18
 *   Head tip   ≈ (38, 14)
 *   Chin       ≈ (33, 25)
 *   3 leg-pair gaps at the bottom
 */
const CAMEL_D =
  'M 4,30 L 4,22 ' +
  'C 4,14 8,8 14,5 ' +        // back body wall rises
  'C 16,3 20,2 22,4 ' +        // up to hump peak
  'C 24,6 26,10 26,18 ' +      // hump descends to neck base
  'L 28,12 ' +                  // neck going up-right
  'C 30,9 34,10 36,14 ' +      // head top arc
  'C 38,18 36,24 33,25 ' +     // head front to chin
  'C 31,25 30,23 32,23 ' +     // jaw curves back
  'L 34,23 L 34,30 L 30,30 L 30,23 ' + // front-right leg
  'L 22,23 L 22,30 L 18,30 L 18,23 ' + // front-left leg
  'L 10,23 L 10,30 Z';          // back-right leg + close

export function CamelToken({ color, size = 'md' }: Props) {
  const { w, h } = SIZES[size];
  const fill = CAMEL_HEX[color];
  // Slightly darker stroke for contrast; extra dark for light camels
  const stroke =
    color === 'white'  ? '#9ca3af' :
    color === 'yellow' ? '#b45309' :
    color === 'pink'   ? '#9d174d' :
    'rgba(0,0,0,0.30)';

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 40 30"
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2}
      strokeLinejoin="round"
      className="select-none drop-shadow"
      aria-label={color}
    >
      <title>{color}</title>
      <path d={CAMEL_D} />
    </svg>
  );
}
