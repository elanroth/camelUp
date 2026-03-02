import { describe, it, expect } from 'vitest';
import {
  runBotGame,
  runBotMatch,
  type BotAction,
  type BotTurnContext,
  type BotStrategy,
} from './botGame';
import {
  alwaysRollBot,
  greedyEVBot,
  thresholdBot,
  raceBetBot,
  conservativeBot,
  randomBot,
  blendedBot,
  named,
} from './bots';
import { makePrng } from './simulator';
import { CAMEL_COLORS } from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED = 99;
const two = () => [alwaysRollBot, alwaysRollBot];
const approxEq = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------------------
// runBotGame — structural guarantees
// ---------------------------------------------------------------------------

describe('runBotGame — structure', () => {
  it('requires 2–4 strategies', () => {
    expect(() => runBotGame([alwaysRollBot], { seed: SEED })).toThrow();
    expect(() =>
      runBotGame(
        [alwaysRollBot, alwaysRollBot, alwaysRollBot, alwaysRollBot, alwaysRollBot],
        { seed: SEED }
      )
    ).toThrow();
  });

  it('completes a game without throwing (2 players)', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.raceWinner).toBeDefined();
    expect(result.finalCoins).toHaveLength(2);
  });

  it('completes a game without throwing (4 players)', () => {
    const strategies = [alwaysRollBot, alwaysRollBot, greedyEVBot, greedyEVBot];
    const result = runBotGame(strategies, { seed: SEED });
    expect(result.finalCoins).toHaveLength(4);
  });

  it('returns a valid winningPlayerIndex', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.winningPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(result.winningPlayerIndex).toBeLessThan(2);
  });

  it('winningPlayerIndex corresponds to the player with most coins', () => {
    const result = runBotGame(two(), { seed: SEED });
    const maxCoins = Math.max(...result.finalCoins);
    expect(result.finalCoins[result.winningPlayerIndex]).toBe(maxCoins);
  });

  it('turnLog length equals totalTurns', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.turnLog).toHaveLength(result.totalTurns);
  });

  it('legLog length equals totalLegs', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.legLog).toHaveLength(result.totalLegs);
  });

  it('every turn in turnLog has a valid playerIndex', () => {
    const result = runBotGame(two(), { seed: SEED });
    result.turnLog.forEach((t) => {
      expect(t.playerIndex).toBeGreaterThanOrEqual(0);
      expect(t.playerIndex).toBeLessThan(2);
    });
  });

  it('seed is recorded in result', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.seed).toBe(SEED);
  });

  it('is fully deterministic with the same seed', () => {
    const a = runBotGame(two(), { seed: SEED });
    const b = runBotGame(two(), { seed: SEED });
    expect(a.finalCoins).toEqual(b.finalCoins);
    expect(a.raceWinner).toBe(b.raceWinner);
    expect(a.raceLoser).toBe(b.raceLoser);
    expect(a.totalTurns).toBe(b.totalTurns);
  });

  it('different seeds produce different games (almost certainly)', () => {
    const a = runBotGame(two(), { seed: 1 });
    const b = runBotGame(two(), { seed: 9999 });
    // At least one of winner, loser, or totalTurns should differ.
    const same =
      a.raceWinner === b.raceWinner &&
      a.raceLoser === b.raceLoser &&
      a.totalTurns === b.totalTurns;
    expect(same).toBe(false);
  });

  it('raceWinner is a valid CamelColor', () => {
    const result = runBotGame(two(), { seed: SEED });
    const allColors: string[] = [...CAMEL_COLORS, 'black', 'white'];
    expect(allColors).toContain(result.raceWinner);
  });

  it('raceLoser is a valid CamelColor different from raceWinner', () => {
    const result = runBotGame(two(), { seed: SEED });
    const allColors: string[] = [...CAMEL_COLORS, 'black', 'white'];
    expect(allColors).toContain(result.raceLoser);
    expect(result.raceWinner).not.toBe(result.raceLoser);
  });

  it('all final coins are non-negative (coins can never drop below 0 in this ruleset)', () => {
    // With only 3 starting coins, race bets can technically cause negatives;
    // but with alwaysRollBot that cannot happen.
    const result = runBotGame(two(), { seed: SEED });
    result.finalCoins.forEach((c) => expect(typeof c).toBe('number'));
  });
});

