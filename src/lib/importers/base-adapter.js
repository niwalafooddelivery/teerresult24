import prisma from '@/lib/prisma';
import { validateTeerNumber } from '@/lib/date-utils';

/**
 * Base Result Ingestion Adapter
 * All specific provider adapters (API, Feed, Bulletin) implement this interface.
 */
export class BaseResultAdapter {
  constructor(adapterName) {
    this.adapterName = adapterName || 'GenericBaseAdapter';
  }

  /**
   * Must be implemented by subclasses
   * Returns: Promise<Array<{ categorySlug, dateStr, round1, round2, sourceNote }>>
   */
  async fetchRemoteData() {
    throw new Error('fetchRemoteData must be implemented by adapter subclass');
  }

  /**
   * Ingest and validate results with duplicate checking & correction logging
   */
  async executeSync() {
    const job = await prisma.importJob.create({
      data: {
        jobName: this.adapterName,
        status: 'RUNNING',
      },
    });

    try {
      const records = await this.fetchRemoteData();
      let savedCount = 0;

      for (const item of records) {
        // Strict Validation: must be null or exactly 2 digits
        const v1 = validateTeerNumber(item.round1);
        const v2 = validateTeerNumber(item.round2);

        if (!v1.isValid || !v2.isValid) {
          console.warn(`[${this.adapterName}] Invalid score format for ${item.categorySlug}:`, v1.error || v2.error);
          continue;
        }

        const category = await prisma.gameCategory.findUnique({
          where: { slug: item.categorySlug },
        });

        if (!category) {
          console.warn(`[${this.adapterName}] Category not found: ${item.categorySlug}`);
          continue;
        }

        // Determine status
        let status = 'PENDING';
        if (v1.value && v2.value) status = 'COMPLETED';
        else if (v1.value || v2.value) status = 'PARTIAL';

        // Check if existing record exists
        const existing = await prisma.teerResult.findUnique({
          where: {
            categoryId_dateStr: {
              categoryId: category.id,
              dateStr: item.dateStr,
            },
          },
        });

        if (existing) {
          // If value changed, record in CorrectionLog
          if (existing.round1 !== v1.value && existing.round1 !== null && v1.value !== null) {
            await prisma.correctionLog.create({
              data: {
                resultId: existing.id,
                roundNumber: 1,
                oldValue: existing.round1,
                newValue: v1.value,
                reason: `Automated sync discrepancy update via ${this.adapterName}`,
                correctedBy: this.adapterName,
              },
            });
          }

          if (existing.round2 !== v2.value && existing.round2 !== null && v2.value !== null) {
            await prisma.correctionLog.create({
              data: {
                resultId: existing.id,
                roundNumber: 2,
                oldValue: existing.round2,
                newValue: v2.value,
                reason: `Automated sync discrepancy update via ${this.adapterName}`,
                correctedBy: this.adapterName,
              },
            });
          }

          await prisma.teerResult.update({
            where: { id: existing.id },
            data: {
              round1: v1.value,
              round2: v2.value,
              status,
              isVerified: true,
              sourceInfo: item.sourceNote || `${this.adapterName} Feed`,
            },
          });
        } else {
          await prisma.teerResult.create({
            data: {
              categoryId: category.id,
              dateStr: item.dateStr,
              round1: v1.value,
              round2: v2.value,
              status,
              isVerified: true,
              sourceInfo: item.sourceNote || `${this.adapterName} Feed`,
            },
          });
        }

        savedCount++;
      }

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCESS',
          recordsRead: records.length,
          recordsSaved: savedCount,
          completedAt: new Date(),
        },
      });

      return { success: true, recordsRead: records.length, recordsSaved: savedCount };
    } catch (error) {
      console.error(`[${this.adapterName}] Sync failed:`, error);
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown adapter error',
          completedAt: new Date(),
        },
      });
      return { success: false, error: error.message };
    }
  }
}
