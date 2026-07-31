-- CreateTable
CREATE TABLE "LessonPresence" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPresence_lastSeenAt_idx" ON "LessonPresence"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPresence_lessonId_studentId_key" ON "LessonPresence"("lessonId", "studentId");

-- AddForeignKey
ALTER TABLE "LessonPresence" ADD CONSTRAINT "LessonPresence_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPresence" ADD CONSTRAINT "LessonPresence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

