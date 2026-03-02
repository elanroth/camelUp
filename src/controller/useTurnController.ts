// ---------------------------------------------------------------------------
// useTurnController — live game-play hook
// ---------------------------------------------------------------------------
// Manages the full game turn loop:
//   · rollDie()          → picks a random unrolled camel, moves it, gives +1 coin
//   · takeLegBet(camel)  → player claims top payout tile (free action)
//   · placeRaceBet()     → player commits an overall winner/loser card
//
// Leg end: when dicePool empties, leg bets are resolved and the next leg begins.
// Race end: when moveCamelFull returns raceOver=true.
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import type { CamelColor, GameState, RaceBetType, TrapType } from '../model/types';
import { RACE_BET_PAYOUTS, RACE_BET_WRONG_COST, createDicePool, createLegBetStacks } from '../model/constants';
import {
  moveCamelFull, moveCrazyFull, applyTrapTile,
  getForwardCamelRanking, getLeadingForwardCamel, getLastForwardCamel,
} from '../model/movement';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  id: number;
  message: string;
  type: 'roll' | 'bet' | 'raceBet' | 'legEnd' | 'raceEnd' | 'info';
}

export interface TurnControllerResult {
  state: GameState;
  log: LogEntry[];
  /** Roll a random die from the pool. No-op if pool empty or race over. */
  rollDie: () => void;
  /** Claim the top leg-bet tile for `camel`. No-op if no tiles left. */
  takeLegBet: (camel: CamelColor) => void;
  /** Place an overall race winner or loser card. */
  placeRaceBet: (camel: CamelColor, type: RaceBetType) => void;
  /** Place (or flip) the current player's desert tile on the given space. */
  placeTrapTile: (space: number, type: TrapType) => void;
  /** Remove the current player's desert tile from the board. */
  removeTrapTile: () => void;
  /** Whether rollDie() can be called right now. */
  canRoll: boolean;
  /** Whether the current player can still bet on the overall winner for this camel. */
  canBetWinner: (camel: CamelColor) => boolean;
  /** Whether the current player can still bet on the overall loser for this camel. */
  canBetLoser: (camel: CamelColor) => boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _logId = 0;
function makeEntry(message: string, type: LogEntry['type']): LogEntry {
  return { id: ++_logId, message, type };
}

const CAMEL_EMOJI: Record<CamelColor, string> = {
  blue:   '💧',
  green:  '💚',
  yellow: '💛',
  purple: '💜',
  pink:   '🪩',
  black:  '♥️',
  white:  '🪦',
};

/** Fisher-Yates shuffle — returns a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick a random element from a non-empty array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Leg-bet resolution
// ---------------------------------------------------------------------------

function resolveLegBets(state: GameState): { state: GameState; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  // Leg winner/loser are determined by forward camels only (crazy excluded)
  const legWinner = getLeadingForwardCamel(state.track);
  const legLoser  = getLastForwardCamel(state.track);

  console.group(`[resolveLegBets] Leg ${state.legNumber}`);
  console.log('legWinner:', legWinner, '| legLoser:', legLoser);
  console.log('track snapshot:', state.track.map((s, i) => s.length ? `[${i+1}]: ${s.join(',')}` : null).filter(Boolean).join(' | '));
  console.log('dicePool:', state.dicePool);
  state.players.forEach((p, i) => console.log(`  player[${i}] ${p.name}: coins=${p.coins}, legBets=`, p.legBets));

  entries.push(makeEntry(
    `── Leg ${state.legNumber} ends! Leader: ${legWinner ? CAMEL_EMOJI[legWinner] + ' ' + legWinner : '?'} ──`,
    'legEnd'
  ));

  const updatedPlayers = state.players.map((player) => {
    let coins = player.coins;
    player.legBets.forEach((tile) => {
      const won = tile.camel === legWinner;
      const delta = won ? tile.payout : -1;
      coins += delta;
      entries.push(makeEntry(
        `${player.name}: ${CAMEL_EMOJI[tile.camel]} ${tile.camel} bet → ${won ? `+${tile.payout} 🪙` : '−1 🪙'}`,
        'legEnd'
      ));
    });
    return { ...player, coins, legBets: [] };
  });

  // Trap tiles are picked up between legs (rules: players retrieve their tiles)
  // Reset for next leg
  const nextState: GameState = {
    ...state,
    players: updatedPlayers,
    dicePool: createDicePool(),
    legBetStacks: createLegBetStacks(),
    trapTiles: [],
    legNumber: state.legNumber + 1,
    phase: 'running',
  };

  entries.push(makeEntry(
    `Leg ${nextState.legNumber} begins — dice pool reset`,
    'info'
  ));

  console.log('post-resolve player coins:', updatedPlayers.map(p => `${p.name}:${p.coins}`).join(', '));
  console.groupEnd();

  void legLoser;
  return { state: nextState, entries };
}

// ---------------------------------------------------------------------------
// Race-bet resolution
// ---------------------------------------------------------------------------

function resolveRaceBets(state: GameState): { state: GameState; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  // Race winner/loser are determined by forward camels only
  const ranking = getForwardCamelRanking(state.track);
  const raceWinner = ranking[0] ?? null;
  const raceLoser  = ranking[ranking.length - 1] ?? null;

  console.group('[resolveRaceBets] RACE OVER');
  console.log('ranking:', ranking);
  console.log('raceWinner:', raceWinner, '| raceLoser:', raceLoser);
  console.log('raceWinnerBets:', state.raceWinnerBets);
  console.log('raceLoserBets:', state.raceLoserBets);

  entries.push(makeEntry(
    `🏁 RACE OVER! Winner: ${raceWinner ? CAMEL_EMOJI[raceWinner] + ' ' + raceWinner : '?'} | Loser: ${raceLoser ? CAMEL_EMOJI[raceLoser] + ' ' + raceLoser : '?'}`,
    'raceEnd'
  ));

  const updatedPlayers = state.players.map((player, pi) => {
    let coins = player.coins;

    // Winner bets
    state.raceWinnerBets.forEach((bet, betIdx) => {
      if (bet.playerIndex !== pi) return;
      const payout = RACE_BET_PAYOUTS[Math.min(betIdx, RACE_BET_PAYOUTS.length - 1)];
      const won = bet.camel === raceWinner;
      const delta = won ? payout : RACE_BET_WRONG_COST;
      coins += delta;
      entries.push(makeEntry(
        `${player.name}: race winner card ${CAMEL_EMOJI[bet.camel]} ${bet.camel} → ${won ? `+${payout} 🪙` : '−1 🪙'}`,
        'raceEnd'
      ));
    });

    // Loser bets
    state.raceLoserBets.forEach((bet, betIdx) => {
      if (bet.playerIndex !== pi) return;
      const payout = RACE_BET_PAYOUTS[Math.min(betIdx, RACE_BET_PAYOUTS.length - 1)];
      const won = bet.camel === raceLoser;
      const delta = won ? payout : RACE_BET_WRONG_COST;
      coins += delta;
      entries.push(makeEntry(
        `${player.name}: race loser card ${CAMEL_EMOJI[bet.camel]} ${bet.camel} → ${won ? `+${payout} 🪙` : '−1 🪙'}`,
        'raceEnd'
      ));
    });

    return { ...player, coins };
  });

  console.log('post-race player coins:', updatedPlayers.map(p => `${p.name}:${p.coins}`).join(', '));
  console.groupEnd();

  return {
    state: { ...state, players: updatedPlayers, phase: 'race-ended' },
    entries,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTurnController(initialState: GameState): TurnControllerResult {
  const [state, setState] = useState<GameState>(initialState);
  const [log, setLog] = useState<LogEntry[]>([
    makeEntry('Game started — good luck! 🐪', 'info'),
  ]);

  // ── Roll die ──────────────────────────────────────────────────────────────

  const rollDie = useCallback(() => {
    setState(prev => {
      if (prev.phase === 'race-ended' || prev.dicePool.length === 0) return prev;

      const dieEntry = pick(prev.dicePool);
      const steps = pick([1, 2, 3] as const);
      const currentPlayer = prev.players[prev.currentPlayerIndex];

      // Determine which camel actually moves, apply movement, then trap tile
      let movedCamel: CamelColor;
      let trackAfterMove: typeof prev.track;
      let landedOn: number;
      let raceOver = false;
      let earnedCoin: number[] = prev.players.map(() => 0);

      if (dieEntry === 'crazy') {
        // Crazy die: randomly pick black or white, move backward
        movedCamel = pick(['black', 'white'] as const);
        const result = moveCrazyFull(prev.track, movedCamel, steps);
        trackAfterMove = result.track;
        landedOn = result.landedOn;
      } else {
        movedCamel = dieEntry;
        const result = moveCamelFull(prev.track, movedCamel, steps);
        raceOver = result.raceOver;
        trackAfterMove = result.track;
        landedOn = result.landedOn;
      }

      // Apply trap tile effect (awards coins, moves group) — skip if race over
      if (!raceOver && prev.trapTiles.length > 0) {
        const trapResult = applyTrapTile(trackAfterMove, landedOn, prev.trapTiles);
        trackAfterMove = trapResult.track;
        earnedCoin = trapResult.earnedCoin;
      }

      console.log(`[rollDie] ${currentPlayer.name} rolls die=${dieEntry} camel=${movedCamel} +${steps} | raceOver=${raceOver}`);

      // Current player earns +1 coin for rolling; trap owners earn 1 coin per trigger
      const updatedPlayers = prev.players.map((p, i) => {
        const trapCoins = earnedCoin.filter(pi => pi === i).length;
        return i === prev.currentPlayerIndex
          ? { ...p, coins: p.coins + 1 + trapCoins }
          : { ...p, coins: p.coins + trapCoins };
      });

      const newPool = prev.dicePool.filter(c => c !== dieEntry);
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;

      const rollEntry = makeEntry(
        `${currentPlayer.name} rolled ${CAMEL_EMOJI[movedCamel]} ${movedCamel} +${steps} (+1 🪙)`,
        'roll'
      );

      setLog(lg => [rollEntry, ...lg]);

      let nextState: GameState = {
        ...prev,
        track: trackAfterMove,
        dicePool: newPool,
        players: updatedPlayers,
        currentPlayerIndex: nextPlayerIndex,
      };

      if (raceOver) {
        // First resolve remaining leg bets, then race bets
        const legResult = resolveLegBets(nextState);
        const raceResult = resolveRaceBets(legResult.state);
        setLog(lg => [...raceResult.entries.reverse(), ...legResult.entries.reverse(), ...lg]);
        return raceResult.state;
      }

      if (newPool.length === 0) {
        const { state: afterLeg, entries } = resolveLegBets(nextState);
        setLog(lg => [...entries.reverse(), ...lg]);
        return afterLeg;
      }

      return nextState;
    });
  }, []);

  // ── Take leg bet ──────────────────────────────────────────────────────────

  const takeLegBet = useCallback((camel: CamelColor) => {
    setState(prev => {
      if (prev.phase === 'race-ended') return prev;
      const tiles = prev.legBetStacks[camel];
      if (tiles.length === 0) return prev;

      const payout = tiles[0];
      const currentPlayer = prev.players[prev.currentPlayerIndex];

      const newStacks = {
        ...prev.legBetStacks,
        [camel]: tiles.slice(1),
      };

      const updatedPlayers = prev.players.map((p, i) =>
        i === prev.currentPlayerIndex
          ? { ...p, legBets: [...p.legBets, { camel, payout }] }
          : p
      );

      console.log(`[takeLegBet] ${currentPlayer.name} takes leg bet on ${camel} (payout=${payout}), remaining tiles: [${tiles.slice(1).join(',')}]`);

      const entry = makeEntry(
        `${currentPlayer.name} bets ${CAMEL_EMOJI[camel]} ${camel} wins leg (payout ${payout})`,
        'bet'
      );
      setLog(lg => [entry, ...lg]);

      return {
        ...prev,
        legBetStacks: newStacks,
        players: updatedPlayers,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      };
    });
  }, []);

  // ── Place trap tile ───────────────────────────────────────────────────────

  const placeTrapTile = useCallback((space: number, type: TrapType) => {
    setState(prev => {
      if (prev.phase === 'race-ended') return prev;
      const pi = prev.currentPlayerIndex;
      const currentPlayer = prev.players[pi];

      // Remove any existing tile owned by this player, then place the new one.
      const filteredTiles = prev.trapTiles.filter(t => t.playerIndex !== pi);
      const newTiles = [...filteredTiles, { space, type, playerIndex: pi }];

      const entry = makeEntry(
        `${currentPlayer.name} places ${type === 'oasis' ? 'oasis 🌴' : 'mirage 🌀'} on space ${space + 1}`,
        'info'
      );
      setLog(lg => [entry, ...lg]);

      return {
        ...prev,
        trapTiles: newTiles,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      };
    });
  }, []);

  // ── Remove trap tile ─────────────────────────────────────────────────────

  const removeTrapTile = useCallback(() => {
    setState(prev => {
      if (prev.phase === 'race-ended') return prev;
      const pi = prev.currentPlayerIndex;
      const currentPlayer = prev.players[pi];

      const filteredTiles = prev.trapTiles.filter(t => t.playerIndex !== pi);
      if (filteredTiles.length === prev.trapTiles.length) return prev; // no tile to remove

      const entry = makeEntry(`${currentPlayer.name} picks up their desert tile`, 'info');
      setLog(lg => [entry, ...lg]);

      return {
        ...prev,
        trapTiles: filteredTiles,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      };
    });
  }, []);

  // ── Place race bet ────────────────────────────────────────────────────────

  const placeRaceBet = useCallback((camel: CamelColor, type: RaceBetType) => {
    setState(prev => {
      if (prev.phase === 'race-ended') return prev;
      const currentPlayer = prev.players[prev.currentPlayerIndex];

      const newBetCard = { camel, type, playerIndex: prev.currentPlayerIndex };
      console.log(`[placeRaceBet] ${currentPlayer.name} bets ${camel} is race ${type}`);

      const entry = makeEntry(
        `${currentPlayer.name} bets ${CAMEL_EMOJI[camel]} ${camel} is race ${type}`,
        'raceBet'
      );
      setLog(lg => [entry, ...lg]);

      // Also record in the player's own bet list for per-player canBet checks
      const updatedPlayers = prev.players.map((p, i) =>
        i === prev.currentPlayerIndex
          ? {
              ...p,
              raceWinnerBets: type === 'winner' ? [...p.raceWinnerBets, camel] : p.raceWinnerBets,
              raceLoserBets:  type === 'loser'  ? [...p.raceLoserBets,  camel] : p.raceLoserBets,
            }
          : p
      );

      return {
        ...prev,
        players: updatedPlayers,
        raceWinnerBets: type === 'winner' ? [...prev.raceWinnerBets, newBetCard] : prev.raceWinnerBets,
        raceLoserBets:  type === 'loser'  ? [...prev.raceLoserBets,  newBetCard] : prev.raceLoserBets,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      };
    });
  }, []);

  // ── Derived predicates ────────────────────────────────────────────────────

  const canRoll = state.phase !== 'race-ended' && state.dicePool.length > 0;

  // Per-player, per-camel race bet availability (each player can bet each camel
  // at most once, and cannot bet the same camel as both winner AND loser)
  const canBetWinner = (camel: CamelColor) => {
    if (state.phase === 'race-ended') return false;
    const player = state.players[state.currentPlayerIndex];
    return !player.raceWinnerBets.includes(camel) && !player.raceLoserBets.includes(camel);
  };

  const canBetLoser = (camel: CamelColor) => {
    if (state.phase === 'race-ended') return false;
    const player = state.players[state.currentPlayerIndex];
    return !player.raceLoserBets.includes(camel) && !player.raceWinnerBets.includes(camel);
  };

  // Shuffle dice pool purely for display variety (doesn't affect logic)
  void shuffle;

  return { state, log, rollDie, takeLegBet, placeRaceBet, placeTrapTile, removeTrapTile, canRoll, canBetWinner, canBetLoser };
}
