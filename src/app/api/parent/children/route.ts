import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';

/** Lista copiilor + un rezumat al activitatii recente. */
export async function GET() {
  try {
    const session = await requireRole('PARENT');

    const links = await prisma.parentChild.findMany({
      where: { parentId: session.userId },
      select: { child: { select: { id: true, name: true, email: true } } },
    });
    const childIds = links.map((l) => l.child.id);
    if (childIds.length === 0) return NextResponse.json({ children: [] });

    const submissions = await prisma.submission.findMany({
      where: { studentId: { in: childIds }, lesson: { type: 'HOMEWORK' } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, studentId: true, status: true, grade: true,
        submittedAt: true, gradedAt: true,
        lesson: {
          select: {
            id: true, title: true, dueAt: true,
            topic: { select: { title: true, class: { select: { name: true } } } },
          },
        },
      },
    });

    const children = links.map((l) => {
      const own = submissions.filter((s) => s.studentId === l.child.id);
      const now = new Date();
      return {
        id: l.child.id,
        name: l.child.name,
        stats: {
          total: own.length,
          pending: own.filter((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT').length,
          submitted: own.filter((s) => s.status === 'SUBMITTED').length,
          graded: own.filter((s) => s.status === 'GRADED').length,
          overdue: own.filter(
            (s) =>
              (s.status === 'NOT_STARTED' || s.status === 'DRAFT') &&
              s.lesson.dueAt != null &&
              new Date(s.lesson.dueAt) < now
          ).length,
        },
        recent: own.slice(0, 8).map((s) => ({
          submissionId: s.id,
          lessonTitle: s.lesson.title,
          topicTitle: s.lesson.topic.title,
          className: s.lesson.topic.class.name,
          status: s.status,
          grade: s.grade,
          dueAt: s.lesson.dueAt,
          submittedAt: s.submittedAt,
          gradedAt: s.gradedAt,
        })),
      };
    });

    return NextResponse.json({ children });
  } catch (err) {
    return handleError(err);
  }
}
