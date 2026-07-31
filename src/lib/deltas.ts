/**
 * Sincronizare incrementala a scrisului.
 *
 * Problema masurata: in timpul predarii lectia creste continuu. Daca fiecare
 * elev descarca lectia intreaga la fiecare schimbare, traficul creste
 * patratic — masurat pe productie, ~1,4 TB pe luna pentru O clasa.
 *
 * Fiindca traseele se adauga la coada cat timp profesorul scrie, e suficient
 * sa trimitem ce s-a adaugat de la ultima sincronizare.
 */
import { parseDrawing, serializeDrawing, type Drawing, type Stroke } from './strokes';

export function countStrokes(raw: string | null | undefined): number {
  if (!raw) return 0;
  return parseDrawing(raw).strokes.length;
}

/** Traseele de dupa indexul dat. */
export function strokesSince(raw: string | null | undefined, since: number): Stroke[] {
  const d = parseDrawing(raw);
  if (since <= 0) return d.strokes;
  if (since >= d.strokes.length) return [];
  return d.strokes.slice(since);
}

/**
 * Adauga traseele primite peste cele locale.
 * Deduplicam dupa id: daca o cerere se repeta (retea instabila), nu dublam.
 */
export function appendStrokes(base: Drawing, incoming: Stroke[]): Drawing {
  if (incoming.length === 0) return base;
  const seen = new Set(base.strokes.map((s) => s.id));
  const fresh = incoming.filter((s) => !seen.has(s.id));
  if (fresh.length === 0) return base;
  return { ...base, strokes: [...base.strokes, ...fresh] };
}

export function drawingFromStrokes(strokes: Stroke[]): string {
  return serializeDrawing({ v: 1, width: 1240, height: 1754, strokes });
}
