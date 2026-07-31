import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonMember } from '@/lib/access';

/**
 * Endpoint minuscul, interogat des cat timp profesorul preda.
 *
 * Face si dubla treaba de semnal de prezenta: elevul deja interogheaza aici,
 * deci nu adaugam nicio cerere in plus. Inregistram doar cat timp se preda —
 * in afara orei nu se scrie nimic.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const { isTeacher } = await assertLessonMember(session, id);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { updatedAt: true, liveUntil: true, published: true, strokeCount: true },
    });

    const live = !!lesson.liveUntil && lesson.liveUntil.getTime() > Date.now();

    if (live && !isTeacher && session.role === 'STUDENT') {
      // Esuarea nu trebuie sa strice sincronizarea: prezenta e accesoriu.
      try {
        await prisma.lessonPresence.upsert({
          where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
          create: { lessonId: id, studentId: session.userId },
          update: { lastSeenAt: new Date() },
        });
      } catch { /* ignoram */ }
    }

    return NextResponse.json(
      { v: lesson.updatedAt.getTime(), n: lesson.strokeCount, live, published: lesson.published },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleError(err);
  }
}
