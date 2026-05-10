-- AlterTable
ALTER TABLE "academic_periods" ALTER COLUMN "period_id" DROP DEFAULT;
DROP SEQUENCE "academic_periods_period_id_seq";

-- AlterTable
ALTER TABLE "batches" ALTER COLUMN "batch_id" DROP DEFAULT;
DROP SEQUENCE "batches_batch_id_seq";

-- AlterTable
ALTER TABLE "classrooms" ALTER COLUMN "classroom_id" DROP DEFAULT;
DROP SEQUENCE "classrooms_classroom_id_seq";

-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "department_id" DROP DEFAULT;
DROP SEQUENCE "departments_department_id_seq";

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "program_id" DROP DEFAULT;
DROP SEQUENCE "programs_program_id_seq";

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "section_id" DROP DEFAULT;
DROP SEQUENCE "sections_section_id_seq";

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "student_id" DROP DEFAULT;
DROP SEQUENCE "students_student_id_seq";

-- AlterTable
ALTER TABLE "subjects" ALTER COLUMN "subject_id" DROP DEFAULT;
DROP SEQUENCE "subjects_subject_id_seq";

-- AlterTable
ALTER TABLE "teachers" ALTER COLUMN "teacher_id" DROP DEFAULT;
DROP SEQUENCE "teachers_teacher_id_seq";

-- AlterTable
ALTER TABLE "time_slots" ALTER COLUMN "time_slot_id" DROP DEFAULT;
DROP SEQUENCE "time_slots_time_slot_id_seq";
