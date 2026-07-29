import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { assertClassOwner } from '@/lib/access';
import { createTopicSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const session = await requireRole('TEACHER');
    const body = createTopicSchema.parse(await req.json());

    // Verificarea care lipsea complet in codul vechi.
    await assertClassOwner(session, body.classId);

    const count = await prisma.topic.count({ where: { classId: body.classId } });
    const topic = await prisma.topic.create({
      data: {
        title: body.title,
        background: body.background,
        classId: body.classId,
        position: count,
      },
      select: { id: true, title: true, background: true },
    });

    return NextResponse.json({ topic }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
