import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertClassMember, assertClassOwner } from '@/lib/access';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const { isTeacher } = await assertClassMember(session, id);

    const cls = await prisma.class.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, name: true, code: true, createdAt: true,
        teacher: { select: { id: true, name: true } },
        topics: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true, background: true, _count: { select: { lessons: true } } },
        },
      },
    });

    // Lista elevilor doar pentru profesor — elevii nu au nevoie de ea.
    const students = isTeacher
      ? (
          await prisma.enrollment.findMany({
            where: { classId: id },
            select: { student: { select: { id: true, name: true, email: true } } },
          })
        ).map((e) => e.student)
      : undefined;

    return NextResponse.json({
      class: {
        id: cls.id,
        name: cls.name,
        code: isTeacher ? cls.code : undefined,
        teacher: cls.teacher,
        topics: cls.topics,
        students,
        isTeacher,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertClassOwner(session, id);
    await prisma.class.update({ where: { id }, data: { archived: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
