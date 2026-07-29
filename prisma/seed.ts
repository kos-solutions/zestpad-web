/**
 * Date demo pentru testare rapida.
 * Ruleaza cu: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PAROLA = 'zestpad123';

function stroke(id: string, pts: [number, number, number][], color = '#1a1a1a', size = 3) {
  return { id, color, size, points: pts };
}

function demoDrawing(seed: number, color = '#1a1a1a') {
  const strokes = [];
  for (let i = 0; i < 6; i++) {
    const y = 220 + i * 90;
    const x = 140 + ((seed * 17 + i * 31) % 120);
    strokes.push(
      stroke(`s${seed}-${i}`, [
        [x, y, 0.35], [x + 60, y - 25, 0.75], [x + 130, y + 12, 0.6], [x + 200, y - 8, 0.4],
      ], color)
    );
  }
  return JSON.stringify({ v: 1, width: 1240, height: 1754, strokes });
}

async function main() {
  console.log('Sterg datele demo existente…');
  await prisma.user.deleteMany({ where: { email: { endsWith: '@zestpad.demo' } } });

  const hash = await bcrypt.hash(PAROLA, 12);

  const teacher = await prisma.user.create({
    data: { name: 'Elena Ionescu', email: 'profesor@zestpad.demo', passwordHash: hash, role: 'TEACHER' },
  });

  const andrei = await prisma.user.create({
    data: { name: 'Andrei Popescu', email: 'elev@zestpad.demo', passwordHash: hash, role: 'STUDENT', linkCode: 'DEMO2345' },
  });
  const maria = await prisma.user.create({
    data: { name: 'Maria Dumitru', email: 'elev2@zestpad.demo', passwordHash: hash, role: 'STUDENT', linkCode: 'DEMO6789' },
  });

  const parent = await prisma.user.create({
    data: { name: 'Cristina Popescu', email: 'parinte@zestpad.demo', passwordHash: hash, role: 'PARENT' },
  });
  await prisma.parentChild.create({ data: { parentId: parent.id, childId: andrei.id } });

  const cls = await prisma.class.create({
    data: { name: 'Matematică — a 5-a B', code: 'MAT5B7', teacherId: teacher.id },
  });
  await prisma.enrollment.createMany({
    data: [{ classId: cls.id, studentId: andrei.id }, { classId: cls.id, studentId: maria.id }],
  });

  const algebra = await prisma.topic.create({
    data: { title: 'Cap. 1 — Ecuații', background: 'MATH', classId: cls.id, position: 0 },
  });
  const compuneri = await prisma.topic.create({
    data: { title: 'Cap. 2 — Probleme cu text', background: 'DICTANDO', classId: cls.id, position: 1 },
  });

  const lectie = await prisma.lesson.create({
    data: {
      title: 'Ecuații de gradul I', type: 'THEORY', topicId: algebra.id,
      content: demoDrawing(1), published: true, position: 0,
    },
  });

  const tema = await prisma.lesson.create({
    data: {
      title: 'Temă — 10 exerciții', type: 'HOMEWORK', topicId: algebra.id,
      content: demoDrawing(2), published: true, position: 1,
      dueAt: new Date(Date.now() + 5 * 864e5),
    },
  });

  await prisma.lesson.create({
    data: {
      title: 'Temă — problema trenurilor', type: 'HOMEWORK', topicId: compuneri.id,
      published: true, position: 0, dueAt: new Date(Date.now() - 2 * 864e5),
    },
  });

  // Andrei a predat si a fost notat; Maria a inceput dar nu a predat.
  await prisma.submission.create({
    data: {
      lessonId: tema.id, studentId: andrei.id, status: 'GRADED',
      content: demoDrawing(3), feedback: demoDrawing(9, '#dc2626'),
      grade: '9', comment: 'Foarte bine. Atenție la semnul minus la ex. 7.',
      submittedAt: new Date(Date.now() - 864e5), gradedAt: new Date(), graderId: teacher.id,
    },
  });
  await prisma.submission.create({
    data: { lessonId: tema.id, studentId: maria.id, status: 'DRAFT', content: demoDrawing(4) },
  });

  const restul = await prisma.lesson.findMany({
    where: { type: 'HOMEWORK', published: true, topic: { classId: cls.id } },
    select: { id: true },
  });
  await prisma.submission.createMany({
    data: restul.flatMap((l) => [
      { lessonId: l.id, studentId: andrei.id },
      { lessonId: l.id, studentId: maria.id },
    ]),
    skipDuplicates: true,
  });

  console.log(`
Date demo create. Parola pentru toate conturile: ${PAROLA}

  Profesor  profesor@zestpad.demo
  Elev      elev@zestpad.demo        (cod parinte: DEMO2345)
  Elev 2    elev2@zestpad.demo
  Parinte   parinte@zestpad.demo     (deja legat de Andrei)

  Cod clasa pentru inscriere: MAT5B7
`);
  void lectie;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
