// ---------------------------------------------------------------------------
// Board — oval SVG track visualisation for Camel Up
//
// 16 arc-segment spaces arranged around an ellipse.
// Camels rendered as SVG silhouettes inside each segment, rotated to face
// the direction of travel (clockwise around the oval).
// ---------------------------------------------------------------------------

import type { CamelColor, GameState, PlayerState, TrapTile } from '../model/types';
import { CAMEL_HEX } from '../model/constants';
import { DicePoolIndicator } from './DicePoolIndicator';
import { LegBetStacks } from './LegBetStacks';

// ---------------------------------------------------------------------------
// Oval geometry
// ---------------------------------------------------------------------------

const CX  = 310;  // SVG centre x
const CY  = 216;  // SVG centre y
const ORX = 290;  // outer ellipse rx  (wider, more oval)
const ORY = 188;  // outer ellipse ry  (flatter – ratio 1.54)
const IRX = 168;  // inner ellipse rx
const IRY = 84;   // inner ellipse ry  (inner even flatter – ratio 2.0)
const GAP = 0.6;  // degree gap between segments
const N   = 16;   // spaces on the track
const DEG = 360 / N; // 22.5° per space
const START_DEG = -90; // top of oval = space 0

function toRad(d: number) { return (d * Math.PI) / 180; }

function ep(rx: number, ry: number, deg: number) {
  const r = toRad(deg);
  return {
    x: +(CX + rx * Math.cos(r)).toFixed(2),
    y: +(CY + ry * Math.sin(r)).toFixed(2),
  };
}

/** Arc path for segment i. */
function segPath(i: number) {
  const a1 = START_DEG + i * DEG + GAP;
  const a2 = START_DEG + (i + 1) * DEG - GAP;
  const o1 = ep(ORX, ORY, a1), o2 = ep(ORX, ORY, a2);
  const i1 = ep(IRX, IRY, a1), i2 = ep(IRX, IRY, a2);
  return (
    `M${o1.x},${o1.y} ` +
    `A${ORX},${ORY} 0 0 1 ${o2.x},${o2.y} ` +
    `L${i2.x},${i2.y} ` +
    `A${IRX},${IRY} 0 0 0 ${i1.x},${i1.y}Z`
  );
}

/** Midpoint angle for segment i. */
function midDeg(i: number) { return START_DEG + (i + 0.5) * DEG; }

/** Point on the ellipse interpolated between inner (f=0) and outer (f=1). */
function ringPt(i: number, f: number) {
  const a = midDeg(i);
  const rx = IRX + (ORX - IRX) * f;
  const ry = IRY + (ORY - IRY) * f;
  return ep(rx, ry, a);
}

/** Degrees to rotate a right-facing camel so it faces the clockwise travel direction. */
function camelFaceDeg(i: number) {
  const r = toRad(midDeg(i));
  const tx = -ORX * Math.sin(r); // clockwise tangent x
  const ty =  ORY * Math.cos(r); // clockwise tangent y
  return (Math.atan2(ty, tx) * 180) / Math.PI;
}

// Segment colours
function segFill(i: number, highlighted: boolean) {
  if (highlighted) return '#fde68a';
  if (i === 15) return '#fca5a5';           // finish — red tint
  if (i === 0)  return '#fef9c3';           // start  — yellow tint
  return i % 2 === 0 ? '#e8c98a' : '#d4b96a';
}
function segStroke(i: number, highlighted: boolean) {
  if (highlighted) return '#f59e0b';
  if (i === 15)   return '#dc2626';
  if (i === 0)    return '#ca8a04';
  return '#b8955a';
}

// ---------------------------------------------------------------------------
// Camel silhouette path (40×30 viewBox, right-facing, centre ≈ 20,15)
// ---------------------------------------------------------------------------
const CAMEL_D =
  'M 4,30 L 4,22 ' +
  'C 4,14 8,8 14,5 ' +
  'C 16,3 20,2 22,4 ' +
  'C 24,6 26,10 26,18 ' +
  'L 28,12 ' +
  'C 30,9 34,10 36,14 ' +
  'C 38,18 36,24 33,25 ' +
  'C 31,25 30,23 32,23 ' +
  'L 34,23 L 34,30 L 30,30 L 30,23 ' +
  'L 22,23 L 22,30 L 18,30 L 18,23 ' +
  'L 10,23 L 10,30 Z';

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface Props {
  state: GameState;
  highlightedSpace?: number;
  onSpaceClick?: (spaceIndex: number) => void;
  /** Camel currently selected for moving. Highlighted with a glow ring. */
  selectedCamel?: CamelColor | null;
  /** Called when the user clicks a camel silhouette. */
  onCamelClick?: (camel: CamelColor) => void;
  /** Width of the rendered SVG in px. Height scales proportionally. Default 400. */
  svgWidth?: number;
}

