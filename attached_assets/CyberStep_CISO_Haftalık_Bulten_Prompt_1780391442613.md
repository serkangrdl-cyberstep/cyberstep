# CyberStep.io — CISO Haftalık İstihbarat Bülteni
## Replit Agent Promptu — 5 Dakikada Okunan Haftalık Özet

---

## AMAÇ

Aylık endeks raporundan farklı.

Aylık rapor: Kapsamlı, PDF, indirilen,
arşivlenen. "Bu ay ne oldu?" sorusu.

Haftalık bülten: Kısa, e-posta, 5 dakikada
okunur, hemen silinmez çünkü değer var.
"Bu hafta ne bilmem lazım?" sorusu.

Hedef abone: CISO, CTO, IT Direktörü,
Risk Yöneticisi.

Bu bülten abone listesini büyütür →
Her abone potansiyel müşteri veya
referans kaynağı.

---

## BÜLTEN FORMATI

**Konu satırı şablonu:**
```
🔐 CyberStep | Hafta [N] — [Bu haftanın en önemli başlığı]

örn:
🔐 CyberStep | Hafta 23 — Türkiye'de 847 şirket
   Log4j'den etkileniyor
🔐 CyberStep | Hafta 24 — DMARC oranı 3 ay içinde
   en düşük seviyede
🔐 CyberStep | Hafta 25 — Finans sektöründe
   bu ay 12 kritik açık
```

**Bülten yapısı (her hafta aynı):**
```
━━━━━━━━━━━━━━━━━━━━━━━━
CyberStep Haftalık İstihbarat
Hafta [N] | [Tarih]
━━━━━━━━━━━━━━━━━━━━━━━━

Bu Hafta Kısaca: [2-3 cümle özet]

1. TEHDIT RADARINDA  [En önemli CVE veya saldırı trendi]
2. TÜRKİYE VERİSİ   [Bu haftanın en çarpıcı istatistiği]
3. MEVZUAT          [7545 veya KVKK haberi]
4. TAVSİYE          [Bu hafta yapılması gereken 1 şey]
5. ARAÇ / KAYNAK    [Ücretsiz kullanışlı bir araç veya bağlantı]

━━━━━━━━━━━━━━━━━━━━━━━━
[Domain'inizi ücretsiz tarayın]
━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## BÖLÜM 1: VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS weekly_bulletins (
  id serial PRIMARY KEY,
  country_code varchar(5) DEFAULT 'TR',
  week_number integer NOT NULL,
  year integer NOT NULL,
  week_slug varchar(30) UNIQUE,
  -- 'tr-2026-w23'

  status varchar(20) DEFAULT 'draft',
  -- 'draft' | 'review' | 'sent' | 'skipped'

  -- Bu haftanın verisi
  date_range_start date,
  date_range_end date,
  total_scans_this_week integer,
  new_critical_cves integer,
  -- Bu hafta çıkan kritik CVE sayısı
  top_finding_type varchar(100),
  -- En yaygın bulgu tipi
  top_finding_pct decimal(5,2),
  notable_sector varchar(50),
  -- Bu hafta öne çıkan sektör
  regulation_update text,
  -- Bu haftaki mevzuat/haber (varsa)

  -- İçerik (Claude üretimi)
  headline varchar(255),
  -- E-posta konu satırı için başlık
  intro_text text,
  -- 2-3 cümle "bu hafta kısaca"
  threat_radar text,
  -- Bölüm 1: Tehdit radarında
  turkey_data text,
  -- Bölüm 2: Türkiye verisi
  regulation_section text,
  -- Bölüm 3: Mevzuat
  weekly_tip text,
  -- Bölüm 4: Bu hafta yap
  tool_resource text,
  -- Bölüm 5: Araç/kaynak

  -- E-posta
  email_subject varchar(255),
  email_preview varchar(90),
  -- 90 karakter önizleme metni
  email_html text,
  email_plain_text text,

  -- LinkedIn mini paylaşım
  linkedin_mini_post text,
  -- Bülteni duyuran kısa post

  -- Gönderim
  sent_at timestamp,
  recipient_count integer DEFAULT 0,
  open_rate decimal(5,2),
  click_rate decimal(5,2),

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Abone tablosu
CREATE TABLE IF NOT EXISTS bulletin_subscribers (
  id serial PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  name varchar(255),
  company varchar(255),
  title varchar(255),
  country_code varchar(5) DEFAULT 'TR',

  -- Abonelik kaynağı
  source varchar(50),
  -- 'website' | 'report_download' | 'linkedin' |
  -- 'manual' | 'referral' | 'cve_alert'

  -- Tercihler
  frequency varchar(20) DEFAULT 'weekly',
  -- 'weekly' | 'monthly_only'
  language varchar(10) DEFAULT 'tr',
  sectors_of_interest text[],
  -- İlgilendiği sektörler

  -- Etkileşim
  total_received integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  last_opened_at timestamp,
  engagement_score integer DEFAULT 50,
  -- 0-100: Aktif abone mi?

  -- ISR bağlantısı
  isr_customer_id integer REFERENCES isr_customers(id),

  -- Durum
  is_active boolean DEFAULT true,
  unsubscribed_at timestamp,
  unsubscribe_reason varchar(100),

  subscribed_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Bülten tıklama takibi
CREATE TABLE IF NOT EXISTS bulletin_clicks (
  id serial PRIMARY KEY,
  bulletin_id integer REFERENCES weekly_bulletins(id),
  subscriber_id integer REFERENCES bulletin_subscribers(id),
  link_section varchar(50),
  -- 'cve_link' | 'domain_scan' | 'report' | 'tip_link'
  clicked_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: HAFTALIK VERİ TOPLAYICI

```typescript
// src/bulletin/weeklyDataCollector.ts

