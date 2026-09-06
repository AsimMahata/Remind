import crypto from 'crypto';
import { ENV } from '../config/env';

// Derive 32-byte key from ADMIN_PASSWORD using scrypt
const SALT = 'remind_admin_encryption_salt_2026';
const ALGORITHM = 'aes-256-gcm';

function getDerivedKey(): Buffer {
  return crypto.scryptSync(ENV.ADMIN_PASSWORD || 'default_admin_pass', SALT, 32);
}

/**
 * Encrypt any payload/string/object with AES-256-GCM using derived key from admin password
 * Returns formatted string: "iv:authTag:ciphertext" (hex encoded)
 */
export function encryptPayload(data: unknown): string {
  if (data === null || data === undefined) return '';

  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const key = getDerivedKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt string encrypted with encryptPayload
 * Returns the original string or parsed object
 */
export function decryptPayload<T = unknown>(encryptedData: string): T {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData as unknown as T;
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    // Return as-is if not in encrypted format
    return encryptedData as unknown as T;
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getDerivedKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}
