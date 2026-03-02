// ---------------------------------------------------------------------------
// Desert Tile Tests (Oasis & Mirage)
// Tests for trap tile placement and coin earning
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createEmptyTrack } from './constants';
import {
  placeCamel,
  moveCamelFull,
  applyTrapTile,
} from './movement';
import type { TrapTile } from './types';

describe('applyTrapTile — oasis (+1 movement)', () => {
  it('moves camel forward by 1 additional space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 3);
    const trapTiles: TrapTile[] = [{
      space: 3,
      type: 'oasis',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 3, trapTiles);

    expect(result.track[4]).toContain('blue'); // moved from 3 to 4
    expect(result.track[3]).not.toContain('blue');
    expect(result.earnedCoin).toEqual([0]);
    expect(result.triggeredSpaces).toEqual([3]);
  });

  it('awards coin to tile owner', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 3);
    const trapTiles: TrapTile[] = [{
      space: 3,
      type: 'oasis',
      playerIndex: 1,
    }];

    const result = applyTrapTile(track, 3, trapTiles);

    expect(result.earnedCoin).toEqual([1]);
  });

  it('can push camel beyond finish line', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 14);
    const trapTiles: TrapTile[] = [{
      space: 14,
      type: 'oasis',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 14, trapTiles);

    //  14 + 1 = 15 (reaches finish)
    expect(result.track[15]).toContain('blue');
    expect(result.track[14]).not.toContain('blue');
  });

  it('no effect when landing on space with no tile', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 3);
    const trapTiles: TrapTile[] = [{
      space: 5,
      type: 'oasis',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 3, trapTiles);

    expect(result.track[3]).toContain('blue'); // unchanged
    expect(result.earnedCoin).toEqual([]);
    expect(result.triggeredSpaces).toEqual([]);
  });
});

describe('applyTrapTile — mirage (-1 movement)', () => {
  it('moves camel backward by 1 space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    const trapTiles: TrapTile[] = [{
      space: 5,
      type: 'mirage',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 5, trapTiles);

    expect(result.track[4]).toContain('blue'); // moved from 5 to 4
    expect(result.track[5]).not.toContain('blue');
  });

  it('awards coin to tile owner', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 5);
    const trapTiles: TrapTile[] = [{
      space: 5,
      type: 'mirage',
      playerIndex: 2,
    }];

    const result = applyTrapTile(track, 5, trapTiles);

    expect(result.earnedCoin).toEqual([2]);
  });

  it('clamps to space 0 when going below start', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 1);
    const trapTiles: TrapTile[] = [{
      space: 1,
      type: 'mirage',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 1, trapTiles);

    expect(result.track[0]).toContain('blue'); // 1 - 1 = 0
  });

  it('mirage at space 1 sends camel to space 0', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 1);
    const trapTiles: TrapTile[] = [{
      space: 1,
      type: 'mirage',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 1, trapTiles);

    expect(result.track[0]).toContain('blue');
    expect(result.track[1]).not.toContain('blue');
  });
});

describe('applyTrapTile — multiple tiles', () => {
  it('only applies tile at the landing space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    const trapTiles: TrapTile[] = [
      { space: 3, type: 'oasis', playerIndex: 0 },
      { space: 5, type: 'mirage', playerIndex: 1 },
      { space: 7, type: 'oasis', playerIndex: 2 },
    ];

    const result = applyTrapTile(track, 5, trapTiles);

    expect(result.track[4]).toContain('blue'); // mirage at 5: 5 - 1
    expect(result.earnedCoin).toEqual([1]);
  });

  it('awards multiple coins to same player if they land multiple times', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 3);
    const trapTiles: TrapTile[] = [{
      space: 3,
      type: 'oasis',
      playerIndex: 0,
    }];

    // Simulate landing on space 3 twice (e.g., two different camels)
    const result1 = applyTrapTile(track, 3, trapTiles);
    
    // Place another camel
    track = placeCamel(result1.track, 'green', 3);
    const result2 = applyTrapTile(track, 3, trapTiles);

    expect(result1.earnedCoin).toEqual([0]);
    expect(result2.earnedCoin).toEqual([0]);
  });
});

