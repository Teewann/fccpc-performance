/*
  Warnings:

  - You are about to drop the column `link` on the `Notification` table. All the data in the column will be lost.
  - The `type` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[taskRef]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userIdRef]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ALERT', 'SUCCESS');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "link",
ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "documentData" TEXT,
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentSize" INTEGER,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalationReason" TEXT,
ADD COLUMN     "forwardNote" TEXT,
ADD COLUMN     "forwardedFromId" TEXT,
ADD COLUMN     "forwardedToId" TEXT,
ADD COLUMN     "isPaymentRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "office" TEXT,
ADD COLUMN     "paymentRecipientId" TEXT,
ADD COLUMN     "paymentRouting" TEXT,
ADD COLUMN     "taskRef" TEXT,
ADD COLUMN     "taskSource" TEXT DEFAULT 'DEPARTMENT',
ADD COLUMN     "treatmentStatus" TEXT DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userIdRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskRef_key" ON "Task"("taskRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_userIdRef_key" ON "User"("userIdRef");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_forwardedToId_fkey" FOREIGN KEY ("forwardedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
