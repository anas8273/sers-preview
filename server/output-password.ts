import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "scrypt-v1";
const SCRYPT_KEY_LENGTH = 32;
const LEGACY_SHA256 = /^[a-f0-9]{64}$/i;

export function hashProtectedOutputPassword(password: string) {
  if (password.length < 6 || password.length > 128) throw new Error("Invalid protected output password length");
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `${SCRYPT_PREFIX}$${salt.toString("hex")}$${digest.toString("hex")}`;
}

function safeEqualHex(leftHex: string, rightHex: string) {
  if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyProtectedOutputPassword(password: string, storedHash: string) {
  if (!password || !storedHash) return false;
  const [prefix, saltHex, digestHex] = storedHash.split("$");
  if (prefix === SCRYPT_PREFIX && saltHex && digestHex) {
    try {
      const digest = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEY_LENGTH).toString("hex");
      return safeEqualHex(digest, digestHex);
    } catch {
      return false;
    }
  }

  // Transitional compatibility for links created before the scrypt policy was introduced.
  if (LEGACY_SHA256.test(storedHash)) {
    const digest = createHash("sha256").update(password, "utf8").digest("hex");
    return safeEqualHex(digest, storedHash);
  }
  return false;
}
