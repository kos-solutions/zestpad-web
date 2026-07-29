'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip, DueChip, LiveBadge } from './ui';
import { BACKGROUND_LABELS, type BackgroundKind } from './PaperBackground';
import { useAutoRefresh } from '@/lib/live';

interface Lesson {
  id: string; title: string; type: string; published: boolean; dueAt: string | null;
  live: boolean; pendingReview: number; totalSubmissions: number;
  mySubmission: { id: string; status: string; grade: string | null } | null;
}
interface Props {
  topic: { id: string; title: string; background: BackgroundKind; className: string; classId: string; isTeacher: boolean };
  lessons: Lesson[];
}

export function TopicView({ topic, lessons }: Props) {
  const router = useRouter();
  // Cat timp se preda, elevii trebuie sa vada imediat lectiile noi.
  useAutoRefresh(lessons.some((l) => l.live) ? 6000 : 12000);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'THEORY' | 'HOMEWORK'>('THEORY');
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/lessons', {
        topicId: topic.id, title, type,
        dueAt: type === 'HOMEWORK' && dueAt ? new Date(dueAt).toISOString() : null,
      });
      setOpen(false); setTitle(''); setDueAt(''); setType('THEORY');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut crea lecția.');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-7">
      <div>
        <Link href={`/clasa/${topic.classId}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition hover:text-ink-900">
          <span aria-hidden>←</span> {topic.className}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{topic.title}</h1>
            <p className="mt-1 text-[15px] text-ink-500">{BACKGROUND_LABELS[topic.background]}</p>
          </div>
          {topic.isTeacher && <button onClick={() => setOpen(true)} className="btn-primary">Lecție nouă</button>}
        </div>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          title="Capitol gol"
          hint={topic.isTeacher
            ? 'O lecție e ceea ce scrii tu la tablă. O temă primește o copie separată pentru fiecare elev.'
            : 'Profesorul nu a publicat încă nimic aici.'}
          action={topic.isTeacher ? <button onClick={() => setOpen(true)} className="btn-primary">Adaugă lecție</button> : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {lessons.map((l) => {
            const isHomework = l.type === 'HOMEWORK';
            const href = !topic.isTeacher && isHomework && l.mySubmission
              ? `/tema/${l.mySubmission.id}` : `/lectie/${l.id}`;
            const done = l.mySubmission?.status === 'SUBMITTED' || l.mySubmission?.status === 'GRADED';

            return (
              <Link key={l.id} href={href}
                className={`card-hover flex items-center gap-4 px-5 py-4 ${l.live ? 'ring-2 ring-red-200' : ''}`}>
                <span className={`h-10 w-1 shrink-0 rounded-full ${isHomework ? 'bg-emerald-400' : 'bg-zest-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-ink-900">{l.title}</p>
                    {l.live && <LiveBadge />}
                  </div>
                  <p className="text-[13px] text-ink-500">
                    {isHomework ? 'Temă' : 'Lecție'}
                    {topic.isTeacher && isHomework && l.totalSubmissions > 0 &&
                      ` · ${l.totalSubmissions} ${l.totalSubmissions === 1 ? 'elev' : 'elevi'}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {topic.isTeacher ? (
                    <>
                      {!l.published && <span className="chip bg-ink-100 text-ink-500">Nepublicat</span>}
                      {isHomework && l.pendingReview > 0 && (
                        <span className="chip bg-zest-100 text-zest-800">{l.pendingReview} de corectat</span>
                      )}
                    </>
                  ) : (
                    <>
                      <DueChip dueAt={l.dueAt} done={done} />
                      {l.mySubmission && <StatusChip status={l.mySubmission.status} grade={l.mySubmission.grade} />}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={open} title="Lecție nouă" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-5">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="ltitle">Titlu</label>
            <input id="ltitle" className="input" autoFocus required value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="Ecuații de gradul I" />
          </div>
          <div>
            <span className="label">Tip</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setType('THEORY')}
                className={`rounded-xl border-2 p-3.5 text-left transition ${
                  type === 'THEORY' ? 'border-zest-500 bg-zest-50' : 'border-ink-200 hover:bg-ink-50'
                }`}>
                <span className="block text-sm font-bold text-ink-900">Lecție</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">
                  Scrii tu; elevii își pot lua notițe peste
                </span>
              </button>
              <button type="button" onClick={() => setType('HOMEWORK')}
                className={`rounded-xl border-2 p-3.5 text-left transition ${
                  type === 'HOMEWORK' ? 'border-emerald-500 bg-emerald-50' : 'border-ink-200 hover:bg-ink-50'
                }`}>
                <span className="block text-sm font-bold text-ink-900">Temă</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">
                  Fiecare elev primește copia lui
                </span>
              </button>
            </div>
          </div>
          {type === 'HOMEWORK' && (
            <div>
              <label className="label" htmlFor="due">Termen limită</label>
              <input id="due" type="date" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Anulează</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading && <Spinner />} Creează
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
