import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { StatusChip, EmptyState, Progress } from '@/components/ui';

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
  const graded  = submissions.filter((s) => s.status === 'GRADED');
  const notDone = submissions.filter((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT');

  return (
    <div className="space-y-7">
      <div>
        <Link href={`/lectie/${lesson.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition hover:text-ink-900">
          <span aria-hidden>←</span> {lesson.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Lucrări</h1>
        <p className="mt-1 text-[15px] text-ink-500">
          {lesson.topic.class.name} · {lesson.topic.title}
          {lesson.dueAt && ` · termen ${new Date(lesson.dueAt).toLocaleDateString('ro-RO')}`}
        </p>
      </div>

      {submissions.length > 0 && (
        <div className="card p-5">
          <Progress value={graded.length} total={submissions.length} tone="emerald" />
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              { label: 'De corectat', value: pending.length, cls: 'text-zest-700' },
              { label: 'Corectate',   value: graded.length,  cls: 'text-emerald-700' },
              { label: 'Nepredate',   value: notDone.length, cls: 'text-ink-500' },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-[12px] text-ink-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {submissions.length === 0 ? (
        <EmptyState title="Niciun elev încă"
          hint="Publică tema, iar elevii înscriși primesc automat câte o copie." />
      ) : (
        <div className="space-y-2.5">
          {[...pending, ...graded, ...notDone].map((s) => {
            const clickable = s.status !== 'NOT_STARTED';
            const inner = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-bold text-ink-600">
                  {s.student.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{s.student.name}</p>
                  {s.submittedAt && (
                    <p className="text-[12px] text-ink-500">
                      Predat {new Date(s.submittedAt).toLocaleDateString('ro-RO')}
                    </p>
                  )}
                </div>
                <StatusChip status={s.status} grade={s.grade} />
              </>
            );
            return clickable ? (
              <Link key={s.id} href={`/tema/${s.id}`} className="card-hover flex items-center gap-4 px-5 py-4">
                {inner}
              </Link>
            ) : (
              <div key={s.id} className="card flex items-center gap-4 px-5 py-4 opacity-55">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
