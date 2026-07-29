'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import getStroke from 'perfect-freehand';
import { PaperBackground, type BackgroundKind } from './PaperBackground';
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, type Drawing, type Point, type Stroke,
  emptyDrawing, parseDrawing, serializeDrawing,
} from '@/lib/strokes';

export interface ZestCanvasHandle {
  getDrawing: () => Drawing;
  serialize: () => string;
  clear: () => void;
  undo: () => void;
  isDirty: () => boolean;
  markClean: () => void;
}

interface Props {
  /** Traseele editabile (ale utilizatorului curent). */
  value?: string | null;
  /** Strat de dedesubt, needitabil: enuntul profesorului sau lucrarea elevului. */
  underlay?: string | null;
  underlayColor?: string;
  /** Strat deasupra, needitabil: corectura profesorului cand elevul isi vede tema. */
  overlay?: string | null;
  overlayColor?: string;
  background?: BackgroundKind;
  readOnly?: boolean;
  /** Culoarea implicita a instrumentului (rosu pentru corectura profesorului). */
  defaultColor?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

const COLORS = ['#1a1a1a', '#1b70f0', '#dc2626', '#16a34a'];
const SIZES = [2, 4, 7, 12];

/** Parametri perfect-freehand: dau senzatia de stilou real. */
const STROKE_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.55,
  streamline: 0.42,
  easing: (t: number) => Math.sin((t * Math.PI) / 2),
  simulatePressure: false,
  last: true,
};

function strokeToPath(stroke: Stroke): string {
  const outline = getStroke(
    stroke.points.map(([x, y, p]) => ({ x, y, pressure: p })),
    { ...STROKE_OPTIONS, size: stroke.size * 2.2 }
  );
  if (outline.length < 2) return '';
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...outline[0], 'Q'] as (string | number)[]
  );
  return d.join(' ') + ' Z';
}

function renderLayer(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  colorOverride?: string,
  alpha = 1
) {
  for (const stroke of strokes) {
    const path = strokeToPath(stroke);
    if (!path) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (stroke.erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = colorOverride ?? stroke.color;
    }
    ctx.fill(new Path2D(path));
    ctx.restore();
  }
}

