# CyberStep — 4 Özellik Replit Agent Promptları

---

# PROMPT 1 — REFERRAL PROGRAMI (Dropbox Modeli)

Build a referral program module for CyberStep.io. The existing app is Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React frontend. Add the referral system as a new module that integrates with the existing codebase.

## Database Schema

```typescript
// referral_codes table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  code: varchar(20) unique not null, // e.g. "SERKAN-X7K2"
  created_at: timestamp default now(),
  is_active: boolean default true,
  total_uses: integer default 0,
  total_rewards_given: integer default 0 // months of free access given
}

// referral_events table
{
  id: serial primary key,
  referral_code_id: integer references referral_codes(id),
  referrer_customer_id: integer references customers(id),
  referred_email: varchar(255),
  referred_customer_id: integer references customers(id), // set when they register
  status: varchar(30) default 'pending',
  // pending → registered → converted (paid) → rewarded
  referred_at: timestamp default now(),
  registered_at: timestamp,
  converted_at: timestamp,
  rewarded_at: timestamp,
  reward_type: varchar(30), // 'free_month_referrer' | 'free_month_referred'
  iyzico_discount_code: varchar(50) // generated discount code
}
```

## Core Logic

### Referral Code Generation
- Auto-generate unique code on customer registration: `${firstName.toUpperCase()}-${randomAlphanumeric(4)}`
- Store in referral_codes table
- Each customer gets exactly one referral code

### Reward Rules
When referred customer completes first payment:
1. Referrer gets +1 free month added to their subscription (extend next_billing_date by 30 days)
2. Referred customer gets first month at 0 TL (Iyzico discount or manual credit)
3. Create reward_events records for both
4. Send reward notification emails to both parties
5. Update referral_event status to 'rewarded'

### Fraud Prevention
- Same IP address cannot refer itself
- Same email domain (e.g. company.com) limited to 3 referrals
- Referral only counts if referred user stays active for 14+ days
- Max 10 successful referrals per customer per month

## API Endpoints

```
GET  /api/referral/my-code          — Get current user's referral code + stats
GET  /api/referral/stats            — Referrals made, pending, converted, rewards earned
POST /api/referral/validate/:code   — Check if a code is valid (used at registration)
POST /api/referral/apply/:code      — Apply referral code to new registration
GET  /api/referral/leaderboard      — Top 10 referrers this month (anonymous, show first name only)
```

Admin endpoints:
```
GET  /api/admin/referrals           — All referral events with filters
GET  /api/admin/referrals/stats     — Program-wide stats
PUT  /api/admin/referrals/:id/override — Manually approve/reject a referral
```

## Frontend Components

### Customer Portal — "Arkadaşını Davet Et" Page (`/hesabim/referral`)

Layout:
```
┌─────────────────────────────────────────┐
│  Arkadaşını Davet Et, İkiniz de         │
│  1 Ay Ücretsiz Kazan                    │
│                                         │
│  Nasıl çalışır?                         │
│  1. Davet linkini paylaş                │
│  2. Arkadaşın kayıt olur                │
│  3. İlk ödemeyi yapınca                 │
│     → Sen 1 ay ücretsiz                 │
│     → O 1 ay ücretsiz                   │
│                                         │
│  Referral Kodun:                        │
│  ┌──────────────────┐  [Kopyala]        │
│  │  SERKAN-X7K2     │                   │
│  └──────────────────┘                   │
│                                         │
│  Davet Linki:                           │
│  cyberstep.io/kayit?ref=SERKAN-X7K2     │
│  [Kopyala] [WhatsApp'ta Paylaş]         │
│                                         │
│  [LinkedIn'de Paylaş]  [E-posta Gönder] │
│                                         │
│  ── İstatistiklerin ──                  │
│  Gönderilen davet: 3                    │
│  Kayıt olan:       2                    │
│  Ödeme yapan:      1  ✅                │
│  Kazandığın ay:    1 ay (30 gün)        │
│                                         │
│  ── Bekleyen Davetler ──                │
│  acme@example.com  — Kayıt bekleniyor   │
│  info@firma.com.tr — Ödeme bekleniyor ⏳│
└─────────────────────────────────────────┘
```

### Leaderboard Widget (shown on dashboard)
```
Bu Ay En Çok Davet Eden
1. Serkan A. — 5 davet
2. Ahmet B.  — 3 davet
3. Mehmet C. — 2 davet
```

