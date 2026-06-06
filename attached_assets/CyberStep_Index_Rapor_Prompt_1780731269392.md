# CyberStep.io — Aylık Siber Güvenlik Endeksi
## Replit Agent Promptu — DB Doğrulama + Dashboard + Rapor Üretimi

---

## AMAÇ

Bu prompt üç şeyi yapar:

1. Tarama verilerinin endeks için
   doğru kaydedildiğini doğrular
   
2. Tarih aralığı seçimli dashboard
   ve rapor ekranını doğrular/kurar

3. 900 domain verisinden Türkiye
   Siber Güvenlik Endeksi üretir

---

## ADIM 0 — MEVCUT YAPIYA BAK

```
Şunları incele ve bana söyle:

domain_scans tablosu var mı?
  → Hangi kolonlar var?
  → Tarih kolonu: created_at mı, scanned_at mı?
  → Sektör bilgisi: sector kolonu var mı?
  → Şehir/il bilgisi var mı?

monthly_index_reports veya benzeri tablo var mı?
  → Önceki endeks raporları saklanıyor mu?

Admin panelde endeks/rapor sayfası var mı?
  → Tarih seçici var mı?
  → Aggregated istatistikler gösteriliyor mu?

Bunları bulduktan sonra aşağıdaki
eksik parçaları tamamla.
```

---

## BÖLÜM 1: VERİTABANI DOĞRULAMA + EKSİK KOLONLAR

```sql
-- domain_scans tablosuna eksik kolonları ekle
-- (varsa dokunma, yoksa ekle)

ALTER TABLE domain_scans
  ADD COLUMN IF NOT EXISTS sector varchar(100),
  -- Otomatik tespit veya manuel
  -- 'teknoloji' | 'finans' | 'saglik' |
  -- 'perakende' | 'insaat' | 'hizmet' | 'diger'

  ADD COLUMN IF NOT EXISTS company_size varchar(20),
  -- Shodan/WHOIS'ten tahmini
  -- 'micro' | 'small' | 'medium' | 'large'

  ADD COLUMN IF NOT EXISTS city varchar(50),
  -- Shodan IP geolocation'dan
  -- 'Istanbul' | 'Ankara' | 'Izmir' vb.

  ADD COLUMN IF NOT EXISTS hosting_provider varchar(100),
  -- Shodan ISP/ASN'den
  -- 'Turkcell' | 'Vodafone' | 'TurkTelekom' vb.

  ADD COLUMN IF NOT EXISTS is_wordpress boolean DEFAULT false,
  -- Shadow IT tespitinden
  ADD COLUMN IF NOT EXISTS has_cdn boolean DEFAULT false,
  -- WAF/CDN tespit edildi mi?
  ADD COLUMN IF NOT EXISTS cdn_provider varchar(50),
  -- 'cloudflare' | 'akamai' | null

  ADD COLUMN IF NOT EXISTS open_ports_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critical_cve_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_cve_count integer DEFAULT 0,

  ADD COLUMN IF NOT EXISTS included_in_index boolean DEFAULT true,
  -- Kamu/.edu domainleri false yapılır
  ADD COLUMN IF NOT EXISTS excluded_reason varchar(100);
  -- 'kamu_tld' | 'large_enterprise' | 'invalid_scan'

-- Endeks raporları tablosu
CREATE TABLE IF NOT EXISTS index_reports (
  id serial PRIMARY KEY,
  report_month varchar(7) UNIQUE NOT NULL,
  -- '2026-07' formatı

  -- Tarih aralığı
  period_start date NOT NULL,
  period_end date NOT NULL,

  -- Temel istatistikler
  total_domains_scanned integer DEFAULT 0,
  qualifying_domains integer DEFAULT 0,
  -- included_in_index = true olanlar
  avg_security_score decimal(5,2),
  score_distribution jsonb,
  -- {0-20: 45, 21-40: 120, 41-60: 380, 61-80: 290, 81-100: 65}

  -- E-posta güvenliği
  dmarc_missing_pct decimal(5,2),
  dmarc_none_pct decimal(5,2),
  dmarc_quarantine_pct decimal(5,2),
  dmarc_reject_pct decimal(5,2),
  spf_missing_pct decimal(5,2),
  dkim_missing_pct decimal(5,2),

  -- SSL
  ssl_valid_pct decimal(5,2),
  ssl_expiring_30d_pct decimal(5,2),
  ssl_expired_pct decimal(5,2),

  -- Açık portlar
  mysql_exposed_pct decimal(5,2),
  -- 3306 açık
  ftp_exposed_pct decimal(5,2),
  -- 21 açık
  rdp_exposed_pct decimal(5,2),
  -- 3389 açık
  any_high_risk_port_pct decimal(5,2),

  -- CVE
  domains_with_cve_pct decimal(5,2),
  domains_with_critical_cve_pct decimal(5,2),

  -- Teknoloji
  wordpress_usage_pct decimal(5,2),
  cdn_usage_pct decimal(5,2),

  -- Sektör breakdown
  sector_stats jsonb,
  -- [{sector, count, avg_score, top_risk}]

  -- Şehir breakdown
  city_stats jsonb,
  -- [{city, count, avg_score}]

  -- Hosting provider breakdown
  hosting_stats jsonb,

  -- Kara liste
  blacklisted_pct decimal(5,2),

  -- Claude üretimi içerikler
  executive_summary text,
  -- Yönetici özeti (Türkçe)
  key_findings jsonb,
  -- [{finding, data, cyberstep_note}]
  recommendations jsonb,
  -- [{priority, action, target_audience}]
  trend_analysis text,
  -- Önceki ayla karşılaştırma
  global_context text,
  -- WEF/VulnCheck verileriyle bağlantı

  -- Yayın durumu
  status varchar(20) DEFAULT 'draft',
  -- 'draft' | 'review' | 'published'
  pdf_path varchar(500),
  pdf_url varchar(500),
  published_at timestamp,
  published_by varchar(100),

  generated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- İndexler — sorgu hızı için kritik
CREATE INDEX IF NOT EXISTS domain_scans_date_idx
  ON domain_scans (created_at DESC);

CREATE INDEX IF NOT EXISTS domain_scans_score_idx
  ON domain_scans (overall_score);

CREATE INDEX IF NOT EXISTS domain_scans_index_idx
  ON domain_scans (included_in_index, created_at DESC);

CREATE INDEX IF NOT EXISTS domain_scans_sector_idx
  ON domain_scans (sector);
```

