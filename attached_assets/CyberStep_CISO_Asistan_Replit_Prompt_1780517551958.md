# CyberStep.io — CISO Asistan Paketi Altyapısı
## Replit Agent Promptu — Tam Uygulama

---

## BAĞLAM

CyberStep'e yeni bir servis ekliyoruz:
**CISO Asistan Paketi — 2.500 TL/ay**

5 bileşen:
1. Aylık Yönetim Kurulu Raporu (PDF)
2. Haftalık Kişiselleştirilmiş Tehdit Özeti
3. 7545 + KVKK Uyum Skoru
4. Güvenlik Politikası Kütüphanesi (7 şablon)
5. vCISO Erken Erişim Listesi

Ayrıca web sitesinde vCISO kaldırıldı,
2027 Q2 roadmap'e alındı.
Erken erişim listesi oluşturuldu.

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

Başlamadan önce şu dosyaları kontrol et:

```
src/scanner/ veya src/domain-scan/
→ Domain tarama sonuçlarını nasıl saklıyor?
→ overall_score, criticalCount, sslValid,
  dmarcPolicy gibi alanlar nerede?

src/customers/ veya models/customer
→ Customer tablosu nasıl yapılandırılmış?
→ sector, domain, email alanları var mı?

src/billing/ veya src/subscriptions/
→ Abonelik yönetimi nasıl çalışıyor?
→ Plan adları neler?

utils/ veya lib/
→ Email gönderme fonksiyonu var mı?
→ Claude API çağrısı nasıl yapılıyor?
→ PDF oluşturma mevcut mu?

Mevcut yapıyı anladıktan sonra
aşağıdaki adımlara geç.
```

---

## BÖLÜM 1: VERİTABANI

```sql
-- CISO Asistan paketi aboneleri
CREATE TABLE IF NOT EXISTS ciso_assistant_subscriptions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,
  is_active boolean DEFAULT true,

  -- Şirket profili
  sector varchar(100),
  employee_count integer,
  has_dedicated_ciso boolean DEFAULT false,
  ciso_name varchar(255),
  ciso_email varchar(255),
  board_report_email varchar(255),

  -- Uyum bilgileri (müşteri girer)
  has_incident_response_plan boolean DEFAULT false,
  has_security_policy boolean DEFAULT false,
  has_data_inventory boolean DEFAULT false,
  kvkk_verbis_registered boolean DEFAULT false,

  -- Politika kütüphanesi durumu
  policies_generated_at timestamp,
  policies_count integer DEFAULT 0,

  started_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Aylık yönetim kurulu raporları
CREATE TABLE IF NOT EXISTS board_reports (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  report_month varchar(7) NOT NULL,
  -- Format: '2026-06'

  -- Metrikler
  risk_score integer,
  risk_score_prev_month integer,
  sector_avg_score integer,
  critical_findings integer DEFAULT 0,
  closed_findings integer DEFAULT 0,
  compliance_7545 integer DEFAULT 0,
  compliance_kvkk integer DEFAULT 0,
  financial_risk_low decimal(12,2),
  financial_risk_high decimal(12,2),
  top_recommendations jsonb,
  -- [{priority, action, effort}]

  -- İçerik
  executive_summary text,
  -- Claude Sonnet üretimi
  pdf_path varchar(500),
  pdf_url varchar(500),

  -- Durum
  status varchar(20) DEFAULT 'draft',
  -- 'draft' | 'sent'
  sent_at timestamp,

  generated_at timestamp DEFAULT now(),
  UNIQUE(customer_id, report_month)
);

-- Uyum skoru geçmişi
CREATE TABLE IF NOT EXISTS compliance_scores (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  score_month varchar(7) NOT NULL,

  score_7545 integer DEFAULT 0,
  score_kvkk integer DEFAULT 0,
  checklist_7545 jsonb,
  checklist_kvkk jsonb,

  calculated_at timestamp DEFAULT now(),
  UNIQUE(customer_id, score_month)
);

-- Güvenlik politikaları
CREATE TABLE IF NOT EXISTS security_policies (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  policy_type varchar(100) NOT NULL,
  -- 'information_security' | 'password' |
  -- 'remote_work' | 'byod' |
  -- 'data_classification' |
  -- 'incident_response' | 'vendor_assessment'
  title varchar(255),
  content text,
  version integer DEFAULT 1,
  status varchar(20) DEFAULT 'draft',
  -- 'draft' | 'approved' | 'active'
  approved_at timestamp,
  docx_path varchar(500),
  generated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(customer_id, policy_type)
);

-- vCISO Erken Erişim Listesi
CREATE TABLE IF NOT EXISTS vciso_early_access (
  id serial PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  name varchar(255),
  company varchar(255),
  title varchar(255),
  employee_count varchar(50),
  -- '1-50' | '51-200' | '201-500' | '500+'
  current_ciso boolean DEFAULT false,
  -- CISO'su var mı şu an?
  source varchar(50) DEFAULT 'website',
  -- 'website' | 'linkedin' | 'referral'
  notes text,
  notified_at timestamp,
  -- 2027 Q2'de program açılınca bildirim
  subscribed_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: UYUM SKORU HESAPLAYICI

```typescript
// src/ciso/complianceCalculator.ts
// YENİ DOSYA

