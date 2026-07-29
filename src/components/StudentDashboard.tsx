'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip } from './ui';

interface ClassRow { id: string; name: string; teacherName: string; topicCount: number }
interface HomeworkRow {
  submissionId: string; status: string; lessonTitle: string;
  topicTitle: string; className: string; dueAt: string | null;
}

function dueLabel(due: string | null): { text: string; cls: string } | null {
  if (!due) return null;
  const d = new Date(due);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: 'Termen depășit', cls: 'bg-red-100 text-red-700' };
  if (days === 0) return { text: 'Astăzi', cls: 'bg-red-100 text-red-700' };
  if (days === 1) return { text: 'Mâine', cls: 'bg-amber-100 text-amber-800' };
  return { text: `În ${days} zile`, cls: 'bg-ink-100 text-ink-600' };
}

export function StudentDashboard({
  classes, homework,
}: { classes: ClassRow[]; homework: HomeworkRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get<{ linkCode: string; parents: { id: string; name: string }[] }>('/api/me/link-code')
      .then((d) => { setLinkCode(d.linkCode); setParents(d.parents); })
      .catch(() => {});
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/classes/join', { code });
      setOpen(false); setCode('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu m-am putut înscrie.');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Caietele tale</h1>
          <p className="text-sm text-ink-500">Toate materiile într-un singur loc.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">Intră într-o clasă</button>
      </div>

      {homework.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">De făcut</h2>
          <div className="space-y-2">
            {homework.map((h) => {
              const due = dueLabel(h.dueAt);
              return (
                <Link
                  key={h.submissionId} href={`/tema/${h.submissionId}`}
                  className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{h.lessonTitle}</p>
                    <p className="truncate text-xs text-ink-500">{h.className} · {h.topicTitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {due && <span className={`chip ${due.cls}`}>{due.text}</span>}
                    <StatusChip status={h.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Clasele mele</h2>
        {classes.length === 0 ? (
          <EmptyState
            title="Nu ești înscris la nicio clasă"
            hint="Cere profesorului codul de 6 caractere al clasei și introdu-l aici."
            action={<button onClick={() => setOpen(true)} className="btn-primary">Introdu codul</button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <Link key={c.id} href={`/clasa/${c.id}`} className="card overflow-hidden transition hover:shadow-md">
                <div className="h-1.5 bg-zest-500" />
                <div className="p-5">
                  <h3 className="font-bold text-ink-900">{c.name}</h3>
                  <p className="mt-1 text-sm text-ink-500">{c.teacherName}</p>
                  <p className="mt-3 text-xs text-ink-400">
                    {c.topicCount} {c.topicCount === 1 ? 'capitol' : 'capitole'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {linkCode && (
        <section className="card p-5">
          <h2 className="text-sm font-bold text-ink-800">Codul pentru părinte</h2>
          <p className="mt-1 text-xs text-ink-500">
            Dă-i acest cod părintelui ca să îți poată vedea temele și notele.
          </p>
          <p className="mt-3 inline-block rounded-lg border border-ink-200 bg-ink-50 px-4 py-2 font-mono text-lg font-bold tracking-widest text-ink-800">
            {linkCode}
          </p>
          {parents.length > 0 && (
            <p className="mt-3 text-xs text-ink-500">
              Conectat cu: {parents.map((p) => p.name).join(', ')}
            </p>
          )}
        </section>
      )}

      <Modal open={open} title="Intră într-o clasă" onClose={() => setOpen(false)}>
        <form onSubmit={join} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label" htmlFor="jcode">Codul primit de la profesor</label>
            <input
              id="jcode" className="input text-center font-mono text-2xl tracking-[0.3em]"
              autoFocus required maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Anulează</button>
            <button type="submit" className="btn-primary" disabled={loading || code.length !== 6}>
              {loading && <Spinner />} Înscrie-mă
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
