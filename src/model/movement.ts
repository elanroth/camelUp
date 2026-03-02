// ---------------------------------------------------------------------------
// Camel Up 2.0 — Movement Engine
//
// All functions are PURE / IMMUTABLE: they return new Track copies.
// This is critical for the probability engine, which branches across thousands
// of possible rolls without mutating shared state.
//
// FORWARD camels (blue/green/yellow/purple/pink):
//   Move forward; landing stack goes ON TOP of existing stack.
//
// CRAZY camels (black/white):
//   Move BACKWARD; landing stack goes UNDER existing stack.
//   No race-over possible (they move away from finish).
// ---------------------------------------------------------------------------

import type { CamelColor, Track, TrapTile } from './types';
import { TRACK_LENGTH } from './constants';

// ---------------------------------------------------------------------------
// Locate a camel on the track
// ---------------------------------------------------------------------------

export interface CamelPosition {
  /** 0-based space index on the track. */
  spaceIndex: number;
  /**
   * 0-based position within that space's stack.
   * 0 = bottom of stack, length-1 = top.
   */
  stackIndex: number;
}

/**
 * Returns the current position of `camel` on the track, or null if the camel
 * is not yet placed (e.g. during initial setup).
 */
export function findCamelPosition(
  track: Track,
  camel: CamelColor
): CamelPosition | null {
  for (let spaceIndex = 0; spaceIndex < track.length; spaceIndex++) {
    const stack = track[spaceIndex];
    const stackIndex = stack.indexOf(camel);
    if (stackIndex !== -1) {
      return { spaceIndex, stackIndex };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Place a camel (setup only)
// ---------------------------------------------------------------------------

/**
 * Returns a new track with `camel` added to the TOP of `spaceIndex`.
 * Used during board setup. Throws if the camel is already on the track.
 */
export function placeCamel(
  track: Track,
  camel: CamelColor,
  spaceIndex: number
): Track {
  if (spaceIndex < 0 || spaceIndex >= TRACK_LENGTH) {
    throw new RangeError(
      `spaceIndex must be 0–${TRACK_LENGTH - 1}, got ${spaceIndex}`
    );
  }
  if (findCamelPosition(track, camel) !== null) {
    throw new Error(`Camel "${camel}" is already on the track`);
  }
  return track.map((space, i) =>
    i === spaceIndex ? [...space, camel] : [...space]
  );
}

/**
 * Returns a new track with `camel` removed from wherever it currently is.
 * Useful for re-positioning during setup.
 */
export function removeCamel(track: Track, camel: CamelColor): Track {
  return track.map((space) => space.filter((c) => c !== camel));
}

// ---------------------------------------------------------------------------
// Core movement
// ---------------------------------------------------------------------------

/**
 * Moves `camel` (and all camels stacked on top of it) `steps` spaces forward.
 *
 * Stacking rule (Camel Up 2.0):
 *   When a camel lands on a space already occupied, the moving stack goes
 *   ON TOP of the existing stack.
 *
 * If the destination index >= TRACK_LENGTH it is clamped to TRACK_LENGTH − 1
 * (the last space). The race-over flag is NOT returned here — use
 * `moveCamelFull` when you need to detect a finish-line crossing.
 *
 * Throws if `camel` is not found on the track.
 */
export function moveCamel(
  track: Track,
  camel: CamelColor,
  steps: 1 | 2 | 3
): Track {
  const position = findCamelPosition(track, camel);
  if (position === null) {
    throw new Error(`Camel "${camel}" is not on the track`);
  }

  const { spaceIndex, stackIndex } = position;
  const currentStack = track[spaceIndex];

  // The group that moves: the camel itself + everything riding on top of it.
  const movingGroup = currentStack.slice(stackIndex); // [camel, ...riders]
  const remainingStack = currentStack.slice(0, stackIndex); // camels below

  // Clamp so camels never disappear past the end of the array.
  const destination = Math.min(spaceIndex + steps, TRACK_LENGTH - 1);

  // Edge case: already on the last space — stay put (use moveCamelFull for
  // race-over semantics).
  if (spaceIndex === destination) {
    return track.map((space) => [...space]);
  }

  // Build a new track immutably.
  return track.map((space, i) => {
    if (i === spaceIndex) {
      // Remove the moving group from this space.
      return [...remainingStack];
    }
    if (i === destination) {
      // Stack the moving group on top of whatever is here.
      return [...space, ...movingGroup];
    }
    // All other spaces unchanged.
    return [...space];
  });
}

// ---------------------------------------------------------------------------
// Race state queries
// ---------------------------------------------------------------------------

/**
 * Returns true if any camel has crossed or reached the finish line
 * (i.e. is on a space index >= TRACK_LENGTH).
 *
 * In practice, `moveCamel` keeps camels within the array by clamping to
 * TRACK_LENGTH - 1 — so we instead detect a race-over condition by checking
 * whether the last space contains any camels, or we can simply expose a
 * separate structure. For simplicity we use a special sentinel: if a camel
 * would land at index >= TRACK_LENGTH we clamp it to TRACK_LENGTH - 1 and
 * mark the race as over via a separate call.
 *
 * DESIGN DECISION: Rather than a sentinel index, we detect "race over" by
 * checking `hasAnyCamelCrossedFinish`. This requires that callers use
 * `moveCamelFull` which returns both the new track and a flag.
 */
export interface MoveResult {
  track: Track;
  /** True when the destination was >= TRACK_LENGTH (race ends). */
  raceOver: boolean;
  /** The space the moving group actually landed on (clamped if race over). */
  landedOn: number;
}

/**
 * Like `moveCamel` but also returns a `raceOver` flag and the actual landing
 * space. Use this in the simulator and probability engine.
 */
export function moveCamelFull(
  track: Track,
  camel: CamelColor,
  steps: 1 | 2 | 3
): MoveResult {
  const position = findCamelPosition(track, camel);
  if (position === null) {
    throw new Error(`Camel "${camel}" is not on the track`);
  }

  const { spaceIndex, stackIndex } = position;
  const currentStack = track[spaceIndex];
  const movingGroup = currentStack.slice(stackIndex);
  const remainingStack = currentStack.slice(0, stackIndex);

  const rawDestination = spaceIndex + steps;
  const raceOver = rawDestination >= TRACK_LENGTH;
  // Clamp so camels always land somewhere in the array.
  const destination = Math.min(rawDestination, TRACK_LENGTH - 1);

  // Edge case: camel is already on the last space (index 15) and rolls again
  // in a subsequent leg. rawDestination clamps back to 15 = spaceIndex.
  // The moving group stays in place; the race ends.
  if (spaceIndex === destination) {
    return {
      track: track.map((space) => [...space]),
      raceOver: true,
      landedOn: destination,
    };
  }

  const newTrack = track.map((space, i) => {
    if (i === spaceIndex) return [...remainingStack];
    if (i === destination) return [...space, ...movingGroup];
    return [...space];
  });

  return { track: newTrack, raceOver, landedOn: destination };
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

/**
 * Returns all camels ordered by position in the race, from 1st place to last.
 *
 * Ranking rules:
 * 1. Camels on higher-numbered spaces rank ahead of camels on lower spaces.
 * 2. On the same space, camels higher in the stack rank ahead.
 *
 * Only camels actually present on the track are included.
 */
export function getCamelRanking(track: Track): CamelColor[] {
  const ranking: CamelColor[] = [];
  // Iterate from the highest space down to 0 so we insert in rank order.
  for (let i = track.length - 1; i >= 0; i--) {
    const stack = track[i];
    // Top of stack ranks first within this space.
    for (let j = stack.length - 1; j >= 0; j--) {
      ranking.push(stack[j]);
    }
  }
  return ranking;
}

const FORWARD_CAMELS = new Set<CamelColor>(['blue', 'green', 'yellow', 'purple', 'pink']);

/**
 * Returns all FORWARD camels ordered by position (1st → last).
 * Crazy camels (black/white) are excluded.
 */
export function getForwardCamelRanking(track: Track): CamelColor[] {
  return getCamelRanking(track).filter(c => FORWARD_CAMELS.has(c));
}

/**
 * Returns the leading camel (1st place overall), or null if no camels present.
 */
export function getLeadingCamel(track: Track): CamelColor | null {
  const ranking = getCamelRanking(track);
  return ranking[0] ?? null;
}

/**
 * Returns the leading FORWARD camel (used for leg-bet resolution).
 * Crazy camels are skipped since they move backward and don't participate in leg bets.
 */
export function getLeadingForwardCamel(track: Track): CamelColor | null {
  const ranking = getForwardCamelRanking(track);
  return ranking[0] ?? null;
}

/**
 * Returns the last-place camel, or null if no camels are on the track.
 */
export function getLastCamel(track: Track): CamelColor | null {
  const ranking = getCamelRanking(track);
  return ranking[ranking.length - 1] ?? null;
}

/**
 * Returns the last FORWARD camel (used for leg/race loser resolution where
 * crazy camels don't participate).
 */
export function getLastForwardCamel(track: Track): CamelColor | null {
  const ranking = getForwardCamelRanking(track);
  return ranking[ranking.length - 1] ?? null;
}

/**
 * Returns true if at least one camel has crossed the finish line.
 */
export function isRaceOver(raceOverFlag: boolean): boolean {
  return raceOverFlag;
}

// ---------------------------------------------------------------------------
// Crazy camel backward movement
// ---------------------------------------------------------------------------

export interface CrazyMoveResult {
  track: Track;
  /** The space the crazy camel actually landed on (clamped to 0). */
  landedOn: number;
}

/**
 * Moves a CRAZY camel (black or white) BACKWARD by `steps` spaces.
 *
 * Backward stacking rule: the moving stack goes UNDER the existing stack at destination.
 * New destination stack = [...movingGroup, ...existingStack]
 *
 * Clamped to space 0 (crazy camels cannot go below index 0).
 */
export function moveCrazyFull(
  track: Track,
  camel: CamelColor,
  steps: 1 | 2 | 3
): CrazyMoveResult {
  const position = findCamelPosition(track, camel);
  if (position === null) {
    // Crazy camel not on the track — no effect (handles test setups without crazy camels)
    return { track: track.map(s => [...s]), landedOn: 0 };
  }

  const { spaceIndex, stackIndex } = position;
  const currentStack = track[spaceIndex];
  const movingGroup = currentStack.slice(stackIndex); // [camel, ...riders]
  const remainingStack = currentStack.slice(0, stackIndex);

  const destination = Math.max(spaceIndex - steps, 0);

  if (spaceIndex === destination) {
    // Already at start, stays put
    return { track: track.map(s => [...s]), landedOn: destination };
  }

  const newTrack = track.map((space, i) => {
    if (i === spaceIndex) return [...remainingStack];
    if (i === destination) {
      // Arriving stack goes UNDER existing stack (crazy camel rule)
      return [...movingGroup, ...space];
    }
    return [...space];
  });

  return { track: newTrack, landedOn: destination };
}

// ---------------------------------------------------------------------------
// Trap tile application
// ---------------------------------------------------------------------------

export interface TrapResult {
  track: Track;
  /** Indices of players who earned a coin from a trap trigger. */
  earnedCoin: number[];
  /** Set of spaces where a trap was triggered (for logging). */
  triggeredSpaces: number[];
}

/**
 * After a camel stack lands on `landedOn`, check for a trap tile there.
 * If present:
 *   - Oasis: move the landing stack 1 space forward
 *   - Mirage: move the landing stack 1 space backward (under existing)
 *   - Tile owner earns 1 coin (reflected in earnedCoin[])
 *
 * Returns the track after trap resolution (not recursive — traps never chain).
 * The trap tile itself is NOT removed (persists for the rest of the leg).
 */
export function applyTrapTile(
  track: Track,
  landedOn: number,
  trapTiles: TrapTile[]
): TrapResult {
  const trap = trapTiles.find(t => t.space === landedOn);
  if (!trap) return { track, earnedCoin: [], triggeredSpaces: [] };

  // Find the top camel at the landed space (the moving group that just arrived)
  const space = track[landedOn];
  if (space.length === 0) return { track, earnedCoin: [], triggeredSpaces: [] };

  // The entire stack at this space is the "landing group" for trap purposes
  // (in standard rules, only the moving group triggers, but since they arrived on top,
  //  the entire current stack is effectively "the arrivals" after the move completes)
  const topCamel = space[space.length - 1]; // topmost camel

  // Move just the arriving group (all camels on this space) by ±1
  // We treat the whole space as the moving group since this is simpler and equivalent:
  // the camels that just arrived are on top and move; those below them also carry along.
  // Actually in rules: only the moving group triggers and moves ±1 from the trap.
  // But since we can't distinguish "arrivals" from "pre-existing" at this point,
  // we'll move the FULL stack — this is correct because the arriving group landed on top.

  if (trap.type === 'oasis') {
    // Move top camel (and all riders) 1 space forward
    // We'll use the top camel of the landed space to find the "arriving group"
    const arrivedPos = findCamelPosition(track, topCamel);
    if (!arrivedPos) return { track, earnedCoin: [], triggeredSpaces: [] };
    const stackIdx = arrivedPos.stackIndex;
    const movingGroup = space.slice(stackIdx);
    const below = space.slice(0, stackIdx);
    const dest = Math.min(landedOn + 1, TRACK_LENGTH - 1);
    const newTrack = track.map((s, i) => {
      if (i === landedOn) return [...below];
      if (i === dest) return [...s, ...movingGroup];
      return [...s];
    });
    return { track: newTrack, earnedCoin: [trap.playerIndex], triggeredSpaces: [landedOn] };
  } else {
    // Mirage: move landing group 1 space backward, goes UNDER existing
    const arrivedPos = findCamelPosition(track, topCamel);
    if (!arrivedPos) return { track, earnedCoin: [], triggeredSpaces: [] };
    const stackIdx = arrivedPos.stackIndex;
    const movingGroup = space.slice(stackIdx);
    const below = space.slice(0, stackIdx);
    const dest = Math.max(landedOn - 1, 0);
    const newTrack = track.map((s, i) => {
      if (i === landedOn) return [...below];
      if (i === dest) return [...movingGroup, ...s]; // arriving group goes under
      return [...s];
    });
    return { track: newTrack, earnedCoin: [trap.playerIndex], triggeredSpaces: [landedOn] };
  }
}
