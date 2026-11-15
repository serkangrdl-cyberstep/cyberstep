/**
 * Ücretli veri sağlayıcıları için paket kaydı.
 *
 * Amaç: müşteri bulunduğunda ücretli pakete geçmek kod değişikliği gerektirmesin.
 * Admin paneli → Entegrasyonlar'da (ya da ortam değişkeninde) key ve paket adı girilir,
 * kota sınırları ve lisans kuralları buradan otomatik uygulanır.
 *
 * Fiyatlar Kasım 2026'da sağlayıcıların yayımladığı listelerden alınmıştır (USD/ay).
 * null = teklif bazlı.
 *
 * Ortam değişkenleri (hepsi admin panelinden de girilebilir):
 *   COMMERCIAL_MODE=true      Ücretli müşteriye hizmet veriliyor; ticari kullanımı yasak
 *                             ücretsiz API'ler (VirusTotal Public, Google Safe Browsing) devre dışı kalır.
 *   <SAĞLAYICI>_PLAN=<paket>  ör. SHODAN_PLAN=small_business, ABUSEIPDB_PLAN=basic
 *   <SAĞLAYICI>_DAILY_LIMIT   Günlük kota için elle üst sınır (paketi ezer).
 */

export type ProviderId = "shodan" | "censys" | "abuseipdb" | "virustotal" | "webrisk" | "safebrowsing" | "dehashed" | "hibp";

export interface ProviderPlan {
  id: string;
  label: string;
  usdMonthly: number | null;
  /** Bizim tarafta uygulanan günlük istek sınırı. undefined = sınır yok. */
  dailyLimit?: number;
  /** Bu paket ticari üründe kullanılabilir mi? */
  commercialUse: boolean;
  note?: string;
}

export interface ProviderDef {
  id: ProviderId;
  name: string;
  planEnv: string;
  keyEnvs: string[];
  defaultPlan: string;
  plans: ProviderPlan[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "shodan", name: "Shodan", planEnv: "SHODAN_PLAN", keyEnvs: ["SHODAN_API_KEY"], defaultPlan: "freelancer",
    plans: [
      { id: "membership", label: "Membership", usdMonthly: 0, dailyLimit: 100, commercialUse: false, note: "Tek seferlik $49" },
      { id: "freelancer", label: "Freelancer", usdMonthly: 69, dailyLimit: 2000, commercialUse: true, note: "5.120 IP tarama/ay" },
      { id: "small_business", label: "Small Business", usdMonthly: 359, dailyLimit: 20000, commercialUse: true, note: "65.536 IP tarama/ay" },
      { id: "corporate", label: "Corporate", usdMonthly: 1099, dailyLimit: 80000, commercialUse: true, note: "327.680 IP tarama/ay" },
    ],
  },
  {
    id: "censys", name: "Censys", planEnv: "CENSYS_PLAN", keyEnvs: ["CENSYS_PAT", "CENSYS_ORG_ID"], defaultPlan: "free",
    plans: [
      { id: "free", label: "Free", usdMonthly: 0, dailyLimit: 3, commercialUse: false, note: "100 kredi/ay, yalnızca lookup" },
      { id: "starter", label: "Starter", usdMonthly: 79, dailyLimit: 16, commercialUse: true, note: "500 kredi/ay" },
      { id: "starter_pro", label: "Starter Pro", usdMonthly: 599, dailyLimit: 130, commercialUse: true, note: "4.000 kredi/ay" },
      { id: "enterprise", label: "Enterprise", usdMonthly: null, commercialUse: true, note: "Teklif" },
    ],
  },
  {
    id: "abuseipdb", name: "AbuseIPDB", planEnv: "ABUSEIPDB_PLAN", keyEnvs: ["ABUSEIPDB_API_KEY"], defaultPlan: "individual",
    plans: [
      { id: "individual", label: "Individual (ücretsiz)", usdMonthly: 0, dailyLimit: 1000, commercialUse: true, note: "Ticari şartları kontrol edin" },
      { id: "basic", label: "Basic", usdMonthly: 25, dailyLimit: 10000, commercialUse: true },
      { id: "premium", label: "Premium", usdMonthly: 99, dailyLimit: 50000, commercialUse: true },
    ],
  },
  {
    id: "virustotal", name: "VirusTotal", planEnv: "VIRUSTOTAL_PLAN", keyEnvs: ["VIRUSTOTAL_API_KEY"], defaultPlan: "public",
    plans: [
      { id: "public", label: "Public (ücretsiz)", usdMonthly: 0, dailyLimit: 500, commercialUse: false, note: "Ticari üründe kullanılamaz" },
      { id: "premium", label: "Premium", usdMonthly: null, commercialUse: true, note: "Teklif" },
    ],
  },
  {
    id: "webrisk", name: "Google Web Risk", planEnv: "WEB_RISK_PLAN", keyEnvs: ["WEB_RISK_API_KEY"], defaultPlan: "payg",
    plans: [
      { id: "payg", label: "Kullandıkça öde", usdMonthly: 0, commercialUse: true, note: "100 bin sorgu/ay ücretsiz, sonrası $0,50/1.000" },
    ],
  },
  {
    id: "safebrowsing", name: "Google Safe Browsing", planEnv: "SAFE_BROWSING_PLAN", keyEnvs: ["GOOGLE_SAFE_BROWSING_API_KEY"], defaultPlan: "free",
    plans: [
      { id: "free", label: "Ücretsiz", usdMonthly: 0, dailyLimit: 10000, commercialUse: false, note: "Yalnızca ticari olmayan kullanım" },
    ],
  },
  {
    id: "dehashed", name: "DeHashed", planEnv: "DEHASHED_PLAN", keyEnvs: ["DEHASHED_API_KEY", "DEHASHED_EMAIL"], defaultPlan: "search",
    plans: [
      { id: "search", label: "Search + API kredisi", usdMonthly: 21.99, commercialUse: true, note: "Sorgu başı ~$0,03 kredi" },
    ],
  },
  {
    id: "hibp", name: "Have I Been Pwned", planEnv: "HIBP_PLAN", keyEnvs: ["HIBP_API_KEY"], defaultPlan: "core_1",
    plans: [
      { id: "core_1", label: "Core 1", usdMonthly: 5.29, commercialUse: true, note: "1 alan adı" },
      { id: "core_2", label: "Core 2", usdMonthly: 25.99, commercialUse: true, note: "3 alan adı" },
      { id: "core_3", label: "Core 3", usdMonthly: 43.99, commercialUse: true, note: "5 alan adı" },
      { id: "core_4", label: "Core 4", usdMonthly: 189, commercialUse: true, note: "10 alan adı" },
      { id: "core_5", label: "Core 5", usdMonthly: 379, commercialUse: true, note: "20 alan adı" },
      { id: "pro_1", label: "Pro 1", usdMonthly: 449, commercialUse: true, note: "50 alan adı" },
    ],
  },
];

