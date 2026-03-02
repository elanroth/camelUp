// ---------------------------------------------------------------------------
// AnalysisPanel — Master analysis compositor with variance mode + sim controls
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react';
import type { GameState } from '../model/types';
import { CAMEL_HEX } from '../model/constants';
import { useAnalysis } from '../controller/useAnalysis';
import { computeDesertTileEVs } from '../model/ev';
import { ProbabilityBars } from './ProbabilityBars';
import { EVTable } from './EVTable';
import { RaceProbabilities } from './RaceProbabilities';
import { CamelToken } from './CamelToken';

const SIM_COUNTS = [10_000, 50_000, 100_000] as const;
type SimCount = (typeof SIM_COUNTS)[number];

interface Props {
  state: GameState;
}

export function AnalysisPanel({ state }: Props) {
  const [simCount, setSimCount] = useState<SimCount>(10_000);
  const [varianceMode, setVarianceMode] = useState(false);
  const [showDesertEV, setShowDesertEV] = useState(false);

  const { legWinProbabilities, legActions, bestAction, simulation, simulating } =
    useAnalysis(state, simCount);

  // Desert tile EV — computed on demand (can be slow with full pool)
  const desertTileEVs = useMemo(() => {
    if (!showDesertEV) return null;
    const evs = computeDesertTileEVs(state.track, state.dicePool);
    // Filter: can't place on space 0 (index 0) or spaces occupied by camels
    return evs
      .filter(e => e.spaceIndex > 0 && state.track[e.spaceIndex].length === 0)
      .sort((a, b) => b.expectedCoins - a.expectedCoins)
      .slice(0, 8); // top 8 spaces
  }, [showDesertEV, state.track, state.dicePool]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 min-w-[320px] max-w-md">

      {/* ── Toolbar: mode toggles + sim count ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Variance mode toggle */}
        <button
          onClick={() => setVarianceMode(v => !v)}
          className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
            varianceMode
              ? 'bg-purple-600 text-white border-purple-700'
              : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
          }`}
          title="Toggle variance mode — highlights risky high-σ bets"
        >
          σ Variance {varianceMode ? 'ON' : 'OFF'}
        </button>

        {/* Sim count picker */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-gray-400 mr-1">Sims:</span>
          {([10_000, 50_000, 100_000] as SimCount[]).map(n => (
            <button
              key={n}
              onClick={() => setSimCount(n)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                simCount === n
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
              }`}
            >
              {n >= 100_000 ? '100k' : n >= 50_000 ? '50k' : '10k'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Best-move banner ── */}
      <div className="bg-white rounded-xl border border-amber-300 px-4 py-3 shadow-sm">
        <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-1">
          Recommended action this turn
        </p>
        {bestAction.type === 'roll' ? (
          <p className="text-lg font-bold text-emerald-600">
            🎲 Roll the dice
            <span className="ml-2 text-sm font-normal text-gray-500">
              (no leg bet beats EV 1.0)
            </span>
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <CamelToken color={bestAction.camel} size="lg" />
            <div>
              <p className="text-base font-bold capitalize text-gray-800">
                Bet{' '}
                <span
                  className="capitalize font-black"
                  style={{ color: CAMEL_HEX[bestAction.camel] }}
                >
                  {bestAction.camel}
                </span>
                {' '}to win this leg
              </p>
              <p className="text-xs text-gray-500">
                EV ={' '}
                <span className="font-semibold text-emerald-700">
                  {bestAction.ev.toFixed(3)}
                </span>
                {' · payout '}
                <span className="font-semibold">{bestAction.payout}:1</span>
                {varianceMode && (
                  <>
                    {' · σ '}
                    <span
                      className="font-semibold"
                      style={{ color: bestAction.stdDev > 2.5 ? '#dc2626' : bestAction.stdDev > 1.5 ? '#d97706' : '#16a34a' }}
                    >
                      {bestAction.stdDev.toFixed(2)}
                    </span>
                    {' · range ['}
                    <span className="font-semibold text-red-600">{(bestAction.ev - bestAction.stdDev).toFixed(2)}</span>
                    {', '}
                    <span className="font-semibold text-green-600">{(bestAction.ev + bestAction.stdDev).toFixed(2)}</span>
                    {']¹'}
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Leg win probabilities ── */}
      <section>
        <ProbabilityBars
          legWinProbabilities={legWinProbabilities}
          legBetStacks={state.legBetStacks}
        />
      </section>

      <div className="w-full h-px bg-amber-200" />

      {/* ── EV table (with optional variance mode) ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Leg Bet Expected Values
          </h3>
          {varianceMode && (
            <span className="text-[9px] text-purple-500 font-semibold uppercase tracking-wide">
              σ Variance mode — sorted by risk
            </span>
          )}
        </div>
        <EVTable actions={legActions} bestAction={bestAction} varianceMode={varianceMode} />
        {varianceMode && (
          <p className="text-[9px] text-gray-400 mt-1">
            ¹ EV ± σ shows the 68% confidence interval for coin outcome (σ = 1 std deviation).
            High σ means a more volatile bet even if EV is positive.
          </p>
        )}
      </section>

      <div className="w-full h-px bg-amber-200" />

      {/* ── Desert Tile EV ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Desert Tile Placement EV
          </h3>
          <button
            onClick={() => setShowDesertEV(v => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
              showDesertEV
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
            }`}
          >
            {showDesertEV ? 'Hide' : 'Compute'}
          </button>
        </div>
        {showDesertEV && desertTileEVs && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-gray-400 mb-1">
              Expected coins earned this leg per space (best spaces for your tile)
            </p>
            {desertTileEVs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No valid spaces available</p>
            ) : (
              desertTileEVs.map(({ spaceIndex, expectedCoins }) => {
                const barWidth = Math.min(100, (expectedCoins / (desertTileEVs[0].expectedCoins || 1)) * 100);
                return (
                  <div key={spaceIndex} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12 shrink-0">
                      Space {spaceIndex + 1}
                    </span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-amber-800 w-10 text-right">
                      {expectedCoins.toFixed(3)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      <div className="w-full h-px bg-amber-200" />

      {/* ── Race-wide Monte Carlo ── */}
      <section>
        <RaceProbabilities simulation={simulation} simulating={simulating} />
      </section>
    </div>
  );
}
