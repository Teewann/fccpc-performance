-- CreateEnum
CREATE TYPE "BizStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'WAIVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('REGISTRATION_FEE', 'ANNUAL_RENEWAL', 'FINE_PAYMENT', 'PROCESSING_FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "RegisteredBusiness" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "rcNumber" TEXT NOT NULL,
    "tin" TEXT,
    "sector" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactRole" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" "BizStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "feePaid" BOOLEAN NOT NULL DEFAULT false,
    "feeReference" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "complianceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisteredBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidReference" TEXT,
    "issuedById" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FineStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BizPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fineId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "PaymentType" NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BizPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BizAuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BizAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredBusiness_rcNumber_key" ON "RegisteredBusiness"("rcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredBusiness_tin_key" ON "RegisteredBusiness"("tin");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredBusiness_email_key" ON "RegisteredBusiness"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BizPayment_reference_key" ON "BizPayment"("reference");

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "RegisteredBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFine" ADD CONSTRAINT "ComplianceFine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "RegisteredBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BizPayment" ADD CONSTRAINT "BizPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "RegisteredBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BizPayment" ADD CONSTRAINT "BizPayment_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "ComplianceFine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BizAuditLog" ADD CONSTRAINT "BizAuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "RegisteredBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
