'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { onConnectivityChange, pendingCount } from '@/lib/offline';
import type { Role } from '@prisma/client';

interface Session { userId: string; name: string; email: string; role: Role }

const ROLE_LABEL: Record<Role, string> = {
  TEACHER: 'Profesor', STUDENT: 'Elev', PARENT: 'Părinte',
};

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const off = onConnectivityChange(setOnline);
    const tick = setInterval(() => { void pendingCount().then(setQueued); }, 4000);
    return () => { off(); clearInterval(tick); };
  }, []);

  useEffect(() => { setMenu(false); }, [pathname]);

  async function logout() {
    await api.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  }

  const home = session.role === 'PARENT' ? '/parinte' : '/panou';
  const initials = session.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  // Ecranul de scris ocupa tot spatiul: ascundem cromul inutil
  const isCanvas = /^\/(lectie|tema)\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href={home} className="flex items-center gap-2.5 no-select">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-sm font-black text-zest-400">
              Z
            </span>
            <span className="text-[17px] font-bold tracking-tight text-ink-900">ZestPad</span>
          </Link>

          <div className="flex items-center gap-2">
            {(!online || queued > 0) && (
              <span className="chip bg-amber-100 text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">{online ? `Sincronizez ${queued}` : 'Offline'}</span>
              </span>
            )}

            <div className="relative">
              <button
                onClick={() => setMenu((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-ink-100"
                aria-label="Meniu cont"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zest-100 text-[13px] font-bold text-zest-800">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-semibold leading-tight text-ink-800">{session.name}</span>
                  <span className="block text-[11px] leading-tight text-ink-500">{ROLE_LABEL[session.role]}</span>
                </span>
              </button>

              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 animate-fade-up overflow-hidden rounded-2xl border border-ink-200 bg-white p-1.5 shadow-lift">
                    <div className="px-3 py-2.5 sm:hidden">
                      <p className="text-sm font-semibold text-ink-800">{session.name}</p>
                      <p className="text-xs text-ink-500">{ROLE_LABEL[session.role]}</p>
                    </div>
                    <p className="truncate px-3 py-1.5 text-xs text-ink-400">{session.email}</p>
                    <button
                      onClick={logout}
                      className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Ieși din cont
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className={isCanvas ? 'mx-auto max-w-6xl px-3 py-4' : 'mx-auto max-w-6xl px-4 py-7 sm:py-9'}
      >
        {children}
      </main>
    </div>
  );
}
