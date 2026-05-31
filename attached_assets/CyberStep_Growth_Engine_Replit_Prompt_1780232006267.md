# CyberStep.io — Büyüme Motoru (Growth Engine)
## Az Maliyet / Çok Fırsat Sıralaması + Replit Agent Promptu

---

## ÖNCELİK MATRİSİ

```
                    DÜŞÜK MALİYET    ORTA MALİYET    YÜKSEK MALİYET
                   ┌─────────────────────────────────────────────────┐
YÜKSEK FIRSAT      │ TİER 1 ★★★★★   TİER 2 ★★★★    TİER 3 ★★★    │
                   │ (hemen yap)     (bu ay)         (sonra)        │
ORTA FIRSAT        │ TİER 2 ★★★★    TİER 3 ★★★     TİER 4 ★★     │
DÜŞÜK FIRSAT       │ TİER 3 ★★★     TİER 4 ★★      Yapma          │
                   └─────────────────────────────────────────────────┘
```

### TİER 1 — Sıfır API Maliyeti + En Yüksek Intent Sinyali (Hemen Yap)

| # | Özellik | Maliyet | Intent | Neden Güçlü |
|---|---|---|---|---|
| 1 | SSL Sertifikası Dolmak Üzere | Ücretsiz (crt.sh) | ★★★★★ | Müşteri zaten aksiyon alıyor |
| 2 | Yeni CVE — Sen Etkileniyorsun | Ücretsiz (NVD API) | ★★★★★ | Kişiselleştirilmiş, anlık |
| 3 | Sektörde Saldırı Haberi | Ücretsiz (haber toplayıcı) | ★★★★★ | FOMO en güçlü motivatör |
| 4 | KVK Ceza Kararı Yayınlandı | Ücretsiz (web scrape) | ★★★★★ | Yasal zorunluluk = anlık bütçe |
| 5 | Skor Düştü — Upsell | Ücretsiz (mevcut veri) | ★★★★★ | Mevcut müşteri, sıfır CAC |
| 6 | "Rakibiniz Nerede?" Aracı | Ücretsiz | ★★★★★ | Viral, her kullanım lead |

### TİER 2 — Düşük Maliyet + Yüksek Hacim (Bu Ay)

| # | Özellik | Maliyet | Intent | Neden Güçlü |
|---|---|---|---|---|
| 7 | Tedarikçi Zincirine Yayılma | Ücretsiz (mevcut müşteri) | ★★★★ | Sıcak referral hissi |
| 8 | Port Değişiklik Delta Tespiti | Ücretsiz (mevcut tarama) | ★★★★ | Kişiselleştirilmiş, gerçek zamanlı |
| 9 | Şube/Bağlı Domain Taraması | Ücretsiz (mevcut tarama) | ★★★★ | Mevcut müşteriye cross-sell |
| 10 | Benchmark Lead Mıknatısı | Ücretsiz (mevcut veri) | ★★★★ | Inbound, yüksek kalite lead |
| 11 | Breach Monitoring Genişletme | Ücretsiz (GitHub/Paste) | ★★★★ | Düşük bulunma, yüksek etki |
| 12 | Sektörel Bülten Aboneliği | Ücretsiz | ★★★ | Hacimli lead üretimi |

### TİER 3 — Orta Maliyet + Yüksek Değer (Sonraki Sprint)

| # | Özellik | Maliyet | Intent | Neden Güçlü |
|---|---|---|---|---|
| 13 | EKAP İhale Takibi | Ücretsiz (open API) | ★★★★★ | Kamu verisiyle çalışan = KVKK zorunlu |
| 14 | Yeni Kurulan Şirket (MERSİS) | Ücretsiz | ★★★★ | Altyapı kurma aşaması |
| 15 | Muhasebeci Partner Ağı | Düşük (outreach) | ★★★★ | 1 aktivasyon = 100+ müşteri |
| 16 | KVKK Danışman Partner Ağı | Düşük (outreach) | ★★★★ | Zaten ödeme yapan kitle |

### TİER 4 — Yatırım Gerektiren (Büyüyünce)

| # | Özellik | Maliyet | Intent | Not |
|---|---|---|---|---|
| 17 | IT/Güvenlik Pozisyonu Takibi | Apollo credits | ★★★ | 500+ çalışan için anlamlı |
| 18 | Yatırım Haberi Tetikleyici | Orta | ★★★ | Startup odaklı |
| 19 | E-Ticaret Yeni Açılış | Yüksek | ★★ | Hacim var ama değer düşük |
| 20 | Sigorta Aracıları | Orta | ★★★ | Partner kanalı hazır olunca |

