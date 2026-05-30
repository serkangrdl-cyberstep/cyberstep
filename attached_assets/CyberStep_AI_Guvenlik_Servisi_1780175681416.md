# CyberStep — Yapay Zeka Güvenlik Servisi
## Tasarım Dökümanı + Replit Agent Promptu

---

## BÖLÜM 1: SERVİS TASARIMI

### 1.1 Servis Adı ve Konumlandırma

Servis Adı: CyberStep AI Risk Taraması
Tagline: "Çalışanlarınız yapay zekaya ne gönderiyor? KVKK ne diyor?"

Türkiye'de bu soruyu soran başka bir platform yok.
SecurityScorecard, BitSight gibi global araçlarda AI güvenlik değerlendirmesi yok.
KVKK + AI kombinasyonu tamamen CyberStep'e özgü diferansiasyon.

### 1.2 Hedef Kitle

Birincil: 10-200 çalışanlı KOBİ — özellikle ChatGPT/Copilot kullanan sektörler
Sektör önceliği: Hukuk büroları, muhasebe firmaları, sağlık, fintech, e-ticaret
Karar verici: Genel müdür veya IT yöneticisi
Tetikleyici: KVKK denetimi, müşteri talebi, haberlerden öğrenme

### 1.3 Servis Bileşenleri

BILEŞEN A — AI Araç Risk Skorkartı:
Şirkette kullanılan 20+ AI aracının risk profilini gösterir.
Her araç için: veri saklama politikası, eğitim verisi kullanımı, KVKK uyumluluğu, enterprise vs ücretsiz katman farkı.
Örnek çıktı: "ChatGPT ücretsiz sürümü veriyi modeli eğitmek için kullanabilir. Enterprise sürüm bu riski kaldırır."

BILEŞEN B — Veri Maruz Kalma Değerlendirmesi (25 Soru):
Çalışanların AI araçlarına ne tür veri gönderdiğini sorgular.
KVKK kategorileriyle eşleştirir: kişisel veri mi, özel nitelikli mi, finansal mı?
Risk skoru üretir: "Bu kullanım KVKK Madde 9 kapsamında yurt dışına veri aktarımı sayılabilir."

BILEŞEN C — Gölge AI Tespiti (Shadow AI Discovery):
DNS kayıtları ve domain tarama ile şirketin hangi AI servislerine bağlandığını tespit eder.
Yetkisiz veya bilinmeyen AI araç kullanımını ortaya çıkarır.
"IT departmanının haberi olmadan 7 farklı AI servisine bağlantı tespit edildi."

BILEŞEN D — AI Politika Üretici:
Claude ile şirkete özel "Yapay Zeka Kabul Edilebilir Kullanım Politikası" üretir.
KVKK gerekliliklerini karşılar.
Çalışanlara imzalatılabilir format.

BILEŞEN E — KVKK-AI Uyum Haritası:
Tespit edilen AI kullanımını KVKK maddeleriyle eşleştirir.
Tahmini ceza riski hesaplar.
Aksiyon planı üretir.

### 1.4 Çıktı Raporu

"CyberStep AI Risk Raporu" şunları içerir:
- AI Araç Risk Skorkartı (tablo + renk kodlu)
- Veri maruz kalma seviyesi (Kritik / Yüksek / Orta / Düşük)
- Tespit edilen gölge AI araçları listesi
- KVKK uyum durumu
- Şirkete özel "Yapay Zeka Kullanım Politikası" belgesi (hazır imzalatılabilir)
- 5 öncelikli aksiyon adımı

### 1.5 Fiyatlandırma

Standalone: 2.900 TL (tek seferlik)
Tam Assessment eklentisi: +1.500 TL
Büyüme Plan dahil: yıllık abonelikte dahil (aylık otomatik tarama)
Partner white-label: KVKK danışmanları kendi müşterilerine sunabilir

---

## BÖLÜM 2: AI ARAÇ RİSK SKORKART VERİTABANI

Her araç için standartlaştırılmış risk profili:

ChatGPT (OpenAI) Ücretsiz:
- Veri saklama: 30 gün (opt-out ile 0)
- Eğitim için kullanım: Evet (opt-out ile hayır)
- KVKK uyum: Kısmi (ABD şirketi, SCCs ile aktarım)
- Risk seviyesi: YÜKSEK
- Tavsiye: Enterprise veya Team planına geç veya kullanım kısıtla

ChatGPT (OpenAI) Enterprise/Team:
- Veri saklama: Müşteri kontrolünde
- Eğitim için kullanım: Hayır
- KVKK uyum: Daha iyi (DPA imzalanabilir)
- Risk seviyesi: ORTA
- Tavsiye: DPA imzala, kullanım politikası oluştur

Microsoft Copilot (M365 Enterprise):
- Veri saklama: Microsoft tenant içinde
- Eğitim için kullanım: Hayır
- KVKK uyum: İyi (Microsoft DPA + EU Data Boundary)
- Risk seviyesi: DÜŞÜK
- Tavsiye: Politika oluştur, hassas veri paylaşımını kısıtla

Google Gemini (Ücretsiz / Workspace):
- Ücretsiz: Risk YÜKSEK (veri Google tarafından işlenebilir)
- Workspace Enterprise: Risk ORTA
- KVKK uyum: Kısmi
- Tavsiye: Workspace Enterprise kullan, DPA imzala

