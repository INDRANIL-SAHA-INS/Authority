-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "admin_id" DROP DEFAULT;
DROP SEQUENCE "admins_admin_id_seq";

-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "attendance_id" DROP DEFAULT;
DROP SEQUENCE "attendance_records_attendance_id_seq";

-- AlterTable
ALTER TABLE "attendance_sessions" ALTER COLUMN "session_id" DROP DEFAULT;
DROP SEQUENCE "attendance_sessions_session_id_seq";

-- AlterTable
ALTER TABLE "attendance_summary" ALTER COLUMN "summary_id" DROP DEFAULT;
DROP SEQUENCE "attendance_summary_summary_id_seq";

-- AlterTable
ALTER TABLE "exam_results" ALTER COLUMN "result_id" DROP DEFAULT;
DROP SEQUENCE "exam_results_result_id_seq";

-- AlterTable
ALTER TABLE "exams" ALTER COLUMN "exam_id" DROP DEFAULT;
DROP SEQUENCE "exams_exam_id_seq";

-- AlterTable
ALTER TABLE "face_data" ALTER COLUMN "face_id" DROP DEFAULT;
DROP SEQUENCE "face_data_face_id_seq";

-- AlterTable
ALTER TABLE "guardians" ALTER COLUMN "guardian_id" DROP DEFAULT;
DROP SEQUENCE "guardians_guardian_id_seq";

-- AlterTable
ALTER TABLE "library_visit_logs" ALTER COLUMN "library_log_id" DROP DEFAULT;
DROP SEQUENCE "library_visit_logs_library_log_id_seq";

-- AlterTable
ALTER TABLE "student_backlogs" ALTER COLUMN "backlog_id" DROP DEFAULT;
DROP SEQUENCE "student_backlogs_backlog_id_seq";

-- AlterTable
ALTER TABLE "subject_enrollments" ALTER COLUMN "enrollment_id" DROP DEFAULT;
DROP SEQUENCE "subject_enrollments_enrollment_id_seq";

-- AlterTable
ALTER TABLE "teacher_subject_assignments" ALTER COLUMN "assignment_id" DROP DEFAULT;
DROP SEQUENCE "teacher_subject_assignments_assignment_id_seq";

-- AlterTable
ALTER TABLE "timetables" ALTER COLUMN "timetable_id" DROP DEFAULT;
DROP SEQUENCE "timetables_timetable_id_seq";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "user_id" DROP DEFAULT;
DROP SEQUENCE "users_user_id_seq";