---

## REPLIT AGENT PROMPTU — KOPYALA YAPIŞTIR

Build the CyberStep "Growth Engine" — a proactive sales automation system.
Implement all features in priority order (Tier 1 first, then Tier 2, etc.)

Existing infrastructure to leverage:
- Domain scan engine (already built)
- News aggregator / haber toplayıcı (already built)
- ISR CRM with lead_scan_queue, isr_customers, isr_deals (already built)
- Claude API integration (already built)
- Email/SMTP (already built)
- cron scheduler (already built)

---

## DATABASE — YENİ TABLOLAR

```sql
-- Growth engine trigger log — her tetikleyici olayı kaydet
CREATE TABLE IF NOT EXISTS growth_triggers (
  id serial PRIMARY KEY,
  trigger_type varchar(50) NOT NULL,
  -- 'ssl_expiry' | 'new_cve' | 'sector_breach' | 'kvk_penalty' |
  -- 'score_drop' | 'competitor_check' | 'supplier_chain' |
  -- 'port_change' | 'subsidiary_scan' | 'breach_paste' |
  -- 'ekap_tender' | 'new_company' | 'benchmark_download'

  domain varchar(255),
  company_name varchar(255),
  customer_id integer REFERENCES isr_customers(id),
  -- null = prospect, dolu = mevcut müşteri

  -- Tetikleyici verisi
  trigger_data jsonb,
  -- SSL: {expiry_date, days_remaining}
  -- CVE: {cve_id, cvss, affected_tech, epss_score}
  -- Sektör saldırısı: {news_title, news_url, sector}
  -- KVK: {decision_number, penalty_tl, sector}
  -- Skor düşüşü: {old_score, new_score, diff}

  -- Email durumu
  email_sent_at timestamp,
  email_opened_at timestamp,
  email_clicked_at timestamp,
  reply_received_at timestamp,

  -- ISR bağlantısı
  lead_created boolean DEFAULT false,
  isr_deal_id integer REFERENCES isr_deals(id),

  -- Önleme (aynı tetikleyici tekrar gitmesin)
  suppress_until timestamp,
  -- Bu domain için bu trigger türü tekrar gitmesin

  status varchar(20) DEFAULT 'pending',
  -- pending | sent | converted | suppressed | failed

  created_at timestamp DEFAULT now()
);

-- Rakip karşılaştırma aracı kullanımları
CREATE TABLE IF NOT EXISTS competitor_checks (
  id serial PRIMARY KEY,
  own_domain varchar(255) NOT NULL,
  competitor_domain varchar(255) NOT NULL,
  own_score integer,
  competitor_score integer,
  visitor_email varchar(255),
  visitor_company varchar(255),
  ip_address varchar(50),
  lead_created boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Benchmark raporu indirmeleri (lead mıknatısı)
CREATE TABLE IF NOT EXISTS benchmark_downloads (
  id serial PRIMARY KEY,
  sector varchar(100) NOT NULL,
  report_period varchar(20),
  -- 'Q1-2026' | 'Q2-2026'
  visitor_name varchar(255),
  visitor_email varchar(255) NOT NULL,
  visitor_company varchar(255),
  visitor_domain varchar(255),
  lead_created boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Sektörel bülten aboneleri
CREATE TABLE IF NOT EXISTS sector_newsletter_subscribers (
  id serial PRIMARY KEY,
  email varchar(255) NOT NULL,
  company_name varchar(255),
  domain varchar(255),
  sectors text[],
  -- ['finans', 'saglik', 'e-ticaret']
  subscribed_at timestamp DEFAULT now(),
  last_sent_at timestamp,
  lead_created boolean DEFAULT false,
  unsubscribed_at timestamp
);

-- EKAP ihale takibi
CREATE TABLE IF NOT EXISTS ekap_tenders (
  id serial PRIMARY KEY,
  tender_number varchar(100) UNIQUE,
  contracting_authority varchar(500),
  -- İhaleyi açan kurum
  winner_company varchar(500),
  winner_domain varchar(255),
  tender_subject text,
  tender_amount_tl decimal(15,2),
  award_date date,
  categories text[],
  -- 'IT' | 'yazilim' | 'bulut' | 'danismanlik'
  lead_created boolean DEFAULT false,
  processed_at timestamp DEFAULT now()
);

-- MERSİS yeni şirket takibi
CREATE TABLE IF NOT EXISTS new_companies_registry (
  id serial PRIMARY KEY,
  mersis_number varchar(50) UNIQUE,
  company_name varchar(500) NOT NULL,
  city varchar(100),
  sector varchar(100),
  establishment_date date,
  domain varchar(255),
  -- web sitesi tespit edildiyse
  lead_created boolean DEFAULT false,
  discovered_at timestamp DEFAULT now()
);
```