export async function calculateComplianceScore(
  customerId: number
): Promise<{ score7545: number; scoreKvkk: number }> {

  const sub = await db.select()
    .from(cisoAssistantSubscriptions)
    .where(eq(cisoAssistantSubscriptions.customerId, customerId))
    .limit(1);

  if (!sub[0]) throw new Error('CISO aboneliği bulunamadı');

  // Mevcut domain tarama sonucunu al
  // Mevcut kod yapına göre bu kısmı uyarla:
  const latestScan = await getLatestDomainScan(customerId);
  // getLatestDomainScan yerine mevcut fonksiyon adını kullan

  // ─── 7545 KANUNU ─────────────────────────────────────
  const items7545 = [
    {
      id: 'security_officer',
      label: 'Siber Güvenlik Sorumlusu atandı',
      weight: 25,
      passed: sub[0].hasDedicatedCiso ||
               sub[0].cisoName !== null,
      note: 'Madde 6: 50+ çalışanlı şirketlerde zorunlu.',
    },
    {
      id: 'annual_audit',
      label: 'Yıllık güvenlik denetimi yapıldı',
      weight: 20,
      passed: latestScan !== null,
      note: 'CyberStep değerlendirmesi denetim belgesi olarak kullanılabilir.',
    },
    {
      id: 'incident_response',
      label: 'Olay müdahale planı mevcut',
      weight: 20,
      passed: sub[0].hasIncidentResponsePlan,
      note: 'Politika kütüphanesinden olay müdahale prosedürünü indirin.',
    },
    {
      id: 'ssl_valid',
      label: 'SSL sertifikası geçerli',
      weight: 15,
      passed: latestScan?.sslValid === true,
      note: null,
    },
    {
      id: 'dmarc_configured',
      label: 'E-posta güvenliği (DMARC) aktif',
      weight: 10,
      passed: latestScan?.dmarcPolicy !== null &&
               latestScan?.dmarcPolicy !== 'none',
      note: null,
    },
    {
      id: 'no_critical_cve',
      label: 'Kritik CVE açığı yok',
      weight: 10,
      passed: (latestScan?.criticalCveCount || 0) === 0,
      note: null,
    },
  ];

  const score7545 = items7545.reduce(
    (sum, item) => sum + (item.passed ? item.weight : 0), 0
  );

  // ─── KVKK ────────────────────────────────────────────
  const itemsKvkk = [
    {
      id: 'verbis',
      label: 'VERBİS kaydı yapıldı',
      weight: 25,
      passed: sub[0].kvkkVerbisRegistered,
      note: 'verbis.kvkk.gov.tr adresinden kayıt yapılmalı.',
    },
    {
      id: 'data_inventory',
      label: 'Kişisel veri envanteri mevcut',
      weight: 20,
      passed: sub[0].hasDataInventory,
      note: 'Politika kütüphanesinden veri sınıflandırma şablonunu kullanın.',
    },
    {
      id: 'no_breach',
      label: 'Bilinen veri sızıntısı yok',
      weight: 25,
      passed: (latestScan?.hibpBreachCount || 0) === 0,
      note: latestScan?.hibpBreachCount > 0
        ? `${latestScan.hibpBreachCount} sızıntı tespit edildi.`
        : null,
    },
    {
      id: 'breach_notification',
      label: '72 saat bildirim kapasitesi var',
      weight: 15,
      passed: true,
      // CyberStep CVE sistemi bu kapasiteyi sağlıyor
      note: 'CyberStep anlık tehdit bildirimi ile karşılanıyor.',
    },
    {
      id: 'technical_measures',
      label: 'Teknik tedbirler yeterli',
      weight: 15,
      passed: (latestScan?.overallScore || 0) >= 60,
      note: null,
    },
  ];

  const scoreKvkk = itemsKvkk.reduce(
    (sum, item) => sum + (item.passed ? item.weight : 0), 0
  );

  // Kaydet
  const month = new Date().toISOString().slice(0, 7);
  await db.insert(complianceScores).values({
    customerId,
    scoreMonth: month,
    score7545,
    scoreKvkk,
    checklist7545: items7545,
    checklistKvkk: itemsKvkk,
  }).onConflictDoUpdate({
    target: [complianceScores.customerId,
             complianceScores.scoreMonth],
    set: { score7545, scoreKvkk,
           checklist7545: items7545,
           checklistKvkk: itemsKvkk }
  });

  return { score7545, scoreKvkk };
}
```

---

## BÖLÜM 3: YÖNETİM KURULU RAPORU

```typescript
// src/ciso/boardReportGenerator.ts
// YENİ DOSYA

