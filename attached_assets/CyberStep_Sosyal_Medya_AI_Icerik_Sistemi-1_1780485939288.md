# CyberStep.io — AI Sosyal Medya İçerik Sistemi
## Replit Agent Promptu — Otomatik Üretim, İnsan Onayı, Tek Tuş Yayın

---

## VİZYON

Pazarlama ekibi içerik üretmez, sadece onaylar.

Claude Haiku her hafta otomatik olarak:
- LinkedIn, Instagram, X için ayrı ayrı metin üretir
- Platform boyutlarında görseller oluşturur
- Özel günleri takip eder, zamanında hazırlar
- Tarama verisinden güncel istatistik çeker
- Her şeyi admin panele yükler

İnsan sadece:
- Okur, beğenirse onaylar
- Beğenmezse "Yeniden yaz" der (Claude düzeltir)
- Veya tek cümleyle spontane içerik ister
- Onayladığını tek tuşla yayınlar

**AI tier:** claude-haiku-4-5 — tüm üretim buradan.
Tüm haftalık içerik maliyeti: ~$0.05-0.15.

---

## BÖLÜM 1: VERİTABANI

```sql
-- Platform hesapları
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id serial PRIMARY KEY,
  platform varchar(20) UNIQUE NOT NULL,
  -- 'linkedin' | 'instagram' | 'x'
  account_name varchar(100),
  account_id varchar(100),
  -- Platform'un kendi ID'si
  access_token text,
  -- Şifreli — ENCRYPTION_KEY ile
  token_expires_at timestamp,
  is_active boolean DEFAULT true,
  last_posted_at timestamp,
  created_at timestamp DEFAULT now()
);

-- Özel günler takvimi
CREATE TABLE IF NOT EXISTS special_days (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  name_en varchar(255),
  day integer,
  -- NULL ise hesaplanan gün (dini bayramlar)
  month integer,
  -- NULL ise hesaplanan
  is_lunar boolean DEFAULT false,
  -- Ramazan, Kurban Bayramı
  category varchar(30),
  -- 'national' | 'religious' | 'cybersecurity' | 'global'
  tone varchar(20),
  -- 'celebratory' | 'solemn' | 'awareness'
  cybersecurity_angle text,
  -- Bu günü siber güvenlikle nasıl ilişkilendirebiliriz?
  is_active boolean DEFAULT true
);

-- Türkiye + siber güvenlik özel günleri
INSERT INTO special_days
  (name, day, month, category, tone, cybersecurity_angle)
VALUES
  ('Cumhuriyet Bayramı', 29, 10, 'national', 'celebratory',
   'Dijital Türkiye de güvende olmalı. 7545 Kanunu bu yolda önemli bir adım.'),
  ('Atatürk''ü Anma Günü', 10, 11, 'national', 'solemn',
   'Ulu Önder''in mirası güçlü bir Türkiye. Dijital çağda bu güç siber güvenlikten geçiyor.'),
  ('Ulusal Egemenlik Günü', 23, 4, 'national', 'celebratory',
   'Dijital egemenlik de ulusal egemenliğin parçası.'),
  ('Gençlik Bayramı', 19, 5, 'national', 'celebratory',
   'Gençlerimizin dijital geleceği güvende olsun.'),
  ('Zafer Bayramı', 30, 8, 'national', 'celebratory',
   'Siber uzayda da zafer kazanacağız.'),
  ('Yılbaşı', 1, 1, 'global', 'celebratory',
   'Yeni yılda siber güvenlik önceliğiniz olsun. Ücretsiz tarama hediyemiz.'),
  -- Siber güvenlik özel günleri
  ('Dünya Şifre Günü', NULL, 5, 'cybersecurity', 'awareness',
   'Her yılın 1. Perşembesi. Şifreleriniz ne kadar güçlü?'),
  ('Veri Gizliliği Günü', 28, 1, 'cybersecurity', 'awareness',
   'Verilerinizin değerini biliyor musunuz?'),
  ('Daha Güvenli İnternet Günü', NULL, 2, 'cybersecurity', 'awareness',
   'İnternet Güvenliği Günü — Şubat''ın ikinci Salısı.'),
  ('Dünya Yedekleme Günü', 31, 3, 'cybersecurity', 'awareness',
   'Verilerinizi yedeklediniz mi? Fidye yazılımına hazırlık.');

-- Ramazan ve Kurban Bayramı için ayrı hesaplama:
-- Her yıl tarihleri değişiyor, yıllık manuel güncelleme

-- İçerik takvimi (haftalık plan)
CREATE TABLE IF NOT EXISTS content_calendar (
  id serial PRIMARY KEY,
  week_start date NOT NULL,
  -- Pazartesi tarihi
  generated_at timestamp,
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'generated' | 'partially_approved' | 'completed'
  total_posts integer DEFAULT 0,
  approved_posts integer DEFAULT 0,
  published_posts integer DEFAULT 0,
  generation_cost_usd decimal(8,6) DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Her post (metin + görsel + durum)
CREATE TABLE IF NOT EXISTS social_media_posts (
  id serial PRIMARY KEY,
  calendar_id integer REFERENCES content_calendar(id),

  -- Platform ve zamanlama
  platform varchar(20) NOT NULL,
  -- 'linkedin' | 'instagram' | 'x'
  post_type varchar(30) DEFAULT 'standard',
  -- 'standard' | 'carousel' | 'thread' |
  -- 'special_day' | 'cve_alert' | 'monthly_report' |
  -- 'data_insight' | 'tip' | 'spontaneous'
  scheduled_date date,
  scheduled_time time DEFAULT '09:30',
  -- Türkiye pazarı için ideal saat

  -- İçerik (Claude üretimi)
  caption text,
  -- Ana metin
  hashtags text[],
  alt_text varchar(500),
  -- Görsel açıklaması (erişilebilirlik)

  -- Carousel / Thread için
  slides jsonb,
  -- [{slide_number, text, visual_hint}]
  thread_tweets jsonb,
  -- [{tweet_no, text}] — X thread için

  -- Görsel
  image_svg text,
  -- Kaynak SVG
  image_png_path varchar(500),
  -- Render edilmiş PNG dosya yolu
  image_dimensions varchar(20),
  -- '1080x1080' | '1200x628' | '1500x500'

  -- İnsan kontrolü
  status varchar(20) DEFAULT 'draft',
  -- 'draft'           → Claude ürettı, incelenmedi
  -- 'needs_revision'  → İnsan "yeniden yaz" dedi
  -- 'approved'        → Onaylandı, yayına hazır
  -- 'published'       → Yayınlandı
  -- 'rejected'        → Reddedildi

  revision_request text,
  -- İnsan "şunu değiştir" yazdı
  revision_count integer DEFAULT 0,
  approved_by varchar(100),
  approved_at timestamp,

  -- Yayın
  published_at timestamp,
  platform_post_id varchar(255),
  -- Platform'un verdiği post ID'si
  platform_post_url varchar(500),

  -- Performans (yayın sonrası)
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  fetched_at timestamp,

  -- Meta
  special_day_id integer REFERENCES special_days(id),
  data_source varchar(100),
  -- 'monthly_report' | 'cve_system' | 'scan_stats' | 'manual'
  generation_prompt text,
  -- Hangi prompt kullanıldı (debug için)
  generation_cost_usd decimal(8,6) DEFAULT 0,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- İçerik şablonları (Claude'a yol gösterir)
CREATE TABLE IF NOT EXISTS content_templates (
  id serial PRIMARY KEY,
  platform varchar(20) NOT NULL,
  post_type varchar(30) NOT NULL,
  name varchar(100),
  system_prompt text,
  user_prompt_template text,
  -- {PLATFORM}, {DATE}, {DATA}, {TONE} gibi değişkenler
  example_output text,
  max_tokens integer DEFAULT 300,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: ŞABLONLAR VE PROMPT'LAR

```typescript
// src/socialMedia/templates.ts