---

## TİER 1: SSL SERTİFİKASI BİTİŞ TETİKLEYİCİSİ

```typescript
// src/growth/triggers/sslExpiry.ts

// Her gece 01:00 — ISR'daki tüm domain'lerin SSL tarihini kontrol et
cron.schedule('0 1 * * *', async () => {

  // Hem mevcut müşterileri hem prospect'leri tara
  const domains = await getAllTrackedDomains();

  for (const item of domains) {
    try {
      const ssl = await checkSSLExpiry(item.domain);
      // crt.sh veya doğrudan TLS handshake ile

      const daysLeft = Math.floor(
        (new Date(ssl.expiryDate).getTime() - Date.now())
        / (1000 * 60 * 60 * 24)
      );

      // 30, 14, 7 günde tetikle (her eşik için bir kez)
      const thresholds = [30, 14, 7];
      for (const days of thresholds) {
        if (daysLeft === days) {
          await fireTrigger({
            type: 'ssl_expiry',
            domain: item.domain,
            customerId: item.customerId || null,
            data: { expiryDate: ssl.expiryDate, daysRemaining: days }
          });
        }
      }
    } catch (e) { continue; }
  }
});

async function checkSSLExpiry(domain: string): Promise<SSLInfo> {
  // Option 1: Qualys SSL Labs API (already integrated)
  // Option 2: Direct TLS check with tls.connect()
  const tls = require('tls');
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, domain, { servername: domain }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      resolve({ expiryDate: cert.valid_to, issuer: cert.issuer.O });
    });
    socket.on('error', reject);
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('timeout')); });
  });
}
```

**E-posta:**
```
Konu: [domain] SSL sertifikanız [N] gün içinde sona eriyor

CyberStep rutin takibimizde [domain] alan adınızın
SSL sertifikasının [tarih] tarihinde sona ereceğini tespit ettik.

Sertifika sona erdiğinde:
  ✗ Web siteniz "Güvenli Değil" uyarısı gösterir
  ✗ Ziyaretçiler sayfanızı terk eder
  ✗ Google sıralamanız düşer
  ✗ KVKK Madde 12 teknik tedbir yükümlülüğü ihlali

Bu vesileyle [domain] üzerindeki tam güvenlik taramasını
da paylaşmak istedik — [N] dikkat gerektiren bulgu mevcut.

[Güvenlik Raporunu Görüntüle →]
```

---

## TİER 1: YENİ CVE — SEN ETKİLENİYORSUN

```typescript
// src/growth/triggers/cveAlert.ts

// Her gece 02:00 — yeni CVE'leri kontrol et
cron.schedule('0 2 * * *', async () => {

  // Son 24 saatte yayınlanan CVE'ler
  const newCVEs = await fetchNewCVEs();
  // NVD API: https://services.nvd.nist.gov/rest/json/cves/2.0
  // &pubStartDate=yesterday&pubEndDate=today

  // EPSS skoru 0.5+ olanları filtrele (yüksek istismar olasılığı)
  const highRiskCVEs = newCVEs.filter(cve => cve.epssScore > 0.5);

  for (const cve of highRiskCVEs) {
    // Bu CVE hangi teknolojileri etkiliyor?
    const affectedTechs = extractAffectedTechs(cve);
    // ör: ['Apache', 'WordPress', 'PHP 8.1']

    // CRM'de bu teknolojiyi kullanan domain'leri bul
    // (httpx taramasından teknoloji stack'i biliniyor)
    const affectedDomains = await findDomainsWithTech(affectedTechs);

    for (const item of affectedDomains) {
      // Daha önce bu CVE için bu domain'e gidildi mi?
      const alreadySent = await checkTriggerSent('new_cve', item.domain, cve.id);
      if (alreadySent) continue;

      await fireTrigger({
        type: 'new_cve',
        domain: item.domain,
        customerId: item.customerId,
        data: { cveId: cve.id, cvss: cve.cvssScore, epss: cve.epssScore,
                affectedTech: affectedTechs[0], cveDescription: cve.description }
      });
    }
  }
});
```