### Registration Page Integration
- Add optional "Referral kodu var mı?" field at bottom of /kayit form
- Validate code in real-time (green checkmark or red error)
- Show reward preview when valid code entered: "🎁 İlk ayınız ücretsiz!"

## Email Templates

1. **Referral Invitation** (sent by referrer via "E-posta Gönder" button):
```
Konu: [İsim] sizi CyberStep'e davet etti — ilk ay ücretsiz

[İsim] sizi CyberStep.io'yu denemeye davet etti.
Şirketinizin siber güvenlik riskini 20 dakikada öğrenin.

Davet kodunuzu kullanarak kayıt olun, ilk ayınız ücretsiz:
[Kayıt Ol Butonu] → cyberstep.io/kayit?ref=SERKAN-X7K2
```

2. **Reward Notification — Referrer**:
```
Konu: 🎉 Davetiniz kabul edildi — 1 ay ücretsiz hesabınıza eklendi

[Arkadaşınızın adı] CyberStep'e katıldı ve ödeme yaptı.
1 aylık ücretsiz süre hesabınıza eklendi.
Yeni bitiş tarihiniz: [tarih]
```

3. **Reward Notification — Referred**:
```
Konu: 🎁 İlk ay ücretsiz — Referral ödülünüz hazır

[Kodu paylaşanın adı] sayesinde ilk ayınız ücretsiz.
Sonraki ödemeniz: [tarih] (30 gün sonra)
```

## WhatsApp Share Integration
Pre-filled WhatsApp message when "WhatsApp'ta Paylaş" clicked:
```
Merhaba! Şirketimizin siber güvenlik riskini ölçmek için kullandığım CyberStep'i deneyelim.

Türkçe, 20 dakikada sonuç veriyor. İlk ayın benden hediye 🎁

Kayıt: cyberstep.io/kayit?ref=SERKAN-X7K2
```

The referral system should work with the existing Iyzico payment flow — when a payment succeeds, check if the customer has a pending referral event and trigger the reward logic.

---

# PROMPT 2 — PENTEST LITE SERVİSİ

Build a "Pentest Lite" module for CyberStep.io that answers "Is this vulnerability actually exploitable?" without performing actual attacks. The service uses public databases to assess exploitability and generates a professional verification report.

## What Pentest Lite Does

NOT a real pentest. Instead:
1. Takes a domain or IP from customer
2. Correlates existing scan data with public exploit databases
3. Asks Claude AI: "Given this configuration, would this attack succeed?"
4. Produces "Exploitability Verification Report" with evidence

## Database Schema

```typescript
// pentest_lite_requests table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  target: varchar(255), // domain or IP
  target_type: varchar(10), // 'domain' | 'ip'
  status: varchar(20) default 'queued',
  // queued → scanning → analyzing → complete → failed
  created_at: timestamp default now(),
  completed_at: timestamp,
  payment_status: varchar(20) default 'unpaid', // unpaid | paid
  price_tl: integer default 2500,
  
  // Scan results (raw)
  shodan_data: jsonb,
  nuclei_findings: jsonb,
  cve_list: jsonb,
  
  // Exploit intelligence
  exploitdb_matches: jsonb, // CVEs with public exploits
  metasploit_modules: jsonb, // CVEs with Metasploit modules
  cisa_kev_matches: jsonb, // CVEs actively exploited
  epss_scores: jsonb, // exploit probability scores
  
  // AI analysis
  report_json: jsonb,
  pdf_path: varchar(500),
  
  // Scenario results
  scenarios: jsonb // array of attack scenario assessments
}
```

## Attack Scenarios

Define 6 standard scenarios. For each scenario, check specific conditions:

