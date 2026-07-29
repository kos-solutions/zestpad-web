/**
 * Format de stocare pentru scrisul de mana.
 *
 * De ce nu mai folosim react-canvas-draw: stoca tot desenul ca un singur blob
 * JSON gigant, fara presiune, fara palm rejection, si nu permitea sincronizare
 * incrementala. Aici stocam trasee individuale, cu presiune per punct.
 *
 * Un punct = [x, y, presiune] cu 2 zecimale => compact la serializare.
 */

export type Point = [number, number, number];

export interface Stroke {
  /** id local, folosit la sincronizare incrementala si undo */
  id: string;
  color: string;
  /** grosimea de baza, in px; presiunea o moduleaza */
  size: number;
  /** radiera: traseul sterge in loc sa deseneze */
  erase?: boolean;
  points: Point[];
}

export interface Drawing {
  v: 1;
  width: number;
  height: number;
  strokes: Stroke[];
}

export const CANVAS_WIDTH = 1240;
export const CANVAS_HEIGHT = 1754; // raport A4

export function emptyDrawing(): Drawing {
  return { v: 1, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, strokes: [] };
}

export function parseDrawing(raw: string | null | undefined): Drawing {
  if (!raw) return emptyDrawing();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && Array.isArray(parsed.strokes)) {
      return {
        v: 1,
        width: typeof parsed.width === 'number' ? parsed.width : CANVAS_WIDTH,
        height: typeof parsed.height === 'number' ? parsed.height : CANVAS_HEIGHT,
        strokes: parsed.strokes.filter(isStroke),
      };
    }
  } catch {
    // continut vechi sau corupt -> pornim de la zero in loc sa crapam
  }
  return emptyDrawing();
}

function isStroke(s: unknown): s is Stroke {
  if (!s || typeof s !== 'object') return false;
  const c = s as Partial<Stroke>;
  return typeof c.id === 'string' && typeof c.color === 'string' && Array.isArray(c.points);
}

export function serializeDrawing(d: Drawing): string {
  return JSON.stringify({
    v: 1,
    width: d.width,
    height: d.height,
    strokes: d.strokes.map((s) => ({
      id: s.id,
      color: s.color,
      size: s.size,
      ...(s.erase ? { erase: true } : {}),
      points: s.points.map(([x, y, p]) => [round(x), round(y), round(p)] as Point),
    })),
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function isEmpty(d: Drawing): boolean {
  return d.strokes.length === 0;
}

/** Numar aproximativ de caractere — util ca sa nu trimitem payload-uri absurde. */
export function approxSize(d: Drawing): number {
  return d.strokes.reduce((acc, s) => acc + s.points.length * 14 + 40, 20);
}