Claude (Anthropic) — Ücretsiz:
- Veri saklama: 30 gün
- Eğitim için kullanım: Kısmi (abuse detection için)
- KVKK uyum: Kısmi
- Risk seviyesi: ORTA-YÜKSEK

Claude (Anthropic) — Pro/API:
- Veri saklama: Ayarlanabilir
- Eğitim için kullanım: Opt-out mevcut
- Risk seviyesi: ORTA

GitHub Copilot:
- Veri saklama: Geçici (snippet bazlı)
- Eğitim için kullanım: Business plan: Hayır
- Risk seviyesi: DÜŞÜK-ORTA
- Tavsiye: Business plan kullan

Perplexity:
- Veri saklama: Belirsiz
- Risk seviyesi: YÜKSEK
- Tavsiye: Hassas veri girme

DeepL (Ücretsiz):
- Veri saklama: Güvenlik amacıyla 7 gün
- Risk seviyesi: ORTA
- Tavsiye: Pro plan al (veri saklanmaz)

DeepL Pro:
- Veri saklama: Yok
- Risk seviyesi: DÜŞÜK

Midjourney:
- Veri saklama: Oluşturulan görseller kamuya açık (ücretsiz)
- Risk seviyesi: YÜKSEK (gizli belge görseli yükleme)
- Tavsiye: Hiçbir şirkete ait görsel/belge yükleme

Notion AI:
- Veri saklama: Notion workspace içinde
- Risk seviyesi: ORTA
- Tavsiye: DPA imzala

Grammarly:
- Veri saklama: İşledikten sonra siler (Business plan)
- Risk seviyesi: ORTA (ücretsiz) / DÜŞÜK (Business)
- Tavsiye: Business plan

---

## BÖLÜM 3: DEĞERLENDİRME SORULARI (25 Soru)

Alan 1 — AI Araç Kullanım Durumu (5 soru):
1. Şirketinizde çalışanların kullandığı yapay zeka araçlarını biliyor musunuz? [3x]
2. IT departmanının onaylamadığı yapay zeka araçlarının kullanımı kısıtlanıyor mu? [2x]
3. Yapay zeka araçları kullanımı için yazılı bir şirket politikası veya kural var mı? [2x]
4. Çalışanlara hangi yapay zeka araçlarını kullanabilecekleri konusunda eğitim verildi mi? [1x]
5. Yapay zeka araçlarına şirket verisi girişini denetleyen bir mekanizma var mı? [2x]

Alan 2 — Veri Girişi ve Maruz Kalma (8 soru):
6. Çalışanlar müşteri adı, telefon veya e-posta gibi kişisel bilgileri yapay zeka araçlarına giriyor mu? [3x]
7. Finansal veriler (fatura, banka bilgisi, maaş) yapay zeka araçlarına kopyalanıyor mu? [3x]
8. Şirket sözleşmeleri veya gizlilik anlaşmaları yapay zeka araçlarına yükleniyor mu? [3x]
9. Personele ait veriler (CV, özlük dosyası, performans notu) yapay zeka araçlarına giriliyor mu? [3x]
10. Müşterilere ait sağlık, inanç veya biyometrik gibi özel nitelikli veriler AI araçlarında işleniyor mu? [3x]
11. Şirketin ticari sırları veya stratejik planları yapay zeka araçlarına yazılıyor mu? [2x]
12. Çalışanlar yazışma veya e-postaları doğrudan yapay zeka araçlarına yapıştırıyor mu? [2x]
13. Yapay zeka ile oluşturulan içerik, içerdiği verinin kaynağı doğrulanmadan paylaşılıyor mu? [1x]

Alan 3 — Araç Konfigürasyonu ve Güvenlik (6 soru):
14. Kullanılan AI araçlarında veri eğitime katılım (opt-out) ayarı yapılandırıldı mı? [2x]
15. Kurumsal AI araçları için hizmet sağlayıcı ile Veri İşleme Sözleşmesi (DPA) imzalandı mı? [2x]
16. AI araçlarına erişim için çalışanlara kişisel hesap yerine kurumsal hesap mı kullanılıyor? [2x]
17. Hangi AI araçlarının kullanıldığı ve ne için kullanıldığı kayıt altında tutuluyor mu? [1x]
18. Üretken AI ile oluşturulan içeriğin doğruluğu doğrulanmadan dışarıya gönderilmemesi için kural var mı? [1x]
19. Deepfake veya AI ile oluşturulmuş sahte içerik (ses, görsel, video) konusunda çalışan farkındalığı var mı? [1x]

Alan 4 — KVKK ve Hukuki Uyum (6 soru):
20. Yapay zeka araçlarına kişisel veri girişinin KVKK kapsamında yurt dışı aktarım sayılabileceğinden haberdar mısınız? [2x]
21. AI araçlarını kullanan şirketlerin KVKK Aydınlatma Metni ve Gizlilik Politikaları güncellendi mi? [2x]
22. AI araçlarıyla işlenen kişisel veriler için VERBİS kaydında ilgili başlıklar oluşturuldu mu? [1x]
23. Çalışanlara AI araçları kullanımında KVKK yükümlülükleri anlatıldı mı? [1x]
24. AI araçlarından kaynaklanan veri ihlali durumunda müdahale planına bu senaryo eklendi mi? [2x]
25. Yapay zeka destekli otomatik karar sistemleri kullanılıyorsa KVKK Madde 11/g kapsamı değerlendirildi mi? [2x]

