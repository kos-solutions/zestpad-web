import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { assertLessonMember } from '@/lib/access';
import { contentSchema } from '@/lib/validation';

/** Notitele proprii ale elevului peste lectia profesorului. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('STUDENT');
    const { id } = await params;
    await assertLessonMember(session, id);

    const note = await prisma.lessonNote.findUnique({
      where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({ content: note?.content ?? '', updatedAt: note?.updatedAt ?? null });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('STUDENT');
    const { id } = await params;
    await assertLessonMember(session, id);
    const { content } = contentSchema.parse(await req.json());

    await prisma.lessonNote.upsert({
      where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
      create: { lessonId: id, studentId: session.userId, content },
      update: { content },
    });

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
