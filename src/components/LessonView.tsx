'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ZestCanvas, type ZestCanvasHandle } from './ZestCanvas';
import { SaveIndicator, ErrorBanner, Spinner, LiveBadge, PresencePanel } from './ui';
import { api, ApiError, saveContent, type SaveState } from '@/lib/api';
import { loadDraft } from '@/lib/offline';
import { useLessonLive, usePresence } from '@/lib/live';
import { appendStrokes, drawingFromStrokes } from '@/lib/deltas';
import { parseDrawing, type Stroke } from '@/lib/strokes';
import type { BackgroundKind } from './PaperBackground';

interface Props {
  lesson: {
    id: string; title: string; type: string; content: string; published: boolean;
    dueAt: string | null; liveUntil: string | null; version: number;
    topicId: string; topicTitle: string;
    background: BackgroundKind; className: string; isTeacher: boolean;
  };
  myNotes: string;
  stats: { submitted: number; graded: number; total: number };
}

const AUTOSAVE_MS = 2500;
const AUTOSAVE_LIVE_MS = 1200; // in timpul predarii salvam mai des

export function LessonView({ lesson, myNotes, stats }: Props) {
  const router = useRouter();
  const canvasRef = useRef<ZestCanvasHandle>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTeacher = lesson.isTeacher;
  const liveNow = !!lesson.liveUntil && new Date(lesson.liveUntil).getTime() > Date.now();
  const [live, setLive] = useState(liveNow);

  // ---- ce editeaza fiecare rol ----
  // Profesorul scrie lectia. Elevul isi scrie notitele peste ea.
  const draftKey = isTeacher ? `lesson:${lesson.id}` : `notes:${lesson.id}`;
  const initial = isTeacher ? lesson.content : myNotes;
  const [content, setContent] = useState(initial);

  // ---- continutul profesorului, actualizat incremental pe tableta elevului ----
  const [teacherContent, setTeacherContent] = useState(lesson.content);
  const [following, setFollowing] = useState(true);
  const [pendingUpdate, setPendingUpdate] = useState(false);
  // Cate trasee avem deja local. Cerem serverului doar ce lipseste.
  const haveRef = useRef(parseDrawing(lesson.content).strokes.length);
  const syncingRef = useRef(false);

  const liveState = useLessonLive(lesson.id, !isTeacher);
  const presence = usePresence(lesson.id, isTeacher && live);

  /**
   * Aduce doar traseele noi, nu toata lectia.
   *
   * Fara asta, un elev descarca lectia intreaga la fiecare schimbare; masurat,
   * asta inseamna sute de MB pe ora per elev, fiindca lectia creste continuu.
   */
  const syncDelta = useCallback(async (apply: boolean) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const d = await api.get<{ reset: boolean; strokes: Stroke[]; total: number }>(
        `/api/lessons/${lesson.id}/delta?since=${haveRef.current}`
      );
      if (d.strokes.length === 0 && !d.reset) { haveRef.current = d.total; return; }

      setTeacherContent((prev) => {
        const base = d.reset ? { v: 1 as const, width: 1240, height: 1754, strokes: [] } : parseDrawing(prev);
        const merged = appendStrokes(base, d.strokes);
        return drawingFromStrokes(merged.strokes);
      });
      haveRef.current = d.total;
      if (apply) setPendingUpdate(false);
    } catch { /* reincercam la urmatoarea schimbare */ }
    finally { syncingRef.current = false; }
  }, [lesson.id]);

  useEffect(() => {
    if (isTeacher || liveState.changeCount === 0) return;
    // Daca elevul nu urmareste, doar il anuntam; nu-i schimbam pagina sub mana.
    if (!following) { setPendingUpdate(true); return; }
    void syncDelta(true);
  }, [liveState.changeCount, isTeacher, following, syncDelta]);

  const resumeFollowing = useCallback(async () => {
    setFollowing(true);
    setPendingUpdate(false);
    await syncDelta(true);
  }, [syncDelta]);

  // Ciorna locala mai noua (scrisa offline) are prioritate.
  useEffect(() => {
    let cancelled = false;
    loadDraft(draftKey).then((d) => {
      if (!cancelled && d && d.content && d.content !== initial) setContent(d.content);
    });
    return () => { cancelled = true; };
  }, [draftKey, initial]);

  const doSave = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !c.isDirty()) return;
    setSaveState('saving');
    const serialized = c.serialize();
    const url = isTeacher ? `/api/lessons/${lesson.id}/content` : `/api/lessons/${lesson.id}/notes`;
    const state = await saveContent({ url, content: serialized, draftKey });
    setSaveState(state);
    if (state === 'saved' || state === 'queued') { c.markClean(); setDirty(false); }
  }, [lesson.id, draftKey, isTeacher]);

  const autosaveDelay = isTeacher && live ? AUTOSAVE_LIVE_MS : AUTOSAVE_MS;

  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, autosaveDelay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [dirty, doSave, autosaveDelay]);

  useEffect(() => {
    const onHide = () => { if (canvasRef.current?.isDirty()) void doSave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [doSave]);

  async function toggleLive() {
    setBusy(true); setError('');
    try {
      if (canvasRef.current?.isDirty()) await doSave();
      const d = await api.post<{ live: boolean }>(`/api/lessons/${lesson.id}/live`, { live: !live });
      setLive(d.live);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut schimba modul de predare.');
    } finally { setBusy(false); }
  }

  async function togglePublish() {
    setBusy(true); setError('');
    try {
      if (canvasRef.current?.isDirty()) await doSave();
      await api.patch(`/api/lessons/${lesson.id}`, { published: !lesson.published });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut schimba starea.');
    } finally { setBusy(false); }
  }

  const isHomework = lesson.type === 'HOMEWORK';

  return (
    <div className="space-y-4">
      {/* ---- antet ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/capitol/${lesson.topicId}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition hover:text-ink-900">
            <span aria-hidden>←</span> {lesson.topicTitle}
          </Link>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            {lesson.title}
          </h1>
          <p className="text-[13px] text-ink-500">
            {lesson.className}
            {!isTeacher && ' · notițele tale'}
            {lesson.dueAt && ` · termen ${new Date(lesson.dueAt).toLocaleDateString('ro-RO')}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isTeacher && liveState.live && <LiveBadge following={following} />}
          <SaveIndicator state={saveState} dirty={dirty} />

          {isTeacher && (
            <>
              {isHomework && stats.total > 0 && (
                <Link href={`/lectie/${lesson.id}/catalog`} className="btn-secondary btn-sm">
                  Lucrări{stats.submitted > 0 && ` · ${stats.submitted}`}
                </Link>
              )}
              {!isHomework && (
                <button onClick={toggleLive} disabled={busy}
                  className={live ? 'btn-danger btn-sm' : 'btn-dark btn-sm'}>
                  {busy && <Spinner />}
                  {live ? 'Oprește predarea' : 'Predau acum'}
                </button>
              )}
              <button onClick={togglePublish} disabled={busy}
                className={lesson.published ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}>
                {lesson.published ? 'Retrage' : 'Publică'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {/* ---- benzi de context ---- */}
      {isTeacher && live && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <p className="text-sm text-red-900">
              <span className="font-semibold">Predai în direct.</span>{' '}
              Elevii văd ce scrii în una-două secunde. Se oprește singur după o oră.
            </p>
          </div>
          <PresencePanel watching={presence.watching} enrolled={presence.enrolled} />
        </div>
      )}

      {isTeacher && !lesson.published && !live && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Nepublicat.</span>{' '}
          Elevii nu văd încă această {isHomework ? 'temă' : 'lecție'}.
          {isHomework && ' La publicare, fiecare elev înscris primește propria copie.'}
        </div>
      )}

      {!isTeacher && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3">
          <p className="text-sm text-ink-600">
            Scrisul profesorului e dedesubt, gri. Ce scrii tu rămâne al tău —
            profesorul nu îți vede notițele.
            {liveState.live && ' Cât ține ora, profesorul vede că ești conectat.'}
          </p>
          {liveState.live && (
            following ? (
              <button onClick={() => setFollowing(false)} className="btn-secondary btn-sm">
                Oprește urmărirea
              </button>
            ) : (
              <button onClick={resumeFollowing} className="btn-dark btn-sm">
                {pendingUpdate ? 'Actualizări noi · Urmărește' : 'Urmărește tabla'}
              </button>
            )
          )}
        </div>
      )}

      {/* ---- tabla ---- */}
      <ZestCanvas
        ref={canvasRef}
        value={content}
        // Elevul scrie peste lectia profesorului, afisata estompat.
        underlay={isTeacher ? null : teacherContent}
        underlayColor={isTeacher ? undefined : '#8a8580'}
        background={lesson.background}
        readOnly={false}
        onDirtyChange={setDirty}
        toolbarExtra={
          <button onClick={doSave} disabled={!dirty}
            className="flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-100 active:scale-95 disabled:opacity-30">
            Salvează
          </button>
        }
      />
    </div>
  );
}
