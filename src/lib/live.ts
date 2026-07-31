'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sincronizare aproape instantanee, fara conexiuni persistente.
 *
 * De ce nu WebSocket/SSE: wifi-ul de scoala pica des, iar o conexiune
 * persistenta trebuie reconectata de fiecare data. O interogare scurta e
 * imuna la asta — daca una esueaza, urmatoarea reuseste.
 *
 * Costul e tinut jos prin trei masuri:
 *  - interogam doar cat timp profesorul preda efectiv ("Predau acum")
 *  - ne oprim cand fila nu e vizibila
 *  - endpoint-ul de versiune returneaza cateva zeci de octeti, nu desenul
 */

const FAST_MS = 1500;   // in timpul predarii
const SLOW_MS = 15000;  // in afara ei, doar ca sa aflam daca a inceput
const IDLE_MS = 60000;  // dupa multe verificari fara schimbare

export interface LiveState {
  version: number | null;
  live: boolean;
  /** cate trasee are lectia pe server */
  strokes: number;
  /** creste de fiecare data cand serverul raporteaza continut nou */
  changeCount: number;
}

export function useLessonLive(lessonId: string, enabled = true): LiveState {
  const [state, setState] = useState<LiveState>({ version: null, live: false, strokes: 0, changeCount: 0 });
  const versionRef = useRef<number | null>(null);
  const unchangedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;

    const tick = async () => {
      if (stoppedRef.current) return;

      let delay = SLOW_MS;
      try {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          const res = await fetch(`/api/lessons/${lessonId}/version`, { cache: 'no-store' });
          if (res.ok) {
            const d = (await res.json()) as { v: number; n: number; live: boolean };
            const changed = versionRef.current !== null && d.v !== versionRef.current;
            versionRef.current = d.v;

            if (changed) unchangedRef.current = 0;
            else unchangedRef.current++;

            setState((prev) => ({
              version: d.v,
              live: d.live,
              strokes: d.n,
              changeCount: changed ? prev.changeCount + 1 : prev.changeCount,
            }));

            // Cat timp se preda, verificam des. Daca nu se schimba nimic
            // mult timp, incetinim ca sa nu ardem cereri degeaba.
            delay = d.live ? (unchangedRef.current > 40 ? SLOW_MS : FAST_MS) : SLOW_MS;
          }
        } else {
          delay = IDLE_MS;
        }
      } catch {
        delay = SLOW_MS; // offline sau eroare: reincercam mai rar
      }

      if (!stoppedRef.current) timerRef.current = setTimeout(tick, delay);
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current);
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lessonId, enabled]);

  return state;
}

/**
 * Reimprospatarea listelor (capitole, lectii, clase) ca elevii sa vada
 * imediat ce adauga profesorul. Foloseste router.refresh(), deci Next.js
 * reface doar componentele de server, fara sa piarda starea din pagina.
 */
export function useAutoRefresh(intervalMs = 12000, enabled = true) {
  const router = useRouter();
  const busy = useRef(false);

  const refresh = useCallback(() => {
    if (busy.current || document.visibilityState !== 'visible' || !navigator.onLine) return;
    busy.current = true;
    router.refresh();
    setTimeout(() => { busy.current = false; }, 1200);
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh, intervalMs, enabled]);

  return refresh;
}


/**
 * Cine urmareste lectia acum. Doar pentru profesor, doar cat preda.
 *
 * Nu exista varianta "cine a lipsit": nu se stocheaza istoric, iar semnalul
 * e prea nesigur ca sa poata fi folosit drept catalog.
 */
export interface Watcher { id: string; name: string }

export function usePresence(lessonId: string, enabled: boolean) {
  const [watching, setWatching] = useState<Watcher[]>([]);
  const [enrolled, setEnrolled] = useState(0);

  useEffect(() => {
    if (!enabled) { setWatching([]); return; }
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible' && navigator.onLine) {
        try {
          const res = await fetch(`/api/lessons/${lessonId}/presence`, { cache: 'no-store' });
          if (res.ok) {
            const d = (await res.json()) as { watching: Watcher[]; enrolled: number };
            if (!stopped) { setWatching(d.watching); setEnrolled(d.enrolled); }
          }
        } catch { /* reincercam */ }
      }
    };

    void tick();
    const id = setInterval(tick, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, [lessonId, enabled]);

  return { watching, enrolled };
}