export async function collectWeeklyData(
  weekStart: Date,
  weekEnd: Date,
  countryCode: string = 'TR'
): Promise<WeeklyData> {

  // Bu hafta taranan domainler
  const scansThisWeek = await db.select({ count: count() })
    .from(domainScans)
    .where(
      and(
        gte(domainScans.createdAt, weekStart),
        lte(domainScans.createdAt, weekEnd),
        like(domainScans.domain, '%.tr')
      )
    );

  // Bu hafta çıkan kritik CVE'ler
  const newCVEs = await db.select()
    .from(cveTracker)
    .where(
      and(
        gte(cveTracker.detectedAt, weekStart),
        lte(cveTracker.detectedAt, weekEnd),
        eq(cveTracker.severity, 'critical'),
        gte(cveTracker.trAffectedDomains, 20)
      )
    )
    .orderBy(desc(cveTracker.trAffectedDomains));

  // Bu haftanın en yaygın bulgusu
  const topFinding = await db.select({
    findingType: domainScanFindings.findingType,
    count: count(),
  })
  .from(domainScanFindings)
  .innerJoin(domainScans, eq(domainScanFindings.scanId, domainScans.id))
  .where(
    and(
      gte(domainScans.createdAt, weekStart),
      lte(domainScans.createdAt, weekEnd),
      eq(domainScanFindings.adjustedSeverity, 'critical'),
    )
  )
  .groupBy(domainScanFindings.findingType)
  .orderBy(desc(count()))
  .limit(1);

  // Bu hafta en riskli sektör
  const topSector = await db.select({
    sector: leadCandidates.sector,
    avgScore: avg(domainScans.overallScore),
  })
  .from(domainScans)
  .leftJoin(leadCandidates,
    eq(domainScans.domain, leadCandidates.domain))
  .where(
    and(
      gte(domainScans.createdAt, weekStart),
      lte(domainScans.createdAt, weekEnd),
      isNotNull(leadCandidates.sector),
    )
  )
  .groupBy(leadCandidates.sector)
  .orderBy(desc(avg(domainScans.overallScore)))
  .limit(1);

  // Önceki hafta ile karşılaştırma
  const prevWeekStart = subDays(weekStart, 7);
  const prevWeekEnd = subDays(weekEnd, 7);
  const prevAvgScore = await getAvgScore(prevWeekStart, prevWeekEnd, countryCode);
  const thisAvgScore = await getAvgScore(weekStart, weekEnd, countryCode);
  const weeklyChange = thisAvgScore - prevAvgScore;

  // Bu haftaki mevzuat/siber güvenlik haberi
  // (Manuel veya otomatik kaynak)
  const regulationUpdate = await getLatestRegulationUpdate(weekStart, weekEnd);

  return {
    totalScans: scansThisWeek[0]?.count || 0,
    newCriticalCVEs: newCVEs,
    topCVE: newCVEs[0] || null,
    topFindingType: topFinding[0]?.findingType,
    topFindingCount: topFinding[0]?.count,
    topSector: topSector[0]?.sector,
    topSectorAvgScore: topSector[0]?.avgScore,
    weeklyRiskChange: weeklyChange,
    avgRiskScore: thisAvgScore,
    regulationUpdate,
    weekStart,
    weekEnd,
  };
}
```

---

## BÖLÜM 3: CLAUDE BÜLTEN YAZICI

```typescript
// src/bulletin/bulletinWriter.ts

