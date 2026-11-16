import prisma from '@/lib/prisma';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window

/**
 * Validates and extracts a trusted client IP address from request headers.
 */
export function extractClientIp(request) {
  // Check headers in order of precedence: Cloudflare, reverse proxy, forwarded header
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

  // Validate IPv4 or IPv6 format to prevent header injection
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
 * Fails closed: if storage is unreachable or encounters an error, returns isServiceUnavailable: true.
 * Uses atomic transactions to prevent race conditions during concurrent attempts.
 */
export async function checkPersistentRateLimit(ip) {
  try {
    const now = new Date();

    // Clean expired attempts
    await prisma.loginAttempt.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    }).catch(() => {
      // Non-fatal if deleteMany fails; will be handled in transaction
    });

    // Atomic transaction for concurrency safety
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.loginAttempt.findUnique({
        where: { ip },
      });

      if (!record) {
        // First attempt in current window
        await tx.loginAttempt.create({
          data: {
            ip,
            attempts: 1,
            expiresAt: new Date(Date.now() + WINDOW_MS),
          },
        });
        return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
      }

      // Check if window expired
      if (record.expiresAt < now) {
        // Reset window
        await tx.loginAttempt.update({
          where: { ip },
          data: {
            attempts: 1,
            expiresAt: new Date(Date.now() + WINDOW_MS),
          },
        });
        return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
      }

      // Check lockout threshold
      if (record.attempts >= MAX_ATTEMPTS) {
        const minutesLeft = Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 60000));
        return {
          allowed: false,
          isLockedOut: true,
          remaining: 0,
          message: `Too many failed login attempts. Access temporarily restricted. Try again in ${minutesLeft} minute(s).`,
        };
      }

      // Increment attempt count
      const updated = await tx.loginAttempt.update({
        where: { ip },
        data: {
          attempts: { increment: 1 },
        },
      });

      return {
        allowed: true,
        remaining: Math.max(0, MAX_ATTEMPTS - updated.attempts),
      };
    });

    return result;
  } catch (err) {
    console.error('CRITICAL: Persistent rate limiter storage error:', err);
    // FAIL CLOSED: Do not allow unlimited attempts when rate limiter is down
    return {
      allowed: false,
      isServiceUnavailable: true,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Authentication rate limiter service is temporarily unavailable. Please retry in a few moments.',
    };
  }
}

/**
 * Clears rate limit record upon successful authentication.
 */
export async function clearPersistentRateLimit(ip) {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { ip },
    });
  } catch (err) {
    console.error('Error clearing rate limit for IP:', ip, err);
  }
}