---

## BÖLÜM 2: VERİ ZENGİNLEŞTİRME SERVİSİ

```typescript
// src/services/indexReportEnricher.ts
// YENİ DOSYA
// Tarama sırasında veya sonrasında
// eksik alanları doldurur

// Sektör tespiti — domain adından akıllı tahmin
export function guessSector(
  domain: string,
  shodanOrg?: string
): string {

  const d = (domain + " " + (shodanOrg || "")).toLowerCase();

  // Finans
  if (/banka|finans|kredi|sigorta|yatirim|borsa|
      leasing|faktoring/i.test(d)) return "finans";

  // Sağlık
  if (/hastane|klinik|saglik|doktor|eczane|
      medikal|tip|dental/i.test(d)) return "saglik";

  // İnşaat / Gayrimenkul
  if (/insaat|yapi|bina|konut|emlak|gayrimenkul|
      taahhut|mühendis/i.test(d)) return "insaat";

  // Perakende / E-ticaret
  if (/market|magaza|shop|ticaret|satis|
      toptan|perakende/i.test(d)) return "perakende";

  // Üretim / Sanayi
  if (/fabrika|imalat|sanayi|uretim|metal|
      tekstil|plastik|kimya/i.test(d)) return "uretim";

  // Turizm / Konaklama
  if (/otel|hotel|turizm|tatil|resort|
      pansiyon|hostel/i.test(d)) return "turizm";

  // Eğitim (KOBİ — .edu değil)
  if (/egitim|kurs|okul|akademi|dershane/i.test(d))
    return "egitim";

  // Lojistik / Nakliye
  if (/lojistik|nakliye|kargo|tasima|
      depo|gumruk/i.test(d)) return "lojistik";

  // Teknoloji / Yazılım
  if (/yazilim|teknoloji|bilisim|software|
      dijital|web|it\b|bt\b/i.test(d)) return "teknoloji";

  return "diger";
}

// Hosting provider tespiti — Shodan ISP'den
export function detectHostingProvider(
  shodanIsp: string | null
): string {
  if (!shodanIsp) return "bilinmiyor";
  const isp = shodanIsp.toLowerCase();

  if (isp.includes("turkcell")) return "Turkcell";
  if (isp.includes("vodafone")) return "Vodafone";
  if (isp.includes("turk telekom") ||
      isp.includes("turktelekom")) return "TurkTelekom";
  if (isp.includes("bthaber") ||
      isp.includes("superonline")) return "Superonline";
  if (isp.includes("hizlinet") ||
      isp.includes("hızlınet")) return "HizliNet";
  if (isp.includes("netbudur")) return "Netbudur";
  if (isp.includes("yalinhost")) return "YalinHost";
  if (isp.includes("cloudflare")) return "Cloudflare";
  if (isp.includes("amazon")) return "AWS";
  if (isp.includes("microsoft") ||
      isp.includes("azure")) return "Azure";

  return shodanIsp.slice(0, 50);
}

// Her taramadan sonra bu fonksiyonu çağır:
export async function enrichScanRecord(
  scanId: number
): Promise<void> {

  const scan = await db.select()
    .from(domainScansTable)
    .where(eq(domainScansTable.id, scanId))
    .limit(1)
    .then(r => r[0]);

  if (!scan) return;

  // Kamu domain kontrolü
  const exclusion = isExcludedDomain(
    scan.domain,
    scan.shodanOrg
  );

  const sector = guessSector(
    scan.domain,
    scan.shodanOrg
  );

  const hostingProvider = detectHostingProvider(
    scan.shodanIsp
  );

  await db.update(domainScansTable).set({
    sector,
    hostingProvider,
    city:          scan.shodanCity || null,
    isWordpress:   scan.shadowItServices?.includes("WordPress") || false,
    hasCdn:        !!scan.wafProvider,
    cdnProvider:   scan.wafProvider || null,
    openPortsCount: scan.openPorts?.length || 0,
    includedInIndex: !exclusion.excluded,
    excludedReason:  exclusion.excluded
      ? exclusion.reason : null,
  }).where(eq(domainScansTable.id, scanId));
}
```

