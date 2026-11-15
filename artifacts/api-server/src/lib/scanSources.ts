/**
 * Tarama veri kaynaklarının durumu.
 *
 * Her tarama hangi dış kaynağın gerçekten veri döndürdüğünü `domain_scans.source_status`
 * alanına yazar. Böylece:
 *   - API key'i girilmemiş ya da hata veren bir kaynak "temiz" sonuç gibi görünmez,
 *   - Skor v2 o sinyali "ölçülmedi" sayar (kapsam/coverage düşer, puan şişmez),
 *   - TPRM raporu müşteriye hangi kaynakların ne zaman kontrol edildiğini gösterebilir.
 */

import { providerUsable, type ProviderId } from "./providerPlans";

export type ScanSourceKey =
  | "shodan"
  | "virustotal"
  | "abuseipdb"
  | "safebrowsing"
  | "otx"
  | "hibp"
  | "http_headers"
  | "urlhaus";

/** license_restricted = key var ama paketin lisansı ticari kullanıma izin vermiyor (COMMERCIAL_MODE). */
export type ScanSourceState = "ok" | "not_configured" | "unavailable" | "license_restricted";

export interface ScanSourceStatusEntry {
  status: ScanSourceState;
  /** Kaynağın kendi veri tarihi (ör. Shodan'ın IP'yi en son taradığı zaman). */
  lastUpdate?: string | null;
}

export type ScanSourceStatusMap = Partial<Record<ScanSourceKey, ScanSourceStatusEntry>>;

/** API key gerektiren kaynaklar ve ortam değişkenleri. null = key gerekmez. */
export const SCAN_SOURCE_ENV: Record<ScanSourceKey, string | null> = {
  shodan: "SHODAN_API_KEY",
  virustotal: "VIRUSTOTAL_API_KEY",
  abuseipdb: "ABUSEIPDB_API_KEY",
  safebrowsing: "GOOGLE_SAFE_BROWSING_API_KEY",
  otx: "OTX_API_KEY",
  hibp: null,
  http_headers: null,
  urlhaus: null,
};

/** Lisans/paket kuralı olan kaynaklar → sağlayıcı kaydındaki karşılıkları. */
const SOURCE_PROVIDERS: Partial<Record<ScanSourceKey, ProviderId[]>> = {
  shodan: ["shodan"],
  virustotal: ["virustotal"],
  abuseipdb: ["abuseipdb"],
  // Web Risk (ticari) varsa o, yoksa Safe Browsing (ticari olmayan) kullanılır.
  safebrowsing: ["webrisk", "safebrowsing"],
};

export const SCAN_SOURCE_LABELS: Record<ScanSourceKey, string> = {
  shodan: "Shodan (açık port / servis)",
  virustotal: "VirusTotal (zararlı içerik)",
  abuseipdb: "AbuseIPDB (IP kötüye kullanım)",
  safebrowsing: "Google Safe Browsing",
  otx: "AlienVault OTX",
  hibp: "Have I Been Pwned (veri sızıntısı)",
  http_headers: "HTTP güvenlik başlıkları",
  urlhaus: "URLhaus (zararlı yazılım)",
};

export function isSourceConfigured(key: ScanSourceKey): boolean {
  return sourceAvailability(key).usable;
}

/** Kaynak bu ortamda kullanılabilir mi; değilse neden (key yok / lisans). */
export function sourceAvailability(key: ScanSourceKey): { usable: boolean; reason?: "not_configured" | "license_restricted" } {
  const providers = SOURCE_PROVIDERS[key];
  if (providers) {
    let reason: "not_configured" | "license_restricted" = "not_configured";
    for (const id of providers) {
      const u = providerUsable(id);
      if (u.usable) return { usable: true };
      if (u.reason === "license_restricted") reason = "license_restricted";
    }
    return { usable: false, reason };
  }
  const env = SCAN_SOURCE_ENV[key];
  return env === null || !!process.env[env] ? { usable: true } : { usable: false, reason: "not_configured" };
}

/**
 * Bir kontrolün sonucundan durum üretir.
 * Sözleşme: kontrol fonksiyonu ölçemediğinde null döner (veya `failed: true`).
 */
export function sourceEntry(
  key: ScanSourceKey,
  result: unknown,
  opts: { failed?: boolean; lastUpdate?: string | null } = {},
): ScanSourceStatusEntry {
  const avail = sourceAvailability(key);
  if (!avail.usable) return { status: avail.reason ?? "not_configured" };
  if (result === null || result === undefined || opts.failed) return { status: "unavailable" };
  return opts.lastUpdate !== undefined ? { status: "ok", lastUpdate: opts.lastUpdate } : { status: "ok" };
}

/** Key'i tanımlı olmayan tarama kaynakları (açılışta uyarı ve admin paneli için). */
// Not: safebrowsing için GOOGLE_SAFE_BROWSING_API_KEY yerine WEB_RISK_API_KEY de yeterlidir.
export function missingScanSourceKeys(): Array<{ key: ScanSourceKey; env: string; reason: "not_configured" | "license_restricted" }> {
  return (Object.keys(SCAN_SOURCE_ENV) as ScanSourceKey[])
    .filter((k) => SCAN_SOURCE_ENV[k] !== null)
    .map((k) => ({ k, a: sourceAvailability(k) }))
    .filter(({ a }) => !a.usable)
    .map(({ k, a }) => ({
      key: k,
      env: k === "safebrowsing" ? "WEB_RISK_API_KEY (ya da GOOGLE_SAFE_BROWSING_API_KEY)" : SCAN_SOURCE_ENV[k]!,
      reason: a.reason ?? "not_configured",
    }));
}

/** Kaynak ölçüldü mü? Durum kaydı yoksa (eski taramalar) eski davranış korunur. */
export function sourceMeasured(map: ScanSourceStatusMap | null | undefined, key: ScanSourceKey): boolean {
  const entry = map?.[key];
  return !entry || entry.status === "ok";
}
