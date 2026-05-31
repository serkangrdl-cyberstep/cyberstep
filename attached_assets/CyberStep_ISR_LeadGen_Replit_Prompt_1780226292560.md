# CyberStep.io — ISR Modülü Tam Kurgu + Otomatik Lead Üretimi
## Replit Agent Promptu — Mevcut ISR Pasiften Aktife Alma + Tam Yeniden Tasarım

---

## BAĞLAM: MEVCUT DURUM

ISR (İç Satış Temsilcisi) modülü daha önce kısmen geliştirilmiş
ve pasife alınmıştı. Mevcut tablolar:
- isr_customers, isr_vendors, isr_distributors
- isr_deals, isr_rfqs, isr_rfq_responses
- isr_quotes, isr_quote_lines, isr_margin_rules
- isr_email_inbox (IMAP entegrasyonu)

Bu prompt:
1. Mevcut ISR tablolarını koru ama dönüştür — artık B2B satış CRM
2. Yeni lead üretim altyapısını ekle
3. Enterprise prospects modülüyle entegre et
4. Otomatik domain tarama + AI lead skorlama ekle
5. Apollo.io + Hunter.io ile kontak zenginleştirme ekle

---

## BÖLÜM 1: VERİTABANI GÜNCELLEMELERİ

### 1a — Mevcut ISR tablolarını dönüştür

```sql
-- isr_customers → enterprise CRM müşteri kaydına dönüşüyor
-- Mevcut sütunları koru, şunları EKLE:
ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  lead_source varchar(50) DEFAULT 'manual';
  -- 'manual' | 'auto_scan' | 'inbound' | 'referral' |
  -- 'apollo' | 'linkedin' | 'event'

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  domain varchar(255);

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  employee_count varchar(50);

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  annual_revenue_estimate varchar(50);
  -- 'under_1m' | '1m_5m' | '5m_20m' | '20m_plus'

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  linkedin_url varchar(500);

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  lead_score integer DEFAULT 0;
  -- 0-100, AI tarafından hesaplanır

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  lead_score_reason text;
  -- Claude'un lead skoru gerekçesi

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  last_scanned_at timestamp;
  -- Domain son ne zaman tarandı

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  scan_risk_level varchar(20);
  -- Tarama sonucu risk seviyesi

ALTER TABLE isr_customers ADD COLUMN IF NOT EXISTS
  prospect_id integer;
  -- enterprise_prospects tablosuyla bağlantı

-- isr_deals → pipeline stage sistemi güncelleniyor
ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  pipeline_stage varchar(50) DEFAULT 'new_lead';
  -- new_lead | qualified | teaser_sent | teaser_viewed |
  -- demo_scheduled | proposal_sent | contract_sent |
  -- negotiating | won | lost | no_response

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  expected_value_tl decimal(12,2);

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  probability_pct integer DEFAULT 0;
  -- 0-100

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  expected_close_date date;

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  lost_reason varchar(255);

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  next_action varchar(255);
  -- "Salı telefon et" gibi

ALTER TABLE isr_deals ADD COLUMN IF NOT EXISTS
  next_action_date date;
```

### 1b — Yeni tablolar

