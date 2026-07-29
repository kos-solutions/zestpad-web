'use client';

import { useEffect, useState } from 'react';
import { onConnectivityChange, pendingCount } from '@/lib/offline';
import type { SaveState } from '@/lib/api';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex animate-fade-up items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss}
          className="shrink-0 text-lg leading-none text-red-400 hover:text-red-700">×</button>
      )}
    </div>
  );
}

export function EmptyState({
  icon, title, hint, action,
}: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/50 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-ink-300">{icon}</div>}
      <p className="text-lg font-semibold text-ink-800">{title}</p>
      {hint && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Starea salvarii. Elevul trebuie sa vada mereu daca munca lui e in siguranta. */
export function SaveIndicator({ state, dirty }: { state: SaveState; dirty: boolean }) {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const off = onConnectivityChange(setOnline);
    const tick = setInterval(() => { void pendingCount().then(setQueued); }, 3000);
    void pendingCount().then(setQueued);
    return () => { off(); clearInterval(tick); };
  }, [state]);

  if (!online || state === 'queued' || queued > 0) {
    return (
      <span className="chip bg-amber-100 text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {online ? 'Se sincronizează' : 'Offline · salvat pe tabletă'}
      </span>
    );
  }
  if (state === 'saving') return <span className="chip bg-ink-100 text-ink-600"><Spinner className="h-3 w-3" /> Se salvează</span>;
  if (state === 'error')  return <span className="chip bg-red-100 text-red-700">Eroare la salvare</span>;
  if (dirty)              return <span className="chip bg-ink-100 text-ink-500">Nesalvat</span>;
  if (state === 'saved')  return <span className="chip bg-emerald-100 text-emerald-700">Salvat</span>;
  return <span className="chip bg-ink-100 text-ink-400">Sincronizat</span>;
}

/** Indicator de predare live, vizibil elevilor. */
export function LiveBadge({ following }: { following?: boolean }) {
  return (
    <span className="chip bg-red-50 text-red-700 ring-1 ring-red-200">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      {following === false ? 'Se predă acum' : 'În direct'}
    </span>
  );
}

export function Modal({
  open, title, description, onClose, children,
}: {
  open: boolean; title: string; description?: string;
  onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function StatusChip({ status, grade }: { status: string; grade?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    NOT_STARTED: { label: 'De început', cls: 'bg-ink-100 text-ink-600' },
    DRAFT:       { label: 'În lucru',   cls: 'bg-amber-100 text-amber-800' },
    SUBMITTED:   { label: 'Predat',     cls: 'bg-zest-100 text-zest-800' },
    GRADED:      { label: grade ? `Nota ${grade}` : 'Corectat', cls: 'bg-emerald-100 text-emerald-800' },
  };
  const s = map[status] ?? map.NOT_STARTED;
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

/** Eticheta de termen, colorata dupa urgenta. */
export function DueChip({ dueAt, done }: { dueAt: string | null; done?: boolean }) {
  if (!dueAt || done) return null;
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return <span className="chip bg-red-100 text-red-700">Termen depășit</span>;
  if (days === 0) return <span className="chip bg-red-100 text-red-700">Astăzi</span>;
  if (days === 1) return <span className="chip bg-amber-100 text-amber-800">Mâine</span>;
  if (days <= 7)  return <span className="chip bg-ink-100 text-ink-600">{days} zile</span>;
  return <span className="chip bg-ink-100 text-ink-500">{new Date(dueAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</span>;
}

/** Bara de progres simpla, pentru panoul parintelui. */
export function Progress({ value, total, tone = 'zest' }: { value: number; total: number; tone?: 'zest' | 'emerald' }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className={`h-full rounded-full transition-all ${tone === 'emerald' ? 'bg-emerald-500' : 'bg-zest-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
