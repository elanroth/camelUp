import { describe, it, expect } from 'vitest';
import {
  CAMEL_COLORS,
  CRAZY_CAMELS,
  TRACK_LENGTH,
  LEG_BET_PAYOUTS,
  createEmptyTrack,
  createLegBetStacks,
  createDicePool,
  createInitialGameState,
  createPlayer,
  legBetStacksAsArray,
} from './constants';

describe('CAMEL_COLORS', () => {
  it('has exactly 5 colours', () => {
    expect(CAMEL_COLORS).toHaveLength(5);
  });

  it('contains all expected colours', () => {
    expect(CAMEL_COLORS).toContain('blue');
    expect(CAMEL_COLORS).toContain('green');
    expect(CAMEL_COLORS).toContain('yellow');
    expect(CAMEL_COLORS).toContain('purple');
    expect(CAMEL_COLORS).toContain('pink');
  });

  it('has no duplicates', () => {
    expect(new Set(CAMEL_COLORS).size).toBe(CAMEL_COLORS.length);
  });
});

describe('createEmptyTrack', () => {
  it('creates a track with TRACK_LENGTH spaces', () => {
    const track = createEmptyTrack();
    expect(track).toHaveLength(TRACK_LENGTH);
  });

  it('all spaces are empty arrays', () => {
    const track = createEmptyTrack();
    track.forEach((space) => {
      expect(space).toEqual([]);
    });
  });

  it('returns a new array each call (no aliasing)', () => {
    const a = createEmptyTrack();
    const b = createEmptyTrack();
    a[0].push('blue');
    expect(b[0]).toEqual([]);
  });
});

describe('createLegBetStacks', () => {
  it('creates stacks for every camel', () => {
    const stacks = createLegBetStacks();
    CAMEL_COLORS.forEach((c) => {
      expect(stacks).toHaveProperty(c);
    });
  });

  it('each stack equals LEG_BET_PAYOUTS', () => {
    const stacks = createLegBetStacks();
    CAMEL_COLORS.forEach((c) => {
      expect(stacks[c]).toEqual([...LEG_BET_PAYOUTS]);
    });
  });

  it('returns independent copies (no aliasing)', () => {
    const a = createLegBetStacks();
    const b = createLegBetStacks();
    a['blue'].pop();
    expect(b['blue']).toHaveLength(LEG_BET_PAYOUTS.length);
  });
});

describe('createDicePool', () => {
  it('contains all 5 forward camel colours', () => {
    const pool = createDicePool();
    CAMEL_COLORS.forEach((c) => {
      expect(pool).toContain(c);
    });
  });

  it('contains the crazy die entry', () => {
    expect(createDicePool()).toContain('crazy');
  });

  it('has 6 entries total (5 forward + 1 crazy)', () => {
    expect(createDicePool()).toHaveLength(6);
  });
});

describe('createPlayer', () => {
  it('sets the player name', () => {
    const p = createPlayer('Alice');
    expect(p.name).toBe('Alice');
  });

  it('defaults to 3 starting coins', () => {
    const p = createPlayer('Alice');
    expect(p.coins).toBe(3);
  });

  it('respects custom starting coins', () => {
    const p = createPlayer('Bob', 10);
    expect(p.coins).toBe(10);
  });

  it('starts with empty bets', () => {
    const p = createPlayer('Alice');
    expect(p.legBets).toEqual([]);
    expect(p.raceWinnerBets).toEqual([]);
    expect(p.raceLoserBets).toEqual([]);
  });
});

describe('createInitialGameState', () => {
  it('creates correct state for 2 players', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.players).toHaveLength(2);
    expect(state.players[0].name).toBe('Alice');
    expect(state.players[1].name).toBe('Bob');
  });

  it('starts in setup phase', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.phase).toBe('setup');
  });

  it('starts on leg 1', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.legNumber).toBe(1);
  });

  it('starts with full dice pool (6 entries: 5 forward + 1 crazy)', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.dicePool).toHaveLength(6);
  });

  it('track is empty', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    state.track.forEach((space) => {
      expect(space).toEqual([]);
    });
  });

  it('throws for fewer than 2 players', () => {
    expect(() => createInitialGameState(['Alice'])).toThrow();
  });

  it('throws for more than 4 players', () => {
    expect(() =>
      createInitialGameState(['A', 'B', 'C', 'D', 'E'])
    ).toThrow();
  });

  it('currentPlayerIndex starts at 0', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('has no race bets or traps initially', () => {
    const state = createInitialGameState(['Alice', 'Bob']);
    expect(state.raceWinnerBets).toEqual([]);
    expect(state.raceLoserBets).toEqual([]);
    expect(state.trapTiles).toEqual([]);
  });

  it('creates valid state for exactly 4 players (max)', () => {
    const state = createInitialGameState(['A', 'B', 'C', 'D']);
    expect(state.players).toHaveLength(4);
    expect(state.players.map((p) => p.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('throws for 0 players', () => {
    expect(() => createInitialGameState([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CRAZY_CAMELS
// ---------------------------------------------------------------------------

describe('CRAZY_CAMELS', () => {
  it('has exactly 2 entries', () => {
    expect(CRAZY_CAMELS).toHaveLength(2);
  });

  it('contains black and white', () => {
    expect(CRAZY_CAMELS).toContain('black');
    expect(CRAZY_CAMELS).toContain('white');
  });

  it('has no overlap with CAMEL_COLORS', () => {
    const forward = new Set<string>(CAMEL_COLORS);
    CRAZY_CAMELS.forEach((c) => {
      expect(forward.has(c)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// createDicePool — crazy die
// ---------------------------------------------------------------------------

describe('createDicePool — crazy die', () => {
  it('contains \'crazy\' die entry (shared black/white die)', () => {
    expect(createDicePool()).toContain('crazy');
  });

  it('does not contain individual crazy camel colours directly', () => {
    // The 'crazy' entry is the die; black/white are NOT separate pool entries
    expect(createDicePool()).not.toContain('black');
    expect(createDicePool()).not.toContain('white');
  });

  it('returns a fresh mutable copy each call', () => {
    const a = createDicePool();
    const b = createDicePool();
    a.push('black' as never); // mutate a
    expect(b).not.toContain('black');
  });
});

// ---------------------------------------------------------------------------
// legBetStacksAsArray
// ---------------------------------------------------------------------------

describe('legBetStacksAsArray', () => {
  it('returns one entry per forward camel', () => {
    const result = legBetStacksAsArray(createLegBetStacks());
    expect(result).toHaveLength(CAMEL_COLORS.length);
  });

  it('each entry has a camel and tiles field', () => {
    const result = legBetStacksAsArray(createLegBetStacks());
    result.forEach(({ camel, tiles }) => {
      expect(typeof camel).toBe('string');
      expect(Array.isArray(tiles)).toBe(true);
    });
  });

  it('tiles in each entry match the stack passed in', () => {
    const stacks = createLegBetStacks();
    stacks['blue'] = [3]; // simulate one tile taken
    const result = legBetStacksAsArray(stacks);
    const blueEntry = result.find((e) => e.camel === 'blue')!;
    expect(blueEntry.tiles).toEqual([3]);
  });

  it('covers all forward camel colours', () => {
    const result = legBetStacksAsArray(createLegBetStacks());
    const camels = result.map((e) => e.camel);
    CAMEL_COLORS.forEach((c) => expect(camels).toContain(c));
  });
});
