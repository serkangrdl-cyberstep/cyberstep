/**
 * Şifreleme Servisi (AES-256-GCM)
 * IMAP/SMTP şifreleri gibi hassas alanlar için.
 * ENCRYPTION_KEY: 64 hex karakter (32 byte) — Replit Secret olarak saklanır.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const hexKey = process.env["ENCRYPTION_KEY"];
  if (!hexKey || hexKey.length < 64) {
    throw new Error("ENCRYPTION_KEY env var must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(hexKey.slice(0, 64), "hex");
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false;
  try {
    Buffer.from(value, "base64");
    return true;
  } catch {
    return false;
  }
}
