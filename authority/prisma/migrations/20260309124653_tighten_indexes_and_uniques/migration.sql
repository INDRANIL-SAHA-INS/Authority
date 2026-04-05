/*
  Warnings:

  - Made the column `semester_number` on table `attendance_summary` required. This step will fail if there are existing NULL values in that column.
  - Made the column `semester_number` on table `program_semester_subjects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `academic_year` on table `teacher_subject_assignments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `day_of_week` on table `timetables` required. This step will fail if there are existing NULL values in that column.
  - Made the column `academic_year` on table `timetables` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "attendance_summary" ALTER COLUMN "semester_number" SET NOT NULL;

-- AlterTable
ALTER TABLE "program_semester_subjects" ALTER COLUMN "semester_number" SET NOT NULL;

-- AlterTable
ALTER TABLE "teacher_subject_assignments" ALTER COLUMN "academic_year" SET NOT NULL;

-- AlterTable
ALTER TABLE "timetables" ALTER COLUMN "day_of_week" SET NOT NULL,
ALTER COLUMN "academic_year" SET NOT NULL;

-- CreateIndex
CREATE INDEX "attendance_sessions_subject_id_session_date_idx" ON "attendance_sessions"("subject_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_summary_subject_id_semester_number_idx" ON "attendance_summary"("subject_id", "semester_number");

-- CreateIndex
CREATE INDEX "batches_batch_advisor_id_idx" ON "batches"("batch_advisor_id");

-- CreateIndex
CREATE INDEX "program_semester_subjects_subject_id_idx" ON "program_semester_subjects"("subject_id");

-- CreateIndex
CREATE INDEX "programs_program_coordinator_id_idx" ON "programs"("program_coordinator_id");

-- CreateIndex
CREATE INDEX "sections_class_teacher_id_idx" ON "sections"("class_teacher_id");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_subject_id_academic_year_idx" ON "teacher_subject_assignments"("subject_id", "academic_year");

-- CreateIndex
CREATE INDEX "timetables_section_id_academic_year_idx" ON "timetables"("section_id", "academic_year");

-- CreateIndex
CREATE INDEX "timetables_subject_id_academic_year_idx" ON "timetables"("subject_id", "academic_year");
