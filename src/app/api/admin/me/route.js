import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = request.cookies.get('teer_admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { authenticated: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.id,
        username: payload.username,
        name: payload.name,
        role: payload.role,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { authenticated: false, error: 'Authentication check failed' },
      { status: 500 }
    );
  }
}
