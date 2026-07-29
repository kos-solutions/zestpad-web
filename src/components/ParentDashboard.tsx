'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip } from './ui';

interface Child {
  id: string; name: string;
  stats: { pending: number; submitted: number; graded: number; overdue: number };
  recent: {
    submissionId: string; lessonTitle: string; className: string; topicTitle: string;
    status: string; grade: string | null; dueAt: string | null;
  }[];
}

export function ParentDashboard({ children }: { children: Child[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/parent/link', { code });
      setOpen(false); setCode('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut face legătura.');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Copiii tăi</h1>
          <p className="text-sm text-ink-500">Vezi temele, termenele și notele.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">+ Adaugă copil</button>
      </div>

      {children.length === 0 ? (
        <EmptyState
          title="Niciun copil asociat"
          hint="Cere copilului codul de 8 caractere afișat în aplicația lui, la secțiunea „Codul pentru părinte”."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Introdu codul</button>}
        />
      ) : (
        <div className="space-y-6">
          {children.map((c) => (
            <section key={c.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-4">
                <h2 className="font-bold text-ink-900">{c.name}</h2>
                <div className="flex flex-wrap gap-2">
                  {c.stats.overdue > 0 && (
                    <span className="chip bg-red-100 text-red-700">{c.stats.overdue} cu termen depășit</span>
                  )}
                  <span className="chip bg-amber-100 text-amber-800">{c.stats.pending} de făcut</span>
                  <span className="chip bg-zest-100 text-zest-800">{c.stats.submitted} predate</span>
                  <span className="chip bg-green-100 text-green-800">{c.stats.graded} notate</span>
                </div>
              </div>

              {c.recent.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-500">Nicio temă încă.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {c.recent.map((r) => {
                    const overdue = r.dueAt && new Date(r.dueAt).getTime() < Date.now() &&
                      (r.status === 'NOT_STARTED' || r.status === 'DRAFT');
                    return (
                      <li key={r.submissionId}>
                        <Link
                          href={`/tema/${r.submissionId}`}
                          className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-ink-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-900">{r.lessonTitle}</p>
                            <p className="truncate text-xs text-ink-500">{r.className} · {r.topicTitle}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {overdue && <span className="chip bg-red-100 text-red-700">Întârziat</span>}
                            <StatusChip status={r.status} grade={r.grade} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-ink-400">
        Vezi temele și notele copilului. Caietele lui personale rămân private.
      </p>

      <Modal open={open} title="Adaugă un copil" onClose={() => setOpen(false)}>
        <form onSubmit={link} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="lcode">Codul copilului</label>
            <input
              id="lcode" className="input text-center font-mono text-xl tracking-[0.25em]"
              autoFocus required maxLength={8} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345"
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Îl găsește în aplicația lui, pe pagina principală.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Anulează</button>
            <button type="submit" className="btn-primary" disabled={loading || code.length !== 8}>
              {loading && <Spinner />} Adaugă
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
