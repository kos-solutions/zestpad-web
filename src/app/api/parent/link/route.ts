import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { linkChildSchema } from '@/lib/validation';

/** Parintele se leaga de contul copilului folosind codul afisat pe tableta copilului. */
export async function POST(req: Request) {
  try {
    const session = await requireRole('PARENT');
    const { code } = linkChildSchema.parse(await req.json());

    const child = await prisma.user.findUnique({
      where: { linkCode: code },
      select: { id: true, name: true, role: true },
    });
    if (!child || child.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Cod invalid.' }, { status: 404 });
    }

    const existing = await prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: session.userId, childId: child.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Esti deja asociat cu acest elev.' }, { status: 409 });
    }

    await prisma.parentChild.create({ data: { parentId: session.userId, childId: child.id } });
    return NextResponse.json({ child: { id: child.id, name: child.name } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