const BULLETIN_SYSTEM_PROMPT = `
Sen CyberStep.io'nun baş analistisi ve
bülten editörüsün.

Her hafta Türkiye'nin CISO'larına,
CTO'larına ve IT direktörlerine
haftalık siber güvenlik istihbarat
bülteni yazıyorsun.

Stil kuralları:
- Her bölüm maksimum 3-4 cümle
- Veri var ise rakam kullan
- Jargon yok — patron anlasın
- Acil ama panikletme
- "Bu hafta yapman gereken" pratik
- Referans kaynak yok — sadece bizim veri
- Türkçe, akıcı, doğal
`;

export async function generateBulletinContent(
  data: WeeklyData,
  weekNumber: number,
  year: number
): Promise<BulletinContent> {

  const weekLabel = `${year} Hafta ${weekNumber}`;

  // 1. BAŞLIK
  const headlinePrompt = `
Bu haftanın en çarpıcı bulgusunu
tek cümlede anlat. Maksimum 80 karakter.
Rakam içermeli.

Veri:
- En önemli CVE: ${data.topCVE?.cveId} (${data.topCVE?.trAffectedDomains} TR domain)
- En yaygın bulgu: ${data.topFindingType}
- Risk trendi: ${data.weeklyRiskChange > 0 ? 'kötüleşiyor' : 'iyileşiyor'}
- Öne çıkan sektör: ${data.topSector}

Sadece başlığı yaz, açıklama yok.
`;

  // 2. GİRİŞ (2-3 cümle özet)
  const introPrompt = `
Bu haftanın bültenine kısa giriş yaz.
Maksimum 3 cümle. Okuyucu devam etmek istesin.

Veri:
${data.totalScans} domain taradık.
Ortalama risk skoru: ${data.avgRiskScore}/100
Geçen haftaya göre: ${data.weeklyRiskChange > 0 ? '+' : ''}${data.weeklyRiskChange.toFixed(1)} değişim
${data.newCriticalCVEs.length > 0 ? `Bu hafta ${data.newCriticalCVEs.length} kritik CVE yayınlandı.` : ''}
`;

  // 3. TEHDİT RADARINDA
  const threatPrompt = data.topCVE ? `
Bu haftanın en önemli güvenlik açığını anlat.

CVE: ${data.topCVE.cveId}
CVSS: ${data.topCVE.cvssScore}
Etkilenen: ${data.topCVE.trAffectedDomains} Türk domain
Ürün: ${data.topCVE.affectedProducts?.[0]?.product}
Yama: ${data.topCVE.patchAvailable ? 'Mevcut' : 'Henüz yok'}
CISA KEV: ${data.topCVE.cisaKev ? 'Evet — aktif istismar ediliyor' : 'Hayır'}

Maksimum 4 cümle.
Teknik değil, iş riski açısından anlat.
` : `
Bu hafta kritik CVE yok.
Bunun yerine genel tehdit trendini anlat:
${data.topFindingType} bu hafta en yaygın bulgu.
Türkiye'deki durumu kısaca değerlendir.
`;

  // 4. TÜRKİYE VERİSİ
  const turkeyDataPrompt = `
Bu haftanın Türkiye güvenlik verisini anlat.
Maksimum 3 cümle + 1-2 madde.

Veri:
- Taranan domain: ${data.totalScans}
- Ortalama skor: ${data.avgRiskScore}/100
- Geçen haftaya fark: ${data.weeklyRiskChange.toFixed(1)}
- En riskli sektör: ${data.topSector} (ort. ${data.topSectorAvgScore?.toFixed(0)}/100)
- En yaygın açık: ${data.topFindingType}

Çarpıcı yaz. Soyut değil, somut.
`;

  // 5. MEVZUAT BÖLÜMü
  const regulationPrompt = data.regulationUpdate ? `
Bu mevzuat haberini/gelişmesini anlat:
"${data.regulationUpdate}"

Maksimum 3 cümle.
Okuyucuya "ne yapmalıyım" sorusunu yanıtla.
` : `
7545 Sayılı Siber Güvenlik Kanunu
kapsamında bu hafta dikkat edilmesi
gereken bir hatırlatma yaz.

Maksimum 2 cümle.
Spesifik bir yükümlülüğü hatırlat.
`;

  // 6. HAFTALIK TAVSİYE
  const tipPrompt = `
Bu hafta okuyucunun yapabileceği
tek pratik güvenlik önlemini anlat.

${data.topFindingType === 'no_dmarc'
  ? 'DMARC yapılandırması hakkında'
  : data.topFindingType === 'ssl_expiring'
  ? 'SSL sertifika yenileme hakkında'
  : data.topCVE
  ? `${data.topCVE.cveId} yaması hakkında`
  : 'Genel güvenlik kontrol hakkında'
}

Format:
✅ [Ne yapılacak] — [Neden önemli]
Süre: [Kaç dakika sürer]
Nasıl: [1-2 adım]

Maksimum 4 cümle toplam.
`;

  // 7. ARAÇ / KAYNAK
  const toolPrompt = `
Güvenlik profesyoneline bu hafta
işine yarayacak ücretsiz bir araç
veya kaynak öner.

Seçenekler:
- MXToolbox (DNS/DMARC kontrolü)
- Shodan (açık port kontrolü)
- Have I Been Pwned (sızıntı kontrolü)
- SSL Labs (SSL analizi)
- VirusTotal (dosya/URL analizi)
- CISA KEV listesi
- CyberStep ücretsiz tarama

Maksimum 2 cümle.
Araç adı + ne işe yarar + linki.
`;

  const [headline, intro, threat, turkeyData,
         regulation, tip, tool] = await Promise.all([
    callClaude(headlinePrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 100,
    }),
    callClaude(introPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 150,
    }),
    callClaude(threatPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 200,
    }),
    callClaude(turkeyDataPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 200,
    }),
    callClaude(regulationPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 150,
    }),
    callClaude(tipPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 200,
    }),
    callClaude(toolPrompt, {
      system: BULLETIN_SYSTEM_PROMPT,
      model: 'claude-haiku-4-5', maxTokens: 100,
    }),
  ]);

  const emailSubject =
    `🔐 CyberStep | Hafta ${weekNumber} — ${headline.trim()}`;

  const emailPreview = intro.trim().slice(0, 88);

  const emailHtml = buildBulletinHTML({
    weekNumber, year, headline, intro,
    threat, turkeyData, regulation, tip, tool,
    data,
  });

  // LinkedIn mini duyuru
  const linkedinMini = `
📊 CyberStep Haftalık Bülten — Hafta ${weekNumber}

${intro.trim()}

${data.topCVE
  ? `Bu haftanın öne çıkanı: ${data.topCVE.cveId} — Türkiye'de ${data.topCVE.trAffectedDomains} şirket etkileniyor.`
  : `Bu haftanın öne çıkanı: ${data.topFindingType} Türkiye'de en yaygın açık olmaya devam ediyor.`
}

