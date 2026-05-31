# CyberStep — AI Servisleri 3, 5, 2, 8
## Öncelik Sırası: EU AI Act | AI Red Team | Deepfake Analizi | Sahte Doküman

---

# ÖNCELİK 1: EU AI ACT UYUM SKORU (Özellik 3)
## Neden Önce: Sıfır harici API, 3-4 günlük iş, AB'ye ihracat yapan her firmaya satılır

---

## REPLIT AGENT PROMPTU

Build an "EU AI Act Compliance Score" module for CyberStep.io. Companies that sell products/services to EU or use AI systems need to understand their EU AI Act obligations. This is a 20-question assessment that produces a compliance score and action plan.

Existing stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React + Iyzico.

### DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS eu_aiact_assessments (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  company_name varchar(255),
  contact_email varchar(255),
  sector varchar(100),
  employee_count varchar(50),
  
  -- Company AI profile
  has_eu_customers boolean,
  has_eu_employees boolean,
  uses_ai_in_products boolean,
  ai_use_cases text[],
  -- ['hiring_filter', 'credit_scoring', 'content_moderation',
  --  'customer_service', 'document_processing', 'recommendation',
  --  'image_recognition', 'fraud_detection', 'other']
  
  -- Assessment results
  raw_score integer,
  max_score integer,
  percentage integer,
  risk_category varchar(30),
  -- 'unacceptable' | 'high_risk' | 'limited_risk' | 'minimal_risk' | 'not_applicable'
  
  -- AI Act specific
  applicable_articles text[],
  -- EU AI Act articles that apply to this company
  prohibited_practices_check boolean,
  -- Does company use any prohibited AI practices?
  high_risk_system_detected boolean,
  
  -- Report
  report_json jsonb,
  pdf_path varchar(500),
  
  -- Payment
  payment_status varchar(20) DEFAULT 'unpaid',
  price_tl integer DEFAULT 1990,
  
  status varchar(20) DEFAULT 'in_progress',
  created_at timestamp DEFAULT now(),
  completed_at timestamp
);
```

### EU AI ACT QUESTIONS (Insert into questions table)

```sql
INSERT INTO questions
(domain, area_label, question_text, help_text, weight, isRedAlarm, assessment_type, sort_order)
VALUES

-- KAPSAM BELIRLEME (3 soru)
('EUA0', 'Kapsam Belirleme',
 'Şirketiniz AB ülkelerindeki müşterilere ürün veya hizmet satıyor mu?',
 'AB Yapay Zeka Yasası, AB pazarına sunum yapan TÜM şirketleri kapsıyor — AB''de kayıtlı olmanız gerekmiyor.',
 3, true, 'eu_aiact', 1),

('EUA0', 'Kapsam Belirleme',
 'Şirketinizin sunduğu ürün veya hizmetlerde yapay zeka teknolojisi kullanılıyor mu?',
 'Öneri sistemi, chatbot, görüntü analizi, doğal dil işleme gibi herhangi bir AI bileşeni var mı?',
 3, true, 'eu_aiact', 2),

('EUA0', 'Kapsam Belirleme',
 'Şirketiniz başka firmalara yapay zeka sistemi veya AI bileşeni satıyor ya da kiralıyor mu?',
 'AI sağlayıcısı (provider) veya konuşlandırıcısı (deployer) rolünde misiniz?',
 3, true, 'eu_aiact', 3),

-- YASAKLI UYGULAMALAR (4 soru)
('EUA1', 'Yasaklı AI Uygulamaları',
 'Şirketiniz insanların davranışını manipüle etmek için bilinçaltı teknikler kullanan AI sistemi kullanıyor mu?',
 'Kullanıcının farkında olmadan kararlarını etkileyen gizli AI manipülasyonu AB AI Yasası''nda kesinlikle yasak.',
 3, true, 'eu_aiact', 4),

('EUA1', 'Yasaklı AI Uygulamalar',
 'Gerçek zamanlı biyometrik tanıma sistemi (yüz, parmak izi, ses) kamuya açık alanlarda kullanılıyor mu?',
 'Kamuya açık alanda gerçek zamanlı biyometrik kitlesel gözetim AB AI Yasası''nda yasaklanmıştır.',
 3, true, 'eu_aiact', 5),

('EUA1', 'Yasaklı AI Uygulamalar',
 'Sosyal kredi puanlama veya kişileri genel davranışlarına göre sıralayan AI sistemi kullanılıyor mu?',
 'Sosyal skorlama sistemleri AB AI Yasası''nda kesinlikle yasaklı kategoride.',
 3, true, 'eu_aiact', 6),

('EUA1', 'Yasaklı AI Uygulamalar',
 'İşe alım sürecinde adayları otomatik olarak reddeden veya sıralayan AI sistemi aktif mi?',
 'İşe alım kararlarını etkileyen AI sistemleri yüksek riskli kategoride. Özel gereklilikler uygulanır.',
 2, true, 'eu_aiact', 7),

-- YÜKSEK RİSKLİ SİSTEMLER (5 soru)
('EUA2', 'Yüksek Riskli AI Sistemleri',
 'Kredi skoru, sigorta fiyatlandırması veya finansal ürün erişimini belirleyen AI kullanılıyor mu?',
 'Finansal kararları etkileyen AI sistemleri yüksek riskli. Özel teknik dokümantasyon, test ve insan denetimi zorunlu.',
 2, true, 'eu_aiact', 8),

