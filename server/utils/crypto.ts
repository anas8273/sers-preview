/**
 * server/utils/crypto.ts
 * Centralized password hashing utilities — single source of truth.
 * Both db.ts (seed) and routers.ts (login/register) must import from here
 * to guarantee the same PBKDF2 parameters are always used.
 */
import crypto from "crypto";

const SALT_LENGTH = 32;
const KEY_LENGTH  = 64;
const ITERATIONS  = 100_000;
const DIGEST      = "sha512";

/**
 * Hash a plaintext password using PBKDF2-sha512.
 * Returns `salt:hex` string.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

/**
 * Verify a plaintext password against a stored `salt:hex` hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    if (!salt || !key) { resolve(false); return; }
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) { reject(err); return; }
      try {
        const derivedHex = Buffer.from(derivedKey.toString("hex"));
        const storedHex  = Buffer.from(key);
        resolve(
          derivedHex.length === storedHex.length &&
          crypto.timingSafeEqual(derivedHex, storedHex)
        );
      } catch {
        resolve(false);
      }
    });
  });
}
