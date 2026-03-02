import { describe, it, expect } from 'vitest';
import {
  findCamelPosition,
  placeCamel,
  removeCamel,
  moveCamel,
  moveCamelFull,
  getCamelRanking,
  getLeadingCamel,
  getLastCamel,
} from './movement';
import { createEmptyTrack, TRACK_LENGTH } from './constants';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function setupTrack() {
  // Puts camels in known positions for tests:
  //  space 0: [purple] (bottom only)
  //  space 1: [green, blue] (green bottom, blue top)
  //  space 3: [yellow]
  let track = createEmptyTrack();
  track = placeCamel(track, 'purple', 0);
  track = placeCamel(track, 'green', 1);
  track = placeCamel(track, 'blue', 1);
  track = placeCamel(track, 'yellow', 3);
  return track;
}

// ---------------------------------------------------------------------------
// findCamelPosition
// ---------------------------------------------------------------------------

describe('findCamelPosition', () => {
  it('finds a camel alone on a space', () => {
    const track = setupTrack();
    const pos = findCamelPosition(track, 'purple');
    expect(pos).toEqual({ spaceIndex: 0, stackIndex: 0 });
  });

  it('finds the bottom camel in a stack', () => {
    const track = setupTrack();
    const pos = findCamelPosition(track, 'green');
    expect(pos).toEqual({ spaceIndex: 1, stackIndex: 0 });
  });

  it('finds the top camel in a stack', () => {
    const track = setupTrack();
    const pos = findCamelPosition(track, 'blue');
    expect(pos).toEqual({ spaceIndex: 1, stackIndex: 1 });
  });

  it('returns null for a camel not on the track', () => {
    const track = setupTrack();
    const pos = findCamelPosition(track, 'pink');
    expect(pos).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// placeCamel
// ---------------------------------------------------------------------------

describe('placeCamel', () => {
  it('places a camel at the given space', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 5);
    expect(track[5]).toEqual(['pink']);
  });

  it('places on top of an existing camel', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'pink', 2);
    expect(track[2]).toEqual(['purple', 'pink']);
  });

  it('does not mutate the original track', () => {
    const original = createEmptyTrack();
    placeCamel(original, 'pink', 5);
    expect(original[5]).toEqual([]);
  });

  it('throws if camel is already on the track', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 5);
    expect(() => placeCamel(track, 'pink', 6)).toThrow();
  });

  it('throws for an out-of-range space index', () => {
    const track = createEmptyTrack();
    expect(() => placeCamel(track, 'pink', -1)).toThrow();
    expect(() => placeCamel(track, 'pink', 16)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// removeCamel
// ---------------------------------------------------------------------------

describe('removeCamel', () => {
  it('removes a camel from its space', () => {
    const track = setupTrack();
    const newTrack = removeCamel(track, 'purple');
    expect(newTrack[0]).toEqual([]);
  });

  it('removes only the target camel from a stack', () => {
    const track = setupTrack();
    const newTrack = removeCamel(track, 'green');
    // blue should remain
    expect(newTrack[1]).toEqual(['blue']);
  });

  it('does not mutate the original track', () => {
    const track = setupTrack();
    removeCamel(track, 'purple');
    expect(track[0]).toEqual(['purple']);
  });

  it('is a no-op if the camel is not on the track', () => {
    const track = setupTrack();
    const newTrack = removeCamel(track, 'pink');
    // track should be identical in content
    expect(newTrack[0]).toEqual(['purple']);
    expect(newTrack[1]).toEqual(['green', 'blue']);
  });
});

// ---------------------------------------------------------------------------
// moveCamel — basic movement
// ---------------------------------------------------------------------------

describe('moveCamel — alone on space', () => {
  it('moves a lone camel forward by steps', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    const next = moveCamel(track, 'purple', 2);
    expect(next[0]).toEqual([]);
    expect(next[2]).toEqual(['purple']);
  });

  it('does not mutate the original track', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 0);
    moveCamel(track, 'purple', 2);
    expect(track[0]).toEqual(['purple']);
    expect(track[2]).toEqual([]);
  });
});

