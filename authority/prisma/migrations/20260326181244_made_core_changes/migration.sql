/*
  Warnings:

  - You are about to drop the column `semester_number` on the `attendance_summary` table. All the data in the column will be lost.
  - You are about to drop the column `academic_regulation` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `batch_advisor_id` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `room_type` on the `classrooms` table. All the data in the column will be lost.
  - You are about to drop the column `class_teacher_id` on the `sections` table. All the data in the column will be lost.
  - You are about to drop the column `current_semester` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `subjects` table. All the data in the column will be lost.
  - You are about to drop the column `academic_year` on the `teacher_subject_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `semester_number` on the `teacher_subject_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `academic_year` on the `timetables` table. All the data in the column will be lost.
  - You are about to drop the column `semester_number` on the `timetables` table. All the data in the column will be lost.
  - You are about to drop the `program_semester_subjects` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[student_id,subject_id,period_id]` on the table `attendance_summary` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teacher_id,subject_id,batch_id,section_id,period_id]` on the table `teacher_subject_assignments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[section_id,day_of_week,time_slot_id,period_id]` on the table `timetables` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teacher_id,day_of_week,time_slot_id,period_id]` on the table `timetables` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classroom_id,day_of_week,time_slot_id,period_id]` on the table `timetables` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `period_id` to the `attendance_summary` table without a default value. This is not possible if the table is not empty.
  - Added the required column `program_id` to the `subjects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_id` to the `teacher_subject_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_id` to the `timetables` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_batch_advisor_id_fkey";

-- DropForeignKey
ALTER TABLE "program_semester_subjects" DROP CONSTRAINT "program_semester_subjects_program_id_fkey";

-- DropForeignKey
ALTER TABLE "program_semester_subjects" DROP CONSTRAINT "program_semester_subjects_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_class_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_department_id_fkey";

-- DropIndex
DROP INDEX "attendance_summary_student_id_semester_number_idx";

-- DropIndex
DROP INDEX "attendance_summary_student_id_subject_id_semester_number_key";

-- DropIndex
DROP INDEX "attendance_summary_subject_id_semester_number_idx";

-- DropIndex
DROP INDEX "batches_batch_advisor_id_idx";

-- DropIndex
DROP INDEX "sections_class_teacher_id_idx";

-- DropIndex
DROP INDEX "subjects_department_id_idx";

-- DropIndex
DROP INDEX "teacher_subject_assignments_batch_id_section_id_semester_nu_idx";

-- DropIndex
DROP INDEX "teacher_subject_assignments_subject_id_academic_year_idx";

-- DropIndex
DROP INDEX "teacher_subject_assignments_teacher_id_academic_year_idx";

-- DropIndex
DROP INDEX "teacher_subject_assignments_teacher_id_subject_id_batch_id__key";

-- DropIndex
DROP INDEX "timetables_batch_id_semester_number_academic_year_idx";

-- DropIndex
DROP INDEX "timetables_classroom_id_day_of_week_time_slot_id_academic_y_key";

-- DropIndex
DROP INDEX "timetables_section_id_academic_year_idx";

-- DropIndex
DROP INDEX "timetables_section_id_day_of_week_time_slot_id_academic_yea_key";

-- DropIndex
DROP INDEX "timetables_subject_id_academic_year_idx";

-- DropIndex
DROP INDEX "timetables_teacher_id_academic_year_idx";

-- DropIndex
DROP INDEX "timetables_teacher_id_day_of_week_time_slot_id_academic_yea_key";

-- AlterTable
ALTER TABLE "attendance_summary" DROP COLUMN "semester_number",
ADD COLUMN     "period_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "academic_regulation",
DROP COLUMN "batch_advisor_id",
ADD COLUMN     "period_id" BIGINT;

-- AlterTable
ALTER TABLE "classrooms" DROP COLUMN "room_type";

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "class_teacher_id";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "current_semester",
ADD COLUMN     "has_backlogs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "department_id",
ADD COLUMN     "program_id" BIGINT NOT NULL,
ADD COLUMN     "semester_number" INTEGER,
ADD COLUMN     "subject_category" TEXT,
ADD COLUMN     "subject_order" INTEGER;

-- AlterTable
ALTER TABLE "teacher_subject_assignments" DROP COLUMN "academic_year",
DROP COLUMN "semester_number",
ADD COLUMN     "period_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "timetables" DROP COLUMN "academic_year",
DROP COLUMN "semester_number",
ADD COLUMN     "period_id" BIGINT NOT NULL;

-- DropTable
DROP TABLE "program_semester_subjects";

-- CreateTable
CREATE TABLE "student_backlogs" (
    "backlog_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cleared_in_semester" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_backlogs_pkey" PRIMARY KEY ("backlog_id")
);

-- CreateTable
CREATE TABLE "subject_enrollments" (
    "enrollment_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "period_id" BIGINT NOT NULL,
    "status" TEXT DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "exams" (
    "exam_id" BIGSERIAL NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "period_id" BIGINT NOT NULL,
    "exam_type" TEXT NOT NULL,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "passing_marks" DOUBLE PRECISION NOT NULL,
    "exam_date" TIMESTAMP(3),
    "status" TEXT DEFAULT 'HIDDEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("exam_id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "result_id" BIGSERIAL NOT NULL,
    "exam_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "marks_obtained" DOUBLE PRECISION,
    "is_absent" BOOLEAN NOT NULL DEFAULT false,
    "is_pass" BOOLEAN,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "academic_periods" (
    "period_id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("period_id")
);

-- CreateIndex
CREATE INDEX "student_backlogs_student_id_status_idx" ON "student_backlogs"("student_id", "status");

-- CreateIndex
CREATE INDEX "student_backlogs_subject_id_idx" ON "student_backlogs"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_backlogs_student_id_subject_id_attempt_number_key" ON "student_backlogs"("student_id", "subject_id", "attempt_number");

-- CreateIndex
CREATE INDEX "subject_enrollments_student_id_period_id_idx" ON "subject_enrollments"("student_id", "period_id");

-- CreateIndex
CREATE INDEX "subject_enrollments_subject_id_idx" ON "subject_enrollments"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_enrollments_student_id_subject_id_period_id_key" ON "subject_enrollments"("student_id", "subject_id", "period_id");

-- CreateIndex
CREATE INDEX "exams_subject_id_batch_id_idx" ON "exams"("subject_id", "batch_id");

-- CreateIndex
CREATE INDEX "exam_results_student_id_idx" ON "exam_results"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_exam_id_student_id_key" ON "exam_results"("exam_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_periods_academic_year_semester_number_key" ON "academic_periods"("academic_year", "semester_number");

-- CreateIndex
CREATE INDEX "attendance_summary_student_id_period_id_idx" ON "attendance_summary"("student_id", "period_id");

-- CreateIndex
CREATE INDEX "attendance_summary_subject_id_period_id_idx" ON "attendance_summary"("subject_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_summary_student_id_subject_id_period_id_key" ON "attendance_summary"("student_id", "subject_id", "period_id");

-- CreateIndex
CREATE INDEX "students_has_backlogs_idx" ON "students"("has_backlogs");

-- CreateIndex
CREATE INDEX "subjects_program_id_idx" ON "subjects"("program_id");

-- CreateIndex
CREATE INDEX "subjects_program_id_semester_number_idx" ON "subjects"("program_id", "semester_number");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_teacher_id_period_id_idx" ON "teacher_subject_assignments"("teacher_id", "period_id");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_subject_id_period_id_idx" ON "teacher_subject_assignments"("subject_id", "period_id");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_batch_id_section_id_period_id_idx" ON "teacher_subject_assignments"("batch_id", "section_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subject_assignments_teacher_id_subject_id_batch_id__key" ON "teacher_subject_assignments"("teacher_id", "subject_id", "batch_id", "section_id", "period_id");

-- CreateIndex
CREATE INDEX "timetables_section_id_period_id_idx" ON "timetables"("section_id", "period_id");

-- CreateIndex
CREATE INDEX "timetables_subject_id_period_id_idx" ON "timetables"("subject_id", "period_id");

-- CreateIndex
CREATE INDEX "timetables_batch_id_period_id_idx" ON "timetables"("batch_id", "period_id");

-- CreateIndex
CREATE INDEX "timetables_teacher_id_period_id_idx" ON "timetables"("teacher_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_section_id_day_of_week_time_slot_id_period_id_key" ON "timetables"("section_id", "day_of_week", "time_slot_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_teacher_id_day_of_week_time_slot_id_period_id_key" ON "timetables"("teacher_id", "day_of_week", "time_slot_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_classroom_id_day_of_week_time_slot_id_period_id_key" ON "timetables"("classroom_id", "day_of_week", "time_slot_id", "period_id");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_backlogs" ADD CONSTRAINT "student_backlogs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_backlogs" ADD CONSTRAINT "student_backlogs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;