('EUA2', 'Yüksek Riskli AI Sistemleri',
 'Sağlık teşhisi, tedavi önerisi veya tıbbi cihaz kontrolü için AI kullanılıyor mu?',
 'Sağlık AI sistemleri en katı yüksek riskli kategoride. AB onayı ve sürekli izleme zorunlu.',
 2, true, 'eu_aiact', 9),

('EUA2', 'Yüksek Riskli AI Sistemleri',
 'Eğitim alanında öğrenci değerlendirmesi veya erişim kararları için AI kullanılıyor mu?',
 'Eğitim fırsatlarını etkileyen AI yüksek riskli. Şeffaflık ve insan denetimi gereklidir.',
 2, false, 'eu_aiact', 10),

('EUA2', 'Yüksek Riskli AI Sistemleri',
 'Müşteri şikayetlerini veya hizmet taleplerini tamamen otomatik olarak sonuçlandıran AI var mı?',
 'Kişilerin haklarını etkileyen tamamen otomatik kararlar için itiraz hakkı sağlanmalı.',
 1, false, 'eu_aiact', 11),

('EUA2', 'Yüksek Riskli AI Sistemleri',
 'Kritik altyapı (enerji, su, ulaşım) yönetimi veya güvenlik için AI sistemi kullanılıyor mu?',
 'Kritik altyapı AI sistemleri en yüksek risk kategorisinde ve özel onay gerektiriyor.',
 2, true, 'eu_aiact', 12),

-- ŞEFFAFLIK VE DOKÜMANTASYON (4 soru)
('EUA3', 'Şeffaflık ve Dokümantasyon',
 'Müşterilerinize veya kullanıcılarınıza yapay zeka ile etkileşimde olduklarını bildiriyor musunuz?',
 'Chatbot, öneri sistemi gibi AI sistemlerde kullanıcı bilgilendirmesi AB AI Yasası gereği.',
 2, false, 'eu_aiact', 13),

('EUA3', 'Şeffaflık ve Dokümantasyon',
 'Kullandığınız AI sistemleri için teknik dokümantasyon hazırlandı mı?',
 'Yüksek riskli sistemler için: teknik özellikler, eğitim verisi, test sonuçları belgelenmeli.',
 1, false, 'eu_aiact', 14),

('EUA3', 'Şeffaflık ve Dokümantasyon',
 'AI destekli kararlardan etkilenen kişiler bu kararları sorgulama veya itiraz hakkına sahip mi?',
 'AB AI Yasası insanlara AI kararlarına karşı anlamlı bir itiraz hakkı tanıma zorunluluğu getiriyor.',
 2, false, 'eu_aiact', 15),

('EUA3', 'Şeffaflık ve Dokümantasyon',
 'Deepfake veya AI ile oluşturulmuş içerik üretiyorsanız bunlar açıkça işaretleniyor mu?',
 'AI ile oluşturulmuş görsel, ses veya metin içeriği AB AI Yasası''na göre açıkça etiketlenmeli.',
 1, false, 'eu_aiact', 16),

-- UYUM HAZIRLIĞI (4 soru)
('EUA4', 'Uyum Hazırlığı',
 'Şirketinizde AB AI Yasası uyumundan sorumlu atanmış bir kişi veya ekip var mı?',
 'Yüksek riskli AI sistemleri için uyum sorumlusu atanması öneriliyor.',
 1, false, 'eu_aiact', 17),

('EUA4', 'Uyum Hazırlığı',
 'Kullandığınız AI sistemlerinin AB AI Yasası kapsamında hangi kategoride olduğu değerlendirildi mi?',
 'Kendi AI risk kategorizasyonunuzu yapmak uyum sürecinin ilk adımı.',
 2, false, 'eu_aiact', 18),

('EUA4', 'Uyum Hazırlığı',
 'AB AI Yasası yükümlülükleri için bir uyum takvimi veya yol haritası hazırlandı mı?',
 'Yüksek riskli sistemler için 2026 yılı sonuna kadar uyum zorunlu.',
 1, false, 'eu_aiact', 19),

('EUA4', 'Uyum Hazırlığı',
 'Üçüncü taraflardan satın alınan AI sistemlerin AB AI Yasası uyumluluğu tedarikçiden teyit edildi mi?',
 'AI sağlayıcınızın CE işareti veya uyum belgesi sunması gerekebilir.',
 1, false, 'eu_aiact', 20);
```

### SCORING & RISK CATEGORIZATION

```typescript
// Special logic: if ANY prohibited practice question answered 'evet'
// → immediately flag as 'unacceptable' risk regardless of total score

