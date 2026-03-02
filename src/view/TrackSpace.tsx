// ---------------------------------------------------------------------------
// TrackSpace — one sandstone tile on the 16-space track
// ---------------------------------------------------------------------------

import type { CamelColor } from '../model/types';
import { CamelToken } from './CamelToken';

interface TrackSpaceProps {
  /** 0-based index */
  index: number;
  /** Camels present, bottom → top */
  stack: CamelColor[];
  highlighted?: boolean;
  onClick?: (spaceIndex: number) => void;
}

export function TrackSpace({ index, stack, highlighted, onClick }: TrackSpaceProps) {
  const isFinishLine = index === 15;
  const isEmpty = stack.length === 0;
  const displayNum = index + 1;

  return (
    <div
      className={`
        relative flex flex-col-reverse items-center justify-start
        w-14 min-h-[96px] rounded-lg pb-1 pt-1 gap-0 transition-all
        border-2
        ${
          isFinishLine
            ? 'border-red-500 bg-gradient-to-b from-red-100 to-red-50 shadow-md'
            : highlighted
            ? 'border-amber-500 bg-amber-200 cursor-pointer shadow-md'
            : 'border-[#b8955a] bg-gradient-to-b from-[#e8c98a] to-[#d4aa60] hover:brightness-105'
        }
        ${ onClick ? 'cursor-pointer' : '' }
      `}
      style={{
        boxShadow: isFinishLine
          ? undefined
          : 'inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)',
      }}
      onClick={() => onClick?.(index)}
      title={`Space ${displayNum}${isFinishLine ? ' — Finish!' : ''}`}
    >
      {/* Space number badge */}
      <span
        className={`
          absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-black
          tracking-tight select-none
          ${ isFinishLine ? 'text-red-600' : 'text-[#7a4e1a]' }
        `}
      >
        {isFinishLine ? '🏁' : displayNum}
      </span>

      {/* Camel stack, bottom→top */}
      <div className="flex flex-col-reverse items-center gap-0.5 mt-5">
        {stack.map((color, stackIdx) => (
          <CamelToken
            key={`${color}-${stackIdx}`}
            color={color}
            size="sm"
          />
        ))}
      </div>

      {isEmpty && (
        <div className="mt-5 text-[10px] text-[#c49a4a] select-none">···</div>
      )}
    </div>
  );
}

