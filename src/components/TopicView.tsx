'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip } from './ui';
import { BACKGROUND_LABELS, type BackgroundKind } from './PaperBackground';

interface Lesson {
  id: string; title: string; type: string; published: boolean; dueAt: string | null;
  pendingReview: number; totalSubmissions: number;
  mySubmission: { id: string; status: string; grade: string | null } | null;
}
interface Props {
  topic: { id: string; title: string; background: BackgroundKind; className: string; classId: string; isTeacher: boolean };
  lessons: Lesson[];
}

export function TopicView({ topic, lessons }: Props) {
  const router = useRouter();
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
    <div className="space-y-6">
      <div>
        <Link href={`/clasa/${topic.classId}`} className="text-sm text-ink-500 hover:text-ink-800">
          ← {topic.className}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{topic.title}</h1>
            <p className="text-sm text-ink-500">Foaie: {BACKGROUND_LABELS[topic.background]}</p>
          </div>
          {topic.isTeacher && <button onClick={() => setOpen(true)} className="btn-primary">+ Lecție</button>}
        </div>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          title="Capitol gol"
          hint={topic.isTeacher
            ? 'Adaugă o lecție de predat sau o temă. Temele primesc automat câte o copie pentru fiecare elev.'
            : 'Profesorul nu a publicat încă nimic aici.'}
          action={topic.isTeacher ? <button onClick={() => setOpen(true)} className="btn-primary">Adaugă lecție</button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => {
            const isHomework = l.type === 'HOMEWORK';
            // Elevul merge direct la lucrarea lui; profesorul la lectie/catalog.
            const href = !topic.isTeacher && isHomework && l.mySubmission
              ? `/tema/${l.mySubmission.id}`
              : `/lectie/${l.id}`;

            return (
              <Link
                key={l.id} href={href}
                className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
                style={{ borderLeftWidth: 4, borderLeftColor: isHomework ? '#16a34a' : '#1b70f0' }}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{l.title}</p>
                  <p className="text-xs text-ink-500">
                    {isHomework ? 'Temă' : 'Lecție'}
                    {l.dueAt && ` · termen ${new Date(l.dueAt).toLocaleDateString('ro-RO')}`}
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
                    l.mySubmission && <StatusChip status={l.mySubmission.status} grade={l.mySubmission.grade} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={open} title="Lecție nouă" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="ltitle">Titlu</label>
            <input
              id="ltitle" className="input" autoFocus required value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="ex: Ecuații de gradul I"
            />
          </div>
          <div>
            <span className="label">Tip</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button" onClick={() => setType('THEORY')}
                className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm transition ${
                  type === 'THEORY' ? 'border-zest-500 bg-zest-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <span className="block font-semibold text-ink-800">Lecție</span>
                <span className="block text-xs text-ink-500">Scrii tu, elevii citesc</span>
              </button>
              <button
                type="button" onClick={() => setType('HOMEWORK')}
                className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm transition ${
                  type === 'HOMEWORK' ? 'border-green-500 bg-green-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <span className="block font-semibold text-ink-800">Temă</span>
                <span className="block text-xs text-ink-500">Fiecare elev scrie separat</span>
              </button>
            </div>
          </div>
          {type === 'HOMEWORK' && (
            <div>
              <label className="label" htmlFor="due">Termen limită (opțional)</label>
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