export function categorizeEUAIAct(
  answers: AssessmentAnswer[],
  percentage: number
): {
  category: string;
  label: string;
  color: string;
  summary: string;
} {
  // Check prohibited practices (EUA1 domain)
  const prohibitedAnswers = answers.filter(
    a => a.domain === 'EUA1' && a.answer === 'evet'
  );
  if (prohibitedAnswers.length > 0) {
    return {
      category: 'unacceptable',
      label: '🚫 Yasak Uygulama Tespit Edildi',
      color: '#FF1744',
      summary: 'Kullandığınız AI uygulamalarından biri AB AI Yasası kapsamında kesinlikle yasak kategorisinde. Acil hukuki danışmanlık alın.'
    };
  }

  // Check if in scope at all
  const scopeAnswers = answers.filter(a => a.domain === 'EUA0');
  const inScope = scopeAnswers.some(a => a.answer === 'evet');
  if (!inScope) {
    return {
      category: 'not_applicable',
      label: '✅ Kapsam Dışı',
      color: '#00E096',
      summary: 'Mevcut bilgilere göre şirketiniz AB AI Yasası kapsamı dışında görünüyor. Durum değişirse yeniden değerlendirin.'
    };
  }

  // High risk systems detected
  const highRiskAnswers = answers.filter(
    a => a.domain === 'EUA2' && a.answer === 'evet'
  );
  if (highRiskAnswers.length >= 2) {
    return {
      category: 'high_risk',
      label: '🔴 Yüksek Riskli Sistem',
      color: '#FF4560',
      summary: 'Yüksek riskli AI sistemi kullanıyorsunuz. 2026 sonuna kadar teknik dokümantasyon, test ve kayıt yükümlülüklerini tamamlamanız gerekiyor.'
    };
  }

  if (percentage >= 60) {
    return {
      category: 'limited_risk',
      label: '🟡 Sınırlı Risk',
      color: '#FFB020',
      summary: 'Bazı şeffaflık yükümlülükleri uygulanıyor. Kullanıcıları AI ile etkileşimde olduklarından haberdar etmeniz yeterli olabilir.'
    };
  }

  return {
    category: 'minimal_risk',
    label: '🟢 Minimum Risk',
    color: '#00E096',
    summary: 'Mevcut AI kullanımınız minimum risk kategorisinde. Herhangi bir zorunlu uyum adımı şart değil ancak iyi uygulamaları takip edin.'
  };
}
```

### CLAUDE REPORT PROMPT

```typescript
const EU_AIACT_PROMPT = (data: EUAIActAssessmentData) => `
Sen AB Yapay Zeka Yasası (EU AI Act) konusunda uzman bir uyum danışmanısın.
Türkçe, teknik olmayan dil kullanarak rapor hazırla.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}
RİSK KATEGORİSİ: ${data.riskCategory}
SKOR: ${data.percentage}%

CEVAPLANAN SORULAR:
${data.answers.map(a => `[${a.domain}] ${a.questionText}: ${a.answer}`).join('\n')}

JSON FORMATINDA ÜRETİN:
{
  "risk_category": "${data.riskCategory}",
  "executive_summary": "3-4 cümle. AB AI Yasası kapsamında şirketin durumu. Patron dili.",
  "applicable_articles": [
    {
      "article": "Madde 5",
      "title": "Yasaklı AI Uygulamaları",
      "applies": true/false,
      "explanation": "Bu maddenin şirkete etkisi (1 cümle)"
    }
  ],
  "obligations": [
    {
      "obligation": "Yükümlülük başlığı",
      "deadline": "2026 | 2027 | Mevcut",
      "effort": "kolay | orta | zor",
      "description": "Ne yapılması gerekiyor (patron dili)",
      "penalty": "Uyumsuzluk cezası (€ veya ciro yüzdesi)"
    }
  ],
  "prohibited_alert": null or "Yasak uygulama uyarı metni",
  "kvkk_overlap": "KVKK ile örtüşen gereklilikler — bunları zaten yapıyorsanız sayılır",
  "priority_actions": [
    { "action": "...", "timeframe": "...", "why": "..." }
  ],
  "penalty_exposure": {
    "max_fine_eur": 0,
    "max_fine_tl_approx": 0,
    "basis": "Hangi madde kapsamında hesaplandı"
  }
}

AB AI Yasası ceza skalası:
- Yasaklı uygulamalar: 35 milyon € veya global ciron %7
- Yüksek riskli ihlaller: 15 milyon € veya ciro %3
- Yanlış bilgi: 7.5 milyon € veya ciro %1.5

Sadece JSON döndür.
`;
```

### FRONTEND LANDING PAGE (`/eu-ai-act`)

```
┌────────────────────────────────────────────────────────┐
│  🇪🇺 AB Yapay Zeka Yasası Uyum Skoru                  │
│                                                         │
│  1 Ağustos 2026'dan itibaren AB'ye ürün veya hizmet   │
│  satan şirketler AB AI Yasası kapsamına giriyor.       │
│  Cezalar: 35 milyon Euro'ya kadar.                     │
│                                                         │
│  20 soruda uyum durumunuzu öğrenin:                    │
│  ✓ Hangi risk kategorisinde olduğunuz                  │
│  ✓ Hangi AB AI Yasası maddeleri sizi etkiliyor         │
│  ✓ Yasaklı uygulama kullanıp kullanmadığınız          │
│  ✓ Öncelikli uyum adımları                            │
│  ✓ Maksimum ceza maruziyeti (€ ve TL)                 │
│                                                         │
│  Fiyat: 1.990 TL     Süre: 10 dakika                  │
│  [Uyum Skorumu Öğren →]                               │
│                                                         │
│  📌 AB'ye ihracat yapmıyor musunuz?                   │
│  Yine de değerlendirme yapın — AB mevzuatı             │
│  Türk regülasyonlarını da etkiliyor.                   │
└────────────────────────────────────────────────────────┘
```

### PRICING & INTEGRATION
- Standalone: 1.990 TL
- AI Güvenlik Değerlendirmesi eklentisi: +990 TL
- Büyüme plan dahil: Yılda 1 değerlendirme
- Fiyat konumlandırması: "AB uyum danışmanı bu analizi 5.000-20.000 TL'ye yapar"

---

# ÖNCELİK 2: AI RED TEAM RAPORU (Özellik 5)
## Neden İkinci: Phishing Simülasyonu OSINT altyapısını yeniden kullanır, geliştirme süresi kısalır

---

## REPLIT AGENT PROMPTU

Build an "AI Red Team Report" module for CyberStep.io. This report shows companies what an attacker could learn about them using AI and OSINT tools in under 30 minutes — before launching an attack.

This REUSES the osintCollector.ts service already built for the Phishing Simulation module.

### DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS red_team_reports (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  company_name varchar(255) NOT NULL,
  domain varchar(255) NOT NULL,
  contact_email varchar(255),
  sector varchar(100),
  
  -- OSINT findings (reuse from phishing sim if available)
  phishing_sim_id integer REFERENCES phishing_simulations(id),
  -- If customer already ran phishing sim, reuse OSINT
  osint_data jsonb,
  
  -- Intelligence categories
  digital_footprint jsonb,
  -- {
  --   total_exposure_score: 0-100,
  --   website_intelligence: {},
  --   technology_stack: [],
  --   employee_intelligence: {},
  --   social_media_intelligence: {},
  --   infrastructure_intelligence: {},
  --   breach_intelligence: {},
  --   domain_intelligence: {}
  -- }
  
  -- Attack surface summary
  attack_vectors jsonb,
  -- Array of identified attack entry points
  
  -- Competitive intelligence risk
  exposed_business_info jsonb,
  -- What competitors could learn about the company
  
  -- Report
  report_json jsonb,
  pdf_path varchar(500),
  
  -- Payment
  payment_status varchar(20) DEFAULT 'unpaid',
  price_tl integer DEFAULT 2490,
  -- Slightly higher than phishing sim — more comprehensive
  
  status varchar(20) DEFAULT 'collecting',
  created_at timestamp DEFAULT now(),
  completed_at timestamp
);
```