---

## BÖLÜM 3: ENDEKs HESAPLAYICI

```typescript
// src/services/indexReportCalculator.ts
// YENİ DOSYA

export async function calculateIndexStats(
  startDate: Date,
  endDate: Date
): Promise<IndexStats> {

  // Tarih aralığındaki qualifiye domainler
  const scans = await db.select()
    .from(domainScansTable)
    .where(
      and(
        gte(domainScansTable.createdAt, startDate),
        lte(domainScansTable.createdAt, endDate),
        eq(domainScansTable.includedInIndex, true),
        eq(domainScansTable.status, "completed"),
      )
    );

  if (scans.length === 0) {
    throw new Error("Bu tarih aralığında yeterli veri yok");
  }

  // ─── TEMEL SKORLAR ───────────────────────────────────
  const avgScore = scans.reduce(
    (sum, s) => sum + (s.overallScore || 0), 0
  ) / scans.length;

  const scoreDistribution = {
    "0-20":   scans.filter(s => s.overallScore <= 20).length,
    "21-40":  scans.filter(s => s.overallScore > 20 && s.overallScore <= 40).length,
    "41-60":  scans.filter(s => s.overallScore > 40 && s.overallScore <= 60).length,
    "61-80":  scans.filter(s => s.overallScore > 60 && s.overallScore <= 80).length,
    "81-100": scans.filter(s => s.overallScore > 80).length,
  };

  // ─── E-POSTA GÜVENLİĞİ ───────────────────────────────
  const pct = (n: number) =>
    Math.round((n / scans.length) * 100 * 10) / 10;

  const dmarcMissing    = pct(scans.filter(s => !s.dmarcRecord).length);
  const dmarcNone       = pct(scans.filter(s => s.dmarcPolicy === "none").length);
  const dmarcQuarantine = pct(scans.filter(s => s.dmarcPolicy === "quarantine").length);
  const dmarcReject     = pct(scans.filter(s => s.dmarcPolicy === "reject").length);
  const spfMissing      = pct(scans.filter(s => !s.spfRecord).length);
  const dkimMissing     = pct(scans.filter(s => !s.dkimPass).length);

  // ─── SSL ─────────────────────────────────────────────
  const sslValid      = pct(scans.filter(s => (s.sslDaysLeft || 0) > 30).length);
  const sslExpiring   = pct(scans.filter(s => (s.sslDaysLeft || 0) > 0 && (s.sslDaysLeft || 0) <= 30).length);
  const sslExpired    = pct(scans.filter(s => (s.sslDaysLeft || 0) <= 0 || !s.sslDaysLeft).length);

  // ─── AÇIK PORTLAR ────────────────────────────────────
  const mysqlExposed = pct(scans.filter(s =>
    s.openPorts?.includes(3306)).length);
  const ftpExposed   = pct(scans.filter(s =>
    s.openPorts?.includes(21)).length);
  const rdpExposed   = pct(scans.filter(s =>
    s.openPorts?.includes(3389)).length);
  const anyHighRisk  = pct(scans.filter(s =>
    [3306, 21, 3389, 5900, 1433].some(
      p => s.openPorts?.includes(p)
    )).length);

  // ─── CVE ─────────────────────────────────────────────
  const withCVE = pct(scans.filter(s =>
    (s.cveCount || 0) > 0).length);
  const withCriticalCVE = pct(scans.filter(s =>
    (s.criticalCveCount || 0) > 0).length);

  // ─── TEKNOLOJİ ───────────────────────────────────────
  const wordpressUsage = pct(scans.filter(s =>
    s.isWordpress).length);
  const cdnUsage       = pct(scans.filter(s =>
    s.hasCdn).length);
  const blacklisted    = pct(scans.filter(s =>
    (s.blacklistCount || 0) > 0).length);

  // ─── SEKTÖR BREAKDOWN ────────────────────────────────
  const sectorMap = new Map<string, number[]>();
  for (const scan of scans) {
    const sec = scan.sector || "diger";
    if (!sectorMap.has(sec)) sectorMap.set(sec, []);
    sectorMap.get(sec)!.push(scan.overallScore || 0);
  }

  const sectorStats = Array.from(sectorMap.entries())
    .map(([sector, scores]) => ({
      sector,
      count: scores.length,
      avgScore: Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      ),
      pct: pct(scores.length),
    }))
    .sort((a, b) => b.count - a.count);

  // ─── ŞEHİR BREAKDOWN ─────────────────────────────────
  const cityMap = new Map<string, number[]>();
  for (const scan of scans) {
    const city = scan.city || "Bilinmiyor";
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(scan.overallScore || 0);
  }

  const cityStats = Array.from(cityMap.entries())
    .filter(([_, scores]) => scores.length >= 5)
    .map(([city, scores]) => ({
      city,
      count: scores.length,
      avgScore: Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ─── HOSTİNG PROVIDER ────────────────────────────────
  const hostingMap = new Map<string, number>();
  for (const scan of scans) {
    const h = scan.hostingProvider || "Bilinmiyor";
    hostingMap.set(h, (hostingMap.get(h) || 0) + 1);
  }

  const hostingStats = Array.from(hostingMap.entries())
    .map(([provider, count]) => ({
      provider, count, pct: pct(count)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalScanned:      scans.length,
    qualifyingDomains: scans.length,
    avgScore:          Math.round(avgScore * 10) / 10,
    scoreDistribution,
    email: {
      dmarcMissing, dmarcNone, dmarcQuarantine,
      dmarcReject, spfMissing, dkimMissing,
    },
    ssl: { sslValid, sslExpiring, sslExpired },
    ports: { mysqlExposed, ftpExposed, rdpExposed, anyHighRisk },
    cve: { withCVE, withCriticalCVE },
    tech: { wordpressUsage, cdnUsage },
    blacklisted,
    sectorStats,
    cityStats,
    hostingStats,
  };
}
```

