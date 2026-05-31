# CyberStep — AI Güvenlik Servisleri: Fiyatlandırma + Web Entegrasyonu + Replit Promptları
## Özellik 1: AI Phishing Simülasyonu | Özellik 4: AI Araç İzleme | Özellik 7: Politika Otogüncelleme

---

# BÖLÜM 1: FİYATLANDIRMA STRATEJİSİ

## Servis Fiyatları

| Servis | Standalone | Abonelik Dahil | Partner |
|---|---|---|---|
| AI Phishing Simülasyonu | 1.990 TL (tek seferlik) | Kurumsal + planında dahil | White-label 890 TL |
| AI Araç İzleme | 490 TL/ay | Büyüme planında dahil | Partner planında dahil |
| AI Politika Otogüncelleme | 990 TL/yıl (4 güncelleme) | Büyüme + planında dahil | White-label dahil |

## Paket: "CyberStep AI Koruma Paketi"

Üç servisi birlikte al, yüzde 30 indirim:
1.990 + (490×12) + 990 = 8.860 TL yıllık değer
Paket fiyatı: 5.990 TL/yıl

Bu paketi Büyüme planı üstüne eklenti olarak sun:
Büyüme (1.990 TL/ay) + AI Koruma Paketi (5.990 TL/yıl) = AI odaklı müşteri için tam çözüm

## Fiyat Konumlandırması

AI Phishing Simülasyonu için:
"Bir sosyal mühendislik danışmanı bu analizi 5.000-15.000 TL'ye yapar.
CyberStep otomatik olarak 1.990 TL'ye üretiyor."

AI Araç İzleme için:
"Her ay KVKK danışmanınızla AI politika değişikliklerini takip etmek
ortalama 2-4 saat iş gücü. Aylık 490 TL ile bu otomatik."

---

# BÖLÜM 2: WEB SAYFASINA VE HİZMETLERE EKLEME

## 2.1 Navigasyon Değişiklikleri

Mevcut navigasyon: Ana Sayfa | Araçlar | Değerlendirme | Fiyatlar | Blog

Yeni navigasyon önerisi:
Ana Sayfa | Araçlar ▼ | Değerlendirme ▼ | AI Güvenlik ▼ | Fiyatlar | Blog

"AI Güvenlik" dropdown menüsü:
- AI Risk Değerlendirmesi (/ai-guvenlik-degerlendirmesi) — mevcut servis
- AI Phishing Simülasyonu (/ai-phishing-simulasyonu) — YENİ
- AI Araç İzleme (/ai-arac-izleme) — YENİ
- AI Politika Yönetimi (/ai-politika) — YENİ
- AI Koruma Paketi (/ai-koruma-paketi) — Paket sayfası

## 2.2 Ana Sayfa Eklemeleri

Ana sayfaya "Yapay Zeka Çağında Yeni Tehditler" bölümü ekle.
Hero section altında, mevcut araçlar bölümünün üstüne gelecek.
3 kart yan yana:

Kart 1 — AI Phishing:
İkon: 🎭
Başlık: Sizi Hedef Alan AI E-postası Nasıl Görünür?
Açıklama: Saldırganlar artık şirketinizin kamuya açık verilerini AI ile analiz edip
kişiselleştirilmiş saldırı hazırlıyor. Sizin için nasıl görüneceğini gösterin.
CTA butonu: Simülasyonu Gör → /ai-phishing-simulasyonu

Kart 2 — AI İzleme:
İkon: 👁️
Başlık: Kullandığınız AI Araçları Bu Hafta Değişti mi?
Açıklama: ChatGPT, Gemini, Copilot... Gizlilik politikaları sürekli değişiyor.
Değişikliği siz öğrenmeden önce CyberStep size bildiriyor.
CTA butonu: İzlemeyi Başlat → /ai-arac-izleme

Kart 3 — AI Politika:
İkon: 📋
Başlık: AI Kullanım Politikanız Hâlâ Geçerli mi?
Açıklama: Yeni çıkan AI araçları, değişen KVKK rehberleri politikanızı geçersiz kılıyor.
Her çeyrek otomatik güncelleme — siz sadece imzalayın.
CTA butonu: Politikamı Güncelle → /ai-politika

## 2.3 Fiyatlandırma Sayfası Değişikliği

Mevcut fiyatlandırma sayfasına yeni sekme ekle:
"Temel Planlar | AI Güvenlik Servisleri | Tüm Özellikler"

AI Güvenlik Servisleri sekmesinde yukarıdaki fiyat tablosu gösterilir.
Sayfanın altında "AI Koruma Paketi" öne çıkan kart olarak.

## 2.4 Blog ve İçerik Entegrasyonu

Bu servislere özel içerik konuları (104 konu listesine ekle):
- "ChatGPT'nin Gizlilik Politikası Değişti: Şirketinizi Nasıl Etkiliyor?"
- "Gerçek Bir AI Phishing E-postası Nasıl Görünür? (Anonim Örnek)"
- "AB Yapay Zeka Yasası Türk Şirketlerini Nasıl Etkiliyor?"
- "Ses Kopyalama Teknolojisi ve CEO Dolandırıcılığı: Türkiye'den Vakalar"

## 2.5 Assessment Sonrası Upsell

Mevcut mini veya tam assessment raporunun altına şu bölüm ekle:

"Yapay Zeka Riskleri Henüz Değerlendirilmedi"

Küçük banner:
"Bu değerlendirme AI araç güvenliğini kapsamıyor.
Çalışanlarınızın ChatGPT'ye ne gönderdiğini biliyor musunuz?
[AI Güvenlik Değerlendirmesini Başlat →] — 2.900 TL"

---

# BÖLÜM 3: REPLIT AGENT PROMPTU — ÖZELLİK 1
# AI PHİSHİNG SİMÜLASYONU

---

## PROMPT BAŞLANGICI

