/*
  Warnings:

  - You are about to drop the column `library_user_ref` on the `library_visit_logs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[student_id,library_session_state]` on the table `library_visit_logs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teacher_id,library_session_state]` on the table `library_visit_logs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_type` to the `library_visit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "library_visit_logs" DROP CONSTRAINT "library_visit_logs_library_user_ref_fkey";

-- DropIndex
DROP INDEX "library_visit_logs_library_user_ref_idx";

-- DropIndex
DROP INDEX "library_visit_logs_library_user_ref_library_session_state_idx";

-- DropIndex
DROP INDEX "library_visit_logs_library_user_ref_library_session_state_key";

-- AlterTable
ALTER TABLE "library_visit_logs" DROP COLUMN "library_user_ref",
ADD COLUMN     "student_id" BIGINT,
ADD COLUMN     "teacher_id" BIGINT,
ADD COLUMN     "user_type" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "library_visit_logs_student_id_idx" ON "library_visit_logs"("student_id");

-- CreateIndex
CREATE INDEX "library_visit_logs_teacher_id_idx" ON "library_visit_logs"("teacher_id");

-- CreateIndex
CREATE INDEX "library_visit_logs_user_type_idx" ON "library_visit_logs"("user_type");

-- CreateIndex
CREATE UNIQUE INDEX "library_visit_logs_student_id_library_session_state_key" ON "library_visit_logs"("student_id", "library_session_state");

-- CreateIndex
CREATE UNIQUE INDEX "library_visit_logs_teacher_id_library_session_state_key" ON "library_visit_logs"("teacher_id", "library_session_state");

-- AddForeignKey
ALTER TABLE "library_visit_logs" ADD CONSTRAINT "library_visit_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_visit_logs" ADD CONSTRAINT "library_visit_logs_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;