```sql
-- ─── Otomatik Lead Tarama Kuyruğu ────────────────────────
CREATE TABLE IF NOT EXISTS lead_scan_queue (
  id serial PRIMARY KEY,

  domain varchar(255) NOT NULL,
  company_name varchar(255),
  source varchar(50),
  -- 'apollo_api' | 'hunter_io' | 'manual_import' |
  -- 'turkish_registry' | 'google_places' | 'news_scrape'

  -- Tarama durumu
  scan_status varchar(20) DEFAULT 'pending',
  -- pending | scanning | scored | imported | skipped

  -- Tarama sonuçları
  domain_scan_data jsonb,
  risk_score integer,
  risk_level varchar(20),
  critical_count integer DEFAULT 0,
  high_count integer DEFAULT 0,

  -- AI Lead Skoru
  lead_score integer,
  -- 0-100: Satış önceliği
  lead_score_factors jsonb,
  -- {vulnerability: 40, company_size: 30, sector_priority: 20, ...}

  -- Kontak bilgisi (zenginleştirme sonrası)
  contacts jsonb,
  -- [{name, title, email, linkedin, source, confidence}]

  -- Karar
  imported_at timestamp,
  imported_to_customer_id integer,
  skipped_reason varchar(255),

  created_at timestamp DEFAULT now(),
  scanned_at timestamp
);

-- ─── Kontak Zenginleştirme Log ────────────────────────────
CREATE TABLE IF NOT EXISTS contact_enrichment_log (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES isr_customers(id),
  domain varchar(255),

  -- Apollo.io sonuçları
  apollo_searched_at timestamp,
  apollo_contacts_found integer DEFAULT 0,
  apollo_data jsonb,

  -- Hunter.io sonuçları
  hunter_searched_at timestamp,
  hunter_emails_found integer DEFAULT 0,
  hunter_data jsonb,

  -- Manuel LinkedIn
  linkedin_searched_at timestamp,
  linkedin_notes text,

  -- Seçilen ana kontak
  selected_contact_name varchar(255),
  selected_contact_title varchar(100),
  selected_contact_email varchar(255),
  selected_contact_phone varchar(50),
  selected_contact_linkedin varchar(500),
  selection_confidence varchar(20),
  -- 'verified' | 'likely' | 'estimated'

  created_at timestamp DEFAULT now()
);

-- ─── Satış Aktiviteleri ───────────────────────────────────
CREATE TABLE IF NOT EXISTS isr_activities (
  id serial PRIMARY KEY,
  deal_id integer REFERENCES isr_deals(id),
  customer_id integer REFERENCES isr_customers(id),

  activity_type varchar(30) NOT NULL,
  -- 'call' | 'email' | 'meeting' | 'demo' |
  -- 'proposal' | 'follow_up' | 'note' | 'stage_change'

  subject varchar(255),
  description text,
  outcome varchar(100),
  -- 'positive' | 'neutral' | 'negative' | 'no_answer'

  next_action varchar(255),
  next_action_date date,

  performed_by varchar(100),
  performed_at timestamp DEFAULT now()
);

-- ─── Satış Ekibi Üyeleri ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_team (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  title varchar(100),
  phone varchar(50),
  is_active boolean DEFAULT true,
  monthly_target_tl decimal(12,2),
  created_at timestamp DEFAULT now()
);

-- ─── Lead Üretim Kampanyaları ─────────────────────────────
CREATE TABLE IF NOT EXISTS lead_campaigns (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  -- Örn: "Q2 2026 — Finans Sektörü Taraması"

  -- Hedef kriterleri
  target_sectors text[],
  -- ['finans', 'saglik', 'e-ticaret']
  target_employee_min integer,
  target_employee_max integer,
  target_cities text[],

  -- Kaynak yapılandırması
  sources text[],
  -- ['apollo_api', 'hunter_io', 'manual']

  -- Durum
  status varchar(20) DEFAULT 'active',
  -- active | paused | completed

  -- İstatistikler
  domains_found integer DEFAULT 0,
  domains_scanned integer DEFAULT 0,
  leads_imported integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  deals_won integer DEFAULT 0,

  created_by varchar(100),
  created_at timestamp DEFAULT now(),
  completed_at timestamp
);
```

---

## BÖLÜM 2: OTOMATIK LEAD ÜRETIM MİMARİSİ

### 2.1 — Lead Kaynak Stratejisi

LinkedIn automation ToS ihlali — kullanma.
Bunun yerine bu kombinasyon hem yasal hem API'li hem ucuz:

```
KATMAN 1 — ŞİRKET BULMA (Ücretsiz / Düşük Maliyet)
─────────────────────────────────────────────────
A. Apollo.io API (aylık ~$49, 10.000 kişi araması)
   → Sektör + lokasyon + şirket büyüklüğüne göre
   → Türkiye'deki şirketleri filtrele
   → Domain bilgisi geliyor

B. Google Places API (ücretsiz katman: 200$/ay kredi)
   → "fintech istanbul" gibi aramalar
   → Website domain'i içeriyor

C. Hunter.io Domain Search (aylık $49, 500 arama)
   → Domain'e ait kamuya açık e-postaları buluyor
   → CEO/CTO/CFO rollerini tespit ediyor

D. Türkiye'ye özel ücretsiz kaynaklar:
   → TOBB üye dizini (scraping değil, manuel export)
   → Kamuya açık KAP bildirimleri (halka açık şirketler)
   → Teknoloji haberleri: Webrazzi, ShiftDelete yeni şirketler

KATMAN 2 — KONTAKт BULMA
─────────────────────────────────────────────────
A. Apollo.io People Search
   → Domain + "CEO" / "IT Director" / "CTO" / "CFO"
   → İsim, unvan, doğrulanmış e-posta, LinkedIn URL

B. Hunter.io Email Finder
   → İsim + domain → e-posta tahmini
   → E-posta doğrulama dahil

C. LinkedIn Sales Navigator (MANUEL + AI destekli)
   → Sales Navigator'da şirket aranır
   → AI, hangi kişiye ulaşılması gerektiğini önerir
   → Mesaj şablonu Claude tarafından üretilir
   → Manual gönderim (otomasyon yok)

KATMAN 3 — SKORLAMA & ÖNCELİKLENDİRME
─────────────────────────────────────────────────
   → Domain tarama (CyberStep'in kendi motoru)
   → Yüksek risk skoru = yüksek satış önceliği
   → Claude lead skoru üretir (0-100)
```

