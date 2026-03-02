// ---------------------------------------------------------------------------
// BoardEditor — interactive board state editor + play mode
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Board } from './Board';
import { AnalysisPanel } from './AnalysisPanel';
import { TurnPanel } from './TurnPanel';
import { DebugPanel } from './DebugPanel';
import { CamelToken } from './CamelToken';
import { CAMEL_COLORS, CRAZY_CAMELS, CAMEL_HEX, TRACK_LENGTH } from '../model/constants';
import { findCamelPosition, moveCamel } from '../model/movement';
import { useGameEditor } from '../controller/useGameEditor';
import { useTurnController } from '../controller/useTurnController';
import type { CamelColor, GameState, DicePoolEntry } from '../model/types';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

const LABEL: Record<CamelColor, string> = {
  blue: 'Blue', green: 'Green', yellow: 'Yellow',
  purple: 'Purple', pink: 'Pink', black: 'Black', white: 'White',
};

// ---------------------------------------------------------------------------
// CamelStrip — compact horizontal row of camel controls (shared by both modes)
// ---------------------------------------------------------------------------

interface CamelStripProps {
  state: GameState;
  selectedCamel?: CamelColor | null;
  onSelectCamel?: (c: CamelColor) => void;
  onSpaceChange?: (c: CamelColor, delta: number) => void;
  onStackMove?: (c: CamelColor, dir: 'up' | 'down') => void;
  onToggleDie?: (c: CamelColor) => void;
}

