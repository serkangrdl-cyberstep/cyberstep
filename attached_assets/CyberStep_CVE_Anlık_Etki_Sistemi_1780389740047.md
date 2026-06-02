# CyberStep.io — CVE Anlık Türkiye Etki Sistemi
## Replit Agent Promptu — Kritik CVE → 2 Saatte Türkiye Raporu

---

## AMAÇ

Yeni kritik bir CVE yayınlandığında
(CVSS 8.0+) sistem otomatik olarak:

1. CVE'yi NVD/CISA feed'inden algılar
2. Etkilenen teknolojiyi CyberStep
   tech_stack veritabanıyla eşleştirir
3. Türkiye'de kaç domain etkilendiğini
   hesaplar
4. Claude ile Türkçe analiz yazar
5. LinkedIn, X ve e-posta formatları
   üretir
6. Etkilenen şirketlere uyarı gönderir
7. Admin paneline düşer, onay beklenir

Hedef: CVE duyurulduktan
**2 saat içinde** Türkiye raporu hazır.

---

## BÖLÜM 1: VERİTABANI

```sql
-- CVE takip tablosu
CREATE TABLE IF NOT EXISTS cve_tracker (
  id serial PRIMARY KEY,
  cve_id varchar(30) UNIQUE NOT NULL,
  -- 'CVE-2024-12345'
  cvss_score decimal(3,1),
  cvss_vector varchar(100),
  severity varchar(20),
  -- 'critical' | 'high' | 'medium'
  title varchar(500),
  description text,
  affected_products jsonb,
  -- [{vendor, product, versions_affected}]
  published_at timestamp,
  -- NVD'de yayın tarihi
  detected_at timestamp DEFAULT now(),
  -- CyberStep'in tespit ettiği an
  patch_available boolean DEFAULT false,
  patch_url varchar(500),
  exploit_public boolean DEFAULT false,
  -- Kamuya açık exploit var mı?
  cisa_kev boolean DEFAULT false,
  -- CISA KEV (Known Exploited) listesinde mi?

  -- Türkiye etkisi
  tr_scan_started_at timestamp,
  tr_scan_completed_at timestamp,
  tr_affected_domains integer DEFAULT 0,
  tr_critical_domains integer DEFAULT 0,
  -- Yama yok + patch_available = true olan
  tr_sectors_affected jsonb,
  -- {finans: 12, teknoloji: 45, ...}
  tr_top_cities jsonb,
  -- {istanbul: 34, ankara: 12, ...}

  -- İçerik
  tr_analysis text,
  -- Claude'un Türkçe analizi
  linkedin_post text,
  x_thread jsonb,
  -- [{tweet_no, content}]
  email_subject varchar(255),
  email_html text,
  press_note text,
  -- Medyaya kısa not

  -- Durum
  status varchar(20) DEFAULT 'detected',
  -- 'detected' | 'scanning' | 'analyzed' |
  -- 'published' | 'skipped'
  skip_reason varchar(100),
  -- Neden atlandı (düşük etki, vs.)
  published_at_linkedin timestamp,
  published_at_x timestamp,
  notifications_sent integer DEFAULT 0,

  created_at timestamp DEFAULT now()
);

-- CVE → etkilenen domain eşleşmeleri
CREATE TABLE IF NOT EXISTS cve_domain_matches (
  id serial PRIMARY KEY,
  cve_id varchar(30) REFERENCES cve_tracker(cve_id),
  domain varchar(255),
  customer_id integer REFERENCES customers(id),
  lead_candidate_id integer REFERENCES lead_candidates(id),
  -- Henüz müşteri değil ama lead

  -- Eşleşme detayı
  matched_product varchar(150),
  -- Etkilenen ürün (WordPress 6.4, vs.)
  matched_version varchar(50),
  confidence integer,
  -- Eşleşme güven skoru 0-100

  -- Yama durumu
  is_patched boolean DEFAULT false,
  patched_at timestamp,
  patch_verified_at timestamp,

  -- Bildirim
  notification_sent boolean DEFAULT false,
  notification_sent_at timestamp,
  notification_type varchar(20),
  -- 'email' | 'whatsapp' | 'portal'

  created_at timestamp DEFAULT now(),
  UNIQUE(cve_id, domain)
);
```

