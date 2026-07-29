'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner } from './ui';
import { BACKGROUND_LABELS, type BackgroundKind } from './PaperBackground';

interface Topic { id: string; title: string; background: BackgroundKind; lessonCount: number }
interface Props {
  cls: {
    id: string; name: string; code: string | null; teacherName: string;
    topics: Topic[]; students: { id: string; name: string }[]; isTeacher: boolean;
  };
}

const BG_PREVIEW: Record<BackgroundKind, string> = {
  WHITE: 'bg-white',
  MATH: 'bg-[linear-gradient(#c7d7ea_1px,transparent_1px),linear-gradient(90deg,#c7d7ea_1px,transparent_1px)] bg-[length:8px_8px]',
  DICTANDO: 'bg-[linear-gradient(#bcd0e8_1px,transparent_1px)] bg-[length:100%_8px]',
  MUSIC: 'bg-[linear-gradient(#9fb4cc_1px,transparent_1px)] bg-[length:100%_4px]',
};

export function ClassView({ cls }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState<BackgroundKind>('WHITE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/topics', { classId: cls.id, title, background });
      setOpen(false); setTitle(''); setBackground('WHITE');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut crea capitolul.');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panou" className="text-sm text-ink-500 hover:text-ink-800">← Panou</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{cls.name}</h1>
            <p className="text-sm text-ink-500">
              {cls.isTeacher
                ? `${cls.students.length} ${cls.students.length === 1 ? 'elev înscris' : 'elevi înscriși'}`
                : cls.teacherName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cls.code && (
              <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-mono text-sm font-bold tracking-wider text-amber-800">
                {cls.code}
              </span>
            )}
            {cls.isTeacher && (
              <button onClick={() => setOpen(true)} className="btn-primary">+ Capitol</button>
            )}
          </div>
        </div>
      </div>

      {cls.topics.length === 0 ? (
        <EmptyState
          title="Niciun capitol încă"
          hint={cls.isTeacher
            ? 'Capitolele sunt dosarele materiei. Alegi tipul de liniatură o singură dată, iar toate lecțiile din capitol îl moștenesc.'
            : 'Profesorul nu a adăugat încă niciun capitol.'}
          action={cls.isTeacher
            ? <button onClick={() => setOpen(true)} className="btn-primary">Creează primul capitol</button>
            : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cls.topics.map((t) => (
            <Link key={t.id} href={`/capitol/${t.id}`} className="card group overflow-hidden p-5 transition hover:shadow-md">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-bold text-ink-900 group-hover:text-zest-700">{t.title}</h3>
                <span
                  className={`h-9 w-7 shrink-0 rounded border border-ink-200 ${BG_PREVIEW[t.background]}`}
                  title={BACKGROUND_LABELS[t.background]}
                />
              </div>
              <p className="text-xs text-ink-500">
                {t.lessonCount} {t.lessonCount === 1 ? 'lecție' : 'lecții'} · {BACKGROUND_LABELS[t.background]}
              </p>
            </Link>
          ))}
        </div>
      )}

      {cls.isTeacher && cls.students.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Elevi</h2>
          <div className="flex flex-wrap gap-2">
            {cls.students.map((s) => (
              <span key={s.id} className="chip bg-ink-100 text-ink-700">{s.name}</span>
            ))}
          </div>
        </section>
      )}

      <Modal open={open} title="Capitol nou" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="ttitle">Titlu</label>
            <input
              id="ttitle" className="input" autoFocus required value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="ex: Capitolul 1 — Ecuații"
            />
          </div>
          <div>
            <span className="label">Tipul de foaie</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BACKGROUND_LABELS) as BackgroundKind[]).map((bg) => (
                <button
                  key={bg} type="button" onClick={() => setBackground(bg)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition ${
                    background === bg ? 'border-zest-500 bg-zest-50 font-semibold' : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  <span className={`h-6 w-5 rounded border border-ink-300 ${BG_PREVIEW[bg]}`} />
                  {BACKGROUND_LABELS[bg]}
                </button>
              ))}
            </div>
          </div>
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
