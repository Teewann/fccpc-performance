-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('ZONE_TO_ZONE', 'ZONE_TO_HQ', 'HQ_TO_ZONE', 'INTERSTATE', 'INTER_DEPARTMENTAL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'RECALLED');

-- CreateTable
CREATE TABLE "CaseTransfer" (
    "id" TEXT NOT NULL,
    "caseRef" TEXT NOT NULL,
    "caseTitle" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fromOffice" TEXT NOT NULL,
    "toOffice" TEXT NOT NULL,
    "transferType" "TransferType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "transferNote" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "initiatedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "rejectedReason" TEXT,
    "completedNote" TEXT,
    "targetUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTransfer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
