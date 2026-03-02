// ---------------------------------------------------------------------------
// Camel Up 2.0 — Deterministic Bot Game Engine
//
// Provides a complete, self-contained game loop that bot strategies can be
// plugged into.  All randomness is derived from a single seeded PRNG so games
// are fully reproducible given the same seed + strategies.
//
// GAME FLOW
// ---------
//  1. Setup  – camels placed at starting positions (seeded dice rolls).
//  2. Turn   – current player's bot strategy returns an action.
//  3. Apply  – the action mutates GameState; if a camel crosses the finish
//              line the race ends immediately.
//  4. Leg end – when the dice pool empties, leg bets are resolved, pool and
//               bet stacks reset, and play continues.
//  5. Race end – leg bets for the triggering leg are resolved first, then all
//                race-winner / race-loser bets are paid out.
// ---------------------------------------------------------------------------

import type {
  CamelColor,
  ForwardCamelColor,
  GameState,
  LegBetRecommendation,
  LegBetTile,
  LegWinProbabilities,
  RaceBetType,
} from './types';
import {
  CAMEL_COLORS,
  CRAZY_CAMELS,
  RACE_BET_PAYOUTS,
  RACE_BET_WRONG_COST,
  createEmptyTrack,
  createDicePool,
  createLegBetStacks,
  createPlayer,
} from './constants';
import {
  moveCamelFull, moveCrazyFull,
  getLeadingForwardCamel, getLastForwardCamel, placeCamel,
} from './movement';
import { computeLegProbabilities } from './probability';
import { computeLegBetRecommendations, getBestLegAction } from './ev';
import type { LegAction } from './ev';
import { makePrng } from './simulator';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** An action a bot can take on its turn. */
export type BotAction =
  | { type: 'roll' }
  | { type: 'leg-bet'; camel: ForwardCamelColor }
  | { type: 'race-bet'; camel: CamelColor; betType: RaceBetType };

/** Everything a bot strategy sees on its turn. */
export interface BotTurnContext {
  /** Full game state (treat as immutable). */
  state: Readonly<GameState>;
  /** P(win leg) for each forward camel given remaining dice. */
  legWinProbabilities: LegWinProbabilities;
  /** Pre-computed EV recommendations, sorted best first. */
  legBetRecommendations: LegBetRecommendation[];
  /** The single best EV action (roll or leg-bet) for this turn. */
  bestLegAction: LegAction;
  /** Index of this player in state.players. */
  playerIndex: number;
  /** Which camels this player has NOT yet bet on as overall winner. */
  availableWinnerBets: CamelColor[];
  /** Which camels this player has NOT yet bet on as overall loser. */
  availableLoserBets: CamelColor[];
}

/** A strategy function: given context → return an action. */
export type BotStrategy = (ctx: BotTurnContext) => BotAction;

// ---------------------------------------------------------------------------
// Turn log (for analysis / replay)
// ---------------------------------------------------------------------------

export interface TurnLog {
  turn: number;
  legNumber: number;
  playerIndex: number;
  playerName: string;
  action: BotAction;
  /** Coins earned this turn (negative = lost). */
  coinsDelta: number;
  /** Running coins total for this player after the action. */
  coinsAfter: number;
}

export interface LegResolutionLog {
  legNumber: number;
  winner: CamelColor | null;
  /** Per-player coin changes from leg-bet resolution. */
  playerDeltas: number[];
}

// ---------------------------------------------------------------------------
// Game result
// ---------------------------------------------------------------------------