// Varsayılan system prompt — tüm içerikler için
export const CYBERSTEP_SOCIAL_SYSTEM_PROMPT = `
Sen CyberStep.io'nun sosyal medya editörüsün.
Türkiye'nin bağımsız siber güvenlik platformu.

Marka sesi:
  - Otoriter ama erişilebilir
  - Veri odaklı (rakamlar kullan)
  - Korku değil, farkındalık
  - Türkçe, akıcı, doğal
  - Asla "hizmet satın alın" tonu

Platform kuralları:
  LinkedIn: Profesyonel, içgörü odaklı, 1200 karakter max
  Instagram: Görsel hikaye, kısa metin, emoji bol, hashtag
  X: Hızlı, keskin, 280 karakter max per tweet

Her zaman:
  Veri varsa sayı kullan
  CTA ücretsiz olsun (tarama, rapor)
  cyberstep.io referansı ver
`;

// İçerik tiplerine göre şablonlar
export const CONTENT_TEMPLATES: Record<string, ContentTemplate> = {

  // Haftalık veri insight'ı
  data_insight: {
    platforms: ['linkedin', 'instagram', 'x'],
    systemPrompt: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
    userPrompt: `
Platform: {PLATFORM}
İçerik tipi: Haftalık veri insight'ı
Tarih: {DATE}

Bu hafta CyberStep verisi:
{SCAN_STATS}

Görev:
{PLATFORM} için bu veriyi paylaşım haline getir.

LinkedIn için:
  Başlık cümlesi (FOMO yaratacak)
  3-4 madde (rakamlarla)
  Çözüm önerisi 1 cümle
  CTA: ücretsiz tarama linki
  5-7 hashtag

Instagram için:
  Emoji ile başlayan güçlü açılış
  2-3 kısa madde
  Soru ile kapanış (yorum almak için)
  10-12 hashtag (hem TR hem EN)

X için:
  280 karakter, tek tweet
  En çarpıcı istatistik
  Linksiz (bio'da var)
  3-4 hashtag
`,
    maxTokens: 400,
  },

  // Özel gün
  special_day: {
    platforms: ['linkedin', 'instagram', 'x'],
    systemPrompt: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
    userPrompt: `
Platform: {PLATFORM}
İçerik tipi: Özel gün paylaşımı
Özel gün: {SPECIAL_DAY_NAME}
Ton: {TONE}
Siber güvenlik açısı: {CYBERSECURITY_ANGLE}
Tarih: {DATE}

Bu özel gün için {PLATFORM}'a özgü bir paylaşım yaz.

Kurallar:
  - Özel günü samimi kutla/an
  - Siber güvenlik bağlantısını zorla değil, doğal kur
  - Satış tonu kesinlikle yok
  - Marka logosunu anma, ton yeterli
`,
    maxTokens: 300,
  },

  // İpucu / Eğitim içeriği
  security_tip: {
    platforms: ['linkedin', 'instagram', 'x'],
    systemPrompt: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
    userPrompt: `
Platform: {PLATFORM}
İçerik tipi: Güvenlik ipucu
Konu: {TIP_TOPIC}
Hedef: Orta düzey teknik bilgisi olan IT profesyoneli

Bu konuda {PLATFORM}'a özgü eğitici içerik yaz.
  - Pratik, uygulanabilir
  - Neden önemli (1 cümle risk)
  - Nasıl yapılır (2-3 adım)
  - Ücretsiz kontrol CTA'sı
`,
    maxTokens: 350,
  },

  // CVE alert
  cve_alert: {
    platforms: ['linkedin', 'x'],
    systemPrompt: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
    userPrompt: `
Platform: {PLATFORM}
İçerik tipi: CVE Türkiye etkisi
CVE: {CVE_ID} — CVSS {CVSS_SCORE}
Etkilenen: {AFFECTED_PRODUCT}
Türkiye: {TR_DOMAIN_COUNT} domain etkileniyor
Yama: {PATCH_STATUS}

Breaking alert formatında yaz.
Panikletme ama aciliyeti hissettir.
cyberstep.io/cve/{CVE_ID} linki ekle.
`,
    maxTokens: 250,
  },

  // Spontane istek
  spontaneous: {
    platforms: ['linkedin', 'instagram', 'x'],
    systemPrompt: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
    userPrompt: `
Platform: {PLATFORM}
Konu: {TOPIC}
Ek notlar: {NOTES}

Bu konu için {PLATFORM}'a özgü paylaşım yaz.
CyberStep marka sesiyle.
`,
    maxTokens: 400,
  },
};
```

---

## BÖLÜM 3: İÇERİK ÜRETİCİ

```typescript
// src/socialMedia/contentGenerator.ts