**E-posta:**
```
Konu: [domain] — [CVE-ID] güvenlik açığı sisteminizi etkileyebilir

Bugün yayınlanan [CVE-ID] açığı, [domain] adresinizde
tespit ettiğimiz [teknoloji] bileşenini etkiliyor.

Açık Bilgisi:
  CVE: [CVE-ID]
  CVSS Skoru: [score]/10 — [severity]
  İstismar Olasılığı: %[epss*100] (önümüzdeki 30 gün)
  Etkilenen: [teknoloji versiyonu]

Bu açığın sisteminizi etkileyip etkilemediğini
doğrulamak için ücretsiz kontrol sunuyoruz.

[Ücretsiz CVE Kontrolü İste →]
```

---

## TİER 1: SEKTÖRDE SALDIRI FOMO TETİKLEYİCİSİ

```typescript
// src/growth/triggers/sectorBreach.ts
// Haber toplayıcı bir saldırı haberi işlediğinde tetiklenir

export async function onBreachNewsDetected(
  newsItem: NewsItem,
  affectedSector: string
): Promise<void> {

  // O sektördeki prospect ve müşterileri bul
  const targets = await getTargetsBySector(affectedSector);

  // Max 50 kişiye gönder (spam görünmesin)
  const sample = targets
    .sort((a, b) => b.leadScore - a.leadScore) // En iyi leadler önce
    .slice(0, 50);

  for (const target of sample) {
    // Son 30 günde bu türde tetikleyici gönderildiyse atla
    const recentlySent = await checkRecentTrigger(
      'sector_breach', target.domain, 30
    );
    if (recentlySent) continue;

    await fireTrigger({
      type: 'sector_breach',
      domain: target.domain,
      customerId: target.customerId,
      data: {
        newsTitle: newsItem.title,
        newsUrl: newsItem.url,
        sector: affectedSector,
        attackType: newsItem.detectedAttackType || 'siber saldırı'
      }
    });
  }
}
```

**Claude ile kişiselleştirilmiş e-posta üretimi:**
```typescript
async function generateBreachEmail(trigger: GrowthTrigger): Promise<string> {
  const prompt = `
${trigger.data.sector} sektöründe bir firma saldırıya uğradı.
Aynı sektördeki bir şirkete kısa, ikna edici outreach e-postası yaz.

Haber: ${trigger.data.newsTitle}
Hedef domain: ${trigger.domain}
Hedef sektör: ${trigger.data.sector}

Kurallar:
- 4-5 cümle, daha uzun değil
- FOMO yarat ama panik yaratma
- CyberStep'i doğal bağla
- Türkçe, patron dili
- Konuyu da yaz (konu satırı ayrı)

Format: { "subject": "...", "body": "..." }
`;
  return callClaude(prompt);
}
```

---

## TİER 1: KVK CEZA KARARI TETİKLEYİCİSİ

```typescript
// src/growth/triggers/kvkPenalty.ts

// Her Pazartesi 08:00 — KVK Kurul kararlarını kontrol et
cron.schedule('0 8 * * 1', async () => {

  // kvkk.gov.tr/TR/Icerik/Kurul-Kararlari sayfasını scrape et
  const newDecisions = await scrapeKVKDecisions();

  for (const decision of newDecisions) {
    const sector = detectSectorFromDecision(decision.subject);
    if (!sector) continue;

    // O sektördeki tüm ISR lead'lerine gönder
    const targets = await getTargetsBySector(sector);

    for (const target of targets.slice(0, 30)) {
      await fireTrigger({
        type: 'kvk_penalty',
        domain: target.domain,
        customerId: target.customerId,
        data: {
          decisionNumber: decision.number,
          penaltyTL: decision.penaltyAmount,
          sector: sector,
          violation: decision.violationType
        }
      });
    }
  }
});
```

**E-posta:**
```
Konu: [Sektör] sektörüne [X] TL KVKK cezası — Siz hazır mısınız?

KVK Kurulu bu hafta [sektör] alanında faaliyet gösteren
bir firmaya [X] TL idari para cezası verdi.

İhlal gerekçesi: [ihlal türü]

CyberStep'in [domain] üzerindeki taramasında
KVKK teknik tedbir uyumunuzla ilgili
[N] eksiklik tespit edildi.

Ücretsiz KVKK Risk Skoru: [link]
```

---

## TİER 1: SKOR DÜŞÜŞÜ UPSELL TETİKLEYİCİSİ

