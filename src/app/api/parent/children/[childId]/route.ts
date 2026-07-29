import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';

/** Detaliile unui copil: clase, teme, caiete marcate ca vizibile. */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  try {
    const session = await requireRole('PARENT');
    const { childId } = await params;
    await assertParentOf(session, childId);

    const child = await prisma.user.findUniqueOrThrow({
      where: { id: childId },
      select: {
        id: true, name: true,
        enrollments: {
          select: { class: { select: { id: true, name: true, teacher: { select: { name: true } } } } },
        },
      },
    });

    const submissions = await prisma.submission.findMany({
      where: { studentId: childId, lesson: { type: 'HOMEWORK' } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, status: true, grade: true, comment: true, submittedAt: true, gradedAt: true,
        lesson: {
          select: {
            title: true, dueAt: true,
            topic: { select: { title: true, class: { select: { name: true } } } },
          },
        },
      },
    });

    // Caietele personale sunt private; parintele le vede doar daca elevul le-a marcat vizibile.
    const notebooks = await prisma.notebook.findMany({
      where: { ownerId: childId, visibleToParent: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({
      child: {
        id: child.id,
        name: child.name,
        classes: child.enrollments.map((e) => ({
          id: e.class.id, name: e.class.name, teacherName: e.class.teacher.name,
        })),
        submissions,
        notebooks,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
