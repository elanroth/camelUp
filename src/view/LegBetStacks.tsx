// ---------------------------------------------------------------------------
// LegBetStacks — shows remaining payout tiles for each camel this leg
// ---------------------------------------------------------------------------

import type { CamelColor } from '../model/types';
import { CAMEL_COLORS, CAMEL_HEX } from '../model/constants';
import { CamelToken } from './CamelToken';

interface Props {
  legBetStacks: Record<CamelColor, number[]>;
}

export function LegBetStacks({ legBetStacks }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
        Leg Bet Tiles
      </h3>

      <div className="flex gap-3 flex-wrap">
        {CAMEL_COLORS.map((color) => {
          const tiles = legBetStacks[color];
          const nextPayout = tiles[0] ?? null;

          return (
            <div key={color} className="flex flex-col items-center gap-1">
              <CamelToken color={color} size="sm" />

              {/* Remaining tile payouts stacked visually */}
              <div className="flex flex-col-reverse items-center gap-0.5">
                {tiles.map((payout, idx) => (
                  <div
                    key={idx}
                    className="w-7 h-5 rounded text-[10px] font-bold flex items-center justify-center shadow-sm border"
                    style={{
                      backgroundColor: CAMEL_HEX[color],
                      borderColor: color === 'yellow' ? '#9ca3af' : CAMEL_HEX[color],
                      color: color === 'yellow' ? '#1f2937' : '#ffffff',
                      opacity: idx === 0 ? 1 : 0.55, // next-to-take = full opacity
                    }}
                  >
                    {payout}
                  </div>
                ))}
                {tiles.length === 0 && (
                  <div className="w-7 h-5 rounded bg-gray-200 text-[10px] text-gray-400 flex items-center justify-center">
                    —
                  </div>
                )}
              </div>

              {nextPayout !== null && (
                <span className="text-[9px] text-amber-200">next: {nextPayout}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
