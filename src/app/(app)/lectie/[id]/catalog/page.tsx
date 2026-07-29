import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { StatusChip, EmptyState } from '@/components/ui';

export default async function CatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: {
      id: true, title: true, type: true, dueAt: true,
      topic: { select: { id: true, title: true, class: { select: { name: true, teacherId: true } } } },
    },
  });
  if (!lesson || lesson.topic.class.teacherId !== session.userId) notFound();

  const submissions = await prisma.submission.findMany({
    where: { lessonId: id },
    orderBy: [{ status: 'desc' }, { submittedAt: 'asc' }],
    select: {
      id: true, status: true, grade: true, submittedAt: true,
      student: { select: { id: true, name: true } },
    },
  });

  const pending = submissions.filter((s) => s.status === 'SUBMITTED');
  const graded = submissions.filter((s) => s.status === 'GRADED');
  const notDone = submissions.filter((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT');

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/lectie/${lesson.id}`} className="text-sm text-ink-500 hover:text-ink-800">
          ← {lesson.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Lucrări</h1>
        <p className="text-sm text-ink-500">
          {lesson.topic.class.name} · {lesson.topic.title}
          {lesson.dueAt && ` · termen ${new Date(lesson.dueAt).toLocaleDateString('ro-RO')}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'De corectat', value: pending.length, cls: 'text-zest-700' },
          { label: 'Corectate', value: graded.length, cls: 'text-green-700' },
          { label: 'Nepredate', value: notDone.length, cls: 'text-ink-500' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="Niciun elev încă"
          hint="Publică tema, iar elevii înscriși vor primi automat câte o copie."
        />
      ) : (
        <div className="space-y-2">
          {[...pending, ...graded, ...notDone].map((s) => {
            const clickable = s.status !== 'NOT_STARTED';
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{s.student.name}</p>
                  {s.submittedAt && (
                    <p className="text-xs text-ink-500">
                      Predat {new Date(s.submittedAt).toLocaleDateString('ro-RO')}
                    </p>
                  )}
                </div>
                <StatusChip status={s.status} grade={s.grade} />
              </>
            );
            return clickable ? (
              <Link
                key={s.id} href={`/tema/${s.id}`}
                className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
              >
                {inner}
              </Link>
            ) : (
              <div key={s.id} className="card flex items-center justify-between gap-4 p-4 opacity-60">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