---

## BÖLÜM 2: CVE FEED OKUYUCU

```typescript
// src/cve/cveFeedReader.ts
// YENİ DOSYA

// Kaynaklar (öncelik sırasıyla):
// 1. CISA KEV — zaten istismar edilenler, en acil
// 2. NVD API — yeni yayınlanan CVE'ler
// 3. GitHub Advisory Database — yazılım açıkları

const FEEDS = {
  cisa_kev: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  nvd_recent: 'https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate={DATE}&cvssV3Severity=CRITICAL',
  nvd_high: 'https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate={DATE}&cvssV3Severity=HIGH',
};

export async function checkNewCVEs(): Promise<CVEEntry[]> {
  const newCVEs: CVEEntry[] = [];
  const checkSince = new Date(Date.now() - 6 * 60 * 60 * 1000);
  // Son 6 saatte yayınlananlar

  // CISA KEV feed
  try {
    const resp = await axios.get(FEEDS.cisa_kev, { timeout: 10000 });
    const kevList = resp.data.vulnerabilities || [];

    for (const kev of kevList) {
      const alreadyTracked = await db.select()
        .from(cveTracker)
        .where(eq(cveTracker.cveId, kev.cveID))
        .limit(1);

      if (alreadyTracked.length > 0) continue;

      newCVEs.push({
        cveId: kev.cveID,
        title: kev.vulnerabilityName,
        description: kev.shortDescription,
        affectedProducts: [{
          vendor: kev.vendorProject,
          product: kev.product,
        }],
        cisaKev: true,
        exploitPublic: true,
        cvssScore: null, // KEV'de yok, NVD'den alınacak
      });
    }
  } catch (e) {
    logger.warn('CISA KEV feed hatası', e.message);
  }

  // NVD Critical CVEs
  try {
    const dateStr = checkSince.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    const url = FEEDS.nvd_recent.replace('{DATE}', dateStr);
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: { 'apiKey': process.env.NVD_API_KEY || '' },
    });

    for (const vuln of resp.data.vulnerabilities || []) {
      const cve = vuln.cve;
      const cveId = cve.id;

      // Zaten var mı?
      const exists = await db.select()
        .from(cveTracker)
        .where(eq(cveTracker.cveId, cveId))
        .limit(1);
      if (exists.length > 0) continue;

      // CVSS skoru
      const cvssScore = cve.metrics?.cvssMetricV31?.[0]
        ?.cvssData?.baseScore ||
        cve.metrics?.cvssMetricV30?.[0]
        ?.cvssData?.baseScore || 0;

      if (cvssScore < 8.0) continue;
      // 8.0 altını takip etme

      // Etkilenen ürünler
      const affected = cve.configurations?.[0]
        ?.nodes?.[0]?.cpeMatch?.map((cpe: any) => {
          const parts = cpe.criteria.split(':');
          return {
            vendor: parts[3],
            product: parts[4],
            versionStartIncluding: cpe.versionStartIncluding,
            versionEndExcluding: cpe.versionEndExcluding,
          };
        }) || [];

      newCVEs.push({
        cveId,
        cvssScore,
        severity: cvssScore >= 9.0 ? 'critical' : 'high',
        title: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || cveId,
        description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '',
        affectedProducts: affected,
        publishedAt: new Date(cve.published),
        patchAvailable: cve.references?.some((r: any) =>
          r.tags?.includes('Patch')
        ) || false,
        cisaKev: false,
        exploitPublic: cve.references?.some((r: any) =>
          r.tags?.includes('Exploit')
        ) || false,
      });
    }
  } catch (e) {
    logger.warn('NVD feed hatası', e.message);
  }

  return newCVEs;
}
```

---

## BÖLÜM 3: TÜRKİYE ETKİ ANALİZİ

