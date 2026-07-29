'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip, DueChip, Progress } from './ui';
import { useAutoRefresh } from '@/lib/live';

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
  useAutoRefresh(30000);

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
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Copiii tăi</h1>
          <p className="mt-1 text-[15px] text-ink-500">Teme, termene și note, la zi.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-secondary">Adaugă copil</button>
      </div>

      {children.length === 0 ? (
        <EmptyState
          title="Niciun copil asociat"
          hint="Copilul are în aplicația lui un cod de 8 caractere, la „Codul pentru părinte”. Cere-i-l și introdu-l aici."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Introdu codul</button>}
        />
      ) : (
        <div className="space-y-6">
          {children.map((c) => {
            const total = c.stats.pending + c.stats.submitted + c.stats.graded;
            const done = c.stats.submitted + c.stats.graded;
            return (
              <section key={c.id} className="card overflow-hidden">
                <div className="border-b border-ink-100 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zest-100 text-[13px] font-bold text-zest-800">
                        {c.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </span>
                      <div>
                        <h2 className="font-bold text-ink-900">{c.name}</h2>
                        <p className="text-[13px] text-ink-500">
                          {done} din {total} {total === 1 ? 'temă rezolvată' : 'teme rezolvate'}
                        </p>
                      </div>
                    </div>
                    {c.stats.overdue > 0 && (
                      <span className="chip bg-red-100 text-red-700">
                        {c.stats.overdue} cu termen depășit
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <Progress value={done} total={total} tone={c.stats.overdue > 0 ? 'zest' : 'emerald'} />
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
                      <span><b className="text-ink-800">{c.stats.pending}</b> de făcut</span>
                      <span><b className="text-ink-800">{c.stats.submitted}</b> predate</span>
                      <span><b className="text-ink-800">{c.stats.graded}</b> notate</span>
                    </div>
                  </div>
                </div>

                {c.recent.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-ink-500">Nicio temă încă.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {c.recent.map((r) => (
                      <li key={r.submissionId}>
                        <Link href={`/tema/${r.submissionId}`}
                          className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink-900">{r.lessonTitle}</p>
                            <p className="truncate text-[12px] text-ink-500">{r.className} · {r.topicTitle}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <DueChip dueAt={r.dueAt} done={r.status === 'SUBMITTED' || r.status === 'GRADED'} />
                            <StatusChip status={r.status} grade={r.grade} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-center text-[12px] leading-relaxed text-ink-400">
        Vezi temele și notele copilului. Notițele lui personale rămân private.<br />
        Nu analizăm scrisul și nu construim profiluri.
      </p>

      <Modal open={open} title="Adaugă un copil"
        description="Codul are 8 caractere și se află în aplicația copilului."
        onClose={() => setOpen(false)}>
        <form onSubmit={link} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <input
            className="input text-center font-mono text-2xl font-bold tracking-[0.3em]"
            autoFocus required maxLength={8} value={code}
            autoCapitalize="characters" autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345"
          />
          <div className="flex justify-end gap-2 pt-1">
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
