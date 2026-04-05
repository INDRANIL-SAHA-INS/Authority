/*
  Warnings:

  - You are about to drop the column `semester_number` on the `academic_periods` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,academic_year]` on the table `academic_periods` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "academic_periods_name_academic_year_semester_number_key";

-- AlterTable
ALTER TABLE "academic_periods" DROP COLUMN "semester_number",
ADD COLUMN     "term_type" TEXT;

-- CreateTable
CREATE TABLE "batch_semesters" (
    "batch_semester_id" BIGSERIAL NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "period_id" BIGINT NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_semesters_pkey" PRIMARY KEY ("batch_semester_id")
);

-- CreateIndex
CREATE INDEX "batch_semesters_batch_id_idx" ON "batch_semesters"("batch_id");

-- CreateIndex
CREATE INDEX "batch_semesters_period_id_idx" ON "batch_semesters"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_semesters_batch_id_period_id_key" ON "batch_semesters"("batch_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_periods_name_academic_year_key" ON "academic_periods"("name", "academic_year");

-- AddForeignKey
ALTER TABLE "batch_semesters" ADD CONSTRAINT "batch_semesters_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_semesters" ADD CONSTRAINT "batch_semesters_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;