/** Paket ve mod ayarları — admin panelinden de kaydedilebilir (CONFIGURABLE_API_KEYS). */
export const PLAN_SETTING_KEYS = ["COMMERCIAL_MODE", ...PROVIDERS.map((p) => p.planEnv)];

export function isCommercialMode(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env["COMMERCIAL_MODE"] ?? "").trim().toLowerCase());
}

export function getProvider(id: ProviderId): ProviderDef {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Bilinmeyen sağlayıcı: ${id}`);
  return p;
}

export function currentPlan(id: ProviderId): ProviderPlan {
  const p = getProvider(id);
  const wanted = (process.env[p.planEnv] ?? "").trim().toLowerCase();
  return p.plans.find((x) => x.id === wanted) ?? p.plans.find((x) => x.id === p.defaultPlan) ?? p.plans[0]!;
}

export function isProviderConfigured(id: ProviderId): boolean {
  return getProvider(id).keyEnvs.every((k) => !!process.env[k]);
}

/**
 * Sağlayıcı bu ortamda kullanılabilir mi? Key yoksa ya da ticari modda ücretsiz paketin
 * lisansı ticari kullanıma izin vermiyorsa kullanılmaz.
 */
export function providerUsable(id: ProviderId): { usable: boolean; reason?: "not_configured" | "license_restricted" } {
  if (!isProviderConfigured(id)) return { usable: false, reason: "not_configured" };
  if (isCommercialMode() && !currentPlan(id).commercialUse) return { usable: false, reason: "license_restricted" };
  return { usable: true };
}

/** Paket adı girilmemişken geçerli olan, bugüne kadarki günlük kotalar (davranış değişmesin). */
const LEGACY_DAILY_LIMITS: Record<string, number> = { shodan: 100, virustotal: 500, abuseipdb: 1000 };

/** Günlük kota: <SAĞLAYICI>_DAILY_LIMIT > açıkça seçilmiş paketin sınırı > eski sabit sınır. */
export function dailyLimitFor(service: string): number | undefined {
  const override = parseInt(process.env[`${service.toUpperCase()}_DAILY_LIMIT`] ?? "", 10);
  if (Number.isFinite(override) && override > 0) return override;
  const p = PROVIDERS.find((x) => x.id === service);
  if (p && (process.env[p.planEnv] ?? "").trim()) return currentPlan(p.id).dailyLimit;
  return LEGACY_DAILY_LIMITS[service];
}

/** Admin paneli için özet: paket, durum ve sabit aylık maliyet. */
export function providerSummary() {
  const commercial = isCommercialMode();
  const rows = PROVIDERS.map((p) => {
    const plan = currentPlan(p.id);
    const usable = providerUsable(p.id);
    return {
      id: p.id,
      name: p.name,
      planEnv: p.planEnv,
      keyEnvs: p.keyEnvs,
      configured: isProviderConfigured(p.id),
      usable: usable.usable,
      reason: usable.reason ?? null,
      plan: plan.id,
      planLabel: plan.label,
      usdMonthly: plan.usdMonthly,
      commercialUse: plan.commercialUse,
      note: plan.note ?? null,
      plans: p.plans.map((x) => ({ id: x.id, label: x.label, usdMonthly: x.usdMonthly, commercialUse: x.commercialUse, note: x.note ?? null })),
    };
  });
  const fixedUsd = rows.filter((r) => r.configured && r.usdMonthly != null).reduce((s, r) => s + (r.usdMonthly ?? 0), 0);
  const hasQuote = rows.some((r) => r.configured && r.usdMonthly == null);
  const licenseWarnings = rows
    .filter((r) => r.configured && !r.commercialUse)
    .map((r) => `${r.name} (${r.planLabel}) ticari kullanıma izin vermiyor${commercial ? " — ticari modda devre dışı" : " — COMMERCIAL_MODE açıldığında devre dışı kalacak"}`);
  return { commercialMode: commercial, providers: rows, fixedUsdMonthly: Math.round(fixedUsd * 100) / 100, hasQuote, licenseWarnings };
}
