'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ZestCanvas, type ZestCanvasHandle } from './ZestCanvas';
import { SaveIndicator, ErrorBanner, Spinner } from './ui';
import { api, ApiError, saveContent, type SaveState } from '@/lib/api';
import { loadDraft } from '@/lib/offline';
import type { BackgroundKind } from './PaperBackground';

interface Props {
  lesson: {
    id: string; title: string; type: string; content: string; published: boolean;
    dueAt: string | null; topicId: string; topicTitle: string;
    background: BackgroundKind; className: string; isTeacher: boolean;
  };
  stats: { submitted: number; graded: number; total: number };
}

const AUTOSAVE_MS = 2500;

export function LessonView({ lesson, stats }: Props) {
  const router = useRouter();
  const canvasRef = useRef<ZestCanvasHandle>(null);
  const [content, setContent] = useState<string>(lesson.content);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftKey = `lesson:${lesson.id}`;

  // Daca exista o ciorna locala mai noua (scrisa offline), o preferam.
  useEffect(() => {
    let cancelled = false;
    loadDraft(draftKey).then((d) => {
      if (!cancelled && d && d.content && d.content !== lesson.content) {
        setContent(d.content);
      }
    });
    return () => { cancelled = true; };
  }, [draftKey, lesson.content]);

  const doSave = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !c.isDirty()) return;
    setSaveState('saving');
    const serialized = c.serialize();
    const state = await saveContent({
      url: `/api/lessons/${lesson.id}/content`, content: serialized, draftKey,
    });
    setSaveState(state);
    if (state === 'saved' || state === 'queued') { c.markClean(); setDirty(false); }
  }, [lesson.id, draftKey]);

  // Autosave: important pe tableta, unde nimeni nu apasa "salvează".
  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, AUTOSAVE_MS);
  }, [doSave]);

  useEffect(() => {
    if (dirty) scheduleSave();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [dirty, scheduleSave]);

  // Salvam si la iesirea din pagina.
  useEffect(() => {
    const onHide = () => { if (canvasRef.current?.isDirty()) void doSave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [doSave]);

  async function togglePublish() {
    setPublishing(true); setError('');
    try {
      if (canvasRef.current?.isDirty()) await doSave();
      await api.patch(`/api/lessons/${lesson.id}`, { published: !lesson.published });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut schimba starea.');
    } finally { setPublishing(false); }
  }

  const isHomework = lesson.type === 'HOMEWORK';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/capitol/${lesson.topicId}`} className="text-sm text-ink-500 hover:text-ink-800">
            ← {lesson.topicTitle}
          </Link>
          <h1 className="mt-1 truncate text-xl font-bold text-ink-900">{lesson.title}</h1>
          <p className="text-xs text-ink-500">
            {lesson.className} · {isHomework ? 'Temă' : 'Lecție'}
            {lesson.dueAt && ` · termen ${new Date(lesson.dueAt).toLocaleDateString('ro-RO')}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} dirty={dirty} />
          {lesson.isTeacher && (
            <>
              {isHomework && stats.total > 0 && (
                <Link href={`/lectie/${lesson.id}/catalog`} className="btn-secondary text-sm">
                  Lucrări ({stats.submitted} de corectat)
                </Link>
              )}
              <button onClick={togglePublish} className={lesson.published ? 'btn-secondary' : 'btn-primary'} disabled={publishing}>
                {publishing && <Spinner />}
                {lesson.published ? 'Retrage' : 'Publică'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {lesson.isTeacher && !lesson.published && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Nepublicat — elevii nu văd încă această {isHomework ? 'temă' : 'lecție'}.
          {isHomework && ' La publicare, fiecare elev înscris primește automat propria copie.'}
        </div>
      )}

      <ZestCanvas
        ref={canvasRef}
        value={content}
        background={lesson.background}
        readOnly={!lesson.isTeacher}
        onDirtyChange={setDirty}
      />

      {lesson.isTeacher && (
        <div className="flex justify-center">
          <button onClick={doSave} className="btn-secondary" disabled={!dirty}>
            Salvează acum
          </button>
        </div>
      )}
    </div>
  );
}
