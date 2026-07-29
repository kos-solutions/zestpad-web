import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ClassView } from '@/components/ClassView';

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const cls = await prisma.class.findUnique({
    where: { id },
    select: {
      id: true, name: true, code: true, teacherId: true,
      teacher: { select: { name: true } },
      topics: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, background: true, _count: { select: { lessons: true } } },
      },
      enrollments: { select: { studentId: true, student: { select: { id: true, name: true } } } },
    },
  });
  if (!cls) notFound();

  const isTeacher = cls.teacherId === session.userId;
  const isStudent = cls.enrollments.some((e) => e.studentId === session.userId);
  if (!isTeacher && !isStudent) notFound();

  return (
    <ClassView
      cls={{
        id: cls.id,
        name: cls.name,
        code: isTeacher ? cls.code : null,
        teacherName: cls.teacher.name,
        topics: cls.topics.map((t) => ({
          id: t.id, title: t.title, background: t.background, lessonCount: t._count.lessons,
        })),
        students: isTeacher ? cls.enrollments.map((e) => e.student) : [],
        isTeacher,
      }}
    />
  );
}
