-- ============================================================================
-- TEERRESULT24 — SAFE, IDEMPOTENT PRODUCTION POSTGRESQL MIGRATION & SEED SCRIPT
-- ============================================================================
-- Safe for execution on live Neon PostgreSQL databases.
-- GUARANTEES:
-- 1. Never drops or resets tables.
-- 2. Never deletes existing records or results.
-- 3. Idempotently creates missing tables, indexes, and constraints.
-- 4. Idempotently creates the 4 official competition categories.
-- 5. Idempotently creates the admin user if not present.
-- ============================================================================

-- 1. GameCategory Table
CREATE TABLE IF NOT EXISTS "GameCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Meghalaya',
    "round1Time" TEXT NOT NULL,
    "round2Time" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("id")
);

-- 2. TeerResult Table
CREATE TABLE IF NOT EXISTS "TeerResult" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "round1" TEXT,
    "round2" TEXT,
    "round1PublishedAt" TIMESTAMP(3),
    "round2PublishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "sourceInfo" TEXT DEFAULT 'Pending Verification',
    "sourceEvidenceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeerResult_pkey" PRIMARY KEY ("id")
);

-- 3. PendingResultReview Table
CREATE TABLE IF NOT EXISTS "PendingResultReview" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingResultReview_pkey" PRIMARY KEY ("id")
);

-- 4. AutomationLock Table
CREATE TABLE IF NOT EXISTS "AutomationLock" (
    "key" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("key")
);

-- 5. SourceRecord Table
CREATE TABLE IF NOT EXISTS "SourceRecord" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "sourceName" TEXT NOT NULL,
    "rawPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- 6. ImportJob Table
CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsSaved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- 7. CorrectionLog Table
CREATE TABLE IF NOT EXISTS "CorrectionLog" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
);

-- 8. LoginAttempt Table
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- 9. AdminUser Table
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Chief Editor',
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UNIQUE CONSTRAINTS & INDEXES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "GameCategory_name_key" ON "GameCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "GameCategory_slug_key" ON "GameCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "TeerResult_categoryId_dateStr_key" ON "TeerResult"("categoryId", "dateStr");
CREATE INDEX IF NOT EXISTS "TeerResult_dateStr_idx" ON "TeerResult"("dateStr");
CREATE INDEX IF NOT EXISTS "PendingResultReview_status_dateStr_idx" ON "PendingResultReview"("status", "dateStr");
CREATE UNIQUE INDEX IF NOT EXISTS "LoginAttempt_ip_key" ON "LoginAttempt"("ip");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_expiresAt_idx" ON "LoginAttempt"("ip", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (Safe DO block)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeerResult_categoryId_fkey') THEN
        ALTER TABLE "TeerResult" ADD CONSTRAINT "TeerResult_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PendingResultReview_categoryId_fkey') THEN
        ALTER TABLE "PendingResultReview" ADD CONSTRAINT "PendingResultReview_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SourceRecord_categoryId_fkey') THEN
        ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CorrectionLog_resultId_fkey') THEN
        ALTER TABLE "CorrectionLog" ADD CONSTRAINT "CorrectionLog_resultId_fkey"
        FOREIGN KEY ("resultId") REFERENCES "TeerResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- IDEMPOTENT CATEGORIES SEEDING (The 4 Official Primary Competitions)
-- ============================================================================

INSERT INTO "GameCategory" ("id", "name", "slug", "location", "round1Time", "round2Time", "description", "order", "isActive", "createdAt", "updatedAt")
VALUES
    ('shillong-teer', 'Shillong Teer', 'shillong-teer', 'Polo Grounds, Shillong, Meghalaya', '03:45 PM', '04:45 PM', 'Official Khasi Hills Archery Sports Association daily competition results.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "location" = EXCLUDED."location",
    "round1Time" = EXCLUDED."round1Time",
    "round2Time" = EXCLUDED."round2Time",
    "description" = EXCLUDED."description",
    "order" = EXCLUDED."order",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "GameCategory" ("id", "name", "slug", "location", "round1Time", "round2Time", "description", "order", "isActive", "createdAt", "updatedAt")
VALUES
    ('khanapara-teer', 'Khanapara Teer', 'khanapara-teer', 'Ri-Bhoi District, Assam/Meghalaya Border', '04:10 PM', '04:45 PM', 'Daily Guwahati / Khanapara traditional archery outcome.', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "location" = EXCLUDED."location",
    "round1Time" = EXCLUDED."round1Time",
    "round2Time" = EXCLUDED."round2Time",
    "description" = EXCLUDED."description",
    "order" = EXCLUDED."order",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "GameCategory" ("id", "name", "slug", "location", "round1Time", "round2Time", "description", "order", "isActive", "createdAt", "updatedAt")
VALUES
    ('juwai-teer', 'Juwai Teer', 'juwai-teer', 'Jowai, West Jaintia Hills, Meghalaya', '02:05 PM', '02:45 PM', 'West Jaintia Hills afternoon archery session results.', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "location" = EXCLUDED."location",
    "round1Time" = EXCLUDED."round1Time",
    "round2Time" = EXCLUDED."round2Time",
    "description" = EXCLUDED."description",
    "order" = EXCLUDED."order",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "GameCategory" ("id", "name", "slug", "location", "round1Time", "round2Time", "description", "order", "isActive", "createdAt", "updatedAt")
VALUES
    ('shillong-night-teer', 'Shillong Night Teer', 'shillong-night-teer', 'Polo Grounds / Authorized Club (Night Session)', '10:15 PM', '11:15 PM', 'Night edition archery session outcome in Meghalaya.', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "location" = EXCLUDED."location",
    "round1Time" = EXCLUDED."round1Time",
    "round2Time" = EXCLUDED."round2Time",
    "description" = EXCLUDED."description",
    "order" = EXCLUDED."order",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

-- ============================================================================
-- IDEMPOTENT ADMIN USER SEEDING (admin / TeerAdmin#2026!SecureKey)
-- ============================================================================

INSERT INTO "AdminUser" ("id", "username", "passwordHash", "name", "role", "createdAt")
VALUES (
    'admin_root',
    'admin',
    '$2a$12$RjVomv4oGfO56uA5rUf1C.Q76E55Vz2e.YF3fJzCeqz70k9Ym3L0G',
    'Chief Editor',
    'ADMIN',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;