export async function generateWeeklyContent(
  weekStart: Date,
  calendarId: number
): Promise<void> {

  // Bu haftanın verisini topla
  const scanStats = await getWeeklyScanStats();
  const upcomingSpecialDays = await getSpecialDaysThisWeek(weekStart);
  const activeCVEs = await getPublishedCVEsThisWeek();

  // Haftalık içerik planı
  const contentPlan = buildWeeklyPlan(
    weekStart,
    upcomingSpecialDays,
    activeCVEs,
    scanStats
  );

  let totalCost = 0;

  for (const item of contentPlan) {
    try {
      // 1. Metin üret (Haiku)
      const textContent = await generatePostText(item, scanStats);
      totalCost += textContent.cost;

      // 2. Görsel üret (SVG → PNG)
      const visual = await generatePostVisual(item, textContent);

      // 3. DB'ye kaydet
      await db.insert(socialMediaPosts).values({
        calendarId,
        platform: item.platform,
        postType: item.type,
        scheduledDate: item.date,
        caption: textContent.caption,
        hashtags: textContent.hashtags,
        altText: textContent.altText,
        slides: textContent.slides || null,
        threadTweets: textContent.thread || null,
        imageSvg: visual.svg,
        imagePngPath: visual.pngPath,
        imageDimensions: visual.dimensions,
        status: 'draft',
        specialDayId: item.specialDayId || null,
        dataSource: item.dataSource,
        generationCostUsd: textContent.cost,
      });

      logger.info(`İçerik üretildi: ${item.platform} — ${item.type} — ${item.date}`);
      await sleep(300); // Rate limit
    } catch (e) {
      logger.error(`İçerik üretim hatası: ${item.platform}/${item.type}`, e.message);
    }
  }

  // Toplam maliyet güncelle
  await db.update(contentCalendar).set({
    status: 'generated',
    totalPosts: contentPlan.length,
    generationCostUsd: totalCost,
    generatedAt: new Date(),
  }).where(eq(contentCalendar.id, calendarId));

  // Pazarlama ekibine bildirim
  await sendMarketingNotification(
    `📱 Bu haftanın sosyal medya içerikleri hazır`,
    `${contentPlan.length} içerik incelemenizi bekliyor.\n` +
    `Tahmini maliyet: $${totalCost.toFixed(4)}\n` +
    `İnceleme: /admin-panel/social-media`
  );
}

// Haftalık içerik planı oluştur
function buildWeeklyPlan(
  weekStart: Date,
  specialDays: SpecialDay[],
  cves: CVEEntry[],
  stats: ScanStats
): ContentPlanItem[] {

  const plan: ContentPlanItem[] = [];

  // Her platform için haftalık frekans
  const frequencies = {
    linkedin:  3, // Pazartesi, Çarşamba, Cuma
    instagram: 4, // Pazartesi, Salı, Perşembe, Cumartesi
    x:         5, // Pazartesi → Cuma her gün
  };

  // Gün dağılımı
  const dayOffsets = {
    linkedin:  [0, 2, 4],      // Pzt, Çar, Cum
    instagram: [0, 1, 3, 5],   // Pzt, Sal, Per, Cmt
    x:         [0, 1, 2, 3, 4], // Her gün
  };

  for (const [platform, offsets] of Object.entries(dayOffsets)) {
    for (let i = 0; i < offsets.length; i++) {
      const postDate = addDays(weekStart, offsets[i]);

      // Özel gün var mı?
      const specialDay = specialDays.find(sd =>
        isSameDay(sd.date, postDate)
      );

      // CVE bu tarihten önce yayınlandı mı?
      const relevantCVE = cves.find(cve =>
        platform !== 'instagram' && // Instagram CVE alert yapmayız
        cve.cvssScore >= 9.0
      );

      // İçerik tipi seç
      let type: string;
      if (specialDay) {
        type = 'special_day';
      } else if (relevantCVE && i === 0) {
        type = 'cve_alert'; // Haftanın ilk günü CVE varsa
      } else if (i === 0 || i === 2) {
        type = 'data_insight'; // Veri paylaşımı
      } else {
        type = 'security_tip'; // Güvenlik ipucu
      }

      plan.push({
        platform,
        type,
        date: postDate,
        specialDay: specialDay || null,
        specialDayId: specialDay?.id || null,
        cve: type === 'cve_alert' ? relevantCVE : null,
        stats,
        dataSource: type === 'data_insight' ? 'scan_stats' : 'manual',
      });
    }
  }

  return plan;
}