Haftalık bültene abone olun →
cyberstep.io/bulten

#SiberGüvenlik #CISO #Türkiye #Güvenlik
`;

  return {
    headline: headline.trim(),
    intro: intro.trim(),
    threatRadar: threat.trim(),
    turkeyData: turkeyData.trim(),
    regulationSection: regulation.trim(),
    weeklyTip: tip.trim(),
    toolResource: tool.trim(),
    emailSubject,
    emailPreview,
    emailHtml,
    linkedinMiniPost: linkedinMini.trim(),
  };
}
```

---

## BÖLÜM 4: E-POSTA ŞABLONU

```typescript
function buildBulletinHTML(params: BulletinHTMLParams): string {
  const { weekNumber, year, headline, intro,
          threat, turkeyData, regulation, tip, tool, data } = params;

  const sections = [
    {
      emoji: '🚨',
      title: 'Tehdit Radarında',
      content: threat,
      color: '#FF4560',
      cta: data.topCVE ? {
        text: `${data.topCVE.cveId} detayları →`,
        url: `${process.env.BASE_URL}/cve/${data.topCVE.cveId}`,
      } : null,
    },
    {
      emoji: '📊',
      title: 'Türkiye Verisi',
      content: turkeyData,
      color: '#00C8FF',
      cta: {
        text: 'Aylık raporu indirin →',
        url: `${process.env.BASE_URL}/rapor`,
      },
    },
    {
      emoji: '⚖️',
      title: 'Mevzuat',
      content: regulation,
      color: '#FFB020',
      cta: null,
    },
    {
      emoji: '✅',
      title: 'Bu Hafta Yapın',
      content: tip,
      color: '#00E096',
      cta: {
        text: 'Ücretsiz tarama →',
        url: `${process.env.BASE_URL}`,
      },
    },
    {
      emoji: '🔧',
      title: 'Araç / Kaynak',
      content: tool,
      color: '#A78BFA',
      cta: null,
    },
  ];

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CyberStep Haftalık Bülten — Hafta ${weekNumber}</title>
</head>
<body style="margin:0;padding:0;background:#0A1020;
             font-family:'Segoe UI',Arial,sans-serif">

  <div style="max-width:600px;margin:0 auto;padding:20px">

    <!-- Header -->
    <div style="background:#060D1A;border-radius:12px 12px 0 0;
                padding:32px;border-bottom:2px solid #00C8FF;
                margin-bottom:2px">
      <div style="margin-bottom:16px">
        <span style="font-size:24px;font-weight:900;color:#E8EDF5">
          Cyber</span>
        <span style="font-size:24px;font-weight:900;color:#00C8FF">
          Step</span>
        <span style="font-size:14px;color:#7B8FAF">.io</span>
        <span style="font-size:13px;color:#5A6A80;
                     float:right;line-height:2">
          Haftalık İstihbarat | Hafta ${weekNumber}/${year}
        </span>
      </div>

      <div style="font-size:22px;font-weight:700;
                  color:#E8EDF5;line-height:1.3;
                  margin-bottom:16px">
        ${headline}
      </div>

      <div style="font-size:15px;color:#A8B8D0;
                  line-height:1.7;border-left:3px solid #00C8FF;
                  padding-left:16px">
        ${intro}
      </div>
    </div>

    <!-- Sections -->
    ${sections.map(section => `
    <div style="background:#060D1A;margin-bottom:2px;padding:24px 32px">
      <div style="display:flex;align-items:center;margin-bottom:12px">
        <span style="font-size:20px;margin-right:10px">${section.emoji}</span>
        <span style="font-size:13px;font-weight:700;
                     color:${section.color};
                     text-transform:uppercase;letter-spacing:2px">
          ${section.title}
        </span>
      </div>
      <div style="font-size:15px;color:#A8B8D0;
                  line-height:1.7;margin-bottom:${section.cta ? '16px' : '0'}">
        ${section.content}
      </div>
      ${section.cta ? `
      <a href="${section.cta.url}"
         style="color:${section.color};font-size:14px;
                font-weight:600;text-decoration:none">
        ${section.cta.text}
      </a>` : ''}
    </div>
    `).join('')}

    <!-- CTA Banner -->
    <div style="background:#060D1A;border-radius:0 0 12px 12px;
                padding:24px 32px;text-align:center;
                border-top:1px solid #111F35">
      <div style="font-size:16px;color:#A8B8D0;margin-bottom:16px">
        Şirketinizin risk skorunu öğrenin
      </div>
      <a href="${process.env.BASE_URL}"
         style="display:inline-block;background:#00C8FF;
                color:#060D1A;padding:12px 32px;border-radius:8px;
                text-decoration:none;font-weight:700;font-size:15px">
        Ücretsiz Domain Tarama →
      </a>
      <div style="margin-top:20px;font-size:12px;color:#5A6A80">
        CyberStep.io · Türkiye'nin Bağımsız Siber Güvenlik Platformu
        <br>
        <a href="{UNSUBSCRIBE_URL}"
           style="color:#5A6A80">Aboneliği iptal et</a> ·
        <a href="${process.env.BASE_URL}/bulten/arsiv"
           style="color:#5A6A80">Arşiv</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}
```

