'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ErrorBanner, Spinner } from '@/components/ui';

type Role = 'TEACHER' | 'STUDENT' | 'PARENT';

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'STUDENT', label: 'Elev',     hint: 'Scriu la oră și îmi fac temele' },
  { value: 'TEACHER', label: 'Profesor', hint: 'Predau, dau teme și corectez' },
  { value: 'PARENT',  label: 'Părinte',  hint: 'Urmăresc activitatea copilului' },
];

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'register') await api.post('/api/auth/register', { name, email, password, role });
      else await api.post('/api/auth/login', { email, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu m-am putut conecta la server.');
    } finally { setLoading(false); }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-2xl font-black text-zest-400 shadow-lift">
            Z
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">ZestPad</h1>
          <p className="mt-1.5 text-[15px] text-ink-500">Caietul digital al clasei</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">Nume complet</label>
              <input id="name" className="input" required value={name} autoComplete="name"
                onChange={(e) => setName(e.target.value)} placeholder="Ion Popescu" />
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required value={email}
              autoComplete="email" inputMode="email"
              onChange={(e) => setEmail(e.target.value)} placeholder="nume@exemplu.ro" />
          </div>

          <div>
            <label className="label" htmlFor="password">Parolă</label>
            <input id="password" type="password" className="input" required value={password}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minim 8 caractere' : '••••••••'} />
          </div>

          {mode === 'register' && (
            <div>
              <span className="label">Cont de</span>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)}
                    className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${
                      role === r.value
                        ? 'border-zest-500 bg-zest-50'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                    }`}>
                    <span>
                      <span className="block text-sm font-bold text-ink-900">{r.label}</span>
                      <span className="block text-[12px] text-ink-500">{r.hint}</span>
                    </span>
                    {role === r.value && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zest-500 text-[11px] font-bold text-white">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner />}
            {mode === 'register' ? 'Creează cont' : 'Intră în cont'}
          </button>

          <p className="pt-1 text-center text-sm text-ink-500">
            {mode === 'register' ? 'Ai deja cont?' : 'Nu ai cont?'}{' '}
            <button type="button"
              onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
              className="font-semibold text-zest-700 underline-offset-2 hover:underline">
              {mode === 'register' ? 'Autentifică-te' : 'Înregistrează-te'}
            </button>
          </p>
        </form>

        <p className="mt-7 text-center text-[12px] leading-relaxed text-ink-400">
          Fără reclame, fără urmărire, fără profilarea copiilor.<br />
          Datele rămân ale școlii.
        </p>
      </div>
    </main>
  );
}
