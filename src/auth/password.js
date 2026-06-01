import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// scrypt cost parameters. N=2^15 is a sensible interactive-login cost.
const N = 32768;
const r = 8;
const p = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAXMEM = 128 * 1024 * 1024;

/** Hash a plaintext password. Returns a self-describing string safe to store. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Verify a plaintext password against a stored hash, in constant time. */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, nStr, rStr, pStr, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scrypt(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: MAXMEM,
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