---

## BÖLÜM 4: CLAUDE İLE RAPOR İÇERİĞİ ÜRETİMİ

```typescript
// src/services/indexReportWriter.ts
// YENİ DOSYA

export async function generateIndexContent(
  stats: IndexStats,
  reportMonth: string,
  prevMonthStats?: IndexStats | null
): Promise<IndexContent> {

  // Trend hesapla
  const trend = prevMonthStats ? {
    scoreDelta: stats.avgScore - prevMonthStats.avgScore,
    dmarcDelta: stats.email.dmarcMissing
      - prevMonthStats.email.dmarcMissing,
    domainsDelta: stats.totalScanned
      - prevMonthStats.totalScanned,
  } : null;

  // Claude Sonnet ile yönetici özeti
  const execSummary = await callClaude(`
Sen Türkiye'nin siber güvenlik veri analistisın.
${reportMonth} dönemi için Türkiye Siber Güvenlik
Endeksi yönetici özetini yaz.

Veriler (${stats.totalScanned} TR domain tarandı):
  Ortalama güvenlik skoru: ${stats.avgScore}/100
  ${trend ? `Geçen aya göre: ${trend.scoreDelta > 0 ? "+" : ""}${trend.scoreDelta.toFixed(1)} puan` : ""}

E-posta güvenliği:
  DMARC kaydı yok: %${stats.email.dmarcMissing}
  DMARC p=none (izleme): %${stats.email.dmarcNone}
  SPF kaydı yok: %${stats.email.spfMissing}