### EXTENDED OSINT ENGINE

Extend existing osintCollector.ts with these additional checks:

```typescript
interface RedTeamOSINT extends OSINTData {
  // Technology intelligence
  hostingProvider: string;
  cdnProvider: string;
  analyticsTools: string[];
  // Google Analytics, Hotjar, Clarity etc.
  marketingTools: string[];
  // HubSpot, Mailchimp etc.
  ecommerceplatform: string;
  
  // Employee intelligence (public sources only)
  linkedinFollowerCount: number;
  recentHires: string[];
  // Job titles from LinkedIn job postings
  departures: string[];
  // Inferred from job posting history
  skillsExposed: string[];
  // Technologies mentioned in job postings
  // e.g., "SAP ERP" in job posting = company uses SAP
  
  // Business intelligence
  estimatedRevenue: string;
  // From LinkedIn employee count + sector benchmarks
  recentNews: NewsItem[];
  // From Google News API (free)
  priceList: boolean;
  // Does website expose pricing?
  clientLogos: string[];
  // Logos on "Müşterilerimiz" section
  
  // Infrastructure intelligence  
  ipGeolocation: string;
  asnProvider: string;
  cloudProvider: string;
  // AWS/Azure/GCP detected from CNAME records
  backupDomains: string[];
  // Other domains owned by same registrant
  
  // Historical intelligence
  webArchiveSnapshots: number;
  // How many Wayback Machine snapshots exist
  oldEmployeeProfiles: string[];
  // LinkedIn profiles that mention the company but left
}

async function collectRedTeamOSINT(domain: string): Promise<RedTeamOSINT> {
  const base = await collectOSINT(domain); // Existing function
  
  // Additional: Job posting analysis
  const jobTechStack = await extractTechFromJobPostings(domain);
  
  // Additional: Google News
  const news = await fetchGoogleNews(domain);
  
  // Additional: DNS intelligence
  const dnsIntel = await deepDNSAnalysis(domain);
  
  // Additional: Wayback Machine
  const archiveCount = await checkWebArchive(domain);
  
  return { ...base, ...jobTechStack, ...news, ...dnsIntel, archiveCount };
}

async function fetchGoogleNews(companyName: string): Promise<NewsItem[]> {
  // Use Google News RSS (free, no API key)
  const query = encodeURIComponent(`"${companyName}"`);
  const rss = await axios.get(
    `https://news.google.com/rss/search?q=${query}&hl=tr&gl=TR&ceid=TR:tr`
  );
  // Parse RSS, return last 5 news items
  return parseRSS(rss.data).slice(0, 5);
}
```

### INTELLIGENCE SCORING ENGINE

```typescript
interface AttackVector {
  vector: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  // What attacker learns/can do
  source: string;
  // Where this info was found
  example: string;
  // Concrete example from OSINT
}