describe('moveCamel — stacking rules', () => {
  it('carries riders when bottom-of-stack camel moves', () => {
    // green (bottom) + blue (top) on space 1
    // moving green by 2 → both end up on space 3
    const track = setupTrack();
    const next = moveCamel(track, 'green', 2);
    expect(next[1]).toEqual([]);          // vacated
    expect(next[3]).toContain('green');
    expect(next[3]).toContain('blue');
    // green still below blue
    expect(next[3].indexOf('green')).toBeLessThan(next[3].indexOf('blue'));
  });

  it('does NOT carry camels below when top-of-stack camel moves', () => {
    // green (bottom) + blue (top) on space 1
    // moving blue by 2 → only blue moves, green stays
    const track = setupTrack();
    const next = moveCamel(track, 'blue', 2);
    expect(next[1]).toEqual(['green']);   // green stays behind
    expect(next[3]).toContain('blue');
    expect(next[3]).not.toContain('green');
  });

  it('places moving stack on TOP of an existing stack', () => {
    // space 1: [green, blue]; space 3: [yellow]
    // move green by 2 → space 3 should be [yellow, green, blue]
    const track = setupTrack();
    const next = moveCamel(track, 'green', 2);
    expect(next[3]).toEqual(['yellow', 'green', 'blue']);
  });

  it('places moving stack on TOP even when landing on a single camel', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 4);
    track = placeCamel(track, 'purple', 2);
    const next = moveCamel(track, 'purple', 2);
    // purple lands on 4 where pink is, purple goes on top
    expect(next[4]).toEqual(['pink', 'purple']);
  });
});

// ---------------------------------------------------------------------------
// moveCamelFull — race-over detection
// ---------------------------------------------------------------------------

describe('moveCamelFull', () => {
  it('returns raceOver=false for a normal move', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 10);
    const result = moveCamelFull(track, 'purple', 2);
    expect(result.raceOver).toBe(false);
    expect(result.landedOn).toBe(12);
  });

  it('returns raceOver=true when crossing finish line', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 14);
    const result = moveCamelFull(track, 'purple', 3); // would land on 17
    expect(result.raceOver).toBe(true);
  });

  it('returns raceOver=true exactly on TRACK_LENGTH', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 13);
    const result = moveCamelFull(track, 'purple', 3); // lands on 16 = TRACK_LENGTH
    expect(result.raceOver).toBe(true);
  });

  it('clamps landing space to TRACK_LENGTH - 1', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 14);
    const result = moveCamelFull(track, 'purple', 3);
    expect(result.landedOn).toBe(15); // clamped to 15
    expect(result.track[15]).toContain('purple');
  });

  it('throws if camel is not on the track', () => {
    const track = createEmptyTrack();
    expect(() => moveCamelFull(track, 'purple', 1)).toThrow();
  });

  it('camel already at space 15 rolling again stays put and sets raceOver=true', () => {
    // Regression: when spaceIndex === destination (clamped), the moving group
    // must NOT be discarded — camel stays at space 15 and race ends.
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 15);
    track = placeCamel(track, 'pink', 5);

    const result = moveCamelFull(track, 'purple', 3); // rawDest=18 → clamped to 15
    expect(result.raceOver).toBe(true);
    expect(result.landedOn).toBe(15);
    // purple must still be on the track at space 15
    expect(result.track[15]).toContain('purple');
    // pink is unaffected
    expect(result.track[5]).toContain('pink');
  });
});

// ---------------------------------------------------------------------------
// getCamelRanking
// ---------------------------------------------------------------------------

