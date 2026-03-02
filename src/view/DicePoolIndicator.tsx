// ---------------------------------------------------------------------------
// DicePoolIndicator — shows which camel dice are still in the pyramid
//   Rolled = greyed-out   |   Unrolled = full colour
//   Crazy camels (black & white) share one die; displayed separately.
// ---------------------------------------------------------------------------

import type { DicePool } from '../model/types';
import { CAMEL_COLORS, CRAZY_CAMELS, CAMEL_HEX } from '../model/constants';
import { CamelToken } from './CamelToken';

interface Props {
  /** Dice that have NOT yet been rolled this leg. */
  dicePool: DicePool;
}

export function DicePoolIndicator({ dicePool }: Props) {
  const poolSet = new Set(dicePool);

  // Is the crazy die still available?
  const crazyInPool = poolSet.has('crazy');

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
        Dice Pyramid
      </h3>
      {/* Forward dice — one per camel */}
      <div className="flex gap-2 flex-wrap">
        {CAMEL_COLORS.map((color) => {
          const inPool = poolSet.has(color);
          return (
            <div
              key={color}
              className="flex flex-col items-center gap-1"
              title={inPool ? `${color} — not yet rolled` : `${color} — already rolled`}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow-inner"
                style={{
                  backgroundColor: inPool ? CAMEL_HEX[color] : '#374151',
                  opacity: inPool ? 1 : 0.45,
                  border: `2px solid ${inPool ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: (color === 'yellow') && inPool ? '#1f2937' : '#fff',
                }}
              >
                {inPool ? '●●' : '×'}
              </div>
              <div style={{ opacity: inPool ? 1 : 0.3 }}>
                <CamelToken color={color} size="sm" />
              </div>
            </div>
          );
        })}
      </div>
      {/* Crazy die — black & white share one die */}
      <div className="flex items-center gap-2 mt-0.5 pt-1.5 border-t border-white/10">
        <span className="text-[10px] text-amber-400 font-semibold">Crazy die:</span>
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow-inner"
          style={{
            background: crazyInPool
              ? 'linear-gradient(135deg, #1f2937 50%, #f1f5f9 50%)'
              : '#374151',
            opacity: crazyInPool ? 1 : 0.45,
            border: `2px solid ${crazyInPool ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: '#9ca3af',
          }}
        >
          {crazyInPool ? '↺' : '×'}
        </div>
        {CRAZY_CAMELS.map((color) => (
          <div key={color} style={{ opacity: crazyInPool ? 1 : 0.3 }}>
            <CamelToken color={color} size="sm" />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-amber-400 mt-0.5">
        {CAMEL_COLORS.filter((c) => poolSet.has(c)).length} / {CAMEL_COLORS.length} forward remaining
      </p>
    </div>
  );
}
