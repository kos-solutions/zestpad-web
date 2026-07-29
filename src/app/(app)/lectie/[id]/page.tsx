import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { LessonView } from '@/components/LessonView';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: {
      id: true, title: true, type: true, content: true, published: true,
      dueAt: true, liveUntil: true, updatedAt: true,
      topic: {
        select: {
          id: true, title: true, background: true,
          class: {
            select: { id: true, name: true, teacherId: true, enrollments: { select: { studentId: true } } },
          },
        },
      },
    },
  });
  if (!lesson) notFound();

  const isTeacher = lesson.topic.class.teacherId === session.userId;
  const isStudent = lesson.topic.class.enrollments.some((e) => e.studentId === session.userId);
  if (!isTeacher && !isStudent) notFound();
  if (!isTeacher && !lesson.published) notFound();

  // Elevul la o tema lucreaza pe propria lucrare, nu pe lectie.
  if (!isTeacher && lesson.type === 'HOMEWORK') {
    const sub = await prisma.submission.upsert({
      where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
      create: { lessonId: id, studentId: session.userId },
      update: {},
      select: { id: true },
    });
    redirect(`/tema/${sub.id}`);
  }

  // Notitele proprii ale elevului peste lectia de teorie.
  let myNotes = '';
  if (!isTeacher) {
    const note = await prisma.lessonNote.findUnique({
      where: { lessonId_studentId: { lessonId: id, studentId: session.userId } },
      select: { content: true },
    });
    myNotes = note?.content ?? '';
  }

  const stats = isTeacher && lesson.type === 'HOMEWORK'
    ? await prisma.submission.groupBy({ by: ['status'], where: { lessonId: id }, _count: true })
    : [];

  return (
    <LessonView
      lesson={{
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        content: lesson.content,
        published: lesson.published,
        dueAt: lesson.dueAt?.toISOString() ?? null,
        liveUntil: lesson.liveUntil?.toISOString() ?? null,
        version: lesson.updatedAt.getTime(),
        topicId: lesson.topic.id,
        topicTitle: lesson.topic.title,
        background: lesson.topic.background,
        className: lesson.topic.class.name,
        isTeacher,
      }}
      myNotes={myNotes}
      stats={{
        submitted: stats.find((s) => s.status === 'SUBMITTED')?._count ?? 0,
        graded: stats.find((s) => s.status === 'GRADED')?._count ?? 0,
        total: stats.reduce((a, s) => a + s._count, 0),
      }}
    />
  );
}