---

## BÖLÜM 4: GÖLGE AI TESPİT MANTIGI

DNS ve domain taraması ile tespit edilecek AI servisleri:

Tespit yöntemi: Mevcut Shodan + crt.sh + DNS taraması üzerine AI endpoint kontrolü ekle.

Kontrol edilecek domainler:
- api.openai.com → ChatGPT/GPT API kullanımı
- generativelanguage.googleapis.com → Gemini API
- copilot.microsoft.com → Microsoft Copilot
- claude.ai / api.anthropic.com → Claude
- perplexity.ai
- deepl.com
- midjourney.com / discord.com (Midjourney için)
- huggingface.co → Açık kaynak AI modelleri
- replicate.com → API bazlı AI kullanımı
- stability.ai → Stable Diffusion
- runwayml.com → Video AI

Tespit yöntemi için müşteri seçeneği:
Seçenek A (Beyan): Müşteri kullandığı araçları formda işaretler
Seçenek B (DNS/Network): Müşteri router/DNS loglarını sağlarsa otomatik tespit (daha sonraki faz)
Seçenek C (Şu an mevcut): Subdomain ve sertifika taramasından dolaylı tespit

---

## BÖLÜM 5: REPLIT AGENT PROMPTU

---

### PROMPT BAŞLANGICI — KOPYALA-YAPIŞTIR

Build a new "AI Security Assessment" module for CyberStep.io. The existing app uses Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React + Iyzico payments. Add this as a completely new assessment type alongside existing mini and full assessments.

## DATABASE CHANGES

Add new columns to existing tables and create new ones:

```sql
-- Add AI assessment type to existing questions table
-- assessment_type already has: 'mini' | 'full' | 'both'
-- Add new value: 'ai_security'

-- New table: ai_tools_registry
CREATE TABLE IF NOT EXISTS ai_tools_registry (
  id serial PRIMARY KEY,
  tool_name varchar(100) NOT NULL,
  provider varchar(100),
  category varchar(50),
  -- 'llm' | 'image_gen' | 'translation' | 'coding' | 'productivity' | 'voice' | 'video'
  tier varchar(30),
  -- 'free' | 'paid_personal' | 'business' | 'enterprise'
  
  -- Risk profile
  risk_level varchar(20),
  -- 'KRITIK' | 'YUKSEK' | 'ORTA' | 'DUSUK'
  data_retention_days integer,
  -- null = unknown, 0 = not retained, N = retained for N days
  trains_on_user_data boolean,
  trains_optout_available boolean,
  gdpr_compliant boolean,
  kvkk_compatible boolean,
  dpa_available boolean,
  -- Can a Data Processing Agreement be signed?
  
  -- Display
  logo_url varchar(500),
  risk_summary text,
  -- 1-2 sentence Turkish risk explanation
  recommendation text,
  -- What to do about this tool (Turkish)
  official_privacy_url varchar(500),
  last_reviewed date,
  
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- New table: ai_assessments
CREATE TABLE IF NOT EXISTS ai_assessments (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  company_name varchar(255),
  contact_email varchar(255),
  sector varchar(100),
  employee_count varchar(50),
  status varchar(20) DEFAULT 'in_progress',
  -- in_progress | completed | report_ready
  
  -- Declared AI tools (from form checkboxes)
  declared_tools jsonb,
  -- Array of tool IDs customer says they use
  
  -- Scan results
  shadow_ai_findings jsonb,
  -- Tools detected via domain scan not declared by customer
  
  -- Scores
  raw_score integer,
  max_score integer,
  percentage integer,
  risk_level varchar(20),
  
  -- Area scores
  area_1_score integer, -- AI Tool Usage
  area_2_score integer, -- Data Exposure
  area_3_score integer, -- Tool Configuration
  area_4_score integer, -- KVKK Compliance
  
  -- AI-generated content
  report_json jsonb,
  policy_document text,
  -- Generated acceptable use policy
  pdf_path varchar(500),
  
  -- Payment
  payment_status varchar(20) DEFAULT 'unpaid',
  -- unpaid | paid | free (if part of subscription)
  price_tl integer DEFAULT 2900,
  
  created_at timestamp DEFAULT now(),
  completed_at timestamp,
  report_generated_at timestamp
);

-- New table: ai_assessment_answers
CREATE TABLE IF NOT EXISTS ai_assessment_answers (
  id serial PRIMARY KEY,
  ai_assessment_id integer REFERENCES ai_assessments(id),
  question_id integer REFERENCES questions(id),
  answer varchar(20),
  -- 'evet' | 'kismen' | 'hayir' | 'bilmiyorum'
  created_at timestamp DEFAULT now()
);
```

## AI TOOLS REGISTRY SEED DATA

Insert these tools into ai_tools_registry:

