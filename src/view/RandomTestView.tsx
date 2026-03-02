// ---------------------------------------------------------------------------
// RandomTestView — Generate random board situations for testing/practice
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Board } from './Board';
import { AnalysisPanel } from './AnalysisPanel';
import { DebugPanel } from './DebugPanel';
import type { GameState, TrapTile } from '../model/types';
import { createInitialGameState, CAMEL_COLORS, CRAZY_CAMELS } from '../model/constants';
import { placeCamel } from '../model/movement';

// ---------------------------------------------------------------------------
// Random state generator
// ---------------------------------------------------------------------------

/**
 * Generates a random mid-game state for testing/practice.
 */
function generateRandomGameState(): GameState {
  let state = createInitialGameState(['Player 1', 'Player 2', 'Player 3']);
  
  // Place each forward camel at a random starting space (0-8)
  const camelOrder = [...CAMEL_COLORS].sort(() => Math.random() - 0.5);
  for (const camel of camelOrder) {
    const startSpace = Math.floor(Math.random() * 9); // 0-8
    state.track = placeCamel(state.track, camel, startSpace);
  }
  
  // Place crazy camels at space 15 (finish line)
  for (const camel of CRAZY_CAMELS) {
    state.track = placeCamel(state.track, camel, 15);
  }
  
  // Randomly remove 0-6 dice from the pool to simulate mid-leg state
  const numDiceRolled = Math.floor(Math.random() * 7); // 0-6 dice rolled
  const availableDice = [...state.dicePool];
  
  for (let i = 0; i < numDiceRolled && availableDice.length > 0; i++) {
    const dieIndex = Math.floor(Math.random() * availableDice.length);
    availableDice.splice(dieIndex, 1);
  }
  
  // Update dice pool
  state.dicePool = availableDice;
  
  // Random desert tiles (0-3 tiles)
  const trapTiles: TrapTile[] = [];
  const numTiles = Math.floor(Math.random() * 4); // 0-3 tiles
  const usedSpaces = new Set<number>();
  
  for (let i = 0; i < numTiles; i++) {
    let space;
    do {
      space = Math.floor(Math.random() * 14) + 1; // 1-14 (not 0 or 15)
    } while (usedSpaces.has(space));
    
    usedSpaces.add(space);
    trapTiles.push({
      space,
      type: Math.random() > 0.5 ? 'oasis' : 'mirage',
      playerIndex: i % 3, // Rotate through players
    });
  }
  
  return {
    ...state,
    track: state.track,
    dicePool: availableDice,
    trapTiles,
    legNumber: Math.floor(Math.random() * 3) + 1, // 1-3
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RandomTestView() {
  const [state, setState] = useState<GameState>(generateRandomGameState());
  const [history, setHistory] = useState<GameState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  const handleNewRandom = () => {
    const newState = generateRandomGameState();
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
    setState(newState);
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
          <h1 className="text-base font-bold text-amber-900">🎲 Random Test Mode</h1>
          <p className="text-xs text-amber-700">
            Practice analyzing random mid-game situations
          </p>
        </div>
        <div className="flex gap-2">
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
          <button
            onClick={handleNewRandom}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            🎲 New Random State
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
            <h3 className="text-sm font-bold text-amber-900 mb-2">Board Situation</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold text-gray-700">Leg Number</div>
                <div className="text-gray-600">{state.legNumber}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Dice Remaining</div>
                <div className="text-gray-600">
                  {state.dicePool.length} dice ({state.dicePool.includes('crazy') ? 'including crazy' : 'no crazy'})
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
                <div className="font-semibold text-gray-700">Test Questions</div>
                <div className="text-gray-600 space-y-1">
                  <div>• Which camel is most likely to win this leg?</div>
                  <div>• Which camel is most likely to win the race?</div>
                  <div>• What's the best leg bet to make?</div>
                  <div>• Where should you place a desert tile?</div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-amber-600 italic">
              Check if the probabilities and EV calculations in the analysis panel make sense for this situation.
              Try to predict the answers before looking at them!
            </div>
          </div>
        </div>

        {/* Col 2: Analysis + Debug */}
        <div className="w-[380px] flex-shrink-0 border-l border-amber-300 bg-amber-50 overflow-y-auto p-3 flex flex-col gap-3">
          <AnalysisPanel state={state} />
          <DebugPanel state={state} />
          
          <div className="bg-white/70 rounded-lg border border-amber-200 p-3">
            <h3 className="text-sm font-bold text-amber-900 mb-2">💡 Tips for Testing</h3>
            <ul className="text-xs text-gray-700 space-y-1.5">
              <li>• <strong>Leg Winner:</strong> Should favor camels in the lead with dice still in pool</li>
              <li>• <strong>Race Winner:</strong> Based on 10k simulations of complete games</li>
              <li>• <strong>EV Calculations:</strong> Positive EV = good bet, negative = bad bet</li>
              <li>• <strong>Desert Tiles:</strong> Best placed where many camels will land</li>
              <li>• <strong>Crazy Camels:</strong> Move backward, excluded from leg bets</li>
              <li>• <strong>Empty Pool:</strong> If no dice remain, leg winner is already determined</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
