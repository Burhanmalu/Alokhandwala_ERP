import crypto from 'crypto';

const SCRYPT_PREFIX = 'scrypt$';
const KEY_LEN = 64;

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LEN).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}

export function verifyPassword(plainPassword: string, storedPassword?: string | null): boolean {
  if (!plainPassword || !storedPassword) return false;

  if (storedPassword.startsWith(SCRYPT_PREFIX)) {
    const parts = storedPassword.slice(SCRYPT_PREFIX.length).split('$');
    if (parts.length !== 2) return false;
    const [salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;
    const derived = crypto.scryptSync(plainPassword, salt, KEY_LEN);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  // Legacy plaintext fallback for non-migrated accounts
  const a = Buffer.from(plainPassword, 'utf8');
  const b = Buffer.from(storedPassword, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _removed, ...rest } = user;
  return rest;
}

