import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, pricingPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

// ─── Whitelist of API keys the admin can configure via the panel ─────────────
const CONFIGURABLE_API_KEYS = new Set([
  "VIRUSTOTAL_API_KEY",
  "GOOGLE_SAFE_BROWSING_API_KEY",
  "ABUSEIPDB_API_KEY",
  "SHODAN_API_KEY",
  "WHOISXML_API_KEY",
  "OTX_API_KEY",
  "GREYNOISE_API_KEY",
  // Censys
  "CENSYS_API_ID",
  "CENSYS_API_SECRET",
  // VulnCheck (CTI istihbarat)
  "VULNCHECK_API_KEY",
  // Ödeme (Iyzico)
  "IYZICO_API_KEY",
  "IYZICO_SECRET_KEY",
  // AI Sahte Doküman (Hive Moderation)
  "HIVE_API_KEY",
  // Microsoft 365 / Azure AD
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  // E-Fatura (Paraşüt)
  "PARASUT_API_KEY",
  "PARASUT_CLIENT_ID",
  "PARASUT_CLIENT_SECRET",
  "PARASUT_COMPANY_ID",
]);

// ─── Load API keys from DB into process.env at startup ──────────────────────
export async function loadApiKeysFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(siteSettingsTable);
    for (const row of rows) {
      if (row.key.startsWith("apikey.") && row.value) {
        const envKey = row.key.slice("apikey.".length);
        if (CONFIGURABLE_API_KEYS.has(envKey) && !process.env[envKey]) {
          process.env[envKey] = row.value;
        }
      }
    }
    logger.info("API keys loaded from DB");
  } catch (err) {
    logger.warn({ err }, "Could not load API keys from DB");
  }
}

const router = Router();

// GET /api/admin-panel/settings
router.get("/admin-panel/settings", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// PUT /api/admin-panel/settings
router.put("/admin-panel/settings", requireAdmin, async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await db.insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    if (key.startsWith("apikey.") && value) {
      const envKey = key.slice("apikey.".length);
      if (CONFIGURABLE_API_KEYS.has(envKey)) {
        process.env[envKey] = value;
      }
    }
  }
  logger.info({ keys: Object.keys(updates) }, "Site settings updated");
  res.json({ success: true });
});

// GET /api/admin-panel/pricing
router.get("/admin-panel/pricing", requireAdmin, async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable).orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// PUT /api/admin-panel/pricing/:id
router.put("/admin-panel/pricing/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, price, description, features, isActive } = req.body as {
    name?: string; price?: string; description?: string; features?: string[]; isActive?: boolean;
  };

  const [updated] = await db.update(pricingPlansTable)
    .set({ ...(name !== undefined && { name }), ...(price !== undefined && { price }), ...(description !== undefined && { description }), ...(features !== undefined && { features }), ...(isActive !== undefined && { isActive }), updatedAt: new Date() })
    .where(eq(pricingPlansTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Plan bulunamadı" }); return; }
  logger.info({ planId: id }, "Pricing plan updated");
  res.json(updated);
});

// POST /api/admin-panel/pricing — yeni plan oluştur
router.post("/admin-panel/pricing", requireAdmin, async (req: Request, res: Response) => {
  const { slug, name, price, description, features, isActive, sortOrder } = req.body as {
    slug: string; name: string; price?: string; description?: string;
    features?: string[]; isActive?: boolean; sortOrder?: number;
  };
  if (!slug || !name) { res.status(400).json({ error: "slug ve name zorunludur" }); return; }
  const [created] = await db.insert(pricingPlansTable)
    .values({ slug, name, price: price ?? "0", description: description ?? "", features: features ?? [], isActive: isActive ?? true, sortOrder: sortOrder ?? 99 })
    .returning();
  logger.info({ id: created.id, slug }, "Pricing plan created");
  res.status(201).json(created);
});

// DELETE /api/admin-panel/pricing/:id
router.delete("/admin-panel/pricing/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(pricingPlansTable).where(eq(pricingPlansTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Plan bulunamadı" }); return; }
  logger.info({ planId: id, slug: deleted.slug }, "Pricing plan deleted");
  res.json({ success: true });
});

