import { describe, it, expect } from 'vitest';
import {
  runSimulation,
  makePrng,
  rankByWinProbability,
  getMostLikelyRaceWinner,
  getMostLikelyRaceLoser,
} from './simulator';
import { createEmptyTrack, CAMEL_COLORS } from './constants';
import { placeCamel } from './movement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED = 42; // fixed seed for reproducible statistical tests
// 10k sims → stdErr ≈ 0.005 for a 50/50 split; allow 5% tolerance
const STAT_TOLERANCE = 0.05;

function sumRecord(r: Record<string, number>): number {
  return Object.values(r).reduce((s, v) => s + v, 0);
}

function approxEq(a: number, b: number, tol = STAT_TOLERANCE) {
  return Math.abs(a - b) <= tol;
}

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

describe('makePrng', () => {
  it('same seed produces same sequence', () => {
    const rng1 = makePrng(SEED);
    const rng2 = makePrng(SEED);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = makePrng(1);
    const rng2 = makePrng(2);
    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());
    // highly unlikely to be identical
    expect(seq1).not.toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rng = makePrng(SEED);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// runSimulation — structural guarantees
// ---------------------------------------------------------------------------

describe('runSimulation — structure', () => {
  function basicTrack() {
    let t = createEmptyTrack();
    t = placeCamel(t, 'purple', 0);
    t = placeCamel(t, 'green', 1);
    t = placeCamel(t, 'blue', 2);
    t = placeCamel(t, 'yellow', 3);
    t = placeCamel(t, 'pink', 4);
    return t;
  }

  it('returns an entry for every camel in winProbabilities', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 500, SEED);
    CAMEL_COLORS.forEach((c) => {
      expect(result.winProbabilities).toHaveProperty(c);
    });
  });

  it('returns an entry for every camel in loseProbabilities', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 500, SEED);
    CAMEL_COLORS.forEach((c) => {
      expect(result.loseProbabilities).toHaveProperty(c);
    });
  });

  it('win probabilities sum to ≈1', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 1000, SEED);
    expect(approxEq(sumRecord(result.winProbabilities), 1, 0.001)).toBe(true);
  });

  it('lose probabilities sum to ≈1', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 1000, SEED);
    expect(approxEq(sumRecord(result.loseProbabilities), 1, 0.001)).toBe(true);
  });

  it('all probabilities are in [0, 1]', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 500, SEED);
    CAMEL_COLORS.forEach((c) => {
      expect(result.winProbabilities[c]).toBeGreaterThanOrEqual(0);
      expect(result.winProbabilities[c]).toBeLessThanOrEqual(1);
      expect(result.loseProbabilities[c]).toBeGreaterThanOrEqual(0);
      expect(result.loseProbabilities[c]).toBeLessThanOrEqual(1);
    });
  });

  it('reports correct totalSimulations', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 300, SEED);
    expect(result.totalSimulations).toBe(300);
  });

  it('reports the seed used', () => {
    const result = runSimulation(basicTrack(), [...CAMEL_COLORS], 100, SEED);
    expect(result.seed).toBe(SEED);
  });

  it('is reproducible with the same seed', () => {
    const track = basicTrack();
    const r1 = runSimulation(track, [...CAMEL_COLORS], 500, SEED);
    const r2 = runSimulation(track, [...CAMEL_COLORS], 500, SEED);
    CAMEL_COLORS.forEach((c) => {
      expect(r1.winProbabilities[c]).toBe(r2.winProbabilities[c]);
      expect(r1.loseProbabilities[c]).toBe(r2.loseProbabilities[c]);
    });
  });
});

// ---------------------------------------------------------------------------
// runSimulation — statistical behaviour
// ---------------------------------------------------------------------------

