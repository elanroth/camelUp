import { describe, it, expect } from 'vitest';
import {
  computeLegBetEVs,
  computeLegBetRecommendations,
  computeAllLegActions,
  getBestLegAction,
  breakEvenProbability,
  marginAboveBreakEven,
  ROLL_ACTION,
} from './ev';
import type { LegWinProbabilities } from './types';
import { CAMEL_COLORS, createLegBetStacks } from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPS = 1e-9;
const approxEq = (a: number, b: number) => Math.abs(a - b) < EPS;

/** Uniform probabilities — each camel has exactly 1/5. */
function uniformProbs(): LegWinProbabilities {
  return Object.fromEntries(CAMEL_COLORS.map((c) => [c, 0.2])) as LegWinProbabilities;
}

/** Probs that make one camel very likely to win. */
function singleFavouriteProbs(_favourite: 'pink'): LegWinProbabilities {
  return {
    purple: 0.05,
    green: 0.05,
    blue: 0.05,
    yellow: 0.05,
    pink: 0.8,
  };
}

/** Probs designed so NO bet is better than rolling (+1). */
function badBetProbs(): LegWinProbabilities {
  // P=0.1 for every camel. Best EV = 0.1×6−1 = −0.4 < 1.
  return Object.fromEntries(CAMEL_COLORS.map((c) => [c, 0.1])) as LegWinProbabilities;
}

// ---------------------------------------------------------------------------
// breakEvenProbability
// ---------------------------------------------------------------------------

