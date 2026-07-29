'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ErrorBanner, Spinner } from '@/components/ui';

type Role = 'TEACHER' | 'STUDENT' | 'PARENT';

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'TEACHER', label: 'Profesor', hint: 'Creez clase, lecții și teme' },
  { value: 'STUDENT', label: 'Elev', hint: 'Scriu la oră și îmi fac temele' },
  { value: 'PARENT', label: 'Părinte', hint: 'Urmăresc activitatea copilului' },
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
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        await api.post('/api/auth/register', { name, email, password, role });
      } else {
        await api.post('/api/auth/login', { email, password });
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu m-am putut conecta la server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-50 to-ink-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zest-600 text-2xl font-bold text-white shadow-lg">
            Z
          </div>
          <h1 className="text-2xl font-bold text-ink-900">ZestPad</h1>
          <p className="mt-1 text-sm text-ink-500">Caietul digital al clasei</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">Nume complet</label>
              <input
                id="name" className="input" required value={name} autoComplete="name"
                onChange={(e) => setName(e.target.value)} placeholder="Ion Popescu"
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" className="input" required value={email}
              autoComplete="email" onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@exemplu.ro"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Parolă</label>
            <input
              id="password" type="password" className="input" required value={password}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minim 8 caractere' : '••••••••'}
            />
          </div>

          {mode === 'register' && (
            <div>
              <span className="label">Cont de</span>
              <div className="grid gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value} type="button" onClick={() => setRole(r.value)}
                    className={`flex items-center justify-between rounded-lg border-2 px-3 py-2.5 text-left transition ${
                      role === r.value
                        ? 'border-zest-500 bg-zest-50'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink-800">{r.label}</span>
                      <span className="block text-xs text-ink-500">{r.hint}</span>
                    </span>
                    {role === r.value && <span className="text-zest-600">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner />}
            {mode === 'register' ? 'Creează cont' : 'Intră în cont'}
          </button>

          <p className="text-center text-sm text-ink-500">
            {mode === 'register' ? 'Ai deja cont?' : 'Nu ai cont?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
              className="font-semibold text-zest-600 hover:underline"
            >
              {mode === 'register' ? 'Autentifică-te' : 'Înregistrează-te'}
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-ink-400">
          Fără urmărire, fără profilare. Datele rămân ale școlii.
        </p>
      </div>
    </main>
  );
}