describe('runSimulation — statistical behaviour', () => {
  it('camel furthest ahead has highest win probability', () => {
    // pink is far ahead: space 12 vs others at 0–3
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 12);

    const result = runSimulation(track, [...CAMEL_COLORS], 5000, SEED);

    const pinkWin = result.winProbabilities['pink'];
    CAMEL_COLORS.filter((c) => c !== 'pink').forEach((c) => {
      expect(pinkWin).toBeGreaterThan(result.winProbabilities[c]);
    });
  });

  it('camel furthest behind has highest lose probability', () => {
    // purple is far behind: space 0 vs others at 9–12
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 9);
    track = placeCamel(track, 'blue', 10);
    track = placeCamel(track, 'yellow', 11);
    track = placeCamel(track, 'pink', 12);

    const result = runSimulation(track, [...CAMEL_COLORS], 5000, SEED);

    const purpleLose = result.loseProbabilities['purple'];
    CAMEL_COLORS.filter((c) => c !== 'purple').forEach((c) => {
      expect(purpleLose).toBeGreaterThan(result.loseProbabilities[c]);
    });
  });

  it('camel 1 step from finish wins with very high probability', () => {
    // pink at space 15 (last space before finish), all dice unrolled
    // pink only needs to roll ≥1 on its die to finish — P(win) is very high
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 14);

    const result = runSimulation(track, [...CAMEL_COLORS], 5000, SEED);
    expect(result.winProbabilities['pink']).toBeGreaterThan(0.6);
  });

  it('when current dice pool is empty, starts the next leg correctly', () => {
    // Pool is empty — the simulator should begin a fresh leg for all camels
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 4);
    track = placeCamel(track, 'yellow', 6);
    track = placeCamel(track, 'pink', 8);

    // Empty pool = leg already over, next leg hasn't started
    const result = runSimulation(track, [], 2000, SEED);

    // Probabilities should still sum to ≈1 (Monte Carlo tolerance 2%)
    expect(approxEq(sumRecord(result.winProbabilities), 1, 0.02)).toBe(true);
    expect(approxEq(sumRecord(result.loseProbabilities), 1, 0.02)).toBe(true);
  });

  it('symmetric spread gives roughly equal probabilities', () => {
    // All 5 camels one space apart — no camel should dominate
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 5);
    track = placeCamel(track, 'green', 6);
    track = placeCamel(track, 'blue', 7);
    track = placeCamel(track, 'yellow', 8);
    track = placeCamel(track, 'pink', 9);

    const result = runSimulation(track, [...CAMEL_COLORS], 10_000, SEED);

    // The overall winner could be anyone; no camel should have <5% or >60%
    CAMEL_COLORS.forEach((c) => {
      expect(result.winProbabilities[c]).toBeGreaterThan(0.05);
      expect(result.winProbabilities[c]).toBeLessThan(0.60);
    });
  });
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

describe('rankByWinProbability', () => {
  it('returns one entry per camel in the result, sorted by win probability', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 3);
    track = placeCamel(track, 'blue', 6);
    track = placeCamel(track, 'yellow', 9);
    track = placeCamel(track, 'pink', 12);

    const result = runSimulation(track, [...CAMEL_COLORS], 2000, SEED);
    const ranked = rankByWinProbability(result);

    // Now includes all 7 colours (5 forward + 2 crazy at 0 probability).
    expect(ranked).toHaveLength(7);
    for (let i = 0; i < 4; i++) {
      expect(ranked[i].winProbability).toBeGreaterThanOrEqual(
        ranked[i + 1].winProbability
      );
    }
  });

  it('each entry carries both winProbability and loseProbability', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i * 2); });

    const result = runSimulation(track, [...CAMEL_COLORS], 500, SEED);
    const ranked = rankByWinProbability(result);

    ranked.forEach(({ camel, winProbability, loseProbability }) => {
      expect(winProbability).toBe(result.winProbabilities[camel]);
      expect(loseProbability).toBe(result.loseProbabilities[camel]);
    });
  });
});

describe('getMostLikelyRaceWinner', () => {
  it('returns the camel far ahead as the likely winner', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 1);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 3);
    track = placeCamel(track, 'pink', 13);

    const result = runSimulation(track, [...CAMEL_COLORS], 5000, SEED);
    expect(getMostLikelyRaceWinner(result)).toBe('pink');
  });
});

