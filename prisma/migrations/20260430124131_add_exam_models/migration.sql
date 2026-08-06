/*
  Warnings:

  - Added the required column `targetRole` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "gradeLevel" TEXT,
ADD COLUMN     "targetRole" TEXT NOT NULL,
ALTER COLUMN "passMark" SET DEFAULT 60;
