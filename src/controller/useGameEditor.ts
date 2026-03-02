// ---------------------------------------------------------------------------
// useGameEditor — mutable board-state hook for the editor
// ---------------------------------------------------------------------------
// All 5 camels must always be on the track (the board editor never "removes"
// a camel to limbo; it just moves it to a different space).
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import type { CamelColor, GameState, Track, DicePool } from '../model/types';
import { CAMEL_COLORS, CRAZY_CAMELS, createInitialGameState } from '../model/constants';
import { findCamelPosition, placeCamel } from '../model/movement';

// ---------------------------------------------------------------------------
// Internal helpers (pure)
// ---------------------------------------------------------------------------

/** Remove a camel from whichever space it's on; no-op if not found. */
function removeCamelFromTrack(track: Track, camel: CamelColor): Track {
  return track.map(space => space.filter(c => c !== camel));
}

/** Add a camel to the TOP of the given space. */
function addCamelToTop(track: Track, camel: CamelColor, spaceIndex: number): Track {
  return track.map((space, i) =>
    i === spaceIndex ? [...space, camel] : space
  );
}

/** Add a camel to the BOTTOM of the given space. */
function addCamelToBottom(track: Track, camel: CamelColor, spaceIndex: number): Track {
  return track.map((space, i) =>
    i === spaceIndex ? [camel, ...space] : space
  );
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EditorActions {
  /** Current (mutable) game state the editor controls. */
  state: GameState;

  /**
   * Move `camel` to `spaceIndex`.
   * `position` = 'top' (default) | 'bottom'  — where in the destination stack.
   */
  setCamelSpace: (camel: CamelColor, spaceIndex: number, position?: 'top' | 'bottom') => void;

  /**
   * Move `camel` one position up or down within its current stack.
   * No-op if already at the boundary.
   */
  moveCamelInStack: (camel: CamelColor, dir: 'up' | 'down') => void;

  /**
   * Toggle `camel` between "die in pool" (not yet rolled) and "die spent"
   * (already rolled this leg).
   */
  toggleDie: (camel: CamelColor) => void;

  /** Reset to a clean initial state (all camels at space 0, all dice in pool). */
  reset: () => void;

  /** Directly replace the state (e.g. to load a preset). */
  loadState: (s: GameState) => void;
}

// ---------------------------------------------------------------------------
// Default starting track: one camel per space 0-4 (easily editable from there)
// ---------------------------------------------------------------------------

function buildDefaultTrack(): Track {
  let t: Track = Array.from({ length: 16 }, () => []);
  // Place forward camels spread out so the board is immediately interesting
  CAMEL_COLORS.forEach((color, i) => {
    t = placeCamel(t, color, i);
  });
  // Place crazy camels
  CRAZY_CAMELS.forEach((color, i) => {
    t = placeCamel(t, color, i + 5);
  });
  return t;
}

function buildDefaultState(): GameState {
  const base = createInitialGameState(['Alice', 'Bob']);
  return { ...base, track: buildDefaultTrack() };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameEditor(initial?: GameState): EditorActions {
  const [state, setState] = useState<GameState>(() => initial ?? buildDefaultState());

  const setCamelSpace = useCallback(
    (camel: CamelColor, spaceIndex: number, position: 'top' | 'bottom' = 'top') => {
      setState(prev => {
        const noCalmel = removeCamelFromTrack(prev.track, camel);
        const updated =
          position === 'top'
            ? addCamelToTop(noCalmel, camel, spaceIndex)
            : addCamelToBottom(noCalmel, camel, spaceIndex);
        return { ...prev, track: updated };
      });
    },
    []
  );

  const moveCamelInStack = useCallback((camel: CamelColor, dir: 'up' | 'down') => {
    setState(prev => {
      const pos = findCamelPosition(prev.track, camel);
      if (!pos) return prev;
      const { spaceIndex, stackIndex } = pos;
      const space = prev.track[spaceIndex];
      const swapIdx = dir === 'up' ? stackIndex + 1 : stackIndex - 1;
      if (swapIdx < 0 || swapIdx >= space.length) return prev;
      const newSpace = [...space];
      [newSpace[stackIndex], newSpace[swapIdx]] = [newSpace[swapIdx], newSpace[stackIndex]];
      const updated = prev.track.map((s, i) => (i === spaceIndex ? newSpace : s));
      return { ...prev, track: updated };
    });
  }, []);

  const toggleDie = useCallback((camel: CamelColor) => {
    setState(prev => {
      // Crazy camels (black/white) share the 'crazy' die
      const isCrazy = CRAZY_CAMELS.includes(camel);
      const dieToToggle = isCrazy ? ('crazy' as const) : camel;
      const inPool = prev.dicePool.includes(dieToToggle);
      const newPool: DicePool = inPool
        ? prev.dicePool.filter(c => c !== dieToToggle)
        : [...prev.dicePool, dieToToggle];
      return { ...prev, dicePool: newPool };
    });
  }, []);

  const reset = useCallback(() => {
    setState(buildDefaultState());
  }, []);

  const loadState = useCallback((s: GameState) => {
    setState(s);
  }, []);

  return { state, setCamelSpace, moveCamelInStack, toggleDie, reset, loadState };
}
