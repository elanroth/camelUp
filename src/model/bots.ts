// ---------------------------------------------------------------------------
// Camel Up 2.0 — Built-in Bot Strategies
//
// Each export is a `BotStrategy` (or a factory that returns one).
// Import `runBotGame` from `./botGame` to run them.
//
// STRATEGY OVERVIEW
// -----------------
//  alwaysRollBot          – Never bets; always rolls.  Baseline / control bot.
//  greedyEVBot            – Takes whatever action maximises expected value this
//                           turn (roll if no bet beats +1 EV, otherwise best bet).
//  thresholdBot(minEV)    – Like greedyEV but requires EV ≥ minEV to bet.
//  raceBetBot(opts)       – Focuses on race-winner / race-loser bets when
//                           confident, rolls otherwise.
//  randomBot(rng)         – Chooses a random valid action each turn.
//                           Useful as a statistical baseline.
//  conservativeBot        – Only bets when the camel is in the lead AND the bet
//                           beats rolling; otherwise rolls.
//  blendedBot(weights)    – Picks from multiple strategies with given weights
//                           each turn (useful for testing mixed behaviour).
// ---------------------------------------------------------------------------

import type { ForwardCamelColor } from './types';
import type { BotAction, BotStrategy, BotTurnContext } from './botGame';
import { CAMEL_COLORS } from './constants';
import { getLeadingCamel } from './movement';

// ---------------------------------------------------------------------------
// alwaysRollBot
// ---------------------------------------------------------------------------

/**
 * Never takes a bet.  Always rolls the pyramid.
 * Earns exactly 1 coin per turn — a useful performance baseline.
 */
export const alwaysRollBot: BotStrategy = (): BotAction => ({ type: 'roll' });

// ---------------------------------------------------------------------------
// greedyEVBot
// ---------------------------------------------------------------------------

/**
 * Takes the highest-EV action available each turn.
 *
 * - If any leg bet has EV > 1 (beats rolling), takes the best one.
 * - Otherwise rolls.
 * - Never places race bets (focuses purely on leg-bet EV).
 */
export const greedyEVBot: BotStrategy = (ctx: BotTurnContext): BotAction => {
  const best = ctx.bestLegAction;
  if (best.type === 'bet') {
    return { type: 'leg-bet', camel: best.camel as ForwardCamelColor };
  }
  return { type: 'roll' };
};

// ---------------------------------------------------------------------------
// thresholdBot
// ---------------------------------------------------------------------------

/**
 * Like `greedyEVBot` but only bets when EV is at least `minEV`.
 * Useful for studying how bet-selectivity affects outcomes.
 *
 * @param minEV  Minimum EV required to take a leg bet (e.g. 2.0).
 */
export function thresholdBot(minEV: number): BotStrategy {
  return (ctx: BotTurnContext): BotAction => {
    const best = ctx.bestLegAction;
    if (best.type === 'bet' && best.ev >= minEV) {
      return { type: 'leg-bet', camel: best.camel as ForwardCamelColor };
    }
    return { type: 'roll' };
  };
}

// ---------------------------------------------------------------------------
// raceBetBot
// ---------------------------------------------------------------------------

export interface RaceBetBotOptions {
  /**
   * Minimum win probability for a camel before the bot bets on it as
   * race winner.  Default 0.5 (50 %).
   */
  winnerThreshold?: number;
  /**
   * Minimum lose probability (based on ranking) before the bot bets on a
   * camel as race loser.  We use 1 − max(win probabilities) as a rough proxy.
   * Default 0.5.
   */
  loserThreshold?: number;
  /**
   * If true the bot also takes high-EV leg bets (EV > 1) in addition to race
   * bets.  Default false.
   */
  takeLegBets?: boolean;
}

/**
 * Places race-winner bets when a camel's leg-win probability is above
 * `winnerThreshold`, and race-loser bets on the camel least likely to win.
 * Falls back to rolling when no race-bet opportunity passes the threshold.
 */