function analyzeAttackVectors(osint: RedTeamOSINT): AttackVector[] {
  const vectors: AttackVector[] = [];

  // Technology stack exposure
  if (osint.technologyStack.length > 0) {
    vectors.push({
      vector: 'Teknoloji Altyapısı Tespiti',
      severity: 'medium',
      description: 'Saldırgan kullandığınız yazılımları biliyor ve bu yazılımlara özgü açıkları araştırabilir.',
      source: 'Web sitesi kaynak kodu',
      example: `Tespit edilen: ${osint.technologyStack.join(', ')}`
    });
  }

  // Exposed employee names
  if (osint.namedExecutives.length > 0) {
    vectors.push({
      vector: 'Yönetici Bilgisi Maruziyeti',
      severity: 'high',
      description: 'Saldırgan yönetici isimlerini kullanarak hedefli phishing e-postası hazırlayabilir.',
      source: 'Şirket web sitesi / LinkedIn',
      example: `Bulunan isimler: ${osint.namedExecutives.join(', ')}`
    });
  }

  // Email pattern
  if (osint.emailPatterns.length > 0) {
    vectors.push({
      vector: 'E-posta Formatı Tahmini',
      severity: 'high',
      description: 'Saldırgan tüm çalışanların e-posta adresini tahmin edebilir ve toplu phishing gönderebilir.',
      source: 'Kamuya açık e-postalar',
      example: `Format: ${osint.emailPatterns[0]}`
    });
  }

  // No DMARC
  if (!osint.dmarcConfigured) {
    vectors.push({
      vector: 'E-posta Taklit Riski',
      severity: 'critical',
      description: 'Saldırgan şirket adına e-posta gönderebilir. Çalışanlarınız ve müşterileriniz kandırılabilir.',
      source: 'DNS kaydı analizi',
      example: 'DMARC kaydı yok — taklit kolay'
    });
  }

  // Breach history
  if (osint.haveIBeenPwnedCount > 0) {
    vectors.push({
      vector: 'Veri İhlali Geçmişi',
      severity: 'high',
      description: 'Önceki ihlallerden elde edilen çalışan şifreleri hâlâ kullanılıyor olabilir.',
      source: 'HaveIBeenPwned veritabanı',
      example: `${osint.haveIBeenPwnedCount} veri ihlalinde domain görünüyor`
    });
  }

  // Client exposure
  if (osint.clientLogos.length > 0) {
    vectors.push({
      vector: 'Müşteri Listesi Maruziyeti',
      severity: 'medium',
      description: 'Saldırgan müşterilerinizi bilerek onlar üzerinden size saldırabilir (tedarik zinciri saldırısı).',
      source: 'Şirket web sitesi referanslar bölümü',
      example: `Görünen müşteriler: ${osint.clientLogos.slice(0, 3).join(', ')}`
    });
  }

  return vectors.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}
```

### CLAUDE REPORT PROMPT

```typescript
const RED_TEAM_PROMPT = (data: RedTeamData) => `
Sen bir etik siber güvenlik red team uzmanısın.
Aşağıdaki şirket hakkında kamuya açık kaynaklardan 
toplanan verilerle bir istihbarat değerlendirmesi yap.

AMAÇ: Şirket yönetimine "saldırganlar bizi hedef alırsa
ne biliyor?" sorusunu yanıtlamak.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}

TOPLANAN İSTİHBARAT:
${JSON.stringify(data.osintData, null, 2)}

TESPİT EDİLEN SALDIRI VEKTÖRLERİ:
${data.attackVectors.map(v => `[${v.severity.toUpperCase()}] ${v.vector}: ${v.example}`).join('\n')}

JSON FORMATINDA ÜRETİN:

{
  "exposure_score": 0-100,
  "exposure_level": "KRİTİK | YÜKSEK | ORTA | DÜŞÜK",
  
  "executive_summary": "4-5 cümle. Bir saldırgan bu şirket hakkında ne biliyor ve bunu nasıl kullanabilir. Patron dili.",
  
  "attacker_profile": "30 dakikada bir saldırganın öğrenebileceklerinin özeti — senaryo formatında",
  
  "intelligence_categories": [
    {
      "category": "Teknoloji İstihbaratı",
      "findings": ["Bulunan spesifik bilgiler"],
      "attacker_use": "Saldırgan bunu nasıl kullanır",
      "risk": "high | medium | low"
    }
  ],
  
  "most_valuable_finding": "Saldırgan için en değerli tek bilgi ve neden",
  
  "attack_scenarios": [
    {
      "scenario": "Senaryo adı",
      "uses_found_data": ["Hangi OSINT verisi kullanılıyor"],
      "probability": "Yüksek | Orta | Düşük",
      "potential_damage": "TL veya operasyonel etki"
    }
  ],
  
  "data_minimization_actions": [
    "Kamuya açık olan ama olmaması gereken bilgiler için aksiyon"
  ],
  
  "quick_wins": [
    "Bu hafta kaldırılabilecek veya gizlenebilecek kamuya açık bilgiler"
  ]
}

Sadece JSON döndür.
`;
```

### PRICING & UPSELL

Fiyat: 2.490 TL (standalone)
Phishing Simülasyonu ile paket: 3.490 TL (her ikisi için — %20 indirim)
Konumlandırma: "Saldırgan 30 dakikada ne öğrenir? Siz önce öğrenin."

Rapor sonunda upsell: "Bu bilgiler zaten kamuya açık.
Güvenlik açıklarını da görün → Tam Assessment (5.990 TL)"

---

# ÖNCELİK 3: DEEPFAKE & SES KLONU TEHDİT ANALİZİ (Özellik 2)
## Neden Üçüncü: Yüksek duygusal etki, orta teknik yük, CEO fraud vakalarıyla çok güncel

---

## REPLIT AGENT PROMPTU

Build a "Deepfake & Voice Clone Threat Analysis" module for CyberStep.io. This assesses how vulnerable a company's executives are to voice cloning and deepfake attacks by analyzing their public digital presence.

Reuses OSINT infrastructure from Phishing Simulation module.

### DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS deepfake_assessments (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  company_name varchar(255) NOT NULL,
  domain varchar(255) NOT NULL,
  contact_email varchar(255),
  sector varchar(100),
  
  -- Executive profiles analyzed
  executives_analyzed jsonb,
  -- Array of:
  -- {
  --   name: string,
  --   title: string,
  --   source: 'website' | 'linkedin' | 'news',
  --   public_audio_found: boolean,
  --   audio_sources: string[],  // YouTube, podcast URLs
  --   public_video_found: boolean,
  --   video_sources: string[],
  --   social_media_presence: string[],
  --   photo_count_estimate: number,
  --   voice_clone_risk: 'critical' | 'high' | 'medium' | 'low',
  --   deepfake_risk: 'critical' | 'high' | 'medium' | 'low'
  -- }
  
  -- Company-level risk
  overall_voice_clone_risk varchar(20),
  overall_deepfake_risk varchar(20),
  overall_risk_score integer,
  -- 0-100
  
  -- Real Turkey cases reference
  similar_cases integer,
  -- Number of similar Turkey CEO fraud cases in 2024-2025
  
  -- Report
  report_json jsonb,
  pdf_path varchar(500),
  
  -- Payment
  payment_status varchar(20) DEFAULT 'unpaid',
  price_tl integer DEFAULT 1490,
  
  status varchar(20) DEFAULT 'collecting',
  created_at timestamp DEFAULT now(),
  completed_at timestamp
);
```