### 2.2 — Apollo.io Entegrasyonu

```typescript
// src/services/apolloService.ts

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_BASE = 'https://api.apollo.io/v1';

// Türkiye'deki şirketleri sektör bazında çek
export async function searchCompanies(params: {
  sector: string;
  minEmployees: number;
  maxEmployees: number;
  cities?: string[];
  page?: number;
}): Promise<ApolloCompany[]> {
  const response = await axios.post(
    `${APOLLO_BASE}/mixed_companies/search`,
    {
      api_key: APOLLO_API_KEY,
      q_organization_keyword_tags: [params.sector],
      organization_locations: params.cities?.length
        ? params.cities.map(c => `${c}, Turkey`)
        : ['Turkey'],
      organization_num_employees_ranges: [
        `${params.minEmployees},${params.maxEmployees}`
      ],
      page: params.page || 1,
      per_page: 25,
    }
  );

  return response.data.organizations.map(org => ({
    name: org.name,
    domain: org.primary_domain,
    website: org.website_url,
    employees: org.estimated_num_employees,
    industry: org.industry,
    city: org.city,
    linkedinUrl: org.linkedin_url,
    apolloId: org.id,
  }));
}

// Domain'e ait CEO/CTO/IT yöneticilerini bul
export async function findDecisionMakers(domain: string): Promise<ApolloContact[]> {
  const response = await axios.post(
    `${APOLLO_BASE}/mixed_people/search`,
    {
      api_key: APOLLO_API_KEY,
      q_organization_domains: [domain],
      person_titles: [
        'CEO', 'Genel Müdür', 'CTO', 'CISO',
        'IT Director', 'IT Müdürü', 'CFO',
        'Bilgi İşlem Müdürü', 'Kurucu'
      ],
      page: 1,
      per_page: 10,
    }
  );

  return response.data.people.map(p => ({
    name: `${p.first_name} ${p.last_name}`,
    title: p.title,
    email: p.email,
    emailStatus: p.email_status,
    // 'verified' | 'likely' | 'guessed'
    linkedinUrl: p.linkedin_url,
    apolloId: p.id,
    confidence: p.email_status === 'verified' ? 'high' : 'medium',
  }));
}
```

### 2.3 — Hunter.io Entegrasyonu

```typescript
// src/services/hunterService.ts

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const HUNTER_BASE = 'https://api.hunter.io/v2';

// Domain'e ait kamuya açık e-postaları bul
export async function domainSearch(domain: string): Promise<HunterResult> {
  const response = await axios.get(`${HUNTER_BASE}/domain-search`, {
    params: {
      domain,
      api_key: HUNTER_API_KEY,
      limit: 10,
    }
  });

  const data = response.data.data;
  return {
    domain,
    organization: data.organization,
    pattern: data.pattern,
    // Örn: {first}.{last}@domain.com
    emails: data.emails.map(e => ({
      email: e.value,
      confidence: e.confidence,
      firstName: e.first_name,
      lastName: e.last_name,
      position: e.position,
      linkedin: e.linkedin,
      sources: e.sources.map(s => s.domain),
    })),
  };
}

// Belirli kişi + domain için e-posta bul
export async function emailFinder(
  firstName: string,
  lastName: string,
  domain: string
): Promise<HunterEmail> {
  const response = await axios.get(`${HUNTER_BASE}/email-finder`, {
    params: {
      first_name: firstName,
      last_name: lastName,
      domain,
      api_key: HUNTER_API_KEY,
    }
  });
  return response.data.data;
}

// E-postayı doğrula (göndermeden önce)
export async function verifyEmail(email: string): Promise<EmailVerification> {
  const response = await axios.get(`${HUNTER_BASE}/email-verifier`, {
    params: { email, api_key: HUNTER_API_KEY }
  });
  return response.data.data;
  // result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
}
```

### 2.4 — LinkedIn Sales Navigator (Yarı Otomatik Workflow)

LinkedIn otomasyona kapalı. Bu workflow AI-destekli MANUEL süreçtir:

```typescript
// src/services/linkedinWorkflow.ts

// Satış temsilcisi için AI destekli LinkedIn arama önerisi üret
export async function generateLinkedInSearchGuide(
  companyName: string,
  domain: string,
  existingContacts: ApolloContact[]
): Promise<LinkedInGuide> {

  const prompt = `
Satış temsilcisine LinkedIn Sales Navigator'da arama rehberi hazırla.

Şirket: ${companyName}
Domain: ${domain}
Apollo'da bulunan kişiler: ${existingContacts.map(c =>
  `${c.name} (${c.title})`).join(', ') || 'Bulunamadı'}

