// ---------------------------------------------------------------------------
// Camel Up 2.0 — Monte Carlo Race Simulator
//
// PURPOSE
// -------
// The leg probability engine (Step 3) gives exact probabilities for who wins
// the *current leg*. But for the overall race (winner / loser) we need to
// simulate many complete games from the current board state forward.
//
// METHOD
// ------
// Each simulation:
//   1. Finishes the current leg using the remaining dice pool in a random order,
//      each rolling uniformly from {1, 2, 3}.
//   2. If a camel crosses the finish line mid-leg, the race ends immediately.
//   3. Otherwise, starts a fresh leg (new pool = all 5 camels), repeats.
//   4. Records which camel is in 1st place (winner) and last place (loser)
//      at the moment the race ends.
//
// PERFORMANCE
// -----------
// Default 10,000 simulations takes ~50–150 ms on typical hardware.
// The inner loop reuses the immutable movement engine but avoids unnecessary
// allocation by doing all leg dice in a single shuffled pass.
//
// SEEDED RNG
// ----------
// Uses a fast Mulberry32 PRNG seeded from a user-supplied seed (or
// performance.now() by default) so results are reproducible for debugging.
// ---------------------------------------------------------------------------

import type { CamelColor, DicePoolEntry, DicePool, Track } from './types';
import { CAMEL_COLORS, CRAZY_CAMELS, createDicePool } from './constants';
import { moveCamelFull, moveCrazyFull, getLeadingCamel, getLastCamel } from './movement';

/** All 7 camel colours (forward + crazy). Used for win/lose accounting. */
const ALL_CAMEL_COLORS: readonly CamelColor[] = [...CAMEL_COLORS, ...CRAZY_CAMELS];

/** The two crazy camel colours selected by the crazy die. */
const CRAZY_PAIR: readonly CamelColor[] = [...CRAZY_CAMELS];

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32
// ---------------------------------------------------------------------------

