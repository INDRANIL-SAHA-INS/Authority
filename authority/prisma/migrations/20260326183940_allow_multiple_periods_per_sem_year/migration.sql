/*
  Warnings:

  - A unique constraint covering the columns `[name,academic_year,semester_number]` on the table `academic_periods` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "academic_periods_academic_year_semester_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "academic_periods_name_academic_year_semester_number_key" ON "academic_periods"("name", "academic_year", "semester_number");