Şunları üret:
1. LinkedIn arama filtresi önerisi (şirket + unvan kombinasyonu)
2. Ulaşılması önerilen 3 unvan (öncelik sırasıyla)
3. İlk bağlantı mesajı şablonu (Türkçe, 300 karakter max, kişiselleştirme alanları ile)
4. Takip mesajı şablonu (3 gün sonra)

JSON formatında döndür:
{
  "search_filter": "LinkedIn arama URL formatı ipucu",
  "target_titles": ["Unvan 1", "Unvan 2", "Unvan 3"],
  "connection_message": "Merhaba [İsim], ...",
  "followup_message": "Merhaba [İsim], ...",
  "why_these_titles": "Neden bu unvanları hedefliyoruz"
}
`;

  const response = await callClaude(prompt);
  return JSON.parse(response);
}

// Satış temsilcisi LinkedIn'de kişi bulunca manuel kaydeder
// Sistem bu kaydı kontak zenginleştirme olarak işler
export async function saveLinkedInContact(
  customerId: number,
  contact: {
    name: string;
    title: string;
    linkedinUrl: string;
    email?: string;
  }
): Promise<void> {
  await db.update(contactEnrichmentLog)
    .set({
      linkedinSearchedAt: new Date(),
      linkedinNotes: `Manuel LinkedIn araması: ${contact.name}`,
      selectedContactName: contact.name,
      selectedContactTitle: contact.title,
      selectedContactLinkedin: contact.linkedinUrl,
      selectedContactEmail: contact.email,
      selectionConfidence: contact.email ? 'verified' : 'likely',
    })
    .where(eq(contactEnrichmentLog.customerId, customerId));
}
```

---

## BÖLÜM 3: OTOMATIK GÜNLÜK TARAMA SİSTEMİ

### 3.1 — Lead Üretim Cron Job'ları

```typescript
// src/scheduler/leadGeneration.ts

// ─── Her gece 02:00 — Apollo'dan yeni şirketler çek ──────
cron.schedule('0 2 * * *', async () => {
  const activeCampaigns = await getActiveCampaigns();

  for (const campaign of activeCampaigns) {
    for (const sector of campaign.target_sectors) {
      const companies = await apolloService.searchCompanies({
        sector,
        minEmployees: campaign.target_employee_min || 10,
        maxEmployees: campaign.target_employee_max || 500,
        cities: campaign.target_cities,
      });

      for (const company of companies) {
        // Daha önce eklenmiş mi kontrol et
        const exists = await checkDomainExists(company.domain);
        if (exists || !company.domain) continue;

        // Tarama kuyruğuna ekle
        await db.insert(leadScanQueue).values({
          domain: company.domain,
          companyName: company.name,
          source: 'apollo_api',
          scanStatus: 'pending',
        });

        await db.update(leadCampaigns)
          .set({ domainsFound: sql`domains_found + 1` })
          .where(eq(leadCampaigns.id, campaign.id));
      }
    }
  }

  console.log('Lead generation: Apollo scan complete');
});

// ─── Her gece 03:00 — Kuyruktaki domain'leri tara ────────
cron.schedule('0 3 * * *', async () => {
  // Her seferinde max 50 domain tara (API limiti)
  const pending = await db
    .select()
    .from(leadScanQueue)
    .where(eq(leadScanQueue.scanStatus, 'pending'))
    .limit(50);

  for (const item of pending) {
    try {
      await db.update(leadScanQueue)
        .set({ scanStatus: 'scanning' })
        .where(eq(leadScanQueue.id, item.id));

      // CyberStep domain taraması
      const scanResult = await runDomainScan(item.domain);

      // Claude ile lead skoru üret
      const leadScore = await scoreLeadWithAI(
        item.domain,
        item.companyName,
        scanResult
      );

      await db.update(leadScanQueue).set({
        scanStatus: 'scored',
        domainScanData: scanResult,
        riskScore: scanResult.overallScore,
        riskLevel: scanResult.riskLevel,
        criticalCount: scanResult.criticalCount,
        highCount: scanResult.highCount,
        leadScore: leadScore.score,
        leadScoreFactors: leadScore.factors,
        scannedAt: new Date(),
      }).where(eq(leadScanQueue.id, item.id));

    } catch (e) {
      await db.update(leadScanQueue)
        .set({ scanStatus: 'skipped', skippedReason: e.message })
        .where(eq(leadScanQueue.id, item.id));
    }

    // API rate limit için bekle
    await sleep(2000);
  }
});

// ─── Her gece 04:00 — Yüksek skorlu leadlere kontak bul ──
cron.schedule('0 4 * * *', async () => {
  // Lead skoru 60+ olan ama kontağı olmayan kayıtlar
  const highValueLeads = await db
    .select()
    .from(leadScanQueue)
    .where(
      and(
        eq(leadScanQueue.scanStatus, 'scored'),
        gte(leadScanQueue.leadScore, 60),
        isNull(leadScanQueue.contacts)
      )
    )
    .limit(20); // Hunter günlük limit gözetilerek

  for (const lead of highValueLeads) {
    const contacts = [];

    // 1. Apollo ile karar verici bul
    try {
      const apolloContacts = await apolloService.findDecisionMakers(lead.domain);
      contacts.push(...apolloContacts.map(c => ({...c, source: 'apollo'})));
    } catch (e) {}

    // 2. Hunter.io ile e-posta ara (Apollo'da bulunamazsa)
    if (contacts.length === 0) {
      try {
        const hunterResult = await hunterService.domainSearch(lead.domain);
        const topContacts = hunterResult.emails
          .filter(e => e.position && e.confidence > 70)
          .slice(0, 3)
          .map(e => ({
            name: `${e.firstName} ${e.lastName}`,
            title: e.position,
            email: e.email,
            confidence: e.confidence > 85 ? 'high' : 'medium',
            source: 'hunter',
          }));
        contacts.push(...topContacts);
      } catch (e) {}
    }

    await db.update(leadScanQueue)
      .set({ contacts: JSON.stringify(contacts) })
      .where(eq(leadScanQueue.id, lead.id));

    await sleep(1500);
  }
});

// ─── Her sabah 08:30 — Günlük lead raporu admin'e ────────
cron.schedule('30 8 * * 1-5', async () => {
  // Pazartesi-Cuma iş günleri

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const newLeads = await db
    .select()
    .from(leadScanQueue)
    .where(
      and(
        eq(leadScanQueue.scanStatus, 'scored'),
        gte(leadScanQueue.scannedAt, yesterday),
        gte(leadScanQueue.leadScore, 50)
      )
    )
    .orderBy(desc(leadScanQueue.leadScore))
    .limit(20);

  if (newLeads.length === 0) return;

  await sendAdminEmail({
    subject: `📊 Günlük Lead Raporu — ${newLeads.length} yeni yüksek öncelikli lead`,
    template: 'daily_lead_report',
    data: { leads: newLeads }
  });
});
```

