'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorBanner, Modal, Spinner, StatusChip, DueChip } from './ui';
import { useAutoRefresh } from '@/lib/live';

interface ClassRow { id: string; name: string; teacherName: string; topicCount: number }
interface HomeworkRow {
  submissionId: string; status: string; lessonTitle: string;
  topicTitle: string; className: string; dueAt: string | null;
}

export function StudentDashboard({
  classes, homework,
}: { classes: ClassRow[]; homework: HomeworkRow[] }) {
  const router = useRouter();
  // Elevii trebuie sa vada repede temele noi date de profesor.
  useAutoRefresh(12000);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);
  const [showCode, setShowCode] = useState(false);

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

  const urgent = homework.filter((h) => h.dueAt && new Date(h.dueAt).getTime() < Date.now() + 2 * 864e5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Caietele mele</h1>
          <p className="mt-1 text-[15px] text-ink-500">
            {homework.length === 0
              ? 'Nu ai teme de făcut. '
              : `${homework.length} ${homework.length === 1 ? 'temă' : 'teme'} de făcut`}
            {urgent.length > 0 && ` · ${urgent.length} urgent${urgent.length === 1 ? 'ă' : 'e'}`}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-secondary">Intră într-o clasă</button>
      </div>

      {homework.length > 0 && (
        <section>
          <h2 className="section-title mb-3">De făcut</h2>
          <div className="space-y-2.5">
            {homework.map((h) => (
              <Link key={h.submissionId} href={`/tema/${h.submissionId}`}
                className="card-hover flex items-center gap-4 px-5 py-4">
                <span className="h-10 w-1 shrink-0 rounded-full bg-zest-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{h.lessonTitle}</p>
                  <p className="truncate text-[13px] text-ink-500">{h.className} · {h.topicTitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <DueChip dueAt={h.dueAt} />
                  <StatusChip status={h.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">Materii</h2>
        {classes.length === 0 ? (
          <EmptyState
            title="Nu ești încă în nicio clasă"
            hint="Profesorul îți dă un cod din 6 litere și cifre. Introdu-l aici."
            action={<button onClick={() => setOpen(true)} className="btn-primary">Introdu codul</button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <Link key={c.id} href={`/clasa/${c.id}`} className="card-hover group p-5">
                <h3 className="text-[17px] font-bold leading-snug text-ink-900 transition group-hover:text-zest-700">
                  {c.name}
                </h3>
                <p className="mt-1.5 text-[13px] text-ink-500">{c.teacherName}</p>
                <p className="mt-3 text-[12px] text-ink-400">
                  {c.topicCount} {c.topicCount === 1 ? 'capitol' : 'capitole'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {linkCode && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-ink-900">Codul pentru părinte</h2>
              <p className="mt-0.5 text-[13px] text-ink-500">
                {parents.length > 0
                  ? `Conectat cu ${parents.map((p) => p.name).join(', ')}.`
                  : 'Dă-i acest cod ca să îți vadă temele și notele.'}
              </p>
            </div>
            {showCode ? (
              <span className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-2.5 font-mono text-lg font-bold tracking-[0.2em] text-ink-900">
                {linkCode}
              </span>
            ) : (
              <button onClick={() => setShowCode(true)} className="btn-secondary btn-sm">
                Arată codul
              </button>
            )}
          </div>
        </section>
      )}

      <Modal open={open} title="Intră într-o clasă"
        description="Codul are 6 caractere și ți-l dă profesorul."
        onClose={() => setOpen(false)}>
        <form onSubmit={join} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <input
            className="input text-center font-mono text-3xl font-bold tracking-[0.35em]"
            autoFocus required maxLength={6} value={code}
            inputMode="text" autoCapitalize="characters" autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234"
          />
          <div className="flex justify-end gap-2 pt-1">
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