### EXECUTIVE EXPOSURE ANALYZER

```typescript
interface ExecutiveExposure {
  name: string;
  title: string;
  
  // Voice exposure
  publicAudioSources: string[];
  // YouTube videos, podcast appearances, news interviews
  estimatedAudioMinutes: number;
  // >3 minutes = voice clone possible with most tools
  voiceCloneRisk: RiskLevel;
  
  // Visual exposure  
  publicVideoSources: string[];
  publicPhotoCount: number;
  // Estimated from website, LinkedIn, news
  deepfakeRisk: RiskLevel;
  
  // Digital presence score
  linkedinConnections: string;
  // 'low' | 'medium' | 'high' (no exact count needed)
  twitterFollowers: string;
  pressmentions: number;
  
  // Overall
  attackability: number;
  // 0-100: How attractive a target for deepfake/voice clone attack
}

async function analyzeExecutiveExposure(
  name: string,
  companyName: string,
  domain: string
): Promise<ExecutiveExposure> {
  
  // 1. YouTube search for executive name + company
  // Using YouTube Data API (free, 10,000 units/day)
  const youtubeResults = await searchYouTube(`"${name}" "${companyName}"`);
  const audioMinutes = estimateAudioFromVideos(youtubeResults);
  
  // 2. Google News search
  const newsResults = await fetchGoogleNews(`"${name}" "${companyName}"`);
  
  // 3. Check company website for executive photos/videos
  const websiteMedia = await checkWebsiteForExecutiveMedia(name, domain);
  
  // 4. LinkedIn presence check (public profile only)
  const linkedinData = await checkLinkedInPublic(name, companyName);
  
  // Calculate risks
  const voiceCloneRisk = calculateVoiceCloneRisk(audioMinutes);
  const deepfakeRisk = calculateDeepfakeRisk(
    websiteMedia.photoCount,
    youtubeResults.length,
    newsResults.length
  );
  
  return {
    name, title: '',
    publicAudioSources: youtubeResults.map(r => r.url),
    estimatedAudioMinutes: audioMinutes,
    voiceCloneRisk,
    publicVideoSources: youtubeResults.map(r => r.url),
    publicPhotoCount: websiteMedia.photoCount,
    deepfakeRisk,
    linkedinConnections: linkedinData.connectionLevel,
    pressmentions: newsResults.length,
    attackability: calculateAttackability(voiceCloneRisk, deepfakeRisk, newsResults.length)
  };
}

function calculateVoiceCloneRisk(audioMinutes: number): RiskLevel {
  // Modern voice cloning tools need:
  // - 3+ minutes: Basic clone possible (ElevenLabs free tier)
  // - 10+ minutes: High quality clone
  // - 30+ minutes: Near-perfect clone
  if (audioMinutes === 0) return 'low';
  if (audioMinutes < 3) return 'medium';
  if (audioMinutes < 10) return 'high';
  return 'critical';
}

function calculateDeepfakeRisk(
  photoCount: number,
  videoCount: number,
  newsCount: number
): RiskLevel {
  const exposureScore = (photoCount * 2) + (videoCount * 5) + newsCount;
  if (exposureScore === 0) return 'low';
  if (exposureScore < 10) return 'medium';
  if (exposureScore < 25) return 'high';
  return 'critical';
}
```

### CLAUDE REPORT PROMPT

```typescript
const DEEPFAKE_PROMPT = (data: DeepfakeAssessmentData) => `
Sen sosyal mühendislik ve deepfake tehditleri konusunda
uzman bir siber güvenlik danışmanısın.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}

YÖNETİCİ MARUZIYET ANALİZİ:
${JSON.stringify(data.executivesAnalyzed, null, 2)}

JSON FORMATINDA ÜRETİN:
{
  "threat_summary": "3-4 cümle. Şirkete özgü deepfake/ses klonu riski. CEO fraud bağlamıyla.",
  
  "voice_clone_scenario": {
    "is_possible": true/false,
    "target_executive": "En riskli yönetici adı",
    "attack_narrative": "Saldırı böyle gerçekleşirdi... (senaryo, patron dili, 4-5 cümle)",
    "financial_risk_tl": 0,
    "real_turkey_cases": "Türkiye''de benzer ses klonu dolandırıcılığından 1-2 örnek (genel, şirket adı vermeden)"
  },
  
  "deepfake_scenario": {
    "is_possible": true/false,
    "attack_narrative": "Video deepfake saldırısı senaryosu",
    "financial_risk_tl": 0
  },
  
  "executive_profiles": [
    {
      "name": "...",
      "voice_clone_risk": "...",
      "deepfake_risk": "...",
      "why_at_risk": "Bu kişinin neden hedef olabileceği",
      "exposure_sources": ["Hangi platformlarda görünüyor"]
    }
  ],
  
  "verification_protocol": {
    "title": "Ses Doğrulama Protokolü",
    "steps": [
      "Şirkette uygulanabilecek 5 adımlık doğrulama prosedürü",
      "Özellikle para transferi ve hassas karar anlarında"
    ]
  },
  
  "quick_actions": [
    "Bu hafta uygulanabilecek önlemler"
  ],
  
  "employee_awareness_points": [
    "Çalışanlara anlatılması gereken 3-4 nokta"
  ]
}

