import { NextResponse } from 'next/server';
import { validateAdminCode, createAdminSession, ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || !validateAdminCode(code)) {
      return NextResponse.json(
        { success: false, message: 'Invalid admin access code' },
        { status: 401 }
      );
    }

    const token = await createAdminSession();
    const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Server error during login' },
      { status: 500 }
    );
  }
}