describe('breakEvenProbability', () => {
  it('returns 1/6 for payout=5', () => {
    expect(approxEq(breakEvenProbability(5), 1 / 6)).toBe(true);
  });

  it('returns 1/4 for payout=3', () => {
    expect(approxEq(breakEvenProbability(3), 0.25)).toBe(true);
  });

  it('returns 1/3 for payout=2', () => {
    expect(approxEq(breakEvenProbability(2), 1 / 3)).toBe(true);
  });

  it('EV is exactly 0 at break-even probability', () => {
    const payout = 5;
    const p = breakEvenProbability(payout);
    const ev = p * (payout + 1) - 1;
    expect(approxEq(ev, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// marginAboveBreakEven
// ---------------------------------------------------------------------------

describe('marginAboveBreakEven', () => {
  it('is positive when above break-even', () => {
    expect(marginAboveBreakEven(0.5, 5)).toBeGreaterThan(0);
  });

  it('is negative when below break-even', () => {
    expect(marginAboveBreakEven(0.1, 5)).toBeLessThan(0);
  });

  it('is 0 exactly at break-even', () => {
    expect(approxEq(marginAboveBreakEven(1 / 6, 5), 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeLegBetEVs
// ---------------------------------------------------------------------------

describe('computeLegBetEVs', () => {
  it('uses the formula EV = P×(payout+1) − 1', () => {
    const probs: LegWinProbabilities = {
      blue: 0.5, green: 0.5, yellow: 0.5, purple: 0.5, pink: 0.5,
    };
    const stacks = createLegBetStacks(); // [5,3,2] each
    const evs = computeLegBetEVs(probs, stacks);

    // payout=5, P=0.5 → EV = 0.5×6 − 1 = 2
    CAMEL_COLORS.forEach((c) => {
      expect(approxEq(evs[c]!, 2)).toBe(true);
    });
  });

  it('returns null when a camel has no tiles left', () => {
    const probs = uniformProbs();
    const stacks = createLegBetStacks();
    stacks['blue'] = []; // exhausted

    const evs = computeLegBetEVs(probs, stacks);
    expect(evs['blue']).toBeNull();
  });

  it('uses the next (top) tile in the stack, not a later one', () => {
    const probs: LegWinProbabilities = {
      blue: 0.5, green: 0.5, yellow: 0.5, purple: 0.5, pink: 0.5,
    };
    const stacks = createLegBetStacks();
    stacks['pink'] = [3, 2]; // first tile already taken; next payout = 3

    const evs = computeLegBetEVs(probs, stacks);
    // payout=3, P=0.5 → EV = 0.5×4 − 1 = 1
    expect(approxEq(evs['pink']!, 1)).toBe(true);
  });

  it('can return negative EV for low-probability camels', () => {
    const probs = badBetProbs();
    const stacks = createLegBetStacks();
    const evs = computeLegBetEVs(probs, stacks);

    // payout=5, P=0.1 → EV = 0.1×6 − 1 = −0.4
    CAMEL_COLORS.forEach((c) => {
      expect(evs[c]!).toBeLessThan(0);
    });
  });

  it('returns an entry for every camel colour', () => {
    const evs = computeLegBetEVs(uniformProbs(), createLegBetStacks());
    CAMEL_COLORS.forEach((c) => {
      expect(evs).toHaveProperty(c);
    });
  });
});

// ---------------------------------------------------------------------------
// computeLegBetRecommendations
// ---------------------------------------------------------------------------

describe('computeLegBetRecommendations', () => {
  it('returns 5 entries (one per camel)', () => {
    const recs = computeLegBetRecommendations(uniformProbs(), createLegBetStacks());
    expect(recs).toHaveLength(5);
  });

  it('sorts entries by EV descending', () => {
    const probs: LegWinProbabilities = {
      purple: 0.05,
      green: 0.1,
      blue: 0.4,
      yellow: 0.2,
      pink: 0.8,
    };
    const stacks = createLegBetStacks();
    const recs = computeLegBetRecommendations(probs, stacks);

    for (let i = 0; i < recs.length - 1; i++) {
      const evA = recs[i].ev;
      const evB = recs[i + 1].ev;
      if (evA !== null && evB !== null) {
        expect(evA).toBeGreaterThanOrEqual(evB);
      }
    }
  });

  it('puts null-EV camels (no tiles) at the end', () => {
    const probs = uniformProbs();
    const stacks = createLegBetStacks();
    stacks['purple'] = [];
    stacks['green'] = [];

    const recs = computeLegBetRecommendations(probs, stacks);
    const nullEntries = recs.filter((r) => r.ev === null);
    const nonNullEntries = recs.filter((r) => r.ev !== null);

    // All non-null should come before null entries in the sorted array
    const firstNullIdx = recs.findIndex((r) => r.ev === null);
    const lastNonNullIdx = recs.map((r) => r.ev !== null).lastIndexOf(true);
    expect(firstNullIdx).toBeGreaterThan(lastNonNullIdx);
    expect(nullEntries).toHaveLength(2);
    expect(nonNullEntries).toHaveLength(3);
  });

  it('carries correct winProbability and availablePayout on each entry', () => {
    const probs: LegWinProbabilities = {
      purple: 0.3, green: 0.2, blue: 0.1, yellow: 0.25, pink: 0.15,
    };
    const stacks = createLegBetStacks();

    const recs = computeLegBetRecommendations(probs, stacks);
    recs.forEach((r) => {
      expect(r.winProbability).toBe(probs[r.camel]);
      expect(r.availablePayout).toBe(stacks[r.camel][0] ?? null);
    });
  });
});

// ---------------------------------------------------------------------------
// computeAllLegActions
// ---------------------------------------------------------------------------

describe('computeAllLegActions', () => {
  it('always includes the roll action', () => {
    const actions = computeAllLegActions(uniformProbs(), createLegBetStacks());
    expect(actions.some((a) => a.type === 'roll')).toBe(true);
  });

  it('roll action has ev=1 and stdDev=0', () => {
    const actions = computeAllLegActions(uniformProbs(), createLegBetStacks());
    const roll = actions.find((a) => a.type === 'roll')!;
    expect(roll.ev).toBe(1);
    expect(roll.stdDev).toBe(0);
  });

  it('includes one bet action per camel with tiles remaining', () => {
    const stacks = createLegBetStacks();
    stacks['blue'] = []; // no tiles for blue
    const actions = computeAllLegActions(uniformProbs(), stacks);
    const bets = actions.filter((a) => a.type === 'bet');
    expect(bets).toHaveLength(4); // 4 camels with tiles
  });

  it('marks beatsRoll=true only when EV > 1', () => {
    const probs: LegWinProbabilities = {
      purple: 0.5,   // EV = 0.5×6−1 = 2 → beats roll
      green: 0.2,   // EV = 0.2×6−1 = 0.2 → does NOT beat roll
      blue: 0.2,
      yellow: 0.2,
      pink: 0.2,
    };
    const actions = computeAllLegActions(probs, createLegBetStacks());
    const bets = actions.filter((a) => a.type === 'bet');

    const purpleBet = bets.find((a) => a.type === 'bet' && a.camel === 'purple')!;
    expect(purpleBet.beatsRoll).toBe(true);

    const greenBet = bets.find((a) => a.type === 'bet' && a.camel === 'green')!;
    expect(greenBet.beatsRoll).toBe(false);
  });

  it('bets are sorted EV-descending before the roll action', () => {
    const actions = computeAllLegActions(singleFavouriteProbs('pink'), createLegBetStacks());
    // roll should not be index 0 since pink has very high EV
    expect(actions[0].type).toBe('bet');
    // roll should be at the end
    expect(actions[actions.length - 1].type).toBe('roll');
  });

  it('computes stdDev correctly for a 50/50 bet on payout=5', () => {
    // EV = 2, outcomes: +5 (p=0.5), −1 (p=0.5)
    // σ² = 0.5×(5−2)² + 0.5×(−1−2)² = 0.5×9 + 0.5×9 = 9; σ = 3
    const probs: LegWinProbabilities = {
      purple: 0.5, green: 0.1, blue: 0.1, yellow: 0.1, pink: 0.2,
    };
    const actions = computeAllLegActions(probs, createLegBetStacks());
    const purpleBet = actions.find((a) => a.type === 'bet' && a.camel === 'purple')!;
    expect(approxEq(purpleBet.stdDev, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getBestLegAction
// ---------------------------------------------------------------------------

describe('getBestLegAction', () => {
  it('returns a bet when a bet EV > 1 (beats rolling)', () => {
    const probs: LegWinProbabilities = {
      purple: 0.8, green: 0.05, blue: 0.05, yellow: 0.05, pink: 0.05,
    };
    const best = getBestLegAction(probs, createLegBetStacks());
    expect(best.type).toBe('bet');
  });

  it('returns the roll action when no bet beats rolling', () => {
    const best = getBestLegAction(badBetProbs(), createLegBetStacks());
    expect(best.type).toBe('roll');
  });

  it('the returned bet action is for the camel with the highest EV', () => {
    // pink has P=0.8 with payout=5 → EV = 0.8×6−1 = 3.8
    const probs = singleFavouriteProbs('pink');
    const best = getBestLegAction(probs, createLegBetStacks());
    expect(best.type).toBe('bet');
    if (best.type === 'bet') {
      expect(best.camel).toBe('pink');
    }
  });

  it('returns roll when the best bet EV exactly equals 1 (no advantage)', () => {
    // At break-even for payout=5: P = 1/6, EV = 0 < 1 → roll is better.
    // Let's make P exactly such that EV = 1: P×6−1=1 → P=2/6=1/3
    // But 1/3 EV equals roll only if EV==1. 1/3 × 6 - 1 = 1. Yes!
    const p = 1 / 3;
    const probs: LegWinProbabilities = {
      purple: p,
      green: (1 - p) / 4,
      blue: (1 - p) / 4,
      yellow: (1 - p) / 4,
      pink: (1 - p) / 4,
    };
    const best = getBestLegAction(probs, createLegBetStacks());
    // EV of white bet = 1, which is NOT strictly greater than roll's EV of 1
    // so getBestLegAction should return roll (not beatsRoll when EV = 1)
    expect(best.type).toBe('roll');
  });
});

// ---------------------------------------------------------------------------
// ROLL_ACTION constant
// ---------------------------------------------------------------------------

describe('ROLL_ACTION', () => {
  it('has type roll, ev=1, stdDev=0', () => {
    expect(ROLL_ACTION).toEqual({ type: 'roll', ev: 1, stdDev: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeLegBetEVs — extreme / boundary probabilities
// ---------------------------------------------------------------------------

describe('computeLegBetEVs — boundary probabilities', () => {
  it('EV = −1 when P=0 for all camels (always wrong, always pay 1 coin)', () => {
    const probs: LegWinProbabilities = {
      blue: 0, green: 0, yellow: 0, purple: 0, pink: 0,
    };
    const stacks = createLegBetStacks(); // payout=5 each
    const evs = computeLegBetEVs(probs, stacks);
    CAMEL_COLORS.forEach((c) => {
      // EV = 0*(5+1) − 1 = −1
      expect(approxEq(evs[c]!, -1)).toBe(true);
    });
  });

  it('EV = payout − 1 when P=1 for a camel (certain winner)', () => {
    const probs: LegWinProbabilities = {
      blue: 1, green: 0, yellow: 0, purple: 0, pink: 0,
    };
    const stacks = createLegBetStacks(); // blue payout = 5
    const evs = computeLegBetEVs(probs, stacks);
    // EV = 1*(5+1) − 1 = 5
    expect(approxEq(evs['blue']!, 5)).toBe(true);
  });

  it('EV correctly reflects third-tier tile payout=2 when first two claimed', () => {
    const probs: LegWinProbabilities = {
      blue: 0.5, green: 0, yellow: 0, purple: 0, pink: 0,
    };
    const stacks = createLegBetStacks();
    stacks['blue'] = [2]; // only last tile remains
    const evs = computeLegBetEVs(probs, stacks);
    // EV = 0.5*(2+1) − 1 = 0.5
    expect(approxEq(evs['blue']!, 0.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeAllLegActions — stdDev edge cases
// ---------------------------------------------------------------------------

describe('computeAllLegActions — stdDev edge cases', () => {
  it('stdDev = 0 when P=0 (outcome is always −1, no variance)', () => {
    const probs: LegWinProbabilities = {
      blue: 0, green: 0, yellow: 0, purple: 0, pink: 0,
    };
    const actions = computeAllLegActions(probs, createLegBetStacks());
    actions
      .filter((a) => a.type === 'bet')
      .forEach((a) => {
        expect(approxEq(a.stdDev, 0)).toBe(true);
      });
  });

  it('stdDev = 0 when P=1 (outcome is always payout, no variance)', () => {
    const probs: LegWinProbabilities = {
      blue: 1, green: 0, yellow: 0, purple: 0, pink: 0,
    };
    const actions = computeAllLegActions(probs, createLegBetStacks());
    const blueBet = actions.find((a) => a.type === 'bet' && a.camel === 'blue')!;
    expect(approxEq(blueBet.stdDev, 0)).toBe(true);
  });

  it('returns only the roll action when all leg-bet stacks are exhausted', () => {
    const stacks = createLegBetStacks();
    CAMEL_COLORS.forEach((c) => { stacks[c] = []; });
    const actions = computeAllLegActions(uniformProbs(), stacks);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('roll');
  });
});

// ---------------------------------------------------------------------------
// getBestLegAction — all stacks empty
// ---------------------------------------------------------------------------

describe('getBestLegAction — all stacks empty', () => {
  it('returns roll when no bet tiles remain', () => {
    const stacks = createLegBetStacks();
    CAMEL_COLORS.forEach((c) => { stacks[c] = []; });
    const best = getBestLegAction(uniformProbs(), stacks);
    expect(best.type).toBe('roll');
  });
});

// ---------------------------------------------------------------------------
// breakEvenProbability — edge payouts
// ---------------------------------------------------------------------------

describe('breakEvenProbability — edge payouts', () => {
  it('payout=0 requires P=1 to break even (pay nothing, receive nothing on loss)', () => {
    // A "free" bet with payout=0: EV = P*(0+1) − 1 = P − 1. Break even at P=1.
    expect(approxEq(breakEvenProbability(0), 1)).toBe(true);
  });

  it('payout=1 requires P=0.5', () => {
    expect(approxEq(breakEvenProbability(1), 0.5)).toBe(true);
  });

  it('break-even probability is always in (0, 1] for non-negative payouts', () => {
    [0, 1, 2, 3, 5, 10].forEach((payout) => {
      const p = breakEvenProbability(payout);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });
});