Build a new "AI Phishing Simulation" module for CyberStep.io. This feature shows companies what a targeted AI-generated spear-phishing attack against them would look like, using their own public data. The goal is awareness, not actual attack — no emails are sent.

Existing stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React + Iyzico.

## DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS phishing_simulations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  
  -- Target info
  company_name varchar(255) NOT NULL,
  domain varchar(255) NOT NULL,
  contact_email varchar(255),
  sector varchar(100),
  employee_count varchar(50),
  
  -- OSINT data collected
  osint_data jsonb,
  -- {
  --   website_title, meta_description, technology_stack[],
  --   linkedin_employees[], social_media_handles{},
  --   public_email_patterns[], job_postings[],
  --   press_mentions[], domain_age, ssl_issuer,
  --   named_executives[], phone_numbers[]
  -- }
  
  -- Simulation scenarios
  scenarios jsonb,
  -- Array of 3 generated attack scenarios
  
  -- Status & payment
  status varchar(20) DEFAULT 'collecting',
  -- collecting | generating | ready | viewed
  payment_status varchar(20) DEFAULT 'unpaid',
  price_tl integer DEFAULT 1990,
  
  -- AI report
  report_json jsonb,
  pdf_path varchar(500),
  
  created_at timestamp DEFAULT now(),
  completed_at timestamp,
  viewed_at timestamp,
  
  -- Consent
  consent_accepted boolean DEFAULT false,
  consent_text text,
  consent_accepted_at timestamp
);

CREATE TABLE IF NOT EXISTS phishing_sim_osint_sources (
  id serial PRIMARY KEY,
  simulation_id integer REFERENCES phishing_simulations(id),
  source_type varchar(50),
  -- 'website' | 'linkedin' | 'social_media' | 'domain_scan' |
  -- 'job_posting' | 'press' | 'hibp' | 'whois'
  source_url text,
  data_found text,
  risk_contribution varchar(20),
  -- 'high' | 'medium' | 'low'
  created_at timestamp DEFAULT now()
);
```

## OSINT COLLECTION ENGINE

Create `src/services/osintCollector.ts`:

```typescript
import axios from 'axios';

interface OSINTData {
  // Website data
  websiteTitle: string;
  metaDescription: string;
  technologyStack: string[];
  // Detected via HTTP headers, meta tags, script sources
  
  // Domain data (from existing CyberStep scan)
  domainAge: number; // days
  sslIssuer: string;
  mxProvider: string; // Gmail, Outlook, custom?
  subdomains: string[];
  
  // Email patterns
  emailPatterns: string[];
  // Detected from website, job postings, breach data
  // e.g., ['firstname.lastname@domain.com', 'f.lastname@domain.com']
  
  // Public personnel data
  namedExecutives: string[];
  // From website "Hakkımızda", "Ekibimiz", LinkedIn
  
  // Social presence
  linkedinUrl: string;
  instagramHandle: string;
  twitterHandle: string;
  facebookUrl: string;
  youtubeChannel: string;
  
  // Recent activity
  jobPostings: string[];
  // From LinkedIn Jobs, Kariyer.net, Linkedin scrape (titles only)
  pressmentions: string[];
  // Recent news about the company
  
  // Risk indicators
  haveIBeenPwnedCount: number;
  // How many breaches for this domain
  
  // Vulnerability context (from existing CyberStep scan)
  openPorts: string[];
  knownCVEs: string[];
  spfConfigured: boolean;
  dmarcConfigured: boolean;
}

