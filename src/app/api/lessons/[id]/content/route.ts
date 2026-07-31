import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, handleError } from '@/lib/auth';
import { assertLessonOwner } from '@/lib/access';
import { contentSchema } from '@/lib/validation';
import { countStrokes } from '@/lib/deltas';

/** Salvarea scrisului profesorului pe lectie. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await assertLessonOwner(session, id);
    const { content } = contentSchema.parse(await req.json());

    // Numaram o singura data, la scriere, ca sa nu parsam JSON-ul la fiecare
    // verificare de versiune facuta de zeci de elevi.
    await prisma.lesson.update({
      where: { id },
      data: { content, strokeCount: countStrokes(content) },
    });

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
