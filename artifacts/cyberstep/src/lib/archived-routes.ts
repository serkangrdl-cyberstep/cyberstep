/**
 * Arşivlenen bölümler — TPRM odaklı yeniden yapılanma (Kasım 2026).
 *
 * Bu sayfaların kodu SİLİNMEDİ: route'lar App.tsx'te duruyor, ama bu listede
 * olduğu sürece ziyaretçi yönlendirilir ve menülerde/footer'da görünmez.
 * Bir bölümü geri açmak için ilgili satırı bu listeden silmek yeterli.
 *
 * Değişiklik öncesi sitenin tam hâli GitHub'daki `arsiv/oncesi-tprm-2026-11`
 * branch'inde duruyor (bkz. docs/ARSIV.md).
 */

/** Public sayfalar → ana sayfaya yönlenir. Alt yollar da (örn. /ai-red-team/12) kapsanır. */
export const ARCHIVED_PUBLIC: readonly string[] = [
  // Servis kataloğu
  "/hizmetler", "/servisler", "/satin-al",
  // AI güvenlik paketi
  "/ai-guvenlik", "/ai-guvenlik-degerlendirmesi", "/ai-phishing-simulasyonu", "/ai-arac-izleme",
  "/ai-politika", "/ai-red-team", "/eu-ai-act", "/ciso-asistan-paketi", "/vciso-erken-erisim",
  // Deepfake / sahte doküman
  "/deepfake-analizi", "/sahte-dokuman",
  // Phishing / pentest / BAS
  "/phishing-sim", "/pentest-lite", "/bas-lite", "/saldiri-simulasyonu",
  // ERP / M365
  "/erp-tarama", "/erp-entegrasyonu", "/m365-denetim",
  // SOC / tehdit istihbaratı ve diğer yan ürünler
  "/tehdit-istihbarati", "/zero-day-uyari", "/github-tarama", "/tarayici-eklentisi",
  "/on-premise", "/technology-discovery", "/sigorta-pazaryeri",
];

/** Müşteri portalı (/hesabim) sayfaları → /hesabim'e yönlenir. */
export const ARCHIVED_PORTAL: readonly string[] = [
  "/hesabim/soc", "/hesabim/noc", "/hesabim/noc-kurulum", "/hesabim/cloud-guvenlik",
  "/hesabim/ioc-log", "/hesabim/ioc-sorgu", "/hesabim/whitelist", "/hesabim/ic-tarama",
  "/hesabim/ciso-asistan", "/hesabim/technology-discovery", "/hesabim/servislerim", "/hesabim/sepet",
];

/**
 * Yönetim paneli (/panel) sayfaları → /panel'e yönlenir ve admin menüsünde görünmez.
 * Arka uç uç noktaları ve cron'lar çalışmaya devam eder; yalnızca panel ekranları gizlidir.
 */
export const ARCHIVED_ADMIN: readonly string[] = [
  // Servis kataloğu ve eski paketler
  "/panel/fiyatlar", "/panel/servis-fiyatlari", "/panel/servis-katalogu", "/panel/servis-yonetimi",
  "/panel/musteri-servisleri", "/panel/muhasebe", "/panel/is-paketleri",
  // Müşteri başarı (eski KOBİ modeli)
  "/panel/saglik", "/panel/nps", "/panel/onboarding", "/panel/referrallar",
  "/panel/rozet-avantajlari", "/panel/exposure-score", "/panel/ic-tarama",
  // İstihbarat / teknografi
  "/panel/tech-intelligence", "/panel/technology-discovery", "/panel/intelligence", "/panel/cti-istihbarat",
  "/panel/reputation-monitor", "/panel/brand-monitor", "/panel/data-leakage", "/panel/executive-dashboard",
  // SOC / NOC / entegrasyonlar
  "/panel/soc", "/panel/noc", "/panel/observability", "/panel/fortinet",
  "/panel/ms365", "/panel/servicenow", "/panel/ioc-kontroller", "/panel/kod-guvenligi",
  "/panel/remediation", "/panel/dns-izleme", "/panel/ct-izleme", "/panel/kvkk",
  // Ortaklık ve kurumsal yan ürünler
  "/panel/danismanlik", "/panel/partnerlar", "/panel/whitelabel", "/panel/kariyer",
  // Marketing paneline taşınanlar (/digest/)
  "/panel/ozel-gunler", "/panel/sosyal-medya", "/panel/demo-raporlar", "/panel/rozetler",
  "/panel/marka-kilavuzu",
];

/** Özel hedefe yönlenen arşiv sayfaları (içeriği başka bir sayfaya taşınanlar). */
export const ARCHIVED_REDIRECT_TO: Readonly<Record<string, string>> = {
  "/neden-cyberstep": "/hakkimizda", // isim hikayesi ve ekip yeni Hakkımızda sayfasında
};

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "#") || path.startsWith(prefix + "?");
}

/** Arşivlenmiş bir yolsa yönlendirilecek adresi döner; değilse null. */
export function archivedRedirect(path: string): string | null {
  const p = path.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "") || "/";
  for (const [from, to] of Object.entries(ARCHIVED_REDIRECT_TO)) if (matches(p, from)) return to;
  if (ARCHIVED_ADMIN.some((r) => matches(p, r))) return "/panel";
  if (ARCHIVED_PORTAL.some((r) => matches(p, r))) return "/hesabim";
  if (ARCHIVED_PUBLIC.some((r) => matches(p, r))) return "/";
  return null;
}

/** Menü/footer bağlantılarını süzmek için. */
export function isArchived(href: string): boolean {
  return archivedRedirect(href) !== null;
}
