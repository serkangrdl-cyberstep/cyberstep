import crypto from "crypto";
import { logger } from "../lib/logger";

// AES-256-GCM encryption for FortiManager credentials.
// Key comes from the ENCRYPTION_KEY env var (64 hex chars = 32 bytes).

function getKey(): Buffer | null {
  const raw = process.env["ENCRYPTION_KEY"];
  if (!raw) return null;
  // Accept hex (64 chars) or fall back to sha256 of an arbitrary string.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptionAvailable(): boolean {
  return getKey() !== null;
}

export function encryptSecret(plain: string): string | null {
  const key = getKey();
  if (!key) {
    logger.warn("ENCRYPTION_KEY not set — cannot encrypt FortiManager credential");
    return null;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const key = getKey();
  if (!key) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    logger.error({ err }, "Failed to decrypt FortiManager credential");
    return null;
  }
}

export function generateToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}