---

## BÖLÜM 5: GÖNDERIM SİSTEMİ

```typescript
// src/bulletin/bulletinSender.ts

export async function sendWeeklyBulletin(
  bulletinId: number
): Promise<void> {

  const bulletin = await getBulletin(bulletinId);
  if (bulletin.status !== 'review') {
    throw new Error('Bülten yayına hazır değil');
  }

  const subscribers = await db.select()
    .from(bulletinSubscribers)
    .where(
      and(
        eq(bulletinSubscribers.isActive, true),
        eq(bulletinSubscribers.countryCode, bulletin.countryCode),
        or(
          eq(bulletinSubscribers.frequency, 'weekly'),
          eq(bulletinSubscribers.frequency, 'all'),
        )
      )
    );

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      const personalizedHtml = bulletin.emailHtml
        .replace('{UNSUBSCRIBE_URL}',
          `${process.env.BASE_URL}/unsubscribe/${sub.id}`)
        .replace('{SUBSCRIBER_NAME}',
          sub.name?.split(' ')[0] || 'Merhaba');

      await sendEmail({
        to: sub.email,
        subject: bulletin.emailSubject,
        previewText: bulletin.emailPreview,
        html: personalizedHtml,
        from: 'research@cyberstep.io',
        fromName: 'CyberStep Araştırma',
      });

      await db.update(bulletinSubscribers).set({
        totalReceived: sql`total_received + 1`,
        updatedAt: new Date(),
      }).where(eq(bulletinSubscribers.id, sub.id));

      sent++;
      await sleep(80);
    } catch (e) {
      logger.error(`Bülten gönderi hatası: ${sub.email}`, e);
      failed++;
    }
  }

  await db.update(weeklyBulletins).set({
    status: 'sent',
    sentAt: new Date(),
    recipientCount: sent,
  }).where(eq(weeklyBulletins.id, bulletinId));

  logger.info(`Haftalık bülten gönderildi: ${sent} başarılı, ${failed} başarısız`);
}
```

