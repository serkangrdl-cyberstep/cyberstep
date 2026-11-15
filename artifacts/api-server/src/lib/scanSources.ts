/**
 * Tarama veri kaynaklarının durumu.
 *
 * Her tarama hangi dış kaynağın gerçekten veri döndürdüğünü `domain_scans.source_status`
 * alanına yazar. Böylece:
 *   - API key'i girilmemiş ya da hata veren bir kaynak "temiz" sonuç gibi görünmez,
 *   - Skor v2 o sinyali "ölçülmedi" sayar (kapsam/coverage düşer, puan şişmez),
 *   - TPRM raporu müşteriye hangi kaynakların ne zaman kontrol edildiğini gösterebilir.
 */

export type ScanSourceKey =
  | "shodan"
  | "virustotal"
  | "abuseipdb"
  | "safebrowsing"
  | "otx"
  | "hibp"
  | "http_headers"
  | "urlhaus";

export type ScanSourceState = "ok" | "not_configured" | "unavailable";

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
  const env = SCAN_SOURCE_ENV[key];
  return env === null || !!process.env[env];
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
  if (!isSourceConfigured(key)) return { status: "not_configured" };
  if (result === null || result === undefined || opts.failed) return { status: "unavailable" };
  return opts.lastUpdate !== undefined ? { status: "ok", lastUpdate: opts.lastUpdate } : { status: "ok" };
}

/** Key'i tanımlı olmayan tarama kaynakları (açılışta uyarı ve admin paneli için). */
export function missingScanSourceKeys(): Array<{ key: ScanSourceKey; env: string }> {
  return (Object.keys(SCAN_SOURCE_ENV) as ScanSourceKey[])
    .filter((k) => SCAN_SOURCE_ENV[k] !== null && !process.env[SCAN_SOURCE_ENV[k]!])
    .map((k) => ({ key: k, env: SCAN_SOURCE_ENV[k]! }));
}

/** Kaynak ölçüldü mü? Durum kaydı yoksa (eski taramalar) eski davranış korunur. */
export function sourceMeasured(map: ScanSourceStatusMap | null | undefined, key: ScanSourceKey): boolean {
  const entry = map?.[key];
  return !entry || entry.status === "ok";
}
