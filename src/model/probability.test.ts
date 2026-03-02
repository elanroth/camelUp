import { describe, it, expect } from 'vitest';
import {
  computeLegProbabilities,
  rankCamelsByLegWinProb,
  getMostLikelyLegWinner,
} from './probability';
import { createEmptyTrack, CAMEL_COLORS } from './constants';
import { placeCamel } from './movement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPS = 1e-9; // floating-point tolerance

function approxEq(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) < eps;
}

function sumProbs(probs: Record<string, number>): number {
  return Object.values(probs).reduce((s, v) => s + v, 0);
}

// ---------------------------------------------------------------------------
// Degenerate / base cases
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — empty dice pool (leg already over)', () => {
  it('gives P=1 to the current leader, 0 to others', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 5);
    track = placeCamel(track, 'purple', 2);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(track, []);

    expect(winProbabilities['pink']).toBe(1);
    expect(winProbabilities['purple']).toBe(0);
    expect(winProbabilities['green']).toBe(0);
    expect(totalOutcomes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Single die remaining — deterministic outcomes
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — 1 die left, outcome always the same', () => {
  it('leader who can never be overtaken wins with P=1', () => {
    // purple at space 5, green at space 1 — green can only reach 4 max
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 5);
    track = placeCamel(track, 'green', 1);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['green']
    );

    // Green rolls 1→2, 2→3, 3→4: purple stays at 5 and leads all 3 outcomes
    expect(winProbabilities['purple']).toBe(1);
    expect(winProbabilities['green']).toBe(0);
    // 1 camel × 3 die faces = 3 outcomes
    expect(totalOutcomes).toBe(3);
  });

  it('trailer who can always overtake wins with P=1', () => {
    // purple at space 5, green at space 4
    // green rolls 1 → lands on 5 (goes ON TOP of purple) → green leads
    // green rolls 2 → green at 6 → green leads
    // green rolls 3 → green at 7 → green leads
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 5);
    track = placeCamel(track, 'green', 4);

    const { winProbabilities } = computeLegProbabilities(track, ['green']);

    expect(winProbabilities['green']).toBe(1);
    expect(winProbabilities['purple']).toBe(0);
  });

  it('stacking: camel landing on leader goes on top and wins', () => {
    // purple at space 5, green exactly 1 step behind
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 5);
    track = placeCamel(track, 'green', 4);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['green']
    );

    // All 3 rolls lead to green winning (as computed above)
    expect(winProbabilities['green']).toBe(1);
    expect(totalOutcomes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Two dice remaining — hand-computed expected values
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — 2 dice, hand-computed probabilities', () => {
  /**
   * Setup: purple at space 4, green at space 2.
   * Pool: ['purple', 'green']
   * Total outcomes: 2 orders × 3 × 3 = 18
   *
   * Hand computation:
   *   PURPLE FIRST:
   *     p+1, p+2, p+3 leads green to space ≤5 (≤ purple) except:
   *     p+1 then g+3: green lands on 5 (=purple's new pos) → green ON TOP → green wins (1 outcome)
   *     p+2 then g+anything: green can only reach 5 < 6 → purple wins (3 outcomes)
   *     p+3 then g+anything: green can only reach 5 < 7 → purple wins (3 outcomes)
   *     purple-first subtotal: purple=8, green=1
   *
   *   GREEN FIRST:
   *     g+1 → green=3, then purple rolls and goes to 5/6/7 → purple wins (3 outcomes)
   *     g+2 → green=4 (same as purple!) → green ON TOP of purple, stack=[purple,green]
   *            purple rolls carrying green on top → wherever they land, green is top → green wins (3)
   *     g+3 → green=5, then purple+1=5 (purple ON TOP) wins; purple+2=6 wins; purple+3=7 wins (3 purple wins)
   *     green-first subtotal: purple=6, green=3
   *
   *   TOTAL: purple=14, green=4 out of 18
   *   P(purple) = 14/18 = 7/9;  P(green) = 4/18 = 2/9
   */
  it('gives P(purple)=7/9, P(green)=2/9 for the computed scenario', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 4);
    track = placeCamel(track, 'green', 2);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['purple', 'green']
    );

    expect(totalOutcomes).toBe(18);
    expect(approxEq(winProbabilities['purple'], 14 / 18)).toBe(true);
    expect(approxEq(winProbabilities['green'], 4 / 18)).toBe(true);
    // All other camels not in pool or on board have 0
    expect(winProbabilities['blue']).toBe(0);
    expect(winProbabilities['yellow']).toBe(0);
    expect(winProbabilities['pink']).toBe(0);
  });

  it('probabilities sum to 1', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 4);
    track = placeCamel(track, 'green', 2);

    const { winProbabilities } = computeLegProbabilities(
      track,
      ['purple', 'green']
    );

    expect(approxEq(sumProbs(winProbabilities), 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Five dice remaining — full game start
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — all 5 dice, all camels on board', () => {
  it('probabilities sum to 1 for a spread-out starting position', () => {
    // Spread camels across the board
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 4);

    const { winProbabilities } = computeLegProbabilities(
      track,
      [...CAMEL_COLORS]
    );

    expect(approxEq(sumProbs(winProbabilities), 1)).toBe(true);
  });

  it('camel starting furthest ahead has the highest win probability', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 4);

    const { winProbabilities } = computeLegProbabilities(
      track,
      [...CAMEL_COLORS]
    );

    const pinkProb = winProbabilities['pink'];
    CAMEL_COLORS.filter((c) => c !== 'pink').forEach((c) => {
      expect(pinkProb).toBeGreaterThanOrEqual(winProbabilities[c]);
    });
  });

  it('camel starting furthest behind has the lowest win probability', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 4);

    const { winProbabilities } = computeLegProbabilities(
      track,
      [...CAMEL_COLORS]
    );

    const purpleProb = winProbabilities['purple'];
    CAMEL_COLORS.filter((c) => c !== 'purple').forEach((c) => {
      expect(purpleProb).toBeLessThanOrEqual(winProbabilities[c]);
    });
  });

  it('produces exactly 29160 outcomes with 5 dice remaining', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 4);

    const { totalOutcomes } = computeLegProbabilities(
      track,
      [...CAMEL_COLORS]
    );

    // 5! × 3^5 = 120 × 243 = 29,160
    expect(totalOutcomes).toBe(29160);
  });

  it('all stacked, 1 die left — any roll moves a subgroup keeping top camel ahead', () => {
    // Stack at space 0 (bottom→top): purple, green, blue, yellow, pink
    // Only 1 die left: purple's.
    // Purple (bottom) moves, carrying everyone on top → same relative order, pink still on top.
    // All 3 rolls keep pink as the topmost camel at the new (higher) space → P(pink)=1.
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 0);
    track = placeCamel(track, 'blue', 0);
    track = placeCamel(track, 'yellow', 0);
    track = placeCamel(track, 'pink', 0);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['purple'] // only purple's die hasn't been rolled
    );

    expect(winProbabilities['pink']).toBe(1);
    CAMEL_COLORS.filter((c) => c !== 'pink').forEach((c) => {
      expect(winProbabilities[c]).toBe(0);
    });
    expect(totalOutcomes).toBe(3); // 1 camel × 3 faces
  });

  it('reversed stack, 1 die left — purple on top always wins', () => {
    // Stack at space 0 (bottom→top): pink, yellow, blue, green, purple
    // Only pink's die left. Pink (bottom) carries everyone → purple still on top.
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 0);
    track = placeCamel(track, 'yellow', 0);
    track = placeCamel(track, 'blue', 0);
    track = placeCamel(track, 'green', 0);
    track = placeCamel(track, 'purple', 0);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['pink'] // only pink's die hasn't been rolled
    );

    expect(winProbabilities['purple']).toBe(1);
    CAMEL_COLORS.filter((c) => c !== 'purple').forEach((c) => {
      expect(winProbabilities[c]).toBe(0);
    });
    expect(totalOutcomes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Race-over detection mid-leg
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — race-over mid-leg', () => {
  it('stops enumeration when a camel crosses the finish and awards leg win correctly', () => {
    // pink at space 13 (3 steps from finish at 16), purple at space 0
    // Pool: [pink, purple] — pink rolls first in half the branches
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 13);
    track = placeCamel(track, 'purple', 0);

    const { winProbabilities } = computeLegProbabilities(
      track,
      ['pink', 'purple']
    );

    // Pink is far ahead and rolls first in many branches — should win more often.
    expect(winProbabilities['pink']).toBeGreaterThan(winProbabilities['purple']);
    expect(approxEq(sumProbs(winProbabilities), 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

describe('rankCamelsByLegWinProb', () => {
  it('returns camels sorted highest probability first', () => {
    const probs = {
      blue:   0.4,
      green:  0.3,
      yellow: 0.15,
      purple: 0.1,
      pink:   0.05,
    };

    const ranked = rankCamelsByLegWinProb(probs);
    expect(ranked[0].camel).toBe('blue');
    expect(ranked[1].camel).toBe('green');
    expect(ranked[2].camel).toBe('yellow');
    expect(ranked[3].camel).toBe('purple');
    expect(ranked[4].camel).toBe('pink');
  });

  it('each entry has the correct probability', () => {
    const probs = { blue: 0.5, green: 0.3, yellow: 0.1, purple: 0.06, pink: 0.04 };
    const ranked = rankCamelsByLegWinProb(probs);
    ranked.forEach(({ camel, probability }) => {
      expect(probability).toBe(probs[camel]);
    });
  });
});

describe('getMostLikelyLegWinner', () => {
  it('returns the camel with the highest probability', () => {
    const probs = { purple: 0.1, green: 0.55, blue: 0.2, yellow: 0.1, pink: 0.05 };
    expect(getMostLikelyLegWinner(probs)).toBe('green');
  });
});

// ---------------------------------------------------------------------------
// 3 dice — exact outcome count
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — 3 dice', () => {
  it('produces exactly 162 outcomes when no camel can reach the finish', () => {
    // Max reach: space 2 + 3 = 5. TRACK_LENGTH=16. No race-over possible.
    // 3! × 3^3 = 6 × 27 = 162
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);

    const { totalOutcomes } = computeLegProbabilities(track, ['purple', 'green', 'blue']);
    expect(totalOutcomes).toBe(162);
  });

  it('probabilities sum to 1 with 3 dice', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);

    const { winProbabilities } = computeLegProbabilities(track, ['purple', 'green', 'blue']);
    expect(approxEq(sumProbs(winProbabilities), 1)).toBe(true);
  });

  it('camel furthest ahead wins most often with 3 dice', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 3);

    const { winProbabilities } = computeLegProbabilities(track, ['purple', 'green', 'blue']);
    expect(winProbabilities['blue']).toBeGreaterThan(winProbabilities['green']);
    expect(winProbabilities['blue']).toBeGreaterThan(winProbabilities['purple']);
  });
});