```typescript
const SCENARIOS = [
  {
    id: 'ransomware_entry',
    name: 'Fidye Yazılımı Giriş Riski',
    description: 'Saldırgan fidye yazılımı yükleyebilir mi?',
    checks: ['rdp_open', 'smb_open', 'unpatched_cve_with_exploit', 'no_mfa'],
    mitre_technique: 'T1190',
    icon: '🔒'
  },
  {
    id: 'ceo_fraud',
    name: 'CEO Dolandırıcılığı Riski',
    description: 'Şirket adına sahte e-posta gönderilebilir mi?',
    checks: ['no_spf', 'no_dkim', 'no_dmarc'],
    mitre_technique: 'T1566',
    icon: '📧'
  },
  {
    id: 'data_exfiltration',
    name: 'Veri Sızdırma Riski',
    description: 'Müşteri verileri çalınabilir mi?',
    checks: ['open_database_port', 'leaked_credentials', 'no_ssl'],
    mitre_technique: 'T1041',
    icon: '📤'
  },
  {
    id: 'web_defacement',
    name: 'Web Sitesi Ele Geçirme Riski',
    description: 'Web sitesi değiştirilebilir mi?',
    checks: ['outdated_cms', 'known_web_cve', 'default_admin_path'],
    mitre_technique: 'T1491',
    icon: '🌐'
  },
  {
    id: 'supply_chain',
    name: 'Tedarik Zinciri Riski',
    description: 'Bu firma üzerinden müşterilerine saldırılabilir mi?',
    checks: ['malicious_ip_neighbors', 'leaked_api_keys', 'subdomain_takeover_risk'],
    mitre_technique: 'T1195',
    icon: '🔗'
  },
  {
    id: 'credential_stuffing',
    name: 'Hesap Ele Geçirme Riski',
    description: 'Çalışan hesapları brute-force ile ele geçirilebilir mi?',
    checks: ['hibp_matches', 'no_mfa', 'weak_password_policy_indicators'],
    mitre_technique: 'T1078',
    icon: '🔑'
  }
]
```

## Exploit Intelligence Collection

For each CVE found in scan results, check these free APIs:

```typescript
async function enrichCVE(cveId: string) {
  const [epss, cisakev, nvd] = await Promise.all([
    // EPSS Score — exploit probability
    fetch(`https://api.first.org/data/v1/epss?cve=${cveId}`),
    
    // CISA KEV — actively exploited?
    fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'),
    
    // NVD — CVSS score and description
    fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`)
  ]);
  
  // Check ExploitDB via search (public, no API key needed)
  // Search: https://www.exploit-db.com/search?cve=${cveId}
  // Parse HTML response for exploit count
  
  return {
    cveId,
    epssScore: epss.score, // 0-1, probability of exploitation in 30 days
    epssPercentile: epss.percentile,
    isInCisaKev: cisakev.vulnerabilities.some(v => v.cveID === cveId),
    cvssScore: nvd.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
    hasPublicExploit: exploitDbCount > 0,
    exploitDbCount,
    hasMetasploitModule: false // set manually or via separate check
  };
}
```

## Claude AI Analysis

After collecting all data, send to Claude for scenario assessment:

```
Sen bir siber güvenlik uzmanısın. Pentest Lite analizi yapıyorsun.

HEDEF: ${target}
BULUNAN AÇIKLAR: ${JSON.stringify(findings)}
EXPLOIT İSTİHBARATI: ${JSON.stringify(exploitIntel)}

Her senaryo için gerçekçi bir değerlendirme yap:

{
  "scenarios": [
    {
      "id": "ransomware_entry",
      "verdict": "YÜKSEK_RİSK | ORTA_RİSK | DÜŞÜK_RİSK | RİSK_YOK",
      "confidence": 0-100,
      "evidence": ["Kanıt 1", "Kanıt 2"],
      "attack_narrative": "Saldırgan şunu yapardı: ...",
      "blocking_factor": "Bu saldırıyı engelleyen şey (varsa):",
      "remediation": "Bu riski kapatmak için: ..."
    }
  ],
  "overall_verdict": "YÜKSEK | ORTA | DÜŞÜK",
  "executive_summary": "200 kelime Türkçe yönetici özeti",
  "most_critical_finding": "En kritik tek bulgu",
  "time_to_exploit_estimate": "Ortalama saldırganın başarılı olma süresi tahmini"
}

Önemli: Gerçek bir saldırı yapmıyoruz. Sadece kamuya açık veriler
ve konfigürasyon analizi ile olasılık değerlendirmesi yapıyoruz.
Bunu raporda açıkça belirt.
```

## Report Generation

Generate professional PDF report with:

**Cover Page:**
- "CyberStep Pentest Lite Raporu" 
- Target domain/IP
- Date
- Confidentiality notice: "Bu rapor yalnızca [müşteri adı] için hazırlanmıştır"

