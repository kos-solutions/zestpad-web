import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonMember } from '@/lib/access';

/**
 * Endpoint minuscul, interogat des de elevi cat timp profesorul preda.
 * Returneaza doar cat sa stim daca s-a schimbat ceva — nu si continutul,
 * care poate avea sute de kiloocteti.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonMember(session, id);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { updatedAt: true, liveUntil: true, published: true },
    });

    const live = !!lesson.liveUntil && lesson.liveUntil.getTime() > Date.now();

    return NextResponse.json(
      { v: lesson.updatedAt.getTime(), live, published: lesson.published },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleError(err);
  }
}
