// ---------------------------------------------------------------------------
// ProbabilityBars — horizontal bar chart of leg-win probabilities
// ---------------------------------------------------------------------------

import type { CamelColor, LegWinProbabilities } from '../model/types';
import { CAMEL_COLORS, CAMEL_HEX } from '../model/constants';
import { CamelToken } from './CamelToken';
import { breakEvenProbability } from '../model/ev';

interface Props {
  legWinProbabilities: LegWinProbabilities;
  legBetStacks: Record<CamelColor, number[]>;
}

export function ProbabilityBars({ legWinProbabilities, legBetStacks }: Props) {
  // Sort camels highest → lowest probability for display
  const sorted = [...CAMEL_COLORS].sort(
    (a, b) => legWinProbabilities[b] - legWinProbabilities[a]
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        Leg-Win Probability
      </h3>

      {sorted.map((color) => {
        const pct = legWinProbabilities[color] * 100;
        const nextPayout = legBetStacks[color][0] ?? null;
        const breakEven = nextPayout !== null
          ? breakEvenProbability(nextPayout) * 100
          : null;
        const isAboveBreakEven = breakEven !== null && pct >= breakEven;

        return (
          <div key={color} className="flex items-center gap-2">
            <CamelToken color={color} size="sm" />

            <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
              {/* Probability fill */}
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  backgroundColor: CAMEL_HEX[color],
                  opacity: 0.85,
                }}
              />

              {/* Break-even marker */}
              {breakEven !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-500 opacity-40"
                  style={{ left: `${breakEven}%` }}
                  title={`Break-even for ${nextPayout}-tile: ${breakEven.toFixed(1)}%`}
                />
              )}

              {/* Label */}
              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold text-gray-700 mix-blend-multiply">
                {pct.toFixed(1)}%
                {nextPayout !== null && (
                  <span className={`ml-1 text-[10px] font-normal ${isAboveBreakEven ? 'text-green-700' : 'text-red-500'}`}>
                    {isAboveBreakEven ? '✓' : '✗'} break-even @{breakEven!.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
          </div>
        );
      })}

      <p className="text-[10px] text-gray-400 mt-0.5">
        Vertical markers show the minimum % needed for a +EV bet on each camel's next tile.
      </p>
    </div>
  );
}
