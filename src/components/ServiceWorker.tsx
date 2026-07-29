'use client';

import { useEffect } from 'react';
import { flushQueue } from '@/lib/offline';

export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // in dev sau pe http nesecurizat nu se inregistreaza; nu e fatal
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    // La revenirea in aplicatie, golim coada de sincronizare.
    const onVisible = () => { if (document.visibilityState === 'visible') void flushQueue(); };
    document.addEventListener('visibilitychange', onVisible);
    void flushQueue();

    return () => {
      window.removeEventListener('load', register);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