/** Returns a PRNG function that yields floats in [0, 1). */
export function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Returns a random integer in [0, n). */
function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Returns a random die face: 1, 2, or 3. */
function rollDie(rng: () => number): 1 | 2 | 3 {
  return (randInt(rng, 3) + 1) as 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Single game simulation
// ---------------------------------------------------------------------------

interface GameOutcome {
  winner: CamelColor | null;
  loser: CamelColor | null;
}

/**
 * Simulates one complete game to its conclusion from the given state.
 * Returns which camel finishes 1st (winner) and last (loser).
 *
 * @param startTrack    Current board (immutable — never modified here)
 * @param startPool     Dice not yet rolled in the current leg
 * @param rng           Seeded random number generator
 */
function simulateOneGame(
  startTrack: Track,
  startPool: DicePool,
  rng: () => number
): GameOutcome {
  let track = startTrack;
  let pool = [...startPool]; // mutable copy for this simulation

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // If pool is empty (leg just ended cleanly), start a new leg.
    if (pool.length === 0) {
      pool = createDicePool(); // fresh pool = all 5 camels
    }

    // Shuffle remaining dice to simulate pyramid randomness.
    shuffle(pool, rng);

    // Roll each die in shuffled order.
    let raceEnded = false;
    while (pool.length > 0) {
      const entry: DicePoolEntry = pool.shift()!; // take first from shuffled pool
      const steps = rollDie(rng);

      if (entry === 'crazy') {
        // Crazy die: randomly pick black or white, move backward.
        const crazyCamel = CRAZY_PAIR[randInt(rng, 2)];
        const result = moveCrazyFull(track, crazyCamel, steps);
        track = result.track;
        // Crazy camels can never trigger raceOver
      } else {
        const result = moveCamelFull(track, entry, steps);
        track = result.track;
        if (result.raceOver) {
          raceEnded = true;
          break;
        }
      }
    }

    if (raceEnded) break;
    // pool is now empty → loop back to start next leg
  }

  return {
    winner: getLeadingCamel(track),
    loser: getLastCamel(track),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SimulationResult {
  /** P(camel finishes 1st in the overall race). */
  winProbabilities: Record<CamelColor, number>;
  /** P(camel finishes last in the overall race). */
  loseProbabilities: Record<CamelColor, number>;
  /** Number of games simulated. */
  totalSimulations: number;
  /** Wall-clock time taken in milliseconds. */
  elapsedMs: number;
  /** The seed used (for reproducibility). */
  seed: number;
}

/**
 * Runs Monte Carlo simulations to estimate overall race win/lose probabilities
 * for each camel.
 *
 * @param track           Current board state
 * @param currentDicePool Dice not yet rolled in the current leg
 * @param numSimulations  How many games to simulate (default 10,000)
 * @param seed            Optional seed for reproducibility; defaults to Date.now()
 */
export function runSimulation(
  track: Track,
  currentDicePool: DicePool,
  numSimulations = 10_000,
  seed?: number
): SimulationResult {
  const usedSeed = seed ?? Date.now();

  // Guard: 0 simulations → return all-zero probabilities (avoid division by 0).
  if (numSimulations === 0) {
    const zero = Object.fromEntries(ALL_CAMEL_COLORS.map((c) => [c, 0])) as Record<CamelColor, number>;
    return {
      winProbabilities: { ...zero },
      loseProbabilities: { ...zero },
      totalSimulations: 0,
      elapsedMs: 0,
      seed: usedSeed,
    };
  }

  const rng = makePrng(usedSeed);

  // Include all 7 colours so crazy camels appearing as leader/trailer don't
  // produce NaN via `undefined++`.
  const winCounts: Record<CamelColor, number> = Object.fromEntries(
    ALL_CAMEL_COLORS.map((c) => [c, 0])
  ) as Record<CamelColor, number>;

  const loseCounts: Record<CamelColor, number> = Object.fromEntries(
    ALL_CAMEL_COLORS.map((c) => [c, 0])
  ) as Record<CamelColor, number>;

  const t0 = Date.now();

  for (let i = 0; i < numSimulations; i++) {
    const outcome = simulateOneGame(track, currentDicePool, rng);
    if (outcome.winner) winCounts[outcome.winner]++;
    if (outcome.loser) loseCounts[outcome.loser]++;
  }

  const elapsedMs = Date.now() - t0;

  const winProbabilities = Object.fromEntries(
    ALL_CAMEL_COLORS.map((c) => [c, winCounts[c] / numSimulations])
  ) as Record<CamelColor, number>;

  const loseProbabilities = Object.fromEntries(
    ALL_CAMEL_COLORS.map((c) => [c, loseCounts[c] / numSimulations])
  ) as Record<CamelColor, number>;

  return {
    winProbabilities,
    loseProbabilities,
    totalSimulations: numSimulations,
    elapsedMs,
    seed: usedSeed,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Returns camels sorted by overall win probability, highest first.
 *  Includes all camels present in the result (forward + any crazy camels). */
export function rankByWinProbability(
  result: SimulationResult
): { camel: CamelColor; winProbability: number; loseProbability: number }[] {
  return (Object.keys(result.winProbabilities) as CamelColor[])
    .map((c) => ({
      camel: c,
      winProbability: result.winProbabilities[c],
      loseProbability: result.loseProbabilities[c],
    }))
    .sort((a, b) => b.winProbability - a.winProbability);
}

/** Returns the camel most likely to win the overall race. */
export function getMostLikelyRaceWinner(
  result: SimulationResult
): CamelColor {
  return rankByWinProbability(result)[0].camel;
}

/** Returns the camel most likely to finish last overall. */
export function getMostLikelyRaceLoser(
  result: SimulationResult
): CamelColor {
  return (Object.keys(result.loseProbabilities) as CamelColor[]).sort(
    (a, b) => result.loseProbabilities[b] - result.loseProbabilities[a]
  )[0];
}
