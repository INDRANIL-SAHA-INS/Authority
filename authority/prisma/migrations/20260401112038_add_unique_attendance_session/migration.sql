/*
  Warnings:

  - A unique constraint covering the columns `[timetable_id,session_date]` on the table `attendance_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "attendance_sessions_timetable_id_session_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_timetable_id_session_date_key" ON "attendance_sessions"("timetable_id", "session_date");