```typescript
// src/cve/turkeyImpactAnalyzer.ts
// YENİ DOSYA

// Etkilenen ürünleri tech_stack verisindeki
// Türk domainlerle eşleştir

export async function analyzeTurkeyImpact(
  cve: CVEEntry
): Promise<TurkeyImpactResult> {

  await db.update(cveTracker).set({
    status: 'scanning',
    trScanStartedAt: new Date(),
  }).where(eq(cveTracker.cveId, cve.cveId));

  const affectedDomains: CVEDomainMatch[] = [];

  for (const product of cve.affectedProducts) {
    // Tech stack verisinde bu ürünü kullanan TR domainler
    const matches = await db.select({
      domain: customerTechStack.domain,
      customerId: customerTechStack.customerId,
      leadId: customerTechStack.leadCandidateId,
      vendor: customerTechStack.vendor,
      product: customerTechStack.product,
      version: customerTechStack.version,
      confidence: customerTechStack.confidence,
    })
    .from(customerTechStack)
    .where(
      and(
        // Vendor eşleşmesi (fuzzy)
        or(
          ilike(customerTechStack.vendor, `%${product.vendor}%`),
          ilike(customerTechStack.product, `%${product.product}%`),
        ),
        // Sadece TR domainler
        or(
          like(customerTechStack.domain, '%.tr'),
          like(customerTechStack.domain, '%.com.tr'),
        ),
      )
    );

    for (const match of matches) {
      // Versiyon eşleşmesi (varsa)
      let isVulnerable = true;
      let confidence = match.confidence;

      if (product.versionEndExcluding && match.version) {
        isVulnerable = isVersionVulnerable(
          match.version,
          product.versionStartIncluding,
          product.versionEndExcluding
        );
        if (!isVulnerable) continue;
        confidence = Math.min(confidence + 10, 100);
        // Versiyon eşleşti = daha güvenilir
      }

      affectedDomains.push({
        cveId: cve.cveId,
        domain: match.domain,
        customerId: match.customerId,
        leadCandidateId: match.leadId,
        matchedProduct: match.product,
        matchedVersion: match.version,
        confidence,
      });
    }
  }

  // Deduplikasyon — bir domain birden fazla
  // ürünle eşleşebilir
  const uniqueDomains = deduplicateByDomain(affectedDomains);

  // Sektör analizi
  const sectorBreakdown = await getSectorBreakdown(
    uniqueDomains.map(d => d.domain)
  );

  // Şehir analizi
  const cityBreakdown = await getCityBreakdown(
    uniqueDomains.map(d => d.domain)
  );

  // Kritik: Yama yok + exploit var
  const criticalDomains = cve.exploitPublic || cve.cisaKev
    ? uniqueDomains.filter(d => d.confidence >= 70)
    : [];

  // DB'ye kaydet
  if (uniqueDomains.length > 0) {
    await db.insert(cveDomainMatches)
      .values(uniqueDomains)
      .onConflictDoNothing();
  }

  // CVE kaydı güncelle
  await db.update(cveTracker).set({
    trAffectedDomains: uniqueDomains.length,
    trCriticalDomains: criticalDomains.length,
    trSectorsAffected: sectorBreakdown,
    trTopCities: cityBreakdown,
    trScanCompletedAt: new Date(),
  }).where(eq(cveTracker.cveId, cve.cveId));

  return {
    totalAffected: uniqueDomains.length,
    criticalAffected: criticalDomains.length,
    sectorBreakdown,
    cityBreakdown,
    topAffectedDomains: uniqueDomains
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5),
    // İlk 5 — bildirim için (şirket adı paylaşılmaz)
  };
}

function isVersionVulnerable(
  currentVersion: string,
  startInclusive: string | undefined,
  endExclusive: string | undefined
): boolean {
  try {
    const semver = require('semver');
    const range = [
      startInclusive ? `>=${startInclusive}` : '',
      endExclusive ? `<${endExclusive}` : '',
    ].filter(Boolean).join(' ');

    return range ? semver.satisfies(currentVersion, range) : true;
  } catch {
    // Versiyon parse edilemedi — vulnerable say (güvenli taraf)
    return true;
  }
}
```

---

## BÖLÜM 4: CLAUDE İÇERİK ÜRETİCİ

```typescript
// src/cve/cveContentGenerator.ts
// YENİ DOSYA

export async function generateCVEContent(
  cve: CVEEntry,
  impact: TurkeyImpactResult
): Promise<CVEContent> {

  // Etki seviyesi
  const impactLevel =
    impact.totalAffected >= 500 ? 'yaygın' :
    impact.totalAffected >= 100 ? 'önemli' :
    impact.totalAffected >= 20 ? 'sınırlı' : 'az';

  const worstSector = Object.entries(impact.sectorBreakdown)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'bilinmiyor';

  const systemPrompt = `