export function raceBetBot(opts: RaceBetBotOptions = {}): BotStrategy {
  const {
    winnerThreshold = 0.5,
    loserThreshold = 0.5,
    takeLegBets = false,
  } = opts;

  return (ctx: BotTurnContext): BotAction => {
    const { legWinProbabilities, availableWinnerBets, availableLoserBets } = ctx;

    // --- Race winner bet ---
    const winnerCandidate = CAMEL_COLORS.reduce<ForwardCamelColor>(
      (best, c) =>
        legWinProbabilities[c] > legWinProbabilities[best] ? c : best,
      'blue'
    );
    if (
      legWinProbabilities[winnerCandidate] >= winnerThreshold &&
      availableWinnerBets.includes(winnerCandidate)
    ) {
      return { type: 'race-bet', camel: winnerCandidate, betType: 'winner' };
    }

    // --- Race loser bet ---
    const loserCandidate = CAMEL_COLORS.reduce<ForwardCamelColor>(
      (worst, c) =>
        legWinProbabilities[c] < legWinProbabilities[worst] ? c : worst,
      'blue'
    );
    // Use 1 − loserWinProb as a rough "likely to lose" signal.
    const loserConfidence = 1 - legWinProbabilities[loserCandidate];
    if (
      loserConfidence >= loserThreshold &&
      availableLoserBets.includes(loserCandidate)
    ) {
      return { type: 'race-bet', camel: loserCandidate, betType: 'loser' };
    }

    // --- Optional leg bets ---
    if (takeLegBets) {
      const best = ctx.bestLegAction;
      if (best.type === 'bet' && best.beatsRoll) {
        return { type: 'leg-bet', camel: best.camel as ForwardCamelColor };
      }
    }

    return { type: 'roll' };
  };
}

// ---------------------------------------------------------------------------
// conservativeBot
// ---------------------------------------------------------------------------

/**
 * Only places a leg bet when:
 *   1. The target camel is currently the race leader, AND
 *   2. The bet EV strictly beats rolling (+1).
 *
 * This simulates a cautious player who wants the board to confirm their pick
 * before committing a tile.
 */
export const conservativeBot: BotStrategy = (ctx: BotTurnContext): BotAction => {
  const leader = getLeadingCamel(ctx.state.track);
  const best = ctx.bestLegAction;

  if (
    best.type === 'bet' &&
    best.beatsRoll &&
    best.camel === leader
  ) {
    return { type: 'leg-bet', camel: best.camel as ForwardCamelColor };
  }

  return { type: 'roll' };
};

// ---------------------------------------------------------------------------
// randomBot
// ---------------------------------------------------------------------------

/**
 * Produces a `BotStrategy` that picks a random valid action each turn.
 * The supplied `rng` should be a seeded function (e.g. from `makePrng`) so
 * results are reproducible.
 *
 * Valid actions:
 *   - Roll (always valid)
 *   - Leg-bet on any camel that still has tiles
 *   - Race-winner bet on any camel not yet bet on by this player
 *   - Race-loser bet on any camel not yet bet on by this player
 */
export function randomBot(rng: () => number): BotStrategy {
  return (ctx: BotTurnContext): BotAction => {
    const { state, availableWinnerBets, availableLoserBets } = ctx;

    // Build all valid actions.
    const actions: BotAction[] = [{ type: 'roll' }];

    for (const camel of CAMEL_COLORS) {
      if ((state.legBetStacks[camel] ?? []).length > 0) {
        actions.push({ type: 'leg-bet', camel });
      }
    }

    for (const camel of availableWinnerBets) {
      actions.push({ type: 'race-bet', camel, betType: 'winner' });
    }
    for (const camel of availableLoserBets) {
      actions.push({ type: 'race-bet', camel, betType: 'loser' });
    }

    return actions[Math.floor(rng() * actions.length)];
  };
}

// ---------------------------------------------------------------------------
// blendedBot
// ---------------------------------------------------------------------------

/**
 * On each turn, picks one of the supplied strategies at random, weighted by
 * `weights`.  Useful for testing mixed or intermediate behaviours.
 *
 * @param strategies  Array of strategies to blend.
 * @param weights     Relative weights (need not sum to 1).  Must be the same
 *                    length as `strategies`.
 * @param rng         Seeded random number generator.
 */
export function blendedBot(
  strategies: BotStrategy[],
  weights: number[],
  rng: () => number
): BotStrategy {
  if (strategies.length !== weights.length || strategies.length === 0) {
    throw new Error('blendedBot: strategies and weights must be non-empty and the same length');
  }

  const total = weights.reduce((s, w) => s + w, 0);
  const cumulative = weights.map(
    ((acc) => (w: number) => (acc += w / total))(0)
  );

  return (ctx: BotTurnContext): BotAction => {
    const r = rng();
    const idx = cumulative.findIndex((c) => r < c);
    return strategies[idx >= 0 ? idx : strategies.length - 1](ctx);
  };
}

// ---------------------------------------------------------------------------
// Utility: name a strategy for display
// ---------------------------------------------------------------------------

export interface NamedStrategy {
  name: string;
  strategy: BotStrategy;
}

/** Convenience helper for building labelled strategy lists. */
export function named(name: string, strategy: BotStrategy): NamedStrategy {
  return { name, strategy };
}
