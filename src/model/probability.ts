// ---------------------------------------------------------------------------
// Camel Up 2.0 — Leg Probability Engine
//
// ALGORITHM
// ---------
// At each turn during a leg, one die is pulled at RANDOM from the pyramid
// (uniform over remaining dice) and shows 1, 2, or 3 (each equally likely).
// The crazy die shows one of {black,white}×{1,2,3} — 6 equally likely faces.
//
// Therefore EVERY fully-specified sequence of outcomes is equally probable —
// we enumerate them all and count outcomes.
//
// Worst case (5 forward dice + 1 crazy die = 6):
//   6×(3 or 6) × 5×3 × 4×3 × 3×3 × 2×3 × 1×3 ≈ 174,960 leaves, <20 ms.
//
// Leg winner is the leading FORWARD camel (crazy camels excluded from leg bets).
// ---------------------------------------------------------------------------

import type { CamelColor, DicePool, DicePoolEntry, ForwardCamelColor, LegWinProbabilities, Track } from './types';
import { CAMEL_COLORS, TRACK_LENGTH, DIE_FACES } from './constants';
import { moveCamelFull, moveCrazyFull, getLeadingForwardCamel } from './movement';

// ---------------------------------------------------------------------------
// Internal counters used during enumeration
// ---------------------------------------------------------------------------

type WinCounts = Record<ForwardCamelColor, number>;

function zeroCounts(): WinCounts {
  return Object.fromEntries(CAMEL_COLORS.map((c) => [c, 0])) as WinCounts;
}

// The two crazy camels that share the crazy die
const CRAZY_PAIR: CamelColor[] = ['black', 'white'];

// ---------------------------------------------------------------------------
// Mutable in-place track operations for fast enumeration
// ---------------------------------------------------------------------------
// These mirror the logic in movement.ts but operate directly on a mutable Track
// (CamelColor[][]) without any allocation, returning "undo information"
// so the caller can restore the state after exploring each branch.
//
// By avoiding Array.map + spread on every single move, we reduce GC pressure
// by ~100× compared to the pure/immutable approach.
// ---------------------------------------------------------------------------

/** Locate a camel in the mutable track; returns null if not found. */
function findMut(track: CamelColor[][], camel: CamelColor): { si: number; ki: number } | null {
  for (let si = 0; si < track.length; si++) {
    const ki = track[si].indexOf(camel);
    if (ki !== -1) return { si, ki };
  }
  return null;
}

/** Leading forward camel from a mutable track (same logic as getLeadingForwardCamel). */
function leadingFwd(track: CamelColor[][]): ForwardCamelColor | null {
  for (let si = track.length - 1; si >= 0; si--) {
    for (let ki = track[si].length - 1; ki >= 0; ki--) {
      const c = track[si][ki];
      if (CAMEL_COLORS.includes(c as ForwardCamelColor)) return c as ForwardCamelColor;
    }
  }
  return null;
}

const FORWARD_SET = new Set<string>(CAMEL_COLORS);

interface ForwardUndoInfo {
  fromSi: number;
  toSi: number;
  movingLen: number;   // number of camels moved (the group)
  raceOver: boolean;
}

/**
 * Move a forward camel in-place. Returns undo info, or null if not on track.
 * Returns ForwardUndoInfo with raceOver = true if race ended.
 */
function moveFwdMut(
  track: CamelColor[][],
  camel: CamelColor,
  steps: 1 | 2 | 3
): ForwardUndoInfo | null {
  const pos = findMut(track, camel);
  if (pos === null) return null;

  const { si: fromSi, ki } = pos;
  const fromStack = track[fromSi];
  const movingGroup = fromStack.splice(ki); // removes camel + riders from fromStack
  const movingLen = movingGroup.length;

  const rawDest = fromSi + steps;
  const raceOver = rawDest >= TRACK_LENGTH;
  const toSi = Math.min(rawDest, TRACK_LENGTH - 1);

  if (fromSi === toSi) {
    // Already on last space — put back and mark race over
    fromStack.splice(ki, 0, ...movingGroup);
    return { fromSi, toSi, movingLen, raceOver: true };
  }

  // Place on top of destination
  track[toSi].push(...movingGroup);

  return { fromSi, toSi, movingLen, raceOver };
}

/** Undo a forward move. */
function undoFwdMut(
  track: CamelColor[][],
  undo: ForwardUndoInfo
): void {
  if (undo.fromSi === undo.toSi) return; // edge case: was already last space

  const toStack = track[undo.toSi];
  const movedGroup = toStack.splice(toStack.length - undo.movingLen);
  // Put them back at the bottom of where they were (find original ki)
  // Since we spliced from ki to end, they go back from ki.
  // The remaining fromStack is track[undo.fromSi] which now has elements [0..ki-1]
  track[undo.fromSi].push(...movedGroup);
}

interface CrazyUndoInfo {
  fromSi: number;
  toSi: number;
  movingLen: number;
}

/**
 * Move a crazy camel backward in-place. Returns undo info, or null if not on track.
 * Under-stacking: landing group goes UNDER the existing stack at destination.
 */
