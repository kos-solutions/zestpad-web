'use client';

import { enqueue, flushQueue, saveDraft } from './offline';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'A aparut o eroare.');
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>(url),
  post: <T,>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T,>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T,>(url: string) => request<T>(url, { method: 'DELETE' }),
};

export type SaveState = 'idle' | 'saving' | 'saved' | 'queued' | 'error';

/**
 * Salvarea unui desen, rezistenta la caderi de retea.
 * Ordinea conteaza: intai local, apoi server. Daca serverul nu raspunde,
 * punem in coada — utilizatorul nu pierde nimic.
 */
export async function saveContent(opts: {
  url: string;
  method?: 'PATCH' | 'POST';
  content: string;
  draftKey: string;
}): Promise<SaveState> {
  const { url, method = 'PATCH', content, draftKey } = opts;
  const body = JSON.stringify({ content });

  await saveDraft(draftKey, content);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueue({ url, method, body, resourceKey: draftKey });
    return 'queued';
  }

  try {
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body,
    });
    if (res.ok) { void flushQueue(); return 'saved'; }
    if (res.status >= 500) { await enqueue({ url, method, body, resourceKey: draftKey }); return 'queued'; }
    return 'error';
  } catch {
    await enqueue({ url, method, body, resourceKey: draftKey });
    return 'queued';
  }
}