```sql
INSERT INTO ai_tools_registry 
(tool_name, provider, category, tier, risk_level, data_retention_days, 
 trains_on_user_data, trains_optout_available, kvkk_compatible, dpa_available,
 risk_summary, recommendation) 
VALUES

('ChatGPT', 'OpenAI', 'llm', 'free', 'YUKSEK', 30,
 true, true, false, false,
 'Ücretsiz sürümde girilen veriler OpenAI tarafından model eğitimi için kullanılabilir. Kişisel veri girişi KVKK kapsamında yurt dışı aktarım sayılır.',
 'Ücretsiz sürümde şirket verisi girmeyin. Team veya Enterprise plana geçin ve veri eğitimini devre dışı bırakın.'),

('ChatGPT Team/Enterprise', 'OpenAI', 'llm', 'enterprise', 'ORTA', 0,
 false, false, true, true,
 'Enterprise ve Team planlarda veriler eğitim için kullanılmaz. DPA imzalanabilir. GDPR uyumlu.',
 'DPA imzalayın ve şirket için AI kullanım politikası oluşturun.'),

('Microsoft Copilot (M365)', 'Microsoft', 'llm', 'enterprise', 'DUSUK', 0,
 false, false, true, true,
 'Microsoft 365 tenant içinde çalışır. Veriler Microsoft altyapısında kalır. EU Data Boundary desteği var.',
 'Kurumsal Microsoft hesabı kullanılıyorsa düşük risk. Kullanım politikası oluşturun.'),

('Google Gemini (Ücretsiz)', 'Google', 'llm', 'free', 'YUKSEK', 18*30,
 true, true, false, false,
 'Google hesabıyla kullanılan ücretsiz sürümde veriler Google tarafından işlenir ve servis iyileştirme için kullanılabilir.',
 'Ücretsiz sürümde hassas veri girmeyin. Google Workspace Enterprise kullanın.'),

('Google Gemini (Workspace)', 'Google', 'llm', 'enterprise', 'ORTA', 0,
 false, false, true, true,
 'Google Workspace aboneliğiyle gelen Gemini, veriyi eğitim için kullanmaz. DPA imzalanabilir.',
 'DPA imzalayın. Çalışanlara kullanım kuralları bildirin.'),

('Claude (Anthropic) Ücretsiz', 'Anthropic', 'llm', 'free', 'ORTA', 30,
 false, false, false, false,
 'Ücretsiz sürümde konuşmalar güvenlik ve kötüye kullanım tespiti amacıyla işlenebilir. Yurt dışı veri aktarımı riski var.',
 'Hassas veri girmeyin. Pro veya API planına geçin.'),

('Claude Pro/API', 'Anthropic', 'llm', 'paid_personal', 'DUSUK', 0,
 false, true, true, true,
 'Pro ve API planlarında DPA imzalanabilir. Veriler eğitim için kullanılmaz (opt-out yapılmışsa).',
 'DPA imzalayın ve kullanım politikası oluşturun.'),

('GitHub Copilot Individual', 'Microsoft/GitHub', 'coding', 'paid_personal', 'ORTA', 0,
 true, true, false, false,
 'Bireysel planda kod parçaları model eğitimi için kullanılabilir. Kaynak kodu ve API anahtarı sızıntısı riski.',
 'Business plana geçin. Kod içinde şifre veya API anahtarı bırakmayın.'),

('GitHub Copilot Business', 'Microsoft/GitHub', 'coding', 'business', 'DUSUK', 0,
 false, false, true, true,
 'Business planda veriler eğitim için kullanılmaz. DPA imzalanabilir.',
 'DPA imzalayın. Geliştiricilere güvenli kodlama kurallarını hatırlatın.'),

('Perplexity AI', 'Perplexity', 'llm', 'free', 'YUKSEK', 90,
 true, false, false, false,
 'Gizlilik politikası belirsiz bölümler içeriyor. Veri saklama ve kullanım koşulları kapsamlı değil.',
 'Şirket verisi veya müşteri bilgisi girmeyin.'),

('DeepL (Ücretsiz)', 'DeepL', 'translation', 'free', 'ORTA', 7,
 false, false, false, false,
 'Ücretsiz sürümde metinler güvenlik amaçlı 7 gün saklanabilir. Gizli belge çevirisi risk taşır.',
 'Gizli belge ve sözleşme çevirisi için DeepL Pro kullanın.'),

('DeepL Pro', 'DeepL', 'translation', 'business', 'DUSUK', 0,
 false, false, true, true,
 'Pro planda çevrilen metinler saklanmaz. GDPR uyumlu. DPA imzalanabilir.',
 'Güvenle kullanılabilir. DPA imzalayın.'),

('Midjourney (Ücretsiz/Basic)', 'Midjourney', 'image_gen', 'free', 'KRITIK', 999,
 true, false, false, false,
 'Ücretsiz ve Basic planda oluşturulan tüm görseller kamuya açık galeride görünür. Şirket belgesi veya gizli görsel yüklemeyin.',
 'Kesinlikle şirket belgesi, logo tasarımı veya hassas içerik oluşturmak için kullanmayın.'),

('Midjourney Pro/Mega', 'Midjourney', 'image_gen', 'paid_personal', 'ORTA', 999,
 true, false, false, false,
 'Üst planlarda gizli mod mevcut. Ancak veriler hâlâ Midjourney sunucularında kalır.',
 'Gizli mod aktive edin. Şirket bilgisi içeren görsel oluşturmayın.'),

('Notion AI', 'Notion', 'productivity', 'business', 'ORTA', 0,
 false, false, true, true,
 'Notion workspace içindeki verilerle çalışır. Business veya Enterprise planda DPA imzalanabilir.',
 'Enterprise plana geçin, DPA imzalayın.'),

('Grammarly (Ücretsiz)', 'Grammarly', 'productivity', 'free', 'YUKSEK', 365,
 true, true, false, false,
 'Düzeltme için gönderilen metinler Grammarly tarafından işlenir ve hizmet iyileştirme için kullanılabilir.',
 'Gizli belge veya müşteri e-postası düzeltmeyin. Business plana geçin.'),

('Grammarly Business', 'Grammarly', 'productivity', 'business', 'DUSUK', 0,
 false, false, true, true,
 'Business planda veriler saklanmaz. GDPR ve CCPA uyumlu. DPA imzalanabilir.',
 'DPA imzalayın.'),

('Adobe Firefly', 'Adobe', 'image_gen', 'business', 'DUSUK', 30,
 false, true, true, true,
 'Telif hakkı güvenceli içerik üretimi. Enterprise planda DPA mevcut. İyi gizlilik politikası.',
 'Creative Cloud Business ile güvenle kullanılabilir.'),

('Runway ML', 'Runway', 'video', 'paid_personal', 'YUKSEK', 90,
 true, false, false, false,
 'Video ve görsel veriler model eğitimi için kullanılabilir. Gizlilik politikası yetersiz.',
 'Şirket logosu veya kişisel görüntü içeren video oluşturmaktan kaçının.'),

('Whisper/ElevenLabs (Ses AI)', 'Various', 'voice', 'free', 'KRITIK', 999,
 true, false, false, false,
 'Ses verileri en hassas biyometrik veri kategorisinde. KVKK özel nitelikli veri kapsamında. Yüksek risk.',
 'Müşteri veya çalışan sesi kesinlikle bu araçlara yüklemeyin. KVKK ihlali riski çok yüksek.');
```

