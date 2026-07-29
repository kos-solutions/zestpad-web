import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TeacherDashboard } from '@/components/TeacherDashboard';
import { StudentDashboard } from '@/components/StudentDashboard';

export default async function PanouPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'PARENT') redirect('/parinte');

  if (session.role === 'TEACHER') {
    const classes = await prisma.class.findMany({
      where: { teacherId: session.userId, archived: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, code: true,
        _count: { select: { enrollments: true, topics: true } },
      },
    });

    const toReview = await prisma.submission.count({
      where: { status: 'SUBMITTED', lesson: { topic: { class: { teacherId: session.userId } } } },
    });

    return <TeacherDashboard initialClasses={classes} toReview={toReview} />;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.userId, class: { archived: false } },
    orderBy: { createdAt: 'desc' },
    select: {
      class: {
        select: {
          id: true, name: true,
          teacher: { select: { name: true } },
          _count: { select: { topics: true } },
        },
      },
    },
  });

  const homework = await prisma.submission.findMany({
    where: {
      studentId: session.userId,
      status: { in: ['NOT_STARTED', 'DRAFT'] },
      lesson: { type: 'HOMEWORK', published: true },
    },
    orderBy: [{ lesson: { dueAt: 'asc' } }],
    take: 10,
    select: {
      id: true, status: true,
      lesson: {
        select: {
          id: true, title: true, dueAt: true,
          topic: { select: { title: true, class: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <StudentDashboard
      classes={enrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name,
        teacherName: e.class.teacher.name,
        topicCount: e.class._count.topics,
      }))}
      homework={homework.map((h) => ({
        submissionId: h.id,
        status: h.status,
        lessonTitle: h.lesson.title,
        topicTitle: h.lesson.topic.title,
        className: h.lesson.topic.class.name,
        dueAt: h.lesson.dueAt?.toISOString() ?? null,
      }))}
    />
  );
}
