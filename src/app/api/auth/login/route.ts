import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { sanitizeUser, verifyPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await dbStore.ensureSynced();
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Please enter your corporate email address.' },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Please enter your password.' },
        { status: 400 }
      );
    }

    const user = dbStore.getUsers().find((u) => u.email.toLowerCase() === email);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address. Please use your authorized ALOKHANDWALA corporate email.',
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account has been deactivated. Please contact your Super Administrator.',
        },
        { status: 403 }
      );
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password. Please verify your credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: true, data: sanitizeUser(user) },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}

