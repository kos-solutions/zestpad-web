import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError, HttpError } from '@/lib/auth';
import { assertSubmissionAccess } from '@/lib/access';
import { contentSchema } from '@/lib/validation';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const access = await assertSubmissionAccess(session, id);

    const submission = await prisma.submission.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, status: true, content: true, feedback: true, grade: true, comment: true,
        submittedAt: true, gradedAt: true,
        student: { select: { id: true, name: true } },
        lesson: {
          select: {
            id: true, title: true, type: true, content: true, dueAt: true,
            topic: {
              select: {
                id: true, title: true, background: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ submission, access });
  } catch (err) {
    return handleError(err);
  }
}

/** Elevul isi salveaza ciorna. Dupa predare nu mai poate modifica. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const access = await assertSubmissionAccess(session, id);
    if (!access.isOwner) throw new HttpError(403, 'Doar elevul isi poate edita lucrarea.');

    const current = await prisma.submission.findUniqueOrThrow({
      where: { id }, select: { status: true },
    });
    if (current.status === 'SUBMITTED' || current.status === 'GRADED') {
      throw new HttpError(409, 'Tema a fost deja predata si nu mai poate fi modificata.');
    }

    const { content } = contentSchema.parse(await req.json());
    await prisma.submission.update({
      where: { id },
      data: { content, status: 'DRAFT' },
    });

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
