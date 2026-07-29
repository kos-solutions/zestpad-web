import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, handleError } from '@/lib/auth';
import { generateLinkCode } from '@/lib/codes';

/** Codul pe care elevul il da parintelui. */
export async function GET() {
  try {
    const session = await requireRole('STUDENT');
    let user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { linkCode: true },
    });

    // Conturi create inainte de introducerea codului.
    if (!user.linkCode) {
      const code = generateLinkCode();
      user = await prisma.user.update({
        where: { id: session.userId }, data: { linkCode: code }, select: { linkCode: true },
      });
    }

    const parents = await prisma.parentChild.findMany({
      where: { childId: session.userId },
      select: { parent: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      linkCode: user.linkCode,
      parents: parents.map((p) => p.parent),
    });
  } catch (err) {
    return handleError(err);
  }
}
