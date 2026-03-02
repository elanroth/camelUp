// ---------------------------------------------------------------------------
// Camel Up 2.0 — Leg-Bet EV Calculator
//
// FORMULA
// -------
// Taking the next available leg-bet tile for camel X pays `payout` coins if X
// wins the leg, or −1 coin if X does not win (wrong-bet penalty).
//
//   EV(bet on X) = P(X wins) × payout  +  (1 − P(X wins)) × (−1)
//               = P(X wins) × (payout + 1)  −  1
//
// BASELINE — Rolling the dice
// ---------------------------
// A player who chooses to roll the pyramid instead of betting always earns
// exactly +1 coin (guaranteed, no variance). This is the floor any bet must
// beat on EV to be worth considering.
//
// BREAK-EVEN PROBABILITIES (for reference)
//   payout=5 → P_break = 1/6  ≈ 16.7 %
//   payout=3 → P_break = 1/4  = 25.0 %
//   payout=2 → P_break = 1/3  ≈ 33.3 %
// ---------------------------------------------------------------------------

import type {
  CamelColor,
  DicePool,
  LegBetEV,
  LegBetRecommendation,
  LegWinProbabilities,
  Track,
} from './types';
import { CAMEL_COLORS } from './constants';
import { computeLandingExpectations } from './probability';

// ---------------------------------------------------------------------------
// Action types — what a player can do on their turn (leg-bet scope)
// ---------------------------------------------------------------------------

export type ActionType = 'bet' | 'roll';

export interface BetAction {
  type: 'bet';
  camel: CamelColor;
  /** Payout tile this bet would claim. */
  payout: number;
  ev: number;
  /** P(win leg) for this camel at the time the recommendation was made. */
  winProbability: number;
  /**
   * Standard deviation of the coin outcome (useful for variance mode).
   * σ = sqrt( P×(payout−EV)² + (1−P)×(−1−EV)² )
   */
  stdDev: number;
  /** True when EV(bet) > EV(roll) = +1. */
  beatsRoll: boolean;
}

export interface RollAction {
  type: 'roll';
  /** Rolling always earns exactly 1 coin. */
  ev: 1;
  stdDev: 0;
}

export type LegAction = BetAction | RollAction;

export const ROLL_ACTION: RollAction = { type: 'roll', ev: 1, stdDev: 0 };

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Computes the EV of taking the next available leg-bet tile for each camel.
 *
 * Returns `null` for a camel whose tile stack is exhausted (no tile to take).
 */
export function computeLegBetEVs(
  winProbabilities: LegWinProbabilities,
  legBetStacks: Record<CamelColor, number[]>
): LegBetEV {
  return Object.fromEntries(
    CAMEL_COLORS.map((camel) => {
      const stack = legBetStacks[camel];
      if (stack.length === 0) return [camel, null];
      const payout = stack[0]; // next tile to be claimed
      const p = winProbabilities[camel];
      const ev = p * (payout + 1) - 1;
      return [camel, ev];
    })
  ) as LegBetEV;
}

/**
 * Builds a full recommendation table: one entry per camel with win probability,
 * available payout, EV, standard deviation, and whether it beats rolling.
 *
 * Entries are sorted best EV first.
 */
export function computeLegBetRecommendations(
  winProbabilities: LegWinProbabilities,
  legBetStacks: Record<CamelColor, number[]>
): LegBetRecommendation[] {
  const recommendations: LegBetRecommendation[] = CAMEL_COLORS.map((camel) => {
    const stack = legBetStacks[camel];
    const payout = stack.length > 0 ? stack[0] : null;
    const p = winProbabilities[camel];
    const ev = payout !== null ? p * (payout + 1) - 1 : null;
    return { camel, availablePayout: payout, winProbability: p, ev };
  });

  // Sort: bets with non-null EV rank highest first; null-EV (no tiles) go last.
  return recommendations.sort((a, b) => {
    if (a.ev === null && b.ev === null) return 0;
    if (a.ev === null) return 1;
    if (b.ev === null) return -1;
    return b.ev - a.ev;
  });
}