export async function generateBoardReport(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);
  const sub = await getCISOSub(customerId);
  const compliance = await calculateComplianceScore(customerId);

  // Mevcut tarama verisi
  const latestScan = await getLatestDomainScan(customerId);
  const prevScan = await getPrevMonthScan(customerId);

  // Sektör ortalaması — diğer müşteri ortalamalarından
  const sectorAvg = await db.select({
    avg: avg(domainScans.overallScore)
  })
  .from(domainScans)
  .innerJoin(customers, eq(domainScans.domain, customers.domain))
  .where(eq(customers.sector, customer.sector || ''))
  .then(r => Math.round(Number(r[0]?.avg || 65)));

  // Finansal risk tahmini
  // IBM 2024 TR veri ihlali ortalama maliyeti baz alındı
  const BASE_COST = 8_500_000; // TL
  const riskMultiplier = Math.max(0,
    (100 - (latestScan?.overallScore || 50)) / 100
  );
  const financialRiskLow  = Math.round(BASE_COST * riskMultiplier * 0.15);
  const financialRiskHigh = Math.round(BASE_COST * riskMultiplier * 0.50);

  // Öncelikli 3 aksiyon
  const recommendations = buildRecommendations(latestScan, compliance);

  // Claude Sonnet ile yönetici özeti
  // (Board raporu için Sonnet — kalite önemli)
  const executiveSummary = await callClaude(`
Şirket: ${customer.companyName}
Sektör: ${customer.sector || 'teknoloji'}
Dönem: ${formatMonth(new Date())}

Güvenlik skoru: ${latestScan?.overallScore || 0}/100
Geçen ay: ${prevScan?.overallScore || 'ilk rapor'}
Sektör ortalaması: ${sectorAvg}/100
Kritik bulgu sayısı: ${latestScan?.criticalCount || 0}
7545 uyum skoru: %${compliance.score7545}
KVKK uyum skoru: %${compliance.scoreKvkk}
Tahmini finansal risk: ${financialRiskLow.toLocaleString('tr-TR')} — ${financialRiskHigh.toLocaleString('tr-TR')} TL

CEO ve yönetim kuruluna sunulacak 3 paragraflık
Türkçe özet yaz:
  Paragraf 1: Genel güvenlik durumu
  Paragraf 2: Bu ayın en önemli riski
  Paragraf 3: Önerilen 3 aksiyon
  
Teknik kelime kullanma. Maksimum 150 kelime.
Abartma. Veri bazlı, gerçekçi.
  `, {
    model: 'claude-sonnet-4-6',
    maxTokens: 350,
    system: 'Türk şirketi için Türkçe siber güvenlik yönetim raporu yaz. Sade, net, iş dili.',
  });

  // PDF oluştur
  // Mevcut PDF altyapısı varsa onu kullan
  // Yoksa yeni oluştur — aşağıdaki içerikle:
  const pdfContent = {
    title: `Siber Güvenlik Durum Raporu`,
    company: customer.companyName,
    period: formatMonth(new Date()),
    riskScore: latestScan?.overallScore || 0,
    riskScorePrev: prevScan?.overallScore,
    sectorAvg,
    criticalFindings: latestScan?.criticalCount || 0,
    closedFindings: await getClosedFindingsThisMonth(customerId),
    compliance7545: compliance.score7545,
    complianceKvkk: compliance.scoreKvkk,
    financialRiskLow,
    financialRiskHigh,
    recommendations,
    executiveSummary,
  };

  const pdfPath = await generatePDF('board-report', pdfContent);
  // generatePDF fonksiyonu mevcut değilse
  // önce şu kütüphaneyi ekle:
  // pnpm add @react-pdf/renderer
  // veya
  // pnpm add puppeteer-core (HTML → PDF)

  // Kaydet
  const month = new Date().toISOString().slice(0, 7);
  await db.insert(boardReports).values({
    customerId,
    reportMonth: month,
    riskScore: latestScan?.overallScore || 0,
    riskScorePrevMonth: prevScan?.overallScore,
    sectorAvgScore: sectorAvg,
    criticalFindings: latestScan?.criticalCount || 0,
    compliance7545: compliance.score7545,
    complianceKvkk: compliance.scoreKvkk,
    financialRiskLow,
    financialRiskHigh,
    topRecommendations: recommendations,
    executiveSummary,
    pdfPath,
    status: 'draft',
  }).onConflictDoUpdate({
    target: [boardReports.customerId, boardReports.reportMonth],
    set: { executiveSummary, pdfPath, generatedAt: new Date() }
  });

  // Board raporu email adresine gönder
  const sendTo = sub.boardReportEmail || customer.email;
  await sendEmail({
    to: sendTo,
    subject: `📊 ${customer.companyName} — ${formatMonth(new Date())} Güvenlik Raporu`,
    html: buildBoardReportEmail(customer, pdfPath, month),
    from: 'ciso@cyberstep.io',
    fromName: 'CyberStep CISO Asistan',
    attachments: [{ filename: `cyberstep-rapor-${month}.pdf`, path: pdfPath }],
  });
}

