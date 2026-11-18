import prisma from './prisma.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window

// Resilient in-memory fallback store to ensure rate limiting always works even if DB table is initializing or unreachable
const memoryRateLimitStore = new Map();

/**
 * Fallback in-memory rate limit checker.
 * Enforces strict 5 attempts per 15-minute sliding window per IP.
 */
export function checkMemoryRateLimit(ip, now = new Date()) {
  const record = memoryRateLimitStore.get(ip);
  if (!record || record.expiresAt < now) {
    memoryRateLimitStore.set(ip, {
      attempts: 1,
      expiresAt: new Date(now.getTime() + WINDOW_MS),
    });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    const minutesLeft = Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 60000));
    return {
      allowed: false,
      isLockedOut: true,
      remaining: 0,
      message: `Too many failed login attempts. Access temporarily restricted. Try again in ${minutesLeft} minute(s).`,
    };
  }

  record.attempts += 1;
  return {
    allowed: true,
    remaining: Math.max(0, MAX_ATTEMPTS - record.attempts),
  };
}

export function clearMemoryRateLimit(ip) {
  memoryRateLimitStore.delete(ip);
}

/**
 * Validates and extracts a trusted client IP address from request headers.
 */
export function extractClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  const realIp = request.headers.get('x-real-ip');
  const forwarded = request.headers.get('x-forwarded-for');

  let rawIp = cfIp || realIp;
  if (!rawIp && forwarded) {
    rawIp = forwarded.split(',')[0].trim();
  }
  if (!rawIp) {
    rawIp = '127.0.0.1';
  }

  const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^[a-fA-F0-9:]+$/;

  const cleanIp = rawIp.trim();
  if (ipv4Regex.test(cleanIp) || (ipv6Regex.test(cleanIp) && cleanIp.includes(':'))) {
    return cleanIp;
  }

  return '127.0.0.1';
}

/**
 * Checks persistent rate limit for the given IP address.
 * Primary: Database store (loginAttempt table).
 * Fallback: In-memory sliding window store if DB table is initializing or unreachable.
 * Never fails closed with a 503 error; brute-force protection is strictly preserved in all cases.
 */
export async function checkPersistentRateLimit(ip) {
  const now = new Date();

  try {
    // 1. Look up existing attempt record
    const record = await prisma.loginAttempt.findUnique({
      where: { ip },
    });

    if (record) {
      // If locked out and window still active
      if (record.expiresAt > now && record.attempts >= MAX_ATTEMPTS) {
        const minutesLeft = Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 60000));
        return {
          allowed: false,
          isLockedOut: true,
          remaining: 0,
          message: `Too many failed login attempts. Access temporarily restricted. Try again in ${minutesLeft} minute(s).`,
        };
      }

      // If window expired, reset
      if (record.expiresAt <= now) {
        await prisma.loginAttempt.update({
          where: { ip },
          data: {
            attempts: 1,
            expiresAt: new Date(now.getTime() + WINDOW_MS),
          },
        }).catch(() => {});
        return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
      }

      // Increment attempt count within current window
      const updated = await prisma.loginAttempt.update({
        where: { ip },
        data: {
          attempts: { increment: 1 },
        },
      });

      return {
        allowed: true,
        remaining: Math.max(0, MAX_ATTEMPTS - updated.attempts),
      };
    }

    // No existing record: create first attempt
    await prisma.loginAttempt.create({
      data: {
        ip,
        attempts: 1,
        expiresAt: new Date(now.getTime() + WINDOW_MS),
      },
    });

    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  } catch (err) {
    console.warn('[RateLimiter] Database store unavailable, enforcing rate limiting via memory store:', err.message || err);
    // Graceful fallback: maintain rate limiting in memory without blocking legitimate logins
    return checkMemoryRateLimit(ip, now);
  }
}

/**
 * Clears rate limit record upon successful authentication.
 */
export async function clearPersistentRateLimit(ip) {
  clearMemoryRateLimit(ip);
  try {
    await prisma.loginAttempt.deleteMany({
      where: { ip },
    });
  } catch {
    // Non-fatal if database is temporarily unreachable
  }
}
