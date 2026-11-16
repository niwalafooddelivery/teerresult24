/**
 * Timezone and Date Utilities for TeerResult2
 * Strictly operates in Indian Standard Time (IST - Asia/Kolkata, UTC+05:30)
 * Independent of the host server's local timezone (UTC, PKT, EST, etc.)
 */

const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns the calendar date string (YYYY-MM-DD) in Asia/Kolkata for a given Date or now.
 * Supports day offset (e.g., -1 for yesterday, 0 for today, +1 for tomorrow).
 */
export function getISTDateStr(baseDate = new Date(), dayOffset = 0) {
  const istStr = istDateFormatter.format(baseDate);
  if (dayOffset === 0) return istStr;

  const [y, m, d] = istStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d + dayOffset));
  return dateObj.toISOString().slice(0, 10);
}

export function getTodayISTDateStr() {
  return getISTDateStr(new Date(), 0);
}

export function getYesterdayISTDateStr() {
  return getISTDateStr(new Date(), -1);
}

export function formatISTDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }
  return dateStr;
}

export function formatCompactDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }
  return dateStr;
}

/**
 * Validates whether a date string is a legitimate calendar date in YYYY-MM-DD format.
 * Checks valid month (1-12), days in month, and leap year constraints.
 */
export function isValidCalendarDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  if (y < 2000 || y > 2100) return false;
  if (m < 1 || m > 12) return false;

  const daysInMonth = [
    31,
    (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (d < 1 || d > daysInMonth[m - 1]) return false;

  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m - 1 &&
    dateObj.getUTCDate() === d
  );
}

/**
 * Validates a Teer score: must be null, empty, or exactly two digits "00" - "99".
 * Preserves leading zeros (e.g. '04', not '4').
 */
export function validateTeerNumber(value) {
  if (value === null || value === undefined || value === '' || value === '--') {
    return { isValid: true, value: null };
  }
  const clean = String(value).trim();
  if (!/^\d{2}$/.test(clean)) {
    return {
      isValid: false,
      error: `Teer number must be exactly 2 digits between 00 and 99 (received "${clean}")`,
    };
  }
  return { isValid: true, value: clean };
}
