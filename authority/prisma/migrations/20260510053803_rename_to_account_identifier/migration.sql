/*
  Warnings:

  - A unique constraint covering the columns `[account_identifier]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_identifier" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_account_identifier_key" ON "users"("account_identifier");