Sen CyberStep.io'nun baş güvenlik analistisin.
Teknik bilgiyi iş diline çeviriyorsun.
Abartmıyor, ama gerçeği net söylüyorsun.
Türkçe yazıyorsun.
Hiçbir şirketi ismiyle anmıyorsun.
`;

  // 1. Türkçe Analiz (Blog/Rapor için)
  const analysisPrompt = `
CVE BİLGİSİ:
  ID: ${cve.cveId}
  CVSS: ${cve.cvssScore} — ${cve.severity.toUpperCase()}
  Başlık: ${cve.title}
  Açıklama: ${cve.description}
  Yama: ${cve.patchAvailable ? 'Mevcut' : 'Henüz yok'}
  Exploit kamuya açık: ${cve.exploitPublic ? 'EVET' : 'Hayır'}
  CISA KEV: ${cve.cisaKev ? 'EVET — aktif istismar ediliyor' : 'Hayır'}

TÜRKİYE ETKİSİ:
  Etkilenen domain: ${impact.totalAffected}
  Kritik risk: ${impact.criticalAffected}
  En fazla etkilenen sektör: ${worstSector}
  Etki seviyesi: ${impactLevel}

Görev: Bu CVE için Türkiye özeti yaz.

Bölümler:
1. Tek paragraflık özet (patron anlasın)
2. Teknik açıklama (IT ekibi anlasın)
3. Türkiye'deki durum (sayılarla)
4. Acil yapılacaklar (3-5 madde)
5. Kaynaklar (NVD linki)

Maksimum 400 kelime.
`;

  // 2. LinkedIn Post
  const linkedinPrompt = `
Aynı CVE için LinkedIn paylaşımı yaz.
Maksimum 1200 karakter.

Zorunlu:
- Açılış: emoji + CVSS skoru + ürün adı
- Türkiye'deki etki sayısı
- En kritik 1-2 öneri
- "Etkileniyor musunuz?" CTA
- cyberstep.io linki
- 5 hashtag

Ton: Acil ama panikletme.
Veri var, somut ol.
`;

  // 3. X Thread
  const xPrompt = `
Aynı CVE için X/Twitter thread yaz.
5-7 tweet.

Tweet 1: Breaking duyuru (emoji + sayı)
Tweet 2: CVE teknik detayı
Tweet 3: Türkiye'deki etki
Tweet 4: En fazla etkilenen sektör
Tweet 5: Acil yapılacaklar
Tweet 6: Link + CTA
Tweet 7 (opsiyonel): Ek teknik detay

Her tweet max 280 karakter.
`;

  // 4. Basın Notu (Medyaya)
  const pressPrompt = `
Aynı CVE için 100 kelimelik basın notu yaz.
Gazeteciyi hedefliyor.
Teknik jargon yok.
Türkiye etkisini ön plana çıkar.
CyberStep'in verilerini kaynak göster.
`;

  const [analysis, linkedin, xThread, press] =
    await Promise.all([
      callClaude(analysisPrompt, {
        system: systemPrompt,
        model: 'claude-sonnet-4-6',
        maxTokens: 800,
      }),
      callClaude(linkedinPrompt, {
        system: systemPrompt,
        model: 'claude-haiku-4-5',
        maxTokens: 400,
      }),
      callClaude(xPrompt, {
        system: systemPrompt,
        model: 'claude-haiku-4-5',
        maxTokens: 500,
      }),
      callClaude(pressPrompt, {
        system: systemPrompt,
        model: 'claude-haiku-4-5',
        maxTokens: 200,
      }),
    ]);

  // X thread'i parse et
  const tweets = xThread
    .split('\n\n')
    .filter(t => t.trim())
    .map((content, i) => ({ tweetNo: i + 1, content: content.trim() }));

  const emailSubject = `🚨 ${cve.cveId} — Türkiye'de ${impact.totalAffected} şirket etkileniyor`;

  return {
    analysis,
    linkedinPost: linkedin,
    xThread: tweets,
    pressNote: press,
    emailSubject,
  };
}
```

---

## BÖLÜM 5: BİLDİRİM SİSTEMİ

```typescript
// src/cve/cveNotifier.ts
// Etkilenen şirketlere/lead'lere uyarı gönder