**Page 2 — Executive Summary:**
- Overall risk verdict (big colored badge: YÜKSEK/ORTA/DÜŞÜK)
- 6 scenario results as gauge chart (red/yellow/green)
- Most critical finding callout box
- Time-to-exploit estimate

**Pages 3-8 — Scenario Details:**
One page per scenario:
- Scenario name and MITRE technique
- Verdict badge
- Evidence list
- Attack narrative (what an attacker would do)
- Remediation steps

**Page 9 — Methodology Disclaimer:**
```
BU RAPORUN SINIRLIĞI:
CyberStep Pentest Lite, gerçek bir sızma testi değildir.
Bu rapor; kamuya açık veritabanları (CISA KEV, ExploitDB, EPSS),
pasif dış tarama verileri ve yapay zeka destekli konfigürasyon
analizi kullanılarak hazırlanmıştır.
Gerçek sızma testi yerine geçmez.
```

## API Endpoints

```
POST /api/pentest-lite/request        — Create new request (check payment first)
GET  /api/pentest-lite/:id/status     — Poll status
GET  /api/pentest-lite/:id/report     — Get report JSON
GET  /api/pentest-lite/:id/pdf        — Download PDF
GET  /api/pentest-lite/my-requests    — List customer's requests
```

## Frontend — Pentest Lite Page (`/pentest-lite`)

```
┌─────────────────────────────────────────────┐
│  Pentest Lite — Açığınız Gerçekten           │
│  İstismar Edilebilir mi?                     │
│                                             │
│  Gerçek saldırı olmadan, 6 kritik           │
│  saldırı senaryosunda risk teyidi.          │
│                                             │
│  Domain veya IP:                            │
│  [________________] [Analiz Başlat →]       │
│                                             │
│  Fiyat: 2.500 TL (tek seferlik)            │
│  Süre: ~15-20 dakika                        │
│  Çıktı: PDF rapor + 6 senaryo değerlendirme │
│                                             │
│  6 Senaryo:                                 │
│  🔒 Fidye Yazılımı Giriş Riski             │
│  📧 CEO Dolandırıcılığı Riski              │
│  📤 Veri Sızdırma Riski                    │
│  🌐 Web Sitesi Ele Geçirme Riski           │
│  🔗 Tedarik Zinciri Riski                  │
│  🔑 Hesap Ele Geçirme Riski               │
└─────────────────────────────────────────────┘
```

Progress screen while processing:
```
Analiz devam ediyor... (tahmini 15 dakika)
✅ Dış tarama tamamlandı
✅ CVE veritabanı kontrolü tamamlandı  
⏳ Exploit istihbaratı toplanıyor...
○  Senaryo analizi
○  Rapor hazırlanıyor
```

Results screen — scenario dashboard with colored cards for each scenario verdict.

---

# PROMPT 3 — SAĞLIK SKORU & CHURN TAHMİNİ

Build a customer health score and churn prediction system for CyberStep.io. This runs automatically in the background and triggers interventions before customers cancel.

## Database Schema

```typescript
// customer_health_scores table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  calculated_at: timestamp default now(),
  
  // Component scores (0-100 each)
  engagement_score: integer, // login frequency, feature usage
  action_score: integer,     // findings acted upon, issues resolved
  scan_score: integer,       // domain scan activity, new scans
  alert_score: integer,      // alert response rate
  value_score: integer,      // ROI realized (issues closed / issues found)
  
  // Composite
  health_score: integer,     // weighted average 0-100
  health_tier: varchar(20),  // 'healthy' | 'at_risk' | 'critical' | 'churned'
  
  // Churn prediction
  churn_probability: decimal(5,2), // 0-100%
  churn_risk_factors: text[],      // list of detected risk factors
  predicted_churn_date: date,      // if trend continues
  
  // Intervention
  intervention_triggered: boolean default false,
  intervention_type: varchar(50),
  intervention_sent_at: timestamp
}

// customer_activity_events table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  event_type: varchar(50),
  // login | scan_viewed | report_downloaded | finding_closed |
  // alert_opened | assessment_started | assessment_completed |
  // support_ticket | payment_made | payment_failed
  occurred_at: timestamp default now(),
  metadata: jsonb
}

// health_interventions table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  intervention_type: varchar(50),
  // email_reengagement | whatsapp_nudge | personal_call |
  // feature_highlight | success_story | discount_offer
  triggered_at: timestamp default now(),
  health_score_at_trigger: integer,
  response: varchar(20), // 'opened' | 'clicked' | 'ignored' | 'churned'
  responded_at: timestamp
}
```