---

## BÖLÜM 6: ABONE YÖNETİMİ

```typescript
// POST /api/bulletin/subscribe (Public)
export async function subscribe(data: {
  email: string;
  name?: string;
  company?: string;
  title?: string;
  source?: string;
}): Promise<void> {

  // Zaten abone mi?
  const existing = await db.select()
    .from(bulletinSubscribers)
    .where(eq(bulletinSubscribers.email, data.email))
    .limit(1);

  if (existing[0]) {
    if (!existing[0].isActive) {
      // Yeniden aktive et
      await db.update(bulletinSubscribers).set({
        isActive: true,
        unsubscribedAt: null,
      }).where(eq(bulletinSubscribers.email, data.email));
    }
    return;
  }

  // Yeni abone
  const [sub] = await db.insert(bulletinSubscribers).values({
    email: data.email,
    name: data.name,
    company: data.company,
    title: data.title,
    source: data.source || 'website',
  }).returning();

  // Hoş geldin e-postası
  await sendEmail({
    to: data.email,
    subject: 'CyberStep Haftalık Bültene Abone Oldunuz',
    html: buildWelcomeEmail(data.name),
    from: 'research@cyberstep.io',
  });

  // ISR lead olarak ekle (e-posta + şirket varsa)
  if (data.company) {
    await createISRLead({
      email: data.email,
      companyName: data.company,
      contactName: data.name,
      contactTitle: data.title,
      source: 'bulletin_subscribe',
    });
  }
}
```

---

## BÖLÜM 7: CRON JOB'LAR