## AI ASSESSMENT QUESTIONS (Insert into questions table)

```sql
INSERT INTO questions 
(domain, area_label, question_text, help_text, weight, isRedAlarm, assessment_type, sort_order)
VALUES

-- ALAN 1 — AI Araç Yönetimi (5 soru)
('AI1', 'Yapay Zeka Araç Yönetimi',
 'Şirketinizde çalışanların hangi yapay zeka araçlarını kullandığı takip ediliyor mu?',
 'ChatGPT, Gemini, Copilot gibi araçların kimler tarafından, ne amaçla kullanıldığını biliyor musunuz?',
 3, true, 'ai_security', 1),

('AI1', 'Yapay Zeka Araç Yönetimi',
 'IT departmanının onaylamadığı yapay zeka araçlarının kullanımı kısıtlanıyor mu?',
 'Çalışanlar herhangi bir yapay zeka aracını serbestçe kullanabiliyor mu? Onay mekanizması var mı?',
 2, true, 'ai_security', 2),

('AI1', 'Yapay Zeka Araç Yönetimi',
 'Yapay zeka araçları kullanımı için yazılı bir şirket politikası veya kural seti var mı?',
 '"Yapay zekaya şu tür veri girilmez" gibi yazılı bir kural belgesi hazırlandı mı?',
 2, false, 'ai_security', 3),

('AI1', 'Yapay Zeka Araç Yönetimi',
 'Çalışanlara hangi yapay zeka araçlarını kullanabilecekleri ve nasıl güvenli kullanacakları konusunda eğitim verildi mi?',
 'Farkındalık eğitimi olmadan çalışanlar risk oluşturduğunun farkında olmayabilir.',
 1, false, 'ai_security', 4),

('AI1', 'Yapay Zeka Araç Yönetimi',
 'Şirkette kullanılan yapay zeka araçları için kurumsal (işletme) hesap mı yoksa kişisel hesap mı kullanılıyor?',
 'Kişisel hesapla kullanılan araçlar şirket kontrolü dışında. Kurumsal hesap veri güvenliğini artırır.',
 2, false, 'ai_security', 5),

-- ALAN 2 — Veri Maruz Kalma (8 soru)
('AI2', 'Veri Maruz Kalma Riski',
 'Çalışanlar müşteri adı, telefon veya e-posta gibi kişisel bilgileri yapay zeka araçlarına giriyor mu?',
 'KVKK kapsamındaki kişisel veri, açık rıza olmadan yurt dışı bir AI sunucusuna gönderilemez.',
 3, true, 'ai_security', 6),

('AI2', 'Veri Maruz Kalma Riski',
 'Finansal veriler (fatura detayı, banka bilgisi, maaş bilgisi) yapay zeka araçlarına kopyalanıyor mu?',
 'Finansal veri hem KVKK hem ticari sır kapsamında. AI aracına yapıştırılması ciddi risk.',
 3, true, 'ai_security', 7),

('AI2', 'Veri Maruz Kalma Riski',
 'Şirket sözleşmeleri, teklifler veya gizlilik anlaşmaları yapay zeka araçlarına yükleniyor mu?',
 'Sözleşme içeriği rakiplerin veya kötü niyetli kişilerin eline geçebilir. Ticari sır riski yüksek.',
 3, true, 'ai_security', 8),

('AI2', 'Veri Maruz Kalma Riski',
 'Çalışan özlük dosyası, maaş bilgisi veya performans değerlendirmesi gibi personel verileri AI araçlarında işleniyor mu?',
 'Personel verisi KVKK özel kategorisine yakın. AI araçlarına girişi ciddi hukuki risk doğurur.',
 3, true, 'ai_security', 9),

('AI2', 'Veri Maruz Kalma Riski',
 'Müşterilere ait sağlık, inanç veya biyometrik gibi özel nitelikli veriler yapay zeka araçlarında işleniyor mu?',
 'Özel nitelikli kişisel veri en yüksek KVKK korumasına tabi. AI araçlarına girişi doğrudan ihlal.',
 3, true, 'ai_security', 10),

('AI2', 'Veri Maruz Kalma Riski',
 'Şirketin ticari sırları, stratejik planları veya rakip analizleri yapay zeka araçlarına yazılıyor mu?',
 'Yapay zeka sağlayıcısı bu bilgilere erişebilir. Rekabet avantajı kaybolabilir.',
 2, true, 'ai_security', 11),

('AI2', 'Veri Maruz Kalma Riski',
 'Müşteri veya iş ortağı e-postaları yapay zeka araçlarına doğrudan kopyalanıyor mu?',
 'E-posta içeriğinde yer alan kişisel veriler AI aracına iletilmiş olur. KVKK açısından riskli.',
 2, false, 'ai_security', 12),

('AI2', 'Veri Maruz Kalma Riski',
 'Ses kayıtları veya görüntüler (toplantı kaydı, müşteri fotoğrafı) yapay zeka araçlarına yükleniyor mu?',
 'Ses verisi KVKK kapsamında biyometrik veri sayılabilir. Ses AI araçlarına yüklenmesi çok yüksek risk.',
 3, true, 'ai_security', 13),

-- ALAN 3 — Araç Konfigürasyonu (6 soru)
('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'Kullanılan AI araçlarında veri eğitiminden çıkış (opt-out) ayarı yapılandırıldı mı?',
 'Çoğu AI aracında "Verilerimi eğitim için kullanma" seçeneği var. Bu ayar aktive edildi mi?',
 2, true, 'ai_security', 14),

('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'Kurumsal AI araçları için hizmet sağlayıcıyla Veri İşleme Sözleşmesi (DPA) imzalandı mı?',
 'KVKK''ya göre kişisel veri işleten üçüncü taraflarla DPA imzalanması zorunlu.',
 2, true, 'ai_security', 15),

('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'AI araçlarına erişimde çalışanlara kişisel hesap yerine kurumsal hesap zorunluluğu getiriliyor mu?',
 'Kurumsal hesap, hangi çalışanın ne zaman ne kullandığını izlemeyi mümkün kılar.',
 2, false, 'ai_security', 16),

('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'Hangi yapay zeka araçlarının kullanıldığı ve bunların ne için kullanıldığı kayıt altında tutuluyor mu?',
 'Audit trail olmadan KVKK denetiminde "ne işlendi" sorusunu yanıtlamak çok zorlaşır.',
 1, false, 'ai_security', 17),

('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'AI ile üretilen içeriklerin doğruluğu kontrol edilmeden dışarıya (müşteri, resmi kurum) gönderilmemesi için kural var mı?',
 'AI "hallüsinasyon" yapabilir: olmayan bilgi üretebilir. Bu içerik müşteriye giderse hukuki sorumluluk doğar.',
 1, false, 'ai_security', 18),

('AI3', 'Araç Konfigürasyonu ve Kontrol',
 'Deepfake veya yapay zeka ile oluşturulmuş sahte içerik (ses taklidi, görsel manipülasyon) konusunda çalışan farkındalığı oluşturuldu mu?',
 '"CEO''nuzun sesi gibi konuşan biri para istiyor" — bu saldırı Türkiye''de artıyor. Hazırlıklı mısınız?',
 1, false, 'ai_security', 19),

-- ALAN 4 — KVKK ve Hukuki Uyum (6 soru)
('AI4', 'KVKK ve Hukuki Uyum',
 'Yapay zeka araçlarına kişisel veri girişinin KVKK kapsamında yurt dışına veri aktarımı sayılabileceği bilinciyle hareket ediliyor mu?',
 'ChatGPT, Gemini gibi ABD menşeli araçlara kişisel veri göndermek KVKK Madde 9 kapsamında yurt dışı aktarım.',
 2, true, 'ai_security', 20),

('AI4', 'KVKK ve Hukuki Uyum',
 'Yapay zeka araçlarının kullanımı, şirketin KVKK Aydınlatma Metni ve Gizlilik Politikasına yansıtıldı mı?',
 '"Verileriniz AI araçlarıyla işlenebilir" ifadesi aydınlatma metninde yer alıyor mu?',
 2, false, 'ai_security', 21),

('AI4', 'KVKK ve Hukuki Uyum',
 'AI araçlarıyla işlenen kişisel veriler için VERBİS kaydında gerekli başlık oluşturuldu mu?',
 'Yeni bir veri işleme faaliyeti başladığında VERBİS''in güncellenmesi KVKK gereği.',
 1, false, 'ai_security', 22),

('AI4', 'KVKK ve Hukuki Uyum',
 'Çalışanlara yapay zeka kullanımında KVKK yükümlülükleri ve sorumlulukları anlatıldı mı?',
 'Çalışan farkındalığı hem hukuki yükümlülük hem etkin koruma için zorunlu.',
 1, false, 'ai_security', 23),

('AI4', 'KVKK ve Hukuki Uyum',
 'Yapay zeka aracından kaynaklanan veri ihlali senaryosu olay müdahale planına eklendi mi?',
 '"AI aracına yanlışlıkla müşteri verisi girdik" — bu durumda 72 saatlik KVKK bildirimi prosedürü hazır mı?',
 2, true, 'ai_security', 24),

('AI4', 'KVKK ve Hukuki Uyum',
 'Otomatik karar veren yapay zeka sistemi kullanılıyorsa (kredi skoru, işe alım filtresi) KVKK Madde 11 kapsamı değerlendirildi mi?',
 'Tamamen otomatik kararlar KVKK kapsamında özel yükümlülükler gerektirir.',
 2, false, 'ai_security', 25);
```

