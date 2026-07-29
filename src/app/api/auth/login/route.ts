import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { handleError } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Mesaj identic pentru email inexistent si parola gresita:
    // altfel un atacator poate afla ce adrese sunt inregistrate.
    const invalid = NextResponse.json({ error: 'Email sau parola incorecte.' }, { status: 401 });
    if (!user) {
      await bcrypt.compare(body.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      return invalid;
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return invalid;

    const token = await createSessionToken({
      userId: user.id, email: user.email, name: user.name, role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return handleError(err);
  }
}
