import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import { getSession, type SessionPayload } from './session';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Arunca 401 daca nu e logat. De folosit in route handlers. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Trebuie sa fii autentificat.');
  return session;
}

/** Arunca 403 daca rolul nu e permis. */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireUser();
  if (!roles.includes(session.role)) {
    throw new HttpError(403, 'Nu ai permisiunea necesara pentru aceasta actiune.');
  }
  return session;
}

/** Wrapper uniform pentru erori in route handlers. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
    const issues = (err as { issues?: Array<{ message: string }> }).issues ?? [];
    return NextResponse.json(
      { error: issues.map((i) => i.message).join(', ') || 'Date invalide.' },
      { status: 400 }
    );
  }
  console.error('[zestpad] eroare neasteptata:', err);
  return NextResponse.json({ error: 'A aparut o eroare pe server.' }, { status: 500 });
}