## Health Score Calculation

Calculate daily for all active customers:

```typescript
function calculateHealthScore(customerId: number): HealthScore {
  
  // ENGAGEMENT SCORE (25% weight)
  // Login in last 7 days: +40
  // Login in last 14 days: +20
  // Login in last 30 days: +10
  // No login in 30+ days: 0
  const loginRecency = getLoginRecency(customerId); // days since last login
  const loginScore = loginRecency <= 7 ? 100 : loginRecency <= 14 ? 60 : loginRecency <= 30 ? 30 : 0;
  
  // ACTION SCORE (30% weight)
  // Findings closed / total findings (%)
  // If 0 findings: 50 (neutral)
  // 80%+ closed: 100
  // 50-80% closed: 70
  // 20-50% closed: 40
  // <20% closed: 10
  const actionRate = getActionRate(customerId); // % of findings acted upon
  const actionScore = actionRate >= 80 ? 100 : actionRate >= 50 ? 70 : actionRate >= 20 ? 40 : 10;
  
  // SCAN SCORE (20% weight)
  // Weekly scan auto-running: +30
  // Viewed last 3 scan reports: +30
  // Completed full assessment: +40
  const scanScore = calculateScanEngagement(customerId);
  
  // ALERT SCORE (15% weight)
  // Opened last 5 alert emails: +60
  // Clicked at least 1: +40
  // All ignored: 0
  const alertScore = calculateAlertEngagement(customerId);
  
  // VALUE SCORE (10% weight)
  // Score improved since signup: +60
  // Score same: +30
  // Score decreased: 0
  const scoreChange = getDomainScoreChange(customerId);
  const valueScore = scoreChange > 5 ? 100 : scoreChange > 0 ? 60 : scoreChange === 0 ? 30 : 0;
  
  const healthScore = Math.round(
    loginScore * 0.25 +
    actionScore * 0.30 +
    scanScore * 0.20 +
    alertScore * 0.15 +
    valueScore * 0.10
  );
  
  // CHURN RISK FACTORS
  const riskFactors = [];
  if (loginRecency > 21) riskFactors.push('21_gun_giris_yok');
  if (actionRate < 10) riskFactors.push('bulgular_kapatilmiyor');
  if (alertScore === 0) riskFactors.push('uyarilar_acilmiyor');
  if (scoreChange < 0) riskFactors.push('risk_skoru_kotu_gidiyor');
  if (daysSincePayment > 340) riskFactors.push('yenileme_yaklasiyor'); // renewal approaching
  
  // TIER
  const tier = healthScore >= 70 ? 'healthy' 
             : healthScore >= 45 ? 'at_risk' 
             : healthScore >= 20 ? 'critical' 
             : 'churned';
  
  // CHURN PROBABILITY (simple logistic model)
  const churnProbability = Math.min(100, Math.max(0, 
    100 - healthScore + (riskFactors.length * 8)
  ));
  
  return { healthScore, tier, churnProbability, riskFactors };
}
```

## Automated Interventions

Trigger based on health tier transitions:

```typescript
const INTERVENTION_RULES = [
  {
    trigger: 'score_drops_below_60',
    type: 'email_reengagement',
    delay_hours: 24,
    template: 'reengagement_value_reminder'
  },
  {
    trigger: 'score_drops_below_40',
    type: 'whatsapp_nudge',
    delay_hours: 0, // immediate
    template: 'whatsapp_personal_checkin'
  },
  {
    trigger: 'score_drops_below_25',
    type: 'personal_call',
    delay_hours: 0,
    template: 'admin_alert_call_needed' // alerts admin, no auto-send
  },
  {
    trigger: 'no_login_21_days',
    type: 'feature_highlight',
    delay_hours: 0,
    template: 'new_feature_you_missed'
  },
  {
    trigger: 'renewal_in_30_days_and_score_below_50',
    type: 'success_story',
    delay_hours: 0,
    template: 'sector_success_story'
  }
];
```

## Intervention Email Templates