// Haiku ile metin üretimi
async function generatePostText(
  item: ContentPlanItem,
  stats: ScanStats
): Promise<TextContent> {

  const template = CONTENT_TEMPLATES[item.type];
  if (!template) throw new Error(`Template bulunamadı: ${item.type}`);

  const userPrompt = template.userPrompt
    .replace('{PLATFORM}', item.platform)
    .replace('{DATE}', formatDate(item.date, 'tr'))
    .replace('{SPECIAL_DAY_NAME}', item.specialDay?.name || '')
    .replace('{TONE}', item.specialDay?.tone || 'neutral')
    .replace('{CYBERSECURITY_ANGLE}', item.specialDay?.cybersecurityAngle || '')
    .replace('{CVE_ID}', item.cve?.cveId || '')
    .replace('{CVSS_SCORE}', item.cve?.cvssScore?.toString() || '')
    .replace('{AFFECTED_PRODUCT}', item.cve?.affectedProducts?.[0]?.product || '')
    .replace('{TR_DOMAIN_COUNT}', item.cve?.trAffectedDomains?.toString() || '')
    .replace('{PATCH_STATUS}', item.cve?.patchAvailable ? 'Yama mevcut' : 'Yama yok')
    .replace('{TIP_TOPIC}', selectTipTopic(item.date))
    .replace('{SCAN_STATS}', formatStats(stats));

  const response = await callClaudeWithCost(userPrompt, {
    model: 'claude-haiku-4-5',
    maxTokens: template.maxTokens,
    system: template.systemPrompt,
  });

  const parsed = parsePostContent(response.text, item.platform);

  return {
    caption: parsed.caption,
    hashtags: parsed.hashtags,
    altText: parsed.altText || '',
    slides: parsed.slides || null,
    thread: parsed.thread || null,
    cost: response.cost,
  };
}

// İpucu konuları — haftaya göre rotasyon
function selectTipTopic(date: Date): string {
  const topics = [
    'DMARC yapılandırması',
    'Güçlü şifre politikası',
    'Çok faktörlü doğrulama',
    'SSL sertifika yönetimi',
    'Phishing tespiti',
    'Yedekleme stratejisi',
    'Güvenli DNS yapılandırması',
    'Firewall kural temizliği',
    'Çalışan güvenlik farkındalığı',
    'VPN güvenli kullanım',
    'Patch yönetimi',
    'Dark web izleme',
  ];
  const weekNum = getISOWeek(date);
  return topics[weekNum % topics.length];
}
```

---

## BÖLÜM 4: GÖRSEL ÜRETİCİ

```typescript
// src/socialMedia/visualGenerator.ts

// Platform boyutları
const DIMENSIONS: Record<string, string> = {
  linkedin_standard:  '1200x628',
  linkedin_carousel:  '1080x1080',
  instagram_post:     '1080x1080',
  instagram_story:    '1080x1920',
  x_image:            '1200x675',
};

export async function generatePostVisual(
  item: ContentPlanItem,
  textContent: TextContent
): Promise<VisualResult> {

  const dimKey = `${item.platform}_${
    item.type === 'carousel' ? 'carousel' : 'standard'
  }`;
  const dim = DIMENSIONS[dimKey] || '1080x1080';
  const [w, h] = dim.split('x').map(Number);

  // İçerik tipine göre görsel şablonu seç
  const svg = buildVisualSVG(item, textContent, w, h);

  // SVG → PNG
  const filename = `social_${item.platform}_${
    item.date.toISOString().split('T')[0]
  }_${item.type}_${Date.now()}.png`;

  const outputPath = `/mnt/user-data/outputs/social/${filename}`;
  await ensureDir('/mnt/user-data/outputs/social');

  await cairosvg.svg2png({
    bytestring: svg,
    write_to: outputPath,
    scale: 1.0,
  });

  return { svg, pngPath: outputPath, dimensions: dim };
}

function buildVisualSVG(
  item: ContentPlanItem,
  text: TextContent,
  w: number, h: number
): string {

  // İçerik tipine ve platforma göre farklı şablonlar

  if (item.type === 'special_day') {
    return buildSpecialDaySVG(item, text, w, h);
  }

  if (item.type === 'data_insight') {
    return buildDataInsightSVG(item, text, w, h);
  }

  if (item.type === 'cve_alert') {
    return buildCVEAlertSVG(item, text, w, h);
  }

  if (item.type === 'security_tip') {
    return buildSecurityTipSVG(item, text, w, h);
  }

  return buildGenericSVG(item, text, w, h);
}

