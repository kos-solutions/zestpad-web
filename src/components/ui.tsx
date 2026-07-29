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
    <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="font-bold text-red-400 hover:text-red-600">×</button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-16 text-center">
      <p className="text-lg font-semibold text-ink-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Indicator de salvare + stare de conexiune. Elevul trebuie sa vada mereu daca s-a salvat. */
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
        {online ? 'Se sincronizează…' : 'Offline — salvat pe dispozitiv'}
      </span>
    );
  }
  if (state === 'saving') {
    return <span className="chip bg-ink-100 text-ink-600"><Spinner className="h-3 w-3" /> Se salvează…</span>;
  }
  if (state === 'error') {
    return <span className="chip bg-red-100 text-red-700">Eroare la salvare</span>;
  }
  if (dirty) {
    return <span className="chip bg-ink-100 text-ink-500">Modificări nesalvate</span>;
  }
  if (state === 'saved') {
    return <span className="chip bg-green-100 text-green-700">Salvat</span>;
  }
  return <span className="chip bg-ink-100 text-ink-400">Sincronizat</span>;
}

export function Modal({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-ink-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function StatusChip({ status, grade }: { status: string; grade?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    NOT_STARTED: { label: 'Neînceput', cls: 'bg-ink-100 text-ink-600' },
    DRAFT: { label: 'În lucru', cls: 'bg-amber-100 text-amber-800' },
    SUBMITTED: { label: 'Predat', cls: 'bg-zest-100 text-zest-800' },
    GRADED: { label: grade ? `Notat: ${grade}` : 'Corectat', cls: 'bg-green-100 text-green-800' },
  };
  const s = map[status] ?? map.NOT_STARTED;
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}