Sadece JSON döndür.
`;
```

### FRONTEND KEY ELEMENT — "Görsel Etki" Bölümü

En önemli frontend unsuru: Rapor sayfasında yönetici adı ve kamuya açık ses kaynakları gösterildiğinde patron için çok güçlü bir "aha moment" yaratır.

```tsx
// Executive Risk Card
<div className="executive-card" style={{ borderLeft: `4px solid ${riskColor}` }}>
  <div className="exec-header">
    <span className="exec-name">{exec.name}</span>
    <span className="exec-title">{exec.title}</span>
    <RiskBadge level={exec.voiceCloneRisk} label="Ses Klonu Riski" />
  </div>
  
  {exec.estimatedAudioMinutes > 0 && (
    <div className="audio-warning">
      ⚠️ Kamuya açık {exec.estimatedAudioMinutes}+ dakika ses kaydı bulundu.
      Modern ses klonlama araçları 3 dakika ses ile çalışabiliyor.
    </div>
  )}
  
  {exec.publicAudioSources.map(source => (
    <div className="source-item">
      🎵 {source} — ses kaydı içeriyor
    </div>
  ))}
</div>
```

### PRICING & POSITIONING

Fiyat: 1.490 TL (standalone)
Konumlandırma: "Yöneticinizin sesi kopyalanabilir mi? 10 dakikada öğrenin."
Demo'da satış anı: "Bak, Genel Müdürün sesi YouTube''da var. 3 dakika yeterli."

---

# ÖNCELİK 4: AI SAHTE DOKÜMAN TESPİTİ (Özellik 8)
## Neden Dördüncü: Harici ML API gerekiyor, muhasebe/finans firmaları için spesifik

---

## REPLIT AGENT PROMPTU

Build an "AI-Generated Document Detection" module for CyberStep.io. This helps companies detect if incoming invoices, contracts, or identity documents may have been AI-generated or manipulated.

Target audience: Accounting firms, financial companies, companies that receive many invoices/contracts.

### EXTERNAL API REQUIRED

Use Hive Moderation API for AI detection:
- Free tier: 100 detections/month
- Paid: $0.002-0.005 per detection
- Endpoint: https://hivemoderation.com/api
- Detects: AI-generated images, text, deepfakes

Alternative (cheaper): Winston AI API or Originality.ai for text detection.

### DATABASE SCHEMA

```sql
CREATE TABLE IF NOT EXISTS document_scans (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  
  -- Document info
  filename varchar(500),
  file_type varchar(20),
  -- 'pdf' | 'image' | 'docx'
  file_size_kb integer,
  file_hash varchar(64),
  -- SHA256, for deduplication
  
  -- Analysis results
  ai_generation_probability decimal(5,2),
  -- 0-100% probability of AI generation
  manipulation_probability decimal(5,2),
  -- 0-100% probability of manipulation
  
  -- Specific checks
  metadata_anomalies jsonb,
  -- Missing/suspicious metadata
  font_inconsistencies boolean,
  -- Font changes indicating copy-paste editing
  image_artifacts boolean,
  -- AI image generation artifacts
  text_ai_probability decimal(5,2),
  -- AI-written text probability
  
  -- Verdict
  verdict varchar(20),
  -- 'authentic' | 'suspicious' | 'likely_ai' | 'manipulated'
  confidence integer,
  -- 0-100
  risk_factors text[],
  
  -- Claude analysis
  analysis_summary text,
  
  -- Payment model
  -- Individual scan: 49 TL per document
  -- Subscription: 490 TL/ay (100 scans)
  payment_type varchar(20),
  -- 'single' | 'subscription'
  
  scanned_at timestamp DEFAULT now()
);
```

### DOCUMENT ANALYSIS ENGINE

