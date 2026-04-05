/*
  Warnings:

  - A unique constraint covering the columns `[room_number]` on the table `classrooms` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "classrooms_room_number_key" ON "classrooms"("room_number");
