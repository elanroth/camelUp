// ---------------------------------------------------------------------------
// Camel Up 2.0 — Core Types
// 5 forward camels + 2 crazy camels (black & white share one die, move backward)
// ---------------------------------------------------------------------------

/**
 * All seven camel colours.
 * Forward camels: blue, green, yellow, purple, pink
 * Crazy camels (move backward, share one die): black, white
 */
export type CamelColor = 'blue' | 'green' | 'yellow' | 'purple' | 'pink' | 'black' | 'white';

/**
 * One space on the 16-space track.
 * Array is ordered bottom → top (index 0 = bottom of stack).
 */
export type TrackSpace = CamelColor[];

/**
 * The full track: 16 spaces, indexed 0–15.
 * Space 0 = first space on the board.
 * Space 15 = finish line.
 * A camel that would land on space 16+ has crossed the finish line.
 */
export type Track = TrackSpace[]; // length === TRACK_LENGTH

// ---------------------------------------------------------------------------
// Dice / Leg
// ---------------------------------------------------------------------------

/**
 * A single die result: the colour of the camel that moved, and by how many
 * spaces (1, 2, or 3).
 */
export interface DieResult {
  camel: CamelColor;
  steps: 1 | 2 | 3;
}

/**
 * An entry in the DicePool. Forward camel colours represent their own die.
 * 'crazy' represents the shared crazy-camel die (black or white is chosen
 * randomly when pulled; both share a single pyramid slot).
 */
export type DicePoolEntry = CamelColor | 'crazy';

/**
 * The dice pool for the current leg: 5 forward-camel dice + 1 crazy die = 6 total.
 * An empty pool means the leg is over.
 */
export type DicePool = DicePoolEntry[];

// ---------------------------------------------------------------------------
// Betting
// ---------------------------------------------------------------------------

/**
 * A leg-bet tile held by a player.
 * Pays `payout` coins if the camel wins the leg, or –1 if it doesn't.
 */
export interface LegBetTile {
  camel: CamelColor;
  payout: number; // 5, 3, or 2
}

/**
 * The ordered stack of remaining leg-bet tiles for one camel.
 * tiles[0] is the *next* tile a player would take (the highest remaining).
 */
export interface LegBetStack {
  camel: CamelColor;
  tiles: number[]; // e.g. [5, 3, 2] at the start of a leg
}

/** Overall race bet (who wins or loses the whole race). */
export type RaceBetType = 'winner' | 'loser';

export interface RaceBetCard {
  camel: CamelColor;
  type: RaceBetType;
  playerIndex: number;
}

// ---------------------------------------------------------------------------
// Trap tiles (Desert tiles)
// ---------------------------------------------------------------------------

/**
 * Oasis = +1 (camel moves 1 forward after landing).
 * Mirage = -1 (camel moves 1 backward after landing).
 * In both cases the tile owner earns 1 coin per camel that lands on it.
 */
export type TrapType = 'oasis' | 'mirage';

/**
 * A desert tile on the board.
 * Rules: no adjacent tiles, not on space 1 (index 0); max 1 per player.
 * The tile stays until removed/moved by its owner (as a turn action).
 * It earns the owner 1 coin each time any camel group lands on it.
 */
export interface TrapTile {
  /** 0-based space index on the track. */
  space: number;
  type: TrapType;
  /** Index into game.players[] — who placed this tile. */
  playerIndex: number;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface PlayerState {
  name: string;
  coins: number;
  /** Leg-bet tiles currently held (but not yet resolved). */
  legBets: LegBetTile[];
  /** Race card bets already placed on the overall winner stack. */
  raceWinnerBets: CamelColor[];
  /** Race card bets already placed on the overall loser stack. */
  raceLoserBets: CamelColor[];
}

// ---------------------------------------------------------------------------
// Full Game State
// ---------------------------------------------------------------------------

export type GamePhase = 'setup' | 'running' | 'leg-end' | 'race-ended';

export interface GameState {
  /** 16-space track; each entry = stack of camels (bottom → top). */
  track: Track;

  /**
   * Camels whose die has NOT yet been rolled this leg.
   * When this is empty, the leg ends.
   */
  dicePool: DicePool;

  /**
   * Remaining leg-bet payouts available per camel.
   * Resets to [5, 3, 2] at the start of every leg.
   */
  legBetStacks: Record<CamelColor, number[]>;

  /** Ordered sequence of race winner bets (first bet = index 0). */
  raceWinnerBets: RaceBetCard[];

  /** Ordered sequence of race loser bets (first bet = index 0). */
  raceLoserBets: RaceBetCard[];

  /**
   * Optional trap tiles placed by players.
   * At most one tile per space; a player may have at most one tile on the board.
   */
  trapTiles: TrapTile[];

  players: PlayerState[];
  currentPlayerIndex: number;
  phase: GamePhase;
  legNumber: number;
}

// ---------------------------------------------------------------------------
// Probability outputs
// ---------------------------------------------------------------------------

/**
 * The 5 forward-moving camel colours (excludes the 2 crazy camels).
 * Used for probability and EV calculations which only apply to forward camels.
 */
export type ForwardCamelColor = Exclude<CamelColor, 'black' | 'white'>;

/** P(win leg) for each forward camel, given remaining dice. Sum ≈ 1. */
export type LegWinProbabilities = Record<ForwardCamelColor, number>;

/** EV of taking the next available leg-bet tile for each forward camel. */
export type LegBetEV = Record<ForwardCamelColor, number | null>; // null = no tiles left

/** Summary of a single camel's leg-bet recommendation. */
export interface LegBetRecommendation {
  camel: ForwardCamelColor;
  availablePayout: number | null;
  winProbability: number;
  ev: number | null;
}
