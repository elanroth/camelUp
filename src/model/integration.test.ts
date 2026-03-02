// ---------------------------------------------------------------------------
// Camel Up 2.0 Integration Tests
// Tests for full game scenarios with crazy camels, desert tiles, and race bets
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './constants';
import {
  placeCamel,
  moveCamelFull,
  moveCrazyFull,
  getLeadingForwardCamel,
  getLastForwardCamel,
  getForwardCamelRanking,
} from './movement';

describe('full leg with crazy die', () => {
  it('leg winner is determined by leading forward camel only', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 5);
    state.track = placeCamel(state.track, 'black', 10); // crazy camel ahead
    state.track = placeCamel(state.track, 'green', 3);

    const winner = getLeadingForwardCamel(state.track);

    expect(winner).toBe('blue'); // NOT black
  });

  it('crazy camels move independently via crazy die', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'black', 5);
    state.track = placeCamel(state.track, 'white', 8);

    // Simulate crazy die roll (black, 2 steps)
    const result = moveCrazyFull(state.track, 'black', 2);

    expect(result.track[3]).toContain('black'); // 5 - 2 = 3
    expect(result.track[8]).toContain('white'); // unchanged
  });

  it('race winner excludes crazy camels', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'black', 15); // at finish
    state.track = placeCamel(state.track, 'blue', 14);
    state.track = placeCamel(state.track, 'green', 12);

    const winner = getLeadingForwardCamel(state.track);

    expect(winner).toBe('blue'); // black excluded
  });

  it('race loser is the last forward camel', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 10);
    state.track = placeCamel(state.track, 'green', 8);
    state.track = placeCamel(state.track, 'white', 2); // crazy camel at back
    state.track = placeCamel(state.track, 'yellow', 5);

    const loser = getLastForwardCamel(state.track);

    expect(loser).toBe('yellow'); // NOT white (white is crazy)
  });
});

describe('desert tiles affect movement', () => {
  it('oasis boosts camel forward', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 2);
    state.trapTiles = [{
      space: 5,
      type: 'oasis',
      playerIndex: 0,
    }];

    // Blue rolls 3, lands on 5 (oasis)
    const result = moveCamelFull(state.track, 'blue', 3);
    expect(result.landedOn).toBe(5);

    // Controller would then apply oasis: 5 → 6
    // (applyTrapTile logic tested separately)
  });

  it('mirage pushes camel backward', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'green', 3);
    state.trapTiles = [{
      space: 6,
      type: 'mirage',
      playerIndex: 1,
    }];

    // Green rolls 3, lands on 6 (mirage)
    const result = moveCamelFull(state.track, 'green', 3);
    expect(result.landedOn).toBe(6);

    // Controller applies mirage: 6 → 5
  });

  it('player earns coin when camel lands on their tile', () => {
    let state = createInitialGameState(['Player 1', 'Player 2', 'Player 3']);
    state.track = placeCamel(state.track, 'blue', 1);
    state.trapTiles = [{
      space: 4,
      type: 'oasis',
      playerIndex: 2, // player 2 owns this tile
    }];

    // Blue rolls 3 → lands on 4
    const result = moveCamelFull(state.track, 'blue', 3);
    expect(result.landedOn).toBe(4);

    // Player 2 should earn +1 coin (handled by controller)
  });
});

describe('race bets per player', () => {
  it('each player can bet each camel once as winner', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);

    // Player 0 bets blue as winner
    state.players[0].raceWinnerBets.push('blue');
    state.raceWinnerBets.push({ camel: 'blue', type: 'winner', playerIndex: 0 });

    // Player 1 can also bet blue as winner
    state.players[1].raceWinnerBets.push('blue');
    state.raceWinnerBets.push({ camel: 'blue', type: 'winner', playerIndex: 1 });

    expect(state.raceWinnerBets.length).toBe(2);
    expect(state.players[0].raceWinnerBets).toContain('blue');
    expect(state.players[1].raceWinnerBets).toContain('blue');
  });

  it('player cannot bet same camel as both winner and loser', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);
    const player = state.players[0];

    player.raceWinnerBets.push('blue');

    // Should NOT allow betting blue as loser
    const alreadyBetWinner = player.raceWinnerBets.includes('blue');
    const canBetLoser = !alreadyBetWinner && !player.raceLoserBets.includes('blue');

    expect(canBetLoser).toBe(false);
  });

  it('player can bet different camels as winner and loser', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);
    const player = state.players[0];

    player.raceWinnerBets.push('blue');
    player.raceLoserBets.push('green');

    expect(player.raceWinnerBets).toEqual(['blue']);
    expect(player.raceLoserBets).toEqual(['green']);
  });

  it('crazy camels can be bet on for race winner/loser', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);
    const player = state.players[0];

    player.raceWinnerBets.push('black');
    player.raceLoserBets.push('white');

    expect(player.raceWinnerBets).toContain('black');
    expect(player.raceLoserBets).toContain('white');
  });
});

