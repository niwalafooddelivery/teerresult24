import crypto from 'node:crypto';
import prisma from '../prisma.js';
import { fetchTeerResultLiveResults } from './teerresultlive-adapter.js';

const LOCK_KEY = 'AUTOMATION_SYNC_LOCK';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// In-memory fallback lock store for when DB table is not yet migrated or unreachable
const memoryLockStore = new Map();

function isLockFallbackNeeded(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  const name = String(err.name || '');
  const code = String(err.code || err.errorCode || '');
  return (
    msg.includes('AutomationLock') ||
    msg.includes('42P01') ||
    code === 'P2021' ||
    code === 'P1012' ||
    name.includes('PrismaClientInitializationError') ||
    msg.includes('validating datasource') ||
    msg.includes("Can't reach database server") ||
    msg.includes('connection')
  );
}

function checkMemoryLock(lockId, now, expiresAt) {
  const current = memoryLockStore.get(LOCK_KEY);
  if (!current || current.expiresAt <= now) {
    memoryLockStore.set(LOCK_KEY, { lockedBy: lockId, expiresAt });
    return { acquired: true };
  }
  if (current.lockedBy === lockId) {
    current.expiresAt = expiresAt;
    return { acquired: true };
  }
  return {
    acquired: false,
    message: `Sync execution locked by ${current.lockedBy} until ${current.expiresAt.toISOString()}`,
  };
}

/**
 * Acquires an atomic database-backed lock to prevent concurrent sync executions.
 * Prevents race conditions during expired lock takeovers via conditional atomic transactions.
 * Includes graceful memory-store fallback if AutomationLock table is pending migration.
 */
export async function acquireAutomationLock(lockId) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS);

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.automationLock.findUnique({
        where: { key: LOCK_KEY },
      });

      if (!current) {
        try {
          await tx.automationLock.create({
            data: { key: LOCK_KEY, lockedBy: lockId, expiresAt },
          });
          return { acquired: true };
        } catch {
          return { acquired: false, message: 'Concurrent lock acquisition conflict' };
        }
      }

      if (current.expiresAt > now) {
        return {
          acquired: false,
          message: `Sync execution locked by ${current.lockedBy} until ${current.expiresAt.toISOString()}`,
        };
      }

      // Expired lock: take over atomically ONLY IF expiresAt has not changed in the meantime
      const takeover = await tx.automationLock.updateMany({
        where: {
          key: LOCK_KEY,
          expiresAt: current.expiresAt,
        },
        data: {
          lockedBy: lockId,
          expiresAt,
        },
      });

      if (takeover.count === 1) {
        return { acquired: true };
      }

      return { acquired: false, message: 'Expired lock was simultaneously acquired by another process' };
    });
  } catch (err) {
    if (isLockFallbackNeeded(err)) {
      console.warn('[AutomationLock] Database table AutomationLock is not present. Using in-memory lock fallback until migrations are deployed.');
      return checkMemoryLock(lockId, now, expiresAt);
    }
    throw err;
  }
}

/**
 * Renews the automation lock lease for active long-running jobs.
 * Enforces ownership check and active lease validity: only the active holder
 * with a NON-EXPIRED lease (expiresAt > now) can renew!
 * An expired or stale worker cannot renew or write results without a valid active lease.
 */
export async function renewAutomationLock(lockId, extensionMs = LOCK_TIMEOUT_MS) {
  const now = new Date();
  const newExpiresAt = new Date(Date.now() + extensionMs);

  try {
    const renewed = await prisma.automationLock.updateMany({
      where: {
        key: LOCK_KEY,
        lockedBy: lockId,
        expiresAt: { gt: now },
      },
      data: {
        expiresAt: newExpiresAt,
      },
    });
    return renewed.count === 1;
  } catch (err) {
    if (isLockFallbackNeeded(err)) {
      const current = memoryLockStore.get(LOCK_KEY);
      if (current && current.lockedBy === lockId && current.expiresAt > now) {
        current.expiresAt = newExpiresAt;
        return true;
      }
      return false;
    }
    console.error('Error renewing automation lock lease:', err);
    return false;
  }
}

/**
 * Checks whether the worker currently holds an active, non-expired lock lease.
 * Database-level safeguard against stale workers writing results after lease expiration.
 */