// Standart görsel — tüm tipler için temel
function buildGenericSVG(
  item: ContentPlanItem,
  text: TextContent,
  w: number, h: number
): string {

  // Başlık satırı — metinden ilk cümleyi çek
  const firstLine = text.caption.split('\n')[0].replace(/[🔴🟡🟢⚠️🚨📊✅]/g, '').trim().slice(0, 60);

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#060D1A"/>
        <stop offset="100%" stop-color="#0A1628"/>
      </linearGradient>
      <radialGradient id="glow" cx="75%" cy="25%" r="40%">
        <stop offset="0%" stop-color="#00C8FF" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#00C8FF" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    <rect x="0" y="0" width="${w}" height="6" fill="#00C8FF" opacity="0.8"/>
    <rect x="0" y="0" width="6" height="${h}" fill="#00C8FF" opacity="0.5"/>

    <!-- Logo -->
    <text x="${w * 0.08}" y="${h * 0.12}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.045}" font-weight="900" fill="#E8EDF5">Cyber</text>
    <text x="${w * 0.08 + w * 0.18}" y="${h * 0.12}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.045}" font-weight="900" fill="#00C8FF">Step</text>
    <text x="${w * 0.08 + w * 0.30}" y="${h * 0.12}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.022}" fill="#7B8FAF">.io</text>

    <!-- Ana metin -->
    <text x="${w * 0.08}" y="${h * 0.45}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.052}" font-weight="700"
      fill="#E8EDF5" class="wrap">${firstLine}</text>

    <!-- Alt bant -->
    <rect x="0" y="${h * 0.88}" width="${w}" height="${h * 0.12}"
      fill="#111F35" opacity="0.8"/>
    <text x="${w * 0.08}" y="${h * 0.955}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.025}" fill="#7B8FAF">
      Türkiye'nin Siber Güvenlik Risk Platformu
    </text>
    <text x="${w * 0.92}" y="${h * 0.955}" text-anchor="end"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.025}" fill="#00C8FF">cyberstep.io</text>
  </svg>`;
}

// Veri insight görseli — istatistik öne çıkar
function buildDataInsightSVG(
  item: ContentPlanItem,
  text: TextContent,
  w: number, h: number
): string {
  // En büyük istatistiği metinden çek
  const match = text.caption.match(/%(\d+)/);
  const bigStat = match ? `%${match[1]}` : '⚠️';

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#060D1A"/>
        <stop offset="100%" stop-color="#0A1628"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${w}" height="5" fill="#FF4560"/>

    <!-- Logo -->
    <text x="${w * 0.08}" y="${h * 0.1}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.04}" font-weight="900" fill="#E8EDF5">Cyber</text>
    <text x="${w * 0.08 + w * 0.155}" y="${h * 0.1}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.04}" font-weight="900" fill="#00C8FF">Step</text>

    <!-- Büyük istatistik -->
    <text x="${w / 2}" y="${h * 0.52}" text-anchor="middle"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.22}" font-weight="900" fill="#FF4560">${bigStat}</text>

    <!-- Açıklama -->
    <text x="${w / 2}" y="${h * 0.68}" text-anchor="middle"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.038}" fill="#A8B8D0">
      Türk şirketlerinde tespit edildi
    </text>

    <rect x="0" y="${h * 0.85}" width="${w}" height="${h * 0.15}"
      fill="#111F35" opacity="0.9"/>
    <text x="${w / 2}" y="${h * 0.945}" text-anchor="middle"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.028}" fill="#7B8FAF">
      cyberstep.io — Türkiye Siber Güvenlik Endeksi
    </text>
  </svg>`;
}

// CVE alert görseli — kırmızı, acil
function buildCVEAlertSVG(
  item: ContentPlanItem,
  text: TextContent,
  w: number, h: number
): string {
  const cvss = item.cve?.cvssScore || '9.8';
  const cveId = item.cve?.cveId || 'CVE';

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#0D0608"/>
    <rect x="0" y="0" width="${w}" height="8" fill="#FF4560"/>
    <rect x="0" y="0" width="8" height="${h}" fill="#FF4560"/>

    <text x="${w * 0.08}" y="${h * 0.1}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.032}" fill="#FF4560" font-weight="700">
      🚨 BREAKING — Türkiye
    </text>

    <text x="${w * 0.08}" y="${h * 0.35}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.09}" font-weight="900" fill="#E8EDF5">${cveId}</text>

    <text x="${w * 0.08}" y="${h * 0.52}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.055}" font-weight="700" fill="#FF4560">CVSS ${cvss}</text>

    <rect x="${w * 0.08}" y="${h * 0.6}" width="${w * 0.84}" height="2" fill="#FF4560" opacity="0.4"/>

    <text x="${w * 0.08}" y="${h * 0.72}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.035}" fill="#A8B8D0">
      ${item.cve?.trAffectedDomains || '?'} Türk domain etkileniyor
    </text>

    <text x="${w * 0.08}" y="${h * 0.88}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.03}" fill="#00C8FF">
      cyberstep.io/cve/${cveId.toLowerCase().replace('-', '/')}
    </text>
  </svg>`;
}

// Özel gün görseli — kutlama tonu
function buildSpecialDaySVG(
  item: ContentPlanItem,
  text: TextContent,
  w: number, h: number
): string {
  const dayName = item.specialDay?.name || '';
  const isSolemn = item.specialDay?.tone === 'solemn';

  const accentColor = isSolemn ? '#E8EDF5' : '#00C8FF';
  const bg2 = isSolemn ? '#080F1E' : '#0A1628';

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#060D1A"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${!isSolemn ? `
    <circle cx="${w * 0.85}" cy="${h * 0.15}" r="${w * 0.3}"
      fill="${accentColor}" opacity="0.06"/>` : ''}

    <!-- Logo -->
    <text x="${w * 0.08}" y="${h * 0.1}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.04}" font-weight="900" fill="#E8EDF5">Cyber</text>
    <text x="${w * 0.08 + w * 0.155}" y="${h * 0.1}"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.04}" font-weight="900" fill="${accentColor}">Step</text>

    <!-- Gün adı -->
    <text x="${w / 2}" y="${h * 0.45}" text-anchor="middle"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.068}" font-weight="900" fill="#E8EDF5">${dayName}</text>

    <!-- Ayırıcı -->
    <rect x="${w * 0.35}" y="${h * 0.52}" width="${w * 0.3}" height="2"
      fill="${accentColor}" opacity="0.6"/>

    <!-- cyberstep.io -->
    <text x="${w / 2}" y="${h * 0.92}" text-anchor="middle"
      font-family="'Segoe UI',Arial,sans-serif"
      font-size="${w * 0.03}" fill="#7B8FAF">cyberstep.io</text>
  </svg>`;
}
```

---

## BÖLÜM 5: SOSYAL MEDYA YAYINCISI

```typescript
// src/socialMedia/publisher.ts

