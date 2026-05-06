-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassAttendanceDaily" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAttendanceDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassAttendanceDaily_classId_email_day_key" ON "ClassAttendanceDaily"("classId", "email", "day");
CREATE INDEX IF NOT EXISTS "ClassAttendanceDaily_classId_idx" ON "ClassAttendanceDaily"("classId");
CREATE INDEX IF NOT EXISTS "ClassAttendanceDaily_email_idx" ON "ClassAttendanceDaily"("email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClassAttendanceDaily_classId_fkey'
  ) THEN
    ALTER TABLE "ClassAttendanceDaily" ADD CONSTRAINT "ClassAttendanceDaily_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
