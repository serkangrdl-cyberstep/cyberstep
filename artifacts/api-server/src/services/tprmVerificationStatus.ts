/** Doğrulama geçerlilik süresi: 12 ay. Bitişten 30 gün önce "yaklaşıyor" sayılır. */
export const VERIFY_VALID_DAYS = 365;
export const VERIFY_WARN_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type VerificationStatus = "verified" | "expiring" | "expired" | "never";

export function verificationOf(lastVerifiedAt: Date | null | undefined, now = new Date()): { status: VerificationStatus; dueAt: Date | null } {
  if (!lastVerifiedAt) return { status: "never", dueAt: null };
  const dueAt = new Date(lastVerifiedAt.getTime() + VERIFY_VALID_DAYS * DAY);
  const left = dueAt.getTime() - now.getTime();
  if (left <= 0) return { status: "expired", dueAt };
  if (left <= VERIFY_WARN_DAYS * DAY) return { status: "expiring", dueAt };
  return { status: "verified", dueAt };
}
