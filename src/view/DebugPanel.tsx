// ---------------------------------------------------------------------------
// DebugPanel — raw game-state inspector
//
// Shows the full track layout, dice pool, leg-win probabilities (exact %),
// and a JSON dump of the state. Collapsible. Purely read-only.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import type { GameState } from '../model/types';
import { computeLegProbabilities } from '../model/probability';
import { getLeadingCamel, getLastCamel, getCamelRanking } from '../model/movement';
import { CAMEL_HEX } from '../model/constants';

interface Props {
  state: GameState;
}

function Pill({ children, hex }: { children: React.ReactNode; hex?: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-white mr-1"
      style={{ background: hex ?? '#6b7280' }}
    >
      {children}
    </span>
  );
}

export function DebugPanel({ state }: Props) {
  const [open, setOpen] = useState(true);
  const [jsonOpen, setJsonOpen] = useState(false);

  const { track, dicePool, legBetStacks, players, currentPlayerIndex, phase, legNumber } = state;

  // ── Probabilities ──────────────────────────────────────────────────────
  let probData: Record<string, number> | null = null;
  let probError: string | null = null;
  let totalOutcomes: number | null = null;
  try {
    const result = computeLegProbabilities(track, dicePool);
    probData = result.winProbabilities as Record<string, number>;
    totalOutcomes = result.totalOutcomes;
    // Also log to console any time this re-renders
    console.log(
      '[DebugPanel] legProbs',
      Object.fromEntries(
        Object.entries(result.winProbabilities).map(([c, p]) => [c, +p.toFixed(4)])
      ),
      `| outcomes=${result.totalOutcomes} | dicePool=[${dicePool.join(',')}]`
    );
  } catch (e) {
    probError = String(e);
    console.error('[DebugPanel] computeLegProbabilities threw:', e);
  }

  // ── Track summary ──────────────────────────────────────────────────────
  const leader = getLeadingCamel(track);
  const last   = getLastCamel(track);
  const ranking = getCamelRanking(track);

  // Which spaces are occupied?
  const occupied = track
    .map((stack, i) => ({ space: i, stack }))
    .filter(({ stack }) => stack.length > 0);

  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm text-xs font-mono overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wide transition-colors"
      >
        <span>🔍 Debug Panel</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-2 flex flex-col gap-2 text-slate-800">

          {/* ── Meta ── */}
          <section className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
            <span><b>phase:</b> {phase}</span>
            <span><b>leg:</b> {legNumber}</span>
            <span><b>player:</b> {players[currentPlayerIndex]?.name ?? '—'} (#{currentPlayerIndex})</span>
            <span><b>leader:</b> {leader ?? 'none'}</span>
            <span><b>last:</b> {last ?? 'none'}</span>
          </section>

          {/* ── Dice pool ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Pool ({dicePool.length})
            </div>
            <div className="mt-0.5">
              {dicePool.length === 0
                ? <span className="text-[11px] text-slate-400 italic">empty</span>
                : dicePool.map(c => <Pill key={c} hex={c === 'crazy' ? '#666' : CAMEL_HEX[c]}>{c}</Pill>)
              }
            </div>
          </section>

          {/* ── Track layout ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Track</div>
            {occupied.length === 0
              ? <span className="text-[11px] text-slate-400 italic">no camels</span>
              : (
                <table className="w-full border-collapse text-[11px] mt-0.5">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left pr-2 font-medium w-8">Sp</th>
                      <th className="text-left pr-2 font-medium">Stack (btm→top)</th>
                      <th className="text-left font-medium">Top</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupied.map(({ space, stack }) => (
                      <tr key={space} className={space === track.findIndex(s => s.includes(leader as never)) ? 'bg-yellow-50' : ''}>
                        <td className="pr-2 font-bold">{space + 1}</td>
                        <td className="pr-2">{stack.map((c, i) => <Pill key={i} hex={CAMEL_HEX[c]}>{c[0].toUpperCase()}</Pill>)}</td>
                        <td><Pill hex={CAMEL_HEX[stack[stack.length - 1]]}>{stack[stack.length - 1]}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </section>

          {/* ── Overall ranking ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Ranking</div>
            <div className="mt-0.5">
              {ranking.length === 0
                ? <span className="text-[11px] text-slate-400 italic">none</span>
                : ranking.map((c, i) => (
                    <span key={c} className="mr-1.5 text-[11px]">
                      <span className="text-slate-400">{i + 1}.</span>{' '}
                      <Pill hex={CAMEL_HEX[c]}>{c[0].toUpperCase() + c.slice(1)}</Pill>
                    </span>
                  ))
              }
            </div>
          </section>

          {/* ── Leg-win probabilities ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Leg-Win Probs
              {totalOutcomes !== null && <span className="ml-1 normal-case">({totalOutcomes.toLocaleString()} outcomes)</span>}
            </div>
            {probError && (
              <div className="text-red-600 bg-red-50 rounded p-1 text-[11px] mt-0.5">⚠️ {probError}</div>
            )}
            {probData && (
              <table className="w-full border-collapse text-[11px] mt-0.5">
                <tbody>
                  {Object.entries(probData)
                    .sort(([, a], [, b]) => b - a)
                    .map(([camel, p]) => (
                      <tr key={camel}>
                        <td className="pr-2 w-16"><Pill hex={CAMEL_HEX[camel as keyof typeof CAMEL_HEX]}>{camel}</Pill></td>
                        <td className="pr-2 tabular-nums w-14">
                          {(p * 100).toFixed(1)}%
                          {p >= 0.999 && <span className="ml-1 text-amber-600">⚠️</span>}
                          {p === 0 && dicePool.includes(camel as never) && <span className="ml-1 text-red-500">⚠️0%</span>}
                        </td>
                        <td className="w-20">
                          <div className="h-2.5 rounded-sm bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-sm" style={{ width: `${(p * 100).toFixed(1)}%`, background: CAMEL_HEX[camel as keyof typeof CAMEL_HEX] ?? '#6b7280' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Leg-bet stacks ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Leg-Bet Stacks</div>
            <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px]">
              {Object.entries(legBetStacks).map(([camel, tiles]) => (
                <span key={camel}>
                  <Pill hex={CAMEL_HEX[camel as keyof typeof CAMEL_HEX]}>{camel[0].toUpperCase()}</Pill>
                  <span className="text-slate-500">[{tiles.join(',')}]</span>
                </span>
              ))}
            </div>
          </section>

          {/* ── Players ── */}
          <section>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Players</div>
            <table className="w-full border-collapse text-[11px] mt-0.5">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left pr-2 font-medium">Name</th>
                  <th className="text-left pr-2 font-medium">🪙</th>
                  <th className="text-left pr-2 font-medium">Leg bets</th>
                  <th className="text-left font-medium">Race</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i} className={i === currentPlayerIndex ? 'bg-blue-50' : ''}>
                    <td className="pr-2 font-semibold">{i === currentPlayerIndex ? '▶ ' : ''}{p.name}</td>
                    <td className="pr-2 tabular-nums">{p.coins}</td>
                    <td className="pr-2">
                      {p.legBets.length === 0
                        ? <span className="text-slate-300">—</span>
                        : p.legBets.map((b, j) => <Pill key={j} hex={CAMEL_HEX[b.camel]}>{b.camel[0].toUpperCase()}:{b.payout}</Pill>)
                      }
                    </td>
                    <td>
                      {[...p.raceWinnerBets.map(c => `W:${c[0]}`), ...p.raceLoserBets.map(c => `L:${c[0]}`)].join(' ') || <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── Raw JSON dump ── */}
          <section>
            <button
              onClick={() => setJsonOpen(o => !o)}
              className="text-[10px] text-slate-400 uppercase tracking-wide hover:text-slate-600"
            >
              {jsonOpen ? '▲' : '▼'} Raw JSON state
            </button>
            {jsonOpen && (
              <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[10px] overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {JSON.stringify(state, null, 2)}
              </pre>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
