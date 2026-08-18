import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'votepro_secure_admin_jwt_secret_key_5459'
);

const COOKIE_NAME = 'votepro_admin_session';

export async function createAdminSession(): Promise<string> {
  const token = await new SignJWT({ role: 'admin', authenticatedAt: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET_KEY);

  return token;
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.role === 'admin';
  } catch (error) {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) return false;
    return await verifyAdminSessionToken(sessionCookie.value);
  } catch {
    return false;
  }
}

export function validateAdminCode(code: string): boolean {
  const validCode = process.env.ADMIN_ACCESS_CODE || '5459';
  return code.trim() === validCode.trim();
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
