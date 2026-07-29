import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ParentDashboard } from '@/components/ParentDashboard';

export default async function ParentPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'PARENT') redirect('/panou');

  const links = await prisma.parentChild.findMany({
    where: { parentId: session.userId },
    select: { child: { select: { id: true, name: true } } },
  });
  const childIds = links.map((l) => l.child.id);

  const submissions = childIds.length
    ? await prisma.submission.findMany({
        where: { studentId: { in: childIds }, lesson: { type: 'HOMEWORK', published: true } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, studentId: true, status: true, grade: true,
          submittedAt: true, gradedAt: true,
          lesson: {
            select: {
              title: true, dueAt: true,
              topic: { select: { title: true, class: { select: { name: true } } } },
            },
          },
        },
      })
    : [];

  const now = Date.now();
  const children = links.map((l) => {
    const own = submissions.filter((s) => s.studentId === l.child.id);
    return {
      id: l.child.id,
      name: l.child.name,
      stats: {
        pending: own.filter((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT').length,
        submitted: own.filter((s) => s.status === 'SUBMITTED').length,
        graded: own.filter((s) => s.status === 'GRADED').length,
        overdue: own.filter(
          (s) =>
            (s.status === 'NOT_STARTED' || s.status === 'DRAFT') &&
            s.lesson.dueAt && new Date(s.lesson.dueAt).getTime() < now
        ).length,
      },
      recent: own.slice(0, 10).map((s) => ({
        submissionId: s.id,
        lessonTitle: s.lesson.title,
        className: s.lesson.topic.class.name,
        topicTitle: s.lesson.topic.title,
        status: s.status,
        grade: s.grade,
        dueAt: s.lesson.dueAt?.toISOString() ?? null,
      })),
    };
  });

  return <ParentDashboard children={children} />;
}
