/** Doğrulama geçerlilik süresi: 12 ay. Bitişten 30 gün önce "yaklaşıyor" sayılır. */
export const VERIFY_VALID_DAYS = 365;
export const VERIFY_WARN_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type VerificationStatus = "verified" | "expiring" | "expired" | "never";

/** Bağımsız rapor türleri (doğrulamaya eklenebilir). */
export const EVIDENCE_TYPES: Record<string, string> = {
  iso27001: "ISO 27001", soc2: "SOC 2", denetim: "Bağımsız denetim raporu", sizma_testi: "Sızma testi raporu", diger: "Diğer",
};

/**
 * Doğrulama 12 ay geçerlidir; bağımsız rapor geçerlilik bitişi daha erkense doğrulama o tarihte biter.
 */
export function verificationOf(lastVerifiedAt: Date | null | undefined, now = new Date(), evidenceUntil?: Date | null): { status: VerificationStatus; dueAt: Date | null } {
  if (!lastVerifiedAt) return { status: "never", dueAt: null };
  let dueAt = new Date(lastVerifiedAt.getTime() + VERIFY_VALID_DAYS * DAY);
  if (evidenceUntil && evidenceUntil.getTime() < dueAt.getTime()) dueAt = evidenceUntil;
  const left = dueAt.getTime() - now.getTime();
  if (left <= 0) return { status: "expired", dueAt };
  if (left <= VERIFY_WARN_DAYS * DAY) return { status: "expiring", dueAt };
  return { status: "verified", dueAt };
}

/** Doğrulama isteğinden rapor bilgisini ayıklar: tür verilmişse geçerli ve ileri bir bitiş tarihi zorunludur. */
export function parseEvidence(rawType: unknown, rawUntil: unknown, now = new Date()): { ok: true; type: string | null; until: Date | null } | { ok: false; error: string } {
  const type = typeof rawType === "string" && rawType ? rawType : null;
  if (!type) return { ok: true, type: null, until: null };
  if (!(type in EVIDENCE_TYPES)) return { ok: false, error: "Geçersiz rapor türü" };
  const until = new Date(String(rawUntil ?? ""));
  if (isNaN(until.getTime())) return { ok: false, error: "Rapor geçerlilik bitiş tarihini girin" };
  if (until.getTime() <= now.getTime()) return { ok: false, error: "Rapor geçerlilik tarihi geçmiş; güncel bir rapor girin" };
  return { ok: true, type, until };
}
