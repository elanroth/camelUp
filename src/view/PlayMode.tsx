// ---------------------------------------------------------------------------
// PlayMode — Start and play a fresh game with initial roll
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Board } from './Board';
import { AnalysisPanel } from './AnalysisPanel';
import { DebugPanel } from './DebugPanel';
import type { GameState } from '../model/types';
import { createInitialGameState, CAMEL_COLORS, CRAZY_CAMELS } from '../model/constants';
import { placeCamel, moveCamelFull } from '../model/movement';

// ---------------------------------------------------------------------------
// Game state generators
// ---------------------------------------------------------------------------

/**
 * Creates a fresh game state with all forward camels at space 1 
 * and crazy camels at space 15 (finish line).
 */
function generateInitialGameState(): GameState {
  let state = createInitialGameState(['Player 1', 'Player 2', 'Player 3']);
  
  // Place all forward camels at space 0 (start space) in random stack order
  const camelOrder = [...CAMEL_COLORS].sort(() => Math.random() - 0.5);
  for (const camel of camelOrder) {
    state.track = placeCamel(state.track, camel, 0);
  }
  
  // Place both crazy camels at space 15 (finish line) since they move backward
  for (const camel of CRAZY_CAMELS) {
    state.track = placeCamel(state.track, camel, 15);
  }
  
  return state;
}

/**
 * Simulates the initial roll for each forward camel to scatter them 
 * from space 1 to spaces 1-4. Returns a new game state with:
 * - Each forward camel rolled once (1-3 spaces)
 * - All 5 forward dice removed from pool
 * - Crazy die still in pool
 */
function performInitialRoll(state: GameState): GameState {
  let newState = { ...state };
  
  // Roll each forward camel once in random order
  const camelOrder = [...CAMEL_COLORS].sort(() => Math.random() - 0.5);
  for (const camel of camelOrder) {
    const steps = (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3;
    const result = moveCamelFull(newState.track, camel, steps);
    newState.track = result.track;
  }
  
  // Remove all forward camel dice from pool, leaving only the crazy die
  newState.dicePool = ['crazy'];
  
  return newState;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlayMode() {
  const [state, setState] = useState<GameState>(generateInitialGameState());
  const [gameStarted, setGameStarted] = useState(false);
  const [history, setHistory] = useState<GameState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  const handleStartGame = () => {
    const newState = performInitialRoll(state);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
    setState(newState);
    setGameStarted(true);
  };
  
  const handleReset = () => {
    const newState = generateInitialGameState();
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
    setState(newState);
    setGameStarted(false);
  };
  
  const handlePrevious = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setState(history[historyIndex - 1]);
    }
  };
  
  const handleNext = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setState(history[historyIndex + 1]);
    }
  };
  
  const canGoPrev = historyIndex > 0;
  const canGoNext = historyIndex < history.length - 1;
  
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-amber-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-200 border-b border-amber-300 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold text-amber-900">🎮 Play Mode</h1>
          <p className="text-xs text-amber-700">
            Start a fresh game from the beginning
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 shadow-sm"
          >
            🔄 Reset to Start
          </button>
          {!gameStarted && (
            <button
              onClick={handleStartGame}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm"
            >
              🎮 Start Game
            </button>
          )}
          <button
            onClick={handlePrevious}
            disabled={!canGoPrev}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Col 1: Board + description */}
        <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2">
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <Board state={state} />
          </div>
          
          {/* Situation description */}
          <div className="flex-shrink-0 bg-white/70 rounded-lg border border-amber-200 p-3">
            <h3 className="text-sm font-bold text-amber-900 mb-2">Game Status</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold text-gray-700">Leg Number</div>
                <div className="text-gray-600">{state.legNumber}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Dice Remaining</div>
                <div className="text-gray-600">
                  {state.dicePool.length} dice (including crazy)
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Desert Tiles</div>
                <div className="text-gray-600">
                  {state.trapTiles.length} placed
                  {state.trapTiles.length > 0 && ` (spaces ${state.trapTiles.map(t => t.space + 1).join(', ')})`}
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Phase</div>
                <div className="text-gray-600">{state.phase}</div>
              </div>
            </div>
            {!gameStarted && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>Ready to start:</strong> All camels are at their starting positions. 
                Click "Start Game" to perform the initial roll and scatter the camels!
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Analysis */}
        <div className="w-[480px] flex-shrink-0 overflow-y-auto p-3 bg-white border-l border-amber-300">
          <AnalysisPanel state={state} />
          <div className="mt-4">
            <DebugPanel state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}