## API ROUTES

Add these new routes:

```
POST /api/ai-assessment/start          — Create new AI assessment
GET  /api/ai-assessment/:id            — Get assessment details
POST /api/ai-assessment/:id/tools      — Save declared AI tools list
POST /api/ai-assessment/:id/answers    — Save questionnaire answers
POST /api/ai-assessment/:id/complete   — Complete + trigger AI report generation
GET  /api/ai-assessment/:id/report     — Get report (poll every 2s)
GET  /api/ai-assessment/:id/policy     — Get generated policy document
GET  /api/ai-assessment/:id/pdf        — Download PDF report

GET  /api/ai-tools                     — List all tools in registry
GET  /api/ai-tools/:id                 — Single tool risk profile
GET  /api/ai-tools/check/:domain       — Check if domain uses known AI services

Admin:
GET  /api/admin/ai-assessments         — List all AI assessments
GET  /api/admin/ai-tools               — Manage tool registry
PUT  /api/admin/ai-tools/:id           — Update tool risk profile
```

## SCORING LOGIC

```typescript
// AI Assessment specific scoring
const AI_MAX_SCORES = {
  total: 25 * 5, // Will be weighted
  area_1: 5 * (3+2+2+1+2), // = 50 weighted
  area_2: 8 * (3+3+3+3+3+2+2+3), // = 110 weighted
  area_3: 6 * (2+2+2+1+1+1), // = 45 weighted  
  area_4: 6 * (2+2+1+1+2+2) // = 50 weighted
};

// Shadow AI penalty: -5 points per undeclared tool found
// (detected via domain scan but not listed by customer)

function calculateAIRiskLevel(percentage: number, shadowToolCount: number): string {
  const adjustedPct = Math.max(0, percentage - (shadowToolCount * 3));
  if (adjustedPct <= 30) return 'KRITIK';
  if (adjustedPct <= 50) return 'YUKSEK';
  if (adjustedPct <= 70) return 'ORTA';
  if (adjustedPct <= 85) return 'DUSUK';
  return 'IYI';
}
```