describe('getCamelRanking', () => {
  it('ranks camel on higher space first', () => {
    //  space 1: [purple], space 3: [pink]
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 1);
    track = placeCamel(track, 'pink', 3);
    const ranking = getCamelRanking(track);
    expect(ranking[0]).toBe('pink');
    expect(ranking[1]).toBe('purple');
  });

  it('ranks top-of-stack before bottom on same space', () => {
    // space 2: [green (bottom), blue (top)]
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 2);
    const ranking = getCamelRanking(track);
    expect(ranking[0]).toBe('blue');
    expect(ranking[1]).toBe('green');
  });

  it('handles the full setup track correctly', () => {
    //  space 0: [purple]
    //  space 1: [green, blue]
    //  space 3: [yellow]
    const track = setupTrack();
    const ranking = getCamelRanking(track);
    expect(ranking[0]).toBe('yellow'); // furthest ahead
    expect(ranking[1]).toBe('blue');   // top of space 1 stack
    expect(ranking[2]).toBe('green');  // bottom of space 1 stack
    expect(ranking[3]).toBe('purple');  // space 0
  });

  it('returns empty array when no camels are on the track', () => {
    const track = createEmptyTrack();
    expect(getCamelRanking(track)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLeadingCamel / getLastCamel
// ---------------------------------------------------------------------------

describe('getLeadingCamel', () => {
  it('returns the camel furthest ahead', () => {
    const track = setupTrack();
    expect(getLeadingCamel(track)).toBe('yellow');
  });

  it('returns null on empty track', () => {
    expect(getLeadingCamel(createEmptyTrack())).toBeNull();
  });
});

describe('getLastCamel', () => {
  it('returns the camel furthest behind', () => {
    const track = setupTrack();
    expect(getLastCamel(track)).toBe('purple');
  });

  it('returns null on empty track', () => {
    expect(getLastCamel(createEmptyTrack())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// moveCamel — finish-line clamping (fixed bug: previously silently dropped camels)
// ---------------------------------------------------------------------------

describe('moveCamel — finish-line clamping', () => {
  it('camel at space 14 rolling 3 clamps to space 15, does not disappear', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 14);
    const next = moveCamel(track, 'purple', 3); // raw dest = 17 → clamped to 15
    expect(next[14]).toEqual([]);
    expect(next[15]).toContain('purple');
  });

  it('camel at space 13 rolling 3 clamps to space 15', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 13);
    const next = moveCamel(track, 'pink', 3); // raw dest = 16 → clamped to 15
    expect(next[13]).toEqual([]);
    expect(next[15]).toContain('pink');
  });

  it('camel at space 15 rolling any amount stays at space 15 (spaceIndex === destination edge case)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 15);
    const next = moveCamel(track, 'purple', 1);
    expect(next[15]).toContain('purple');
  });

  it('clamped camel stacks on top of existing camels at space 15', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'pink', 15);
    track = placeCamel(track, 'purple', 13);
    const next = moveCamel(track, 'purple', 3); // raw dest = 16 → 15
    expect(next[15]).toEqual(['pink', 'purple']); // purple on top of pink
  });

  it('carries riders when moving stack clamps at finish', () => {
    // green (bottom) + blue (top) at space 14; roll 3 → clamp to 15
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 14);
    track = placeCamel(track, 'blue', 14);
    const next = moveCamel(track, 'green', 3);
    expect(next[14]).toEqual([]);
    expect(next[15]).toEqual(['green', 'blue']);
  });

  it('does not mutate the original track when clamping', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 14);
    moveCamel(track, 'purple', 3);
    expect(track[14]).toContain('purple');
    expect(track[15]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// moveCamel — 3-camel stacks
// ---------------------------------------------------------------------------

describe('moveCamel — 3-camel stacks', () => {
  it('moving the bottom of a 3-camel stack carries all riders', () => {
    // space 2: [purple (btm), green, blue (top)]
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 2);
    const next = moveCamel(track, 'purple', 3);
    expect(next[2]).toEqual([]);
    expect(next[5]).toEqual(['purple', 'green', 'blue']);
  });

  it('moving the middle of a 3-camel stack carries only the top', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 2);
    const next = moveCamel(track, 'green', 3);
    expect(next[2]).toEqual(['purple']); // purple stays
    expect(next[5]).toEqual(['green', 'blue']); // green + blue move
  });

  it('moving top of 3-camel stack leaves the other two behind', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 2);
    const next = moveCamel(track, 'blue', 2);
    expect(next[2]).toEqual(['purple', 'green']); // bottom two stay
    expect(next[4]).toEqual(['blue']);
  });

  it('mid-stack move onto an occupied space stacks correctly', () => {
    // space 2: [purple, green, blue]; space 5: [yellow]
    // move green (index 1) by 3 → green+blue land on 5, stacking on yellow
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 2);
    track = placeCamel(track, 'green', 2);
    track = placeCamel(track, 'blue', 2);
    track = placeCamel(track, 'yellow', 5);
    const next = moveCamel(track, 'green', 3);
    expect(next[2]).toEqual(['purple']);
    expect(next[5]).toEqual(['yellow', 'green', 'blue']);
  });
});