// ---------------------------------------------------------------------------
// Camel in dice pool but not on track — should throw
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — camel in pool not on track', () => {
  it('does not throw when a camel in the dice pool is not on the track (graceful skip)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 5);
    // 'green' is in the pool but not placed on the track — gracefully skipped
    expect(() => computeLegProbabilities(track, ['purple', 'green'])).not.toThrow();
    const result = computeLegProbabilities(track, ['purple', 'green']);
    // Purple is the only camel on track, so it should win with P=1
    expect(result.winProbabilities.purple).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// Probability value bounds
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — probability bounds', () => {
  it('all probabilities are in [0, 1] for spread-out camels', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i * 2); });

    const { winProbabilities } = computeLegProbabilities(track, [...CAMEL_COLORS]);
    Object.values(winProbabilities).forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it('all probabilities are in [0, 1] for a stacked starting position', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c) => { track = placeCamel(track, c, 0); });

    const { winProbabilities } = computeLegProbabilities(track, [...CAMEL_COLORS]);
    Object.values(winProbabilities).forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Camel already at space 15 with a roll remaining
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — camel at space 15 with remaining die', () => {
  it('any roll by the camel at 15 triggers raceOver, awarding the leg correctly', () => {
    // purple is at space 15 (last space) with its die still to roll.
    // green is at space 1.  Purple's roll => spaceIndex===destination => raceOver.
    // Purple is the current leader (space 15 > space 1), so purple wins all 3 outcomes.
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 15);
    track = placeCamel(track, 'green', 1);

    const { winProbabilities, totalOutcomes } = computeLegProbabilities(
      track,
      ['purple']
    );

    expect(winProbabilities['purple']).toBe(1);
    expect(winProbabilities['green']).toBe(0);
    expect(totalOutcomes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Empty track with empty pool
// ---------------------------------------------------------------------------

describe('computeLegProbabilities — empty track, empty pool', () => {
  it('all probabilities are 0 when no camels are on the track', () => {
    const track = createEmptyTrack();
    const { winProbabilities, totalOutcomes } = computeLegProbabilities(track, []);
    Object.values(winProbabilities).forEach((p) => expect(p).toBe(0));
    expect(totalOutcomes).toBe(1); // base case returns 1
  });
});