export const ZestCanvas = forwardRef<ZestCanvasHandle, Props>(function ZestCanvas(
  {
    value, underlay, underlayColor, overlay, overlayColor,
    background = 'WHITE', readOnly = false, defaultColor = '#1a1a1a', onDirtyChange,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const drawingRef = useRef<Drawing>(emptyDrawing());
  const liveStrokeRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [color, setColor] = useState(defaultColor);
  const [size, setSize] = useState(3);
  const [erasing, setErasing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  /** Semnaleaza cand a fost detectat un stylus real, ca sa activam palm rejection. */
  const [penDetected, setPenDetected] = useState(false);
  const penDetectedRef = useRef(false);

  const underlayRef = useRef<Stroke[]>([]);
  const overlayRef = useRef<Stroke[]>([]);

  useEffect(() => { underlayRef.current = parseDrawing(underlay).strokes; redraw(); }, [underlay]);
  useEffect(() => { overlayRef.current = parseDrawing(overlay).strokes; redraw(); }, [overlay]);

  useEffect(() => {
    drawingRef.current = parseDrawing(value);
    setStrokeCount(drawingRef.current.strokes.length);
    dirtyRef.current = false;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const redraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Straturi, de jos in sus.
      if (underlayRef.current.length) {
        renderLayer(ctx, underlayRef.current, underlayColor, underlayColor ? 0.85 : 1);
      }
      renderLayer(ctx, drawingRef.current.strokes);
      if (liveStrokeRef.current) renderLayer(ctx, [liveStrokeRef.current]);
      if (overlayRef.current.length) {
        renderLayer(ctx, overlayRef.current, overlayColor, 0.9);
      }
    });
  }, [underlayColor, overlayColor]);

  useEffect(() => { redraw(); }, [redraw]);

  /** Coordonate in spatiul logic al foii, indiferent de zoom/dimensiunea afisata. */
  const toCanvasPoint = useCallback((e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    // Multe device-uri raporteaza 0 sau 0.5 constant cand nu au senzor de presiune.
    const raw = e.pressure;
    const pressure = e.pointerType === 'pen' && raw > 0 && raw !== 0.5 ? raw : 0.5;
    return [x, y, pressure];
  }, []);

  /**
   * Palm rejection: din momentul in care am vazut un stylus, ignoram atingerile
   * cu degetul/palma. Fara asta, mana sprijinita pe ecran deseneaza.
   */
  const shouldIgnore = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'pen') return false;
    if (e.pointerType === 'touch' && penDetectedRef.current) return true;
    return false;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (readOnly) return;
    if (e.pointerType === 'pen' && !penDetectedRef.current) {
      penDetectedRef.current = true;
      setPenDetected(true);
    }
    if (shouldIgnore(e)) return;
    if (activePointerRef.current !== null) return; // un singur traseu simultan
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activePointerRef.current = e.pointerId;

    liveStrokeRef.current = {
      id: crypto.randomUUID(),
      color, size,
      ...(erasing ? { erase: true } : {}),
      points: [toCanvasPoint(e)],
    };
    redraw();
  }, [readOnly, shouldIgnore, color, size, erasing, toCanvasPoint, redraw]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (activePointerRef.current !== e.pointerId || !liveStrokeRef.current) return;
    e.preventDefault();

    // getCoalescedEvents recupereaza punctele intermediare pe care browserul
    // le-a comprimat — fara ele, scrisul rapid iese coltat.
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function'
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];

    for (const ev of events) {
      const synthetic = {
        clientX: ev.clientX, clientY: ev.clientY,
        pressure: ev.pressure, pointerType: ev.pointerType,
      } as React.PointerEvent;
      liveStrokeRef.current.points.push(toCanvasPoint(synthetic));
    }
    redraw();
  }, [toCanvasPoint, redraw]);

  const finishStroke = useCallback(() => {
    const live = liveStrokeRef.current;
    activePointerRef.current = null;
    liveStrokeRef.current = null;
    if (!live) return;
    // Un punct izolat = atingere accidentala, nu traseu.
    if (live.points.length < 2) { redraw(); return; }

    drawingRef.current.strokes.push(live);
    setStrokeCount(drawingRef.current.strokes.length);
    markDirty();
    redraw();
  }, [markDirty, redraw]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activePointerRef.current !== e.pointerId) return;
    finishStroke();
  }, [finishStroke]);

  const undo = useCallback(() => {
    if (drawingRef.current.strokes.length === 0) return;
    drawingRef.current.strokes.pop();
    setStrokeCount(drawingRef.current.strokes.length);
    markDirty();
    redraw();
  }, [markDirty, redraw]);

  const clear = useCallback(() => {
    if (drawingRef.current.strokes.length === 0) return;
    drawingRef.current.strokes = [];
    setStrokeCount(0);
    markDirty();
    redraw();
  }, [markDirty, redraw]);

  useImperativeHandle(ref, () => ({
    getDrawing: () => drawingRef.current,
    serialize: () => serializeDrawing(drawingRef.current),
    clear,
    undo,
    isDirty: () => dirtyRef.current,
    markClean: () => { dirtyRef.current = false; onDirtyChange?.(false); },
  }), [clear, undo, onDirtyChange]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {!readOnly && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-ink-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); setErasing(false); }}
                aria-label={`Culoare ${c}`}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  color === c && !erasing ? 'border-ink-800 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-ink-200" />

          <div className="flex items-center gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-label={`Grosime ${s}`}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                  size === s ? 'bg-ink-100' : 'hover:bg-ink-50'
                }`}
              >
                <span
                  className="rounded-full bg-ink-800"
                  style={{ width: Math.min(s + 2, 14), height: Math.min(s + 2, 14) }}
                />
              </button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-ink-200" />

          <button
            type="button"
            onClick={() => setErasing((v) => !v)}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
              erasing ? 'bg-ink-800 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            Radieră
          </button>
          <button
            type="button" onClick={undo} disabled={strokeCount === 0}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
          >
            Înapoi
          </button>
          <button
            type="button" onClick={clear} disabled={strokeCount === 0}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          >
            Șterge tot
          </button>

          {penDetected && (
            <span className="ml-1 rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700">
              Stylus activ · palma ignorată
            </span>
          )}
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative w-full max-w-[860px] overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg"
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      >
        <PaperBackground kind={background} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`relative h-full w-full ${readOnly ? '' : 'cursor-crosshair'}`}
          // touch-action: none e obligatoriu, altfel browserul face scroll in loc sa deseneze
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
});
