/*
  Warnings:

  - You are about to drop the column `student_id` on the `library_visit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_id` on the `library_visit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `user_type` on the `library_visit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `teachers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,library_session_state]` on the table `library_visit_logs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `library_visit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "library_visit_logs" DROP CONSTRAINT "library_visit_logs_student_id_fkey";

-- DropForeignKey
ALTER TABLE "library_visit_logs" DROP CONSTRAINT "library_visit_logs_teacher_id_fkey";

-- DropIndex
DROP INDEX "library_visit_logs_student_id_idx";

-- DropIndex
DROP INDEX "library_visit_logs_student_id_library_session_state_key";

-- DropIndex
DROP INDEX "library_visit_logs_teacher_id_idx";

-- DropIndex
DROP INDEX "library_visit_logs_teacher_id_library_session_state_key";

-- DropIndex
DROP INDEX "library_visit_logs_user_type_idx";

-- DropIndex
DROP INDEX "students_email_idx";

-- DropIndex
DROP INDEX "teachers_email_key";

-- AlterTable
ALTER TABLE "library_visit_logs" DROP COLUMN "student_id",
DROP COLUMN "teacher_id",
DROP COLUMN "user_type",
ADD COLUMN     "user_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "email",
ADD COLUMN     "user_id" BIGINT;

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "email",
ADD COLUMN     "user_id" BIGINT;

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admins" (
    "admin_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "employee_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone_number" TEXT,
    "designation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_employee_id_key" ON "admins"("employee_id");

-- CreateIndex
CREATE INDEX "library_visit_logs_user_id_idx" ON "library_visit_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_visit_logs_user_id_library_session_state_key" ON "library_visit_logs"("user_id", "library_session_state");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_visit_logs" ADD CONSTRAINT "library_visit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