export async function notifyAffectedDomains(
  cveId: string
): Promise<void> {

  const cve = await getCVEById(cveId);
  const matches = await db.select()
    .from(cveDomainMatches)
    .where(
      and(
        eq(cveDomainMatches.cveId, cveId),
        eq(cveDomainMatches.notificationSent, false),
        gte(cveDomainMatches.confidence, 60)
        // %60+ güven skorlu eşleşmeleri bildir
      )
    );

  for (const match of matches) {
    // Mevcut müşteri mi, lead mi?
    const isCustomer = !!match.customerId;
    const contactEmail = isCustomer
      ? await getCustomerEmail(match.customerId)
      : await getLeadEmail(match.leadCandidateId);

    if (!contactEmail) continue;

    const emailHtml = buildCVEAlertEmail({
      cve,
      domain: match.domain,
      product: match.matchedProduct,
      isCustomer,
      patchAvailable: cve.patchAvailable,
      patchUrl: cve.patchUrl,
    });

    await sendEmail({
      to: contactEmail,
      subject: `⚠️ ${match.domain} — ${cveId} güvenlik uyarısı`,
      html: emailHtml,
      from: 'security@cyberstep.io',
    });

    await db.update(cveDomainMatches).set({
      notificationSent: true,
      notificationSentAt: new Date(),
      notificationType: 'email',
    }).where(eq(cveDomainMatches.id, match.id));

    await sleep(200);
  }

  await db.update(cveTracker).set({
    notificationsSent: matches.length,
  }).where(eq(cveTracker.cveId, cveId));
}

function buildCVEAlertEmail(params: CVEAlertParams): string {
  const urgency = params.cve.cisaKev || params.cve.exploitPublic
    ? 'ACİL' : 'ÖNEMLİ';

  return `
    <div style="font-family:Inter,sans-serif;max-width:600px;
                margin:0 auto;background:#060D1A;color:#E8EDF5;
                padding:32px;border-radius:12px">

      <div style="margin-bottom:24px">
        <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span>
        <span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span>
        <span style="color:#7B8FAF;font-size:14px">.io</span>
      </div>

      <div style="background:#FF456011;border:1px solid #FF4560;
                  border-radius:8px;padding:16px;margin-bottom:24px">
        <div style="color:#FF4560;font-weight:bold;font-size:18px">
          ${urgency} — ${params.cve.cveId}
        </div>
        <div style="color:#A8B8D0;font-size:14px;margin-top:4px">
          CVSS ${params.cve.cvssScore} — ${params.cve.title}
        </div>
      </div>

      <p style="color:#A8B8D0;line-height:1.7">
        <strong style="color:#E8EDF5">${params.domain}</strong>
        domain'inizde kullandığınız
        <strong style="color:#00C8FF">${params.product}</strong>
        bu güvenlik açığından etkileniyor.
      </p>

      ${params.patchAvailable ? `
      <div style="background:#00E09611;border:1px solid #00E096;
                  border-radius:8px;padding:16px;margin:24px 0">
        <div style="color:#00E096;font-weight:bold">
          ✅ Yama Mevcut
        </div>
        <div style="color:#A8B8D0;font-size:14px;margin-top:4px">
          En kısa sürede güncelleme yapmanızı öneriyoruz.
        </div>
        ${params.patchUrl ? `
        <a href="${params.patchUrl}"
           style="color:#00C8FF;display:block;margin-top:8px">
          Yama sayfasına git →
        </a>` : ''}
      </div>` : `
      <div style="background:#FFB02011;border:1px solid #FFB020;
                  border-radius:8px;padding:16px;margin:24px 0">
        <div style="color:#FFB020;font-weight:bold">
          ⚠️ Yama Henüz Mevcut Değil
        </div>
        <div style="color:#A8B8D0;font-size:14px;margin-top:4px">
          Geçici önlem alınması önerilir.
          Tam analiz için CyberStep'e başvurun.
        </div>
      </div>`}

      <a href="${process.env.BASE_URL}/cve/${params.cve.cveId}"
         style="display:block;background:#00C8FF;color:#060D1A;
                text-align:center;padding:14px;border-radius:8px;
                text-decoration:none;font-weight:bold;margin-top:24px">
        Tam Analizi Gör →
      </a>

      <p style="font-size:12px;color:#5A6A80;margin-top:24px">
        Bu uyarı CyberStep'in otomatik tehdit izleme
        sistemi tarafından üretilmiştir.
        Şüpheli bir durum varsa security@cyberstep.io
      </p>
    </div>
  `;
}
```

---

## BÖLÜM 6: ANA ORKESTRATİFON FONKSİYONU

```typescript
// src/cve/cveOrchestrator.ts

