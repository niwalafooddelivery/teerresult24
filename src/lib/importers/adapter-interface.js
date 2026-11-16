/**
 * TeerResult2 - Source Adapter Normalized Interface
 *
 * All external data sources must normalize their raw payload into this standard structure:
 * - gameIdentifier: official slug ('shillong-teer' | 'khanapara-teer' | 'juwai-teer' | 'shillong-night-teer')
 * - dateStr: YYYY-MM-DD in Asia/Kolkata
 * - round1: exactly 2 digits ('00'-'99') or null if pending
 * - round2: exactly 2 digits ('00'-'99') or null if pending
 * - sourceUrl: official URL of source
 * - providerName: name of the provider
 * - fetchedTimestamp: Date
 * - publishedTimestamp: Date or null
 * - sourceVerificationState: 'VERIFIED' | 'UNVERIFIED' | 'DECLARED'
 * - rawSourceReference: raw snapshot/snippet for audit
 */

export function createNormalizedResult({
  gameIdentifier,
  dateStr,
  round1 = null,
  round2 = null,
  sourceUrl,
  providerName,
  fetchedTimestamp = new Date(),
  publishedTimestamp = null,
  sourceVerificationState = 'UNVERIFIED',
  rawSourceReference = null,
}) {
  return {
    gameIdentifier,
    dateStr,
    round1: cleanScore(round1),
    round2: cleanScore(round2),
    sourceUrl,
    providerName,
    fetchedTimestamp,
    publishedTimestamp,
    sourceVerificationState,
    rawSourceReference: typeof rawSourceReference === 'object' ? JSON.stringify(rawSourceReference) : String(rawSourceReference || ''),
  };
}

function cleanScore(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (/^\d{2}$/.test(str)) return str;
  return null;
}
