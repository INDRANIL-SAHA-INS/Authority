/*
  Warnings:

  - A unique constraint covering the columns `[subject_id,batch_id,period_id,exam_type]` on the table `exams` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "sub_marks" JSONB;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "components" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "exams_subject_id_batch_id_period_id_exam_type_key" ON "exams"("subject_id", "batch_id", "period_id", "exam_type");
