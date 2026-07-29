'use client';

/**
 * Persistenta locala + coada de sincronizare.
 *
 * Problema reala din scoli: wifi-ul pica in mijlocul orei. Daca elevul pierde
 * ce a scris, produsul e inutilizabil. Deci: scriem intai local (IndexedDB),
 * apoi incercam serverul. Daca serverul nu raspunde, punem in coada si
 * retrimitem cand revine conexiunea.
 */

const DB_NAME = 'zestpad';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_QUEUE = 'queue';

export interface QueuedMutation {
  id: string;
  url: string;
  method: 'PATCH' | 'POST';
  body: string;
  /** Cheia resursei: o mutatie noua o inlocuieste pe cea veche pentru aceeasi resursa. */
  resourceKey: string;
  createdAt: number;
  attempts: number;
}

export interface LocalDraft {
  key: string;
  content: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponibil'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        store.createIndex('resourceKey', 'resourceKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/* ---------- ciorne locale ---------- */

export async function saveDraft(key: string, content: string): Promise<void> {
  try {
    await tx(STORE_DRAFTS, 'readwrite', (s) =>
      s.put({ key, content, updatedAt: Date.now() } satisfies LocalDraft)
    );
  } catch {
    // Fallback pentru browsere in mod privat.
    try { localStorage.setItem(`zp_draft_${key}`, content); } catch { /* ignoram */ }
  }
}

export async function loadDraft(key: string): Promise<LocalDraft | null> {
  try {
    const r = await tx<LocalDraft | undefined>(STORE_DRAFTS, 'readonly', (s) => s.get(key));
    return r ?? null;
  } catch {
    try {
      const c = localStorage.getItem(`zp_draft_${key}`);
      return c ? { key, content: c, updatedAt: 0 } : null;
    } catch { return null; }
  }
}

export async function clearDraft(key: string): Promise<void> {
  try { await tx(STORE_DRAFTS, 'readwrite', (s) => s.delete(key)); } catch { /* ignoram */ }
  try { localStorage.removeItem(`zp_draft_${key}`); } catch { /* ignoram */ }
}

/* ---------- coada de sincronizare ---------- */

export async function enqueue(m: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_QUEUE, 'readwrite');
    const store = t.objectStore(STORE_QUEUE);
    // Colapsam: pastram doar ultima stare per resursa, nu istoricul.
    const idx = store.index('resourceKey');
    const cursorReq = idx.openCursor(IDBKeyRange.only(m.resourceKey));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { cursor.delete(); cursor.continue(); return; }
      store.put({ ...m, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 });
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function pendingCount(): Promise<number> {
  try { return await tx<number>(STORE_QUEUE, 'readonly', (s) => s.count()); } catch { return 0; }
}

async function allQueued(): Promise<QueuedMutation[]> {
  try { return await tx<QueuedMutation[]>(STORE_QUEUE, 'readonly', (s) => s.getAll()); } catch { return []; }
}

async function removeQueued(id: string): Promise<void> {
  try { await tx(STORE_QUEUE, 'readwrite', (s) => s.delete(id)); } catch { /* ignoram */ }
}

async function bumpAttempts(m: QueuedMutation): Promise<void> {
  try {
    await tx(STORE_QUEUE, 'readwrite', (s) => s.put({ ...m, attempts: m.attempts + 1 }));
  } catch { /* ignoram */ }
}

let flushing = false;

/** Retrimite tot ce e in coada. Sigur de apelat oricat de des. */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) {
    return { sent: 0, failed: 0 };
  }
  flushing = true;
  let sent = 0, failed = 0;

  try {
    for (const m of await allQueued()) {
      try {
        const res = await fetch(m.url, {
          method: m.method,
          headers: { 'Content-Type': 'application/json' },
          body: m.body,
        });
        if (res.ok) { await removeQueued(m.id); sent++; continue; }

        // 4xx = cererea nu va reusi niciodata (ex: tema deja predata). O aruncam.
        if (res.status >= 400 && res.status < 500) { await removeQueued(m.id); failed++; continue; }

        // 5xx = problema temporara de server, reincercam mai tarziu.
        await bumpAttempts(m);
        failed++;
      } catch {
        // offline din nou
        if (m.attempts >= 20) { await removeQueued(m.id); }
        else { await bumpAttempts(m); }
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

export function onConnectivityChange(cb: (online: boolean) => void): () => void {
  const onOnline = () => { cb(true); void flushQueue(); };
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