### 3.2 — AI Lead Skorlama

```typescript
export async function scoreLeadWithAI(
  domain: string,
  companyName: string,
  scanResult: DomainScanResult
): Promise<{ score: number; factors: LeadScoreFactors }> {

  const prompt = `
Sen CyberStep.io'nun satış analisti asistanısın.
Aşağıdaki şirketin CyberStep için satış önceliğini belirle.

ŞİRKET: ${companyName} (${domain})
GÜVENLİK TARAMA SONUCU:
- Risk Skoru: ${scanResult.overallScore}/100
- Risk Seviyesi: ${scanResult.riskLevel}
- Kritik Bulgu: ${scanResult.criticalCount}
- Yüksek Bulgu: ${scanResult.highCount}
- En kritik açıklar: ${scanResult.topFindings?.join(', ')}

SEKTÖR TAHMİNİ: ${scanResult.detectedTech?.join(', ') || 'Bilinmiyor'}

LEAD SKORU HESAPLA (0-100):
Faktörler ve ağırlıklar:
- Güvenlik açığı ciddiyeti (0-40 puan):
  Yüksek risk = yüksek satış aciliyeti
- Şirket büyüklüğü tahmini (0-20 puan):
  Domain yaşı, subdomain sayısı, teknoloji stack zenginliği
- Sektör önceliği (0-20 puan):
  Finans/sağlık/hukuk = yüksek; basit e-ticaret = düşük
- KVKK riski (0-20 puan):
  Kişisel veri işleme ihtimali

JSON formatında döndür:
{
  "score": 0-100,
  "factors": {
    "vulnerability_score": 0-40,
    "company_size_score": 0-20,
    "sector_priority_score": 0-20,
    "kvkk_risk_score": 0-20
  },
  "priority": "hot | warm | cold",
  "reasoning": "2-3 cümle neden bu skor",
  "suggested_service": "En uygun CyberStep servisi"
}
`;

  const response = await callClaude(prompt);
  return JSON.parse(response);
}
```

---

## BÖLÜM 4: ISR MODÜLÜ — KULLANICI ARAYÜZÜ

### 4.1 — Sol Menü Yeniden Yapılandırması

```
Admin sol menüsünde mevcut "ISR" bölümünü tamamen yeniden düzenle:

─── Satış & CRM ────────────────────
  📊  Pipeline Görünümü        /admin-panel/isr/pipeline
  👥  Müşteriler / Leads       /admin-panel/isr/customers
  🎯  Lead Üretimi             /admin-panel/isr/lead-gen
  📧  Gelen Kutusu             /admin-panel/isr/inbox
  📋  Teklifler                /admin-panel/isr/quotes
  📄  Sözleşmeler              /admin-panel/isr/contracts  ←yeni
  🧾  Faturalar                /admin-panel/isr/invoices   ←yeni
  📈  Satış Raporları          /admin-panel/isr/reports    ←yeni
────────────────────────────────────
```