// GET /api/public/pricing (public — no auth)
router.get("/public/pricing", async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable)
    .where(eq(pricingPlansTable.isActive, true))
    .orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// GET /api/admin-panel/settings/apikeys — hangi API anahtarları tanımlı
router.get("/admin-panel/settings/apikeys", requireAdmin, (_req: Request, res: Response) => {
  const result: Record<string, boolean> = {};
  for (const key of CONFIGURABLE_API_KEYS) {
    result[key] = !!process.env[key];
  }
  res.json(result);
});

// PUT /api/admin-panel/settings/apikeys — API anahtarı kaydet (DB + process.env)
router.put("/admin-panel/settings/apikeys", requireAdmin, async (req: Request, res: Response) => {
  const { envKey, value } = req.body as { envKey?: string; value?: string };
  if (!envKey || !CONFIGURABLE_API_KEYS.has(envKey) || typeof value !== "string") {
    res.status(400).json({ error: "Geçersiz anahtar adı" });
    return;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    delete process.env[envKey];
    await db.delete(siteSettingsTable).where(eq(siteSettingsTable.key, `apikey.${envKey}`));
    logger.info({ envKey }, "API key cleared");
    res.json({ success: true, active: false });
    return;
  }
  process.env[envKey] = trimmed;
  await db.insert(siteSettingsTable)
    .values({ key: `apikey.${envKey}`, value: trimmed, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: trimmed, updatedAt: new Date() } });
  logger.info({ envKey }, "API key configured via admin panel");
  res.json({ success: true, active: true });
});