export async function isLockLeaseActive(lockId) {
  const now = new Date();
  try {
    const active = await prisma.automationLock.findFirst({
      where: {
        key: LOCK_KEY,
        lockedBy: lockId,
        expiresAt: { gt: now },
      },
    });
    return Boolean(active);
  } catch (err) {
    if (isLockFallbackNeeded(err)) {
      const current = memoryLockStore.get(LOCK_KEY);
      return Boolean(current && current.lockedBy === lockId && current.expiresAt > now);
    }
    console.error('Error checking active lock lease:', err);
    return false;
  }
}

/**
 * Releases the database-backed automation lock ONLY if owned by the current job.
 * Prevents an overdue job from unsafely deleting a subsequent job's new lock.
 */
export async function releaseAutomationLock(lockId) {
  const current = memoryLockStore.get(LOCK_KEY);
  if (current && current.lockedBy === lockId) {
    memoryLockStore.delete(LOCK_KEY);
  }

  try {
    const deleted = await prisma.automationLock.deleteMany({
      where: {
        key: LOCK_KEY,
        lockedBy: lockId,
      },
    });
    return deleted.count > 0;
  } catch (err) {
    if (isLockFallbackNeeded(err)) {
      return true;
    }
    console.error('Error releasing automation lock:', err);
    return false;
  }
}

/**
 * Executes the secure daily sync job with atomic locking,
 * strict verification safeguards, pending review staging, and correction flagging.
 * Note: force bypass is strictly removed - all executions must respect atomic locking.
 */
