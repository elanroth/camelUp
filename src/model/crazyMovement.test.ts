// ---------------------------------------------------------------------------
// Crazy Camel Movement Tests
// Tests for backward-moving crazy camels (black & white)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createEmptyTrack } from './constants';
import {
  placeCamel,
  moveCrazyFull,
  findCamelPosition,
  getCamelRanking,
  getForwardCamelRanking,
} from './movement';

describe('moveCrazyFull — backward movement', () => {
  it('moves crazy camel backward by the given steps', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 5);
    
    const result = moveCrazyFull(track, 'black', 2);
    
    const pos = findCamelPosition(result.track, 'black');
    expect(pos).not.toBeNull();
    expect(pos!.spaceIndex).toBe(3); // 5 - 2 = 3
    expect(result.landedOn).toBe(3);
  });

  it('clamps to space 0 when moving beyond start', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'white', 1);
    
    const result = moveCrazyFull(track, 'white', 3);
    
    const pos = findCamelPosition(result.track, 'white');
    expect(pos!.spaceIndex).toBe(0);
    expect(result.landedOn).toBe(0);
  });

  it('stays at space 0 when already at start', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    
    const result = moveCrazyFull(track, 'black', 2);
    
    const pos = findCamelPosition(result.track, 'black');
    expect(pos!.spaceIndex).toBe(0);
  });

  it('moves riders along with the crazy camel', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 5);
    track = placeCamel(track, 'blue', 5);
    track = placeCamel(track, 'green', 5);
    // Stack: black (bottom), blue, green (top)
    
    const result = moveCrazyFull(track, 'black', 2);
    
    // All three should move together
    expect(findCamelPosition(result.track, 'black')!.spaceIndex).toBe(3);
    expect(findCamelPosition(result.track, 'blue')!.spaceIndex).toBe(3);
    expect(findCamelPosition(result.track, 'green')!.spaceIndex).toBe(3);
    
    // Stack order preserved: [black, blue, green]
    expect(result.track[3]).toEqual(['black', 'blue', 'green']);
  });

  it('under-stacks when landing on occupied space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 3);
    track = placeCamel(track, 'green', 3);
    track = placeCamel(track, 'black', 6);
    // Space 3: [blue, green]
    // Space 6: [black]
    
    const result = moveCrazyFull(track, 'black', 3); // lands on 3
    
    // Black should be UNDER blue
    expect(result.track[3]).toEqual(['black', 'blue', 'green']);
  });

  it('under-stacks with riders when landing on occupied space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'black', 5);
    track = placeCamel(track, 'white', 5);
    // Space 2: [purple]
    // Space 5: [black, white]
    
    const result = moveCrazyFull(track, 'black', 3); // lands on 2 with white riding
    
    // [black, white] go UNDER purple
    expect(result.track[2]).toEqual(['black', 'white', 'purple']);
  });

  it('gracefully returns when camel is not on track', () => {
    const track = createEmptyTrack();
    
    const result = moveCrazyFull(track, 'black', 2);
    
    // Should return track unchanged with landedOn = 0
    expect(result.landedOn).toBe(0);
    expect(result.track).toEqual(track);
  });
});

describe('getForwardCamelRanking — excludes crazy camels', () => {
  it('returns only forward camels in ranking order', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 10);
    track = placeCamel(track, 'blue', 8);
    track = placeCamel(track, 'white', 6);
    track = placeCamel(track, 'green', 4);
    
    const ranking = getForwardCamelRanking(track);
    
    // Should only include blue and green, NOT black/white
    expect(ranking).toEqual(['blue', 'green']);
  });

  it('respects stack order for forward camels', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    track = placeCamel(track, 'green', 5);
    track = placeCamel(track, 'black', 5);
    track = placeCamel(track, 'yellow', 5);
    // Stack: [blue, green, black, yellow]
    
    const ranking = getForwardCamelRanking(track);
    
    // yellow on top, then black (excluded), then green, then blue
    expect(ranking[0]).toBe('yellow');
    expect(ranking[1]).toBe('green');
    expect(ranking[2]).toBe('blue');
    expect(ranking.length).toBe(3); // no black
  });

  it('returns empty array when no forward camels on track', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 3);
    track = placeCamel(track, 'white', 1);
    
    const ranking = getForwardCamelRanking(track);
    
    expect(ranking).toEqual([]);
  });
});

describe('getCamelRanking — includes all camels', () => {
  it('includes both forward and crazy camels', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 10);
    track = placeCamel(track, 'blue', 8);
    track = placeCamel(track, 'white', 6);
    
    const ranking = getCamelRanking(track);
    
    expect(ranking).toEqual(['black', 'blue', 'white']);
  });

  it('places crazy camels in correct rank when mixed with forward camels', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 5);
    track = placeCamel(track, 'black', 3);
    track = placeCamel(track, 'green', 1);
    
    const ranking = getCamelRanking(track);
    
    expect(ranking).toEqual(['blue', 'black', 'green']);
  });
});

describe('crazy camels — advanced scenarios', () => {
  it('crazy camel can overtake forward camels when moving backward under them', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 3);
    track = placeCamel(track, 'green', 3);
    // Stack at 3: [blue, green]
    track = placeCamel(track, 'black', 5);
    
    // Black moves backward 2 to space 3, goes UNDER [blue, green]
    const result = moveCrazyFull(track, 'black', 2);
    
    expect(result.track[3]).toEqual(['black', 'blue', 'green']);
    
    // In overall ranking including crazy, black is now at bottom of space 3
    const allRanking = getCamelRanking(result.track);
    expect(allRanking.indexOf('green')).toBeLessThan(allRanking.indexOf('blue'));
    expect(allRanking.indexOf('blue')).toBeLessThan(allRanking.indexOf('black'));
  });

  it('multiple crazy camels can stack', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 5);
    track = placeCamel(track, 'white', 8);
    
    // White moves backward to join black
    const result = moveCrazyFull(track, 'white', 3);
    
    // white should be under black (or on top if white was already below)
    // Actually: white lands on 5, goes UNDER existing stack
    expect(result.track[5]).toEqual(['white', 'black']);
  });

  it('crazy camel moving backward from space 0 stays at 0', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    
    const result = moveCrazyFull(track, 'black', 1);
    
    expect(findCamelPosition(result.track, 'black')!.spaceIndex).toBe(0);
  });
});
