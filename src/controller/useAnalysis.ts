// ---------------------------------------------------------------------------
// useAnalysis — Controller hook that runs all probability/EV computation
// for the current GameState and exposes results to the view.
//
// • Leg-win probabilities: exact (Step 3), computed synchronously (fast)
// • Leg-bet actions + EV: exact (Step 4), computed synchronously
// • Race win/lose probs: Monte Carlo (Step 5), computed in a useEffect
//   so it never blocks the render cycle
// ---------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react';
import type { GameState } from '../model/types';
import type { LegAction } from '../model/ev';
import type { SimulationResult } from '../model/simulator';
import type { LegWinProbabilities } from '../model/types';
import { computeLegProbabilities } from '../model/probability';
import { computeAllLegActions, getBestLegAction } from '../model/ev';
import { runSimulation } from '../model/simulator';

export interface AnalysisResult {
  /** Exact P(win current leg) per camel. */
  legWinProbabilities: LegWinProbabilities;

  /** All possible leg actions sorted by EV descending. */
  legActions: LegAction[];

  /** The single recommended action. */
  bestAction: LegAction;

  /** Monte Carlo race result — null while computing. */
  simulation: SimulationResult | null;

  /** True while the Monte Carlo sim is running. */
  simulating: boolean;

  /** How many simulations were run. */
  numSimulations: number;
}

const DEFAULT_SIMS = 10_000;

export function useAnalysis(
  state: GameState,
  numSimulations = DEFAULT_SIMS
): AnalysisResult {
  // ── Exact leg probabilities (synchronous, cheap) ──────────────────────
  const legWinProbabilities = useMemo(() => {
    const result = computeLegProbabilities(state.track, state.dicePool);
    // Log any suspicious all-zero or 100% probability cases
    const entries = Object.entries(result.winProbabilities);
    const maxP = Math.max(...entries.map(([, p]) => p));
    const poolStr = `[${state.dicePool.join(',')}]`;
    const trackStr = state.track.map((s, i) => s.length ? `${i+1}:${s.join(',')}` : null).filter(Boolean).join(' | ');
    if (maxP >= 0.999 && state.dicePool.length > 1) {
      console.warn('[useAnalysis] suspiciously high probability with', state.dicePool.length, 'dice remaining!',
        '\n  probs:', Object.fromEntries(entries.map(([c, p]) => [c, +p.toFixed(4)])),
        '\n  pool:', poolStr,
        '\n  track:', trackStr,
        '\n  outcomes:', result.totalOutcomes,
      );
    } else {
      console.log('[useAnalysis] legProbs computed |', poolStr, '→', 
        Object.fromEntries(entries.map(([c, p]) => [c, +p.toFixed(4)])),
        `| ${result.totalOutcomes} outcomes`,
      );
    }
    return result.winProbabilities;
  }, [state.track, state.dicePool]);

  // ── Leg-bet actions + EV (synchronous, cheap) ─────────────────────────
  const legActions = useMemo(
    () => computeAllLegActions(legWinProbabilities, state.legBetStacks),
    [legWinProbabilities, state.legBetStacks]
  );

  const bestAction = useMemo(
    () => getBestLegAction(legWinProbabilities, state.legBetStacks),
    [legWinProbabilities, state.legBetStacks]
  );

  // ── Monte Carlo race simulation (async via useEffect) ─────────────────
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    setSimulating(true);
    setSimulation(null);

    // Defer to next tick so the UI can render the loading state first.
    const id = setTimeout(() => {
      const result = runSimulation(
        state.track,
        state.dicePool,
        numSimulations,
        /* seed */ Date.now()
      );
      setSimulation(result);
      setSimulating(false);
    }, 0);

    return () => clearTimeout(id);
  }, [state.track, state.dicePool, numSimulations]);

  return {
    legWinProbabilities,
    legActions,
    bestAction,
    simulation,
    simulating,
    numSimulations,
  };
}
