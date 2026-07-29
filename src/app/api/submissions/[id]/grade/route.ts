import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError, HttpError } from '@/lib/auth';
import { assertSubmissionAccess } from '@/lib/access';
import { gradeSchema } from '@/lib/validation';

/**
 * Profesorul corecteaza. `feedback` e un strat separat de trasee, desenat
 * peste lucrarea elevului — nu suprascrie ce a scris elevul.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const access = await assertSubmissionAccess(session, id);
    if (!access.isTeacher) throw new HttpError(403, 'Doar profesorul poate corecta.');

    const body = gradeSchema.parse(await req.json());

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        ...(body.feedback !== undefined ? { feedback: body.feedback } : {}),
        ...(body.grade !== undefined ? { grade: body.grade } : {}),
        ...(body.comment !== undefined ? { comment: body.comment } : {}),
        status: 'GRADED',
        gradedAt: new Date(),
        graderId: session.userId,
      },
      select: { id: true, status: true, grade: true, comment: true, gradedAt: true },
    });

    return NextResponse.json({ submission: updated });
  } catch (err) {
    return handleError(err);
  }
}

/** Salvare intermediara a corecturii, fara a marca drept corectata. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const access = await assertSubmissionAccess(session, id);
    if (!access.isTeacher) throw new HttpError(403, 'Doar profesorul poate corecta.');

    const body = gradeSchema.parse(await req.json());
    await prisma.submission.update({
      where: { id },
      data: { ...(body.feedback !== undefined ? { feedback: body.feedback } : {}) },
    });
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