export async function publishPost(postId: number): Promise<void> {

  const post = await getPost(postId);

  if (post.status !== 'approved') {
    throw new Error('Post onaylanmamış');
  }

  switch (post.platform) {
    case 'linkedin':
      await publishToLinkedIn(post);
      break;
    case 'instagram':
      await publishToInstagram(post);
      break;
    case 'x':
      await publishToX(post);
      break;
  }

  await db.update(socialMediaPosts).set({
    status: 'published',
    publishedAt: new Date(),
  }).where(eq(socialMediaPosts.id, postId));
}

// ─── LİNKEDİN ────────────────────────────────────────────
async function publishToLinkedIn(post: SocialPost): Promise<void> {

  const account = await getSocialAccount('linkedin');
  const orgId = account.accountId;

  const body: any = {
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: post.caption + '\n\n' + post.hashtags.join(' '),
        },
        shareMediaCategory: post.imagePngPath ? 'IMAGE' : 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  // Görsel varsa önce upload et
  if (post.imagePngPath) {
    const imageUrn = await uploadLinkedInImage(
      post.imagePngPath, account.accessToken, orgId
    );
    body.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      media: imageUrn,
    }];
  }

  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    body,
    {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );

  await db.update(socialMediaPosts).set({
    platformPostId: response.headers['x-restli-id'],
    platformPostUrl: `https://www.linkedin.com/feed/update/${response.headers['x-restli-id']}`,
  }).where(eq(socialMediaPosts.id, post.id));
}

// ─── X (TWİTTER) ─────────────────────────────────────────
async function publishToX(post: SocialPost): Promise<void> {

  const account = await getSocialAccount('x');

  const tweetData: any = {
    text: post.caption + ' ' + post.hashtags.slice(0, 4).join(' '),
  };

  // Görsel varsa media upload
  if (post.imagePngPath) {
    const mediaId = await uploadXMedia(post.imagePngPath, account);
    tweetData.media = { media_ids: [mediaId] };
  }

  // Thread mi?
  if (post.threadTweets && post.threadTweets.length > 1) {
    let replyToId: string | null = null;
    for (const tweet of post.threadTweets) {
      const tweetPayload: any = { text: tweet.content };
      if (replyToId) {
        tweetPayload.reply = { in_reply_to_tweet_id: replyToId };
      }
      const resp = await postTweetV2(tweetPayload, account);
      replyToId = resp.data.id;
    }
    return;
  }

  const response = await postTweetV2(tweetData, account);

  await db.update(socialMediaPosts).set({
    platformPostId: response.data.id,
    platformPostUrl: `https://x.com/CyberStepIO/status/${response.data.id}`,
  }).where(eq(socialMediaPosts.id, post.id));
}

// ─── INSTAGRAM ───────────────────────────────────────────
async function publishToInstagram(post: SocialPost): Promise<void> {

  const account = await getSocialAccount('instagram');
  const igAccountId = account.accountId;

  // Instagram Graph API: önce container oluştur
  const mediaResp = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    {
      image_url: await uploadImageToPublicURL(post.imagePngPath),
      caption: post.caption + '\n\n' + post.hashtags.join(' '),
      access_token: account.accessToken,
    }
  );

  // Sonra yayınla
  await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    {
      creation_id: mediaResp.data.id,
      access_token: account.accessToken,
    }
  );
}
```

---

## BÖLÜM 6: REVIZYON SİSTEMİ

```typescript
// src/socialMedia/revisionHandler.ts

// İnsan "yeniden yaz" dedi
export async function requestRevision(
  postId: number,
  revisionNote: string
): Promise<void> {

  const post = await getPost(postId);

  // Claude'a revizyon isteği gönder
  const revisedText = await callClaude(`
Platform: ${post.platform}
Mevcut metin:
---
${post.caption}
---
Hashtags: ${post.hashtags?.join(' ')}

İnsan düzeltme notu:
"${revisionNote}"

Bu notla metni yeniden yaz.
Sadece yeni metni ver, açıklama yok.
`, {
    model: 'claude-haiku-4-5',
    maxTokens: 400,
    system: CYBERSTEP_SOCIAL_SYSTEM_PROMPT,
  });

  const parsed = parsePostContent(revisedText, post.platform);

  await db.update(socialMediaPosts).set({
    caption: parsed.caption,
    hashtags: parsed.hashtags,
    status: 'draft',
    // Düzeltme sonrası tekrar draft'a alındı
    revisionRequest: revisionNote,
    revisionCount: post.revisionCount + 1,
    updatedAt: new Date(),
  }).where(eq(socialMediaPosts.id, postId));
}

