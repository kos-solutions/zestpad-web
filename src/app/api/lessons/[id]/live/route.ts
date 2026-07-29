import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonOwner } from '@/lib/access';
import { z } from 'zod';

const schema = z.object({ live: z.boolean() });

/** Durata unei ore. Expira singur, ca sa nu ramana pornit peste noapte. */
const SESSION_MINUTES = 60;

/**
 * Profesorul porneste/opreste predarea live.
 * Cat timp e pornita, tabletele elevilor verifica actualizari; in rest, deloc.
 * Asta tine traficul aproape de zero in afara orelor.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);
    const { live } = schema.parse(await req.json());

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        liveUntil: live ? new Date(Date.now() + SESSION_MINUTES * 60_000) : null,
        // pornirea predarii publica automat lectia, altfel elevii n-o vad
        ...(live ? { published: true } : {}),
      },
      select: { id: true, liveUntil: true, published: true },
    });

    return NextResponse.json({
      live: !!lesson.liveUntil && lesson.liveUntil.getTime() > Date.now(),
      liveUntil: lesson.liveUntil,
      published: lesson.published,
    });
  } catch (err) {
    return handleError(err);
  }
}
