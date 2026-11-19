/**
 * Destek erişimi: müşterinin tedarikçi listesi ticari veridir; yönetici yalnızca müşterinin onayladığı,
 * süreli bir izinle (ve her görüntüleme kayıt altına alınarak) görebilir. Saf yardımcılar (db'ye bağımlı değil).
 */
export type GrantState = "pending" | "active" | "expired" | "declined" | "revoked";

export const SUPPORT_SCOPE = "tprm_vendors";
export const DEFAULT_HOURS = 24;
export const MAX_HOURS = 72;
export const MIN_REASON_LENGTH = 10;

export function grantState(g: { status: string; expiresAt: Date | string | null }, now: Date = new Date()): GrantState {
  if (g.status === "pending") return "pending";
  if (g.status === "declined") return "declined";
  if (g.status === "revoked") return "revoked";
  if (g.status === "approved") {
    const exp = g.expiresAt ? new Date(g.expiresAt).getTime() : 0;
    return exp > now.getTime() ? "active" : "expired";
  }
  return "expired";
}

export function clampHours(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HOURS;
  return Math.min(MAX_HOURS, Math.max(1, Math.round(n)));
}

export function validReason(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length >= MIN_REASON_LENGTH && s.length <= 500 ? s : null;
}

/** Yeni istek açılabilir mi: bekleyen veya aktif izin varken ikincisi açılmaz. */
export function canRequestNew(states: GrantState[]): boolean {
  return !states.some((s) => s === "pending" || s === "active");
}