// Spontane içerik talebi
// POST /api/admin/social/generate-spontaneous
export async function generateSpontaneous(params: {
  platform: 'linkedin' | 'instagram' | 'x';
  topic: string;
  notes?: string;
}): Promise<number> {

  const template = CONTENT_TEMPLATES.spontaneous;

  const userPrompt = template.userPrompt
    .replace('{PLATFORM}', params.platform)
    .replace('{TOPIC}', params.topic)
    .replace('{NOTES}', params.notes || '');

  const response = await callClaude(userPrompt, {
    model: 'claude-haiku-4-5',
    maxTokens: 400,
    system: template.systemPrompt,
  });

  const parsed = parsePostContent(response, params.platform);
  const visual = await generateQuickVisual(params.platform, parsed);

  const [post] = await db.insert(socialMediaPosts).values({
    platform: params.platform,
    postType: 'spontaneous',
    scheduledDate: new Date(),
    caption: parsed.caption,
    hashtags: parsed.hashtags,
    imagePngPath: visual.pngPath,
    imageSvg: visual.svg,
    status: 'draft',
    dataSource: 'manual',
  }).returning();

  return post.id;
}
```

---

## BÖLÜM 7: ADMİN PANELİ

```
/admin-panel/social-media

Sekmeler:
[ Bekleyenler | Takvim | Yayınlananlar | Ayarlar ]

─── BEKLEYENLERİ ONAYLA ─────────────────────────────────────
Bu hafta: 12 draft, 3 onaylı, 0 yayınlandı

Platform filtreleri: [Tümü] [LinkedIn] [Instagram] [X]

┌─────────────────────────────────────────────────────┐
│ LinkedIn · Pazartesi 9 Haz · Veri Insight           │
│                                                     │
│ [Görsel]  %67                                       │
│           Türk şirketlerinin %67'sinde              │
│           DMARC kaydı yok...                        │
│                                                     │
│ #SiberGüvenlik #DMARC #Türkiye ...                  │
│                                                     │
│ [✏️ Düzenle] [🔄 Yeniden Yaz] [✅ Onayla] [❌ Reddet]│
└─────────────────────────────────────────────────────┘

"Yeniden Yaz" tıklandığında:
  Düzeltme notu: [____________] [Gönder]

