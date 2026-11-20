/** Müşterinin kendi tedarikçisinden aldığı yazılı onayın kaydı ve geçerlilik kontrolü (saf fonksiyonlar). */
export const CONSENT_SCOPES = {
  active_vuln: "Aktif zafiyet taraması",
  deep_fourth_party: "Derin dördüncü taraf kontrolü",
  config_readonly: "Salt-okunur bulut/kimlik yapılandırma kontrolü",
} as const;
export type ConsentScope = keyof typeof CONSENT_SCOPES;

export interface ConsentRecord { scopes: string[]; validFrom: Date; validUntil: Date; revokedAt: Date | null }

export const MAX_CONSENT_DAYS = 365;

export interface ConsentInput {
  scopes: ConsentScope[]; signerName: string; signerTitle: string | null; validFrom: Date; validUntil: Date; note: string | null;
}

export function validateConsentInput(raw: unknown, now = new Date()): { ok: true; value: ConsentInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Geçersiz istek" };
  const o = raw as Record<string, unknown>;
  const scopes = Array.isArray(o["scopes"]) ? [...new Set(o["scopes"].filter((s): s is ConsentScope => typeof s === "string" && s in CONSENT_SCOPES))] : [];
  if (!scopes.length) return { ok: false, error: "En az bir kapsam seçin" };
  const signerName = typeof o["signerName"] === "string" ? o["signerName"].trim().slice(0, 120) : "";
  if (!signerName) return { ok: false, error: "Onay veren kişinin adı zorunlu" };
  const signerTitle = typeof o["signerTitle"] === "string" && o["signerTitle"].trim() ? o["signerTitle"].trim().slice(0, 120) : null;
  const validFrom = new Date(String(o["validFrom"] ?? ""));
  const validUntil = new Date(String(o["validUntil"] ?? ""));
  if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) return { ok: false, error: "Geçerlilik tarihleri hatalı" };
  if (validUntil <= validFrom) return { ok: false, error: "Bitiş tarihi başlangıçtan sonra olmalı" };
  if (validUntil <= now) return { ok: false, error: "Bitiş tarihi geçmişte olamaz" };
  if ((validUntil.getTime() - validFrom.getTime()) / 86_400_000 > MAX_CONSENT_DAYS) return { ok: false, error: `Onay süresi en fazla ${MAX_CONSENT_DAYS} gün olabilir` };
  const note = typeof o["note"] === "string" && o["note"].trim() ? o["note"].trim().slice(0, 500) : null;
  return { ok: true, value: { scopes, signerName, signerTitle, validFrom, validUntil, note } };
}

/** Kapsam için geçerli (iptal edilmemiş, süresi dolmamış, başlamış) bir onay var mı? Derin testlerin tek kapısı. */
export function hasValidConsent(records: ConsentRecord[], scope: ConsentScope, now = new Date()): boolean {
  return records.some((r) => !r.revokedAt && r.scopes.includes(scope) && r.validFrom <= now && now < r.validUntil);
}