function buildRecommendations(
  scan: any,
  compliance: { score7545: number; scoreKvkk: number }
): Array<{ priority: number; action: string; effort: string }> {

  const recs = [];

  if (scan?.sslDaysLeft <= 30) recs.push({
    priority: 1,
    action: 'SSL sertifikasını yenileyin',
    effort: '30 dakika',
  });

  if (!scan?.dmarcPolicy || scan.dmarcPolicy === 'none') recs.push({
    priority: 1,
    action: 'DMARC politikasını güçlendirin (reject)',
    effort: '1 saat',
  });

  if (scan?.criticalCveCount > 0) recs.push({
    priority: 1,
    action: `${scan.criticalCveCount} kritik CVE yaması yapın`,
    effort: 'Yazılıma bağlı',
  });

  if (!compliance.score7545 || compliance.score7545 < 70) recs.push({
    priority: 2,
    action: '7545 uyum eksikliklerini tamamlayın',
    effort: 'Politika kütüphanesinden şablonları indirin',
  });

  if (!compliance.scoreKvkk || compliance.scoreKvkk < 70) recs.push({
    priority: 2,
    action: 'KVKK uyum adımlarını tamamlayın',
    effort: 'VERBİS kaydı + veri envanteri',
  });

  return recs.slice(0, 3);
}
```

---

## BÖLÜM 4: POLİTİKA KÜTÜPHANESİ

```typescript
// src/ciso/policyGenerator.ts
// YENİ DOSYA