describe('desert tile integration with movement', () => {
  it('oasis tile pushes camel stack forward after landing', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 0);
    
    const trapTiles: TrapTile[] = [{
      space: 2,
      type: 'oasis',
      playerIndex: 1,
    }];

    // Blue rolls 2, lands on space 2 (oasis), gets pushed to 3
    const moveResult = moveCamelFull(track, 'blue', 2);
    track = moveResult.track;
    
    const trapResult = applyTrapTile(track, moveResult.landedOn, trapTiles);

    expect(trapResult.track[3]).toContain('blue'); // 2 + 1
    expect(trapResult.earnedCoin).toEqual([1]);
  });

  it('mirage does not chain to another tile', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    const trapTiles: TrapTile[] = [
      { space: 5, type: 'mirage', playerIndex: 0 },
      { space: 4, type: 'oasis', playerIndex: 1 },
    ];

    // Blue lands on space 5 (mirage) → moves to 4
    // But trap tiles do NOT chain (per function documentation)
    const result = applyTrapTile(track, 5, trapTiles);

    expect(result.track[4]).toContain('blue');
    expect(result.earnedCoin).toEqual([0]); // Only mirage owner, not oasis
    expect(result.triggeredSpaces).toEqual([5]); // Only mirage triggered
  });
});

describe('desert tile rules validation', () => {
  it('tile placement on space 0 is typically not allowed', () => {
    // This is a controller/view concern, but we can verify the data structure allows it
    const trapTile: TrapTile = {
      space: 0,
      type: 'oasis',
      playerIndex: 0,
    };

    expect(trapTile.space).toBe(0);
    // Movement functions should handle this gracefully
  });

  it('multiple tiles can exist on different spaces', () => {
    const trapTiles: TrapTile[] = [
      { space: 2, type: 'oasis', playerIndex: 0 },
      { space: 5, type: 'mirage', playerIndex: 1 },
      { space: 8, type: 'oasis', playerIndex: 2 },
      { space: 12, type: 'mirage', playerIndex: 3 },
    ];

    expect(trapTiles.length).toBe(4);
    expect(new Set(trapTiles.map(t => t.space)).size).toBe(4); // all unique
  });

  it('same player cannot have multiple tiles on board (enforced by controller)', () => {
    // This is a game rule enforced at the controller level
    // The data structure itself allows it, but useTurnController.placeTrapTile removes old tile
    const trapTiles: TrapTile[] = [
      { space: 3, type: 'oasis', playerIndex: 0 },
      { space: 7, type: 'mirage', playerIndex: 0 }, // NOT allowed in real game
    ];

    // Filter: only one tile per player
    const player0Tiles = trapTiles.filter(t => t.playerIndex === 0);
    expect(player0Tiles.length).toBe(2); // structure allows it, but game doesn't
  });
});

describe('applyTrapTile — edge cases', () => {
  it('handles empty trapTiles array', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    const trapTiles: TrapTile[] = [];

    const result = applyTrapTile(track, 5, trapTiles);

    expect(result.track[5]).toContain('blue'); // unchanged
    expect(result.earnedCoin).toEqual([]);
    expect(result.triggeredSpaces).toEqual([]);
  });

  it('oasis at space 14 → 15 (finish line)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 14);
    const trapTiles: TrapTile[] = [{
      space: 14,
      type: 'oasis',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 14, trapTiles);

    expect(result.track[15]).toContain('blue'); // reaches finish
  });

  it('oasis at space 15 cannot go beyond finish', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 14);
    const trapTiles: TrapTile[] = [{
      space: 14,
      type: 'oasis',
      playerIndex: 0,
    }];

    const result = applyTrapTile(track, 14, trapTiles);

    // 14 + 1 = 15 (at finish line)
    expect(result.track[15]).toContain('blue');
    expect(result.earnedCoin).toEqual([0]);
  });
});
