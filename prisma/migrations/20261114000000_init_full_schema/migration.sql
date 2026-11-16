-- CreateTable
CREATE TABLE "GameCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Meghalaya',
    "round1Time" TEXT NOT NULL,
    "round2Time" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeerResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "round1" TEXT,
    "round2" TEXT,
    "round1PublishedAt" DATETIME,
    "round2PublishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "sourceInfo" TEXT DEFAULT 'Pending Verification',
    "sourceEvidenceUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeerResult_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT,
    "sourceName" TEXT NOT NULL,
    "rawPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsSaved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorrectionLog_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "TeerResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Chief Editor',
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GameCategory_name_key" ON "GameCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GameCategory_slug_key" ON "GameCategory"("slug");

-- CreateIndex
CREATE INDEX "TeerResult_dateStr_idx" ON "TeerResult"("dateStr");

-- CreateIndex
CREATE UNIQUE INDEX "TeerResult_categoryId_dateStr_key" ON "TeerResult"("categoryId", "dateStr");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_ip_key" ON "LoginAttempt"("ip");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_expiresAt_idx" ON "LoginAttempt"("ip", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
