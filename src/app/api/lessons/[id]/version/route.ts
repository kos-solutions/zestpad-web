import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonMember } from '@/lib/access';

/**
 * Endpoint minuscul, interogat des cat timp profesorul preda.
 * Returneaza si numarul de trasee, ca elevul sa stie exact cate ii lipsesc
 * si sa ceara doar diferenta, nu toata lectia.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonMember(session, id);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { updatedAt: true, liveUntil: true, published: true, strokeCount: true },
    });

    const live = !!lesson.liveUntil && lesson.liveUntil.getTime() > Date.now();

    return NextResponse.json(
      { v: lesson.updatedAt.getTime(), n: lesson.strokeCount, live, published: lesson.published },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleError(err);
  }
}