```typescript
// src/growth/triggers/scoreDrop.ts
// Sağlık skoru hesaplandıktan sonra çalışır

export async function checkScoreDrop(
  customerId: number,
  newScore: number,
  oldScore: number
): Promise<void> {

  const diff = oldScore - newScore;
  if (diff < 5) return; // 5 puandan az düşüş — tetikleme

  const customer = await getCustomer(customerId);

  // Plan bazlı mesaj
  if (customer.plan === 'baslangic') {
    // Upsell: Büyüme planına geç
    await fireTrigger({
      type: 'score_drop',
      domain: customer.domain,
      customerId,
      data: { oldScore, newScore, diff, suggestedUpgrade: 'buyume' }
    });
  } else if (customer.plan === 'buyume') {
    // Upsell: Kurumsal veya Sanal CISO
    await fireTrigger({
      type: 'score_drop',
      domain: customer.domain,
      customerId,
      data: { oldScore, newScore, diff, suggestedUpgrade: 'kurumsal' }
    });
  }
}
```

**E-posta:**
```
Konu: [domain] güvenlik skorunuz [N] puan geriledi

[domain] alanındaki son tarama sonuçlarına göre
güvenlik skorunuz [oldScore]'dan [newScore]'a geriledi.

Değişime neden olan bulgular:
  ● [bulgu 1]
  ● [bulgu 2]

Mevcut [plan] planınızda bu bulguların otomatik
takibi ve kapatma rehberliği yer almıyor.

[Plan Adı] ile bu bulgular otomatik izlenir
ve her hafta size raporlanır.

[Planımı Yükselt →]
```

---

## TİER 1: "RAKİBİNİZ NEREDE?" ARACI

```typescript
// src/pages/CompetitorCheckPage.tsx
// Public sayfa — auth yok

// URL: /rakip-karsilastirma

// Form: İki alan
// Alan 1: Kendi domain'iniz
// Alan 2: Rakibinizin domain'i
// Buton: Karşılaştır

// Sonuç:
// ┌──────────────────┬──────────────────┐
// │ Siz              │ Rakibiniz        │
// │ acme.com.tr      │ beta.com.tr      │
// │ Skor: 54/100 🟡  │ Skor: 71/100 🟢 │
// │ Risk: ORTA       │ Risk: DÜŞÜK      │
// │ Kritik: 3        │ Kritik: 0        │
// └──────────────────┴──────────────────┘
//
// "Rakibiniz sizden 17 puan önde."
// "Farkı kapatmak için ücretsiz danışmanlık alın."
// [E-posta ile Tam Raporu Al →]
//   → E-posta form + company name
//   → Submit → competitor_checks kaydı
//   → ISR lead oluştur
//   → Tarama kuyruğuna ekle
//   → Teaser rapor e-posta gönder

export async function handleCompetitorCheck(
  ownDomain: string,
  competitorDomain: string,
  email?: string,
  company?: string
) {
  // İki domain'i paralel tara (veya cache'den çek)
  const [ownScan, competitorScan] = await Promise.all([
    getScanResult(ownDomain),
    getScanResult(competitorDomain)
  ]);

  // Kaydı oluştur
  await db.insert(competitorChecks).values({
    ownDomain, competitorDomain,
    ownScore: ownScan.overallScore,
    competitorScore: competitorScan.overallScore,
    visitorEmail: email,
    visitorCompany: company,
  });

  // E-posta verilmişse lead akışını başlat
  if (email) {
    await createLeadFromCompetitorCheck(ownDomain, email, company);
  }

  return { ownScan, competitorScan };
}
```

---

## TİER 2: TEDARİKÇİ ZİNCİRİNE YAYILMA

```typescript
// src/growth/triggers/supplierChain.ts

// Yeni sözleşme imzalandığında tetiklenir
export async function onContractSigned(customerId: number): Promise<void> {

  // Müşteriden tedarikçi listesi iste (TPRM modülünden)
  const suppliers = await getCustomerSuppliers(customerId);
  const customer = await getCustomer(customerId);

  for (const supplier of suppliers) {
    if (!supplier.domain) continue;

    // Tedarikçi zaten CRM'de mi?
    const exists = await checkDomainExists(supplier.domain);
    if (exists) continue;

    // Tarama kuyruğuna ekle — özel kaynak etiketi
    await db.insert(leadScanQueue).values({
      domain: supplier.domain,
      companyName: supplier.name,
      source: 'supplier_chain',
      scanStatus: 'pending',
    });
  }

  // Tedarikçi taraması tamamlanınca özel e-posta:
  // "Müşteriniz [Firma] tedarikçi güvenliğini değerlendirmek istiyor"
}
```