Kritik açık portlar:
  MySQL (3306) açık: %${stats.ports.mysqlExposed}
  FTP (21) açık: %${stats.ports.ftpExposed}
  RDP (3389) açık: %${stats.ports.rdpExposed}

SSL durumu:
  Geçerli: %${stats.ssl.sslValid}
  30 gün içinde doluyor: %${stats.ssl.sslExpiring}

En riskli sektörler:
${stats.sectorStats
  .sort((a, b) => a.avgScore - b.avgScore)
  .slice(0, 3)
  .map(s => `  ${s.sector}: ortalama ${s.avgScore}/100 (${s.count} domain)`)
  .join("\n")}

Yönetici özeti kuralları:
  3-4 paragraf, Türkçe, sade dil
  İlk paragraf: genel durum
  İkinci: en kritik 2-3 bulgu
  Üçüncü: sektör/şehir öne çıkanlar
  Dördüncü: öneri ve çağrı
  Sayıları doğrudan kullan
  CyberStep'ten bahset ama satış tonu yok
  `, {
    model: "claude-sonnet-4-6",
    maxTokens: 600,
  });

  // Key findings — yapılandırılmış
  const keyFindings = await callClaude(`
Aşağıdaki verilerden en önemli 5 bulguyu üret.

${JSON.stringify(stats, null, 2).slice(0, 3000)}

Her bulgu için JSON döndür:
[
  {
    "finding": "Kısa başlık (max 10 kelime)",
    "data": "Destekleyen rakam",
    "severity": "critical|high|medium",
    "cyberstep_note": "CyberStep bu konuda ne sağlar"
  }
]
Sadece JSON. 5 madde.
  `, {
    model: "claude-haiku-4-5",
    maxTokens: 500,
  });

  // Global bağlam — WEF/VulnCheck verileriyle
  const globalContext = await callClaude(`
Türkiye Siber Güvenlik Endeksi için
küresel bağlam paragrafı yaz (100-150 kelime):

WEF 2026: %94 lider AI'ı en büyük risk olarak görüyor,
siber eşitsizlik uçurumu büyüyor, KOBİ'ler geride.
VulnCheck 2026: KEV'lerin %28.96'sı CVE öncesi istismar,
network edge cihazlar 1 numara hedef.

Türkiye verisi (${stats.avgScore}/100 ortalama skor,
%${stats.email.dmarcMissing} DMARC eksik)
ile küresel tabloyu karşılaştır.
Türkçe, profesyonel.
  `, {
    model: "claude-haiku-4-5",
    maxTokens: 250,
  });

  return {
    executiveSummary: execSummary,
    keyFindings: JSON.parse(
      keyFindings.replace(/```json|```/g, "").trim()
    ),
    globalContext,
  };
}
```

---

## BÖLÜM 5: ADMİN DASHBOARD

