import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { TopicView } from '@/components/TopicView';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id },
    select: {
      id: true, title: true, background: true,
      class: {
        select: {
          id: true, name: true, teacherId: true,
          enrollments: { select: { studentId: true } },
        },
      },
    },
  });
  if (!topic) notFound();

  const isTeacher = topic.class.teacherId === session.userId;
  const isStudent = topic.class.enrollments.some((e) => e.studentId === session.userId);
  if (!isTeacher && !isStudent) notFound();

  const lessons = await prisma.lesson.findMany({
    where: { topicId: id, ...(isTeacher ? {} : { published: true }) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, title: true, type: true, published: true, dueAt: true, liveUntil: true,
      submissions: isTeacher
        ? { select: { status: true } }
        : { where: { studentId: session.userId }, select: { id: true, status: true, grade: true } },
    },
  });

  return (
    <TopicView
      topic={{
        id: topic.id,
        title: topic.title,
        background: topic.background,
        className: topic.class.name,
        classId: topic.class.id,
        isTeacher,
      }}
      lessons={lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        published: l.published,
        dueAt: l.dueAt?.toISOString() ?? null,
        live: !!l.liveUntil && l.liveUntil.getTime() > Date.now(),
        pendingReview: isTeacher
          ? l.submissions.filter((s) => s.status === 'SUBMITTED').length
          : 0,
        totalSubmissions: isTeacher ? l.submissions.length : 0,
        mySubmission: isTeacher ? null : (l.submissions[0] as { id: string; status: string; grade: string | null } | undefined) ?? null,
      }))}
    />
  );
}