## CLAUDE REPORT GENERATION PROMPT

```typescript
const AI_REPORT_PROMPT = (data: AIAssessmentData) => `
Sen CyberStep.io'nun Yapay Zeka Güvenlik Danışmanısın.
Aşağıdaki AI güvenlik değerlendirme sonuçlarına göre Türkçe rapor hazırla.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}
ÇALIŞAN SAYISI: ${data.employeeCount}
TOPLAM SKOR: ${data.percentage}% — RİSK: ${data.riskLevel}

BEYAN EDİLEN AI ARAÇLARI:
${data.declaredTools.map(t => `- ${t.name} (${t.tier}) — Risk: ${t.riskLevel}`).join('\n')}

TESPIT EDİLEN GÖLGE AI ARAÇLARI (beyan edilmedi):
${data.shadowTools.length > 0 ? data.shadowTools.join(', ') : 'Tespit edilmedi'}

KIRMIZI ALARM SORULAR:
${data.redAlarmAnswers.map(q => `- ${q.questionText}: ${q.answer}`).join('\n')}

JSON FORMATINDA ÜRET:

{
  "risk_headline": "En kritik tek cümle. KVKK veya iş etkisi odaklı.",
  
  "executive_summary": "3-4 cümle. Patron dili. Şirketin AI kullanım profili ve temel riskler.",
  
  "tool_risk_cards": [
    {
      "tool_name": "ChatGPT Ücretsiz",
      "current_usage": "Çalışanlar ne için kullanıyor (beyan veya tahmin)",
      "main_risk": "Bu aracın şirkete özgü riski",
      "kvkk_implication": "KVKK açısından ne anlama geliyor",
      "immediate_action": "Bu hafta yapılacak tek şey"
    }
  ],
  
  "data_exposure_summary": {
    "level": "KRITIK | YUKSEK | ORTA | DUSUK",
    "exposed_data_types": ["Müşteri kişisel verisi", "Finansal kayıtlar"],
    "kvkk_articles": ["Md.9", "Md.12"],
    "estimated_fine_tl": 0
  },
  
  "shadow_ai_alert": "Beyan edilmemiş AI araçları bulunuyorsa uyarı mesajı, yoksa null",
  
  "policy_requirements": [
    "Oluşturulacak politikanın içermesi gereken 5 madde"
  ],
  
  "priority_actions": [
    {
      "action": "Yapılacak iş",
      "why": "Neden önemli (KVKK veya iş etkisi)",
      "how": "Nasıl yapılır (somut adım)",
      "effort": "kolay | orta | zor",
      "timeframe": "bu_hafta | bu_ay | 3_ay"
    }
  ],
  
  "kvkk_compliance_gap": {
    "compliant": false,
    "gaps": ["Eksik olan KVKK gereklilikleri"],
    "dpa_needed_for": ["DPA imzalanması gereken araçlar"]
  }
}