// ---------------------------------------------------------------------------
// moveCamelFull — carrying stacks across the finish line
// ---------------------------------------------------------------------------

describe('moveCamelFull — stack crossing finish line', () => {
  it('entire 2-camel stack lands at space 15 when crossing finish', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 13);
    track = placeCamel(track, 'blue', 13); // blue on top
    const result = moveCamelFull(track, 'green', 3); // raw = 16 → clamped to 15
    expect(result.raceOver).toBe(true);
    expect(result.landedOn).toBe(15);
    expect(result.track[13]).toEqual([]);
    expect(result.track[15]).toEqual(['green', 'blue']);
  });

  it('top-of-stack camel that crosses the finish is the race winner', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 13);
    track = placeCamel(track, 'pink', 13); // pink on top
    const result = moveCamelFull(track, 'purple', 3);
    expect(result.raceOver).toBe(true);
    const winner = getLeadingCamel(result.track);
    expect(winner).toBe('pink'); // pink is on top after move
  });

  it('raceOver=false when landing exactly on space 15 (dest < TRACK_LENGTH)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 14);
    const result = moveCamelFull(track, 'purple', 1); // dest = 15, not raceOver
    expect(result.raceOver).toBe(false);
    expect(result.landedOn).toBe(15);
  });

  it('raceOver=true when dest is exactly TRACK_LENGTH (= 16)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', TRACK_LENGTH - 3); // space 13
    const result = moveCamelFull(track, 'purple', 3); // 13+3 = 16 = TRACK_LENGTH
    expect(result.raceOver).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCamelRanking — crazy camels present
// ---------------------------------------------------------------------------

describe('getCamelRanking — crazy camels and boundary cases', () => {
  it('includes black camel in ranking when on the track', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 3);
    track = placeCamel(track, 'pink', 5);
    const ranking = getCamelRanking(track);
    expect(ranking).toContain('black');
    expect(ranking).toContain('pink');
    expect(ranking[0]).toBe('pink'); // higher space
    expect(ranking[1]).toBe('black');
  });

  it('black at space 0, white at space 1 — white ranks ahead', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    track = placeCamel(track, 'white', 1);
    const ranking = getCamelRanking(track);
    expect(ranking[0]).toBe('white');
    expect(ranking[1]).toBe('black');
  });

  it('single camel returns a 1-element ranking', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'green', 7);
    expect(getCamelRanking(track)).toEqual(['green']);
  });

  it('getLeadingCamel returns black when black is furthest ahead', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 10);
    track = placeCamel(track, 'pink', 3);
    expect(getLeadingCamel(track)).toBe('black');
  });

  it('getLastCamel returns black when black is furthest behind', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 0);
    track = placeCamel(track, 'green', 8);
    expect(getLastCamel(track)).toBe('black');
  });
});

// ---------------------------------------------------------------------------
// findCamelPosition — boundary spaces
// ---------------------------------------------------------------------------

describe('findCamelPosition — boundary spaces', () => {
  it('finds a camel at space 0', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'blue', 0);
    expect(findCamelPosition(track, 'blue')).toEqual({ spaceIndex: 0, stackIndex: 0 });
  });

  it('finds a camel at space 15 (last space)', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'purple', 15);
    expect(findCamelPosition(track, 'purple')).toEqual({ spaceIndex: 15, stackIndex: 0 });
  });

  it('finds a black (crazy) camel by position', () => {
    let track = createEmptyTrack();
    track = placeCamel(track, 'black', 6);
    expect(findCamelPosition(track, 'black')).toEqual({ spaceIndex: 6, stackIndex: 0 });
  });
});