const POLICIES: Record<string, {
  title: string;
  type: string;
  prompt: string;
}> = {
  information_security: {
    title: 'Bilgi Güvenliği Politikası',
    type: 'information_security',
    prompt: `{COMPANY} ({SECTOR} sektörü, ~{EMPLOYEES} çalışan) için
kapsamlı Bilgi Güvenliği Politikası yaz.
Bölümler: Amaç, Kapsam, Sorumluluklar,
Bilgi Sınıflandırma, Erişim Kontrolü,
Şifre Politikası, Olay Bildirimi,
Uyumsuzluk Sonuçları.
7545 ve KVKK uyumlu. Türkçe, sade, uygulanabilir.`,
  },
  password: {
    title: 'Şifre Yönetimi Politikası',
    type: 'password',
    prompt: `{COMPANY} için Şifre Yönetimi Politikası yaz.
Minimum 12 karakter, karmaşıklık kuralları,
90 günlük değiştirme, MFA zorunluluğu,
şifre paylaşım yasağı, şifre yöneticisi kullanımı.
Türkçe, madde madde.`,
  },
  remote_work: {
    title: 'Uzaktan Çalışma Güvenlik Politikası',
    type: 'remote_work',
    prompt: `{COMPANY} için Uzaktan Çalışma Güvenlik Politikası yaz.
VPN zorunluluğu, güvenli ağ kullanımı,
ekran kilidi, cihaz şifreleme,
rapor ve veri koruma, ev ağı güvenliği.
Türkçe, uygulanabilir.`,
  },
  byod: {
    title: 'Kişisel Cihaz (BYOD) Politikası',
    type: 'byod',
    prompt: `{COMPANY} için BYOD Politikası yaz.
Hangi cihazlar izinli, kayıt zorunluluğu,
MDM gereksinimleri, kurumsal veri silme hakkı,
kayıp/çalıntı durumu, güvenlik gereksinimleri.
Türkçe.`,
  },
  data_classification: {
    title: 'Veri Sınıflandırma Politikası',
    type: 'data_classification',
    prompt: `{COMPANY} için Veri Sınıflandırma Politikası yaz.
KVKK kapsamında kişisel veri kategorileri.
4 gizlilik seviyesi: Halka Açık, İç Kullanım,
Gizli, Çok Gizli — her seviye için işleme kuralları.
VERBİS uyumlu. Türkçe.`,
  },
  incident_response: {
    title: 'Siber Olay Müdahale Prosedürü',
    type: 'incident_response',
    prompt: `{COMPANY} için Siber Olay Müdahale Prosedürü yaz.
7545 kapsamında 72 saat BTK bildirim yükümlülüğü.
P1/P2/P3 olay seviyeleri, eskalasyon zinciri,
ilk müdahale adımları, iletişim planı,
olay kapatma ve post-mortem.
Türkçe, adım adım.`,
  },
  vendor_assessment: {
    title: 'Tedarikçi Güvenlik Değerlendirme Formu',
    type: 'vendor_assessment',
    prompt: `{COMPANY} için tedarikçi güvenlik değerlendirme formu yaz.
KVKK madde 12 ve BDDK 3. taraf risk yönetimi uyumlu.
20-25 soru: Evet/Hayır + kanıt belgesi alanı.
Konular: veri işleme, şifreleme, erişim kontrolü,
olay bildirimi, denetim hakkı, alt işlemciler.
Türkçe, tablo formatı.`,
  },
};

export async function generatePolicyLibrary(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);
  const sub = await getCISOSub(customerId);

  const companyVars = {
    COMPANY: customer.companyName,
    SECTOR: customer.sector || 'teknoloji',
    EMPLOYEES: sub.employeeCount?.toString() || '50-200',
  };

  let generated = 0;

  for (const [key, policy] of Object.entries(POLICIES)) {
    // Zaten oluşturulmuş mu?
    const existing = await db.select()
      .from(securityPolicies)
      .where(
        and(
          eq(securityPolicies.customerId, customerId),
          eq(securityPolicies.policyType, key)
        )
      ).limit(1);

    if (existing[0]) continue;

    // Prompt'taki değişkenleri doldur
    const prompt = policy.prompt
      .replace(/{COMPANY}/g, companyVars.COMPANY)
      .replace(/{SECTOR}/g, companyVars.SECTOR)
      .replace(/{EMPLOYEES}/g, companyVars.EMPLOYEES);

    const content = await callClaude(prompt, {
      model: 'claude-haiku-4-5',
      maxTokens: 1000,
      system: `Türkiye şirketi için Türkçe güvenlik politikası yaz.
Profesyonel, uygulanabilir.
7545 Kanunu ve KVKK uyumlu.
Madde madde, net başlıklar.`,
    });

    // DOCX oluştur (mevcut DOCX altyapısı varsa kullan)
    // Yoksa metin olarak kaydet, portal'dan kopyalanabilir
    const docxPath = await generateDocx(
      policy.title, content, customer.companyName
    ).catch(() => null);
    // generateDocx başarısız olursa null — metin yine kaydedilir

    await db.insert(securityPolicies).values({
      customerId,
      policyType: key,
      title: policy.title,
      content,
      docxPath,
      status: 'draft',
    });

    generated++;
    await sleep(800); // Claude rate limit
  }

  await db.update(cisoAssistantSubscriptions).set({
    policiesGeneratedAt: new Date(),
    policiesCount: generated,
    updatedAt: new Date(),
  }).where(eq(cisoAssistantSubscriptions.customerId, customerId));
}
```

---

## BÖLÜM 5: HAFTALIK TEHDİT ÖZETİ KİŞİSELLEŞTİRME

```typescript
// src/ciso/weeklyThreatPersonalizer.ts
// YENİ DOSYA
// Mevcut haftalık bülten altyapısına kişiselleştirme katmanı