const PHASE_LABEL: Record<GameState['phase'], string> = {
  setup:        '⚙️  Setup — place your camels',
  running:      '🎲 Leg in progress',
  'leg-end':    '🏆 Leg complete — resolving bets',
  'race-ended': '🏁 Race over!',
};

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function Board({ state, highlightedSpace, onSpaceClick, selectedCamel, onCamelClick, svgWidth }: Props) {
  const { track, dicePool, legBetStacks, players, currentPlayerIndex, phase, legNumber, trapTiles } = state;
  const currentPlayer = players[currentPlayerIndex];
  // svgWidth is optional — if omitted the SVG fills its container (responsive)
  const svgHeight = svgWidth ? Math.round(svgWidth * (432 / 620)) : undefined;

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl w-full"
      style={{
        background: 'linear-gradient(145deg, #c9954a 0%, #a97230 55%, #8c5e22 100%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)',
        border: '3px solid #6b4113',
        maxWidth: svgWidth ? svgWidth + 24 : 820,
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-amber-100 tracking-wide drop-shadow leading-tight">
            🐪 Camel Up
          </h2>
          <p className="text-[10px] text-amber-300 font-medium leading-tight">
            Leg {legNumber}&nbsp;·&nbsp;{PHASE_LABEL[phase]}
          </p>
        </div>
        {selectedCamel && onCamelClick && (
          <div className="text-[11px] bg-white/20 text-white rounded px-2 py-0.5 font-semibold animate-pulse">
            <span style={{ color: CAMEL_HEX[selectedCamel] }}>●</span> {selectedCamel} — click a space
          </div>
        )}
        {!selectedCamel && phase === 'running' && currentPlayer && (
          <div className="text-[11px] text-amber-900 bg-amber-200 rounded px-2 py-0.5 border border-amber-400 font-semibold">
            ▶ {currentPlayer.name}&nbsp;·&nbsp;🪙{currentPlayer.coins}
          </div>
        )}
      </div>

      {/* ── Oval SVG Track ── */}
      <svg
        viewBox="0 0 620 432"
        width={svgWidth ?? '100%'}
        height={svgHeight}
        style={{ display: 'block', height: svgHeight ?? 'auto' }}
      >
        <defs>
          {/* Board interior parchment gradient */}
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fdf6e3" />
            <stop offset="100%" stopColor="#f5e3bc" />
          </radialGradient>
          {/* Subtle inner shadow for the ring */}
          <filter id="segShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Outer board background */}
        <rect x="0" y="0" width="620" height="432" rx="18" fill="#92682a" />

        {/* Interior parchment oval */}
        <ellipse cx={CX} cy={CY} rx={IRX - 4} ry={IRY - 4} fill="url(#bgGrad)" />

        {/* ── 16 arc segments ── */}
        {Array.from({ length: N }, (_, i) => {
          const highlighted = highlightedSpace === i;
          const stack = track[i];
          const labelPt = ringPt(i, 0.90); // space number near outer edge
          const rot = camelFaceDeg(i);
          const isStart  = i === 0;
          const isFinish = i === 15;

          // Radial factor per stack position: stack[0]=bottom (inner), stack[N-1]=top (outer)
          // f=0 → inner ellipse, f=1 → outer ellipse
          // Bottom sits near the center oval; top camel is furthest out (visually "on top")
          // SVG renders in idx order so the highest idx (top camel) paints last = in front
          const totalCamels = stack.length;
          const camelRings = stack.map((_, idx) => {
            // bottom (idx=0) near inner, top near outer — spread 0.22 → 0.55
            const f = totalCamels === 1
              ? 0.47
              : 0.22 + (idx / (totalCamels - 1)) * 0.33;
            return f;
          });

          // Check for trap tile on this space
          const trapTile: TrapTile | undefined = trapTiles?.find(t => t.space === i);
          const trapIcon = trapTile ? (trapTile.type === 'oasis' ? '🌴' : '🏜️') : null;
          const trapPt = trapTile ? ringPt(i, 0.72) : null;

          return (
            <g key={i}>
              {/* Segment fill */}
              <path
                d={segPath(i)}
                fill={segFill(i, highlighted)}
                stroke={segStroke(i, highlighted)}
                strokeWidth={highlighted ? 2.5 : 1.5}
                filter="url(#segShadow)"
                style={onSpaceClick ? { cursor: 'pointer' } : undefined}
                onClick={() => onSpaceClick?.(i)}
              />

              {/* Space number */}
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isFinish ? 13 : 11}
                fontWeight="900"
                fill={isFinish ? '#dc2626' : isStart ? '#92400e' : '#7a4e1a'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {isFinish ? '🏁' : isStart ? '①' : i + 1}
              </text>

              {/* Desert tile icon */}
              {trapTile && trapPt && (
                <text
                  x={trapPt.x}
                  y={trapPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="13"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {trapIcon}
                </text>
              )}

              {/* Camel silhouettes in this segment */}
              {stack.map((color, idx) => {
                const f = camelRings[idx];
                const pt = ringPt(i, f);
                const sc = 0.72;
                const isSelected = selectedCamel === color;
                const isClickable = !!onCamelClick;
                const stroke =
                  color === 'white'  ? '#9ca3af' :
                  color === 'yellow' ? '#b45309' :
                  color === 'pink'   ? '#9d174d' :
                  'rgba(0,0,0,0.35)';
                return (
                  <g
                    key={color}
                    transform={`translate(${pt.x} ${pt.y}) rotate(${rot}) scale(${sc}) translate(-20 -15)`}
                    style={{ cursor: isClickable ? 'pointer' : 'default', pointerEvents: isClickable ? 'all' : 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // If a camel is already selected, treat any camel click as a space click (move to this segment)
                      if (selectedCamel) {
                        onSpaceClick?.(i);
                      } else {
                        onCamelClick?.(color);
                      }
                    }}
                  >
                    {/* Glow ring when selected */}
                    {isSelected && (
                      <ellipse cx="20" cy="22" rx="18" ry="10" fill="white" opacity="0.55" />
                    )}
                    <path
                      d={CAMEL_D}
                      fill={CAMEL_HEX[color]}
                      stroke={isSelected ? 'white' : stroke}
                      strokeWidth={isSelected ? 3 : 1.8}
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Centre logo */}
        <text
          x={CX} y={CY - 12}
          textAnchor="middle"
          fontSize="22"
          style={{ userSelect: 'none' }}
        >
          🐪
        </text>
        <text
          x={CX} y={CY + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontWeight="800"
          fill="#92400e"
          style={{ userSelect: 'none' }}
        >
          CAMEL UP
        </text>
        <text
          x={CX} y={CY + 22}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#b45309"
          style={{ userSelect: 'none' }}
        >
          ← clockwise →
        </text>
      </svg>

      {/* ── Footer ── */}
      <div className="flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 6 }}>
        <div className="bg-black/20 rounded-lg px-2 py-1">
          <DicePoolIndicator dicePool={dicePool} />
        </div>
        <div className="bg-black/20 rounded-lg px-2 py-1">
          <LegBetStacks legBetStacks={legBetStacks} />
        </div>
        {players.length > 0 && (
          <div className="bg-black/20 rounded-lg px-2 py-1">
            <PlayerScoreboard players={players} currentPlayerIndex={currentPlayerIndex} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerScoreboard
// ---------------------------------------------------------------------------

interface ScoreboardProps {
  players: PlayerState[];
  currentPlayerIndex: number;
}

function PlayerScoreboard({ players, currentPlayerIndex }: ScoreboardProps) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
        Players
      </h3>
      <div className="flex flex-col gap-1">
        {players.map((p, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs rounded px-2 py-0.5 ${
              i === currentPlayerIndex
                ? 'bg-amber-300/30 font-semibold text-amber-100'
                : 'text-amber-300'
            }`}
          >
            <span>{i === currentPlayerIndex ? '▶' : '\u00a0'}</span>
            <span className="min-w-[60px]">{p.name}</span>
            <span className="font-mono">🪙 {p.coins}</span>
            {p.legBets.length > 0 && (
              <span className="text-[10px] text-amber-400">
                +{p.legBets.length} bet{p.legBets.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