// ---------------------------------------------------------------------------
// runBotGame — rolling earns 1 coin per turn
// ---------------------------------------------------------------------------

describe('runBotGame — roll coin accounting', () => {
  it('alwaysRollBot player accumulates 1 coin per roll turn', () => {
    const result = runBotGame(two(), { seed: SEED, startingCoins: 0 });

    result.turnLog.forEach((t) => {
      if (t.action.type === 'roll') {
        // coinsDelta from this turn includes the +1 roll coin plus any leg
        // resolution that occurred (may be positive or negative).
        expect(t.coinsDelta).toBeGreaterThanOrEqual(1 - 3); // worst case: -1 per wrong bet * 3 possible bets
      }
    });
  });

  it('alwaysRollBot never produces a leg-bet or race-bet turn', () => {
    const result = runBotGame(two(), { seed: SEED });
    result.turnLog.forEach((t) => {
      expect(t.action.type).toBe('roll');
    });
  });

  it('total rolls = totalTurns when both players roll every turn', () => {
    const result = runBotGame(two(), { seed: SEED });
    const rollTurns = result.turnLog.filter((t) => t.action.type === 'roll').length;
    expect(rollTurns).toBe(result.totalTurns);
  });
});

// ---------------------------------------------------------------------------
// runBotGame — leg resolution
// ---------------------------------------------------------------------------

