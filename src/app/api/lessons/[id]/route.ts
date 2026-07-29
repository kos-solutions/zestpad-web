import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonMember, assertLessonOwner } from '@/lib/access';
import { updateLessonSchema } from '@/lib/validation';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const { isTeacher } = await assertLessonMember(session, id);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, title: true, type: true, content: true, published: true, dueAt: true,
        topic: {
          select: {
            id: true, title: true, background: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Elevul la o tema primeste si lucrarea lui.
    let mySubmission = null;
    if (!isTeacher && lesson.type === 'HOMEWORK') {
      mySubmission = await prisma.submission.upsert({
        where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
        create: { lessonId: id, studentId: session.userId },
        update: {},
        select: {
          id: true, status: true, content: true, feedback: true,
          grade: true, comment: true, submittedAt: true, gradedAt: true,
        },
      });
    }

    return NextResponse.json({ lesson: { ...lesson, isTeacher }, mySubmission });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);
    const body = updateLessonSchema.parse(await req.json());

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
      },
      select: { id: true, title: true, type: true, published: true, dueAt: true, topic: { select: { classId: true } } },
    });

    // La publicarea unei teme, generam lucrarile pentru toti elevii inscrisi.
    if (body.published === true && lesson.type === 'HOMEWORK') {
      const students = await prisma.enrollment.findMany({
        where: { classId: lesson.topic.classId },
        select: { studentId: true },
      });
      if (students.length > 0) {
        await prisma.submission.createMany({
          data: students.map((s) => ({ lessonId: id, studentId: s.studentId })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ lesson });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);
    await prisma.lesson.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
