'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner } from './ui';
import { useAutoRefresh } from '@/lib/live';

interface ClassRow {
  id: string; name: string; code: string;
  _count: { enrollments: number; topics: number };
}

export function TeacherDashboard({
  initialClasses, toReview,
}: { initialClasses: ClassRow[]; toReview: number }) {
  const router = useRouter();
  useAutoRefresh(20000);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/classes', { name });
      setOpen(false); setName('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut crea clasa.');
    } finally { setLoading(false); }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code)
      .then(() => { setCopied(code); setTimeout(() => setCopied(null), 1800); })
      .catch(() => {});
  }

  const totalStudents = initialClasses.reduce((a, c) => a + c._count.enrollments, 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Clasele tale</h1>
          <p className="mt-1 text-[15px] text-ink-500">
            {initialClasses.length === 0
              ? 'Creează prima clasă ca să începi.'
              : `${initialClasses.length} ${initialClasses.length === 1 ? 'clasă' : 'clase'} · ${totalStudents} ${totalStudents === 1 ? 'elev' : 'elevi'}`}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">Clasă nouă</button>
      </div>

      {toReview > 0 && (
        <Link href="#" onClick={(e) => e.preventDefault()}
          className="flex items-center gap-4 rounded-2xl border border-zest-200 bg-zest-50 px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zest-600 text-base font-bold text-white">
            {toReview}
          </span>
          <div>
            <p className="font-semibold text-zest-900">
              {toReview === 1 ? 'O temă așteaptă corectare' : `${toReview} teme așteaptă corectare`}
            </p>
            <p className="text-[13px] text-zest-800/80">Le găsești în capitolul fiecărei clase.</p>
          </div>
        </Link>
      )}

      {initialClasses.length === 0 ? (
        <EmptyState
          title="Nicio clasă încă"
          hint="Creezi o clasă, primești un cod de 6 caractere, îl dictezi elevilor. Atât."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Creează prima clasă</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialClasses.map((c) => (
            <div key={c.id} className="card-hover group flex flex-col overflow-hidden">
              <Link href={`/clasa/${c.id}`} className="flex-1 p-5">
                <h3 className="text-[17px] font-bold leading-snug text-ink-900 transition group-hover:text-zest-700">
                  {c.name}
                </h3>
                <p className="mt-2 text-[13px] text-ink-500">
                  {c._count.enrollments} {c._count.enrollments === 1 ? 'elev' : 'elevi'} ·{' '}
                  {c._count.topics} {c._count.topics === 1 ? 'capitol' : 'capitole'}
                </p>
              </Link>
              <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Cod înscriere
                </span>
                <button
                  onClick={() => copyCode(c.code)}
                  title="Copiază codul"
                  className="rounded-lg bg-ink-100 px-2.5 py-1 font-mono text-[13px] font-bold tracking-wider text-ink-800 transition hover:bg-ink-200"
                >
                  {copied === c.code ? 'Copiat' : c.code}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="Clasă nouă"
        description="Se generează automat un cod unic pe care îl dai elevilor."
        onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="cname">Numele clasei</label>
            <input id="cname" className="input" autoFocus required value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Matematică — a 5-a B" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
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