### 4.2 — Pipeline Görünümü (Kanban)

```
/admin-panel/isr/pipeline

Üst kısım — MRR & Pipeline özeti:
┌──────────────┬───────────────┬────────────────┬──────────────┐
│ Pipeline     │ Bu Ay Tahmini │ Bu Ay Kapanan  │ Aktif Müşteri│
│ ₺2.4M        │ ₺380K         │ ₺125K          │ 47           │
└──────────────┴───────────────┴────────────────┴──────────────┘

Kanban board — her sütun bir stage:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Yeni Lead│ │Nitelikli │ │Teaser    │ │Demo/Teklif│ │Sözleşme  │ │Kazanıldı │
│    12    │ │    8     │ │Gönderildi│ │    5     │ │Gönderildi│ │    3     │
│  ₺-      │ │  ₺850K   │ │  ₺1.2M   │ │  ₺640K   │ │  ₺380K   │ │  ₺125K   │
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│ [Kart]   │ │ [Kart]   │ │ [Kart]   │ │ [Kart]   │ │ [Kart]   │ │ [Kart]   │
│ Acme Ltd │ │ Beta AS  │ │ Gamma    │ │ Delta    │ │ Sigma    │ │ Omega    │
│ YÜKSEK🔴 │ │ ORTA 🟡  │ │ KRİTİK🚨 │ │ ₺45K     │ │ ₺89K     │ │ ₺32K     │
│ [→]      │ │ [→]      │ │ [→]      │ │ [→]      │ │ [→]      │ │ ✅       │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

Her kart tıklanınca sağ panel açılır:
- Şirket bilgisi + domain
- Risk skoru (renk kodlu)
- Aktif kontak
- Son aktivite
- Sonraki aksiyon
- Hızlı aksiyonlar: [Tara] [Teaser Gönder] [Arama Yap] [Not Ekle]
```

### 4.3 — Lead Üretim Sayfası

```
/admin-panel/isr/lead-gen

Sekmeler: [ Yeni Leadler | Tarama Kuyruğu | Kampanyalar | Ayarlar ]

─── YENİ LEADLER sekmesi ───────────────────────────────────
Filtreler: Lead Skor (min: 60) | Risk Seviyesi | Sektör | Tarih

Tablo:
Şirket      | Domain         | Skor  | Risk    | Kontak    | Aksiyon
─────────────────────────────────────────────────────────────────────
Acme Finans | acme.com.tr    | 87 🔥 | KRİTİK  | 2 bulundu | [CRM'e Ekle]
Beta Tech   | beta.io        | 74 🌡 | YÜKSEK  | 1 bulundu | [CRM'e Ekle]
Gamma Ltd   | gamma.com.tr   | 62   | ORTA    | Bulunamadı| [Manuel Ara]

[CRM'e Ekle] → Müşteri kaydı oluştur, deal aç, kontak ata

─── TARAMA KUYRUĞU sekmesi ─────────────────────────────────
Bekleyen: 234  |  Taranan: 1.847  |  Bugün eklenen: 47

Canlı ilerleme çubuğu + son tarama zamanı

─── KAMPANYALAR sekmesi ─────────────────────────────────────
Kampanya kartları:
[+ Yeni Kampanya]

Kart örneği:
┌─────────────────────────────────────────────────────┐
│ Q2 2026 — Finans & Sigorta Sektörü         [Aktif] │
│ Hedef: Finans, Sigorta | 50-500 çalışan             │
│ Şehirler: İstanbul, Ankara, İzmir                   │
│                                                      │
│ 847 domain bulundu | 634 tarandı | 89 lead           │
│ 12 CRM'e eklendi | 3 deal açıldı | 1 kazanıldı      │
│                                                      │
│ Kaynak: Apollo.io + Hunter.io                       │
│ [Düzenle] [Duraklat] [Detay]                       │
└─────────────────────────────────────────────────────┘

─── AYARLAR sekmesi ─────────────────────────────────────────
API Anahtarları:
  Apollo.io API Key:  [____________] [Test Et]
  Hunter.io API Key:  [____________] [Test Et]

Günlük Limitler:
  Apollo'dan çekilecek max şirket/gün:   [  100 ]
  Günlük taranacak max domain:           [   50 ]
  Kontak zenginleştirme max/gün:         [   20 ]

Lead Skor Eşiği:
  Otomatik CRM'e ekle (skor >):         [   80 ]
  Sabah raporuna dahil et (skor >):     [   60 ]
  Atla (skor <):                        [   30 ]
```

### 4.4 — Müşteri / Lead Detay Sayfası

