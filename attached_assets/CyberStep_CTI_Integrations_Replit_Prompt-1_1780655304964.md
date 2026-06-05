# CyberStep.io — CTI Entegrasyon Promptu
## VulnCheck KEV + Yıllık İstihbarat Takvimi

---

## BAĞLAM

Bu prompt iki sistemi inşa eder:

1. VulnCheck KEV API entegrasyonu
   CISA KEV'in göremediği %75 blind spot'u kapatır
   Network edge cihazları için özel veri

2. Yıllık Rapor İstihbarat Takvimi
   WEF, Crowdstrike, IBM, Verizon, ENISA
   Aylık endeks raporuna küresel bağlam ekler
   red.anthropic.com RSS izleme

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
src/services/cve/ klasörünü incele
→ CISA KEV nasıl çekiliyor?
→ CVE eşleştirme mantığı nerede?
→ EPSS entegrasyonu var mı?

src/services/intelligence/ klasörünü incele
→ Mevcut feed yapısı nedir?

Mevcut yapıyı anladıktan sonra
aşağıdaki entegrasyonları uygula.
```

---

## BÖLÜM 1: VERİTABANI

```sql
-- VulnCheck KEV tablosu
-- (mevcut cve_tracker veya benzer tabloya
--  kolon ekle, yoksa yeni oluştur)
CREATE TABLE IF NOT EXISTS vulncheck_kev (
  id serial PRIMARY KEY,
  cve_id varchar(30) UNIQUE NOT NULL,

  -- VulnCheck verileri
  vuln_check_id varchar(100),
  description text,
  cvss_score decimal(4,1),
  cvss_version varchar(10),
  epss_score decimal(6,4),     -- 0-1 arası
  epss_percentile decimal(5,2),

  -- İstismar bilgisi
  date_added date,
  -- VulnCheck KEV'e eklenme tarihi
  date_first_exploited date,
  -- İlk gerçek dünya istismarı
  ransomware_use boolean DEFAULT false,
  -- Fidye yazılımı tarafından kullanılıyor mu?

  -- Etkilenen ürünler
  affected_products jsonb,
  -- [{vendor, product, versions}]
  is_network_edge boolean DEFAULT false,
  -- FortiGate, Cisco, Zyxel gibi edge cihaz mı?
  is_end_of_life boolean DEFAULT false,
  -- Üretici desteği bitti mi?

  -- CISA karşılaştırma
  in_cisa_kev boolean DEFAULT false,
  -- CISA'nın listesinde de var mı?
  cisa_due_date date,

  -- Metadata
  source varchar(50) DEFAULT 'vulncheck',
  last_fetched_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vulncheck_kev_cve_idx
  ON vulncheck_kev (cve_id);
CREATE INDEX IF NOT EXISTS vulncheck_kev_edge_idx
  ON vulncheck_kev (is_network_edge)
  WHERE is_network_edge = true;
CREATE INDEX IF NOT EXISTS vulncheck_kev_ransomware_idx
  ON vulncheck_kev (ransomware_use)
  WHERE ransomware_use = true;

-- Yıllık istihbarat raporları
CREATE TABLE IF NOT EXISTS annual_intel_reports (
  id serial PRIMARY KEY,
  report_key varchar(100) UNIQUE NOT NULL,
  -- 'wef_2026', 'crowdstrike_gtr_2026', vb.
  title varchar(255) NOT NULL,
  publisher varchar(100),
  -- 'WEF', 'CrowdStrike', 'IBM', 'Verizon', vb.
  report_year integer,
  publish_date date,

  -- İşlenmiş veriler
  raw_content text,
  -- PDF'ten çıkarılan veya RSS'ten gelen ham metin

  key_findings jsonb,
  -- Claude'un ürettiği yapılandırılmış bulgular
  -- [{finding, relevance_to_turkey, cyberstep_action}]

  turkey_impact_summary text,
  -- Claude'un Türkiye özelinde özeti

  cyberstep_recommendations jsonb,
  -- [{category, recommendation, priority}]

  -- Durum
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'processing' | 'analyzed' | 'published'

  used_in_report_month varchar(7),
  -- '2026-01' — hangi aylık endeks raporunda kullanıldı

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Sürekli izlenen blog/feed kaynakları
CREATE TABLE IF NOT EXISTS intel_feed_sources (
  id serial PRIMARY KEY,
  source_key varchar(100) UNIQUE NOT NULL,
  -- 'anthropic_red_team', 'vulncheck_blog', vb.
  name varchar(255),
  feed_url varchar(500),
  -- RSS/Atom URL
  feed_type varchar(20) DEFAULT 'rss',
  -- 'rss' | 'atom' | 'api' | 'scrape'
  category varchar(50),
  -- 'ai_security' | 'exploit_intel' | 'threat_actor'
  --   | 'regulation' | 'vendor_advisory'
  is_active boolean DEFAULT true,
  last_checked_at timestamp,
  last_new_item_at timestamp,
  check_interval_hours integer DEFAULT 4,
  created_at timestamp DEFAULT now()
);

-- Feed'lerden gelen yeni içerikler
CREATE TABLE IF NOT EXISTS intel_feed_items (
  id serial PRIMARY KEY,
  source_key varchar(100) NOT NULL,
  item_url varchar(500) UNIQUE NOT NULL,
  title text,
  summary text,
  published_at timestamp,
  is_relevant boolean,
  -- Claude kalifikasyonu
  relevance_score integer,
  -- 0-100
  relevance_reason text,
  tags text[],
  -- ['fortinet', 'ransomware', 'kvkk', vb.]
  notified_at timestamp,
  created_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: VULNCHECK KEV SERVIS

```typescript
// src/services/intelligence/vulncheckService.ts
// YENİ DOSYA

const VULNCHECK_BASE = "https://api.vulncheck.com/v3";
const COMMUNITY_TOKEN = process.env["VULNCHECK_API_KEY"];
// Ücretsiz kayıt: https://vulncheck.com/auth/register

// Network edge vendor listesi
// VulnCheck'in en çok hedeflenen kategorisi
const NETWORK_EDGE_VENDORS = [
  "fortinet", "fortigate", "fortiweb",
  "cisco", "palo alto", "palo alto networks",
  "checkpoint", "check point",
  "juniper", "juniper networks",
  "zyxel", "netgear", "d-link", "dlink",
  "sonicwall", "barracuda",
  "ivanti", "pulse secure",
  "f5", "big-ip",
  "citrix", "netscaler",
];

function isNetworkEdgeDevice(products: any[]): boolean {
  if (!products?.length) return false;
  return products.some(p => {
    const vendor = (p.vendor || p.name || "").toLowerCase();
    return NETWORK_EDGE_VENDORS.some(e => vendor.includes(e));
  });
}

// VulnCheck KEV listesini çek
export async function fetchVulnCheckKEV(): Promise<void> {
  if (!COMMUNITY_TOKEN) {
    logger.warn("VULNCHECK_API_KEY eksik — VulnCheck KEV atlandı");
    return;
  }

  try {
    const { default: axios } = await import("axios");

    // VulnCheck KEV endpoint
    // Community tier: /v3/index/vulncheck-kev
    const response = await axios.get(
      `${VULNCHECK_BASE}/index/vulncheck-kev`,
      {
        headers: {
          Authorization: `Bearer ${COMMUNITY_TOKEN}`,
          Accept: "application/json",
        },
        params: {
          // Son 30 günü çek
          // (tam liste için pagination kullan)
          limit: 500,
        },
        timeout: 30000,
      }
    );

    const vulnerabilities = response.data?.data || [];
    let upserted = 0;
    let edgeCount = 0;

    for (const vuln of vulnerabilities) {
      const cveId = vuln.cve?.[0] || vuln.id;
      if (!cveId) continue;

      const products = vuln.affected_products || vuln.packages || [];
      const isEdge = isNetworkEdgeDevice(products);
      if (isEdge) edgeCount++;

      await db.insert(vulncheckKevTable).values({
        cveId,
        vulnCheckId: vuln.id,
        description: vuln.description,
        cvssScore: vuln.cvss3?.base_score || vuln.cvss2?.base_score,
        epssScore: vuln.epss?.score,
        epssPercentile: vuln.epss?.percentile,
        dateAdded: vuln.date_added
          ? new Date(vuln.date_added) : null,
        dateFirstExploited: vuln.date_first_reported
          ? new Date(vuln.date_first_reported) : null,
        ransomwareUse: vuln.ransomware_use === true,
        affectedProducts: products,
        isNetworkEdge: isEdge,
        isEndOfLife: vuln.end_of_life === true,
        inCisaKev: vuln.cisa_kev === true,
        cisaDueDate: vuln.due_date
          ? new Date(vuln.due_date) : null,
      }).onConflictDoUpdate({
        target: vulncheckKevTable.cveId,
        set: {
          epssScore: vuln.epss?.score,
          ransomwareUse: vuln.ransomware_use === true,
          isNetworkEdge: isEdge,
          updatedAt: new Date(),
        },
      });

      upserted++;
    }

    logger.info(
      { upserted, edgeCount, total: vulnerabilities.length },
      "VulnCheck KEV güncellendi"
    );
  } catch (err) {
    logger.error({ err }, "VulnCheck KEV fetch hatası");
  }
}

// Domain taramasında CVE zenginleştirme
// Mevcut CVE eşleştirme fonksiyonuna ekle:
export async function enrichCVEWithVulnCheck(
  cveId: string
): Promise<{
  epssScore: number | null;
  isNetworkEdge: boolean;
  ransomwareUse: boolean;
  inCisaKev: boolean;
  isEndOfLife: boolean;
  priorityLevel: "critical" | "high" | "medium" | "low";
}> {
  const [entry] = await db.select()
    .from(vulncheckKevTable)
    .where(eq(vulncheckKevTable.cveId, cveId))
    .limit(1);

  if (!entry) {
    return {
      epssScore: null,
      isNetworkEdge: false,
      ransomwareUse: false,
      inCisaKev: false,
      isEndOfLife: false,
      priorityLevel: "low",
    };
  }

  // Öncelik hesapla
  let priorityLevel: "critical" | "high" | "medium" | "low" = "low";

  if (entry.ransomwareUse || (entry.epssScore && entry.epssScore > 0.5)) {
    priorityLevel = "critical";
  } else if (
    entry.isNetworkEdge ||
    (entry.epssScore && entry.epssScore > 0.1)
  ) {
    priorityLevel = "high";
  } else if (entry.epssScore && entry.epssScore > 0.01) {
    priorityLevel = "medium";
  }

  return {
    epssScore: entry.epssScore ? Number(entry.epssScore) : null,
    isNetworkEdge: entry.isNetworkEdge || false,
    ransomwareUse: entry.ransomwareUse || false,
    inCisaKev: entry.inCisaKev || false,
    isEndOfLife: entry.isEndOfLife || false,
    priorityLevel,
  };
}

// Edge cihaz CVE raporu — Shodan ile çapraz kontrol
// Müşterinin Fortinet/Cisco cihazı varsa
// VulnCheck edge CVE'leri öne çıkar
export async function getNetworkEdgeCVEsForCustomer(
  customerId: number
): Promise<any[]> {

  // Müşterinin Shodan verilerinden tespit edilen edge cihazlar
  const shodanData = await db.select()
    .from(domainScansTable)
    .where(eq(domainScansTable.customerId, customerId))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);

  if (!shodanData[0]) return [];

  // Aktif network edge CVE'leri getir
  const edgeCVEs = await db.select()
    .from(vulncheckKevTable)
    .where(
      and(
        eq(vulncheckKevTable.isNetworkEdge, true),
        // Son 90 günde eklenen
        gte(
          vulncheckKevTable.dateAdded,
          subDays(new Date(), 90)
        )
      )
    )
    .orderBy(desc(vulncheckKevTable.epssScore))
    .limit(10);

  return edgeCVEs;
}
```

---

## BÖLÜM 3: YILLIK RAPOR TAKVİMİ SERVİSİ

```typescript
// src/services/intelligence/annualReportScheduler.ts
// YENİ DOSYA

// İzlenecek yıllık raporlar
// Her yıl otomatik güncellenecek takvim
const ANNUAL_REPORTS_CALENDAR = [
  {
    key: "wef_global_cybersecurity_outlook",
    title: "WEF Global Cybersecurity Outlook",
    publisher: "World Economic Forum",
    // Her yıl Ocak ayı ikinci haftası
    expectedMonth: 1,
    searchQuery: "WEF Global Cybersecurity Outlook site:weforum.org",
    keywords: ["weforum.org", "cybersecurity-outlook"],
  },
  {
    key: "crowdstrike_global_threat_report",
    title: "CrowdStrike Global Threat Report",
    publisher: "CrowdStrike",
    expectedMonth: 2,
    searchQuery: "CrowdStrike Global Threat Report 2026",
    keywords: ["crowdstrike.com", "global-threat-report"],
  },
  {
    key: "ibm_xforce_threat_intelligence",
    title: "IBM X-Force Threat Intelligence Index",
    publisher: "IBM Security",
    expectedMonth: 2,
    searchQuery: "IBM X-Force Threat Intelligence Index 2026",
    keywords: ["ibm.com", "x-force"],
  },
  {
    key: "verizon_dbir",
    title: "Verizon Data Breach Investigation Report",
    publisher: "Verizon",
    expectedMonth: 5,
    searchQuery: "Verizon DBIR 2026 Data Breach Investigations Report",
    keywords: ["verizon.com", "dbir"],
  },
  {
    key: "vulncheck_state_of_exploitation",
    title: "VulnCheck State of Exploitation",
    publisher: "VulnCheck",
    expectedMonth: 1,
    searchQuery: "VulnCheck State of Exploitation 2026",
    keywords: ["vulncheck.com", "state-of-exploitation"],
  },
  {
    key: "enisa_threat_landscape",
    title: "ENISA Threat Landscape",
    publisher: "ENISA",
    expectedMonth: 10,
    searchQuery: "ENISA Threat Landscape 2026",
    keywords: ["enisa.europa.eu", "threat-landscape"],
  },
  {
    key: "mandiant_m_trends",
    title: "Mandiant M-Trends",
    publisher: "Mandiant / Google Cloud",
    expectedMonth: 4,
    searchQuery: "Mandiant M-Trends 2026",
    keywords: ["mandiant.com", "m-trends"],
  },
  {
    key: "anthropic_frontier_red_team",
    title: "Anthropic Frontier Red Team Blog",
    publisher: "Anthropic",
    // RSS ile sürekli izleniyor — yıllık değil aylık
    expectedMonth: null,
    feedUrl: "https://red.anthropic.com/",
    keywords: ["red.anthropic.com"],
  },
];

// Yeni rapor çıktığında Claude ile analiz et
export async function analyzeAnnualReport(params: {
  reportKey: string;
  title: string;
  publisher: string;
  content: string;
  reportYear: number;
}): Promise<void> {

  const ai = getClaudeAiFn("claude-sonnet-4-6");
  // Yıllık rapor analizi için Sonnet — kalite önemli

  const analysisPrompt = `
Sen CyberStep.io'nun tehdit istihbarat analistisın.
Türkiye'nin siber güvenlik ekosistemini çok iyi biliyorsun.

Aşağıdaki raporu analiz et:
Rapor: ${params.title} (${params.publisher}, ${params.reportYear})

Rapor içeriği:
${params.content.slice(0, 8000)}

Şunu üret (JSON formatında):

{
  "key_findings": [
    {
      "finding": "Ana bulgu 1-2 cümlede",
      "data": "Destekleyen rakam veya veri",
      "relevance_to_turkey": "Türkiye için ne anlama geliyor",
      "cyberstep_action": "CyberStep'in bu konuda yapabileceği/söyleyebileceği"
    }
  ],
  "turkey_impact_summary": "Türkiye özeline 2-3 paragraf özet",
  "top_threats_for_turkey": [
    "Bu rapordan Türk şirketleri için en kritik 5 tehdit"
  ],
  "cyberstep_messaging": [
    "Bu rapordan CyberStep'in satış/içerik mesajlarına eklenebilecek 3 güçlü cümle"
  ],
  "monthly_report_section": "Aylık Türkiye Siber Güvenlik Endeksi için 'Küresel Bağlam' bölümü taslağı (150-200 kelime)"
}

Sadece JSON döndür. Markdown, açıklama ekleme.
`;

  const response = await ai(analysisPrompt);
  let analysis;

  try {
    analysis = JSON.parse(response);
  } catch {
    logger.warn({ reportKey: params.reportKey },
      "Rapor analizi JSON parse hatası");
    return;
  }

  await db.insert(annualIntelReportsTable).values({
    reportKey: params.reportKey,
    title: params.title,
    publisher: params.publisher,
    reportYear: params.reportYear,
    rawContent: params.content.slice(0, 50000),
    keyFindings: analysis.key_findings,
    turkeyImpactSummary: analysis.turkey_impact_summary,
    cyberstepRecommendations: analysis.cyberstep_messaging,
    status: "analyzed",
  }).onConflictDoUpdate({
    target: annualIntelReportsTable.reportKey,
    set: {
      keyFindings: analysis.key_findings,
      turkeyImpactSummary: analysis.turkey_impact_summary,
      status: "analyzed",
      updatedAt: new Date(),
    },
  });

  // Admin bildirimi
  await sendMail({
    to: process.env["SOC_ADMIN_EMAIL"]!,
    subject: `📊 Yeni Rapor Analizi Hazır: ${params.title}`,
    html: `
      <h3>${params.title}</h3>
      <p>${params.publisher} | ${params.reportYear}</p>
      <h4>Türkiye Özet:</h4>
      <p>${analysis.turkey_impact_summary}</p>
      <h4>CyberStep Mesajları:</h4>
      <ul>
        ${analysis.cyberstep_messaging?.map((m: string) =>
          `<li>${m}</li>`).join("")}
      </ul>
      <a href="${process.env["BASE_URL"]}/admin-panel/intel/reports">
        Admin Panelde Görüntüle →
      </a>
    `,
  });

  logger.info({ reportKey: params.reportKey },
    "Yıllık rapor analizi tamamlandı");
}
```

---

## BÖLÜM 4: RSS FEED İZLEME

```typescript
// src/services/intelligence/intelFeedWatcher.ts
// YENİ DOSYA
// Mevcut marketWatcher.ts'e alternatif veya ek
// Güvenlik odaklı feed'ler için özel servis

// İzlenecek feed kaynakları
const INTEL_FEEDS = [
  // AI Güvenlik
  {
    key: "anthropic_red_team",
    name: "Anthropic Frontier Red Team",
    feedUrl: "https://red.anthropic.com/",
    // RSS yoksa scraping
    category: "ai_security",
    priority: "high",
  },
  // Exploit İstihbaratı
  {
    key: "vulncheck_blog",
    name: "VulnCheck Blog",
    feedUrl: "https://vulncheck.com/blog/rss",
    category: "exploit_intel",
    priority: "high",
  },
  {
    key: "exploitdb",
    name: "Exploit-DB",
    feedUrl: "https://www.exploit-db.com/rss.xml",
    category: "exploit_intel",
    priority: "medium",
  },
  // Küresel Tehdit Raporları
  {
    key: "crowdstrike_blog",
    name: "CrowdStrike Blog",
    feedUrl: "https://www.crowdstrike.com/en-us/blog/feed/",
    category: "threat_actor",
    priority: "medium",
  },
  {
    key: "mandiant_blog",
    name: "Mandiant Blog",
    feedUrl: "https://cloud.google.com/blog/topics/threat-intelligence/rss",
    category: "threat_actor",
    priority: "medium",
  },
  // Türkiye / Düzenleyici
  {
    key: "usom",
    name: "USOM Duyuruları",
    feedUrl: "https://www.usom.gov.tr/rss",
    category: "regulation",
    priority: "high",
  },
  {
    key: "btk",
    name: "BTK Haberler",
    feedUrl: "https://www.btk.gov.tr/haberler/rss",
    category: "regulation",
    priority: "high",
  },
  // Satıcı Danışmanları
  {
    key: "fortinet_psirt",
    name: "Fortinet PSIRT",
    feedUrl: "https://www.fortiguard.com/rss/ir.xml",
    category: "vendor_advisory",
    priority: "critical",
    // Fortinet açıkları = CyberStep müşterilerini direkt etkiler
  },
  {
    key: "cisco_security",
    name: "Cisco Security Advisories",
    feedUrl: "https://tools.cisco.com/security/center/psirtrss20.xml",
    category: "vendor_advisory",
    priority: "high",
  },
];

// Feed öğesini CyberStep'e alakalı mı? — Claude Haiku ile filtrele
async function isIntelRelevant(
  item: { title: string; summary: string },
  category: string
): Promise<{ relevant: boolean; score: number; tags: string[] }> {

  const ai = getClaudeAiFn("claude-haiku-4-5");

  const result = await ai(`
Feed öğesi CyberStep.io için alakalı mı?
CyberStep: Türkiye KOBİ siber güvenlik platformu.
SOC/NOC, CVE izleme, DMARC/SSL kontrolü,
Fortinet entegrasyonu, KVKK uyum.

Başlık: ${item.title}
Özet: ${item.summary?.slice(0, 300) || ""}
Kategori: ${category}

JSON döndür:
{
  "relevant": true/false,
  "score": 0-100,
  "tags": ["fortinet","ransomware","kvkk", vb.]
}
Sadece JSON.
  `);

  try {
    return JSON.parse(result);
  } catch {
    return { relevant: false, score: 0, tags: [] };
  }
}

export async function checkIntelFeeds(): Promise<void> {
  for (const feed of INTEL_FEEDS) {
    if (!feed.feedUrl) continue;

    try {
      const items = await parseFeed(feed.feedUrl);
      // parseFeed: mevcut marketWatcher'dan al

      for (const item of items) {
        // Zaten işlendi mi?
        const existing = await db.select()
          .from(intelFeedItemsTable)
          .where(eq(intelFeedItemsTable.itemUrl, item.url))
          .limit(1);

        if (existing[0]) continue;

        // Alakalılık kontrolü
        const relevance = await isIntelRelevant(item, feed.category);

        await db.insert(intelFeedItemsTable).values({
          sourceKey: feed.key,
          itemUrl: item.url,
          title: item.title,
          summary: item.summary,
          publishedAt: item.publishedAt,
          isRelevant: relevance.relevant,
          relevanceScore: relevance.score,
          tags: relevance.tags,
        });

        // Yüksek öncelikli + alakalı → anında bildirim
        if (relevance.relevant && relevance.score >= 70) {
          await sendAdminTelegram(
            `🔔 Yeni İstihbarat: ${item.title}\n` +
            `Kaynak: ${feed.name}\n` +
            `Skor: ${relevance.score}/100\n` +
            `Etiketler: ${relevance.tags.join(", ")}\n` +
            `${item.url}`
          );
        }

        await sleep(500); // Rate limit
      }
    } catch (err) {
      logger.warn({ feedKey: feed.key, err },
        "Intel feed kontrol hatası");
    }
  }
}
```

---

## BÖLÜM 5: CRON JOB'LAR

```typescript
// src/index.ts'e ekle

// VulnCheck KEV — Her gece 01:00 İstanbul
cron.schedule("0 1 * * *",
  wrapCron("vulncheck_kev", "0 1 * * *", async () => {
    const { fetchVulnCheckKEV } = await import(
      "./services/intelligence/vulncheckService"
    );
    await fetchVulnCheckKEV();
  }),
  { timezone: "Europe/Istanbul" }
);

// Intel feed izleme — Her 6 saatte bir
cron.schedule("0 */6 * * *",
  wrapCron("intel_feeds", "0 */6 * * *", async () => {
    const { checkIntelFeeds } = await import(
      "./services/intelligence/intelFeedWatcher"
    );
    await checkIntelFeeds();
  }),
  { timezone: "Europe/Istanbul" }
);

// Yıllık rapor kontrol takvimi
// Her ayın 1'inde — "Bu ay beklenen rapor var mı?"
cron.schedule("0 9 1 * *",
  wrapCron("annual_report_check", "0 9 1 * *", async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const expectedReports = ANNUAL_REPORTS_CALENDAR.filter(
      r => r.expectedMonth === currentMonth
    );

    if (expectedReports.length === 0) return;

    // Admin'e hatırlatma gönder
    await sendMail({
      to: process.env["SOC_ADMIN_EMAIL"]!,
      subject: `📅 Bu ay beklenen raporlar (${currentMonth}/${currentYear})`,
      html: `
        <p>Bu ay çıkması beklenen yıllık raporlar:</p>
        <ul>
          ${expectedReports.map(r =>
            `<li><b>${r.title}</b> (${r.publisher})</li>`
          ).join("")}
        </ul>
        <p>Rapor yayınlandığında admin panelden
        "Rapor Analizi Başlat" butonunu kullan.</p>
      `,
    });

    logger.info({ expectedReports: expectedReports.map(r => r.key) },
      "Yıllık rapor hatırlatması gönderildi");
  }),
  { timezone: "Europe/Istanbul" }
);
```

---

## BÖLÜM 6: ADMİN PANELİ

```
/admin-panel/intel

─── VULNCHECK KEV DURUMU ────────────────────────────────
Son güncelleme: Bugün 01:23
Toplam KEV: 30.247 | Edge cihaz: 847 | Ransomware: 312
CISA'da olmayan: 22.681 (%75.0)

[Yenile] [Edge CVE'leri Gör] [Fortinet CVE'leri]

─── INTEL FEED'LERİ ─────────────────────────────────────
Anthropic Red Team    🟢  Son: 2 saat önce  Yeni: 1
Fortinet PSIRT        🟢  Son: 4 saat önce  Yeni: 0
VulnCheck Blog        🟢  Son: 6 saat önce  Yeni: 2
USOM                  🟢  Son: 4 saat önce  Yeni: 1
Cisco Security        🟡  Son: 1 gün önce   Yeni: 0

Son Alakalı İçerikler:
  🔴 [red.anthropic.com] Measuring LLMs' Ability...  Skor:95
  🟠 [vulncheck.com] Network Edge Device Report...    Skor:88
  🟠 [usom.gov.tr] FortiGate Güvenlik Uyarısı...      Skor:92
  
[Tümünü Gör] [Aylık Rapora Ekle]

─── YILLIK RAPOR TAKVİMİ ────────────────────────────────
Ocak   ✅ WEF Outlook 2026         Analiz edildi
       ✅ VulnCheck State of Exp.  Analiz edildi
Şubat  ✅ CrowdStrike GTR 2026     Analiz edildi
       ✅ IBM X-Force 2026         Analiz edildi
Nisan  ⏳ Mandiant M-Trends        Bekleniyor
Mayıs  ⏳ Verizon DBIR             Bu ay!
...
Ekim   📅 ENISA Threat Landscape   Planlandı

─── RAPOR ANALİZİ BAŞLAT ────────────────────────────────
[Rapor başlığı ve URL gir]
[PDF yükle] [URL'den işle] [Metni yapıştır]
[Claude ile Analiz Et →]
```

```
/admin-panel/intel/reports/:key

─── WEF GLOBAL CYBERSECURITY OUTLOOK 2026 ──────────────

Türkiye İmpact Özeti:
[Claude'un ürettiği Türkiye özeli analiz]

Ana Bulgular:
  1. %94 AI'ı en büyük değişim etkeni görüyor
     → Türkiye: CyberStep'in AI-first yaklaşımı
       tam bu trende yanıt veriyor
  2. $1.1T siber dolandırıcılık
     → Türkiye: DMARC eksikliği bu riski artırıyor
  ...

CyberStep Mesajları:
  "WEF verilerine göre KOBİ'ler..."
  "Küresel araştırma gösteriyor ki..."
  
[Aylık Rapora Ekle] [LinkedIn İçerik Üret]
[PDF İndir]
```

---

## BÖLÜM 7: AYLIK ENDEKSİNE OTOMATİK ENTEGRASYON

```typescript
// Aylık endeks raporu üretilirken bu veriyi kullan
// Mevcut aylık rapor üretim fonksiyonuna ekle:

export async function getGlobalContextForMonthlyReport(
  month: string // '2026-06'
): Promise<string> {

  // Bu ay analiz edilen raporlar
  const reports = await db.select()
    .from(annualIntelReportsTable)
    .where(
      and(
        eq(annualIntelReportsTable.status, "analyzed"),
        // Bu çeyrekte yayınlanan raporlar
      )
    )
    .orderBy(desc(annualIntelReportsTable.publishDate))
    .limit(3);

  // Son 30 günde önemli feed öğeleri
  const topFeedItems = await db.select()
    .from(intelFeedItemsTable)
    .where(
      and(
        eq(intelFeedItemsTable.isRelevant, true),
        gte(intelFeedItemsTable.relevanceScore, 70),
        gte(intelFeedItemsTable.createdAt, subDays(new Date(), 30))
      )
    )
    .orderBy(desc(intelFeedItemsTable.relevanceScore))
    .limit(5);

  // Edge CVE trendleri
  const edgeCVECount = await db.select({ count: count() })
    .from(vulncheckKevTable)
    .where(
      and(
        eq(vulncheckKevTable.isNetworkEdge, true),
        gte(vulncheckKevTable.dateAdded, subDays(new Date(), 30))
      )
    );

  // Claude ile bağlam bölümü yaz
  const ai = getClaudeAiFn("claude-haiku-4-5");

  const globalContext = await ai(`
Türkiye Siber Güvenlik Endeksi ${month} için
"Küresel Bağlam" bölümü yaz.

Veriler:
  Bu ay izlenen raporlardan öne çıkanlar:
  ${reports.map(r =>
    `- ${r.title}: ${r.turkeyImpactSummary?.slice(0, 200)}`
  ).join("\n")}

  Önemli gelişmeler:
  ${topFeedItems.map(i =>
    `- ${i.title} (${i.sourceKey})`
  ).join("\n")}

  Edge cihaz CVE: Son 30 günde ${edgeCVECount[0]?.count} yeni

  200-250 kelime, Türkçe, profesyonel.
  CyberStep'in Türkiye verisiyle
  küresel trendi karşılaştır.
  `);

  return globalContext;
}
```

---

## BÖLÜM 8: ENVIRONMENT VARIABLES

```bash
# Replit Secrets'a ekle:

# VulnCheck
VULNCHECK_API_KEY=         # vulncheck.com/auth/register (ücretsiz)

# İsteğe bağlı (gelişmiş özellikler):
# VULNCHECK_ENTERPRISE_TOKEN=  # Ücretli, daha fazla veri
```

---

## TEST SENARYOLARI

```
1. VulnCheck KEV testi:
   fetchVulnCheckKEV() manuel çalıştır
   → vulncheck_kev tablosunda kayıt düştü mü?
   → is_network_edge=true olanlar var mı?
   → in_cisa_kev=false oranı %70+ mı?

2. CVE zenginleştirme testi:
   enrichCVEWithVulnCheck("CVE-2024-21762")
   (FortiOS kritik CVE — VulnCheck'te olmalı)
   → isNetworkEdge: true dönüyor mu?
   → priorityLevel: "critical" mü?

3. Feed izleme testi:
   checkIntelFeeds() manuel çalıştır
   → intel_feed_items tablosuna kayıt düştü mü?
   → Fortinet PSIRT feed'i çalışıyor mu?
   → relevance_score hesaplandı mı?

4. Rapor analizi testi:
   Admin panelde "Rapor Analizi Başlat"
   WEF raporundan kısa bir pasaj gir
   → annualIntelReportsTable'da kayıt oluştu mu?
   → key_findings alanı dolu mu?
   → Admin emaili geldi mi?

5. Aylık rapor entegrasyon testi:
   getGlobalContextForMonthlyReport("2026-06")
   → 200+ kelime Türkçe metin döndü mü?
   → VulnCheck edge CVE sayısı dahil mi?
```

---

*CyberStep.io — CTI Entegrasyon Promptu — Haziran 2026*
*VulnCheck KEV + Yıllık İstihbarat Takvimi*
