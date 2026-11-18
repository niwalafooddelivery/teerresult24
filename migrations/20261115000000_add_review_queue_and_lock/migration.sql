-- CreateTable
CREATE TABLE "PendingResultReview" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "proposedRound1" TEXT,
    "proposedRound2" TEXT,
    "currentRound1" TEXT,
    "currentRound2" TEXT,
    "reviewType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceEvidence" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingResultReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLock" (
    "key" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "PendingResultReview_status_dateStr_idx" ON "PendingResultReview"("status", "dateStr");

-- AddForeignKey
ALTER TABLE "PendingResultReview" ADD CONSTRAINT "PendingResultReview_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
