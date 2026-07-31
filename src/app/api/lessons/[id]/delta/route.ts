import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonMember } from '@/lib/access';
import { strokesSince } from '@/lib/deltas';

/**
 * Traseele adaugate de la un anumit punct incoace.
 *
 * `?since=N` — elevul are deja N trasee si le cere doar pe cele noi.
 * Daca profesorul a sters ceva, numarul scade sub N: raspundem cu `reset`,
 * iar clientul reincarca lectia intreaga. Stergerea e rara, deci costul ei
 * ocazional e acceptabil.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonMember(session, id);

    const since = Math.max(0, Number(new URL(req.url).searchParams.get('since') ?? 0) || 0);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { content: true, strokeCount: true, updatedAt: true },
    });

    if (since > lesson.strokeCount) {
      return NextResponse.json(
        { reset: true, strokes: strokesSince(lesson.content, 0), total: lesson.strokeCount, v: lesson.updatedAt.getTime() },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { reset: false, strokes: strokesSince(lesson.content, since), total: lesson.strokeCount, v: lesson.updatedAt.getTime() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleError(err);
  }
}
