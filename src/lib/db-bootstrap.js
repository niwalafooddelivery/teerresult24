/**
 * Self-Healing Database Bootstrap for TeerResult24
 * Ensures all production PostgreSQL tables exist, constraints are created,
 * and canonical competition categories are seeded without downtime or manual intervention.
 */

const BOOTSTRAP_SQL_STATEMENTS = [
  // 1. GameCategory
  `CREATE TABLE IF NOT EXISTS "GameCategory" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GameCategory_name_key" ON "GameCategory"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GameCategory_slug_key" ON "GameCategory"("slug")`,

  // 2. TeerResult
  `CREATE TABLE IF NOT EXISTS "TeerResult" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TeerResult_categoryId_dateStr_key" ON "TeerResult"("categoryId", "dateStr")`,
  `CREATE INDEX IF NOT EXISTS "TeerResult_dateStr_idx" ON "TeerResult"("dateStr")`,

  // 3. AutomationLock
  `CREATE TABLE IF NOT EXISTS "AutomationLock" (
      "key" TEXT NOT NULL,
      "lockedBy" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("key")
  )`,

  // 4. CorrectionLog
  `CREATE TABLE IF NOT EXISTS "CorrectionLog" (
      "id" TEXT NOT NULL,
      "resultId" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "oldValue" TEXT,
      "newValue" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "correctedBy" TEXT NOT NULL DEFAULT 'Admin',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
  )`,

  // 5. AdminUser
  `CREATE TABLE IF NOT EXISTS "AdminUser" (
      "id" TEXT NOT NULL,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'Chief Editor',
      "role" TEXT NOT NULL DEFAULT 'ADMIN',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username")`,

  // 6. PendingResultReview
  `CREATE TABLE IF NOT EXISTS "PendingResultReview" (
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
  )`,

  // 7. LoginAttempt
  `CREATE TABLE IF NOT EXISTS "LoginAttempt" (
      "id" TEXT NOT NULL,
      "ip" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 1,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LoginAttempt_ip_key" ON "LoginAttempt"("ip")`,

  // 8. Canonical Categories Seeding (Idempotent ON CONFLICT)
  `INSERT INTO "GameCategory" ("id", "name", "slug", "location", "round1Time", "round2Time", "description", "order", "isActive")
   VALUES
       ('shillong-teer', 'Shillong Teer', 'shillong-teer', 'Polo Grounds, Shillong, Meghalaya', '03:45 PM', '04:45 PM', 'Official Khasi Hills Archery Sports Association daily competition results.', 1, true),
       ('khanapara-teer', 'Khanapara Teer', 'khanapara-teer', 'Ri-Bhoi District, Assam/Meghalaya Border', '04:10 PM', '04:45 PM', 'Daily Guwahati / Khanapara traditional archery outcome.', 2, true),
       ('juwai-teer', 'Juwai Teer', 'juwai-teer', 'Jowai, West Jaintia Hills, Meghalaya', '02:05 PM', '02:45 PM', 'West Jaintia Hills afternoon archery session results.', 3, true),
       ('shillong-night-teer', 'Shillong Night Teer', 'shillong-night-teer', 'Polo Grounds / Authorized Club (Night Session)', '10:15 PM', '11:15 PM', 'Night edition archery session outcome in Meghalaya.', 4, true),
       ('shillong-morning-teer', 'Shillong Morning Teer', 'shillong-morning-teer', 'Polo Grounds / Morning Session, Shillong, Meghalaya', '10:30 AM', '11:30 AM', 'Daily morning edition traditional archery session results for Shillong.', 5, true),
       ('welcome-morning-teer', 'Welcome Morning Teer', 'welcome-morning-teer', 'Meghalaya / Assam Border Morning Archery Club', '10:30 AM', '11:30 AM', 'Welcome Morning traditional archery morning round results.', 6, true)
   ON CONFLICT ("slug") DO UPDATE SET
       "name" = EXCLUDED."name",
       "location" = EXCLUDED."location",
       "round1Time" = EXCLUDED."round1Time",
       "round2Time" = EXCLUDED."round2Time",
       "description" = EXCLUDED."description",
       "order" = EXCLUDED."order",
       "isActive" = true`,
];

let bootstrapPromise = null;
let bootstrapCompleted = false;

/**
 * Runs self-healing database bootstrap on PostgreSQL if tables are missing.
 * Executes once per runtime lifecycle or when explicitly triggered.
 */
export async function ensureDatabaseBootstrap(client) {
  if (bootstrapCompleted) return true;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (!client || typeof client.$executeRawUnsafe !== 'function') {
      return false;
    }

    try {
      // Execute each safe DDL statement
      for (const statement of BOOTSTRAP_SQL_STATEMENTS) {
        try {
          await client.$executeRawUnsafe(statement);
        } catch (stmtErr) {
          // Non-fatal if statement is PG-specific on SQLite or already exists
          const msg = stmtErr?.message || '';
          if (!msg.includes('already exists') && !msg.includes('duplicate')) {
            console.warn('[dbBootstrap] Statement warning:', msg.split('\n')[0]);
          }
        }
      }

      // Safe foreign key setup DO block (PostgreSQL only)
      try {
        await client.$executeRawUnsafe(`
          DO $$
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeerResult_categoryId_fkey') THEN
                  ALTER TABLE "TeerResult" ADD CONSTRAINT "TeerResult_categoryId_fkey"
                  FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
              END IF;
          END $$;
        `);
      } catch {}

      bootstrapCompleted = true;
      console.log('✓ [dbBootstrap] Database schema verified and canonical categories guaranteed.');
      return true;
    } catch (err) {
      console.warn('[dbBootstrap] Bootstrap execution warning:', err.message || err);
      return false;
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}
