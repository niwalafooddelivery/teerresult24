-- CreateTable
CREATE TABLE "PendingResultReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingResultReview_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutomationLock" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "lockedBy" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PendingResultReview_status_dateStr_idx" ON "PendingResultReview"("status", "dateStr");
