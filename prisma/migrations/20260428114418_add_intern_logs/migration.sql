-- CreateTable
CREATE TABLE "InternLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skillsLearned" TEXT,
    "supervisorName" TEXT,
    "hoursSpent" DOUBLE PRECISION NOT NULL,
    "status" "LogStatus" NOT NULL DEFAULT 'SUBMITTED',
    "supervisorComment" TEXT,
    "evidence" TEXT,
    "weekNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InternLog" ADD CONSTRAINT "InternLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