```
/admin-panel/isr/customers/:id

Üst kısım:
[Şirket Logo Baş Harfi] Acme Finans A.Ş.
  Domain: acme.com.tr
  Sektör: Finans  |  ~100-200 çalışan  |  İstanbul
  Lead Kaynağı: Apollo.io (Q2 Finans Kampanyası)
  CRM'e Eklenme: 15 Mayıs 2026
  Atanan: [Sales Rep dropdown]

Sekmeler:
[ Genel Bakış | Kontaklar | Güvenlik Taraması | Aktiviteler | Teklifler | Sözleşme ]

─── GENEL BAKIŞ ────────────────────────────────────────────
Deal Aşaması: [Stage dropdown — Kanban ile senkron]
Tahmini Değer: ₺ [input]
Kapanma Tarihi: [date]
Sonraki Aksiyon: [text] [date]

─── KONTAKLAR ───────────────────────────────────────────────
[+ Kontak Ekle]  [Apollo'da Ara]  [Hunter'da Ara]  [LinkedIn Rehberi]

Kontak kartları:
┌──────────────────────────────────────────────────────┐
│ 👤 Ahmet Yılmaz          CFO           ⭐ Ana Kontak │
│ ahmet.yilmaz@acme.com.tr  Güven: Yüksek  Apollo     │
│ 0532 xxx xx xx  |  linkedin.com/in/...               │
│ [Arama Yap] [E-posta] [LinkedIn Mesajı]              │
└──────────────────────────────────────────────────────┘

─── GÜVENLİK TARAMASI ──────────────────────────────────────
[Yeniden Tara Butonu]  Son tarama: 3 gün önce

Risk Skoru: 87/100 🔴 KRİTİK
Lead Skoru: 74/100 🔥 Sıcak Lead

Kritik bulgular özeti (mini rapor görünümü)
[Teaser Rapor Oluştur →]

─── AKTİVİTELER ─────────────────────────────────────────────
[+ Aktivite Ekle]

Zaman çizelgesi:
● 15 Mayıs — Lead oluşturuldu (Apollo.io)
● 16 Mayıs — Domain tarandı [Risk: KRİTİK]
● 17 Mayıs — Teaser rapor gönderildi → ahmet.yilmaz@acme.com.tr
● 18 Mayıs — Teaser görüntülendi (14:32)
● 19 Mayıs — CTA tıklandı! 🔥 "Tam raporu talep ediyorum"
● 20 Mayıs — Ahmet Yılmaz arandı, demo için uygun [Ahmet K.]
● 23 Mayıs — Demo gerçekleşti — olumlu 🟢
● [+ Yeni Not/Aktivite Ekle]

─── AKTİVİTE EKLEME MODALI ─────────────────────────────────
Tür: ◉ Not  ○ Arama  ○ E-posta  ○ Meeting  ○ Demo  ○ Diğer
Konu: [_____________]
Açıklama: [textarea]
Sonuç: ○ Olumlu  ○ Nötr  ○ Olumsuz  ○ Cevap Yok
Sonraki Aksiyon: [text]  Tarih: [date]
```

### 4.5 — LinkedIn Yardımcısı Modali

```
"LinkedIn Rehberi" butonuna tıklandığında açılır:

─── LinkedIn Arama Rehberi ──────────────────────────────────
Şirket: Acme Finans A.Ş.

Claude Önerisi:
  Hedef Unvanlar (öncelik sırasıyla):
  1. CFO / Finans Direktörü
  2. IT/Teknoloji Direktörü
  3. Genel Müdür Yardımcısı

  LinkedIn Filtresi:
  Şirket: "Acme Finans" + Unvan: "CFO OR Finans Direktörü"

  Bağlantı Mesajı Şablonu:
  ┌────────────────────────────────────────────────────┐
  │ Merhaba [İsim],                                    │
  │                                                    │
  │ Finans sektöründeki siber güvenlik riskleri        │
  │ üzerine çalışıyorum. acme.com.tr için              │
  │ hazırladığımız kısa bir güvenlik taramasını        │
  │ paylaşmak isterim — 5 dakikanız var mı?            │
  │                                                    │
  │ İyi çalışmalar,                                    │
  └────────────────────────────────────────────────────┘
  [Kopyala]

  Takip Mesajı (3 gün sonra):
  ┌────────────────────────────────────────────────────┐
  │ Merhaba [İsim], bağlantı talebimi iletti mi?      │
  │ acme.com.tr güvenlik taramasında dikkat çekici    │
  │ bulgular var. Kısa bir değerlendirme raporunu     │
  │ e-posta ile iletebilirim.                         │
  └────────────────────────────────────────────────────┘
  [Kopyala]

Bulunan Kontak LinkedIn'den Ekle:
[İsim] [Unvan] [LinkedIn URL] [E-posta (opsiyonel)] [Kaydet]
─────────────────────────────────────────────────────────────
```

