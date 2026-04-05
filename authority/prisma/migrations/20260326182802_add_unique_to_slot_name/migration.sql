/*
  Warnings:

  - A unique constraint covering the columns `[slot_name]` on the table `time_slots` will be added. If there are existing duplicate values, this will fail.
  - Made the column `slot_name` on table `time_slots` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "time_slots" ALTER COLUMN "slot_name" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_slot_name_key" ON "time_slots"("slot_name");
