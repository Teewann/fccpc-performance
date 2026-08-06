-- CreateEnum
CREATE TYPE "PaymentWorkflowStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'PARTIALLY_PAID', 'OVERPAID');

-- CreateTable
CREATE TABLE "PaymentWorkflow" (
    "id" TEXT NOT NULL,
    "caseReference" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "actualAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "notes" TEXT,
    "status" "PaymentWorkflowStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "raisedById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "bankReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "financeNotes" TEXT,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentWorkflow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentWorkflow" ADD CONSTRAINT "PaymentWorkflow_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWorkflow" ADD CONSTRAINT "PaymentWorkflow_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
