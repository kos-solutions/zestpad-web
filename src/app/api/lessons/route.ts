import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { assertTopicOwner } from '@/lib/access';
import { createLessonSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const session = await requireRole('TEACHER');
    const body = createLessonSchema.parse(await req.json());
    await assertTopicOwner(session, body.topicId);

    const count = await prisma.lesson.count({ where: { topicId: body.topicId } });
    const lesson = await prisma.lesson.create({
      data: {
        title: body.title,
        type: body.type,
        topicId: body.topicId,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        position: count,
      },
      select: { id: true, title: true, type: true, published: true, dueAt: true },
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
