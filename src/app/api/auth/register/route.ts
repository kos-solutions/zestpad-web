import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { handleError } from '@/lib/auth';
import { generateLinkCode } from '@/lib/codes';

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: 'Exista deja un cont cu acest email.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    // Elevul primeste un cod unic pe care il da parintelui ca sa se lege de cont.
    let linkCode: string | null = null;
    if (body.role === 'STUDENT') {
      for (let i = 0; i < 5; i++) {
        const candidate = generateLinkCode();
        const taken = await prisma.user.findUnique({ where: { linkCode: candidate }, select: { id: true } });
        if (!taken) { linkCode = candidate; break; }
      }
    }

    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash, role: body.role, linkCode },
      select: { id: true, email: true, name: true, role: true, linkCode: true },
    });

    const token = await createSessionToken({
      userId: user.id, email: user.email, name: user.name, role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
