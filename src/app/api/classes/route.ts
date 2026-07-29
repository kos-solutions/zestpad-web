import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireRole, handleError, HttpError } from '@/lib/auth';
import { createClassSchema } from '@/lib/validation';
import { generateCode } from '@/lib/codes';

/** Clasele mele: predate (profesor) sau la care sunt inscris (elev). */
export async function GET() {
  try {
    const session = await requireUser();

    if (session.role === 'TEACHER') {
      const classes = await prisma.class.findMany({
        where: { teacherId: session.userId, archived: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, code: true, createdAt: true,
          _count: { select: { enrollments: true, topics: true } },
        },
      });
      return NextResponse.json({ classes: classes.map((c) => ({ ...c, role: 'TEACHER' as const })) });
    }

    if (session.role === 'STUDENT') {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: session.userId, class: { archived: false } },
        orderBy: { createdAt: 'desc' },
        select: {
          class: {
            select: {
              id: true, name: true, code: true, createdAt: true,
              teacher: { select: { name: true } },
              _count: { select: { enrollments: true, topics: true } },
            },
          },
        },
      });
      return NextResponse.json({
        classes: enrollments.map((e) => ({
          ...e.class, code: undefined, teacherName: e.class.teacher.name, role: 'STUDENT' as const,
        })),
      });
    }

    // Parintii nu au clase proprii — vad prin copii.
    return NextResponse.json({ classes: [] });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole('TEACHER');
    const body = createClassSchema.parse(await req.json());

    // Retry pe coliziune de cod (extrem de improbabil, dar codul e unic).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode(6);
      const taken = await prisma.class.findUnique({ where: { code }, select: { id: true } });
      if (taken) continue;

      const created = await prisma.class.create({
        data: { name: body.name, code, teacherId: session.userId },
        select: { id: true, name: true, code: true, createdAt: true },
      });
      return NextResponse.json({ class: created }, { status: 201 });
    }
    throw new HttpError(500, 'Nu am putut genera un cod unic. Incearca din nou.');
  } catch (err) {
    return handleError(err);
  }
}
