import * as cheerio from 'cheerio';
import { createNormalizedResult } from './adapter-interface.js';
import { getTodayISTDateStr, isValidCalendarDate } from '../date-utils.js';

const SOURCE_URL = 'https://teerresultlive.in/';
const PROVIDER_NAME = 'TeerResultLive Aggregator';

// Strict mapping of authorized game keys
const GAME_KEY_MAPPING = {
  shillong: 'shillong-teer',
  khanapara: 'khanapara-teer',
  juwai: 'juwai-teer',
  night: 'shillong-night-teer',
};

/**
 * Unwraps Astro devalue serialization format:
 * [0, primitive] or [1, [items]] or [0, { key: [0, val] }]
 */
export function unwrapAstroDevalue(val) {
  if (!Array.isArray(val)) return val;
  const type = val[0];
  const payload = val[1];
  if (type === 0) {
    if (typeof payload === 'object' && payload !== null) {
      if (Array.isArray(payload)) return payload.map(unwrapAstroDevalue);
      const obj = {};
      for (const [k, v] of Object.entries(payload)) {
        obj[k] = unwrapAstroDevalue(v);
      }
      return obj;
    }
    return payload;
  }
  if (type === 1 && Array.isArray(payload)) {
    return payload.map((item) => unwrapAstroDevalue(item));
  }
  return payload;
}

/**
 * Validates and cleans a Teer result score.
 * Must be strictly two digits: "00" through "99", preserving leading zeros (e.g. "04").
 * Placeholders ("xx", "--", "?", empty, predictions) return null.
 */
export function sanitizeScoreStrict(score) {
  if (score === null || score === undefined) return null;
  const str = String(score).trim();
  if (/^\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{1}$/.test(str)) {
    return str.padStart(2, '0');
  }
  return null;
}

/**
 * Validates that an extracted date matches the expected YYYY-MM-DD pattern.
 */
export function isValidDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
}

/**
 * Extracts and normalizes game results directly from HTML content.
 * Reusable standalone parser function.
 * @param {string} html - Raw HTML text
 * @param {string|object} options - Expected calendar date string (YYYY-MM-DD) or options object
 * @returns {object} { success, error, results, sourceDate, expectedDate, isDateMatched, isDateMismatch }
 */
export function extractResultsFromHtml(html, options = {}) {
  const targetDate = typeof options === 'string' ? options : options?.targetDate;
  const fetchedAt = options?.fetchedAt || new Date();
  const $ = cheerio.load(html || '');
  const normalizedResults = [];

  // Parse structured payload from the designated Astro island component
  const astroIsland = $('astro-island[component-url*="TeerLiveBoard"]');
  const rawProps = astroIsland.attr('props');

  if (!rawProps) {
    // FAIL SAFE: Do not use arbitrary regex fallback!
    return {
      success: false,
      error: 'Source layout modified: TeerLiveBoard structured island props missing. Extraction halted safely.',
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  let unwrappedData = null;
  try {
    const decodedProps = JSON.parse(rawProps.replace(/&quot;/g, '"'));
    unwrappedData = unwrapAstroDevalue(decodedProps.initialData);
  } catch (err) {
    return {
      success: false,
      error: `Failed to deserialize structured props: ${err.message}. Extraction halted safely.`,
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  if (!unwrappedData || !unwrappedData.games) {
    return {
      success: false,
      error: 'Structured payload is missing required "games" object. Extraction halted safely.',
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  const sourceDate = unwrappedData.date ? String(unwrappedData.date).trim() : null;
  if (!isValidCalendarDate(sourceDate)) {
    return {
      success: false,
      error: `Invalid or missing source calendar date in payload: "${sourceDate}". Extraction halted safely.`,
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  // Verify against target date if specified, or current IST date
  const expectedDate = targetDate || getTodayISTDateStr();
  if (!isValidCalendarDate(expectedDate)) {
    return {
      success: false,
      error: `Invalid expected calendar date: "${expectedDate}".`,
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  // STRICT ENFORCEMENT: Source date MUST match expected Asia/Kolkata date
  if (sourceDate !== expectedDate) {
    return {
      success: false,
      isDateMismatch: true,
      error: `Source date mismatch: source publishes data for "${sourceDate}" but expected Asia/Kolkata date is "${expectedDate}". Halting ingestion to prevent stale or premature score updates.`,
      results: [],
      sourceDate,
      expectedDate,
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
      rawPayloadSnippet: typeof html === 'string' ? html.slice(0, 1500) : '',
    };
  }

  const publishedTimestamp = unwrappedData.updated_at ? new Date(unwrappedData.updated_at) : null;

  // Extract each authorized game
  for (const [sourceKey, targetSlug] of Object.entries(GAME_KEY_MAPPING)) {
    const gameData = unwrappedData.games[sourceKey];
    if (!gameData) {
      continue;
    }

    // Extract ONLY from explicit 'fr' and 'sr' keys (NEVER from common_numbers or other fields)
    const fr = sanitizeScoreStrict(gameData.fr);
    const sr = sanitizeScoreStrict(gameData.sr);

    normalizedResults.push(
      createNormalizedResult({
        gameIdentifier: targetSlug,
        dateStr: sourceDate,
        round1: fr,
        round2: sr,
        sourceUrl: SOURCE_URL,
        providerName: PROVIDER_NAME,
        fetchedTimestamp: fetchedAt,
        publishedTimestamp,
        // Mark as PENDING_VERIFICATION (never auto-verify third-party claims)
        sourceVerificationState: 'PENDING_VERIFICATION',
        rawSourceReference: {
          sourceKey,
          claimedStatus: gameData.status,
          rawFr: gameData.fr,
          rawSr: gameData.sr,
          claimedFrVerification: gameData.fr_verification,
          claimedSrVerification: gameData.sr_verification,
        },
      })
    );
  }

  return {
    success: normalizedResults.length > 0,
    results: normalizedResults,
    sourceUrl: SOURCE_URL,
    providerName: PROVIDER_NAME,
    sourceDate,
    expectedDate,
    isDateMatched: sourceDate === expectedDate,
    fetchedAt,
    rawPayloadSnippet: typeof html === 'string' ? html.slice(0, 1500) : '',
  };
}

/**
 * Primary fetch and parser for teerresultlive.in.
 * Extracts FR/SR ONLY from explicitly designated, verified data fields.
 * Fails safely if layout changes or data is ambiguous.
 */
export async function fetchTeerResultLiveResults(options = {}) {
  const { htmlOverride = null, targetDate = null } = options;
  const fetchedAt = new Date();

  if (htmlOverride) {
    return extractResultsFromHtml(htmlOverride, { targetDate, fetchedAt });
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'TeerResult2-SyncBot/1.0 (+https://teerresult24.com)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP error fetching ${SOURCE_URL}: ${response.status} ${response.statusText}`,
      results: [],
      sourceUrl: SOURCE_URL,
      providerName: PROVIDER_NAME,
      fetchedAt,
    };
  }

  const html = await response.text();
  return extractResultsFromHtml(html, { targetDate, fetchedAt });
}
