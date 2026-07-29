'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ZestCanvas, type ZestCanvasHandle } from './ZestCanvas';
import { SaveIndicator, ErrorBanner, Modal, Spinner, StatusChip, DueChip } from './ui';
import { api, ApiError, saveContent, type SaveState } from '@/lib/api';
import { clearDraft, loadDraft } from '@/lib/offline';
import type { BackgroundKind } from './PaperBackground';

interface Props {
  submission: {
    id: string; status: string; content: string; feedback: string;
    grade: string | null; comment: string | null;
    submittedAt: string | null; gradedAt: string | null; studentName: string;
  };
  lesson: {
    id: string; title: string; prompt: string; dueAt: string | null;
    topicId: string; topicTitle: string; background: BackgroundKind; className: string;
  };
  role: { isOwner: boolean; isTeacher: boolean; isParent: boolean };
}

const AUTOSAVE_MS = 2500;

export function SubmissionView({ submission, lesson, role }: Props) {
  const router = useRouter();
  const canvasRef = useRef<ZestCanvasHandle>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [grade, setGrade] = useState(submission.grade ?? '');
  const [comment, setComment] = useState(submission.comment ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = submission.status === 'SUBMITTED' || submission.status === 'GRADED';
  /** Elevul scrie pana preda. Profesorul corecteaza dupa predare. */
  const canEdit = role.isOwner ? !locked : role.isTeacher && submission.status !== 'NOT_STARTED';

  const draftKey = role.isTeacher ? `feedback:${submission.id}` : `submission:${submission.id}`;
  const initial = role.isTeacher ? submission.feedback : submission.content;
  const [content, setContent] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    loadDraft(draftKey).then((d) => {
      if (!cancelled && d && d.content && d.content !== initial) setContent(d.content);
    });
    return () => { cancelled = true; };
  }, [draftKey, initial]);

  const doSave = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !c.isDirty() || !canEdit) return;
    setSaveState('saving');
    const serialized = c.serialize();

    const state = role.isTeacher
      ? await saveContent({
          url: `/api/submissions/${submission.id}/grade`,
          content: serialized, draftKey,
        })
      : await saveContent({
          url: `/api/submissions/${submission.id}`,
          content: serialized, draftKey,
        });

    setSaveState(state);
    if (state === 'saved' || state === 'queued') { c.markClean(); setDirty(false); }
  }, [submission.id, draftKey, role.isTeacher, canEdit]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, AUTOSAVE_MS);
  }, [doSave]);

  useEffect(() => {
    if (dirty) scheduleSave();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [dirty, scheduleSave]);

  useEffect(() => {
    const onHide = () => { if (canvasRef.current?.isDirty()) void doSave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [doSave]);

  async function submitHomework() {
    if (!confirm('Predai tema? După predare nu mai poți modifica.')) return;
    setBusy(true); setError('');
    try {
      const serialized = canvasRef.current?.serialize() ?? submission.content;
      await api.post(`/api/submissions/${submission.id}/submit`, { content: serialized });
      await clearDraft(draftKey);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut preda tema.');
    } finally { setBusy(false); }
  }

  async function saveGrade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const serialized = canvasRef.current?.serialize() ?? submission.feedback;
      await api.post(`/api/submissions/${submission.id}/grade`, {
        grade: grade || null, comment: comment || null, feedback: serialized,
      });
      await clearDraft(draftKey);
      setGradeOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut salva nota.');
    } finally { setBusy(false); }
  }

  const backHref = role.isTeacher ? `/lectie/${lesson.id}/catalog` : `/capitol/${lesson.topicId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={backHref}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition hover:text-ink-900">
            <span aria-hidden>←</span> {role.isTeacher ? 'Lucrări' : lesson.topicTitle}
          </Link>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            {lesson.title}
          </h1>
          <p className="text-[13px] text-ink-500">
            {lesson.className}
            {(role.isTeacher || role.isParent) && ` · ${submission.studentName}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DueChip dueAt={lesson.dueAt} done={locked} />
          <StatusChip status={submission.status} grade={submission.grade} />
          {canEdit && <SaveIndicator state={saveState} dirty={dirty} />}

          {role.isOwner && !locked && (
            <button onClick={submitHomework} className="btn-primary btn-sm" disabled={busy}>
              {busy && <Spinner />} Predă tema
            </button>
          )}
          {role.isTeacher && submission.status !== 'NOT_STARTED' && (
            <button onClick={() => setGradeOpen(true)} className="btn-primary btn-sm" disabled={busy}>
              {submission.status === 'GRADED' ? 'Modifică nota' : 'Notează'}
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {role.isOwner && locked && (
        <div className="rounded-xl border border-zest-200 bg-zest-50 px-4 py-3 text-sm text-zest-900">
          <span className="font-semibold">Ai predat tema</span>
          {submission.submittedAt && ` pe ${new Date(submission.submittedAt).toLocaleDateString('ro-RO')}`}.
          {submission.status === 'GRADED'
            ? ' Corectura profesorului apare cu roșu peste scrisul tău.'
            : ' Aștepți corectura profesorului.'}
        </div>
      )}

      {role.isTeacher && (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          Scrisul elevului e dedesubt. Ce scrii tu apare cu roșu, pe un strat separat —
          nu îi modifici lucrarea.
        </div>
      )}

      {role.isParent && (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          Vezi lucrarea copilului tău, doar pentru citire.
        </div>
      )}

      {submission.comment && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            Observația profesorului
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-emerald-900">{submission.comment}</p>
        </div>
      )}

      <ZestCanvas
        ref={canvasRef}
        value={content}
        underlay={role.isTeacher ? submission.content : lesson.prompt}
        underlayColor={role.isTeacher ? undefined : '#8a8580'}
        overlay={!role.isTeacher && submission.status === 'GRADED' ? submission.feedback : null}
        overlayColor="#dc2626"
        background={lesson.background}
        readOnly={!canEdit}
        defaultColor={role.isTeacher ? '#dc2626' : '#1c1917'}
        onDirtyChange={setDirty}
        toolbarExtra={
          <button onClick={doSave} disabled={!dirty}
            className="flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-100 active:scale-95 disabled:opacity-30">
            Salvează
          </button>
        }
      />

      <Modal open={gradeOpen} title="Notează lucrarea" onClose={() => setGradeOpen(false)}>
        <form onSubmit={saveGrade} className="space-y-4">
          <div>
            <label className="label" htmlFor="grade">Notă sau calificativ</label>
            <input id="grade" className="input" autoFocus value={grade}
              onChange={(e) => setGrade(e.target.value)} placeholder="9 sau FB" />
          </div>
          <div>
            <label className="label" htmlFor="comment">Observație</label>
            <textarea id="comment" className="input min-h-[100px] resize-y" value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ce a ieșit bine, ce trebuie reluat…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setGradeOpen(false)} className="btn-ghost">Anulează</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Spinner />} Salvează
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