describe('getMostLikelyRaceLoser', () => {
  it('returns the camel far behind as the likely loser', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    track = placeCamel(track, 'green', 8);
    track = placeCamel(track, 'blue', 9);
    track = placeCamel(track, 'yellow', 10);
    track = placeCamel(track, 'pink', 11);

    const result = runSimulation(track, [...CAMEL_COLORS], 5000, SEED);
    expect(getMostLikelyRaceLoser(result)).toBe('purple');
  });
});

// ---------------------------------------------------------------------------
// runSimulation — edge cases
// ---------------------------------------------------------------------------

describe('runSimulation — 0 simulations', () => {
  it('returns all-zero win/lose probabilities (no NaN)', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i); });
    const result = runSimulation(track, [...CAMEL_COLORS], 0, SEED);

    expect(result.totalSimulations).toBe(0);
    Object.values(result.winProbabilities).forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBe(0);
    });
    Object.values(result.loseProbabilities).forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBe(0);
    });
  });
});

describe('runSimulation — 1 simulation', () => {
  it('returns exactly one game outcome: exactly one camel wins and one loses', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i); });
    const result = runSimulation(track, [...CAMEL_COLORS], 1, SEED);

    expect(result.totalSimulations).toBe(1);
    // Exactly one camel has winProbability=1, rest=0.
    const winValues = Object.values(result.winProbabilities);
    expect(winValues.filter((p) => p === 1)).toHaveLength(1);
    expect(winValues.filter((p) => p === 0).length).toBeGreaterThan(0);
  });
});

describe('makePrng — seed 0', () => {
  it('seed 0 produces a valid sequence in [0, 1)', () => {
    const rng = makePrng(0);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seed 0 is deterministic (same result on second invocation)', () => {
    const rng1 = makePrng(0);
    const rng2 = makePrng(0);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });
});

describe('runSimulation — crazy camel on track', () => {
  it('win probabilities contain no NaN when black is on the track', () => {
    // Black starts behind all forward camels — it will often be last.
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i + 2); });

    const result = runSimulation(track, [...CAMEL_COLORS], 200, SEED);

    Object.values(result.winProbabilities).forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
    });
    Object.values(result.loseProbabilities).forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
    });
  });

  it('win+lose probabilities sum to ≈1 even with a crazy camel present', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'white', 0);
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i + 3); });

    const result = runSimulation(track, [...CAMEL_COLORS], 1000, SEED);

    expect(approxEq(sumRecord(result.winProbabilities), 1, 0.02)).toBe(true);
    expect(approxEq(sumRecord(result.loseProbabilities), 1, 0.02)).toBe(true);
  });

  it('result has entries for black and white', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i + 1); });

    const result = runSimulation(track, [...CAMEL_COLORS], 100, SEED);
    expect(result.winProbabilities).toHaveProperty('black');
    expect(result.winProbabilities).toHaveProperty('white');
    expect(result.loseProbabilities).toHaveProperty('black');
    expect(result.loseProbabilities).toHaveProperty('white');
  });
});

describe('rankByWinProbability — includes all 7 colours', () => {
  it('result contains entries for both crazy camels when none are on board', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i); });
    const result = runSimulation(track, [...CAMEL_COLORS], 200, SEED);
    const ranked = rankByWinProbability(result);

    const camels = ranked.map((r) => r.camel);
    expect(camels).toContain('black');
    expect(camels).toContain('white');
  });

  it('crazy camels have win/lose probability of 0 when not on the board', () => {
    let track = createEmptyTrack();
    CAMEL_COLORS.forEach((c, i) => { track = placeCamel(track, c, i); });
    const result = runSimulation(track, [...CAMEL_COLORS], 500, SEED);

    expect(result.winProbabilities['black']).toBe(0);
    expect(result.winProbabilities['white']).toBe(0);
  });
});