export async function processCVE(cveEntry: CVEEntry): Promise<void> {

  logger.info(`CVE işleniyor: ${cveEntry.cveId} (CVSS: ${cveEntry.cvssScore})`);

  // 1. CVE'yi kaydet
  await db.insert(cveTracker).values({
    cveId: cveEntry.cveId,
    cvssScore: cveEntry.cvssScore,
    severity: cveEntry.severity,
    title: cveEntry.title,
    description: cveEntry.description,
    affectedProducts: cveEntry.affectedProducts,
    publishedAt: cveEntry.publishedAt,
    patchAvailable: cveEntry.patchAvailable,
    exploitPublic: cveEntry.exploitPublic,
    cisaKev: cveEntry.cisaKev,
    status: 'detected',
  }).onConflictDoNothing();

  // 2. Türkiye etkisini analiz et
  const impact = await analyzeTurkeyImpact(cveEntry);

  // Yeterli etki yok — atla
  const minThreshold = cveEntry.cisaKev ? 5 : 20;
  if (impact.totalAffected < minThreshold) {
    await db.update(cveTracker).set({
      status: 'skipped',
      skipReason: `Türkiye etkisi düşük: ${impact.totalAffected} domain`,
    }).where(eq(cveTracker.cveId, cveEntry.cveId));

    logger.info(`${cveEntry.cveId} atlandı — düşük etki (${impact.totalAffected})`);
    return;
  }

  // 3. İçerik üret
  const content = await generateCVEContent(cveEntry, impact);

  // 4. İçeriği kaydet
  await db.update(cveTracker).set({
    trAnalysis: content.analysis,
    linkedinPost: content.linkedinPost,
    xThread: content.xThread,
    emailSubject: content.emailSubject,
    pressNote: content.pressNote,
    status: 'analyzed',
  }).where(eq(cveTracker.cveId, cveEntry.cveId));

  // 5. Etkilenen şirketlere bildirim
  await notifyAffectedDomains(cveEntry.cveId);

  // 6. Admin'e bildirim
  await sendAdminAlert({
    subject: `🚨 Yeni CVE: ${cveEntry.cveId} — Türkiye'de ${impact.totalAffected} şirket`,
    message: `
CVE: ${cveEntry.cveId}
CVSS: ${cveEntry.cvssScore} — ${cveEntry.severity.toUpperCase()}
Türkiye etkisi: ${impact.totalAffected} domain
CISA KEV: ${cveEntry.cisaKev ? 'EVET' : 'Hayır'}
Exploit kamuya açık: ${cveEntry.exploitPublic ? 'EVET' : 'Hayır'}

LinkedIn post ve X thread hazır.
Onay için: /admin-panel/cve/${cveEntry.cveId}
    `,
  });

  logger.info(`${cveEntry.cveId} işlendi. Etki: ${impact.totalAffected} domain. Admin onayı bekleniyor.`);
}
```

---

## BÖLÜM 7: CRON JOB'LAR

```typescript
// Her 2 saatte bir CVE feed kontrol
cron.schedule('0 */2 * * *', async () => {
  logger.info('CVE feed kontrol ediliyor...');

  const newCVEs = await checkNewCVEs();

  if (newCVEs.length === 0) {
    logger.info('Yeni CVE yok.');
    return;
  }

  logger.info(`${newCVEs.length} yeni CVE bulundu`);

  // CISA KEV olanları önce işle
  const sorted = newCVEs.sort((a, b) => {
    if (a.cisaKev && !b.cisaKev) return -1;
    if (!a.cisaKev && b.cisaKev) return 1;
    return (b.cvssScore || 0) - (a.cvssScore || 0);
  });

  for (const cve of sorted) {
    await processCVE(cve);
    await sleep(5000); // CVE'ler arası bekleme
  }
});
```

---

## BÖLÜM 8: ADMİN PANELİ

```
/admin-panel/cve