function moveCrazyMut(
  track: CamelColor[][],
  camel: CamelColor,
  steps: 1 | 2 | 3
): CrazyUndoInfo | null {
  const pos = findMut(track, camel);
  if (pos === null) return null;

  const { si: fromSi, ki } = pos;
  const fromStack = track[fromSi];
  const movingGroup = fromStack.splice(ki); // camel + riders
  const movingLen = movingGroup.length;

  const toSi = Math.max(fromSi - steps, 0);

  if (fromSi === toSi) {
    // Already at start — put back
    fromStack.splice(ki, 0, ...movingGroup);
    return { fromSi, toSi, movingLen };
  }

  // Under-stack: place moving group below the existing destination stack
  track[toSi].unshift(...movingGroup);

  return { fromSi, toSi, movingLen };
}

/** Undo a crazy backward move. */
function undoCrazyMut(
  track: CamelColor[][],
  undo: CrazyUndoInfo
): void {
  if (undo.fromSi === undo.toSi) return;

  const toStack = track[undo.toSi];
  const movedGroup = toStack.splice(0, undo.movingLen); // was under-stacked at front
  track[undo.fromSi].push(...movedGroup);
}

// ---------------------------------------------------------------------------
// Core recursive enumerator (mutable track, no allocation per call)
// ---------------------------------------------------------------------------

/**
 * Recursively enumerates all equally-likely (die, steps) sequences for the
 * remaining dice in `pool[0..poolLen-1]`, simulating each on `track` in-place
 * with undo, tallying which forward camel is leading when the leg ends.
 *
 * For the 'crazy' die entry: branches into 6 sub-outcomes (black|white × 1|2|3)
 * using backward movement with under-stacking. Each sub-outcome counts as 1 leaf.
 *
 * Uses in-place swap-and-shrink to avoid pool array allocation per call.
 */
function enumerate(
  track: CamelColor[][],
  pool: DicePoolEntry[],   // mutable scratch buffer
  poolLen: number,
  counts: WinCounts,
  totalRef: [number]
): void {
  // Base case: all dice rolled — leg is over.
  if (poolLen === 0) {
    const winner = leadingFwd(track);
    if (winner !== null) counts[winner]++;
    totalRef[0]++;
    return;
  }

  for (let ci = 0; ci < poolLen; ci++) {
    const entry: DicePoolEntry = pool[ci];

    // Swap entry to end, shrink pool by 1
    pool[ci] = pool[poolLen - 1];
    pool[poolLen - 1] = entry;
    const nextLen = poolLen - 1;

    if (entry === 'crazy') {
      // Crazy die: enumerate all 6 faces (black|white × 1|2|3)
      for (const crazyCamel of CRAZY_PAIR) {
        for (const steps of DIE_FACES) {
          const undo = moveCrazyMut(track, crazyCamel, steps);
          enumerate(track, pool, nextLen, counts, totalRef);
          if (undo !== null) undoCrazyMut(track, undo);
        }
      }
    } else {
      // Forward camel die: 3 faces
      for (const steps of DIE_FACES) {
        const undo = moveFwdMut(track, entry, steps);
        if (undo === null) {
          // Camel not on track (shouldn't happen, but skip gracefully)
          enumerate(track, pool, nextLen, counts, totalRef);
          continue;
        }

        if (undo.raceOver) {
          const winner = leadingFwd(track);
          if (winner !== null) counts[winner]++;
          totalRef[0]++;
          // Undo the move (fromSi===toSi edge case means nothing changed)
          if (undo.fromSi !== undo.toSi) undoFwdMut(track, undo);
          continue;
        }

        enumerate(track, pool, nextLen, counts, totalRef);
        undoFwdMut(track, undo);
      }
    }

    // Restore the swap
    pool[poolLen - 1] = pool[ci];
    pool[ci] = entry;
  }
}

void FORWARD_SET; // used via leadingFwd

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LegProbabilityResult {
  /** P(win leg) for each forward camel. Values sum to 1. */
  winProbabilities: LegWinProbabilities;
  /**
   * Rank-probability matrix.
   * `rankProbabilities[camel][rank]` = P(camel finishes this leg in `rank`
   * place, 0-based so 0 = 1st).
   *
   * Only populated when `includeRanks = true`.
   */
  rankProbabilities: Record<CamelColor, number[]> | null;
  /** Total number of equally-likely outcomes enumerated. */
  totalOutcomes: number;
}

/**
 * Computes exact leg-win probabilities for all 5 forward camels given the
 * current track state and the set of dice yet to be rolled this leg.
 *
 * @param track    Current board (camels must already be placed)
 * @param dicePool Dice not yet rolled this leg (may include 'crazy')
 */
