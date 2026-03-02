// ---------------------------------------------------------------------------
// RaceProbabilities — Monte Carlo race win/lose bars
// ---------------------------------------------------------------------------

import type { SimulationResult } from '../model/simulator';
import { CAMEL_COLORS, CAMEL_HEX } from '../model/constants';
import { CamelToken } from './CamelToken';

interface Props {
  simulation: SimulationResult | null;
  simulating: boolean;
}

export function RaceProbabilities({ simulation, simulating }: Props) {
  const sorted = simulation
    ? [...CAMEL_COLORS].sort(
        (a, b) => simulation.winProbabilities[b] - simulation.winProbabilities[a]
      )
    : CAMEL_COLORS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          Full Race Probabilities
        </h3>
        {simulating && (
          <span className="text-[10px] text-amber-500 animate-pulse">
            ⏳ Simulating…
          </span>
        )}
        {simulation && !simulating && (
          <span className="text-[10px] text-gray-400">
            n = {simulation.totalSimulations.toLocaleString()} · {simulation.elapsedMs}ms
          </span>
        )}
      </div>

      {/* Win probability bars */}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-[10px] text-gray-500 uppercase tracking-wide">
          🏆 Overall winner
        </h4>
        {sorted.map((color) => {
          const pct = simulation ? simulation.winProbabilities[color] * 100 : 0;
          return (
            <div key={color} className="flex items-center gap-2">
              <CamelToken color={color} size="sm" />
              <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: simulating ? '0%' : `${Math.max(pct, 0.5)}%`,
                    backgroundColor: CAMEL_HEX[color],
                    opacity: 0.75,
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-gray-700 mix-blend-multiply">
                  {simulation ? `${pct.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full h-px bg-amber-100 my-0.5" />

      {/* Lose probability bars */}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-[10px] text-gray-500 uppercase tracking-wide">
          🐌 Overall loser (last place)
        </h4>
        {[...CAMEL_COLORS]
          .sort((a, b) =>
            simulation
              ? simulation.loseProbabilities[b] - simulation.loseProbabilities[a]
              : 0
          )
          .map((color) => {
            const pct = simulation ? simulation.loseProbabilities[color] * 100 : 0;
            return (
              <div key={color} className="flex items-center gap-2">
                <CamelToken color={color} size="sm" />
                <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: simulating ? '0%' : `${Math.max(pct, 0.5)}%`,
                      backgroundColor: CAMEL_HEX[color],
                      opacity: 0.45,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-gray-700 mix-blend-multiply">
                    {simulation ? `${pct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      <p className="text-[10px] text-gray-400 mt-0.5">
        Monte Carlo · re-runs on every board change
      </p>
    </div>
  );
}
