// ---------------------------------------------------------------------------
// TurnPanel — in-game action panel
// ---------------------------------------------------------------------------
// Shows whose turn it is, available actions (roll, leg bet, race bet, trap tile),
// coin totals, and a scrollable action log.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import type { CamelColor, TrapType } from '../model/types';
import type { TurnControllerResult } from '../controller/useTurnController';
import { CAMEL_COLORS, CAMEL_HEX, CAMEL_COLOURS_TW } from '../model/constants';
import { CamelToken } from './CamelToken';

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

const LABEL: Record<CamelColor, string> = {
  blue: 'Blue', green: 'Green', yellow: 'Yellow', purple: 'Purple', pink: 'Pink',
  black: 'Black', white: 'White',
};

const LOG_STYLES: Record<string, string> = {
  roll:     'text-blue-700',
  bet:      'text-emerald-700',
  raceBet:  'text-purple-700',
  legEnd:   'text-amber-700 font-semibold',
  raceEnd:  'text-red-700 font-bold',
  info:     'text-gray-500 italic',
};

// ---------------------------------------------------------------------------
// Desert Tile Panel
// ---------------------------------------------------------------------------

function DesertTilePanel({ tc }: { tc: TurnControllerResult }) {
  const { state, placeTrapTile, removeTrapTile } = tc;
  const [tileType, setTileType] = useState<TrapType>('oasis');
  const [tileSpace, setTileSpace] = useState<number>(1); // 0-based, default space 2 (index 1)
  const isRaceOver = state.phase === 'race-ended';

  const currentPlayer = state.players[state.currentPlayerIndex];
  const myTile = state.trapTiles?.find(t => t.playerIndex === state.currentPlayerIndex);

  if (isRaceOver) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3">
      <h3 className="text-xs text-amber-700 uppercase tracking-wide font-semibold mb-2">
        Desert tile (+1 🪙 when camel lands)
      </h3>

      {myTile && (
        <div className="mb-2 text-xs text-gray-600 bg-amber-50 rounded px-2 py-1 flex items-center justify-between">
          <span>
            Your tile: {myTile.type === 'oasis' ? '🌴' : '🏜️'} {myTile.type} at space {myTile.space + 1}
          </span>
          <button
            onClick={removeTrapTile}
            className="ml-2 text-xs text-red-500 hover:text-red-700 font-semibold"
          >
            Remove
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end flex-wrap">
        {/* Type selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Type</span>
          <div className="flex gap-1">
            {(['oasis', 'mirage'] as TrapType[]).map(t => (
              <button
                key={t}
                onClick={() => setTileType(t)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${
                  tileType === t
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
                }`}
              >
                {t === 'oasis' ? '🌴 Oasis (+1)' : '🏜️ Mirage (−1)'}
              </button>
            ))}
          </div>
        </div>

        {/* Space selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Space (2–16)</span>
          <input
            type="number"
            min={2}
            max={16}
            value={tileSpace + 1}
            onChange={e => setTileSpace(Math.max(1, Math.min(15, Number(e.target.value) - 1)))}
            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded text-center"
          />
        </div>

        {/* Place button */}
        <button
          onClick={() => {
            placeTrapTile(tileSpace, tileType);
          }}
          disabled={!currentPlayer || isRaceOver}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white
                     hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Place tile
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerScoreboard
// ---------------------------------------------------------------------------

function PlayerScoreboard({ tc }: { tc: TurnControllerResult }) {
  const { state } = tc;
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-amber-50 border-b border-amber-100">
            <th className="text-left px-3 py-2 text-xs text-amber-700 uppercase tracking-wide font-semibold">
              Player
            </th>
            <th className="text-right px-3 py-2 text-xs text-amber-700 uppercase tracking-wide font-semibold">
              🪙
            </th>
            <th className="text-left px-3 py-2 text-xs text-amber-700 uppercase tracking-wide font-semibold">
              Leg bets
            </th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((player, i) => {
            const isCurrent = i === state.currentPlayerIndex && state.phase !== 'race-ended';
            return (
              <tr
                key={player.name}
                className={`border-b border-amber-50 last:border-0 transition-colors ${
                  isCurrent ? 'bg-amber-50' : ''
                }`}
              >
                <td className="px-3 py-2 font-medium text-gray-800">
                  {isCurrent && <span className="mr-1">▶</span>}
                  {player.name}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">
                  {player.coins}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {player.legBets.map((tile, j) => (
                      <span
                        key={j}
                        title={`${tile.camel} — payout ${tile.payout}`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px]
                                    font-bold ${CAMEL_COLOURS_TW[tile.camel]}`}
                      >
                        {tile.payout}
                      </span>
                    ))}
                    {player.legBets.length === 0 && (
                      <span className="text-[11px] text-gray-300 italic">none</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TurnPanel
// ---------------------------------------------------------------------------

interface Props {
  tc: TurnControllerResult;
}

export function TurnPanel({ tc }: Props) {
  const { state, log, rollDie, takeLegBet, placeRaceBet, canRoll, canBetWinner, canBetLoser } = tc;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isRaceOver = state.phase === 'race-ended';
  // Per-player race bets already placed (for current player)
  const myWinnerBets = currentPlayer?.raceWinnerBets ?? [];
  const myLoserBets = currentPlayer?.raceLoserBets ?? [];

  return (
    <div className="flex flex-col gap-4 min-w-[320px] max-w-md">

      {/* ── Race-over banner ── */}
      {isRaceOver && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-red-700">🏁 Race Over!</p>
          <p className="text-xs text-red-500 mt-0.5">Check the log below for final results.</p>
        </div>
      )}

      {/* ── Current player banner ── */}
      {!isRaceOver && (
        <div className="bg-white rounded-xl border border-amber-300 px-4 py-3 shadow-sm">
          <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-0.5">
            Current turn
          </p>
          <p className="text-lg font-bold text-gray-800">
            ▶ {currentPlayer?.name ?? '—'}
          </p>
          <p className="text-xs text-gray-400">
            {state.dicePool.length} dice remaining in pool
            {state.dicePool.includes('crazy') && ' (🎭 crazy)'}
            · Leg {state.legNumber}
          </p>
        </div>
      )}

      {/* ── Roll button ── */}
      <button
        onClick={rollDie}
        disabled={!canRoll}
        className="w-full py-3 rounded-xl font-bold text-base transition-all shadow-sm
                   bg-blue-600 text-white hover:bg-blue-700 active:scale-95
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
      >
        🎲 Roll a die
        <span className="ml-2 text-sm font-normal opacity-80">
          ({state.dicePool.length} remaining, +1 🪙)
        </span>
      </button>

      {/* ── Desert tile placement ── */}
      <DesertTilePanel tc={tc} />

      {/* ── Leg bet tiles ── */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3">
        <h3 className="text-xs text-amber-700 uppercase tracking-wide font-semibold mb-2">
          Take a leg bet tile (free)
        </h3>
        <div className="flex flex-col gap-2">
          {CAMEL_COLORS.map(camel => {
            const tiles = state.legBetStacks[camel];
            const available = tiles.length > 0 && !isRaceOver;
            const payout = tiles[0];
            return (
              <div key={camel} className="flex items-center gap-2">
                <CamelToken color={camel} size="sm" />
                <span className="w-16 text-sm font-medium text-gray-700 capitalize">{LABEL[camel]}</span>
                {available ? (
                  <button
                    onClick={() => takeLegBet(camel)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                               border border-emerald-300 bg-emerald-50 text-emerald-700
                               hover:bg-emerald-100 transition-colors"
                  >
                    Bet · pays {payout}
                    <span
                      className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center
                                 justify-center text-white"
                      style={{ backgroundColor: CAMEL_HEX[camel] }}
                    >
                      {payout}
                    </span>
                  </button>
                ) : (
                  <span className="text-xs text-gray-300 italic">
                    {tiles.length === 0 ? 'no tiles left' : '—'}
                  </span>
                )}
                {/* Show remaining tiles count */}
                {tiles.length > 0 && (
                  <span className="ml-auto text-[10px] text-gray-400">
                    {tiles.length} tile{tiles.length !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Race bets ── */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3">
        <h3 className="text-xs text-amber-700 uppercase tracking-wide font-semibold mb-1">
          Overall race bets
        </h3>
        <p className="text-[10px] text-gray-400 mb-2">
          Bet once per camel per side — earlier cards pay more (8, 5, 3, 2, 1)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">🏆 Winner</p>
            <div className="flex flex-col gap-1.5">
              {[...CAMEL_COLORS, 'black' as CamelColor, 'white' as CamelColor].map(camel => {
                const ok = canBetWinner(camel);
                const alreadyBet = myWinnerBets.includes(camel);
                return (
                  <button
                    key={camel}
                    onClick={() => placeRaceBet(camel, 'winner')}
                    disabled={!ok}
                    title={alreadyBet ? 'Already bet (winner)' : `Bet ${camel} wins the race`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold
                                border transition-colors ${
                      ok
                        ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                        : alreadyBet
                        ? 'border-green-200 bg-green-50 text-green-600 cursor-not-allowed'
                        : 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <span style={{ color: CAMEL_HEX[camel] }}>●</span>
                    {LABEL[camel]}
                    {alreadyBet && <span className="ml-auto text-[9px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">🐌 Loser</p>
            <div className="flex flex-col gap-1.5">
              {[...CAMEL_COLORS, 'black' as CamelColor, 'white' as CamelColor].map(camel => {
                const ok = canBetLoser(camel);
                const alreadyBet = myLoserBets.includes(camel);
                return (
                  <button
                    key={camel}
                    onClick={() => placeRaceBet(camel, 'loser')}
                    disabled={!ok}
                    title={alreadyBet ? 'Already bet (loser)' : `Bet ${camel} finishes last`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold
                                border transition-colors ${
                      ok
                        ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : alreadyBet
                        ? 'border-green-200 bg-green-50 text-green-600 cursor-not-allowed'
                        : 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <span style={{ color: CAMEL_HEX[camel] }}>●</span>
                    {LABEL[camel]}
                    {alreadyBet && <span className="ml-auto text-[9px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Player scoreboard ── */}
      <PlayerScoreboard tc={tc} />

      {/* ── Action log ── */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3">
        <h3 className="text-xs text-amber-700 uppercase tracking-wide font-semibold mb-2">
          Action log
        </h3>
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
          {log.map(entry => (
            <p
              key={entry.id}
              className={`text-xs leading-snug ${LOG_STYLES[entry.type] ?? 'text-gray-600'}`}
            >
              {entry.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
