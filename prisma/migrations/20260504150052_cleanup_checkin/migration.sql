/*
  Warnings:

  - The `status` column on the `CheckIn` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT');

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "isOnPremises" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "status",
ADD COLUMN     "status" "CheckInStatus" NOT NULL DEFAULT 'PRESENT';

-- DropEnum
DROP TYPE "AttendanceStatus";
