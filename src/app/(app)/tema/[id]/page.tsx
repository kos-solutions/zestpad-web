import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SubmissionView } from '@/components/SubmissionView';

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const sub = await prisma.submission.findUnique({
    where: { id },
    select: {
      id: true, status: true, content: true, feedback: true, grade: true, comment: true,
      submittedAt: true, gradedAt: true, studentId: true,
      student: { select: { name: true } },
      lesson: {
        select: {
          id: true, title: true, content: true, dueAt: true,
          topic: {
            select: {
              id: true, title: true, background: true,
              class: { select: { name: true, teacherId: true } },
            },
          },
        },
      },
    },
  });
  if (!sub) notFound();

  const isOwner = sub.studentId === session.userId;
  const isTeacher = sub.lesson.topic.class.teacherId === session.userId;
  let isParent = false;
  if (!isOwner && !isTeacher && session.role === 'PARENT') {
    isParent = !!(await prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: session.userId, childId: sub.studentId } },
      select: { id: true },
    }));
  }
  if (!isOwner && !isTeacher && !isParent) notFound();

  return (
    <SubmissionView
      submission={{
        id: sub.id,
        status: sub.status,
        content: sub.content,
        feedback: sub.feedback,
        grade: sub.grade,
        comment: sub.comment,
        submittedAt: sub.submittedAt?.toISOString() ?? null,
        gradedAt: sub.gradedAt?.toISOString() ?? null,
        studentName: sub.student.name,
      }}
      lesson={{
        id: sub.lesson.id,
        title: sub.lesson.title,
        prompt: sub.lesson.content,
        dueAt: sub.lesson.dueAt?.toISOString() ?? null,
        topicId: sub.lesson.topic.id,
        topicTitle: sub.lesson.topic.title,
        background: sub.lesson.topic.background,
        className: sub.lesson.topic.class.name,
      }}
      role={{ isOwner, isTeacher, isParent }}
    />
  );
}