---

## BÖLÜM 5: SATIŞ RAPORLARI

```
/admin-panel/isr/reports

Sekmeler: [ Genel Bakış | Pipeline | Aktiviteler | Lead Üretimi | MRR ]

─── GENEL BAKIŞ ────────────────────────────────────────────
Dönem: [Bu Ay ▾]

KPI kartları:
Yeni Lead      Nitelikli     Kazanılan     Win Rate
   47             23              5           22%

MRR Katkısı    Pipeline      Ortalama Deal  Satış Döngüsü
  ₺32.500       ₺1.8M         ₺26.000        18 gün

Satış Temsilcisi Performansı:
  İsim       | Lead | Demo | Kazanılan | Gelir
  Ahmet K.   |  18  |   8  |     3     | ₺21K
  Mehmet S.  |  12  |   4  |     1     | ₺8K
  Ayşe T.    |   9  |   3  |     1     | ₺4K

─── LEAD ÜRETİMİ sekmesi ───────────────────────────────────
Kaynak bazında lead kalitesi:
  Apollo.io:   87 lead | Lead Skor ort: 64 | Won: 4
  Hunter.io:   23 lead | Lead Skor ort: 58 | Won: 1
  Inbound:     12 lead | Lead Skor ort: 71 | Won: 2

En iyi sektörler:
  Finans: 34% win rate
  Sağlık: 28% win rate
  E-ticaret: 12% win rate
```

---

## BÖLÜM 6: API ROTALARI (ISR)

```
─── MEVCUT ROTALARI KORU, ŞUNLARI EKLE ────────────────────

POST /api/isr/lead-gen/campaigns
     Yeni kampanya oluştur

GET  /api/isr/lead-gen/campaigns
     Aktif kampanyalar

POST /api/isr/lead-gen/campaigns/:id/pause
POST /api/isr/lead-gen/campaigns/:id/resume

GET  /api/isr/lead-gen/queue
     Tarama kuyruğu (filtreli)

POST /api/isr/lead-gen/queue/:id/import
     Lead'i CRM'e aktar
     → isr_customers kaydı oluştur
     → isr_deals kaydı aç (stage: new_lead)
     → Kontak zenginleştirme başlat

POST /api/isr/customers/:id/enrich/apollo
     Apollo'da kontak ara

POST /api/isr/customers/:id/enrich/hunter
     Hunter'da e-posta ara

POST /api/isr/customers/:id/enrich/linkedin-guide
     LinkedIn arama rehberi üret (Claude)

POST /api/isr/customers/:id/enrich/linkedin-manual
     Manuel LinkedIn kontağı kaydet

POST /api/isr/activities
     Aktivite kaydet (arama, not, meeting vs.)

GET  /api/isr/activities?customerId=X
     Müşteri aktivite geçmişi

GET  /api/isr/pipeline
     Pipeline özeti + stage dağılımı

GET  /api/isr/reports/summary
     Satış raporu özeti

GET  /api/isr/reports/lead-gen
     Lead üretim istatistikleri
```

---

## BÖLÜM 7: ENVIRONMENT VARIABLES EKLE

```
# .env dosyasına veya Replit Secrets'a ekle:
APOLLO_API_KEY=your_apollo_api_key
HUNTER_API_KEY=your_hunter_api_key
SALES_TEAM_EMAIL=satis@cyberstep.io

# Apollo.io günlük limit (API planına göre ayarla)
APOLLO_DAILY_COMPANY_LIMIT=100
APOLLO_DAILY_CONTACT_LIMIT=50

# Hunter.io günlük limit
HUNTER_DAILY_SEARCH_LIMIT=30

# Lead skoru eşikleri
LEAD_SCORE_AUTO_IMPORT=80
LEAD_SCORE_MORNING_REPORT=60
LEAD_SCORE_SKIP=30
```

---

## ÖZET — ISR MODÜLÜ YENİDEN YAPISI

```
ESKİ ISR (pasife alınmış)           YENİ ISR (aktif)
─────────────────────────────────    ──────────────────────────────────
Vendor/distributor odaklı           B2B Satış CRM
RFQ/teklif akışı                    Pipeline yönetimi (Kanban)
Manuel müşteri girişi               Otomatik lead üretimi (Apollo+Hunter)
IMAP inbox                          IMAP inbox (korunuyor)
Marj motoru                         Marj motoru (korunuyor)
                                    Lead Skorlama (Claude AI)
                                    LinkedIn Yardımcısı (yarı-otonom)
                                    Kontak zenginleştirme
                                    Aktivite takibi
                                    Sözleşme yönetimi entegrasyonu
                                    Satış raporları
                                    Günlük sabah lead raporu
```

---

*CyberStep.io ISR Modülü Tam Kurgu + Otomatik Lead Üretimi — Mayıs 2026*