**reengagement_value_reminder:**
```
Konu: [İsim], şirketinizde bu hafta 2 yeni risk tespit edildi

[Domain] adresinizin son taramasında 2 yeni bulgu var.

En kritik: [bulgu başlığı]
Risk seviyesi: YÜKSEK
Tahmini maliyet: ₺[tutar]

→ Raporu Görüntüle [link]

Kapatıldığında skorunuz [mevcut] → [tahmini yeni skor] olacak.
```

**whatsapp_personal_checkin:**
```
Merhaba [İsim], CyberStep ekibinden [admin adı].

[Domain] takibinizi bir süredir göremiyoruz. 
Yardımcı olabileceğimiz bir şey var mı?

Son taramanızda [N] bulgu var, [M] tanesi kritik.

Detaylar: cyberstep.io/raporlarim
```

**admin_alert_call_needed:**
```
[Admin paneline bildirim]
Müşteri: [İsim] — [Firma]
Plan: [plan adı]
Sağlık Skoru: [skor] (kritik seviye)
Son Giriş: [tarih]
Churn Olasılığı: %[oran]
Yenileme Tarihi: [tarih]

→ Manuel arama gerekiyor [Müşteri sayfasını aç]
```

## Admin Dashboard — Sağlık Merkezi (`/admin-panel/health`)

**Overview cards:**
- Sağlıklı müşteriler (yeşil): N
- Risk altında (sarı): N  
- Kritik (kırmızı): N
- Bu ay churn eden: N

**Health distribution chart:**
Histogram of health scores across all customers.

**At-Risk Customer Table:**
Sorted by churn probability, showing:
- Müşteri adı | Plan | Sağlık skoru | Son giriş | Churn % | En kritik risk faktörü | Aksiyon butonu

**Intervention History:**
Timeline of triggered interventions and their outcomes.

**Cohort Analysis:**
Health score trend by signup month — which cohorts retain best?

## Customer Portal — Sağlık Kartı Widget

Add a small health card to customer dashboard:

```
┌────────────────────────────────┐
│  Hesap Sağlık Durumunuz       │
│                                │
│  ████████░░  78/100  ✅ İyi   │
│                                │
│  Güçlü yönler:                 │
│  ✅ Düzenli giriş yapıyorsunuz │
│  ✅ Uyarıları takip ediyorsunuz│
│                                │
│  Geliştirilecek:               │
│  ⚠️ 3 bulgu henüz kapatılmadı │
│                                │
│  [Bulgulara Git →]             │
└────────────────────────────────┘
```

## Cron Jobs

```typescript
// Calculate health scores — daily at 02:00
cron.schedule('0 2 * * *', calculateAllHealthScores);

// Check intervention triggers — daily at 09:00
cron.schedule('0 9 * * *', checkAndTriggerInterventions);

// Admin weekly health report — Monday 08:00
cron.schedule('0 8 * * 1', sendAdminHealthWeeklyReport);
```

---

# PROMPT 4 — OTOMATİK YÖNETİM KURULU RAPORU

Build an "Automatic Board Report" feature for CyberStep.io that generates a one-page executive cybersecurity briefing automatically each month. No technical jargon — written for CEOs and CFOs.

## Database Schema

```typescript
// board_reports table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  report_month: integer, // 1-12
  report_year: integer,
  generated_at: timestamp default now(),
  status: varchar(20) default 'draft', // draft | approved | sent
  approved_at: timestamp,
  sent_to_emails: text[], // list of board member emails
  
  // Report data snapshot
  current_score: integer,
  previous_score: integer,
  score_change: integer,
  risk_level: varchar(20),
  
  // Counts
  critical_findings: integer,
  high_findings: integer,
  findings_resolved: integer,
  findings_new: integer,
  
  // Financial
  estimated_risk_tl: integer,
  estimated_risk_change_pct: decimal(5,2),
  
  // AI content
  executive_summary: text,      // 3-4 sentences
  key_achievements: text[],     // what improved this month
  key_risks: text[],           // top 3 remaining risks
  required_decisions: text[],   // what board needs to decide/approve
  next_month_plan: text,        // one sentence
  
  // PDF
  pdf_path: varchar(500)
}

// board_report_recipients table
{
  id: serial primary key,
  customer_id: integer references customers(id),
  email: varchar(255),
  name: varchar(100),
  role: varchar(50), // 'CEO' | 'CFO' | 'COO' | 'Yönetim Kurulu Üyesi' | 'Diğer'
  is_active: boolean default true,
  added_at: timestamp default now()
}
```

