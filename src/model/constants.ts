import type {
  CamelColor,
  DicePoolEntry,
  ForwardCamelColor,
  GameState,
  LegBetStack,
  PlayerState,
  Track,
} from './types';

// ---------------------------------------------------------------------------
// Board constants
// ---------------------------------------------------------------------------

/** Number of spaces on the track. */
export const TRACK_LENGTH = 16;

/** A camel on space index >= FINISH_LINE has crossed the finish. */
export const FINISH_LINE = TRACK_LENGTH; // i.e. index 16+

/** The 5 forward-moving camels. Order is arbitrary; used for iteration. */
export const CAMEL_COLORS: readonly ForwardCamelColor[] = [
  'blue',
  'green',
  'yellow',
  'purple',
  'pink',
];

/**
 * The 2 crazy camels. They share one die and move BACKWARD.
 * They are not included in leg-bet stacks or the forward dice pool.
 */
export const CRAZY_CAMELS: readonly CamelColor[] = ['black', 'white'];

/** Faces on each camel die. */
export const DIE_FACES: readonly (1 | 2 | 3)[] = [1, 2, 3];

// ---------------------------------------------------------------------------
// Betting constants
// ---------------------------------------------------------------------------

/**
 * Payouts on the leg-bet tile stack.
 * First tile taken pays 5, second 3, third 2.
 * A wrong-camel bet always costs the player 1 coin (returned as −1).
 */
export const LEG_BET_PAYOUTS: readonly number[] = [5, 3, 2];

/** Payout for being correct on an overall race winner/loser bet, ordered by
 *  when the card was played.  First card played = highest payout. */
export const RACE_BET_PAYOUTS: readonly number[] = [8, 5, 3, 2, 1];

/** Cost for a wrong overall race winner/loser bet. */
export const RACE_BET_WRONG_COST = -1;

// ---------------------------------------------------------------------------
// Tailwind colour map (used by views — kept here so the model owns all colour
// data and view just reads it)
// ---------------------------------------------------------------------------

export const CAMEL_COLOURS_TW: Record<CamelColor, string> = {
  blue:   'bg-blue-500 text-white',
  green:  'bg-green-500 text-white',
  yellow: 'bg-yellow-400 text-gray-800',
  purple: 'bg-violet-600 text-white',
  pink:   'bg-pink-500 text-white',
  black:  'bg-gray-900 border border-gray-600 text-white',
  white:  'bg-gray-50 border border-gray-300 text-gray-800',
};

export const CAMEL_HEX: Record<CamelColor, string> = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  yellow: '#facc15',
  purple: '#7c3aed',
  pink:   '#ec4899',
  black:  '#1f2937',
  white:  '#f1f5f9',
};

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Creates a blank 16-space track (all spaces empty). */
export function createEmptyTrack(): Track {
  return Array.from({ length: TRACK_LENGTH }, () => []);
}

/** Creates the initial leg-bet stacks for a new leg: [5, 3, 2] per camel. */
export function createLegBetStacks(): Record<CamelColor, number[]> {
  return Object.fromEntries(
    CAMEL_COLORS.map((c) => [c, [...LEG_BET_PAYOUTS]])
  ) as Record<CamelColor, number[]>;
}

/**
 * Creates the starting dice pool: 5 forward-camel dice + 1 shared crazy die = 6 total.
 * The 'crazy' entry represents the combined black/white pyramid die.
 */
export function createDicePool(): DicePoolEntry[] {
  return [...CAMEL_COLORS, 'crazy'];
}

/** Creates a default player state. */
export function createPlayer(name: string, startingCoins = 3): PlayerState {
  return {
    name,
    coins: startingCoins,
    legBets: [],
    raceWinnerBets: [],
    raceLoserBets: [],
  };
}

/**
 * Creates a fresh GameState with all camels off the board.
 * The caller should then place camels via `placeCamera` (see movement.ts)
 * or restore a known board state.
 */
export function createInitialGameState(playerNames: string[]): GameState {
  if (playerNames.length < 2 || playerNames.length > 4) {
    throw new Error('Camel Up supports 2–4 players');
  }
  return {
    track: createEmptyTrack(),
    dicePool: createDicePool(),
    legBetStacks: createLegBetStacks(),
    raceWinnerBets: [],
    raceLoserBets: [],
    trapTiles: [],
    players: playerNames.map((n) => createPlayer(n)),
    currentPlayerIndex: 0,
    phase: 'setup',
    legNumber: 1,
  };
}

/** Serialise a LegBetStack array from the record for display purposes. */
export function legBetStacksAsArray(
  stacks: Record<CamelColor, number[]>
): LegBetStack[] {
  return CAMEL_COLORS.map((c) => ({ camel: c, tiles: stacks[c] }));
}