**E-posta:**
```
Konu: [Ana Firma] tedarikçi güvenliğinizi değerlendirmek istiyor

[Ana Firma] A.Ş., tedarik zinciri güvenlik standardını
oluşturmak amacıyla tedarikçilerinin siber güvenlik
durumunu değerlendiriyor.

Bu süreçte [domain] alan adınız CyberStep platformu
üzerinden incelendi.

Değerlendirme raporunu ücretsiz görüntüleyebilirsiniz:
[Raporu Görüntüle →]
```

---

## TİER 2: PORT DEĞİŞİKLİK DELTA TESPİTİ

```typescript
// src/growth/triggers/portChange.ts

// Her hafta — önceki tarama ile karşılaştır
cron.schedule('0 4 * * 0', async () => { // Pazar 04:00

  const domains = await getAllTrackedDomains();

  for (const item of domains) {
    const currentScan = await runPortScan(item.domain);
    const previousScan = await getLastPortScan(item.domain);

    if (!previousScan) {
      await savePortScan(item.domain, currentScan);
      continue;
    }

    // Yeni açılan portlar
    const newPorts = currentScan.openPorts.filter(
      p => !previousScan.openPorts.includes(p)
    );

    // Kapanan portlar
    const closedPorts = previousScan.openPorts.filter(
      p => !currentScan.openPorts.includes(p)
    );

    if (newPorts.length > 0) {
      // Kritik port kontrolü
      const criticalPorts = { 3389: 'RDP', 22: 'SSH', 445: 'SMB',
                               1433: 'SQL Server', 3306: 'MySQL' };

      const criticalNewPorts = newPorts.filter(p => criticalPorts[p]);

      if (criticalNewPorts.length > 0) {
        await fireTrigger({
          type: 'port_change',
          domain: item.domain,
          customerId: item.customerId,
          data: {
            newPorts: criticalNewPorts,
            portNames: criticalNewPorts.map(p => criticalPorts[p]),
            closedPorts
          }
        });
      }
    }
    await savePortScan(item.domain, currentScan);
  }
});
```

**E-posta:**
```
Konu: [domain] — Bu hafta yeni port açıldı

[domain] adresinizin bu haftaki taramasında
geçen haftaya göre değişiklik tespit edildi.

Yeni açılan: Port [N] ([servis adı]) ← Dikkat gerektiriyor
[N] port kapatıldı ← İyi haber

[servis adı] portu, saldırganların sıkça hedef aldığı
bir giriş noktasıdır. Kasıtlı açıldıysa güvence altına
alınması, yanlışlıkla açıldıysa kapatılması önerilir.

[Güvenlik Danışmanıyla Görüş →]
```

---

## TİER 2: BENCHMARK RAPORU LEAD MIKNATI SI

```typescript
// src/pages/BenchmarkDownloadPage.tsx
// URL: /sektor-raporu

// Sektör seç + form doldur + raporu indir
// Form: İsim, E-posta, Şirket, Sektör seçimi

// Submit:
// 1. benchmark_downloads kaydı oluştur
// 2. İlk 5 saniye: PDF indir (gerçek CyberStep sektör verisi)
// 3. Arka planda: domain tespit et (e-posta domain'inden)
// 4. ISR lead kuyruğuna ekle
// 5. 24 saat sonra takip e-postası

// Benchmark PDF içeriği:
// - Sektör ortalama güvenlik skoru
// - En yaygın 5 açık
// - KVKK uyum oranı
// - "Şirketinizin sektör ortalamasına göre nerede
//    olduğunu öğrenmek için ücretsiz tarama başlatın"
```

---

## TİER 3: EKAP İHALE TAKİBİ

```typescript
// src/growth/triggers/ekapTender.ts

// Her gece 03:00 — EKAP API'den yeni ihaleler çek
cron.schedule('0 3 * * *', async () => {

  // EKAP Açık API: https://ekap.kik.gov.tr/EKAP/
  // İhale sonuç bildirimleri endpoint'i
  const tenders = await fetchEKAPResults({
    categories: ['bilgi_teknolojileri', 'yazilim_gelistirme',
                  'bulut_hizmetleri', 'it_danismanlik',
                  'siber_guvenlik', 'veri_merkezi'],
    dateFrom: yesterday(),
  });

  for (const tender of tenders) {
    // Kazanan firma domain'ini bul (Google araması veya Apollo)
    const domain = await findCompanyDomain(tender.winnerCompany);
    if (!domain) continue;

    // Daha önce işlendi mi?
    const exists = await db.select().from(ekapTenders)
      .where(eq(ekapTenders.tenderNumber, tender.number));
    if (exists.length > 0) continue;

    await db.insert(ekapTenders).values({
      tenderNumber: tender.number,
      contractingAuthority: tender.authority,
      winnerCompany: tender.winnerCompany,
      winnerDomain: domain,
      tenderSubject: tender.subject,
      tenderAmountTl: tender.amount,
      awardDate: tender.awardDate,
    });

    // Tarama kuyruğuna ekle
    await db.insert(leadScanQueue).values({
      domain,
      companyName: tender.winnerCompany,
      source: 'ekap_tender',
      scanStatus: 'pending',
    });
  }
});
```