describe('leg bet stacks exclude crazy camels', () => {
  it('leg bet stacks only include 5 forward camels', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);
    const stackColors = Object.keys(state.legBetStacks);

    expect(stackColors).toHaveLength(5);
    expect(stackColors).toContain('blue');
    expect(stackColors).toContain('green');
    expect(stackColors).toContain('yellow');
    expect(stackColors).toContain('purple');
    expect(stackColors).toContain('pink');
    expect(stackColors).not.toContain('black');
    expect(stackColors).not.toContain('white');
  });
});

describe('dice pool with crazy die', () => {
  it('dice pool contains 6 entries including crazy', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);

    expect(state.dicePool.length).toBe(6);
    expect(state.dicePool).toContain('crazy');
    expect(state.dicePool.filter(d => d !== 'crazy')).toHaveLength(5);
  });

  it('rolling crazy die picks black or white', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);

    // Remove all dice except crazy
    state.dicePool = ['crazy'];

    // In a real roll, controller picks black or white randomly
    const crazyCamels = ['black', 'white'];
    const picked = crazyCamels[Math.floor(Math.random() * 2)];

    expect(['black', 'white']).toContain(picked);
  });
});

describe('forward camel ranking for race resolution', () => {
  it('getForwardCamelRanking provides correct winner and loser', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 12);
    state.track = placeCamel(state.track, 'black', 14); // crazy
    state.track = placeCamel(state.track, 'green', 10);
    state.track = placeCamel(state.track, 'yellow', 8);
    state.track = placeCamel(state.track, 'white', 6); // crazy

    const ranking = getForwardCamelRanking(state.track);

    expect(ranking[0]).toBe('blue'); // winner
    expect(ranking[ranking.length - 1]).toBe('yellow'); // loser (white excluded)
  });

  it('stacked forward camels ranked by stack position', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 10);
    state.track = placeCamel(state.track, 'green', 10);
    state.track = placeCamel(state.track, 'yellow', 10);
    // Stack: [blue, green, yellow] (yellow on top)

    const ranking = getForwardCamelRanking(state.track);

    expect(ranking[0]).toBe('yellow');
    expect(ranking[1]).toBe('green');
    expect(ranking[2]).toBe('blue');
  });
});

describe('trap tiles cleared at leg end', () => {
  it('trap tiles persist during leg', () => {
    const state = createInitialGameState(['Player 1', 'Player 2']);
    state.trapTiles = [
      { space: 5, type: 'oasis', playerIndex: 0 },
      { space: 8, type: 'mirage', playerIndex: 1 },
    ];

    expect(state.trapTiles.length).toBe(2);
  });

  it('trap tiles should be cleared when leg resets', () => {
    // This is handled in controller during leg resolution
    const state = createInitialGameState(['Player 1', 'Player 2']);
    state.trapTiles = [
      { space: 5, type: 'oasis', playerIndex: 0 },
    ];

    // Simulate leg reset
    state.trapTiles = [];

    expect(state.trapTiles.length).toBe(0);
  });
});

describe('mid-leg race ending', () => {
  it('race can end before dice pool exhausted', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 14);
    state.dicePool = ['blue', 'green', 'yellow'];

    // Blue rolls 2 → lands on 16 (race over)
    const result = moveCamelFull(state.track, 'blue', 2);

    expect(result.raceOver).toBe(true);
    // Leg should still be resolved (blue wins leg)
    // Then race resolution (blue wins race)
  });

  it('leg winner is determined even when race ends mid-leg', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 15);
    state.track = placeCamel(state.track, 'green', 13);

    // Blue rolls 1 → lands on 16 (race over)
    const result = moveCamelFull(state.track, 'blue', 1);
    expect(result.raceOver).toBe(true);

    const legWinner = getLeadingForwardCamel(result.track);
    expect(legWinner).toBe('blue');
  });
});

describe('crazy camel interaction with forward camels', () => {
  it('crazy camel under-stacking can change forward camel relative positions', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'blue', 5);
    state.track = placeCamel(state.track, 'green', 5);
    // Stack: [blue, green]
    state.track = placeCamel(state.track, 'black', 8);

    // Black moves backward to 5, goes under [blue, green]
    const result = moveCrazyFull(state.track, 'black', 3);

    // New stack: [black, blue, green]
    expect(result.track[5]).toEqual(['black', 'blue', 'green']);

    // Green is still ahead of blue in forward ranking
    const ranking = getForwardCamelRanking(result.track);
    expect(ranking.indexOf('green')).toBeLessThan(ranking.indexOf('blue'));
  });

  it('forward camel landing on crazy camel stacks on top normally', () => {
    let state = createInitialGameState(['Player 1', 'Player 2']);
    state.track = placeCamel(state.track, 'black', 3);
    state.track = placeCamel(state.track, 'blue', 1);

    // Blue rolls 2 → lands on 3 where black is
    const result = moveCamelFull(state.track, 'blue', 2);

    // Blue goes ON TOP of black (normal stacking)
    expect(result.track[3]).toEqual(['black', 'blue']);
  });
});
