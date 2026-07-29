import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonOwner } from '@/lib/access';

/** Catalogul profesorului: toate lucrarile la o tema. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { id: true, title: true, type: true, dueAt: true },
    });

    const submissions = await prisma.submission.findMany({
      where: { lessonId: id },
      orderBy: [{ status: 'desc' }, { submittedAt: 'asc' }],
      select: {
        id: true, status: true, grade: true, submittedAt: true, gradedAt: true,
        student: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ lesson, submissions });
  } catch (err) {
    return handleError(err);
  }
}
