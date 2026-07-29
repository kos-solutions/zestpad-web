import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError, HttpError } from '@/lib/auth';
import { assertSubmissionAccess } from '@/lib/access';
import { contentSchema } from '@/lib/validation';

/** Elevul preda tema. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const access = await assertSubmissionAccess(session, id);
    if (!access.isOwner) throw new HttpError(403, 'Doar elevul isi poate preda tema.');

    const current = await prisma.submission.findUniqueOrThrow({
      where: { id }, select: { status: true, content: true },
    });
    if (current.status === 'SUBMITTED' || current.status === 'GRADED') {
      throw new HttpError(409, 'Tema a fost deja predata.');
    }

    // Continutul poate veni odata cu predarea (ultima salvare + predare intr-un pas).
    let content = current.content;
    try {
      const body = await req.json();
      const parsed = contentSchema.partial().parse(body);
      if (parsed.content) content = parsed.content;
    } catch {
      // fara body — folosim ce e deja salvat
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: { content, status: 'SUBMITTED', submittedAt: new Date() },
      select: { id: true, status: true, submittedAt: true },
    });

    return NextResponse.json({ submission: updated });
  } catch (err) {
    return handleError(err);
  }
}