export interface BotGameResult {
  /** Overall race winner camel. */
  raceWinner: CamelColor | null;
  /** Overall race loser camel. */
  raceLoser: CamelColor | null;
  /** Final coin totals for each player, by player index. */
  finalCoins: number[];
  /** Player index of the human-victory winner (most coins). */
  winningPlayerIndex: number;
  /** All turns taken during the game. */
  turnLog: TurnLog[];
  /** Summary of each leg resolution. */
  legLog: LegResolutionLog[];
  /** Total number of turns taken. */
  totalTurns: number;
  /** Total number of legs played. */
  totalLegs: number;
  /** The seed used for reproducibility. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BotGameOptions {
  /**
   * Seeded RNG seed.  Same seed + same strategies → identical game.
   * Defaults to Date.now().
   */
  seed?: number;
  /** Names for the players. Defaults to "Bot 1", "Bot 2", … */
  playerNames?: string[];
  /** Starting coins per player. Defaults to 3. */
  startingCoins?: number;
  /**
   * Starting positions for forward camels [blue, green, yellow, purple, pink].
   * If omitted, each camel rolls a seeded die (1–3) to place itself at that
   * space (stacking on top of any camel already there, as in the real game).
   */
  startingPositions?: Partial<Record<ForwardCamelColor, number>>;
  /**
   * Maximum turns before the game is forcibly terminated (prevents infinite
   * loops in pathological strategies).  Defaults to 2000.
   */
  maxTurns?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers — pure state transformers
// ---------------------------------------------------------------------------

/** Resolve all held leg bets against `legWinner`.  Mutates `state` (players' coins + legBets). */
function resolveLegBets(state: GameState, legWinner: CamelColor | null): number[] {
  const deltas = state.players.map(() => 0);
  for (let pi = 0; pi < state.players.length; pi++) {
    const player = state.players[pi];
    let delta = 0;
    for (const tile of player.legBets) {
      delta += tile.camel === legWinner ? tile.payout : -1;
    }
    player.coins += delta;
    player.legBets = [];
    deltas[pi] = delta;
  }
  return deltas;
}

/** Resolve race-winner and race-loser bets.  Mutates players' coins. */
function resolveRaceBets(
  state: GameState,
  raceWinner: CamelColor | null,
  raceLoser: CamelColor | null
): void {
  // Winner bets
  let correctWinIdx = 0;
  for (const card of state.raceWinnerBets) {
    if (card.camel === raceWinner) {
      const payout =
        RACE_BET_PAYOUTS[correctWinIdx] ??
        RACE_BET_PAYOUTS[RACE_BET_PAYOUTS.length - 1];
      state.players[card.playerIndex].coins += payout;
      correctWinIdx++;
    } else {
      state.players[card.playerIndex].coins += RACE_BET_WRONG_COST;
    }
  }

  // Loser bets
  let correctLoseIdx = 0;
  for (const card of state.raceLoserBets) {
    if (card.camel === raceLoser) {
      const payout =
        RACE_BET_PAYOUTS[correctLoseIdx] ??
        RACE_BET_PAYOUTS[RACE_BET_PAYOUTS.length - 1];
      state.players[card.playerIndex].coins += payout;
      correctLoseIdx++;
    } else {
      state.players[card.playerIndex].coins += RACE_BET_WRONG_COST;
    }
  }
}

/** Advance currentPlayerIndex to the next player in round-robin order. */
function advancePlayer(state: GameState): void {
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

// Simple in-leg probability cache: re-use results for the same pool within a game.
// Keyed by sorted-pool + compact track string to correctly handle multi-leg games.
// Cleared automatically between legs by including the track in the key.
const _probCache = new Map<string, ReturnType<typeof computeLegProbabilities>>();
function cachedLegProb(track: GameState['track'], pool: GameState['dicePool']) {
  const trackKey = track.map(s => s.join(',')).join('|');
  const poolKey = pool.slice().sort().join(',');
  const key = `${poolKey}::${trackKey}`;
  if (!_probCache.has(key)) {
    _probCache.set(key, computeLegProbabilities(track, pool));
  }
  return _probCache.get(key)!;
}

function buildContext(
  state: GameState,
  playerIndex: number
): BotTurnContext {
  const player = state.players[playerIndex];
  const allCamels: CamelColor[] = [...CAMEL_COLORS, ...CRAZY_CAMELS];
  const availableWinnerBets = allCamels.filter(
    (c) => !player.raceWinnerBets.includes(c)
  );
  const availableLoserBets = allCamels.filter(
    (c) => !player.raceLoserBets.includes(c)
  );

  // Lazy probability computation — only runs if the bot accesses these fields.
  // This makes simple bots (alwaysRollBot) fast since they never access probabilities.
  let _probs: ReturnType<typeof computeLegProbabilities> | null = null;
  const getProbs = () => {
    if (!_probs) _probs = cachedLegProb(state.track, state.dicePool);
    return _probs;
  };

  const ctx: BotTurnContext = {
    state,
    get legWinProbabilities() { return getProbs().winProbabilities; },
    get legBetRecommendations() {
      return computeLegBetRecommendations(getProbs().winProbabilities, state.legBetStacks);
    },
    get bestLegAction() {
      return getBestLegAction(getProbs().winProbabilities, state.legBetStacks);
    },
    playerIndex,
    availableWinnerBets,
    availableLoserBets,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Public API — runBotGame
// ---------------------------------------------------------------------------

/**
 * Runs a complete game from setup to finish using the provided bot strategies.
 *
 * Each strategy in `strategies` controls one player (strategies.length = player
 * count).  The game is fully deterministic given the same `seed` and the same
 * strategy implementations.
 *
 * @param strategies  One strategy per player (2–4 strategies).
 * @param options     Optional seed, player names, starting coins, positions.
 */
export function runBotGame(
  strategies: BotStrategy[],
  options: BotGameOptions = {}
): BotGameResult {
  if (strategies.length < 2 || strategies.length > 4) {
    throw new Error('runBotGame requires 2–4 strategies');
  }

  const {
    seed = Date.now(),
    playerNames = strategies.map((_, i) => `Bot ${i + 1}`),
    startingCoins = 3,
    startingPositions = {},
    maxTurns = 2000,
  } = options;

  const rng = makePrng(seed);
  const randDie = (): 1 | 2 | 3 => ((Math.floor(rng() * 3) + 1) as 1 | 2 | 3);
  const randFrom = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // ----- Build initial state -----
  let track = createEmptyTrack();

  for (const camel of CAMEL_COLORS) {
    const pos =
      startingPositions[camel] !== undefined
        ? startingPositions[camel]!
        : randDie() - 1; // seeded: places at 0, 1, or 2
    track = placeCamel(track, camel, pos);
  }

  const state: GameState = {
    track,
    dicePool: createDicePool(),
    legBetStacks: createLegBetStacks() as Record<CamelColor, number[]>,
    raceWinnerBets: [],
    raceLoserBets: [],
    trapTiles: [],
    players: playerNames.map((name) => createPlayer(name, startingCoins)),
    currentPlayerIndex: 0,
    phase: 'running',
    legNumber: 1,
  };

  // ----- Game loop -----
  const turnLog: TurnLog[] = [];
  const legLog: LegResolutionLog[] = [];
  let raceOver = false;
  let raceWinner: CamelColor | null = null;
  let raceLoser: CamelColor | null = null;

  for (let turnNum = 0; turnNum < maxTurns && !raceOver; turnNum++) {
    const pi = state.currentPlayerIndex;
    const player = state.players[pi];

    // Build analysis context and get bot action
    const ctx = buildContext(state, pi);
    const action = strategies[pi](ctx);

    let coinsDelta = 0;

    // ---- Apply action ----
    if (action.type === 'roll') {
      // Pick a random entry from the remaining pool.
      const dieEntry = randFrom([...state.dicePool]);
      const steps = randDie();

      // Remove from pool.
      state.dicePool = state.dicePool.filter((c) => c !== dieEntry);

      // Move the camel (handle 'crazy' die which picks black or white backward).
      let raceOver_this_roll = false;
      if (dieEntry === 'crazy') {
        const crazyCamel = randFrom(['black', 'white'] as CamelColor[]);
        const result = moveCrazyFull(state.track, crazyCamel, steps);
        state.track = result.track;
      } else {
        const result = moveCamelFull(state.track, dieEntry, steps);
        state.track = result.track;
        raceOver_this_roll = result.raceOver;
      }

      // Rolling always earns 1 coin.
      player.coins += 1;
      coinsDelta = 1;
      const result = { raceOver: raceOver_this_roll };

      if (result.raceOver) {
        // Resolve the current leg first, then the race.
        const legWinner = getLeadingForwardCamel(state.track);
        const legDeltas = resolveLegBets(state, legWinner);
        coinsDelta += legDeltas[pi];

        raceWinner = getLeadingForwardCamel(state.track);
        raceLoser = getLastForwardCamel(state.track);
        resolveRaceBets(state, raceWinner, raceLoser);

        legLog.push({
          legNumber: state.legNumber,
          winner: legWinner,
          playerDeltas: legDeltas,
        });

        raceOver = true;
        state.phase = 'race-ended';
      } else if (state.dicePool.length === 0) {
        // Leg ended cleanly — resolve leg bets, start new leg.
        const legWinner = getLeadingForwardCamel(state.track);
        const legDeltas = resolveLegBets(state, legWinner);
        coinsDelta += legDeltas[pi];

        legLog.push({
          legNumber: state.legNumber,
          winner: legWinner,
          playerDeltas: legDeltas,
        });

        // Reset for next leg.
        state.dicePool = createDicePool();
        state.legBetStacks = createLegBetStacks() as Record<CamelColor, number[]>;
        state.legNumber++;
      }
    } else if (action.type === 'leg-bet') {
      const camel = action.camel;
      const stack = state.legBetStacks[camel];
      if (stack.length > 0) {
        const payout = stack.shift()!; // take the top tile
        player.legBets.push({ camel, payout } as LegBetTile);
        // No immediate coin change for taking a leg-bet tile.
        coinsDelta = 0;
      }
      // If stack is empty, the action is a no-op (strategy should guard against this).
    } else if (action.type === 'race-bet') {
      const { camel, betType } = action;
      if (betType === 'winner' && !player.raceWinnerBets.includes(camel)) {
        player.raceWinnerBets.push(camel);
        state.raceWinnerBets.push({ camel, type: 'winner', playerIndex: pi });
        coinsDelta = 0;
      } else if (betType === 'loser' && !player.raceLoserBets.includes(camel)) {
        player.raceLoserBets.push(camel);
        state.raceLoserBets.push({ camel, type: 'loser', playerIndex: pi });
        coinsDelta = 0;
      }
    }

    turnLog.push({
      turn: turnNum,
      legNumber: state.legNumber,
      playerIndex: pi,
      playerName: player.name,
      action,
      coinsDelta,
      coinsAfter: player.coins,
    });

    if (!raceOver) {
      advancePlayer(state);
    }
  }

  // Determine the player with the most coins.
  const finalCoins = state.players.map((p) => p.coins);
  const winningPlayerIndex = finalCoins.indexOf(Math.max(...finalCoins));

  return {
    raceWinner,
    raceLoser,
    finalCoins,
    winningPlayerIndex,
    turnLog,
    legLog,
    totalTurns: turnLog.length,
    totalLegs: state.legNumber,
    seed,
  };
}

// ---------------------------------------------------------------------------
// Utility — run many games and aggregate win rates
// ---------------------------------------------------------------------------

export interface BotMatchResult {
  /** Number of times each player index won (had most coins). */
  wins: number[];
  /** Average final coins per player across all games. */
  avgCoins: number[];
  /** Total games played. */
  totalGames: number;
}

/**
 * Runs `numGames` games between the given strategies and returns aggregate
 * win-rate statistics.  Each game uses a different seed derived from the base
 * seed so results are reproducible.
 */
export function runBotMatch(
  strategies: BotStrategy[],
  numGames: number,
  options: Omit<BotGameOptions, 'seed'> & { baseSeed?: number } = {}
): BotMatchResult {
  const { baseSeed = 1, ...rest } = options;
  const wins = strategies.map(() => 0);
  const totalCoins = strategies.map(() => 0);

  for (let g = 0; g < numGames; g++) {
    const result = runBotGame(strategies, { ...rest, seed: baseSeed + g });
    wins[result.winningPlayerIndex]++;
    result.finalCoins.forEach((c, i) => { totalCoins[i] += c; });
  }

  return {
    wins,
    avgCoins: totalCoins.map((t) => t / numGames),
    totalGames: numGames,
  };
}