```typescript
import axios from 'axios';
import * as pdfParse from 'pdf-parse';
import * as Jimp from 'jimp';

interface DocumentAnalysis {
  aiProbability: number;
  manipulationProbability: number;
  metadataAnomalies: string[];
  verdict: string;
  confidence: number;
  riskFactors: string[];
}

export async function analyzeDocument(
  fileBuffer: Buffer,
  fileType: string,
  filename: string
): Promise<DocumentAnalysis> {
  const results: Partial<DocumentAnalysis> = {
    riskFactors: [],
    metadataAnomalies: []
  };

  // 1. Metadata analysis
  if (fileType === 'pdf') {
    const pdfData = await pdfParse(fileBuffer);
    const metadata = pdfData.info;

    // Check for suspicious metadata
    if (!metadata?.Creator) {
      results.metadataAnomalies!.push('PDF oluşturucu bilgisi eksik');
    }
    if (!metadata?.CreationDate) {
      results.metadataAnomalies!.push('Oluşturma tarihi eksik');
    }
    // Creation date in future
    if (metadata?.CreationDate && new Date(metadata.CreationDate) > new Date()) {
      results.metadataAnomalies!.push('Oluşturma tarihi gelecekte gösteriyor');
      results.riskFactors!.push('Tarih manipülasyonu');
    }
    // Modified after creation (normal) but extreme gap
    const createdStr = metadata?.CreationDate;
    const modifiedStr = metadata?.ModDate;
    if (createdStr && modifiedStr) {
      const created = new Date(createdStr);
      const modified = new Date(modifiedStr);
      const diffDays = (modified.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) {
        results.riskFactors!.push('Değiştirilme tarihi oluşturma tarihinden önce');
      }
    }
  }

  // 2. Hive Moderation API for AI detection
  if (process.env.HIVE_API_KEY) {
    try {
      const base64 = fileBuffer.toString('base64');
      const hiveResponse = await axios.post(
        'https://api.thehive.ai/api/v2/task/sync',
        {
          input: [{ type: 'image', data: base64 }]
        },
        {
          headers: {
            Authorization: `Token ${process.env.HIVE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiScore = hiveResponse.data?.status?.[0]?.response?.output?.[0]
        ?.classes?.find((c: any) => c.class === 'ai_generated')?.score || 0;

      results.aiProbability = Math.round(aiScore * 100);

      if (aiScore > 0.7) {
        results.riskFactors!.push('Yapay zeka ile oluşturulmuş içerik tespit edildi');
      }
    } catch (e) {
      console.log('Hive API error:', e);
      results.aiProbability = 0;
    }
  }

  // 3. Text AI detection (for document text)
  if (fileType === 'pdf') {
    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text;
    if (text && text.length > 200) {
      const textAiProb = await detectAIText(text);
      results.text_ai_probability = textAiProb;
      if (textAiProb > 70) {
        results.riskFactors!.push('Metin içeriği yapay zeka tarafından yazılmış olabilir');
      }
    }
  }

  // 4. Determine verdict
  const maxRisk = Math.max(
    results.aiProbability || 0,
    results.manipulationProbability || 0,
    results.metadataAnomalies!.length * 20
  );

  results.verdict = maxRisk > 75 ? 'manipulated'
    : maxRisk > 55 ? 'likely_ai'
    : maxRisk > 30 ? 'suspicious'
    : 'authentic';

  results.confidence = Math.min(95, 60 + (results.riskFactors!.length * 10));

  return results as DocumentAnalysis;
}
```

### FRONTEND — DRAG & DROP SCANNER

```
┌────────────────────────────────────────────────────────┐
│  🔍 AI Doküman Güvenlik Tarayıcısı                    │
│                                                         │
│  Fatura, sözleşme veya kimlik belgesi gerçek mi?       │
│  Yapay zeka ile oluşturulmuş veya manipüle              │
│  edilmiş mi?                                           │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │                                              │     │
│  │   📄 Dosyayı buraya sürükleyin               │     │
│  │   veya tıklayarak seçin                      │     │
│  │                                              │     │
│  │   PDF, JPG, PNG — Max 10MB                   │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  Fiyat: 49 TL / belge                                  │
│  Toplu plan: 490 TL/ay (100 tarama)                    │
│                                                         │
│  Saniyeler içinde sonuç:                               │
│  ✓ AI üretimi olasılık yüzdesi                        │
│  ✓ Metadata anomali tespiti                            │
│  ✓ Manipülasyon belirtileri                            │
│  ✓ Güvenle kullan / Dikkatli ol kararı                │
└────────────────────────────────────────────────────────┘
```

### PRICING

- Tek tarama: 49 TL
- Aylık 100 tarama: 490 TL/ay
- Büyüme plan dahil: Ayda 20 ücretsiz tarama
- API erişimi (diğer sistemlerle entegrasyon): Skor API planına dahil

---

# UYGULAMA TAKVİMİ

```
HAFTA 1-2:   EU AI Act (Özellik 3)
             → Sıfır yeni API, Claude prompt + 20 soru + rapor
             → Gelir: 1.990 TL/değerlendirme

HAFTA 3-4:   AI Red Team (Özellik 5)
             → Phishing Sim OSINT altyapısını yeniden kullan
             → Gelir: 2.490 TL/rapor

HAFTA 5-6:   Deepfake Analizi (Özellik 2)
             → YouTube Data API (ücretsiz) + Claude
             → Gelir: 1.490 TL/değerlendirme

HAFTA 7-8:   Sahte Doküman (Özellik 8)
             → Hive API entegrasyonu + drag-drop UI
             → Gelir: 49 TL/tarama veya 490 TL/ay

Özellik 6 (Ajan AI): 2027'de değerlendir
```

---

# FİYAT ÖZETİ — TÜM AI SERVİSLERİ

| Servis | Fiyat | Model |
|---|---|---|
| AI Güvenlik Değerlendirmesi | 2.900 TL | Tek seferlik |
| AI Phishing Simülasyonu | 1.990 TL | Tek seferlik |
| EU AI Act Uyum Skoru | 1.990 TL | Tek seferlik |
| AI Red Team Raporu | 2.490 TL | Tek seferlik |
| Deepfake Tehdit Analizi | 1.490 TL | Tek seferlik |
| Sahte Doküman Tespiti | 49 TL/belge | Kullanım bazlı |
| AI Araç İzleme | 490 TL/ay | Abonelik |
| AI Politika Otogüncelleme | 990 TL/yıl | Abonelik |
| **AI TAM KORUMA PAKETİ** | **9.990 TL/yıl** | **Paket** |

---

*CyberStep AI Servisleri 2-3-5-6-8 Analiz + Replit Promptları — Mayıs 2026*
