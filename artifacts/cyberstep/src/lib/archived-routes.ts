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
  "/hizmetler", "/servisler", "/satin-al", "/demo",
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
  // Eski tek seferlik paket fiyatlı sayfalar (TPRM fiyatlandırmasıyla çelişiyordu)
  "/sanal-ciso", "/ma-due-diligence", "/sektor",
  // TPRM dışı (Kasım 2026, 2. tur): sektör/uyum çözümleri, hesaplayıcılar, KVKK araçları, marka ve sızıntı izleme
  "/dora-bddk-uyum", "/siber-sigorta", "/marka-koruma", "/rakip-karsilastirma", "/roi-hesaplayici",
  "/finansal-kayip", "/kvkk-ceza-sim", "/kvkk-verbis", "/kvkk-dpa-olustur", "/kep-rehberi",
  "/compliance-calendar", "/veri-sizintisi", "/sizinti-izleyici", "/sektorel-kiyaslama", "/siber-panik",
  "/is-ortakligi",
  "/araclar/kvkk-ceza-hesaplayici", "/araclar/siber-risk-roi", "/araclar/dark-web-sorgulama",
  "/araclar/WAF-bypass-tarayıcı", "/araclar/WAF-bypass-taray%C4%B1c%C4%B1",
  // Partner portalı ve beyaz etiket (TPRM odağı, 3. tur)
  "/ortak", "/w",
  // Teaser e-postası önizleme sayfası (teaser akışı kaldırıldı, 26 Kasım 2026)
  "/preview",
];

/** Müşteri portalı (/hesabim) sayfaları → /hesabim'e yönlenir. */
export const ARCHIVED_PORTAL: readonly string[] = [
  "/hesabim/soc", "/hesabim/noc", "/hesabim/noc-kurulum", "/hesabim/cloud-guvenlik",
  "/hesabim/ioc-log", "/hesabim/ioc-sorgu", "/hesabim/whitelist", "/hesabim/ic-tarama",
  "/hesabim/ciso-asistan", "/hesabim/technology-discovery", "/hesabim/servislerim", "/hesabim/sepet",
  // Eski ürün sayfaları (TPRM odağı, portal sadeleştirme)
  "/hesabim/bulgularim", "/hesabim/guvenlik-durumu", "/hesabim/entegrasyonlarim", "/hesabim/dns-izleme",
  "/hesabim/fortinet-entegrasyonu", "/hesabim/enterprise", "/hesabim/kurulum", "/hesabim/davet",
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
  // KOBİ değerlendirme, eski satış hunisi ve iş ortaklığı (TPRM odağı, 3. tur)
  "/panel/degerlendirmeler", "/panel/sorular", "/panel/yonetim-raporlari", "/panel/growth-engine",
  "/panel/risk-raporlari", "/panel/acil-tehditler", "/panel/isr", "/panel/is-ortaklari",
  "/panel/is-ortakligi-basvurulari", "/panel/lead-gen", // Lead Kuyruğu ve Kampanyaları (giden e-posta hunisi)
];

/** Özel hedefe yönlenen arşiv sayfaları (içeriği başka bir sayfaya taşınanlar). */
export const ARCHIVED_REDIRECT_TO: Readonly<Record<string, string>> = {
  "/neden-cyberstep": "/hakkimizda", // isim hikayesi ve ekip yeni Hakkımızda sayfasında
  // KOBİ risk değerlendirmesi başlangıç sayfaları: giriş artık ücretsiz domain taraması
  "/assessment/start": "/domain-tarama",
  "/assessment/full/start": "/domain-tarama",
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
