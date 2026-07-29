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

  useEffect(() => {
    setOnline(navigator.onLine);
    const off = onConnectivityChange(setOnline);
    const tick = setInterval(() => { void pendingCount().then(setQueued); }, 4000);
    return () => { off(); clearInterval(tick); };
  }, []);

  async function logout() {
    await api.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  }

  const home = session.role === 'PARENT' ? '/parinte' : '/panou';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={home} className="flex items-center gap-2 no-select">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zest-600 text-sm font-bold text-white">
              Z
            </span>
            <span className="font-bold text-ink-900">ZestPad</span>
          </Link>

          <div className="flex items-center gap-3">
            {(!online || queued > 0) && (
              <span className="chip bg-amber-100 text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {online ? `Sincronizez ${queued}` : 'Offline'}
              </span>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-ink-800">{session.name}</p>
              <p className="text-xs leading-tight text-ink-500">{ROLE_LABEL[session.role]}</p>
            </div>
            <button onClick={logout} className="btn-ghost text-sm">Ieșire</button>
          </div>
        </div>
      </header>

      <main key={pathname} className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