export async function collectOSINT(domain: string): Promise<OSINTData> {
  const results: Partial<OSINTData> = {};
  
  // 1. Website scraping
  try {
    const response = await axios.get(`https://${domain}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CyberStepBot/1.0)' }
    });
    
    // Extract title
    results.websiteTitle = response.data.match(/<title>(.*?)<\/title>/i)?.[1] || '';
    
    // Extract meta description
    results.metaDescription = response.data.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
    )?.[1] || '';
    
    // Detect technology stack from HTML
    results.technologyStack = detectTechStack(response.data, response.headers);
    
    // Extract email patterns from HTML
    const emailMatches = response.data.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    ) || [];
    results.emailPatterns = [...new Set(
      emailMatches
        .filter((e: string) => e.includes(domain))
        .slice(0, 5)
    )];
    
    // Look for named people
    results.namedExecutives = extractNamedPeople(response.data);
    
  } catch (e) {
    console.log(`Website scrape failed for ${domain}`);
  }
  
  // 2. WHOIS data (via whoisxml or direct)
  try {
    const whoisResp = await axios.get(
      `https://api.whoisxmlapi.com/v1?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${domain}&outputFormat=JSON`
    );
    const created = whoisResp.data.WhoisRecord?.createdDate;
    if (created) {
      results.domainAge = Math.floor(
        (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  } catch (e) {}
  
  // 3. HIBP domain check
  try {
    const hibpResp = await axios.get(
      `https://haveibeenpwned.com/api/v3/breacheddomain/${domain}`,
      { headers: { 'hibp-api-key': process.env.HIBP_API_KEY || '' } }
    );
    results.haveIBeenPwnedCount = hibpResp.data?.length || 0;
  } catch (e) {
    results.haveIBeenPwnedCount = 0;
  }
  
  // 4. Social media detection
  results.linkedinUrl = await detectLinkedIn(domain);
  results.instagramHandle = await detectInstagram(domain);
  
  // 5. Pull existing CyberStep scan data if available
  const existingScan = await getLatestDomainScan(domain);
  if (existingScan) {
    results.openPorts = existingScan.openPorts || [];
    results.spfConfigured = existingScan.spfConfigured;
    results.dmarcConfigured = existingScan.dmarcConfigured;
  }
  
  return results as OSINTData;
}

function detectTechStack(html: string, headers: Record<string, string>): string[] {
  const stack: string[] = [];
  
  // From HTML
  if (html.includes('wp-content')) stack.push('WordPress');
  if (html.includes('shopify')) stack.push('Shopify');
  if (html.includes('woocommerce')) stack.push('WooCommerce');
  if (html.includes('react')) stack.push('React');
  if (html.includes('gtm.js') || html.includes('googletagmanager')) stack.push('Google Tag Manager');
  if (html.includes('fbq(') || html.includes('facebook.net/en_US/fbevents')) stack.push('Facebook Pixel');
  
  // From headers
  const server = headers['server'] || '';
  if (server.includes('Apache')) stack.push('Apache');
  if (server.includes('nginx')) stack.push('Nginx');
  if (server.includes('Microsoft-IIS')) stack.push('IIS');
  
  const powered = headers['x-powered-by'] || '';
  if (powered.includes('PHP')) stack.push(`PHP ${powered.split('/')[1] || ''}`);
  if (powered.includes('ASP.NET')) stack.push('ASP.NET');
  
  return [...new Set(stack)];
}

function extractNamedPeople(html: string): string[] {
  // Simple regex for Turkish name patterns near executive keywords
  const keywords = ['Genel Müdür', 'CEO', 'Kurucu', 'Yönetim Kurulu', 'Direktör', 'Müdür'];
  const names: string[] = [];
  
  for (const keyword of keywords) {
    const pattern = new RegExp(`([A-ZÇĞİÖŞÜ][a-zçğışöüa-z]+ [A-ZÇĞİÖŞÜ][a-zçğışöüa-z]+).*${keyword}`, 'g');
    const matches = html.match(pattern);
    if (matches) names.push(...matches.slice(0, 3));
  }
  
  return [...new Set(names)].slice(0, 5);
}
```

## SCENARIO GENERATION — CLAUDE PROMPT

Create `src/services/phishingScenarioGenerator.ts`:

```typescript
export async function generatePhishingScenarios(
  osintData: OSINTData,
  companyName: string,
  domain: string,
  sector: string
): Promise<PhishingScenario[]> {
  
  const prompt = `
Sen bir etik siber güvenlik araştırmacısısın.
Aşağıdaki şirkete yönelik gerçekçi spear-phishing senaryoları üreteceksin.

AMAÇ: Bu şirketin yöneticilerine ve çalışanlarına FARKINDALIK YARATMAK.
E-postalar gönderilmeyecek. Sadece "böyle görünürdü" gösterimi.

ŞİRKET: ${companyName}
DOMAIN: ${domain}
SEKTÖR: ${sector}

TOPLANMIŞ KAMUYA AÇIK VERİLER:
Web sitesi başlığı: ${osintData.websiteTitle}
Tespit edilen teknolojiler: ${osintData.technologyStack.join(', ')}
Kamuya açık isimler: ${osintData.namedExecutives.join(', ') || 'Tespit edilmedi'}
E-posta formatı: ${osintData.emailPatterns[0] || `info@${domain}`}
Domain yaşı: ${osintData.domainAge} gün
Veri ihlali geçmişi: ${osintData.haveIBeenPwnedCount} ihlal
SPF kaydı: ${osintData.spfConfigured ? 'Var' : 'Yok (taklit riski!)'}
DMARC kaydı: ${osintData.dmarcConfigured ? 'Var' : 'Yok (taklit riski!)'}

3 FARKLI SENARYO ÜRET:

Senaryo 1: CEO Dolandırıcılığı (BEC - Business Email Compromise)
Senaryo 2: IT Destek Kimlik Avı (Parola/MFA ele geçirme)
Senaryo 3: Tedarikçi/Fatura Sahteciliği

Her senaryo için JSON formatında:
{
  "scenario_id": 1,
  "attack_type": "CEO Dolandırıcılığı",
  "attack_type_icon": "💼",
  "why_effective": "Bu şirkete neden özellikle etkili olur (1-2 cümle, şirkete özgü)",
  "public_data_used": ["Hangi kamuya açık veri kullanıldı"],
  "email": {
    "from_display": "Ahmet Yılmaz <ahmet.yilmaz@${domain.replace('.', '-')}.net>",
    "to": "muhasebe@${domain}",
    "subject": "Acil - Bugün Havale Gerekiyor",
    "body": "Gerçekçi Türkçe e-posta metni (8-12 satır). Şirketin gerçek bağlamını kullan. İmza dahil.",
    "manipulation_technique": "Hangi psikolojik manipülasyon kullanıldı (aciliyet/otorite/korku)"
  },
  "red_flags": ["Bu e-postada dikkat edilmesi gereken ipuçları"],
  "if_successful": "Saldırı başarılı olursa ne olur (somut hasar)",
  "prevention": "Bu saldırıyı engelleyen tek teknik veya prosedürel önlem"
}

ÖNEMLİ KURALLAR:
- Gerçek banka hesap numarası veya IBAN kullanma
- Gerçek TC kimlik numarası kullanma  
- Şirketin gerçek çalışan isimlerini kullan (kamuya açıksa)
- E-postalar GERÇEKÇI ama açıkça simülasyon olduğu belli olmalı
- Her senaryonun sonuna "⚠️ BU BİR SİMÜLASYONDUR" damgası ekle
- Sadece JSON array döndür
`;

  const response = await callClaude(prompt, 'claude-sonnet-4-20250514');
  return JSON.parse(response);
}
```

## API ROUTES

```typescript
// POST /api/phishing-sim/start
// Requires: consent checkbox + payment or subscription check
// Creates simulation record, starts OSINT collection async

// GET /api/phishing-sim/:id/status
// Returns: status (collecting/generating/ready) + progress percentage

// GET /api/phishing-sim/:id/report
// Returns: full report with scenarios (only if payment confirmed)

// GET /api/phishing-sim/:id/pdf
// Download PDF report

// POST /api/phishing-sim/:id/view-confirm
// Mark as viewed, record timestamp
```

## FRONTEND PAGES

### Landing Page (`/ai-phishing-simulasyonu`)

```
┌──────────────────────────────────────────────────────┐
│  🎭 AI ile Sizi Hedef Alan Saldırı Böyle Görünür     │
│                                                       │
│  Saldırganlar artık şirketinizin web sitesini,       │
│  LinkedIn profilini ve kamuya açık verilerini         │
│  yapay zeka ile analiz edip, çalışanlarınıza özel    │
│  e-postalar hazırlıyor.                              │
│                                                       │
│  CyberStep, sizi hedef alan bir saldırının            │
│  nasıl görüneceğini 3 farklı senaryoyla gösteriyor.  │
│                                                       │
│  ─────────────────────────────────────────────────   │
│  Simülasyon neyi içerir?                             │
│                                                       │
│  🔍 Kamuya açık verilerinizin analizi                │
│  📧 3 gerçekçi spear-phishing senaryosu              │
│  💼 CEO Dolandırıcılığı simülasyonu                  │
│  🔑 IT Destek kimlik avı senaryosu                   │
│  🧾 Tedarikçi/Fatura sahteciliği senaryosu          │
│  🛡️ Her senaryo için koruma yöntemi                 │
│  ─────────────────────────────────────────────────   │
│                                                       │
│  Fiyat: 1.990 TL                                     │
│  Süre: ~10 dakika (AI analiz süresi)                 │
│                                                       │
│  [Domain Adresinizi Girin ve Başlayın →]             │
│                                                       │
│  ⚠️ Bu araç yalnızca farkındalık amaçlıdır.         │
│  Hiçbir e-posta gönderilmez.                        │
└──────────────────────────────────────────────────────┘
```

### Consent & Input Page

Before starting, show:
- Domain input field
- Company name input
- Sector dropdown
- Contact email (for report delivery)
- Consent checkbox (required):
  "Bu simülasyonun yalnızca farkındalık amaçlı olduğunu ve hiçbir
   gerçek saldırı veya e-posta gönderimi yapılmayacağını anlıyorum.
   Simülasyonda kullanılan veriler kamuya açık kaynaklardan alınacak."

### Processing Screen

Show animated progress with steps:
```
🔍 Kamuya açık veriler toplanıyor... ✅
🌐 Web sitesi analiz ediliyor... ✅
📊 Teknoloji altyapısı tespit ediliyor... ✅
🤖 AI saldırı senaryoları oluşturuluyor... ⏳
📄 Rapor hazırlanıyor... ○
```
Show estimated time: "~3-5 dakika"

### Report Page (`/ai-phishing-simulasyonu/:id/rapor`)

**Header:** Big warning banner:
```
⚠️ SİMÜLASYON RAPORU — GERÇEK E-POSTALAR GÖNDERİLMEDİ
Bu rapor yalnızca farkındalık amaçlıdır.
```

**OSINT Özeti bölümü:**
"Şirketiniz hakkında 5 dakikada kamuya açık kaynaklardan
toplanan veriler:"
- Grid of found data points (website info, names, tech stack, breach count)
- "Bir saldırgan bu bilgilere 5 dakikada ulaşabilir" uyarısı

**3 Senaryo Kartı:**
Each card:
- Attack type badge + icon
- "Neden sizi hedef alır" kısmı (company-specific explanation)
- The simulated email (styled as email client, with FROM/TO/SUBJECT fields)
- Red flags highlighted in the email text
- "Bu olursa ne olur" section
- "Nasıl engellenir" section (green box)

**Bottom CTA:**
"Bu senaryolardan korunmak için tam güvenlik değerlendirmesi yaptırın
→ Tam Değerlendirme (5.990 TL)"

## IMPORTANT: ETHICAL SAFEGUARDS

Add these safeguards in the backend:

```typescript
// Rate limiting: max 1 simulation per domain per 30 days
// Log all simulations with IP address for audit
// Never store actual generated emails in a queryable way
// Add watermark to all generated emails: "⚠️ CyberStep Simülasyonu"
// Block simulation for certain domain types:
const BLOCKED_DOMAINS = [
  '.gov.tr',   // Government
  '.edu.tr',   // Education
  '.mil.tr'    // Military
];
```

---

# BÖLÜM 4: REPLIT AGENT PROMPTU — ÖZELLİK 4
# SÜREKLİ AI ARAÇ İZLEME SERVİSİ

---

## PROMPT BAŞLANGICI

Build an "AI Tool Monitoring" subscription service for CyberStep.io. This service watches AI tools' privacy policies for changes and alerts customers when tools they use have been updated.

Existing stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React.
The ai_tools_registry table already exists (from previous AI Security module).

## DATABASE SCHEMA

```sql
-- Track policy versions for each AI tool
CREATE TABLE IF NOT EXISTS ai_tool_policy_snapshots (
  id serial PRIMARY KEY,
  tool_id integer REFERENCES ai_tools_registry(id),
  snapshot_date date NOT NULL,
  
  -- Policy data at this point in time
  data_retention_days integer,
  trains_on_user_data boolean,
  trains_optout_available boolean,
  kvkk_compatible boolean,
  dpa_available boolean,
  risk_level varchar(20),
  risk_summary text,
  recommendation text,
  
  -- Change tracking
  is_changed boolean DEFAULT false,
  -- Compared to previous snapshot
  change_summary text,
  -- AI-generated summary of what changed
  change_severity varchar(20),
  -- 'critical' | 'important' | 'minor'
  
  created_at timestamp DEFAULT now()
);

-- Customer AI tool monitoring subscriptions
CREATE TABLE IF NOT EXISTS ai_monitoring_subscriptions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  
  -- Which tools to monitor
  monitored_tool_ids integer[],
  -- References to ai_tools_registry
  
  -- From their AI Security Assessment (if completed)
  ai_assessment_id integer REFERENCES ai_assessments(id),
  -- Auto-populate monitored tools from assessment
  
  -- Subscription details
  status varchar(20) DEFAULT 'active',
  -- active | paused | cancelled
  started_at timestamp DEFAULT now(),
  next_billing_date date,
  price_tl integer DEFAULT 490,
  -- monthly
  
  -- Notification preferences
  notify_email boolean DEFAULT true,
  notify_whatsapp boolean DEFAULT false,
  whatsapp_number varchar(20),
  
  -- Alert thresholds
  alert_on_critical boolean DEFAULT true,
  alert_on_important boolean DEFAULT true,
  alert_on_minor boolean DEFAULT false,
  
  created_at timestamp DEFAULT now()
);

-- Alert log
CREATE TABLE IF NOT EXISTS ai_monitoring_alerts (
  id serial PRIMARY KEY,
  subscription_id integer REFERENCES ai_monitoring_subscriptions(id),
  customer_id integer REFERENCES customers(id),
  tool_id integer REFERENCES ai_tools_registry(id),
  snapshot_id integer REFERENCES ai_tool_policy_snapshots(id),
  
  alert_type varchar(20),
  -- 'policy_change' | 'risk_increase' | 'risk_decrease' | 'new_tool'
  severity varchar(20),
  title text,
  summary text,
  -- Turkish, non-technical
  recommendation text,
  
  sent_at timestamp,
  email_opened_at timestamp,
  
  created_at timestamp DEFAULT now()
);
```

## POLICY CHANGE DETECTION ENGINE

Create `src/services/aiToolMonitor.ts`:

```typescript
export async function checkToolForChanges(toolId: number): Promise<void> {
  const tool = await getToolById(toolId);
  const latestSnapshot = await getLatestSnapshot(toolId);
  
  // Compare current registry data with last snapshot
  const changes: string[] = [];
  
  if (latestSnapshot) {
    if (tool.data_retention_days !== latestSnapshot.data_retention_days) {
      changes.push(`Veri saklama süresi değişti: ${latestSnapshot.data_retention_days} gün → ${tool.data_retention_days} gün`);
    }
    if (tool.trains_on_user_data !== latestSnapshot.trains_on_user_data) {
      changes.push(tool.trains_on_user_data
        ? 'Artık kullanıcı verisi eğitim için kullanılıyor'
        : 'Artık eğitim için kullanıcı verisi kullanılmıyor'
      );
    }
    if (tool.kvkk_compatible !== latestSnapshot.kvkk_compatible) {
      changes.push(tool.kvkk_compatible
        ? 'KVKK uyumluluğu arttı'
        : 'KVKK uyumluluğu azaldı'
      );
    }
    if (tool.risk_level !== latestSnapshot.risk_level) {
      changes.push(`Risk seviyesi değişti: ${latestSnapshot.risk_level} → ${tool.risk_level}`);
    }
  }
  
  if (changes.length > 0 || !latestSnapshot) {
    // Determine severity
    const severity = determineSeverity(changes, tool, latestSnapshot);
    
    // Generate AI summary of changes
    const changeSummary = await generateChangeSummary(tool, changes, severity);
    
    // Save snapshot
    await saveSnapshot(toolId, tool, changes, changeSummary, severity);
    
    // Trigger alerts for subscribed customers
    await triggerAlerts(toolId, changes, changeSummary, severity);
  }
}

async function generateChangeSummary(
  tool: AITool,
  changes: string[],
  severity: string
): Promise<string> {
  const prompt = `
${tool.tool_name} yapay zeka aracının gizlilik politikasında değişiklik tespit edildi.

Değişiklikler:
${changes.join('\n')}

Bu değişikliği Türk KOBİ patronuna anlatan 2-3 cümlelik özet yaz.
Teknik terim kullanma. Şu soruyu yanıtla: "Bu beni nasıl etkiler?"
Eğer risk artıyorsa açıkça belirt.
`;
  return await callClaude(prompt);
}

function determineSeverity(
  changes: string[],
  tool: AITool,
  prev: AIToolSnapshot | null
): string {
  if (!prev) return 'minor'; // First snapshot, just log
  
  // Critical: risk level went up, or training on data started
  if (
    (prev.risk_level === 'DUSUK' && tool.risk_level === 'KRITIK') ||
    (!prev.trains_on_user_data && tool.trains_on_user_data)
  ) return 'critical';
  
  // Important: any risk increase, retention increase
  if (
    changes.some(c => c.includes('risk') || c.includes('saklama süresi'))
  ) return 'important';
  
  return 'minor';
}
```

## CRON JOB

```typescript
// Check all active tools weekly — Sunday 02:00
cron.schedule('0 2 * * 0', async () => {
  const activeTools = await getActiveTools();
  for (const tool of activeTools) {
    await checkToolForChanges(tool.id);
    await sleep(1000); // Rate limiting
  }
  console.log(`AI tool check complete: ${activeTools.length} tools checked`);
});

// Send weekly digest to subscribed customers — Monday 08:00
cron.schedule('0 8 * * 1', async () => {
  await sendWeeklyAIMonitoringDigests();
});
```

## ALERT EMAIL TEMPLATE

Subject: "⚠️ [ToolName] Gizlilik Politikası Değişti — Şirketinizi Etkiliyor"

```html
Sayın [Müşteri Adı],

[ToolName] yapay zeka aracının gizlilik politikasında değişiklik tespit edildi.

━━━━━━━━━━━━━━━━━━━━━━━
[KIRMIZI KUTU — Kritik için]
Önem Seviyesi: KRİTİK
[/KIRMIZI KUTU]

Ne değişti:
[changeSummary — AI üretimi, Türkçe, teknik olmayan]

Bu sizin için ne anlama geliyor:
[business_impact — KVKK riski veya operasyonel etki]

Önerilen aksiyon:
[recommendation]

━━━━━━━━━━━━━━━━━━━━━━━
Detaylar için: cyberstep.io/ai-arac-izleme

Bildirim tercihlerinizi değiştirmek için:
cyberstep.io/hesabim/bildirimler
```

## API ROUTES

```
GET  /api/ai-monitoring/subscription         — Get my subscription
POST /api/ai-monitoring/subscription         — Create subscription
PUT  /api/ai-monitoring/subscription         — Update (tools, preferences)
DELETE /api/ai-monitoring/subscription       — Cancel

GET  /api/ai-monitoring/alerts               — My alert history
GET  /api/ai-monitoring/tools                — My monitored tools with latest status
GET  /api/ai-monitoring/tools/:id/history    — Policy change history for a tool
GET  /api/ai-monitoring/dashboard            — Overview of all monitored tools

Admin:
GET  /api/admin/ai-monitoring/stats          — Subscription stats
PUT  /api/admin/ai-tools/:id                 — Update tool profile (triggers change detection)
POST /api/admin/ai-monitoring/check-all      — Manual trigger for all tools
```

## FRONTEND PAGES

### Dashboard (`/ai-arac-izleme`)

```
┌─────────────────────────────────────────────────────┐
│  👁️ AI Araç İzleme Paneli                          │
│                                             490TL/ay │
├─────────────────────────────────────────────────────┤
│  Bu hafta 2 araçta değişiklik tespit edildi         │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔴 KRİTİK    ChatGPT Ücretsiz              │   │
│  │   Veri saklama süresi 30→90 güne çıktı    │   │
│  │   3 gün önce    [Detay] [Aksiyon Al]       │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟡 ÖNEMLİ   DeepL Ücretsiz                │   │
│  │   Gizlilik politikası güncellendi          │   │
│  │   5 gün önce    [Detay]                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  İzlenen Araçlar (7):                               │
│  ✅ ChatGPT Enterprise — Risk: ORTA  [Son kontrol: Bugün]│
│  ✅ Microsoft Copilot — Risk: DÜŞÜK  [Son kontrol: Bugün]│
│  ✅ DeepL Pro — Risk: DÜŞÜK          [Son kontrol: Bugün]│
│  ⚠️ ChatGPT Ücretsiz — Risk: KRİTİK [DEĞİŞTİ]     │
│  ...                                                 │
│                                                      │
│  [+ Araç Ekle]   [Bildirim Ayarları]               │
└─────────────────────────────────────────────────────┘
```

### Tool Detail Modal

When clicking a tool:
- Full risk profile
- Change history timeline
- "Bu araç için aksiyon al" button
- Link to DPA template if available

---

# BÖLÜM 5: REPLIT AGENT PROMPTU — ÖZELLİK 7
# AI POLİTİKA OTOMATİK GÜNCELLEME SERVİSİ

---

## PROMPT BAŞLANGICI

Build an "AI Policy Auto-Update" service for CyberStep.io. This service automatically generates updated AI usage policy documents every quarter when AI tool policies change, so companies always have a current, KVKK-compliant policy.

Existing tables: ai_tools_registry, ai_assessments, customers, ai_monitoring_subscriptions.

## DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS ai_policy_documents (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  
  -- Version info
  version integer DEFAULT 1,
  -- Increments each time policy is regenerated
  version_label varchar(20),
  -- e.g., "v1.0", "v2.0 - Q2 2026 Güncellemesi"
  
  -- Policy content
  policy_text text NOT NULL,
  -- Full policy document in Turkish
  policy_html text,
  -- HTML formatted version
  pdf_path varchar(500),
  docx_path varchar(500),
  
  -- Tools this policy covers
  covered_tool_ids integer[],
  
  -- Generation metadata
  generated_at timestamp DEFAULT now(),
  generation_reason varchar(100),
  -- 'initial' | 'quarterly_update' | 'tool_change' | 'manual_request'
  triggered_by_tool_ids integer[],
  -- Which tool changes triggered this update
  
  -- Status
  status varchar(20) DEFAULT 'draft',
  -- draft | approved | superseded
  approved_at timestamp,
  approved_by_email varchar(255),
  
  -- Diff from previous version
  changes_summary text,
  -- AI-generated summary of what changed vs last version
  changed_sections text[],
  -- Which sections were modified
  
  -- Subscription
  subscription_active boolean DEFAULT true,
  next_update_date date,
  
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_policy_subscriptions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  
  status varchar(20) DEFAULT 'active',
  
  -- Billing
  plan varchar(20) DEFAULT 'annual',
  -- 'quarterly' (990 TL/yıl) | 'annual' (990 TL/yıl)
  price_tl integer DEFAULT 990,
  billing_cycle varchar(20) DEFAULT 'annual',
  started_at timestamp DEFAULT now(),
  next_billing_date date,
  
  -- Auto-update settings
  auto_generate boolean DEFAULT true,
  -- Generate automatically when tools change
  require_approval boolean DEFAULT true,
  -- Require customer approval before "publishing"
  approval_email varchar(255),
  -- Who approves new policy versions
  
  -- Notification
  notify_on_update boolean DEFAULT true,
  notify_on_tool_change boolean DEFAULT true,
  
  created_at timestamp DEFAULT now()
);
```

## POLICY GENERATION ENGINE

Create `src/services/policyGenerator.ts`:

```typescript
export async function generatePolicyDocument(
  customerId: number,
  reason: string,
  triggeredByToolIds: number[] = []
): Promise<AIPolicyDocument> {
  
  // Get customer's tool list
  const subscription = await getMonitoringSubscription(customerId);
  const tools = await getToolsByIds(subscription.monitored_tool_ids);
  const customer = await getCustomer(customerId);
  const assessment = await getLatestAIAssessment(customerId);
  
  // Get previous policy for diff
  const previousPolicy = await getLatestPolicy(customerId);
  
  // Categorize tools by risk
  const criticalTools = tools.filter(t => t.risk_level === 'KRITIK');
  const highRiskTools = tools.filter(t => t.risk_level === 'YUKSEK');
  const approvedTools = tools.filter(t =>
    ['DUSUK', 'ORTA'].includes(t.risk_level)
  );
  
  const prompt = `
Sen deneyimli bir KVKK hukuk danışmanısın ve siber güvenlik uzmanısın.
Aşağıdaki şirket için "Yapay Zeka Araçları Kabul Edilebilir Kullanım Politikası" hazırla.

ŞİRKET BİLGİLERİ:
Şirket adı: ${customer.companyName}
Sektör: ${customer.sector}
Çalışan sayısı: ${customer.employeeCount}
Politika tarihi: ${new Date().toLocaleDateString('tr-TR')}

ONAYLANAN AI ARAÇLARI (kullanılabilir):
${approvedTools.map(t => `- ${t.tool_name} (${t.provider}): ${t.recommendation}`).join('\n')}

KISITLI ARAÇLAR (sadece kurumsal plan ile):
${highRiskTools.map(t => `- ${t.tool_name}: ${t.risk_summary}`).join('\n')}

YASAKLI ARAÇLAR:
${criticalTools.map(t => `- ${t.tool_name}: ${t.risk_summary}`).join('\n')}

KVKK BAĞLAMI:
- Bu şirket KVKK kapsamında veri işleyen bir firmadır
- AI araçlarına kişisel veri girişi yurt dışı aktarım sayılır (KVKK Md.9)
- Özel nitelikli veri girişi kesinlikle yasaktır

Politika şu bölümleri içermeli:

1. AMAÇ VE KAPSAM
   Bu politikanın amacı ve hangi çalışanları kapsadığı

2. TANIMLAR
   - Yapay zeka aracı nedir
   - Kişisel veri nedir (KVKK tanımı)
   - Özel nitelikli kişisel veri nedir

3. ONAYLANAN ARAÇLAR VE KULLANIM KOŞULLARI
   Her onaylı araç için: kullanım amacı, sınırlamalar, zorunlu ayarlar

4. YASAK UYGULAMALAR
   Kesinlikle yapılmaması gerekenler (liste formatında, net ve anlaşılır)
   - Kişisel veri girişi
   - Finansal veri girişi  
   - Gizli belge yükleme
   - Ses ve görüntü yükleme
   - Sözleşme ve teklif metni paylaşımı

5. KVKK YÜKÜMLÜLÜKLERİ
   - Yurt dışı aktarım bilinci
   - Açık rıza gereklilikleri
   - VERBİS güncellemesi

6. ÇALIŞAN SORUMLULUKLARI VE YETKİLENDİRME

7. İHLAL DURUMUNDA PROSEDÜR
   - Bildirme kanalı
   - 72 saatlik KVKK bildirimi

8. POLİTİKA GÜNCELLEME
   "Bu politika CyberStep.io AI İzleme Servisi tarafından otomatik olarak güncellenmektedir."

FORMAT GEREKLİLİKLERİ:
- Türkçe, anlaşılır dil (lise mezunu anlayabilmeli)
- Hukuki ama erişilebilir
- İmzalanmaya hazır format
- Her bölüm numaralı
- Yürürlük tarihi: bugün
- Toplam 700-900 kelime

SADECE POLİTİKA METNİNİ DÖNDÜR, başka açıklama ekleme.
`;

  const policyText = await callClaude(prompt);
  
  // Generate diff summary if previous version exists
  let changesSummary = 'İlk versiyon';
  let changedSections: string[] = [];
  
  if (previousPolicy) {
    const diffPrompt = `
Önceki politika:
${previousPolicy.policy_text}

Yeni politika:
${policyText}

Bu iki politika arasındaki farkları özetle:
1. Hangi bölümler değişti?
2. En önemli değişiklik nedir?
3. Çalışanlar için ne değişti?

Türkçe, 3-4 cümle, yönetici özeti formatında.
Sadece özet metni döndür.
`;
    changesSummary = await callClaude(diffPrompt);
    changedSections = detectChangedSections(previousPolicy.policy_text, policyText);
  }
  
  // Save to database
  const newVersion = (previousPolicy?.version || 0) + 1;
  const doc = await savePolicyDocument({
    customerId,
    version: newVersion,
    versionLabel: `v${newVersion}.0 — ${getQuarterLabel()}`,
    policyText,
    coveredToolIds: tools.map(t => t.id),
    reason,
    triggeredByToolIds,
    changesSummary,
    changedSections
  });
  
  // Generate PDF and DOCX
  await generatePDFFromPolicy(doc.id, policyText, customer);
  await generateDOCXFromPolicy(doc.id, policyText, customer);
  
  return doc;
}

function getQuarterLabel(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter} ${now.getFullYear()} Güncellemesi`;
}
```

## TRIGGER LOGIC

```typescript
// Quarterly auto-generation — 1st of Jan, Apr, Jul, Oct at 03:00
cron.schedule('0 3 1 1,4,7,10 *', async () => {
  const activeSubscriptions = await getActivePolicySubscriptions();
  for (const sub of activeSubscriptions) {
    if (sub.auto_generate) {
      await generatePolicyDocument(sub.customer_id, 'quarterly_update');
      await notifyCustomerOfNewPolicy(sub.customer_id, 'quarterly_update');
    }
  }
});

// Trigger on significant tool change
export async function onSignificantToolChange(
  toolId: number,
  severity: string
): Promise<void> {
  if (severity !== 'critical' && severity !== 'important') return;
  
  // Find all subscribed customers who monitor this tool
  const affectedCustomers = await getCustomersMonitoringTool(toolId);
  
  for (const customerId of affectedCustomers) {
    const policySub = await getPolicySubscription(customerId);
    if (policySub?.auto_generate) {
      await generatePolicyDocument(
        customerId,
        'tool_change',
        [toolId]
      );
    }
  }
}
```

## NOTIFICATION EMAIL

Subject: "📋 AI Kullanım Politikanız Güncellendi — v[X] Hazır"

```
Sayın [Müşteri Adı],

Şirketinizin Yapay Zeka Kullanım Politikası otomatik olarak güncellendi.

Güncelleme nedeni: [quarterly_update → "Çeyreklik otomatik güncelleme" |
                    tool_change → "[Araç adı] gizlilik politikası değişti"]

Bu versiyonda ne değişti:
[changes_summary — Türkçe, 2-3 cümle]

━━━━━━━━━━━━━━━━━━━━━━━
Yapmanız gereken:
1. Politikayı inceleyin
2. Onaylayın (varsa küçük düzenlemeler yapın)  
3. Çalışanlarınıza dağıtın ve imzalatın

[Politikayı İncele ve Onayla →]
[PDF İndir]  [Word Dosyası İndir]

━━━━━━━━━━━━━━━━━━━━━━━
CyberStep AI Politika Servisi
Bir sonraki otomatik güncelleme: [tarih]
```

## API ROUTES

```
GET  /api/ai-policy/current              — Get latest policy version
GET  /api/ai-policy/versions             — All policy versions
GET  /api/ai-policy/:id                  — Specific version
GET  /api/ai-policy/:id/pdf              — Download PDF
GET  /api/ai-policy/:id/docx             — Download Word
POST /api/ai-policy/:id/approve          — Approve current draft
POST /api/ai-policy/generate             — Manual generation trigger
GET  /api/ai-policy/subscription         — Get policy subscription
POST /api/ai-policy/subscription         — Create subscription
PUT  /api/ai-policy/subscription         — Update preferences

Admin:
GET  /api/admin/ai-policy/stats          — All subscriptions, generation counts
POST /api/admin/ai-policy/trigger-all    — Trigger quarterly for all customers
```

## FRONTEND PAGES

### Policy Management Page (`/ai-politika`)

**Tabs: Güncel Politika | Versiyon Geçmişi | Abonelik Ayarları**

**Güncel Politika tab:**

```
┌────────────────────────────────────────────────────────┐
│  📋 Yapay Zeka Kullanım Politikası                     │
│  v3.0 — Q2 2026 Güncellemesi      [ONAYLANDI ✅]      │
│  Son güncelleme: 15 Nisan 2026                         │
│                                                         │
│  Bu versiyonda değişenler:                             │
│  "ChatGPT güncellemesi nedeniyle ücretsiz sürüm        │
│   yasaklı araçlar listesine eklendi."                  │
│                                                         │
│  [PDF İndir] [Word İndir] [Çalışanlara Gönder]        │
│                                                         │
│  ── Politika Önizleme ──────────────────────────────   │
│  [Politika metninin ilk 300 karakteri...]              │
│  [Tamamını Görüntüle ↓]                               │
│                                                         │
│  Bir sonraki otomatik güncelleme: 1 Temmuz 2026        │
│  Abonelik: Aktif (990 TL/yıl)                         │
└────────────────────────────────────────────────────────┘
```

**Versiyon Geçmişi tab:**
Timeline showing all previous versions with:
- Version number and date
- What changed (AI summary)
- Download buttons

**Landing Page (`/ai-politika` unauthenticated):**

```
┌────────────────────────────────────────────────────────┐
│  📋 AI Politika Otomatik Güncelleme                   │
│                                                         │
│  "KVKK uyumlu yapay zeka politikanız                  │
│   her çeyrek otomatik güncelleniyor.                   │
│   Siz sadece imzalayın."                              │
│                                                         │
│  ✓ İlk kurulumda şirketinize özel politika            │
│  ✓ AI araçları değişince otomatik güncelleme          │
│  ✓ PDF + Word formatında indirme                      │
│  ✓ Çalışanlara e-posta ile gönderme                   │
│  ✓ KVKK Madde 9 ve 12 uyumlu                         │
│  ✓ Değişiklik özeti ile "ne değişti" açıklaması      │
│                                                         │
│  Fiyat: 990 TL/yıl (4 otomatik güncelleme)           │
│                                                         │
│  [Politikamı Oluştur →]                               │
│                                                         │
│  Normal danışmanlık maliyeti: 3.000-8.000 TL/yıl     │
└────────────────────────────────────────────────────────┘
```

## DOCX GENERATION

For Word document output, use the `docx` npm package:

```typescript
import { Document, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';

export async function generateDOCX(
  policyText: string,
  companyName: string,
  version: string
): Promise<Buffer> {
  // Parse policy text sections
  const sections = parsePolicySections(policyText);
  
  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({
          text: `${companyName}`,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: 'YAPAY ZEKA ARAÇLARI KABUL EDİLEBİLİR KULLANIM POLİTİKASI',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: version }),
        // ... sections
      ]
    }]
  });
  
  return await Packer.toBuffer(doc);
}
```

---

# BÖLÜM 6: ÜÇÜNÜ BİRDEN BAĞLAYAN ENTEGRASYONlar

## Servis Akışı

```
AI Phishing Simülasyonu
  ↓ tamamlanınca
"AI Araç İzleme'ye geçin — kullandığınız
 araçlardaki değişiklikleri takip edin"
  ↓ izleme başlayınca
"Araç değiştiğinde politikanızı otomatik güncelleyin"
  ↓ politika aboneliği
Kapalı döngü: İzle → Değişiklik tespit et → Politikayı güncelle → Bildir

Her üç servis birbirinin doğal upsell'i.
```

## Tek Kullanıcı Deneyimi

Müşteri `/ai-phishing-simulasyonu` sayfasına gelir, simülasyonu görür.
Rapor sayfasının altında: "Kullandığınız araçları izlemeye başlayın"
→ AI Araç İzleme aboneliği (490 TL/ay)

İzleme panelinde araç değişince: "Politikanızı güncellemeniz gerekiyor"
→ AI Politika Otogüncelleme (990 TL/yıl)

AI Koruma Paketi sayfasında üçü birlikte: 5.990 TL/yıl

---

*CyberStep AI Güvenlik Servisleri 1-4-7 — Mayıs 2026*