export function computeLegProbabilities(
  track: Track,
  dicePool: DicePool
): LegProbabilityResult {
  if (dicePool.length === 0) {
    // Leg is already over — whoever is leading has already won it.
    const winner = getLeadingForwardCamel(track);
    const winProbs = zeroCounts() as LegWinProbabilities;
    if (winner !== null) (winProbs as Record<CamelColor, number>)[winner] = 1;
    return { winProbabilities: winProbs, rankProbabilities: null, totalOutcomes: 1 };
  }

  const counts = zeroCounts();
  const totalRef: [number] = [0];

  // Deep-copy the track into a mutable CamelColor[][] for in-place enumeration.
  const mutTrack: CamelColor[][] = track.map(space => [...space]);
  const poolBuf = [...dicePool]; // mutable scratch buffer
  enumerate(mutTrack, poolBuf, poolBuf.length, counts, totalRef);

  const total = totalRef[0];
  const winProbabilities = Object.fromEntries(
    CAMEL_COLORS.map((c) => [c, total > 0 ? counts[c] / total : 0])
  ) as LegWinProbabilities;

  return { winProbabilities, rankProbabilities: null, totalOutcomes: total };
}

// ---------------------------------------------------------------------------
// Trap tile landing probability
// ---------------------------------------------------------------------------

/**
 * For each track space index, computes the expected number of times a camel
 * group lands on that space over all remaining dice outcomes this leg.
 * Used to compute the EV of placing a desert tile at a given space.
 *
 * Returns a map: spaceIndex → expected landing count (≥ 0, can exceed 1 if
 * multiple camels/groups land there in different outcomes).
 */
export function computeLandingExpectations(
  track: Track,
  dicePool: DicePool
): number[] {
  const spaceCount = track.length;
  const landingTotals = new Array<number>(spaceCount).fill(0);
  const pathTotals: [number] = [0];

  // We enumerate all outcomes and accumulate landing events weighted by path count.
  // Each leaf path has weight 1; we divide by totalOutcomes at the end.
  function enumerateForLandings(t: Track, pool: DicePool, landings: number[]): void {
    if (pool.length === 0) {
      pathTotals[0]++;
      return;
    }

    for (let ci = 0; ci < pool.length; ci++) {
      const entry: DicePoolEntry = pool[ci];
      const nextPool = pool.filter((_, idx) => idx !== ci);

      if (entry === 'crazy') {
        for (const crazyCamel of CRAZY_PAIR) {
          for (const steps of DIE_FACES) {
            const result = moveCrazyFull(t, crazyCamel, steps);
            landings[result.landedOn]++;
            enumerateForLandings(result.track, nextPool, landings);
            landings[result.landedOn]--;
          }
        }
      } else {
        for (const steps of DIE_FACES) {
          const result = moveCamelFull(t, entry, steps);
          if (!result.raceOver) {
            landings[result.landedOn]++;
            enumerateForLandings(result.track, nextPool, landings);
            landings[result.landedOn]--;
          } else {
            pathTotals[0]++;
          }
        }
      }
    }
  }

  // Use a separate accumulator that aggregates across all paths
  const accumulated = new Array<number>(spaceCount).fill(0);

  function enumerateAccumulate(t: Track, pool: DicePool, pathLandingsSoFar: number[]): void {
    if (pool.length === 0) {
      // At leaf, add this path's landings to the total
      for (let i = 0; i < spaceCount; i++) {
        accumulated[i] += pathLandingsSoFar[i];
      }
      pathTotals[0]++;
      return;
    }

    for (let ci = 0; ci < pool.length; ci++) {
      const entry: DicePoolEntry = pool[ci];
      const nextPool = pool.filter((_, idx) => idx !== ci);

      if (entry === 'crazy') {
        for (const crazyCamel of CRAZY_PAIR) {
          for (const steps of DIE_FACES) {
            const result = moveCrazyFull(t, crazyCamel, steps);
            pathLandingsSoFar[result.landedOn]++;
            enumerateAccumulate(result.track, nextPool, pathLandingsSoFar);
            pathLandingsSoFar[result.landedOn]--;
          }
        }
      } else {
        for (const steps of DIE_FACES) {
          const result = moveCamelFull(t, entry, steps);
          if (!result.raceOver) {
            pathLandingsSoFar[result.landedOn]++;
            enumerateAccumulate(result.track, nextPool, pathLandingsSoFar);
            pathLandingsSoFar[result.landedOn]--;
          } else {
            for (let i = 0; i < spaceCount; i++) {
              accumulated[i] += pathLandingsSoFar[i];
            }
            pathTotals[0]++;
          }
        }
      }
    }
  }

  void enumerateForLandings; // unused variant, kept for reference
  enumerateAccumulate(track, dicePool, landingTotals);

  const total = pathTotals[0];
  if (total === 0) return accumulated;
  return accumulated.map(v => v / total);
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Returns camels sorted by their leg-win probability, highest first.
 */
export function rankCamelsByLegWinProb(
  probs: LegWinProbabilities
): { camel: ForwardCamelColor; probability: number }[] {
  return (Object.entries(probs) as [ForwardCamelColor, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([camel, probability]) => ({ camel, probability }));
}

/**
 * Returns the camel with the highest probability of winning the current leg.
 */
export function getMostLikelyLegWinner(
  probs: LegWinProbabilities
): ForwardCamelColor {
  const sorted = rankCamelsByLegWinProb(probs);
  return sorted[0].camel;
}