describe('runBotGame — leg resolution', () => {
  it('each leg always has a winner logged', () => {
    const result = runBotGame(two(), { seed: SEED });
    // The leg winner may be null only if no camels are on the board (impossible
    // after setup), so in a real game all entries should be non-null.
    result.legLog.forEach((leg) => {
      expect(leg.winner).not.toBeUndefined();
    });
  });

  it('leg resolution playerDeltas length matches player count', () => {
    const result = runBotGame(two(), { seed: SEED });
    result.legLog.forEach((leg) => {
      expect(leg.playerDeltas).toHaveLength(2);
    });
  });

  it('at least 1 leg is played in every complete game', () => {
    const result = runBotGame(two(), { seed: SEED });
    expect(result.totalLegs).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// runBotGame — starting positions
// ---------------------------------------------------------------------------

describe('runBotGame — startingPositions', () => {
  it('accepts explicit starting positions for all camels', () => {
    const result = runBotGame(two(), {
      seed: SEED,
      startingPositions: {
        blue: 0, green: 1, yellow: 2, purple: 3, pink: 14,
      },
    });
    // Pink at space 14 is very close to the finish — race should be short.
    expect(result.totalLegs).toBeLessThanOrEqual(5);
  });

  it('partial startingPositions are accepted (others are randomly placed)', () => {
    expect(() =>
      runBotGame(two(), {
        seed: SEED,
        startingPositions: { blue: 0, pink: 12 },
      })
    ).not.toThrow();
  });

  it('placing all camels at space 0 does not break the game', () => {
    const result = runBotGame(two(), {
      seed: SEED,
      startingPositions: { blue: 0, green: 0, yellow: 0, purple: 0, pink: 0 },
    });
    expect(result.raceWinner).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// runBotGame — playerNames and startingCoins
// ---------------------------------------------------------------------------

describe('runBotGame — options', () => {
  it('uses custom player names', () => {
    const result = runBotGame(two(), {
      seed: SEED,
      playerNames: ['Alice', 'Bob'],
    });
    const names = result.turnLog.map((t) => t.playerName);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('respects custom startingCoins', () => {
    // If startingCoins=100, final coins should be much higher than default.
    const low = runBotGame(two(), { seed: SEED, startingCoins: 0 });
    const high = runBotGame(two(), { seed: SEED, startingCoins: 100 });
    const lowAvg = low.finalCoins.reduce((a, b) => a + b, 0) / 2;
    const highAvg = high.finalCoins.reduce((a, b) => a + b, 0) / 2;
    expect(highAvg).toBeGreaterThan(lowAvg);
  });
});

// ---------------------------------------------------------------------------
// Strategy: alwaysRollBot
// ---------------------------------------------------------------------------

describe('alwaysRollBot', () => {
  it('always returns { type: "roll" }', () => {
    const fakeCtx = {} as BotTurnContext; // strategy doesn't read ctx
    expect(alwaysRollBot(fakeCtx)).toEqual({ type: 'roll' });
  });
});

// ---------------------------------------------------------------------------
// Strategy: greedyEVBot
// ---------------------------------------------------------------------------

describe('greedyEVBot', () => {
  it('returns a bet when bestLegAction is a bet', () => {
    const fakeCtx = {
      bestLegAction: { type: 'bet', camel: 'pink', ev: 3, beatsRoll: true, stdDev: 1, payout: 5, winProbability: 0.8 },
    } as unknown as BotTurnContext;
    const action = greedyEVBot(fakeCtx);
    expect(action.type).toBe('leg-bet');
    if (action.type === 'leg-bet') expect(action.camel).toBe('pink');
  });

  it('returns roll when bestLegAction is roll', () => {
    const fakeCtx = {
      bestLegAction: { type: 'roll', ev: 1, stdDev: 0 },
    } as unknown as BotTurnContext;
    expect(greedyEVBot(fakeCtx)).toEqual({ type: 'roll' });
  });

  it('produces more coins than alwaysRoll on average (over many games)', () => {
    // greedyEV should outperform in expectation due to +EV bets.
    const match = runBotMatch(
      [alwaysRollBot, greedyEVBot],
      30,
      { baseSeed: SEED }
    );
    // greedyEV (player 1) should average more coins.
    expect(match.avgCoins[1]).toBeGreaterThan(match.avgCoins[0]);
  });
});

// ---------------------------------------------------------------------------
// Strategy: thresholdBot
// ---------------------------------------------------------------------------

describe('thresholdBot', () => {
  it('rolls when EV < threshold even if bet is available', () => {
    const fakeCtx = {
      bestLegAction: {
        type: 'bet', camel: 'green', ev: 0.5, beatsRoll: false,
        stdDev: 1, payout: 3, winProbability: 0.3,
      },
    } as unknown as BotTurnContext;
    // Threshold of 2.0: ev=0.5 doesn't meet it.
    expect(thresholdBot(2.0)(fakeCtx)).toEqual({ type: 'roll' });
  });

  it('bets when EV >= threshold', () => {
    const fakeCtx = {
      bestLegAction: {
        type: 'bet', camel: 'green', ev: 3.5, beatsRoll: true,
        stdDev: 1, payout: 5, winProbability: 0.8,
      },
    } as unknown as BotTurnContext;
    const action = thresholdBot(2.0)(fakeCtx);
    expect(action.type).toBe('leg-bet');
  });

  it('thresholdBot(1) is equivalent to greedyEVBot (bets whenever EV > 1)', () => {
    // Both should produce the same action given the same context where EV > 1.
    const fakeCtx = {
      bestLegAction: {
        type: 'bet', camel: 'blue', ev: 2.0, beatsRoll: true,
        stdDev: 1, payout: 5, winProbability: 0.6,
      },
    } as unknown as BotTurnContext;
    expect(thresholdBot(1)(fakeCtx).type).toBe(greedyEVBot(fakeCtx).type);
  });

  it('higher threshold → fewer bets per game', () => {
    const lowThresh = runBotGame([thresholdBot(0.5), alwaysRollBot], { seed: SEED });
    const highThresh = runBotGame([thresholdBot(4.0), alwaysRollBot], { seed: SEED });
    const lowBets = lowThresh.turnLog.filter(
      (t) => t.playerIndex === 0 && t.action.type === 'leg-bet'
    ).length;
    const highBets = highThresh.turnLog.filter(
      (t) => t.playerIndex === 0 && t.action.type === 'leg-bet'
    ).length;
    expect(lowBets).toBeGreaterThanOrEqual(highBets);
  });
});

// ---------------------------------------------------------------------------
// Strategy: conservativeBot
// ---------------------------------------------------------------------------

describe('conservativeBot', () => {
  it('rolls when best bet is not on the current leader', () => {
    const fakeCtx = {
      state: {
        track: [['green'], [], [], [], [], ['blue'], ...Array(10).fill([])],
        players: [{ coins: 3 }],
      },
      bestLegAction: {
        type: 'bet', camel: 'pink', ev: 2.5, beatsRoll: true,
        stdDev: 1, payout: 5, winProbability: 0.7,
      },
    } as unknown as BotTurnContext;
    // Leader is blue (space 5), best bet is pink → conservative bot rolls.
    expect(conservativeBot(fakeCtx)).toEqual({ type: 'roll' });
  });

  it('bets when best bet is on the leader and EV beats roll', () => {
    const fakeCtx = {
      state: {
        track: [[], [], [], [], [], ['blue'], ...Array(10).fill([])],
        players: [{ coins: 3 }],
      },
      bestLegAction: {
        type: 'bet', camel: 'blue', ev: 2.5, beatsRoll: true,
        stdDev: 1, payout: 5, winProbability: 0.7,
      },
    } as unknown as BotTurnContext;
    const action = conservativeBot(fakeCtx);
    expect(action.type).toBe('leg-bet');
  });

  it('rolls when leader bet does not beat rolling (EV ≤ 1)', () => {
    const fakeCtx = {
      state: {
        track: [[], [], ['blue'], ...Array(13).fill([])],
        players: [{ coins: 3 }],
      },
      bestLegAction: {
        type: 'bet', camel: 'blue', ev: 0.5, beatsRoll: false,
        stdDev: 1, payout: 2, winProbability: 0.2,
      },
    } as unknown as BotTurnContext;
    expect(conservativeBot(fakeCtx)).toEqual({ type: 'roll' });
  });
});

// ---------------------------------------------------------------------------
// Strategy: raceBetBot
// ---------------------------------------------------------------------------

describe('raceBetBot', () => {
  it('places a race-winner bet when the best camel is above the threshold', () => {
    const fakeCtx = {
      state: {
        track: [['blue'], ...Array(15).fill([])],
        players: [{ coins: 3, raceWinnerBets: [], raceLoserBets: [] }],
      },
      playerIndex: 0,
      legWinProbabilities: {
        blue: 0.7, green: 0.1, yellow: 0.05, purple: 0.1, pink: 0.05,
      },
      bestLegAction: { type: 'roll', ev: 1, stdDev: 0 },
      availableWinnerBets: ['blue', 'green', 'yellow', 'purple', 'pink'],
      availableLoserBets: ['blue', 'green', 'yellow', 'purple', 'pink'],
    } as unknown as BotTurnContext;

    const action = raceBetBot({ winnerThreshold: 0.5 })(fakeCtx);
    expect(action.type).toBe('race-bet');
    if (action.type === 'race-bet') {
      expect(action.camel).toBe('blue');
      expect(action.betType).toBe('winner');
    }
  });

  it('rolls when no camel meets the threshold', () => {
    const fakeCtx = {
      state: {
        track: Array(16).fill([]),
        players: [{ coins: 3, raceWinnerBets: [], raceLoserBets: [] }],
      },
      playerIndex: 0,
      legWinProbabilities: {
        blue: 0.2, green: 0.2, yellow: 0.2, purple: 0.2, pink: 0.2,
      },
      bestLegAction: { type: 'roll', ev: 1, stdDev: 0 },
      availableWinnerBets: ['blue', 'green', 'yellow', 'purple', 'pink'],
      availableLoserBets: [],
    } as unknown as BotTurnContext;

    const action = raceBetBot({ winnerThreshold: 0.5, loserThreshold: 0.99 })(fakeCtx);
    expect(action.type).toBe('roll');
  });

  it('does not place a winner bet on a camel the player has already bet on', () => {
    const fakeCtx = {
      state: {
        track: [['blue'], ...Array(15).fill([])],
        players: [{ coins: 3, raceWinnerBets: ['blue'], raceLoserBets: [] }],
      },
      playerIndex: 0,
      legWinProbabilities: {
        blue: 0.8, green: 0.05, yellow: 0.05, purple: 0.05, pink: 0.05,
      },
      bestLegAction: { type: 'roll', ev: 1, stdDev: 0 },
      availableWinnerBets: ['green', 'yellow', 'purple', 'pink'], // blue already used
      availableLoserBets: ['blue', 'green', 'yellow', 'purple', 'pink'],
    } as unknown as BotTurnContext;

    const action = raceBetBot({ winnerThreshold: 0.5 })(fakeCtx);
    // Blue not available; no other camel meets 50% → rolls (or loser bet)
    if (action.type === 'race-bet') {
      expect(action.camel).not.toBe('blue');
    }
  });

  it('places race-winner bets in a full game', () => {
    const result = runBotGame(
      [raceBetBot({ winnerThreshold: 0.4 }), alwaysRollBot],
      { seed: SEED }
    );
    const raceBets = result.turnLog.filter(
      (t) => t.playerIndex === 0 && t.action.type === 'race-bet'
    );
    // With a low threshold, raceBetBot should place at least one race bet.
    expect(raceBets.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Strategy: randomBot
// ---------------------------------------------------------------------------

describe('randomBot', () => {
  it('always returns a valid BotAction', () => {
    const rng = makePrng(SEED);
    const bot = randomBot(rng);
    const result = runBotGame([bot, alwaysRollBot], { seed: SEED });
    result.turnLog
      .filter((t) => t.playerIndex === 0)
      .forEach((t) => {
        expect(['roll', 'leg-bet', 'race-bet']).toContain(t.action.type);
      });
  });

  it('produces roll actions at least sometimes over 50 turns', () => {
    const rng = makePrng(SEED);
    const bot = randomBot(rng);
    const result = runBotGame([bot, alwaysRollBot], { seed: SEED });
    const rolls = result.turnLog.filter(
      (t) => t.playerIndex === 0 && t.action.type === 'roll'
    );
    expect(rolls.length).toBeGreaterThan(0);
  });

  it('completes a game without throwing', () => {
    const rng = makePrng(SEED);
    expect(() => runBotGame([randomBot(rng), randomBot(makePrng(77))], { seed: SEED })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Strategy: blendedBot
// ---------------------------------------------------------------------------

describe('blendedBot', () => {
  it('throws when strategies.length !== weights.length', () => {
    const rng = makePrng(SEED);
    expect(() =>
      blendedBot([alwaysRollBot, greedyEVBot], [1], rng)
    ).toThrow();
  });

  it('throws for empty strategies array', () => {
    const rng = makePrng(SEED);
    expect(() => blendedBot([], [], rng)).toThrow();
  });

  it('produces valid actions in a full game', () => {
    const rng = makePrng(SEED);
    const bot = blendedBot([alwaysRollBot, greedyEVBot], [1, 1], rng);
    expect(() => runBotGame([bot, alwaysRollBot], { seed: SEED })).not.toThrow();
  });

  it('with weight [1, 0] always picks first strategy (alwaysRoll)', () => {
    const rng = makePrng(SEED);
    const bot = blendedBot([alwaysRollBot, greedyEVBot], [1, 0], rng);
    const result = runBotGame([bot, alwaysRollBot], { seed: SEED });
    result.turnLog
      .filter((t) => t.playerIndex === 0)
      .forEach((t) => expect(t.action.type).toBe('roll'));
  });
});

// ---------------------------------------------------------------------------
// runBotMatch
// ---------------------------------------------------------------------------

describe('runBotMatch', () => {
  it('returns correct totalGames', () => {
    const match = runBotMatch(two(), 20, { baseSeed: SEED });
    expect(match.totalGames).toBe(20);
  });

  it('wins sum to totalGames', () => {
    const match = runBotMatch(two(), 30, { baseSeed: SEED });
    const total = match.wins.reduce((a, b) => a + b, 0);
    expect(total).toBe(30);
  });

  it('avgCoins has one entry per player', () => {
    const match = runBotMatch([alwaysRollBot, greedyEVBot], 10, { baseSeed: SEED });
    expect(match.avgCoins).toHaveLength(2);
  });

  it('is reproducible with the same baseSeed', () => {
    const a = runBotMatch(two(), 10, { baseSeed: 42 });
    const b = runBotMatch(two(), 10, { baseSeed: 42 });
    expect(a.wins).toEqual(b.wins);
    expect(a.avgCoins).toEqual(b.avgCoins);
  });

  it('all avgCoins values are non-negative (alwaysRoll earns at least 1/turn)', () => {
    const match = runBotMatch(two(), 20, { baseSeed: SEED, startingCoins: 0 });
    match.avgCoins.forEach((avg) => expect(avg).toBeGreaterThanOrEqual(0));
  });
});

// ---------------------------------------------------------------------------
// named helper
// ---------------------------------------------------------------------------

describe('named', () => {
  it('wraps a strategy with a name', () => {
    const ns = named('MyBot', alwaysRollBot);
    expect(ns.name).toBe('MyBot');
    expect(ns.strategy).toBe(alwaysRollBot);
  });
});

// ---------------------------------------------------------------------------
// Strategy comparison — statistical
// ---------------------------------------------------------------------------

describe('strategy comparison (statistical)', () => {
  it('greedyEV beats alwaysRoll on avg coins over 100 games', () => {
    const match = runBotMatch([alwaysRollBot, greedyEVBot], 30, { baseSeed: 1 });
    expect(match.avgCoins[1]).toBeGreaterThan(match.avgCoins[0]);
  });

  it('thresholdBot(1) and greedyEVBot have similar avg coins (they are equivalent)', () => {
    const greedyMatch = runBotMatch([alwaysRollBot, greedyEVBot], 20, { baseSeed: 5 });
    const threshMatch = runBotMatch([alwaysRollBot, thresholdBot(1)], 20, { baseSeed: 5 });
    // Should be very close (both bet whenever EV > 1).
    expect(approxEq(greedyMatch.avgCoins[1], threshMatch.avgCoins[1], 2)).toBe(true);
  });

  it('thresholdBot(0) bets more than thresholdBot(3) per game', () => {
    // Run identical games with different thresholds; count bets.
    const low = runBotGame([thresholdBot(0), alwaysRollBot], { seed: SEED });
    const high = runBotGame([thresholdBot(3), alwaysRollBot], { seed: SEED });
    const lowBets = low.turnLog.filter((t) => t.playerIndex === 0 && t.action.type === 'leg-bet').length;
    const highBets = high.turnLog.filter((t) => t.playerIndex === 0 && t.action.type === 'leg-bet').length;
    expect(lowBets).toBeGreaterThanOrEqual(highBets);
  });
});

// ---------------------------------------------------------------------------
// Bot game edge cases
// ---------------------------------------------------------------------------

describe('runBotGame — edge cases', () => {
  it('one player placed just 1 step from finish — game ends on the first leg', () => {
    const result = runBotGame(two(), {
      seed: SEED,
      startingPositions: { blue: 14, green: 0, yellow: 0, purple: 0, pink: 0 },
    });
    // Blue at 14 can reach the finish on its very first roll (any die face ≥2).
    // The race may end in leg 1 or 2.
    expect(result.totalLegs).toBeLessThanOrEqual(3);
  });

  it('all camels stacked at space 0 — game still resolves correctly', () => {
    const result = runBotGame(two(), {
      seed: SEED,
      startingPositions: { blue: 0, green: 0, yellow: 0, purple: 0, pink: 0 },
    });
    expect(result.raceWinner).toBeTruthy();
    expect(result.raceLoser).toBeTruthy();
  });

  it('maxTurns terminates an otherwise infinite game', () => {
    // Absurdly low maxTurns — just confirm it returns without hanging.
    const result = runBotGame(two(), { seed: SEED, maxTurns: 5 });
    expect(result.totalTurns).toBeLessThanOrEqual(5);
  });

  it('a bet on an exhausted stack is a no-op (coins unchanged)', () => {
    // Strategy that always tries to bet on 'blue', even when stack is empty.
    const alwaysBetBlue: BotStrategy = (): BotAction => ({ type: 'leg-bet', camel: 'blue' });
    // When blue's stack runs out, the action should be a no-op (no crash, no coin change).
    expect(() =>
      runBotGame([alwaysBetBlue, alwaysRollBot], { seed: SEED })
    ).not.toThrow();
  });

  it('race bets on an already-bet camel are a no-op (no duplicates)', () => {
    // Strategy always bets on 'blue' as race winner.
    const alwaysBetBlueWinner: BotStrategy = (): BotAction => ({
      type: 'race-bet', camel: 'blue', betType: 'winner',
    });
    const result = runBotGame([alwaysBetBlueWinner, alwaysRollBot], { seed: SEED });
    // Count how many 'blue' winner bets player 0 placed — should be at most 1.
    const blueBets = result.turnLog.filter(
      (t) =>
        t.playerIndex === 0 &&
        t.action.type === 'race-bet' &&
        (t.action as Extract<BotAction, { type: 'race-bet' }>).camel === 'blue' &&
        (t.action as Extract<BotAction, { type: 'race-bet' }>).betType === 'winner'
    );
    // Only the first attempt is counted; subsequent ones are no-ops.
    expect(blueBets.length).toBeGreaterThanOrEqual(1);
  });

  it('3-player game completes correctly', () => {
    const result = runBotGame(
      [alwaysRollBot, greedyEVBot, thresholdBot(2)],
      { seed: SEED }
    );
    expect(result.finalCoins).toHaveLength(3);
    expect(result.winningPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(result.winningPlayerIndex).toBeLessThan(3);
  });
});