**E-posta:**
```
Konu: [Şirket] — Kamu ihalesinin getirdiği siber güvenlik yükümlülükleri

[Şirket Adı] olarak [ihale konusu] kapsamında
[kamu kurumu] ile çalışmaya başladığınızı görüyoruz.

Kamu kurumlarıyla çalışan firmalar için
Siber Güvenlik Başkanlığı'nın 2027 yetkilendirme
zorunluluğu ve KVKK teknik tedbir gereklilikleri
kritik önem taşıyor.

[domain] için ücretsiz uyum analizi:
[Analizi Başlat →]
```

---

## TİER 3: YENİ KURULAN ŞİRKET (MERSİS)

```typescript
// src/growth/triggers/newCompany.ts

// Her Pazartesi 06:00 — bu hafta kurulan şirketler
cron.schedule('0 6 * * 1', async () => {

  // Ticaret Sicil Gazetesi RSS veya
  // ticaretsicilgazetesi.gtb.gov.tr API
  const newCompanies = await fetchNewCompaniesThisWeek();

  // Filtrele: 10+ çalışan tahmini olan sektörler
  const targetSectors = ['teknoloji', 'finans', 'saglik',
                          'e-ticaret', 'lojistik', 'danismanlik'];

  for (const company of newCompanies) {
    if (!targetSectors.includes(company.sector)) continue;

    // Web sitesi domain'i var mı bulmaya çalış
    const domain = await findCompanyWebsite(company.name, company.city);

    await db.insert(newCompaniesRegistry).values({
      mersisNumber: company.mersisNo,
      companyName: company.name,
      city: company.city,
      sector: company.sector,
      establishmentDate: company.established,
      domain: domain || null,
    });

    if (domain) {
      await db.insert(leadScanQueue).values({
        domain,
        companyName: company.name,
        source: 'mersis_registry',
        scanStatus: 'pending',
      });
    }
  }
});
```

---

## MERKEZI TRIGGER İŞLEYİCİSİ

```typescript
// src/growth/triggerProcessor.ts
// Tüm triggerlar bu fonksiyonu çağırır

export async function fireTrigger(params: TriggerParams): Promise<void> {

  // 1. Duplicate kontrol — aynı trigger aynı domain'e son X günde gitti mi?
  const suppressDays = TRIGGER_SUPPRESS_DAYS[params.type] || 30;
  const recent = await db.select().from(growthTriggers)
    .where(
      and(
        eq(growthTriggers.triggerType, params.type),
        eq(growthTriggers.domain, params.domain),
        gte(growthTriggers.createdAt,
            new Date(Date.now() - suppressDays * 24 * 60 * 60 * 1000))
      )
    );
  if (recent.length > 0) return; // Zaten gönderilmiş

  // 2. E-posta adresi var mı?
  const email = await findBestEmailForDomain(params.domain, params.customerId);
  if (!email) {
    // Email yok — ISR kuyruğuna ekle, Apollo/Hunter ile bul
    await queueForEnrichment(params);
    return;
  }

  // 3. Claude ile kişiselleştirilmiş e-posta üret
  const emailContent = await generateTriggerEmail(params, email);

  // 4. E-postayı gönder
  await sendEmail({
    to: email.address,
    subject: emailContent.subject,
    html: buildTriggerEmailHTML(emailContent, params),
    trackingId: `trigger_${params.type}_${params.domain}`,
  });

  // 5. Kaydı oluştur
  const trigger = await db.insert(growthTriggers).values({
    triggerType: params.type,
    domain: params.domain,
    customerId: params.customerId || null,
    triggerData: params.data,
    emailSentAt: new Date(),
    status: 'sent',
  }).returning();

  // 6. ISR'da lead yoksa oluştur
  if (!params.customerId) {
    const customer = await ensureISRCustomer(params.domain, params.companyName);
    await ensureISRDeal(customer.id, {
      stage: 'new_lead',
      source: params.type,
      triggerId: trigger[0].id,
    });
  }
}

// Trigger türüne göre baskılama süresi (gün)
const TRIGGER_SUPPRESS_DAYS = {
  ssl_expiry:      7,   // Her hafta hatırlat
  new_cve:         30,  // Aynı CVE için 30 gün bekleme
  sector_breach:   30,  // Aynı sektör için 30 gün
  kvk_penalty:     30,
  score_drop:      14,
  competitor_check: 0,  // Her kullanımda kaydet
  port_change:     14,
  supplier_chain:  90,  // 3 ayda bir
  ekap_tender:     0,   // Tek seferlik
  new_company:     0,   // Tek seferlik
  benchmark_dl:    0,   // Tek seferlik
};
```