// GET /api/admin-panel/settings/services — tüm dış servis durumları
router.get("/admin-panel/settings/services", requireAdmin, (_req: Request, res: Response) => {
  const env = process.env;
  const services = [
    // ─── Tehdit İstihbaratı — Ücretsiz ─────────────────────────────────────
    { id: "cisa-kev",      name: "CISA KEV",              category: "Tehdit İstihbaratı", always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "ABD Siber Güvenlik Ajansı'nın aktif saldırılarda kullanıldığını doğruladığı ~1.100 CVE kataloğu", why: "Teorik açıkları değil, gerçekten istismar edilenleri gösterir — en kritik uyarı türü", how: "Shadow IT ile tespit edilen yazılımlarla (WordPress, Apache vb.) eşleştirilir, 24 saatte bir yenilenir", setup: "Kurulum gerekmez. cisa.gov'dan JSON olarak indirilir, başlangıçta önbelleğe alınır.", docs: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
    { id: "urlhaus",       name: "URLhaus (Abuse.ch)",    category: "Tehdit İstihbaratı", always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "200.000+ zararlı URL ve alan adının anlık kara listesi — fidye ve malware dağıtım noktaları", why: "Sitenin zararlı içerik dağıtımında kullanılıp kullanılmadığını doğrular", how: "Her taramada anlık olarak sorgulanır, tarama raporunda gösterilir", setup: "Kurulum gerekmez. urlhaus-api.abuse.ch API'si açık ve ücretsizdir.", docs: "https://urlhaus-api.abuse.ch/" },
    { id: "feodo-tracker", name: "Feodo Tracker (Abuse.ch)", category: "Tehdit İstihbaratı", always: true, active: true,                           cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "Emotet, TrickBot, IcedID gibi aktif botnet C2 (komuta-kontrol) sunucularının IP listesi", why: "Sitenin barındığı IP'nin botnet altyapısıyla ilişkili olup olmadığını kontrol eder", how: "Domain IP'leri çözümlenerek botnet C2 listesiyle karşılaştırılır, 6 saatte bir yenilenir", setup: "Kurulum gerekmez. feodotracker.abuse.ch'den JSON olarak indirilir.", docs: "https://feodotracker.abuse.ch/" },
    { id: "threatfox",     name: "ThreatFox (Abuse.ch)",  category: "Tehdit İstihbaratı", always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "APT grupları ve fidye çeteleriyle ilişkili IOC (güvenlik ihlali göstergesi) veritabanı — 1M+ IOC", why: "Domain veya IP'nin bilinen siber saldırı altyapısıyla bağlantısını tespit eder", how: "Her taramada domain ThreatFox IOC veritabanında sorgulanır", setup: "Kurulum gerekmez. Ücretsiz API, kayıt gerektirmez.", docs: "https://threatfox.abuse.ch/api/" },
    { id: "usom",          name: "USOM",                  category: "Tehdit İstihbaratı", always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "BTK/USOM Türkiye siber tehdit kara listesi — yalnızca Türkiye kaynaklı", why: "Uluslararası listelerde görünmeyebilecek Türkiye'ye özgü tehditleri yakalar", how: "Domain taramasında USOM kara listesiyle eşleştirme yapılır", setup: "Kurulum gerekmez. usom.gov.tr'den çekilir.", docs: "https://www.usom.gov.tr/" },
    // ─── İtibar & Kötücül Yazılım ─────────────────────────────────────────
    { id: "virustotal",    name: "VirusTotal",            category: "İtibar & Kötücül Yazılım", always: false, active: !!env["VIRUSTOTAL_API_KEY"],  cost: "freemium", costLabel: "Freemium",   envKey: "VIRUSTOTAL_API_KEY",          desc: "70+ antivirüs motorunun domain/IP taraması — Google altyapısı üzerinde çalışır", why: "Tek başına yetersiz kalan kara listelerinin aksine 70 farklı güvenlik firmasının analizini birleştirir", how: "Tarama raporunda zararlı/şüpheli motor sayısı gösterilir", setup: "virustotal.com'da ücretsiz hesap açın, API Keys bölümünden anahtarınızı alın.", docs: "https://developers.virustotal.com/", costNote: "Ücretsiz: 500 istek/gün | Premium: $30/ay" },
    { id: "google-sb",     name: "Google Safe Browsing",  category: "İtibar & Kötücül Yazılım", always: false, active: !!env["GOOGLE_SAFE_BROWSING_API_KEY"], cost: "free", costLabel: "Ücretsiz", envKey: "GOOGLE_SAFE_BROWSING_API_KEY", desc: "Chrome/Firefox'un güvensiz işaretlediği domain listesi — 4B+ kullanıcı verisiyle", why: "En geniş kapsamlı gerçek kullanıcı tabanlı phishing ve malware tespiti", how: "Domain GSB API'siyle sorgulanır, tarama raporunda 'Google Safe Browsing' kartında gösterilir", setup: "console.cloud.google.com → Safe Browsing API'yi etkinleştirin → Credentials → API Key.", docs: "https://developers.google.com/safe-browsing/v4/get-started", costNote: "Tamamen ücretsiz: 10.000 istek/gün" },
    { id: "abuseipdb",     name: "AbuseIPDB",             category: "İtibar & Kötücül Yazılım", always: false, active: !!env["ABUSEIPDB_API_KEY"],   cost: "freemium", costLabel: "Freemium",   envKey: "ABUSEIPDB_API_KEY",           desc: "Spam, brute-force ve DDoS saldırılarında kullanılan IP'lerin küresel raporlama veritabanı", why: "Mail/web sunucusu IP itibarını ölçer — kara listedeki IP e-posta deliverability'i mahveder", how: "Domain'in MX ve A kayıtlarındaki IP'ler sorgulanır, 'AbuseIPDB' kartında gösterilir", setup: "abuseipdb.com → hesap açın → API → Keys → Create Key.", docs: "https://www.abuseipdb.com/api.html", costNote: "Ücretsiz: 1.000/gün | Basic: $20/ay" },
    { id: "otx",           name: "AlienVault OTX",        category: "İtibar & Kötücül Yazılım", always: false, active: !!env["OTX_API_KEY"],         cost: "free",     costLabel: "Ücretsiz",   envKey: "OTX_API_KEY",                 desc: "200.000+ araştırmacının katkısıyla oluşan küresel tehdit istihbarat platformu", why: "Domain'in kaç aktif tehdit kampanyasında görüntülendiğini ve TR saldırılarıyla ilişkisini gösterir", how: "OTX API'si sorgulanır, pulse sayısı ve TR hedefli saldırı verisi rapora eklenir", setup: "otx.alienvault.com → ücretsiz kayıt → profil → API Key.", docs: "https://otx.alienvault.com/api/", costNote: "Tamamen ücretsiz" },
    { id: "greynoise",     name: "GreyNoise",             category: "İtibar & Kötücül Yazılım", always: false, active: !!env["GREYNOISE_API_KEY"],   cost: "freemium", costLabel: "Freemium",   envKey: "GREYNOISE_API_KEY",           desc: "İnternet genelinde port tarama yapan botları gerçek saldırganlardan ayıran IP niyeti platformu", why: "'Bu IP bizi hedef alıyor mu yoksa genel internet taraması mı yapıyor?' sorusunu yanıtlar", how: "Açık portlara bağlanan IP'lerin niyeti sınıflandırılır, raporda gösterilir", setup: "greynoise.io → ücretsiz Community hesabı → API Keys.", docs: "https://docs.greynoise.io/", costNote: "Community: Ücretsiz 1.000/gün | Teams: $99/ay" },
    // ─── Altyapı & Açık Yönetimi ──────────────────────────────────────────
    { id: "shodan",        name: "Shodan",                category: "Altyapı & Açık Yönetimi", always: false, active: !!env["SHODAN_API_KEY"],       cost: "paid",     costLabel: "Ücretli",    envKey: "SHODAN_API_KEY",              desc: "Tüm internetin port ve servis haritası — açık portlar, çalışan yazılımlar, banner bilgileri", why: "Müşterinin bilmediği açık portları (RDP:3389, MongoDB:27017) ve donanım parmak izini ortaya çıkarır", how: "Domain IP'si Shodan'da sorgulanır, açık port listesi ve vuln sayısı rapora eklenir", setup: "shodan.io → hesap açın → Account → API Key. Member plan ($49/ay) tam erişim.", docs: "https://developer.shodan.io/api", costNote: "Free (çok sınırlı) | Member: $49/ay" },
    { id: "censys",        name: "Censys",                category: "Altyapı & Açık Yönetimi", always: false, active: !!(env["CENSYS_API_ID"] && env["CENSYS_API_SECRET"]), cost: "freemium", costLabel: "Freemium", envKey: "CENSYS_API_ID", desc: "SSL sertifika parmak izi araması — aynı sertifikayı kullanan tüm IP'leri bulur; gizli altyapı ve shadow IT tespiti", why: "Bir domain'in sertifikasını taşıyan DNS'de görünmeyen gizli sunucuları, paylaşımlı hosting ve shadow IT varlıklarını ortaya çıkarır", how: "Domain'e ait SSL sertifika isimleri Censys Search API'siyle sorgulanır, eşleşen IP ve açık portlar tarama raporuna eklenir", setup: "censys.io'da hesap açın → Account → API → ID ve Secret kopyalayın → CENSYS_API_ID ve CENSYS_API_SECRET ekleyin.", docs: "https://search.censys.io/api", costNote: "Ücretsiz: 250 sorgu/ay | Starter: $99/ay" },
    { id: "whoisxml",      name: "WhoisXML API",          category: "Altyapı & Açık Yönetimi", always: false, active: !!env["WHOISXML_API_KEY"],     cost: "freemium", costLabel: "Freemium",   envKey: "WHOISXML_API_KEY",            desc: "Domain kayıt geçmişi, sahiplik değişiklikleri, DNS geçmişi — Domain Hijacking tespiti", why: "Domain'in el değiştirip değiştirmediğini veya DNS'in manipüle edilip edilmediğini tespit eder", how: "WHOIS geçmişi sorgulanır, sahiplik değişikliği uyarısı rapora eklenir", setup: "whoisxmlapi.com → ücretsiz hesap (1.000 sorgu/ay) → API Key.", docs: "https://whois.whoisxmlapi.com/documentation/making-queries", costNote: "Ücretsiz: 1.000/ay | Basic: $29/ay" },
    // ─── Protokol & Sertifika Güvenliği — Ücretsiz ───────────────────────
    { id: "ssllabs",       name: "Qualys SSL Labs",       category: "Protokol & Sertifika",    always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "TLS protokol versiyonu, şifre zayıflığı, sertifika zinciri ve HSTS kontrolü — endüstri standardı", why: "A+ ile F arasında bağımsız harf notu verir; PCI-DSS uyumluluk için SSL notunun A olması zorunlu", how: "Önbellekten hızlı not alınır (24 saatlik cache), 'SSLLabs Notu' olarak gösterilir", setup: "Kurulum gerekmez. api.ssllabs.com açık API'si kullanılır.", docs: "https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md" },
    { id: "mozilla-obs",   name: "Mozilla Observatory",   category: "Protokol & Sertifika",    always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "HTTP Güvenlik Başlıkları analizi — CSP, HSTS, X-Frame-Options, Referrer-Policy değerlendirmesi", why: "SSLLabs ile tamamlayıcı: SSL değil HTTP başlıklarının güvenliğini ölçer, A-F notu verir", how: "Her taramada Observatory API sorgulanır, başlık güvenlik notu rapora eklenir", setup: "Kurulum gerekmez. Tamamen ücretsiz Mozilla API'si.", docs: "https://observatory.mozilla.org/" },
    { id: "nvd-cve",       name: "NVD CVE (NIST)",        category: "Protokol & Sertifika",    always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "ABD Ulusal Güvenlik Açığı Veritabanı — 200.000+ CVE kaydı ve CVSS puanları", why: "Shadow IT ile tespit edilen yazılımların bilinen açıklarını gösterir", how: "Tespit edilen servisler için NVD'de CVE araması yapılır, CVSS puanıyla listelenir", setup: "Kurulum gerekmez. nvd.nist.gov API'si ücretsiz.", docs: "https://nvd.nist.gov/developers/vulnerabilities" },
    { id: "epss",          name: "EPSS (FIRST.org)",      category: "Protokol & Sertifika",    always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "CVE başına gerçek dünya istismar olasılığı — 'Bu açık 30 günde kullanılma ihtimali %94'", why: "NVD CVSS teorik; EPSS gerçek saldırı verilerinden makine öğrenimiyle hesaplanır — önceliklendirmeyi değiştirir", how: "NVD'den alınan CVE'ler EPSS API'siyle zenginleştirilir, istismar olasılığı rapora eklenir", setup: "Kurulum gerekmez. api.first.org ücretsiz.", docs: "https://www.first.org/epss/api" },
    { id: "crt-sh",        name: "crt.sh (CT Logs)",      category: "Protokol & Sertifika",    always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "Sertifika Şeffaflığı günlükleri — domain'e ait tüm alt alanları ve sertifika geçmişini ortaya çıkarır", why: "Yöneticinin habersiz açılan subdomain'leri tespit eder — Shadow IT ve güvenlik açığı vektörlerini bulur", how: "crt.sh sorgusundan subdomain'ler toplanır, raporda listelenir", setup: "Kurulum gerekmez.", docs: "https://crt.sh/" },
    // ─── Lead Keşfi — Ücretsiz ───────────────────────────────────────────
    { id: "hackertarget",  name: "HackerTarget",          category: "Lead Keşfi",              always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "Reverse DNS ve subdomain lookup API'si — IP adresinden hostname keşfi, domain'den alt alan tespiti", why: "RIPE DNS keşif pipeline'ında Türk IPv4 adreslerini domain adlarına çevirir; API key gerektirmez", how: "RIPE stat'tan alınan prefix'lerdeki IP'ler HackerTarget reverse DNS ile sorgulanır, .tr domain'leri lead adayı olarak eklenir", setup: "Kurulum gerekmez. Günlük ~100 istek ücretsiz.", docs: "https://hackertarget.com/ip-tools/" },
    { id: "ripe-stat",     name: "RIPE stat.ripe.net",    category: "Lead Keşfi",              always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "RIPE NCC Türkiye IPv4 prefix listesi — Türkiye'ye tahsis edilmiş tüm IP bloklarını sağlar", why: "Türk şirketlerine ait IP aralıklarını keşfederek reverse DNS ile domain adlarına dönüştürür; crt.sh'e bağlı olmayan bağımsız bir lead kaynağı", how: "Her gece 02:00'de RIPE stat API'sinden TR prefix'leri çekilir, örneklem IP'ler HackerTarget ile sorgulanır", setup: "Kurulum gerekmez. stat.ripe.net tamamen açık bir API'dir.", docs: "https://stat.ripe.net/docs/data_api" },
    // ─── E-posta & Kimlik Güvenliği — Ücretsiz ──────────────────────────
    { id: "hibp",          name: "Have I Been Pwned",     category: "E-posta & Kimlik",        always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "Domain'e ait e-posta adreslerinin 750+ veri sızıntısında yer alıp almadığını kontrol eder", why: "Çalışan kimlik bilgileri dark web'deyse hesap ele geçirme riski dramatik artar", how: "Domain HIBP'de sorgulanır, kaç sızıntıda kaç hesap görüntülendiği rapora eklenir", setup: "Kurulum gerekmez.", docs: "https://haveibeenpwned.com/API/v3" },
    { id: "spf-dmarc",     name: "SPF / DMARC / DKIM",    category: "E-posta & Kimlik",        always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "E-posta kimlik doğrulama kayıtları — phishing ve e-posta sahteciliği (spoofing) tespiti", why: "Bu kayıtlar eksikse saldırganlar şirket adına sahte e-posta gönderebilir — CEO fraud kapısı", how: "DNS sorguları ile analiz edilir, eksik/yanlış yapılandırmalar işaretlenir", setup: "Kurulum gerekmez.", docs: "https://dmarcian.com/what-is-spf/" },
    { id: "dnsbl",         name: "DNSBL Kara Listeleri",   category: "E-posta & Kimlik",        always: true,  active: true,                              cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "Spamhaus, Barracuda, SORBS gibi 15+ DNS tabanlı kara listede IP ve domain kontrolü", why: "Kara listedeki mail sunucusu e-postaların spam kutusuna düşmesine neden olur — iş kaybı", how: "Domain ve IP'ler 15+ DNSBL listesine sorgulanır, kara listede görünme durumu işaretlenir", setup: "Kurulum gerekmez. DNS sorguları ile çalışır.", docs: "https://www.spamhaus.org/lookup/" },
    // ─── Yapay Zeka ──────────────────────────────────────────────────────
    { id: "gemini-ai",     name: "Gemini 2.5 Flash",      category: "Yapay Zeka",              always: true,  active: !!(env["AI_INTEGRATIONS_GEMINI_BASE_URL"] || env["AI_INTEGRATIONS_GEMINI_API_KEY"]), cost: "free", costLabel: "Ücretsiz", envKey: null, desc: "Google'ın en güncel AI modeli — tarama bulgularından Türkçe kişiselleştirilmiş rapor üretir", why: "Ham güvenlik verilerini yönetici için anlaşılır, aksiyona dönüştürülebilir Türkçe rapora çevirir", how: "Assessment tamamlanınca tüm bulgular Gemini'ye gönderilir, streaming ile rapor oluşturulur", setup: "Replit AI Integrations tarafından otomatik sağlanır — ek kurulum gerekmez.", docs: "https://ai.google.dev/" },
    // ─── İletişim ────────────────────────────────────────────────────────
    { id: "smtp",          name: "SMTP E-posta",          category: "İletişim",                always: false, active: !!env["SMTP_PASS"],                cost: "varies",   costLabel: "Değişken",   envKey: null,                          desc: "Bülten, rapor ve bildirim e-postalarının gönderimi (ISR, otomatik raporlar, uyarılar)", why: "Müşterilere 30 günlük yeniden tarama raporu ve güvenlik uyarıları göndermek için gerekli", how: "Nodemailer ile yapılandırılmış SMTP sunucusu üzerinden gönderim yapılır", setup: "Replit Secrets'a SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ekleyin.", docs: "" },
    { id: "isr-imap",      name: "ISR IMAP (AI Satış)",   category: "İletişim",                always: false, active: !!env["ISR_IMAP_PASS"],            cost: "free",     costLabel: "Ücretsiz",   envKey: null,                          desc: "AI Satış Asistanı'nın gelen kutusunu okuyarak müşteri e-postalarına otomatik yanıt vermesi", why: "7/24 çalışan AI satış temsilcisi — potansiyel müşteri e-postalarını kaçırmadan yanıtlar", how: "5 dakikada bir IMAP'ten e-posta okunur, Gemini AI ile yanıt oluşturulur", setup: "Replit Secrets'a ISR_IMAP_HOST, ISR_IMAP_USER, ISR_IMAP_PASS ekleyin.", docs: "" },
    // ─── ITSM & Kimlik ──────────────────────────────────────────────────────
    { id: "ms365",         name: "Microsoft 365 / Azure AD", category: "ITSM & Operasyon",        always: false, active: !!(env["MICROSOFT_CLIENT_ID"] && env["MICROSOFT_CLIENT_SECRET"]), cost: "varies", costLabel: "M365 Lisansı", envKey: "MICROSOFT_CLIENT_ID", desc: "Azure AD OAuth2 çok kiracılı entegrasyon — Graph API ile kullanıcı etkinlikleri, riskli girişler ve güvenlik uyarıları SOC korelasyon motoruna beslenir", why: "Kurumsal kimlik ve erişim güvenliği KOBİ siber olaylarının %80+'inin başlangıç noktası. M365 tenant'ından gelen riskli giriş uyarıları SOC vakasına otomatik dönüşür.", how: "Müşteri /hesabim/entegrasyonlarim → Microsoft 365 bölümünden OAuth2 akışını başlatır. Her 15 dakikada Graph API'den SignIn + Alert verileri çekilir, SOC korelasyon motoru ile işlenir.", setup: "1. Azure Portal → App Registrations → Yeni uygulama  2. API Permissions: AuditLog.Read.All, SecurityEvents.Read.All, User.Read.All ekle  3. Client ID ve Client Secret'ı Replit Secrets'a MICROSOFT_CLIENT_ID ve MICROSOFT_CLIENT_SECRET olarak kaydet.", docs: "https://learn.microsoft.com/en-us/graph/auth/auth-concepts" },
  ];
  res.json(services);
});

// POST /api/admin-panel/settings/apikeys/test-censys — bağlantı ve kota bilgisi döner
router.post("/admin-panel/settings/apikeys/test-censys", requireAdmin, async (_req: Request, res: Response) => {
  const { testCensysConnection } = await import("../../services/censysEnrichment");
  const result = await testCensysConnection();
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// POST /api/admin-panel/settings/apikeys/test-shodan — plan ve kredi bilgisi döner
router.post("/admin-panel/settings/apikeys/test-shodan", requireAdmin, async (_req: Request, res: Response) => {
  const apiKey = process.env["SHODAN_API_KEY"];
  if (!apiKey) {
    res.status(400).json({ ok: false, error: "SHODAN_API_KEY bulunamadı. Replit Secrets'e ekleyin." });
    return;
  }
  try {
    const https = await import("https");
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const req2 = https.get(
        `https://api.shodan.io/api-info?key=${encodeURIComponent(apiKey)}`,
        { timeout: 10000, headers: { "User-Agent": "CyberStep.io/1.0" } },
        (resp) => {
          let body = "";
          resp.on("data", (c: Buffer) => { body += c.toString(); });
          resp.on("end", () => {
            try { resolve(JSON.parse(body) as Record<string, unknown>); }
            catch { reject(new Error(`Parse hatası: ${body.slice(0, 200)}`)); }
          });
        },
      );
      req2.on("error", reject);
      req2.on("timeout", () => { req2.destroy(); reject(new Error("Shodan API zaman aşımı (10sn)")); });
    });
    const plan = String(result["plan"] ?? "bilinmiyor");
    const queryCredits = Number(result["query_credits"] ?? 0);
    const scanCredits  = Number(result["scan_credits"]  ?? 0);
    const freePlans    = new Set(["oss", "dev", "free"]);
    const searchOk     = !freePlans.has(plan.toLowerCase());
    res.json({
      ok: true,
      plan,
      queryCredits,
      scanCredits,
      searchApiOk: searchOk,
      message: searchOk
        ? `Geçerli anahtar. Plan: ${plan}, Sorgu kredisi: ${queryCredits}`
        : `Geçerli anahtar AMA ücretsiz plan ("${plan}"). Lead Discovery Shodan taraması çalışmaz — Member plan ($49/ay) gerekir. Domain taramaları çalışır.`,
    });
  } catch (err: unknown) {
    const msg = String(err);
    const is401 = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
    res.status(400).json({
      ok: false,
      error: is401
        ? "API anahtarı geçersiz (401). account.shodan.io adresinden doğru anahtarı kopyalayın."
        : `Shodan bağlantı hatası: ${msg}`,
    });
  }
});

// GET /api/admin-panel/settings/public (no auth — for footer/about pages)
router.get("/public/settings", async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

export default router;