/**
 * Returns all valid leg actions (bets + roll) sorted by EV descending.
 *
 * A bet action is only included when tiles remain for that camel.
 */
export function computeAllLegActions(
  winProbabilities: LegWinProbabilities,
  legBetStacks: Record<CamelColor, number[]>
): LegAction[] {
  const betActions: BetAction[] = [];

  for (const camel of CAMEL_COLORS) {
    const stack = legBetStacks[camel];
    if (stack.length === 0) continue;
    const payout = stack[0];
    const p = winProbabilities[camel];
    const ev = p * (payout + 1) - 1;

    // Variance: σ² = P(payout−EV)² + (1−P)(−1−EV)²
    const variance = p * (payout - ev) ** 2 + (1 - p) * (-1 - ev) ** 2;
    const stdDev = Math.sqrt(variance);

    betActions.push({
      type: 'bet',
      camel,
      payout,
      ev,
      winProbability: p,
      stdDev,
      beatsRoll: ev > ROLL_ACTION.ev,
    });
  }

  // Sort bets by EV descending, then append the roll action.
  betActions.sort((a, b) => b.ev - a.ev);

  return [...betActions, ROLL_ACTION];
}

/**
 * Returns the single best action for the current player.
 *
 * - If any bet has EV > 1 (beats rolling), returns the highest-EV bet.
 * - Otherwise returns the roll action.
 *
 * When two bets tie on EV, prefers the one with the higher payout tile
 * (lower risk of tying on EV with worse tile later).
 */
export function getBestLegAction(
  winProbabilities: LegWinProbabilities,
  legBetStacks: Record<CamelColor, number[]>
): LegAction {
  const actions = computeAllLegActions(winProbabilities, legBetStacks);
  const best = actions[0];

  // If the top action is a bet but doesn't beat rolling, prefer rolling.
  if (best.type === 'bet' && !best.beatsRoll) {
    return ROLL_ACTION;
  }

  return best;
}

// ---------------------------------------------------------------------------
// Break-even helpers (useful for UI annotations)
// ---------------------------------------------------------------------------

/**
 * The minimum win probability a camel needs for its next bet tile to have
 * positive EV (break even against an expected cost of 1 coin from a wrong bet).
 *
 * P_break = 1 / (payout + 1)
 */
export function breakEvenProbability(payout: number): number {
  return 1 / (payout + 1);
}

/**
 * Returns how many percentage points above or below break-even a camel is.
 * Positive = above break-even (bet is +EV).
 * Negative = below break-even (bet is −EV).
 */
export function marginAboveBreakEven(
  winProbability: number,
  payout: number
): number {
  return winProbability - breakEvenProbability(payout);
}

// ---------------------------------------------------------------------------
// Desert tile EV
// ---------------------------------------------------------------------------

export interface DesertTileEVEntry {
  /** 0-based track space index */
  spaceIndex: number;
  /**
   * Expected coins earned by placing any desert tile (oasis or mirage) here.
   * Each camel group that lands on the space triggers the tile and pays +1 coin.
   * Positive for all spaces — the TYPE of tile (oasis vs mirage) affects camel
   * movement but does NOT change the coin payout, so EV is the same for both.
   */
  expectedCoins: number;
}

/**
 * For each track space, computes the expected number of camel-group landings
 * during the remainder of the current leg. This equals the EV (in coins) of
 * placing a desert tile at that space, since each landing pays +1 coin.
 *
 * The tile cannot be placed:
 *  - on a space that already has a tile
 *  - on the same space as a camel (game rule)
 * Those spaces will still appear in the result; the UI should filter them.
 *
 * @param track    Current board state
 * @param dicePool Dice not yet rolled this leg
 */
export function computeDesertTileEVs(
  track: Track,
  dicePool: DicePool
): DesertTileEVEntry[] {
  const expectations = computeLandingExpectations(track, dicePool);
  return expectations.map((expectedCoins, spaceIndex) => ({
    spaceIndex,
    expectedCoins,
  }));
}