─── SPONTANE İÇERİK ─────────────────────────────────────────
Platform: [LinkedIn ▾]
Konu: [_________________________________]
Notlar: [_________________________________]
[Claude'dan İçerik İste]

─── TAKVİM GÖRÜNÜMÜ ─────────────────────────────────────────
        Pzt  Sal  Çar  Per  Cum  Cmt  Paz
LinkedIn ✅   -   📝   -   📝   -    -
Instagram✅  📝   -   📝   -   📝   -
X        ✅  ✅   ✅  📝  📝   -    -

✅ Onaylı  📝 Draft  🚀 Yayınlandı

─── TOPLU AKSİYON ───────────────────────────────────────────
[Tüm Hazırları Yayınla (3)] ← Sadece onaylılar
Yayın saati: 09:30 (Türkiye saati)

─── PLATFORM DURUM ──────────────────────────────────────────
LinkedIn  🟢 Bağlı  Son yayın: 2 gün önce
Instagram 🟢 Bağlı  Son yayın: 1 gün önce
X         🟢 Bağlı  Son yayın: 4 saat önce
```

---

## BÖLÜM 8: CRON JOB'LAR

```typescript
// Her Pazar 20:00 — Bir sonraki haftanın içeriğini üret
cron.schedule('0 20 * * 0', async () => {
  const nextMonday = getNextMonday();

  // Takvim kaydı oluştur
  const [calendar] = await db.insert(contentCalendar).values({
    weekStart: nextMonday,
  }).returning();

  logger.info(`Haftalık içerik üretimi başlıyor: ${nextMonday.toISOString().split('T')[0]}`);
  await generateWeeklyContent(nextMonday, calendar.id);
});

// Her gün 09:30 — Onaylı içerikleri yayınla
cron.schedule('30 9 * * *', async () => {
  const today = new Date().toISOString().split('T')[0];

  const readyToPublish = await db.select()
    .from(socialMediaPosts)
    .where(
      and(
        eq(socialMediaPosts.status, 'approved'),
        eq(socialMediaPosts.scheduledDate, today),
      )
    );

  for (const post of readyToPublish) {
    try {
      await publishPost(post.id);
      logger.info(`Yayınlandı: ${post.platform} — ${post.postType}`);
      await sleep(3000); // Platformlar arası bekleme
    } catch (e) {
      logger.error(`Yayın hatası: ${post.id}`, e.message);
    }
  }
});

// Her gün 08:00 — Bugün özel gün var mı? Acele içerik üret
cron.schedule('0 8 * * *', async () => {
  const today = new Date();
  const todaySpecials = await getSpecialDaysOnDate(today);

  for (const special of todaySpecials) {
    // Bu özel gün için içerik üretildi mi?
    const existing = await db.select()
      .from(socialMediaPosts)
      .where(
        and(
          eq(socialMediaPosts.specialDayId, special.id),
          gte(socialMediaPosts.scheduledDate,
            new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        )
      );

    if (existing.length === 0) {
      // İçerik yok — acil üret ve uyar
      logger.warn(`Özel gün içeriği yok: ${special.name}`);
      await sendMarketingNotification(
        `⚠️ Bugün ${special.name} — içerik hazır değil!`,
        `Admin panelden hızlı içerik oluşturabilirsiniz:\n` +
        `/admin-panel/social-media → Spontane İçerik`
      );
    }
  }
});
```

---

## BÖLÜM 9: API ROTALAR

```
─── İÇERİK YÖNETİMİ ─────────────────────────────────────────
GET  /api/admin/social/posts           → Tüm postlar (filtreli)
GET  /api/admin/social/posts/pending   → Onay bekleyenler
GET  /api/admin/social/posts/:id       → Post detayı + görsel
PUT  /api/admin/social/posts/:id       → Metin düzenle

POST /api/admin/social/posts/:id/approve   → Onayla
POST /api/admin/social/posts/:id/reject    → Reddet
POST /api/admin/social/posts/:id/revise    → Yeniden yaz
  Body: { revisionNote: "..." }
POST /api/admin/social/posts/:id/publish   → Tek yayınla

POST /api/admin/social/generate            → Spontane üret
  Body: { platform, topic, notes? }

─── TAKVİM ──────────────────────────────────────────────────
GET  /api/admin/social/calendar            → Haftalık takvim
POST /api/admin/social/generate-week       → Manuel hafta üret
  Body: { weekStart: "2026-06-08" }

─── PLATFORM BAĞLANTI ───────────────────────────────────────
GET  /api/admin/social/accounts            → Hesap durumları
POST /api/admin/social/accounts/:platform/connect   → Bağla
POST /api/admin/social/accounts/:platform/test      → Test et

─── ÖZEL GÜNLER ─────────────────────────────────────────────
GET  /api/admin/social/special-days        → Liste
POST /api/admin/social/special-days        → Ekle
PUT  /api/admin/social/special-days/:id    → Güncelle
```

---

## BÖLÜM 10: ENVIRONMENT VARIABLES

```bash
# Platform API'leri
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ORG_ID=              # Şirket sayfası ID'si

X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
# NOT: X Basic plan $100/ay gerektirir
# Free plan çok limitli — tweet başına para ödeme

INSTAGRAM_ACCESS_TOKEN=       # Facebook Business üzerinden
INSTAGRAM_ACCOUNT_ID=

# Görsel yükleme için geçici public URL
# (Instagram API resim URL istiyor)
CLOUDFLARE_R2_BUCKET=        # veya herhangi CDN
CLOUDFLARE_R2_PUBLIC_URL=

# İçerik üretim ayarları
SOCIAL_CONTENT_LANGUAGE=tr
SOCIAL_WEEKLY_GENERATION_DAY=0  # 0=Pazar
SOCIAL_PUBLISH_TIME=09:30       # Türkiye saati
MARKETING_TEAM_EMAIL=           # Bildirim adresi
```

---

## MALİYET HESABİ

```
Haftalık içerik (12 post):
  LinkedIn:  3 post × 300 token = 900 token
  Instagram: 4 post × 250 token = 1.000 token
  X:         5 post × 150 token = 750 token
  TOPLAM:    ~2.650 token output

claude-haiku-4-5:
  $0.0003 / 1K output token
  2.650 token × $0.0003 = $0.0008/hafta

Aylık: $0.003 — pratik olarak sıfır.

Spontane istekler de dahil:
  Aylık 20 spontane istek × $0.0001 = $0.002

Toplam aylık AI maliyeti: ~$0.005
(Bin liralık pazarlama ajansı yerine 15 kuruş)
```

---

## TEST SENARYOSU

```
1. Manuel hafta üret:
   POST /api/admin/social/generate-week
   Body: { weekStart: "2026-06-08" }

   5 dakika içinde:
   → 12 post üretildi
   → Görsel dosyaları /outputs/social/ altında
   → Admin panelde "Bekleyenler" sekmesinde görünüyor
   → Pazarlama ekibine bildirim gitti

2. Post incele ve onayla:
   /admin-panel/social-media → Bekleyenler
   → Metin okunabilir
   → Görsel branda uygun
   → "Onayla" tıkla → status: approved

3. "Yeniden yaz" test et:
   → "Daha çarpıcı yaz, ilk cümle dikkat çeksin" notu
   → Claude revize eder
   → Yeni metin gelir, tekrar incelenir

4. Spontane içerik:
   → Konu: "Türkiye'de RDP güvenlik riski"
   → Platform: LinkedIn
   → [İçerik İste] tıkla
   → 30 saniyede taslak gelir

5. Platform bağlantı testi:
   POST /api/admin/social/accounts/linkedin/test
   → {"status": "ok", "org": "CyberStep.io"}

6. Tek yayın testi (önce sandbox/test hesap):
   POST /api/admin/social/posts/1/publish
   → Platform'da yayınlandı
   → platform_post_url döndü
```

---

*CyberStep.io — AI Sosyal Medya İçerik Sistemi — 2026*
*Üretim: Claude Haiku | Onay: İnsan | Yayın: Tek Tuş*
