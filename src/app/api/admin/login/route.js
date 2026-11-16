import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { checkPersistentRateLimit, clearPersistentRateLimit, extractClientIp } from '@/lib/rate-limiter';

export async function POST(request) {
  try {
    const ip = extractClientIp(request);

    // 1. Persistent Shared Store Rate Limit Check (Fail Closed)
    const rateCheck = await checkPersistentRateLimit(ip);
    if (!rateCheck.allowed) {
      if (rateCheck.isServiceUnavailable) {
        return NextResponse.json(
          { success: false, error: rateCheck.message },
          { status: 503, headers: { 'Retry-After': '30' } }
        );
      }
      return NextResponse.json(
        { success: false, error: rateCheck.message },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username: username.trim() },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Success: clear rate limit attempts for this IP
    await clearPersistentRateLimit(ip);

    const token = signToken({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });

    // Secure HttpOnly Cookie
    response.cookies.set('teer_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service encountered an internal error' },
      { status: 500 }
    );
  }
}