export async function sendPersonalizedWeeklyThreat(
  customerId: number,
  baseBulletin: WeeklyBulletin
  // Mevcut bülten sistemi bu nesneyi üretiyorsa direkt al
  // Üretmiyorsa getLatestBulletin() ile çek
): Promise<void> {

  const customer = await getCustomer(customerId);
  const latestScan = await getLatestDomainScan(customerId);

  // Müşteriyi etkileyen CVE var mı bu hafta?
  const customerCVEs = await db.select()
    .from(cveDomainMatches)
    .innerJoin(cveTracker,
      eq(cveDomainMatches.cveId, cveTracker.cveId))
    .where(
      and(
        eq(cveDomainMatches.domain, customer.domain),
        gte(cveTracker.detectedAt, subDays(new Date(), 7)),
        gte(cveTracker.cvssScore, 7.0)
      )
    );

  // Kişiselleştirilmiş giriş cümlesi
  const personalizedIntro = customerCVEs.length > 0
    ? await callClaude(`
${customer.companyName} için 2 cümlelik haftalık tehdit özeti girişi yaz.
Bu hafta ${customer.domain} domainini etkileyen ${customerCVEs.length} CVE tespit edildi.
En önemli CVE: ${customerCVEs[0]?.cveId} (CVSS ${customerCVEs[0]?.cvssScore}).
Kısa, acil ama panikletme.
      `, { model: 'claude-haiku-4-5', maxTokens: 80 })
    : null;

  // Email gönder
  await sendEmail({
    to: customer.email,
    subject: customerCVEs.length > 0
      ? `⚠️ ${customer.companyName} — Bu hafta ${customerCVEs.length} CVE`
      : `🔐 Haftalık Tehdit Özeti — ${formatWeek(new Date())}`,
    html: buildPersonalizedBulletinEmail(
      customer,
      baseBulletin,
      personalizedIntro,
      customerCVEs
    ),
    from: 'ciso@cyberstep.io',
    fromName: 'CyberStep CISO Asistan',
  });
}
```

---

## BÖLÜM 6: vCISO ERKEN ERİŞİM LİSTESİ

```typescript
// POST /api/public/vciso-early-access
// Kayıt formu — web sitesindeki "Erken Erişim" butonu