## Report Data Collection

```typescript
async function collectReportData(customerId: number, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const prevStartDate = new Date(year, month - 2, 1);
  
  return {
    // Domain scan scores
    currentScore: await getLatestDomainScore(customerId),
    previousScore: await getMonthAvgScore(customerId, prevStartDate),
    
    // Findings
    criticalFindings: await countFindings(customerId, 'critical', 'open'),
    highFindings: await countFindings(customerId, 'high', 'open'),
    resolvedThisMonth: await countFindings(customerId, null, 'resolved', startDate, endDate),
    newThisMonth: await countFindings(customerId, null, null, startDate, endDate),
    
    // Financial risk
    estimatedRiskTL: await calculateFinancialRisk(customerId),
    
    // Domain scan history
    scanHistory: await getDomainScoreHistory(customerId, 6), // last 6 months
    
    // Top 3 open critical/high findings
    topFindings: await getTopFindings(customerId, 3),
    
    // Sector benchmark
    sectorAvgScore: await getSectorBenchmark(customerId),
    sectorPercentile: await getSectorPercentile(customerId),
    
    // KVKK status
    kvkkRiskLevel: await getKVKKRisk(customerId),
    
    // Company info
    company: await getCustomerCompany(customerId)
  };
}
```

## Claude AI Report Generation

```typescript
const BOARD_REPORT_PROMPT = `
Sen kurumsal bir siber güvenlik danışmanısın.
Şirketin Yönetim Kurulu için aylık siber güvenlik brifingini hazırlıyorsun.

KURALI: Teknik jargon yasak. "Port", "CVE", "DMARC" gibi terimler kullanma.
Her teknik terimi iş etkisiyle açıkla.

ŞİRKET VERİLERİ:
${JSON.stringify(reportData)}

Şu JSON formatında rapor üret:

{
  "executive_summary": "3-4 cümle. Bu ay şirkette siber güvenlik açısından ne oldu? Tonun: brifing veren danışman. CEO'ya hitap et.",
  
  "risk_headline": "Tek cümle, çarpıcı. Örnek: 'E-posta sistemindeki açık nedeniyle CEO adına sahte ödeme talebi gönderilebilir durumda.'",
  
  "score_narrative": "Skor değişimini iş diliyle anlat. Örnek: 'Güvenlik durumunuz geçen aya göre iyileşti — muhasebe sisteminizin açığı kapatıldı.'",
  
  "key_achievements": [
    "Bu ay kapatılan önemli riskler (maksimum 3, varsa)",
    "..."
  ],
  
  "key_risks": [
    {
      "risk": "Teknik olmayan risk açıklaması",
      "business_impact": "Bu olursa ne olur (TL veya operasyonel etki)",
      "urgency": "Bu ay | Gelecek ay | 3 ay içinde"
    }
  ],
  
  "required_decisions": [
    "Yönetim Kurulu'nun onaylaması veya kararlaştırması gereken şeyler (varsa)",
    "Bütçe gerektiren kararlar burada"
  ],
  
  "kvkk_status": "KVKK uyum durumunu 1-2 cümleyle anlat. Ceza riski varsa TL olarak belirt.",
  
  "competitor_context": "Sektör karşılaştırması 1 cümle. Örnek: 'Sektörünüzdeki şirketlerin %78'i sizin üstünüzde.'",
  
  "next_month_focus": "Gelecek ay odaklanılacak tek şey."
}

Önemli: Tüm TL tutarları gerçekçi ve veri destekli olsun.
İstatistik kullanıyorsan kaynak belirt.
`;
```

## PDF Report Design

One-page A4 PDF (landscape orientation). Use Puppeteer to render HTML to PDF.

**Layout (landscape A4, 297×210mm):**