---

## BÜYÜME MOTORU ADMİN PANELİ

```
/admin-panel/growth-engine

Sekmeler: [ Genel Bakış | Tetikleyiciler | Araçlar | Ayarlar ]

─── GENEL BAKIŞ ──────────────────────────────────────────────
Bu Ay:
  Gönderilen trigger e-postası:  [N]
  Açılma oranı:                  [%]
  Tıklama oranı:                 [%]
  ISR'a eklenen lead:            [N]
  Dönüşen deal:                  [N]
  Tahmini gelir etkisi:          ₺[X]

Trigger türü performansı (tablo):
  Tür              | Gönderilen | Açılan | Lead | Deal | CVR
  ssl_expiry       |     23     |   67%  |   8  |   2  | 8.7%
  new_cve          |     45     |   71%  |  12  |   3  | 6.7%
  sector_breach    |     67     |   58%  |   9  |   1  | 1.5%
  score_drop       |     18     |   89%  |   7  |   3  | 16.7%

─── TETİKLEYİCİLER sekmesi ──────────────────────────────────
Bekleyen / Gönderilmiş / Dönüşmüş filtreleri

Her satır: Domain | Tür | Tetiklenme tarihi | E-posta durumu | Deal?

─── ARAÇLAR sekmesi ─────────────────────────────────────────
"Rakibiniz Nerede?" kullanımları:
  Bu ay: [N] kullanım | [N] lead | [N] dönüşüm

Benchmark indirmeleri:
  Bu ay: [N] indirme | [N] lead

─── AYARLAR sekmesi ─────────────────────────────────────────
Her trigger türü için:
  [ ] Aktif
  Baskılama süresi: [  ] gün
  Max günlük gönderim: [  ]
  Test e-postası: [Gönder]
```

---

## UYGULAMA SIRASI

```
SPRINT 1 (Bu hafta — Tier 1):
  ✓ growth_triggers tablosu
  ✓ fireTrigger() merkezi fonksiyon
  ✓ SSL expiry trigger (crt.sh)
  ✓ Skor düşüşü upsell trigger
  ✓ Admin panel temel görünüm

SPRINT 2 (Gelecek hafta — Tier 1 devam):
  ✓ CVE alert trigger (NVD API)
  ✓ Sektör saldırı FOMO trigger
  ✓ KVK ceza trigger
  ✓ "Rakibiniz Nerede?" sayfası

SPRINT 3 (Tier 2):
  ✓ Port değişiklik delta tespiti
  ✓ Tedarikçi zinciri yayılma
  ✓ Benchmark download lead mıknatısı
  ✓ Breach paste monitoring

SPRINT 4 (Tier 3):
  ✓ EKAP ihale takibi
  ✓ MERSİS yeni şirket takibi
  ✓ Sektörel bülten aboneliği
```

---

## ÖZET — BEKLENEN ETKİ

```
Trigger Türü          Aylık Tahmini   Beklenen CVR   Tahmini Lead
─────────────────────────────────────────────────────────────────
SSL Expiry              80-120           8-12%          8-15
CVE Alert              100-200           5-8%          5-16
Sektor FOMO             50-80           2-4%           1-3
KVK Ceza                20-40           8-15%          2-6
Skor Düşüşü (müşteri)   30-50          15-25%          5-12
Competitor Check          ---          (viral)         10-30
Port Delta               60-100          6-10%          4-10
Tedarikçi Zinciri        20-40          10-15%          2-6
Benchmark Download        ---           20-30%         20-40
EKAP İhale              30-60           5-10%           2-6
─────────────────────────────────────────────────────────────────
TOPLAM                                                 59-144 lead/ay
```

---

*CyberStep.io Growth Engine — Mayıs 2026*
