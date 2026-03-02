// ---------------------------------------------------------------------------
// EVTable — shows all available leg actions sorted by EV with recommendation
// ---------------------------------------------------------------------------

import type { LegAction } from '../model/ev';
import { CAMEL_HEX } from '../model/constants';
import { CamelToken } from './CamelToken';
import type { CamelColor } from '../model/types';

interface Props {
  actions: LegAction[];
  bestAction: LegAction;
  varianceMode?: boolean;
}

function evColor(ev: number): string {
  if (ev > 2)   return 'text-green-700 font-bold';
  if (ev > 1)   return 'text-green-600 font-semibold';
  if (ev > 0)   return 'text-yellow-700';
  if (ev === 1) return 'text-gray-600';
  return 'text-red-500';
}

function isBest(action: LegAction, best: LegAction): boolean {
  if (action.type !== best.type) return false;
  if (action.type === 'roll') return true;
  if (action.type === 'bet' && best.type === 'bet') {
    return action.camel === best.camel;
  }
  return false;
}

function sigmaColor(stdDev: number): string {
  if (stdDev > 3)    return 'text-red-600 font-bold';
  if (stdDev > 2)    return 'text-orange-600 font-semibold';
  if (stdDev > 1.2)  return 'text-yellow-700';
  return 'text-green-600';
}

function riskLabel(stdDev: number): string {
  if (stdDev > 3)   return '🔴 High';
  if (stdDev > 2)   return '🟠 Med';
  if (stdDev > 1.2) return '🟡 Low';
  return '🟢 Safe';
}

export function EVTable({ actions, bestAction, varianceMode = false }: Props) {
  // In variance mode: sort bet actions by stdDev descending (riskiest first);
  // always show roll at the bottom.
  const sorted = varianceMode
    ? [
        ...actions.filter(a => a.type === 'bet').sort((a, b) =>
          (b as Extract<LegAction, {type:'bet'}>).stdDev -
          (a as Extract<LegAction, {type:'bet'}>).stdDev
        ),
        ...actions.filter(a => a.type === 'roll'),
      ]
    : actions;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-lg border border-amber-200">
        <table className="w-full text-xs">
          <thead className="bg-amber-50 border-b border-amber-200">
            <tr>
              <th className="text-left px-2 py-1.5 text-amber-700">Action</th>
              <th className="text-right px-2 py-1.5 text-amber-700">Pay</th>
              <th className="text-right px-2 py-1.5 text-amber-700">P(win)</th>
              <th className="text-right px-2 py-1.5 text-amber-700">EV</th>
              {varianceMode ? (
                <>
                  <th className="text-right px-2 py-1.5 text-purple-600">σ</th>
                  <th className="text-right px-2 py-1.5 text-purple-600">Risk</th>
                </>
              ) : (
                <th className="text-right px-2 py-1.5 text-amber-700">±σ</th>
              )}
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-amber-100">
            {sorted.map((action, idx) => {
              const best = isBest(action, bestAction);

              if (action.type === 'roll') {
                return (
                  <tr
                    key="roll"
                    className={`${best ? 'bg-green-50' : 'bg-white hover:bg-amber-50'} transition-colors`}
                  >
                    <td className="px-2 py-1.5 font-medium text-gray-700">🎲 Roll pyramid</td>
                    <td className="px-2 py-1.5 text-right text-gray-400">—</td>
                    <td className="px-2 py-1.5 text-right text-gray-400">—</td>
                    <td className={`px-2 py-1.5 text-right ${evColor(1)}`}>+1.00</td>
                    {varianceMode ? (
                      <>
                        <td className="px-2 py-1.5 text-right text-green-600">0.00</td>
                        <td className="px-2 py-1.5 text-right text-green-600 text-[10px]">🟢 Safe</td>
                      </>
                    ) : (
                      <td className="px-2 py-1.5 text-right text-gray-400">0.00</td>
                    )}
                    <td className="px-2 py-1.5 text-right">
                      {best && <span className="text-green-600 font-bold text-[10px]">★ BEST</span>}
                    </td>
                  </tr>
                );
              }

              const { camel, payout, ev, winProbability, stdDev, beatsRoll } = action;
              const rowBg = best
                ? 'bg-green-50'
                : varianceMode && stdDev > 3
                ? 'bg-red-50'
                : varianceMode && stdDev > 2
                ? 'bg-orange-50'
                : 'bg-white hover:bg-amber-50';

              return (
                <tr key={`${camel}-${idx}`} className={`${rowBg} transition-colors`}>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <CamelToken color={camel as CamelColor} size="sm" />
                      <span className="text-gray-700 capitalize">{camel}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: CAMEL_HEX[camel as CamelColor] + '33', color: '#374151' }}
                    >
                      {payout}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-600">
                    {(winProbability * 100).toFixed(1)}%
                  </td>
                  <td className={`px-2 py-1.5 text-right ${evColor(ev)}`}>
                    {varianceMode
                      ? `[${(ev - stdDev).toFixed(1)}, ${(ev + stdDev).toFixed(1)}]`
                      : `${ev >= 0 ? '+' : ''}${ev.toFixed(2)}`}
                  </td>
                  {varianceMode ? (
                    <>
                      <td className={`px-2 py-1.5 text-right ${sigmaColor(stdDev)}`}>
                        {stdDev.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-[10px]">
                        {riskLabel(stdDev)}
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-1.5 text-right text-gray-400">{stdDev.toFixed(2)}</td>
                  )}
                  <td className="px-2 py-1.5 text-right">
                    {best && <span className="text-green-600 font-bold text-[10px]">★ BEST</span>}
                    {!best && beatsRoll && !varianceMode && (
                      <span className="text-blue-500 text-[10px]">+EV</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400">
        {varianceMode
          ? 'Sorted by σ descending · EV column shows [EV−σ, EV+σ] range'
          : 'EV = P(win) × (payout+1) − 1 · σ = std deviation of coin outcome'}
      </p>
    </div>
  );
}