KURAL: Sadece JSON döndür. Teknik terim kullanma.
`;

// POLICY DOCUMENT GENERATION
const AI_POLICY_PROMPT = (data: AIAssessmentData) => `
${data.companyName} şirketi için "Yapay Zeka Araçları Kabul Edilebilir Kullanım Politikası" hazırla.

Şirkette kullanılan araçlar: ${data.declaredTools.map(t => t.name).join(', ')}
Sektör: ${data.sector}
Çalışan sayısı: ${data.employeeCount}

Politika şu bölümleri içermeli:
1. Amaç ve Kapsam
2. Tanımlar (yapay zeka aracı nedir, kişisel veri nedir)
3. İzin Verilen Kullanımlar
4. Yasak Kullanımlar (özellikle: kişisel veri, finansal veri, sözleşme, ses kaydı)
5. Onaylı Araçlar Listesi
6. KVKK Yükümlülükleri
7. Çalışan Sorumlulukları
8. İhlal Durumunda Prosedür
9. Politika Güncelleme Tarihi

Format: Türkçe, resmi belge formatı, imzalanmaya hazır.
Anlaşılır dil: Hukuki jargon değil, çalışanların anlayacağı dil.
Uzunluk: 600-800 kelime.
`;
```

## FRONTEND PAGES

### Page 1: Landing Page (`/ai-guvenlik-degerlendirmesi`)

```
┌─────────────────────────────────────────────────┐
│  🤖 Yapay Zeka Güvenlik Değerlendirmesi         │
│                                                  │
│  "Çalışanlarınız yapay zekaya ne              │
│   gönderiyor? KVKK ne diyor?"                  │
│                                                  │
│  ChatGPT, Gemini, Copilot... Türk              │
│  şirketlerinde her gün milyonlarca kelime       │
│  yapay zeka araçlarına gidiyor. Müşteri         │
│  bilgisi, sözleşme, maaş... Siz de             │
│  bunun farkında mısınız?                        │
│                                                  │
│  Değerlendirme kapsamı:                         │
│  ✓ 20+ yapay zeka aracının risk profili         │
│  ✓ 25 soruluk veri maruz kalma analizi          │
│  ✓ KVKK uyum haritası                          │
│  ✓ Hazır Yapay Zeka Kullanım Politikası         │
│                                                  │
│  Fiyat: 2.900 TL (tek seferlik)                │
│  Süre: ~15 dakika                               │
│                                                  │
│  [Değerlendirmeyi Başlat →]                     │
│  [Önce Ücretsiz Önizleme Gör]                  │
└─────────────────────────────────────────────────┘
```

### Page 2: AI Tools Checklist (`/ai-guvenlik/:id/araclar`)

Show all tools from ai_tools_registry as checkbox grid.
Group by category: Büyük Dil Modeli | Görsel AI | Çeviri | Üretkenlik | Kod
Each tool card shows: name, logo, tier, risk badge.
Customer checks which ones they use.
After selection, show "Seçtiğiniz araçların risk özeti" — counts by risk level.

### Page 3: Questionnaire (`/ai-guvenlik/:id/sorular`)

Same wizard component as main assessment but with AI-specific styling.
Show AI robot icon theme.
After completion, show processing screen: "AI risk raporu hazırlanıyor..."

### Page 4: Report (`/ai-guvenlik/:id/rapor`)

Tabs:
- Genel Bakış: Overall score, risk level, key findings
- Araç Risk Skorkartı: Table of all declared tools with risk profiles
- Veri Maruz Kalma: Data exposure analysis
- KVKK Durumu: Compliance gaps
- Politika Belgesi: Generated policy (editable, downloadable as PDF)
- Aksiyon Planı: Priority list

## EMAIL NOTIFICATIONS

On completion, send to customer:
Subject: "AI Güvenlik Değerlendirmeniz Hazır — [CompanyName]"

Include in email:
- Risk level badge
- Top 3 findings (non-technical)
- Link to full report
- Download policy document button
- "Tam Assessment'e geçin" upsell (if not already done)

## IMPORTANT IMPLEMENTATION NOTES

1. The AI tools registry should be easily updatable via admin panel — AI tools change their privacy policies frequently.

2. Add "last_reviewed" date display on each tool card — shows when CyberStep last verified the risk profile.

3. Shadow AI detection (Phase 1 — simple): During domain scan, check if customer's IP range appears in DNS queries to known AI service domains. This is a heuristic, not guaranteed.

4. Policy document should be downloadable as DOCX (not just PDF) so customers can edit and customize.

5. Add a "Tool no longer exists / privacy policy changed" flag in admin so outdated tools can be quickly marked.

6. The assessment should be re-takeable annually — AI landscape changes fast.

---

*End of Replit Agent Prompt*
```

---

*CyberStep AI Güvenlik Servisi — Tasarım + Replit Promptu — Mayıs 2026*
