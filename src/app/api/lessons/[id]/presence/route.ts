import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonOwner } from '@/lib/access';
import { PRESENCE_PRUNE_MS, PRESENCE_WINDOW_MS } from '@/lib/presence';

/**
 * Cine urmareste lectia acum. Doar profesorul clasei.
 *
 * Nu returneaza niciodata "cine a lipsit" — doar cine e conectat in
 * momentul cererii. Nu exista istoric de interogat.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);

    const now = Date.now();

    // Curatam randurile vechi la fiecare interogare: nu tinem urme.
    await prisma.lessonPresence.deleteMany({
      where: { lessonId: id, lastSeenAt: { lt: new Date(now - PRESENCE_PRUNE_MS) } },
    });

    const rows = await prisma.lessonPresence.findMany({
      where: { lessonId: id, lastSeenAt: { gte: new Date(now - PRESENCE_WINDOW_MS) } },
      select: { studentId: true, student: { select: { name: true } } },
      orderBy: { student: { name: 'asc' } },
    });

    // Cati elevi sunt inscrisi, ca profesorul sa aiba un reper
    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { topic: { select: { classId: true } } },
    });
    const enrolled = await prisma.enrollment.count({ where: { classId: lesson.topic.classId } });

    return NextResponse.json(
      {
        watching: rows.map((r) => ({ id: r.studentId, name: r.student.name })),
        enrolled,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleError(err);
  }
}
