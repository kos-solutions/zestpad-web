/**
 * Reguli de acces pe resurse. In codul vechi lipseau complet:
 * orice utilizator logat putea crea/citi continut din orice clasa.
 */
import { prisma } from './prisma';
import { HttpError } from './auth';
import type { SessionPayload } from './session';

/** Profesorul detine clasa? Arunca 403/404 altfel. */
export async function assertClassOwner(session: SessionPayload, classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
  if (!cls) throw new HttpError(404, 'Clasa nu exista.');
  if (cls.teacherId !== session.userId) throw new HttpError(403, 'Nu esti profesorul acestei clase.');
  return cls;
}

/** Utilizatorul poate *vedea* clasa: profesorul ei sau un elev inscris. */
export async function assertClassMember(session: SessionPayload, classId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true, enrollments: { where: { studentId: session.userId }, select: { id: true } } },
  });
  if (!cls) throw new HttpError(404, 'Clasa nu exista.');
  const isTeacher = cls.teacherId === session.userId;
  const isStudent = cls.enrollments.length > 0;
  if (!isTeacher && !isStudent) throw new HttpError(403, 'Nu ai acces la aceasta clasa.');
  return { isTeacher, isStudent };
}

export async function assertTopicOwner(session: SessionPayload, topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { classId: true, class: { select: { teacherId: true } } },
  });
  if (!topic) throw new HttpError(404, 'Folderul nu exista.');
  if (topic.class.teacherId !== session.userId) throw new HttpError(403, 'Nu esti profesorul acestei clase.');
  return topic;
}

export async function assertTopicMember(session: SessionPayload, topicId: string) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { classId: true } });
  if (!topic) throw new HttpError(404, 'Folderul nu exista.');
  const membership = await assertClassMember(session, topic.classId);
  return { ...membership, classId: topic.classId };
}

export async function assertLessonOwner(session: SessionPayload, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { topicId: true, topic: { select: { classId: true, class: { select: { teacherId: true } } } } },
  });
  if (!lesson) throw new HttpError(404, 'Lectia nu exista.');
  if (lesson.topic.class.teacherId !== session.userId) {
    throw new HttpError(403, 'Nu esti profesorul acestei clase.');
  }
  return { classId: lesson.topic.classId };
}

export async function assertLessonMember(session: SessionPayload, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { published: true, topic: { select: { classId: true } } },
  });
  if (!lesson) throw new HttpError(404, 'Lectia nu exista.');
  const membership = await assertClassMember(session, lesson.topic.classId);
  // Elevii nu vad lectiile nepublicate
  if (!membership.isTeacher && !lesson.published) {
    throw new HttpError(404, 'Lectia nu exista.');
  }
  return { ...membership, classId: lesson.topic.classId };
}

/**
 * Cine poate vedea o lucrare: elevul care a scris-o, profesorul clasei,
 * sau un parinte legat de acel elev.
 */
export async function assertSubmissionAccess(session: SessionPayload, submissionId: string) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      studentId: true,
      lesson: { select: { topic: { select: { class: { select: { teacherId: true } } } } } },
    },
  });
  if (!sub) throw new HttpError(404, 'Lucrarea nu exista.');

  const isOwner = sub.studentId === session.userId;
  const isTeacher = sub.lesson.topic.class.teacherId === session.userId;
  let isParent = false;

  if (!isOwner && !isTeacher && session.role === 'PARENT') {
    const link = await prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: session.userId, childId: sub.studentId } },
      select: { id: true },
    });
    isParent = !!link;
  }

  if (!isOwner && !isTeacher && !isParent) throw new HttpError(403, 'Nu ai acces la aceasta lucrare.');
  return { isOwner, isTeacher, isParent, studentId: sub.studentId };
}

/** Parintele are legatura cu acest copil? */
export async function assertParentOf(session: SessionPayload, childId: string) {
  if (session.role !== 'PARENT') throw new HttpError(403, 'Doar parintii pot accesa aceasta resursa.');
  const link = await prisma.parentChild.findUnique({
    where: { parentId_childId: { parentId: session.userId, childId } },
    select: { id: true },
  });
  if (!link) throw new HttpError(403, 'Nu esti asociat cu acest elev.');
}