router.post('/vciso-early-access', async (req, res) => {
  const {
    email, name, company, title,
    employeeCount, currentCiso,
  } = req.body;

  if (!email || !company) {
    return res.status(400).json({ error: 'Email ve şirket zorunlu' });
  }

  try {
    await db.insert(vcisoEarlyAccess).values({
      email,
      name,
      company,
      title,
      employeeCount,
      currentCiso: currentCiso === true,
    }).onConflictDoNothing();

    // Teşekkür emaili
    await sendEmail({
      to: email,
      subject: 'vCISO Erken Erişim Listesine Eklendiniz',
      html: `
        <p>Merhaba${name ? ` ${name.split(' ')[0]}` : ''},</p>
        <p>${company} için vCISO programı erken erişim
        listemize eklendiniz.</p>
        <p>2027 Q2'de program başladığında ilk
        haberdar edenler arasında olacaksınız.</p>
        <p>Bu süreçte CISO Asistan Paketimiz
        (2.500 TL/ay) ihtiyaçlarınızı karşılayabilir.</p>
        <a href="${process.env.BASE_URL}/fiyatlar">
          CISO Asistan Paketini İncele →
        </a>
        <br><br>
        <small>CyberStep.io</small>
      `,
      from: 'ciso@cyberstep.io',
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Kayıt başarısız' });
  }
});

// GET /api/admin/vciso-early-access
// Admin listesi
router.get('/admin/vciso-early-access', requireAdmin, async (req, res) => {
  const list = await db.select()
    .from(vcisoEarlyAccess)
    .orderBy(desc(vcisoEarlyAccess.subscribedAt));

  res.json({
    total: list.length,
    withCISO: list.filter(r => r.currentCiso).length,
    withoutCISO: list.filter(r => !r.currentCiso).length,
    list,
  });
});
```

---

## BÖLÜM 7: ONBOARDİNG VE CRON JOB'LAR

```typescript
// CISO paketi başladığında (ödeme webhook'undan çağır)
export async function onCISOPackageStart(
  customerId: number
): Promise<void> {

  // CISO abonelik kaydı oluştur
  await db.insert(cisoAssistantSubscriptions).values({
    customerId,
  }).onConflictDoNothing();

  // 1. Hemen uyum skoru hesapla
  await calculateComplianceScore(customerId);

  // 2. Politika kütüphanesini oluştur
  await generatePolicyLibrary(customerId);

  // 3. İlk board raporunu üret
  await generateBoardReport(customerId);

  // 4. Hoş geldin emaili
  await sendEmail({
    to: await getCustomerEmail(customerId),
    subject: '🎉 CISO Asistan Paketiniz hazır',
    html: buildCISOWelcomeEmail(customerId),
    from: 'ciso@cyberstep.io',
    fromName: 'CyberStep CISO Asistan',
  });
}

// Her ayın 25'i 09:00 — tüm CISO müşterilerine board raporu
cron.schedule('0 9 25 * *', async () => {
  const subs = await db.select()
    .from(cisoAssistantSubscriptions)
    .where(eq(cisoAssistantSubscriptions.isActive, true));

  logger.info(`Board raporu üretiliyor: ${subs.length} müşteri`);

  for (const sub of subs) {
    try {
      await generateBoardReport(sub.customerId);
      await sleep(5000);
    } catch (e) {
      logger.error(`Board raporu hatası: ${sub.customerId}`, e.message);
    }
  }
});

// Her Cuma 09:00 — kişiselleştirilmiş haftalık tehdit özeti
cron.schedule('0 9 * * 5', async () => {
  const latestBulletin = await getLatestWeeklyBulletin();
  if (!latestBulletin) {
    logger.warn('Haftalık bülten bulunamadı, CISO özeti atlandı');
    return;
  }

  const subs = await db.select()
    .from(cisoAssistantSubscriptions)
    .where(eq(cisoAssistantSubscriptions.isActive, true));

  for (const sub of subs) {
    try {
      await sendPersonalizedWeeklyThreat(
        sub.customerId,
        latestBulletin
      );
      await sleep(2000);
    } catch (e) {
      logger.error(`Haftalık özet hatası: ${sub.customerId}`, e.message);
    }
  }
});

// Her ayın 1'i — uyum skorlarını güncelle
cron.schedule('0 8 1 * *', async () => {
  const subs = await db.select()
    .from(cisoAssistantSubscriptions)
    .where(eq(cisoAssistantSubscriptions.isActive, true));

  for (const sub of subs) {
    await calculateComplianceScore(sub.customerId);
    await sleep(1000);
  }
});
```

---

## BÖLÜM 8: PORTAL SAYFASI

```
Route: /portal/ciso-assistant
Sadece CISO paketi abonelerine göster.

─── UYUM DURUMU ─────────────────────────────────────────────
7545 Kanunu    [████████░░]  %78
KVKK           [████████░░]  %82

Eksik maddeler (kırmızı):
  ⚠️ Olay müdahale planı onaylanmadı
     [Politikayı İndir ve Onayla →]
  ⚠️ VERBİS kaydı teyit edilmedi
     [Teyit Ettim →]  ← checkbox

─── UYUM BİLGİLERİMİ GÜNCELLE ──────────────────────────────
□ CISO atandı / Güvenlik sorumlusu belirlendi
□ Olay müdahale planı onaylandı
□ Kişisel veri envanteri oluşturuldu
□ VERBİS kaydı yapıldı
CISO/Sorumlu Adı: [_______________]
Board Raporu Email: [_______________]
[Kaydet]

─── AYLIM RAPORLARI ─────────────────────────────────────────
Haziran 2026   [PDF İndir ↓]  [Email ile Gönder →]
Mayıs 2026     [PDF İndir ↓]
Nisan 2026     [PDF İndir ↓]

─── GÜVENLİK POLİTİKALARI ──────────────────────────────────
7 şablon hazır. İndirin, düzenleyin, onaylayın.

Bilgi Güvenliği Politikası      [DOCX ↓] [Onayla ✓]
Şifre Yönetimi Politikası       [DOCX ↓] [Onayla ✓]
Uzaktan Çalışma Politikası      [DOCX ↓] [Onayla ✓]
Kişisel Cihaz (BYOD) Politikası [DOCX ↓] [Onayla ✓]
Veri Sınıflandırma Politikası   [DOCX ↓] [Onayla ✓]
Olay Müdahale Prosedürü         [DOCX ↓] [Onayla ✓]
Tedarikçi Değerlendirme Formu   [DOCX ↓] [Onayla ✓]

[Tümünü ZIP İndir ↓]
```

---

## BÖLÜM 9: API ROTALAR

```
─── PORTAL ──────────────────────────────────────────────────
GET  /api/portal/ciso/compliance
     → Uyum skoru + checklist

PUT  /api/portal/ciso/profile
     → Uyum bilgilerini güncelle
     Body: { hasDedicatedCiso, cisoName,
             boardReportEmail, hasIncidentResponsePlan,
             hasDataInventory, kvkkVerbisRegistered }

GET  /api/portal/ciso/board-reports
     → Rapor listesi

GET  /api/portal/ciso/board-reports/:month/pdf
     → PDF indir

POST /api/portal/ciso/board-reports/:month/send
     → Board email adresine gönder

GET  /api/portal/ciso/policies
     → Politika listesi

GET  /api/portal/ciso/policies/:type/docx
     → DOCX indir

POST /api/portal/ciso/policies/:type/approve
     → Politikayı onayla

─── PUBLIC ──────────────────────────────────────────────────
POST /api/public/vciso-early-access
     → vCISO erken erişim listesi kaydı

─── ADMIN ───────────────────────────────────────────────────
GET  /api/admin/ciso/subscriptions
     → Tüm CISO paketi aboneleri

POST /api/admin/ciso/generate-report/:customerId
     → Manuel board raporu tetikle

POST /api/admin/ciso/generate-policies/:customerId
     → Manuel politika üretimi

GET  /api/admin/vciso-early-access
     → Erken erişim listesi
```

---

## BÖLÜM 10: TEST SENARYOSU

```
1. Onboarding testi:
   onCISOPackageStart(testCustomerId)
   
   Beklenen (5 dakika içinde):
   → ciso_assistant_subscriptions kaydı oluştu
   → compliance_scores hesaplandı (7545 + KVKK)
   → security_policies tablosunda 7 kayıt
   → board_reports tablosunda bu ay kaydı
   → Welcome email gönderildi

2. Uyum skoru testi:
   calculateComplianceScore(testCustomerId)
   → score_7545: 0-100 arası mı?
   → score_kvkk: 0-100 arası mı?
   → checklist'te 6 madde var mı?

3. Board raporu testi:
   generateBoardReport(testCustomerId)
   → executive_summary dolu mu?
   → PDF oluştu mu?
   → Email gönderildi mi?
   → board_report_email adresine gitti mi?

4. Politika testi:
   /portal/ciso-assistant
   → 7 politika listede görünüyor mu?
   → DOCX indirme çalışıyor mu?
   → "Onayla" butonu çalışıyor mu?

5. Erken erişim testi:
   POST /api/public/vciso-early-access
   Body: { email: "test@test.com", company: "Test" }
   → vciso_early_access tablosuna kayıt düştü mü?
   → Teşekkür emaili gönderildi mi?

6. Portal profil güncelleme:
   PUT /api/portal/ciso/profile
   Body: { kvkkVerbisRegistered: true }
   → DB güncellendi mi?
   → Uyum skoru değişti mi?
```

---

*CyberStep.io — CISO Asistan Paketi Altyapısı — Haziran 2026*
*AI üretir, insan onaylar, yönetim kurulu okur.*