─── AKTİF CVE'LER ───────────────────────────────────────────

CVE-2024-12345 🔴 KRİTİK (CVSS 9.8)  [YENİ]
  Apache Log4j — Türkiye: 847 domain etkileniyor
  CISA KEV: EVET | Exploit: EVET | Yama: MEVCUT
  LinkedIn: HAZIR | X Thread: HAZIR
  Bildirim: 234 şirkete gönderildi

  [LinkedIn'de Paylaş]  [X'te Paylaş]
  [İçeriği Düzenle]     [Yayınla]     [Atla]

CVE-2024-12344 🟡 YÜKSEK (CVSS 8.5)  [Analiz ediliyor]
  WordPress Plugin — Türkiye: 124 domain
  Tarama devam ediyor...

─── SON 30 GÜN ──────────────────────────────────────────────
Toplam tespit:     47 CVE
İşlenen:          12 (etki eşiği geçen)
Atlanan:          35 (düşük Türkiye etkisi)
Yayınlanan:       11
Bildirim gönder:  423 şirkete

─── CVE DETAYI ──────────────────────────────────────────────
GET /admin-panel/cve/CVE-2024-12345

Türkçe Analiz:     [düzenlenebilir metin]
LinkedIn Post:     [düzenlenebilir, karakter sayacı]
X Thread:          [düzenlenebilir, 7 tweet]
Etkilenen domainler: [gizli liste, sadece sayı gösterilir]
Basın Notu:        [düzenlenebilir]
```

---

## BÖLÜM 9: PUBLIC CVE SAYFASI

```
cyberstep.io/cve/CVE-2024-12345

[Başlık: CVE-XXXX — Türkiye Özeti]

CVSS 9.8 — KRİTİK
Apache Log4j — Türkiye'de 847 domain etkileniyor

[CVE Özeti — Claude'un Türkçe analizi]

Türkiye'deki Durum:
  Etkilenen domain: 847
  Kritik risk: 234
  En fazla etkilenen: Teknoloji sektörü

Acil Yapılacaklar:
  1. ...
  2. ...
  3. ...

[Şirketiniz etkileniyor mu?]
[Domain girin → Ücretsiz kontrol]

Bu analiz CyberStep.io'nun
otomatik tehdit sistemi tarafından
üretilmiştir. Son güncelleme: XX:XX
```

---

## BÖLÜM 10: API ROTALAR VE ENVIRONMENT

```
POST /api/cve/check-now          — Manuel feed kontrolü
GET  /api/cve/active             — Aktif CVE listesi
GET  /api/cve/:id                — CVE detayı
GET  /api/cve/:id/impact         — Türkiye etki özeti
POST /api/admin/cve/:id/publish  — Onayla ve yayınla
POST /api/admin/cve/:id/skip     — Atla

GET  /cve/:id                    — Public CVE sayfası
```

```bash
# .env eklemeleri
NVD_API_KEY=           # nvd.nist.gov/developers (ücretsiz)
CVE_CHECK_INTERVAL=2   # Saat (kaçta bir kontrol)
CVE_MIN_CVSS=8.0       # Minimum CVSS eşiği
CVE_MIN_TR_DOMAINS=20  # Minimum Türkiye etkisi
```

---

## TEST SENARYOSU

```
1. Manuel CVE ekle:
   POST /api/cve/check-now
   Body: { forceCVE: "CVE-2024-XXXXX" }

2. Beklenen sonuç 2 dakika içinde:
   → cve_tracker kaydı oluştu
   → cve_domain_matches dolu
   → Claude analizi yazıldı
   → LinkedIn + X içeriği hazır
   → Admin'e bildirim gitti
   → Etkilenen şirketlere e-posta gitti

3. Admin panelde:
   → CVE görünüyor
   → İçerik düzenlenebilir
   → "Yayınla" butonu çalışıyor

4. Public sayfada:
   cyberstep.io/cve/CVE-2024-XXXXX
   → Sayfa açılıyor
   → Domain arama çalışıyor
```

---

*CyberStep.io — CVE Anlık Türkiye Etki Sistemi — 2026*
