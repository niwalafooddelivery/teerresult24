import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { checkPersistentRateLimit, clearPersistentRateLimit, extractClientIp } from '@/lib/rate-limiter';
import { getCloudflareContext } from '@opennextjs/cloudflare';

function getRuntimeConfig(key, fallback = '') {
  try {
    const cf = getCloudflareContext();
    if (cf?.env?.[key]) return cf.env[key];
  } catch {}
  return process.env[key] || fallback;
}

export async function POST(request) {
  try {
    const ip = extractClientIp(request);

    // 1. Persistent Shared Rate Limit Check with graceful memory fallback
    // Strictly enforces max 5 failed attempts per 15-minute sliding window
    const rateCheck = await checkPersistentRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: rateCheck.message },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    let admin = null;
    let isPasswordMatch = false;

    // 2. Query database for existing admin user
    try {
      admin = await prisma.adminUser.findUnique({
        where: { username: cleanUsername },
      });
    } catch (dbErr) {
      console.warn('[AdminLogin] Database query for AdminUser failed (table may be unmigrated):', dbErr.message || dbErr);
    }

    // 3. Authenticate against database hash if user exists
    if (admin && admin.passwordHash) {
      isPasswordMatch = await bcrypt.compare(password, admin.passwordHash);
    } else {
      // Fallback: If DB table is empty or unmigrated, check against configured environment admin credentials
      const configuredUser = getRuntimeConfig('ADMIN_USERNAME', 'admin');
      const configuredPass = getRuntimeConfig('ADMIN_INITIAL_PASSWORD', 'TeerAdmin#2026!SecureKey');

      if (cleanUsername === configuredUser && password === configuredPass) {
        isPasswordMatch = true;
        admin = {
          id: 'admin_initial',
          username: configuredUser,
          name: 'Editorial Desk',
          role: 'ADMIN',
        };

        // Try to seed the admin user into the database in the background if table exists
        try {
          const hash = await bcrypt.hash(configuredPass, 12);
          await prisma.adminUser.create({
            data: {
              username: configuredUser,
              passwordHash: hash,
              name: 'Editorial Desk',
              role: 'ADMIN',
            },
          }).catch(() => {});
        } catch {}
      }
    }

    // 4. Invalid credentials check
    if (!isPasswordMatch || !admin) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // 5. Successful authentication: Clear rate limit record for this IP
    await clearPersistentRateLimit(ip);

    // 6. Generate authenticated JWT
    const token = signToken({
      id: admin.id,
      username: admin.username,
      name: admin.name || 'Editorial Desk',
      role: admin.role || 'ADMIN',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name || 'Editorial Desk',
      },
    });

    // 7. Set Secure HttpOnly Session Cookie (7 days)
    response.cookies.set('teer_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    // Safe error logging: logs error type/message without revealing passwords
    console.error('[AdminLogin] Error during authentication:', error.message || error);
    return NextResponse.json(
      { success: false, error: 'Authentication service encountered an internal error' },
      { status: 500 }
    );
  }
}
