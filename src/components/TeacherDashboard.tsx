'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner } from './ui';

interface ClassRow {
  id: string; name: string; code: string;
  _count: { enrollments: number; topics: number };
}

export function TeacherDashboard({
  initialClasses, toReview,
}: { initialClasses: ClassRow[]; toReview: number }) {
  const router = useRouter();
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
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Clasele tale</h1>
          <p className="text-sm text-ink-500">Creează clase, adaugă capitole și dă teme.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">+ Clasă nouă</button>
      </div>

      {toReview > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-zest-200 bg-zest-50 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zest-600 text-sm font-bold text-white">
            {toReview}
          </span>
          <p className="text-sm text-zest-900">
            {toReview === 1 ? 'O temă predată așteaptă corectare.' : `${toReview} teme predate așteaptă corectare.`}
          </p>
        </div>
      )}

      {initialClasses.length === 0 ? (
        <EmptyState
          title="Nu ai nicio clasă încă"
          hint="Creează prima clasă. Primești un cod de 6 caractere pe care îl dai elevilor ca să se înscrie."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Creează prima clasă</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialClasses.map((c) => (
            <div key={c.id} className="card overflow-hidden transition hover:shadow-md">
              <div className="h-1.5 bg-zest-500" />
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-bold text-ink-900">{c.name}</h3>
                  <button
                    onClick={() => copyCode(c.code)}
                    title="Copiază codul de înscriere"
                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-xs font-bold tracking-wider text-amber-800 transition hover:bg-amber-100"
                  >
                    {copied === c.code ? 'Copiat!' : c.code}
                  </button>
                </div>
                <p className="text-sm text-ink-500">
                  {c._count.enrollments} {c._count.enrollments === 1 ? 'elev' : 'elevi'} ·{' '}
                  {c._count.topics} {c._count.topics === 1 ? 'capitol' : 'capitole'}
                </p>
                <Link href={`/clasa/${c.id}`} className="btn-secondary mt-4 w-full">Deschide</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="Creează o clasă nouă" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="cname">Numele clasei</label>
            <input
              id="cname" className="input" autoFocus required value={name}
              onChange={(e) => setName(e.target.value)} placeholder="ex: Matematică — a 5-a B"
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Se generează automat un cod unic pe care îl dai elevilor.
            </p>
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
