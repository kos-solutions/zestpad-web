'use client';

/**
 * Liniatura, desenata ca SVG in loc de imagine: se scaleaza perfect,
 * nu incarca fisiere, si arata la fel pe orice densitate de ecran.
 */
export type BackgroundKind = 'WHITE' | 'MATH' | 'DICTANDO' | 'MUSIC';

export const BACKGROUND_LABELS: Record<BackgroundKind, string> = {
  WHITE: 'Foaie albă',
  MATH: 'Matematică',
  DICTANDO: 'Dictando',
  MUSIC: 'Portativ',
};

const GRID = 40;      // patratele de matematica
const LINE = 56;      // randuri dictando
const STAFF_GAP = 16; // distanta intre liniile portativului
const STAFF_BLOCK = 160;

export function PaperBackground({
  kind, width, height,
}: { kind: BackgroundKind; width: number; height: number }) {
  if (kind === 'WHITE') return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {kind === 'MATH' && (
        <>
          <defs>
            <pattern id="zp-math" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#c7d7ea" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#zp-math)" />
        </>
      )}

      {kind === 'DICTANDO' && (
        <>
          {Array.from({ length: Math.floor(height / LINE) }, (_, i) => (
            <line
              key={i} x1={0} x2={width} y1={(i + 1) * LINE} y2={(i + 1) * LINE}
              stroke="#bcd0e8" strokeWidth="1"
            />
          ))}
          {/* margine rosie, ca in caietul romanesc */}
          <line x1={90} x2={90} y1={0} y2={height} stroke="#f0b4b4" strokeWidth="1.5" />
        </>
      )}

      {kind === 'MUSIC' &&
        Array.from({ length: Math.floor(height / STAFF_BLOCK) }, (_, block) => {
          const top = block * STAFF_BLOCK + 60;
          return (
            <g key={block}>
              {[0, 1, 2, 3, 4].map((line) => (
                <line
                  key={line}
                  x1={60} x2={width - 60}
                  y1={top + line * STAFF_GAP} y2={top + line * STAFF_GAP}
                  stroke="#9fb4cc" strokeWidth="1.2"
                />
              ))}
            </g>
          );
        })}
    </svg>
  );
}