```typescript
// GET /api/admin/index/dashboard
// Tarih aralığı seçili → anında istatistikler

router.get("/index/dashboard", requireAdmin,
  async (req, res) => {

  const {
    start = subDays(new Date(), 30).toISOString().split("T")[0],
    end   = new Date().toISOString().split("T")[0],
  } = req.query;

  try {
    const startDate = new Date(String(start));
    const endDate   = new Date(String(end));

    // Tarih farkı max 90 gün
    if (differenceInDays(endDate, startDate) > 90) {
      res.status(400).json({
        error: "Maksimum 90 günlük aralık seçilebilir"
      });
      return;
    }

    // Temel sayılar (hızlı)
    const [counts] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN included_in_index THEN 1 END) as qualifying,
        ROUND(AVG(overall_score), 1) as avg_score,
        MIN(overall_score) as min_score,
        MAX(overall_score) as max_score,
        COUNT(CASE WHEN overall_score < 40 THEN 1 END) as critical_count,
        COUNT(CASE WHEN overall_score BETWEEN 40 AND 59 THEN 1 END) as high_count,
        COUNT(CASE WHEN overall_score BETWEEN 60 AND 79 THEN 1 END) as medium_count,
        COUNT(CASE WHEN overall_score >= 80 THEN 1 END) as low_count
      FROM domain_scans
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
        AND status = 'completed'
    `);

    // Günlük tarama trendi
    const dailyTrend = await db.execute(sql`
      SELECT
        DATE(created_at) as scan_date,
        COUNT(*) as count,
        ROUND(AVG(overall_score), 1) as avg_score
      FROM domain_scans
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
        AND status = 'completed'
        AND included_in_index = true
      GROUP BY DATE(created_at)
      ORDER BY scan_date ASC
    `);

    // E-posta güvenliği özeti
    const emailStats = await db.execute(sql`
      SELECT
        ROUND(100.0 * SUM(CASE WHEN dmarc_record IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as dmarc_missing_pct,
        ROUND(100.0 * SUM(CASE WHEN dmarc_policy = 'none' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as dmarc_none_pct,
        ROUND(100.0 * SUM(CASE WHEN dmarc_policy = 'reject' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as dmarc_reject_pct,
        ROUND(100.0 * SUM(CASE WHEN spf_record IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as spf_missing_pct,
        ROUND(100.0 * SUM(CASE WHEN dkim_pass = false THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as dkim_missing_pct
      FROM domain_scans
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
        AND status = 'completed'
        AND included_in_index = true
    `);

    // Port riski
    const portStats = await db.execute(sql`
      SELECT
        ROUND(100.0 * SUM(CASE WHEN 3306 = ANY(open_ports) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as mysql_pct,
        ROUND(100.0 * SUM(CASE WHEN 21 = ANY(open_ports) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as ftp_pct,
        ROUND(100.0 * SUM(CASE WHEN 3389 = ANY(open_ports) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as rdp_pct
      FROM domain_scans
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
        AND status = 'completed'
        AND included_in_index = true
    `);

    // Sektör dağılımı
    const sectorStats = await db.execute(sql`
      SELECT
        COALESCE(sector, 'diger') as sector,
        COUNT(*) as count,
        ROUND(AVG(overall_score), 1) as avg_score
      FROM domain_scans
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
        AND status = 'completed'
        AND included_in_index = true
      GROUP BY sector
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      period: { start, end },
      summary: counts,
      dailyTrend,
      emailSecurity: emailStats,
      portRisk: portStats,
      sectorBreakdown: sectorStats,
      dataQuality: {
        withSector: "sektör alanı dolu olanlar",
        withCity:   "şehir alanı dolu olanlar",
        // Veri zenginliği göstergesi
      },
    });
  } catch (err) {
    logger.error({ err }, "Index dashboard hatası");
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/admin/index/generate
// Endeks raporu oluştur
router.post("/index/generate", requireAdmin,
  async (req, res) => {

  const { start, end, reportMonth } = req.body;

  if (!start || !end || !reportMonth) {
    res.status(400).json({
      error: "start, end ve reportMonth zorunlu"
    });
    return;
  }

  const startDate = new Date(start);
  const endDate   = new Date(end);

  try {
    // İstatistikleri hesapla
    const stats = await calculateIndexStats(
      startDate, endDate
    );

    if (stats.totalScanned < 100) {
      res.status(400).json({
        error: `Yetersiz veri: ${stats.totalScanned} domain. Minimum 100 gerekli.`,
        current: stats.totalScanned,
      });
      return;
    }

    // Önceki ay verisini al
    const prevMonth = format(
      subMonths(new Date(start), 1), "yyyy-MM"
    );
    const prevReport = await db.select()
      .from(indexReportsTable)
      .where(eq(indexReportsTable.reportMonth, prevMonth))
      .limit(1);

    const prevStats = prevReport[0]
      ? await recalcStatsFromReport(prevReport[0])
      : null;

    // Claude ile içerik üret
    const content = await generateIndexContent(
      stats, reportMonth, prevStats
    );

    // DB'ye kaydet
    await db.insert(indexReportsTable).values({
      reportMonth,
      periodStart: startDate,
      periodEnd:   endDate,
      totalDomainsScanned: stats.totalScanned,
      qualifyingDomains:   stats.qualifyingDomains,
      avgSecurityScore:    stats.avgScore,
      scoreDistribution:   stats.scoreDistribution,
      dmarcMissingPct:     stats.email.dmarcMissing,
      dmarcNonePct:        stats.email.dmarcNone,
      dmarcQuarantinePct:  stats.email.dmarcQuarantine,
      dmarcRejectPct:      stats.email.dmarcReject,
      spfMissingPct:       stats.email.spfMissing,
      dkimMissingPct:      stats.email.dkimMissing,
      sslValidPct:         stats.ssl.sslValid,
      sslExpiring30dPct:   stats.ssl.sslExpiring,
      sslExpiredPct:       stats.ssl.sslExpired,
      mysqlExposedPct:     stats.ports.mysqlExposed,
      ftpExposedPct:       stats.ports.ftpExposed,
      rdpExposedPct:       stats.ports.rdpExposed,
      anyHighRiskPortPct:  stats.ports.anyHighRisk,
      domainsWithCvePct:   stats.cve.withCVE,
      domainsWithCriticalCvePct: stats.cve.withCriticalCVE,
      wordpressUsagePct:   stats.tech.wordpressUsage,
      cdnUsagePct:         stats.tech.cdnUsage,
      blacklistedPct:      stats.blacklisted,
      sectorStats:         stats.sectorStats,
      cityStats:           stats.cityStats,
      hostingStats:        stats.hostingStats,
      executiveSummary:    content.executiveSummary,
      keyFindings:         content.keyFindings,
      globalContext:       content.globalContext,
      status:              "draft",
    }).onConflictDoUpdate({
      target: indexReportsTable.reportMonth,
      set: {
        totalDomainsScanned: stats.totalScanned,
        avgSecurityScore:    stats.avgScore,
        executiveSummary:    content.executiveSummary,
        keyFindings:         content.keyFindings,
        status:              "draft",
        updatedAt:           new Date(),
      },
    });

    res.json({
      success:      true,
      reportMonth,
      stats: {
        totalScanned:  stats.totalScanned,
        avgScore:      stats.avgScore,
        dmarcMissing:  stats.email.dmarcMissing,
      },
      message: "Rapor taslak olarak oluşturuldu. Önizleyin ve yayınlayın.",
    });

  } catch (err) {
    logger.error({ err }, "Index rapor üretim hatası");
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/admin/index/:month/publish
router.post("/index/:month/publish", requireAdmin,
  async (req, res) => {

  const { month } = req.params;

  await db.update(indexReportsTable).set({
    status:      "published",
    publishedAt: new Date(),
    publishedBy: req.admin?.email || "admin",
  }).where(eq(indexReportsTable.reportMonth, month));

  // PDF üret
  // TODO: generateIndexReportPDF() çağır

  res.json({ success: true, publishedAt: new Date() });
});
```

---

## BÖLÜM 6: ADMİN PANEL DASHBOARD GÖRÜNÜMÜ

```
/admin-panel/index-reports

─── TÜRKİYE SİBER GÜVENLİK ENDEKSİ ────────────────────

Tarih Aralığı:
[1 Temmuz 2026 ▼] — [31 Temmuz 2026 ▼]  [Uygula]

Hızlı seçim: [Bu Ay] [Geçen Ay] [Son 30 Gün] [Son 7 Gün]

─── ÖZET (937 Domain) ───────────────────────────────────

Ortalama Skor    E-posta Riski    Açık MySQL     CDN Kullanımı
    57/100          %68 DMARC        %8.3           %34
 ▲ +3 geçen ay     eksik           açık            

─── SKOR DAĞILIMI ───────────────────────────────────────
[Histogram: 0-20 / 21-40 / 41-60 / 61-80 / 81-100]
0-20:  45 domain  ████
21-40: 120 domain ████████████
41-60: 380 domain ████████████████████████████████████
61-80: 290 domain ████████████████████████████
81-100: 65 domain ██████

─── GÜNLÜK TARAMA TRENDİ ────────────────────────────────
[Line chart: Temmuz 1-31, günlük tarama ve ortalama skor]

─── SEKTÖR BREAKDOWN ────────────────────────────────────
Sektör          Domain    Ort.Skor   Risk Seviyesi
İnşaat            187      51/100    🟠 Yüksek
Perakende         145      54/100    🟠 Yüksek
Hizmet            132      59/100    🟡 Orta
Teknoloji         98       63/100    🟡 Orta
Turizm            87       52/100    🟠 Yüksek
...

─── RAPOR ÜRETİMİ ───────────────────────────────────────
Rapor Ayı: [Temmuz 2026 ▼]

[📊 Rapor Üret]  [👁️ Önizle]  [📤 Yayınla]

─── ÖNCEKİ RAPORLAR ─────────────────────────────────────
Henüz yayınlanmış rapor yok.


/admin-panel/index-reports/2026-07 (önizleme)

─── TEMMUZ 2026 SİBER GÜVENLİK ENDEKSİ ─────────────────
Durum: Taslak
937 domain · 1-31 Temmuz 2026

YÖNETİCİ ÖZETİ:
[Claude'un ürettiği özet metni]

ANA BULGULAR:
🔴 %68 DMARC kaydı yok — E-posta sahteciliğine açık
🔴 %8.3 MySQL portu açıkta — Doğrudan veri hırsızlığı riski
🟠 Ortalama skor 57/100 — Türkiye KOBİ segmenti risk altında
🟠 İnşaat sektörü en riskli — 187 domain, 51/100 ortalama
🟡 CDN/WAF kullanımı %34 — Küresel %67 ortalamasının altında

KÜRESEL BAĞLAM:
[WEF/VulnCheck verileriyle karşılaştırma]

[✏️ Düzenle]  [📤 Yayınla]  [📄 PDF Üret]
```

---

## BÖLÜM 7: TEST SENARYOLARI

```
1. DB kolon kontrolü:
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'domain_scans';
   → sector, city, hosting_provider,
     is_wordpress, has_cdn, included_in_index
     kolonları var mı? ✓

2. Veri zenginleştirme testi:
   Son taramalardan birini seç
   enrichScanRecord(scanId) çalıştır
   → sector dolu mu? ✓
   → included_in_index doğru mu?
     (sinop.edu.tr → false) ✓

3. Dashboard API testi:
   GET /api/admin/index/dashboard?
   start=2026-06-01&end=2026-06-06
   → JSON döndü mü? ✓
   → summary.total > 0 mu? ✓
   → emailSecurity.dmarc_missing_pct var mı? ✓

4. Rapor üretim testi:
   POST /api/admin/index/generate
   { start: "2026-06-01", end: "2026-06-06",
     reportMonth: "2026-06" }
   → 100'den az domain varsa 400 hatası ✓
   → Yeterliyse index_reports tablosuna kayıt ✓
   → executiveSummary dolu mu? ✓
   → keyFindings 5 madde mi? ✓

5. Tarih aralığı seçici testi:
   Admin panelde [Bu Ay] butonuna bas
   → Tarih aralığı otomatik doldu mu? ✓
   → İstatistikler güncellendi mi? ✓

6. Veri kalitesi kontrolü:
   SELECT COUNT(*), COUNT(sector),
   COUNT(city), AVG(overall_score)
   FROM domain_scans
   WHERE included_in_index = true
   AND created_at > NOW() - INTERVAL '7 days';
   → sector doluluk oranı nedir?
   → city doluluk oranı nedir?
   Düşükse enrichScanRecord() pipeline'a ekle
```

---

*CyberStep.io — Siber Güvenlik Endeksi Sistemi — Haziran 2026*
*900 domain → Türkiye'nin siber güvenlik aynası*