```typescript
// Her Cuma 08:00 — haftalık bülten üret
cron.schedule('0 8 * * 5', async () => {
  const now = new Date();
  const weekNumber = getISOWeek(now);
  const year = now.getFullYear();

  // Bu hafta için bülten var mı?
  const existing = await db.select()
    .from(weeklyBulletins)
    .where(eq(weeklyBulletins.weekSlug, `tr-${year}-w${weekNumber}`))
    .limit(1);

  if (existing[0]) {
    logger.info(`Hafta ${weekNumber} bülteni zaten var`);
    return;
  }

  logger.info(`Hafta ${weekNumber} bülteni üretiliyor...`);

  const weekEnd = now;
  const weekStart = subDays(now, 7);

  const data = await collectWeeklyData(weekStart, weekEnd, 'TR');
  const content = await generateBulletinContent(data, weekNumber, year);

  const [bulletin] = await db.insert(weeklyBulletins).values({
    countryCode: 'TR',
    weekNumber,
    year,
    weekSlug: `tr-${year}-w${weekNumber}`,
    dateRangeStart: weekStart,
    dateRangeEnd: weekEnd,
    totalScansThisWeek: data.totalScans,
    newCriticalCves: data.newCriticalCVEs.length,
    topFindingType: data.topFindingType,
    notableSector: data.topSector,
    ...content,
    status: 'review',
    // Admin inceleyip onaylayacak
  }).returning();

  // Admin'e bildirim
  await sendAdminNotification(
    `Haftalık Bülten Hazır — Hafta ${weekNumber}`,
    `Onay için: /admin-panel/bulletin/${bulletin.id}`
  );
});
```

---

## BÖLÜM 8: ADMİN PANELİ

```
/admin-panel/bulletin

─── BU HAFTA ────────────────────────────────────────────────
Hafta 23/2026 | Durum: İnceleme Bekliyor

Özet: [headline]
Gönderilecek: 423 abone

Önizleme: [E-posta önizlemesi]

[Düzenle] [Önizle] [Onayla ve Gönder] [Ertele]

─── İSTATİSTİKLER ───────────────────────────────────────────
Toplam abone:    423
Bu hafta yeni:    12
Ortalama açılma: %41
Ortalama tıklama: %8

Son 4 hafta:
  Hafta 22: %44 açılma / %9 tıklama
  Hafta 21: %38 açılma / %7 tıklama
  Hafta 20: %42 açılma / %11 tıklama
  Hafta 19: %47 açılma / %12 tıklama

─── ABONE LİSTESİ ───────────────────────────────────────────
[Arama] [Dışa Aktar]

İsim          Şirket       Kaynak     Son Açılma   Skor
Ahmet Y.      Acme A.Ş.    Rapor      2 gün önce   85
Fatma K.      Beta Ltd.    LinkedIn   1 hafta önce  72
...

─── ABONELIK FORMU ──────────────────────────────────────────
Embed kodu:
<script src="cyberstep.io/widget/subscribe.js"></script>

Bu kodu siteye ve her blog yazısına ekle.
```

---

## BÖLÜM 9: API ROTALAR

```
─── PUBLIC ──────────────────────────────────────────────────
POST /api/bulletin/subscribe    — Abone ol
POST /api/bulletin/unsubscribe  — Abonelik iptali
GET  /bulten/arsiv              — Arşiv sayfası
GET  /bulten/:slug              — Bülten web görünümü

─── ADMİN ───────────────────────────────────────────────────
GET  /api/admin/bulletin/list   — Bülten listesi
GET  /api/admin/bulletin/:id    — Bülten detayı
PUT  /api/admin/bulletin/:id    — Düzenle
POST /api/admin/bulletin/:id/send — Onayla ve gönder
GET  /api/admin/bulletin/subscribers — Abone listesi
POST /api/admin/bulletin/subscribers/import — CSV import
```

---

## TEST SENARYOSU

```
1. Manuel bülten üret:
   POST /api/admin/bulletin/generate
   Body: { weekNumber: 23, year: 2026 }

2. Beklenen çıktı:
   → weekly_bulletins kaydı oluştu
   → Tüm 7 bölüm dolu (Türkçe)
   → email_html oluştu
   → linkedin_mini_post oluştu
   → status: 'review'

3. Admin panelde önizle:
   /admin-panel/bulletin/[id]
   → E-posta önizlemesi görünüyor
   → İçerik düzenlenebilir

4. Test e-postası gönder:
   POST /api/admin/bulletin/[id]/send-test
   Body: { email: "serkan@cyberstep.io" }
   → E-posta geldi, görünüm doğru

5. Abone ol:
   POST /api/bulletin/subscribe
   Body: { email: "test@test.com", name: "Test" }
   → Hoş geldin e-postası geldi
   → bulletin_subscribers kaydı oluştu
```

---

*CyberStep.io — CISO Haftalık İstihbarat Bülteni — 2026*
