import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertTopicMember, assertTopicOwner } from '@/lib/access';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const { isTeacher } = await assertTopicMember(session, id);

    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, title: true, background: true,
        class: { select: { id: true, name: true } },
        lessons: {
          // Elevii vad doar lectiile publicate.
          where: isTeacher ? {} : { published: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true, title: true, type: true, published: true, dueAt: true,
            _count: { select: { submissions: true } },
            submissions: isTeacher
              ? { where: { status: 'SUBMITTED' }, select: { id: true } }
              : { where: { studentId: session.userId }, select: { id: true, status: true, grade: true } },
          },
        },
      },
    });

    return NextResponse.json({
      topic: {
        id: topic.id,
        title: topic.title,
        background: topic.background,
        class: topic.class,
        isTeacher,
        lessons: topic.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          published: l.published,
          dueAt: l.dueAt,
          totalSubmissions: l._count.submissions,
          pendingReview: isTeacher ? l.submissions.length : undefined,
          mySubmission: isTeacher ? undefined : l.submissions[0] ?? null,
        })),
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
    await assertTopicOwner(session, id);
    await prisma.topic.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