function CamelStrip({ state, selectedCamel, onSelectCamel, onSpaceChange, onStackMove, onToggleDie }: CamelStripProps) {
  const editable = !!onSelectCamel;
  const allCamels = [...CAMEL_COLORS, ...CRAZY_CAMELS];
  return (
    <div className="flex-shrink-0 flex flex-wrap gap-1.5 px-1 pb-1">
      {allCamels.map(camel => {
        const pos = findCamelPosition(state.track, camel);
        const spaceIndex = pos?.spaceIndex ?? 0;
        const stackIndex = pos?.stackIndex ?? 0;
        const stackSize = pos ? state.track[pos.spaceIndex].length : 1;
        const isCrazy = CRAZY_CAMELS.includes(camel);
        const dieInPool = isCrazy ? state.dicePool.includes('crazy') : state.dicePool.includes(camel);
        const isSelected = selectedCamel === camel;
        return (
          <div
            key={camel}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs select-none transition-colors ${
              editable ? 'cursor-pointer' : ''
            } ${
              isSelected ? 'bg-white shadow border-2' : 'bg-amber-50 border-amber-200 hover:bg-white hover:border-amber-300'
            }`}
            style={isSelected ? { borderColor: CAMEL_HEX[camel] } : undefined}
            onClick={() => onSelectCamel?.(camel)}
          >
            <CamelToken color={camel} size="sm" />
            {editable && (
              <button onClick={e => { e.stopPropagation(); onSpaceChange!(camel, -1); }} disabled={spaceIndex === 0}
                className="w-4 h-4 rounded hover:bg-amber-100 disabled:opacity-30 font-bold text-center leading-none text-gray-600">‹</button>
            )}
            <span className="w-4 text-center tabular-nums font-semibold text-gray-800">{spaceIndex + 1}</span>
            {editable && (
              <button onClick={e => { e.stopPropagation(); onSpaceChange!(camel, +1); }} disabled={spaceIndex === TRACK_LENGTH - 1}
                className="w-4 h-4 rounded hover:bg-amber-100 disabled:opacity-30 font-bold text-center leading-none text-gray-600">›</button>
            )}
            {editable && stackSize > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); onStackMove!(camel, 'up'); }} disabled={stackIndex >= stackSize - 1}
                  className="w-4 h-4 rounded hover:bg-amber-100 disabled:opacity-30 text-center leading-none text-gray-600">↑</button>
                <button onClick={e => { e.stopPropagation(); onStackMove!(camel, 'down'); }} disabled={stackIndex <= 0}
                  className="w-4 h-4 rounded hover:bg-amber-100 disabled:opacity-30 text-center leading-none text-gray-600">↓</button>
              </>
            )}
            <button
              onClick={e => { e.stopPropagation(); onToggleDie?.(camel); }}
              disabled={!editable}
              className={`ml-1 px-1 rounded text-[10px] font-bold transition-colors disabled:cursor-default ${
                dieInPool ? 'text-emerald-600' : 'text-gray-300'
              } ${editable ? 'hover:opacity-70' : ''}`}
              title={editable ? (dieInPool ? 'Die in pool (click to remove)' : 'Die rolled (click to restore)') : undefined}
            >
              <span style={{ color: dieInPool ? CAMEL_HEX[camel] : undefined }}>●</span>
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg border border-amber-100 text-xs text-gray-500">
        Leg <span className="font-semibold text-amber-800">{state.legNumber}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RollSimulator — pick a die from the pool + steps to apply a roll instantly
// ---------------------------------------------------------------------------

interface RollSimulatorProps {
  state: GameState;
  onRoll: (camel: CamelColor, steps: 1 | 2 | 3) => void;
}

function RollSimulator({ state, onRoll }: RollSimulatorProps) {
  const [pendingDie, setPendingDie] = useState<DicePoolEntry | null>(null);
  const pool = state.dicePool;

  if (pool.length === 0) {
    return (
      <div className="flex-shrink-0 px-2 py-1.5 bg-amber-50/60 border border-amber-100 rounded-lg text-[11px] text-amber-400 italic">
        All dice rolled this leg
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-2 py-1.5 bg-white/70 border border-amber-200 rounded-lg">
      <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide whitespace-nowrap">Simulate roll</span>

      {pool.map(die => (
        <button
          key={die}
          onClick={() => setPendingDie(prev => prev === die ? null : die)}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold border transition-colors ${
            pendingDie === die ? 'bg-white shadow border-2' : 'bg-amber-50 border-amber-200 hover:bg-white'
          }`}
          style={pendingDie === die && die !== 'crazy' ? { borderColor: CAMEL_HEX[die] } : undefined}
        >
          {die === 'crazy' ? <span className="text-xs">🎲</span> : <CamelToken color={die} size="sm" />}
        </button>
      ))}

      {pendingDie && pendingDie !== 'crazy' && (
        <>
          <span className="text-[10px] text-amber-400">moves:</span>
          {([1, 2, 3] as const).map(steps => (
            <button
              key={steps}
              onClick={() => { onRoll(pendingDie, steps); setPendingDie(null); }}
              className="w-7 h-7 rounded-lg font-bold text-sm border border-amber-300 bg-amber-50 hover:bg-amber-200 hover:border-amber-400 transition-colors"
            >
              {steps}
            </button>
          ))}
          <button onClick={() => setPendingDie(null)} className="text-[11px] text-gray-400 hover:text-gray-600 ml-1">✕</button>
        </>
      )}
      {pendingDie === 'crazy' && (
        <span className="text-[10px] text-amber-600 italic">Use play mode to roll crazy die</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayView — same 2-col layout as analyzer; TurnPanel in right column
// ---------------------------------------------------------------------------

function PlayView({ initialState, onBack }: { initialState: GameState; onBack: () => void }) {
  const tc = useTurnController(initialState);
  const isRaceOver = tc.state.phase === 'race-ended';

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-amber-100">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-200 border-b border-amber-300 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold text-amber-900">🐪 Camel Up — Play Mode</h1>
          <p className="text-xs text-amber-700">
            Leg {tc.state.legNumber} · {tc.state.dicePool.length} dice remaining
            {isRaceOver && ' · 🏁 Race ended!'}
          </p>
        </div>
        <button onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 shadow-sm">
          ◀ Back to editor
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Col 1: Board + read-only camel strip */}
        <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2">
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <Board state={tc.state} />
          </div>
          <CamelStrip state={tc.state} />
        </div>

        {/* Col 2: Turn actions + Analysis + Debug */}
        <div className="w-[400px] flex-shrink-0 border-l border-amber-300 bg-amber-50 overflow-y-auto p-3 flex flex-col gap-3">
          <TurnPanel tc={tc} />
          <AnalysisPanel state={tc.state} />
          <DebugPanel state={tc.state} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardEditor — Analyze mode (default view)
// ---------------------------------------------------------------------------

export function BoardEditor() {
  const { state, setCamelSpace, moveCamelInStack, toggleDie, reset, loadState } = useGameEditor();
  const [mode, setMode] = useState<'analyze' | 'play'>('analyze');
  const [playKey, setPlayKey] = useState(0);
  const [frozenState, setFrozenState] = useState<GameState>(state);
  const [selectedCamel, setSelectedCamel] = useState<CamelColor | null>(null);

  if (mode === 'play') {
    return <PlayView key={playKey} initialState={frozenState} onBack={() => setMode('analyze')} />;
  }

  const handleCamelClick = (camel: CamelColor) => setSelectedCamel(prev => prev === camel ? null : camel);

  const handleSpaceClick = (spaceIndex: number) => {
    if (selectedCamel) { setCamelSpace(selectedCamel, spaceIndex); setSelectedCamel(null); }
  };

  const handleSimulateRoll = (camel: CamelColor, steps: 1 | 2 | 3) => {
    const newTrack = moveCamel(state.track, camel, steps);
    loadState({ ...state, track: newTrack, dicePool: state.dicePool.filter(c => c !== camel) });
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-amber-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-200 border-b border-amber-300 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold text-amber-900">🐪 Camel Up Analyzer</h1>
          <p className="text-xs text-amber-700">
            {selectedCamel
              ? <span style={{ color: CAMEL_HEX[selectedCamel] }}>● {LABEL[selectedCamel]} selected — click a board space to move it</span>
              : 'Click a camel on the board or in the list to select it'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 shadow-sm">
            ↺ Reset
          </button>
          <button onClick={() => { setFrozenState(state); setPlayKey(k => k + 1); setMode('play'); }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm">
            ▶ Play game
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Col 1: Board + roll simulator + camel controls */}
        <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2">
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
            onClick={() => selectedCamel && setSelectedCamel(null)}
          >
            <Board
              state={state}
              selectedCamel={selectedCamel}
              onCamelClick={handleCamelClick}
              onSpaceClick={handleSpaceClick}
            />
          </div>

          <RollSimulator state={state} onRoll={handleSimulateRoll} />

          <CamelStrip
            state={state}
            selectedCamel={selectedCamel}
            onSelectCamel={handleCamelClick}
            onSpaceChange={(camel, delta) => {
              const pos = findCamelPosition(state.track, camel);
              setCamelSpace(camel, clamp((pos?.spaceIndex ?? 0) + delta, 0, TRACK_LENGTH - 1));
            }}
            onStackMove={moveCamelInStack}
            onToggleDie={toggleDie}
          />
        </div>

        {/* Col 2: Analysis + Debug */}
        <div className="w-[380px] flex-shrink-0 border-l border-amber-300 bg-amber-50 overflow-y-auto p-3 flex flex-col gap-3">
          <AnalysisPanel state={state} />
          <DebugPanel state={state} />
        </div>
      </div>
    </div>
  );
}