```
┌─────────────────────────────────────────────────────────────────┐
│  CyberStep                    SİBER GÜVENLİK YÖNETİM BRİFİNGİ  │
│  [Şirket Adı]                 [Ay] [Yıl]    GİZLİ             │
├──────────┬──────────────────────────────────┬──────────────────┤
│          │                                  │                  │
│  GENEL   │  DURUM ÖZETİ                    │  RİSK SEVİYESİ  │
│  SKOR    │  [executive_summary]             │                  │
│          │                                  │  ██████ ORTA    │
│  [67]    │  [risk_headline — büyük, kırmızı]│                  │
│  /100    │                                  │  Geçen ay: 61   │
│          │                                  │  Değişim: +6    │
│  [gauge  │                                  │                  │
│  chart]  │                                  │  Sektör: %34    │
│          │                                  │                  │
├──────────┴──────────────────────────────────┴──────────────────┤
│  BU AY BAŞARILAR          │  AÇIK RİSKLER (Öncelik Sırasıyla) │
│  ✅ [achievement 1]       │  🔴 [risk 1] — [iş etkisi]        │
│  ✅ [achievement 2]       │  🟡 [risk 2] — [iş etkisi]        │
│                           │  🟡 [risk 3] — [iş etkisi]        │
├───────────────────────────┼────────────────────────────────────┤
│  YÖNETİM KARARI GEREKTİREN│  KVKK DURUM  │  GELECEK AY        │
│  [decision 1]             │  [kvkk_status]│  [next_month_focus]│
│  [decision 2]             │              │                    │
├───────────────────────────┴──────────────┴────────────────────┤
│  [6 aylık skor trend grafiği — mini sparkline]                 │
│  ─────────────────────────────────────────────────────────────│
│  cyberstep.io  •  Rapor tarihi: [tarih]  •  [verify linki]    │
└─────────────────────────────────────────────────────────────────┘
```

Colors:
- Risk YÜKSEK: #FF4560 background
- Risk ORTA: #FFB020 background  
- Risk DÜŞÜK: #00E096 background
- Achievements: green checkmarks
- Open risks: red/yellow dots

## API Endpoints

```
GET  /api/board-report/recipients           — List board report recipients
POST /api/board-report/recipients           — Add recipient
DELETE /api/board-report/recipients/:id     — Remove recipient
GET  /api/board-report/reports              — List reports
GET  /api/board-report/reports/:id          — Get report
POST /api/board-report/reports/generate     — Generate now (manual trigger)
PUT  /api/board-report/reports/:id/approve  — Approve draft
POST /api/board-report/reports/:id/send     — Send to recipients
GET  /api/board-report/reports/:id/pdf      — Download PDF
PUT  /api/board-report/settings            — Update auto-send settings
```

## Frontend — Yönetim Kurulu Raporu Page (`/hesabim/yonetim-raporu`)

**Settings Panel:**
```
┌─────────────────────────────────────────────┐
│  Aylık Yönetim Kurulu Brifing Raporu        │
│                                             │
│  Alıcılar:                                  │
│  [İsim] [E-posta] [Unvan] [Sil]            │
│  [+ Alıcı Ekle]                            │
│                                             │
│  Otomatik Gönderim:                         │
│  ○ Her ayın 1'i   ● Her ayın 5'i           │
│  ○ Manuel onaydan sonra                     │
│                                             │
│  [Şimdi Oluştur] [Taslağı Önizle]          │
└─────────────────────────────────────────────┘
```

**Report Preview:**
- Show generated PDF inline (iframe or image)
- Edit mode: click any section to edit the AI-generated text
- Send button: "Onaylandı — Gönder" 

## Cron Jobs

```typescript
// Generate board reports — 1st of each month at 07:00
cron.schedule('0 7 1 * *', generateAllBoardReports);

// Auto-send approved reports — 5th of each month at 09:00
cron.schedule('0 9 5 * *', sendApprovedBoardReports);
```

## Email Delivery

Send as beautifully formatted HTML email with PDF attached:

Subject: `[Şirket Adı] — Mayıs 2026 Siber Güvenlik Yönetim Brifing`

Email body:
```
Sayın [İsim],

[Şirket Adı]'nın Mayıs 2026 siber güvenlik brifing raporu ekte.

Bu ay özeti:
• Güvenlik skoru: 67/100 (geçen ay: 61, +6 iyileşme)
• Açık kritik risk: 2
• Risk seviyesi: ORTA

Detaylı rapor ekte PDF olarak sunulmuştur.

CyberStep.io
```

---

*4 Replit Agent Promptu — CyberStep.io — Mayıs 2026*
