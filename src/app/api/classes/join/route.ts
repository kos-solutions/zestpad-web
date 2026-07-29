import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { joinClassSchema } from '@/lib/validation';

/** Endpoint-ul pe care frontend-ul vechi il apela dar care nu exista in backend. */
export async function POST(req: Request) {
  try {
    const session = await requireRole('STUDENT');
    const { code } = joinClassSchema.parse(await req.json());

    const cls = await prisma.class.findUnique({
      where: { code },
      select: { id: true, name: true, archived: true },
    });
    if (!cls || cls.archived) {
      return NextResponse.json({ error: 'Cod invalid. Verifica literele si cifrele.' }, { status: 404 });
    }

    const already = await prisma.enrollment.findUnique({
      where: { classId_studentId: { classId: cls.id, studentId: session.userId } },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json({ error: 'Esti deja inscris la aceasta clasa.' }, { status: 409 });
    }

    await prisma.enrollment.create({ data: { classId: cls.id, studentId: session.userId } });

    // Cand un elev intra in clasa, ii cream lucrarile pentru temele deja publicate,
    // ca sa nu piarda temele date inainte sa se inscrie.
    const homeworks = await prisma.lesson.findMany({
      where: { topic: { classId: cls.id }, type: 'HOMEWORK', published: true },
      select: { id: true },
    });
    if (homeworks.length > 0) {
      await prisma.submission.createMany({
        data: homeworks.map((h) => ({ lessonId: h.id, studentId: session.userId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ class: { id: cls.id, name: cls.name } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
