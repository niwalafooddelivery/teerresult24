# TeerResult2 — Production Web Architecture

TeerResult2 is a high-performance Next.js App Router publication platform for Meghalaya archery results (Shillong, Khanapara, Juwai, and Shillong Night Teer).

---

## 1. Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set ADMIN_INITIAL_PASSWORD, JWT_SECRET, and CRON_SECRET in .env

# 3. Apply database migration & seed categories
npx prisma migrate deploy
npm run prisma:seed

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the multi-page application.

---

## 2. Production Database Deployment

### Local Development: SQLite
- Default datasource: `file:./dev.db`
- Migration path: `prisma/migrations/`
- Applied via: `npx prisma migrate deploy`

### Production Serverless / Cloud: PostgreSQL (Neon, Supabase, Railway, Vercel)
Serverless hosts (such as Vercel) wipe local SQLite files between cold starts. For persistent production:
1. Provide a managed PostgreSQL connection string in `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@ep-host.pooler.region.neon.tech/neondb?sslmode=require"
   ```
2. Generate Prisma Client for PostgreSQL:
   ```bash
   npm run prisma:postgres
   ```
3. Deploy PostgreSQL migrations:
   ```bash
   npm run prisma:migrate:postgres
   ```
   *(Alternatively, run the migration scripts from `prisma/migrations.postgres/` in your SQL console).*

---

## 3. Production Security & Rate Limiting

- **Persistent Rate Limiter (`src/lib/rate-limiter.js`):**
  - Tracks failed attempts in the database table `LoginAttempt`.
  - Max 5 failed attempts per 15-minute sliding window; 6th attempt triggers HTTP 429 lockout.
  - **Fail Closed:** If database or storage is unreachable, returns HTTP 503 (`SERVICE_UNAVAILABLE`) with `Retry-After: 30` rather than silently bypassing protection.
  - **Client IP Validation:** Validates IPv4/IPv6 structure against trusted proxy headers (`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`).

---

## 4. Verification & Correction Policy

- **Default State:** Manual score entries are created with `isVerified: false` and status `PENDING`, `PARTIAL`, or `COMPLETED`.
- **Official Verification:** Requires `action: "approve_and_verify"` with a syntactically valid `sourceEvidenceUrl` (HTTP/HTTPS URL, e.g. official bulletin archive link).
- **Revocation on Revision:** If a score is modified after being verified, previous verification is automatically revoked (`isVerified: false`, metadata cleared, status set to `CORRECTED`) unless fresh authenticated approval with evidence is submitted.
- **Audit Log:** All score changes are persistently logged into `CorrectionLog` with old value, new value, round number, reason, and editor identity.

---

## 5. Automation & Ingestion Safeguards

- **Scraper Accuracy (`src/lib/importers/teerresultlive-adapter.js`):**
  - Extracts FR/SR strictly from explicitly structured, validated data properties (`TeerLiveBoard` Astro island props).
  - Unsafe regex DOM fallback searches have been completely removed.
  - Predicted target numbers (common numbers, house, ending, dreams) are isolated and strictly ignored.
  - Scores must strictly match `^\d{2}$` (preserving leading zeros like `04` and `00`).
  - Dates are verified against Indian Standard Time (`Asia/Kolkata`).
  - Strict date mismatch rejection: If source date does not match expected Asia/Kolkata date, job terminates with `SKIPPED_DATE_MISMATCH` and 0 records saved.
  - Fails safely without modifying public results if source structure changes or is ambiguous.

- **Source Authorization & Verification Policy:**
  - Candidate Source: `https://teerresultlive.in/` (Subject to robots.txt and authorized terms).
  - A third-party aggregator URL alone does NOT establish official verification.
  - To mark a score `isVerified: true`, an authorized editor must supply documented provenance (e.g. Sanctioned Ground Bulletin or Counter Slip confirmation).
  - `AUTO_PUBLISH_ENABLED="false"` remains the default until an organizer feed is formally authorized.

- **Atomic Locking & Safe Lease Renewal (`src/lib/importers/sync-engine.js`):**
  - All executions (cron and admin) strictly obey the database-backed `AutomationLock` table.
  - Bypass parameter `force` is completely eliminated.
  - Unique UUID per job (`crypto.randomUUID()`) prevents cross-process lock confusion.
  - Safe lease renewal (`renewAutomationLock`) checks active ownership before extending timeouts.
  - Protected try/finally lifecycle: `ImportJob` initialization and execution are fully wrapped so any error unconditionally releases the acquired lock in `finally`.

- **Concurrent Operations & Race Prevention:**
  - Concurrent approvals on `PendingResultReview` utilize atomic conditional queries (`updateMany where status = 'PENDING'`). Only one worker succeeds; competing requests receive HTTP 409 Conflict.
  - Public result updates run inside isolated database transactions (`prisma.$transaction`) with conflict detection against already verified records.

---

## 6. Cron Schedule Reference (UTC & IST)

Archery draws take place Monday through Saturday (Khasi Hills clubs do not operate on Sundays):

| Competition | Round | IST Announcement | UTC Cron Schedule | Cron Expression |
| :--- | :--- | :--- | :--- | :--- |
| **Juwai Teer** | FR (02:00 PM) / SR (02:45 PM) | 02:05 PM - 02:50 PM IST | 08:35 & 09:20 UTC | `35 8,9 * * 1-6` |
| **Shillong Teer** | FR (03:45 PM) / SR (04:45 PM) | 03:50 PM - 04:50 PM IST | 10:20 & 11:20 UTC | `20 10,11 * * 1-6` |
| **Khanapara Teer** | FR (04:10 PM) / SR (04:45 PM) | 04:15 PM - 04:50 PM IST | 10:45 & 11:20 UTC | `45 10,11 * * 1-6` |
| **Shillong Night Teer**| FR (10:30 PM) / SR (11:30 PM) | 10:35 PM - 11:35 PM IST | 17:05 & 18:05 UTC | `35 17,18 * * 1-6` |

- Recommended Vercel Cron (`vercel.json`):
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/sync-results",
        "schedule": "*/15 8-12,17-19 * * 1-6"
      }
    ]
  }
  ```

---

## 7. Indian Standard Time (IST) Compliance

- Strictly operates in Indian Standard Time (`Asia/Kolkata`, UTC+05:30) via native `Intl.DateTimeFormat`.
- Computes `getTodayISTDateStr()` and `getYesterdayISTDateStr()` identically across UTC, Pakistan (UTC+5), India (UTC+5:30), and US timezones.