export async function runSyncJob(options = {}) {
  const {
    requestedBy = 'Scheduled Cron',
    htmlOverride = null,
    targetDate = null,
  } = options;

  const startedAt = new Date();
  const uniqueJobId = crypto.randomUUID();
  const lockId = `${requestedBy} [${uniqueJobId}]`;

  // 1. Atomic Database Locking (no bypass allowed)
  const lockResult = await acquireAutomationLock(lockId);
  if (!lockResult.acquired) {
    return {
      success: false,
      skipped: true,
      message: lockResult.message,
    };
  }

  let job = null;

  // Protected try/finally lifecycle: guarantees lock release even if ImportJob creation fails!
  try {
    // 2. Initialize ImportJob INSIDE protected try block
    job = await prisma.importJob.create({
      data: {
        id: uniqueJobId,
        jobName: `Sync: ${requestedBy}`,
        status: 'RUNNING',
        recordsRead: 0,
        recordsSaved: 0,
        startedAt,
      },
    });

    // Enforce initial lock lease confirmation
    const leaseConfirmed = await renewAutomationLock(lockId);
    if (!leaseConfirmed) {
      throw new Error(`LOCK_LOST: Unable to confirm active lock lease for ${lockId}. Aborting sync before writes.`);
    }

    // 3. Fetch normalized results from adapter
    const adapterResponse = await fetchTeerResultLiveResults({
      htmlOverride,
      targetDate,
    });

    // 4. Record raw snapshot in SourceRecord table
    await prisma.sourceRecord.create({
      data: {
        sourceName: adapterResponse.providerName,
        rawPayload: JSON.stringify({
          sourceUrl: adapterResponse.sourceUrl,
          fetchedAt: startedAt,
          success: adapterResponse.success,
          error: adapterResponse.error || null,
          extractedCount: adapterResponse.results?.length || 0,
          snippet: adapterResponse.rawPayloadSnippet || null,
        }),
        status: adapterResponse.success ? 'PROCESSED' : 'FAILED',
      },
    });

    if (adapterResponse.isDateMismatch || !adapterResponse.success || adapterResponse.results.length === 0) {
      const errorMsg = adapterResponse.error || 'No valid result data could be extracted safely from source.';
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: adapterResponse.isDateMismatch ? 'SKIPPED_DATE_MISMATCH' : 'FAILED',
          errorMessage: errorMsg,
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        isDateMismatch: Boolean(adapterResponse.isDateMismatch),
        jobId: job.id,
        error: errorMsg,
      };
    }

    const { results, providerName, sourceUrl } = adapterResponse;
    const autoPublish = process.env.AUTO_PUBLISH_ENABLED === 'true';
    let recordsSaved = 0;
    const updateDetails = [];

    // Safe lease renewal before processing records
    const preIngestRenewed = await renewAutomationLock(lockId);
    if (!preIngestRenewed) {
      throw new Error(`LOCK_LOST: Lock ownership lease lost or expired for ${lockId} before starting record ingestion. Aborting to prevent split-brain writes.`);
    }

    // 5. Ingest each game result safely
    for (const item of results) {
      // Confirm lock ownership before each game record update
      const itemRenewed = await renewAutomationLock(lockId);
      if (!itemRenewed) {
        throw new Error(`LOCK_LOST: Lock lease lost or claimed by another worker during processing (${item.gameIdentifier}) for ${lockId}. Aborting immediately.`);
      }

      let category = await prisma.gameCategory.findUnique({
        where: { slug: item.gameIdentifier },
      });

      if (!category) {
        const { ensureOfficialCategories } = await import('../categories.js');
        await ensureOfficialCategories(prisma).catch(() => {});
        category = await prisma.gameCategory.findUnique({
          where: { slug: item.gameIdentifier },
        }).catch(() => null);
      }

      if (!category) {
        console.warn(`Category slug not registered in DB: ${item.gameIdentifier}`);
        continue;
      }

      const targetDateStr = item.dateStr;
      const incomingFR = item.round1;
      const incomingSR = item.round2;

      // Process inside database transaction for isolation
      await prisma.$transaction(async (tx) => {
        // Database-level safeguard against stale workers:
        // Verify the lease has not expired before proceeding with database writes
        let activeLock = null;
        try {
          activeLock = await tx.automationLock.findFirst({
            where: {
              key: LOCK_KEY,
              lockedBy: lockId,
              expiresAt: { gt: new Date() },
            },
          });
        } catch (err) {
          if (isLockFallbackNeeded(err)) {
            const mem = memoryLockStore.get(LOCK_KEY);
            if (mem && mem.lockedBy === lockId && mem.expiresAt > new Date()) {
              activeLock = mem;
            }
          } else {
            throw err;
          }
        }

        if (!activeLock) {
          throw new Error(`STALE_WORKER_WRITE_BLOCKED: Lease expired for ${lockId}. Stale worker write safely blocked at database transaction boundary.`);
        }

        const existing = await tx.teerResult.findUnique({
          where: {
            categoryId_dateStr: {
              categoryId: category.id,
              dateStr: targetDateStr,
            },
          },
        });

        // SAFEGUARD 1: Existing Verified Result Conflict Detection
        // Never silently overwrite a verified score!
        if (existing && existing.isVerified) {
          const frMismatch = incomingFR !== null && existing.round1 !== null && existing.round1 !== incomingFR;
          const srMismatch = incomingSR !== null && existing.round2 !== null && existing.round2 !== incomingSR;

          if (frMismatch || srMismatch) {
            // Check if existing pending review already flagged
            const existingPending = await tx.pendingResultReview.findFirst({
              where: {
                categoryId: category.id,
                dateStr: targetDateStr,
                status: 'PENDING',
              },
            });

            if (!existingPending) {
              await tx.pendingResultReview.create({
                data: {
                  categoryId: category.id,
                  dateStr: targetDateStr,
                  proposedRound1: incomingFR,
                  proposedRound2: incomingSR,
                  currentRound1: existing.round1,
                  currentRound2: existing.round2,
                  reviewType: 'CORRECTION_CANDIDATE',
                  status: 'PENDING',
                  sourceName: providerName,
                  sourceUrl,
                  sourceEvidence: JSON.stringify(item.rawSourceReference),
                },
              });
            }

            recordsSaved++;
            updateDetails.push({
              game: category.name,
              date: targetDateStr,
              action: 'CORRECTION_FLAGGED_FOR_REVIEW',
              reason: 'Scraped data conflicts with current verified score. Preserved verified value pending admin review.',
              currentVerified: { fr: existing.round1, sr: existing.round2 },
              scrapedProposed: { fr: incomingFR, sr: incomingSR },
            });
            return;
          }
        }

        // SAFEGUARD 2: If live auto-publishing is disabled (DEFAULT), route to Pending Review Queue
        if (!autoPublish) {
          const existingReview = await tx.pendingResultReview.findFirst({
            where: {
              categoryId: category.id,
              dateStr: targetDateStr,
              status: 'PENDING',
            },
          });

          // Idempotent review queue update
          if (existingReview) {
            const hasChange =
              existingReview.proposedRound1 !== incomingFR || existingReview.proposedRound2 !== incomingSR;
            if (hasChange) {
              await tx.pendingResultReview.update({
                where: { id: existingReview.id },
                data: {
                  proposedRound1: incomingFR,
                  proposedRound2: incomingSR,
                  sourceEvidence: JSON.stringify(item.rawSourceReference),
                },
              });
              recordsSaved++;
            }
          } else {
            await tx.pendingResultReview.create({
              data: {
                categoryId: category.id,
                dateStr: targetDateStr,
                proposedRound1: incomingFR,
                proposedRound2: incomingSR,
                currentRound1: existing?.round1 ?? null,
                currentRound2: existing?.round2 ?? null,
                reviewType: existing ? 'UPDATE' : 'NEW_RESULT',
                status: 'PENDING',
                sourceName: providerName,
                sourceUrl,
                sourceEvidence: JSON.stringify(item.rawSourceReference),
              },
            });
            recordsSaved++;
          }

          updateDetails.push({
            game: category.name,
            date: targetDateStr,
            action: 'QUEUED_FOR_ADMIN_REVIEW',
            proposed: { fr: incomingFR, sr: incomingSR },
            autoPublish: false,
          });
          return;
        }

        // SAFEGUARD 3: Auto-publish mode (Only applies if AUTO_PUBLISH_ENABLED=true and non-conflicting)
        // Scraped results are NEVER automatically marked isVerified: true
        if (!existing) {
          let initialStatus = 'PENDING';
          if (incomingFR && incomingSR) initialStatus = 'COMPLETED';
          else if (incomingFR || incomingSR) initialStatus = 'PARTIAL';

          await tx.teerResult.create({
            data: {
              categoryId: category.id,
              dateStr: targetDateStr,
              round1: incomingFR,
              round2: incomingSR,
              status: initialStatus,
              isVerified: false, // Never auto-verify!
              sourceInfo: `Scraped via ${providerName} (Pending Verification)`,
              sourceEvidenceUrl: sourceUrl,
              round1PublishedAt: incomingFR ? new Date() : null,
              round2PublishedAt: incomingSR ? new Date() : null,
            },
          });

          recordsSaved++;
          updateDetails.push({
            game: category.name,
            date: targetDateStr,
            action: 'CREATED_UNVERIFIED',
            fr: incomingFR,
            sr: incomingSR,
            status: initialStatus,
          });
          return;
        }

        // Existing unverified result update
        const frChanged = incomingFR !== null && existing.round1 !== incomingFR;
        const srChanged = incomingSR !== null && existing.round2 !== incomingSR;

        if (!frChanged && !srChanged) {
          updateDetails.push({
            game: category.name,
            date: targetDateStr,
            action: 'UNCHANGED',
            fr: existing.round1,
            sr: existing.round2,
          });
          return;
        }

        const nextFR = incomingFR !== null ? incomingFR : existing.round1;
        const nextSR = incomingSR !== null ? incomingSR : existing.round2;

        let nextStatus = 'PENDING';
        if (nextFR && nextSR) nextStatus = 'COMPLETED';
        else if (nextFR || nextSR) nextStatus = 'PARTIAL';

        await tx.teerResult.update({
          where: { id: existing.id },
          data: {
            round1: nextFR,
            round2: nextSR,
            status: nextStatus,
            isVerified: false, // Remains unverified
            sourceInfo: `Scraped via ${providerName} (Pending Verification)`,
            sourceEvidenceUrl: sourceUrl,
            round1PublishedAt: incomingFR && !existing.round1 ? new Date() : existing.round1PublishedAt,
            round2PublishedAt: incomingSR && !existing.round2 ? new Date() : existing.round2PublishedAt,
          },
        });

        recordsSaved++;
        updateDetails.push({
          game: category.name,
          date: targetDateStr,
          action: 'UPDATED_UNVERIFIED',
          fr: nextFR,
          sr: nextSR,
          status: nextStatus,
        });
      });
    }

    // 6. Complete ImportJob with SUCCESS
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCESS',
        recordsRead: results.length,
        recordsSaved,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      jobId: job.id,
      startedAt,
      completedAt: new Date(),
      recordsRead: results.length,
      recordsSaved,
      autoPublishEnabled: autoPublish,
      details: updateDetails,
    };
  } catch (error) {
    console.error('Sync job failure:', error);

    if (job) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown ingestion error',
          completedAt: new Date(),
        },
      });
    }

    return {
      success: false,
      jobId: job ? job.id : null,
      error: error.message,
    };
  } finally {
    // ALWAYS release lock owned by current execution
    await releaseAutomationLock(lockId);
  }
}
