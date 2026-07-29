'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner } from './ui';
import { BACKGROUND_LABELS, type BackgroundKind } from './PaperBackground';
import { useAutoRefresh } from '@/lib/live';

interface Topic { id: string; title: string; background: BackgroundKind; lessonCount: number }
interface Props {
  cls: {
    id: string; name: string; code: string | null; teacherName: string;
    topics: Topic[]; students: { id: string; name: string }[]; isTeacher: boolean;
  };
}

/** Miniatura liniaturii, ca sa se vada dintr-o privire ce fel de foaie e. */
const BG_PREVIEW: Record<BackgroundKind, string> = {
  WHITE: 'bg-white',
  MATH: 'bg-white bg-[linear-gradient(#c7d7ea_1px,transparent_1px),linear-gradient(90deg,#c7d7ea_1px,transparent_1px)] bg-[length:7px_7px]',
  DICTANDO: 'bg-white bg-[linear-gradient(#bcd0e8_1px,transparent_1px)] bg-[length:100%_7px]',
  MUSIC: 'bg-white bg-[linear-gradient(#9fb4cc_1px,transparent_1px)] bg-[length:100%_4px]',
};

export function ClassView({ cls }: Props) {
  const router = useRouter();
  useAutoRefresh(12000);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState<BackgroundKind>('WHITE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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
    <div className="space-y-7">
      <div>
        <Link href="/panou"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition hover:text-ink-900">
          <span aria-hidden>←</span> Panou
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{cls.name}</h1>
            <p className="mt-1 text-[15px] text-ink-500">
              {cls.isTeacher
                ? `${cls.students.length} ${cls.students.length === 1 ? 'elev înscris' : 'elevi înscriși'}`
                : cls.teacherName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cls.code && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(cls.code!).then(() => {
                    setCopied(true); setTimeout(() => setCopied(false), 1800);
                  }).catch(() => {});
                }}
                className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold tracking-wider text-ink-800 shadow-sm transition hover:bg-ink-50"
                title="Copiază codul de înscriere"
              >
                {copied ? 'Copiat' : cls.code}
              </button>
            )}
            {cls.isTeacher && <button onClick={() => setOpen(true)} className="btn-primary">Capitol nou</button>}
          </div>
        </div>
      </div>

      {cls.topics.length === 0 ? (
        <EmptyState
          title="Niciun capitol încă"
          hint={cls.isTeacher
            ? 'Capitolul e dosarul materiei. Alegi liniatura o dată, iar toate lecțiile din el o moștenesc.'
            : 'Profesorul nu a adăugat încă nimic aici.'}
          action={cls.isTeacher
            ? <button onClick={() => setOpen(true)} className="btn-primary">Creează primul capitol</button>
            : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cls.topics.map((t) => (
            <Link key={t.id} href={`/capitol/${t.id}`} className="card-hover group flex items-start gap-4 p-5">
              <span className={`h-14 w-11 shrink-0 rounded-lg border border-ink-200 shadow-sm ${BG_PREVIEW[t.background]}`} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-bold leading-snug text-ink-900 transition group-hover:text-zest-700">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-[13px] text-ink-500">
                  {t.lessonCount} {t.lessonCount === 1 ? 'lecție' : 'lecții'}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-400">{BACKGROUND_LABELS[t.background]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {cls.isTeacher && cls.students.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Elevi</h2>
          <div className="flex flex-wrap gap-2">
            {cls.students.map((s) => (
              <span key={s.id} className="chip bg-white text-ink-700 ring-1 ring-ink-200">{s.name}</span>
            ))}
          </div>
        </section>
      )}

      <Modal open={open} title="Capitol nou"
        description="Liniatura se aplică tuturor lecțiilor din capitol."
        onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-5">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="ttitle">Titlu</label>
            <input id="ttitle" className="input" autoFocus required value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="Capitolul 1 — Ecuații" />
          </div>
          <div>
            <span className="label">Tipul de foaie</span>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(BACKGROUND_LABELS) as BackgroundKind[]).map((bg) => (
                <button key={bg} type="button" onClick={() => setBackground(bg)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left text-sm transition ${
                    background === bg
                      ? 'border-zest-500 bg-zest-50 font-semibold text-zest-900'
                      : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                  }`}>
                  <span className={`h-10 w-8 shrink-0 rounded border border-ink-300 ${BG_PREVIEW[bg]}`} />
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
