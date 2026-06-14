# CyberStep — Dinamik Görsel Üretim Sistemi
## Replit Agent Promptu

---

## GENEL BAKIŞ

Bu modül 3 şey yapar:

1. **React Skor Kartı Komponenti** — Tarama sonuç sayfasında gerçek veriye dayalı kart gösterir
2. **Paylaşılabilir PNG Üretimi** — "Paylaş" butonuna basılınca Satori ile kişiselleştirilmiş PNG üretir
3. **Yıllık Güvenlik Raporu Cron** — Her yıl Ocak'ta müşteriye özel rapor üretip e-posta gönderir

Stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle + React + shadcn/ui
Mevcut cron altyapısı: wrapCron pattern, DB-backed logging

---

## BÖLÜM 1: VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS annual_reports (
  id                      serial PRIMARY KEY,
  domain                  varchar(255) NOT NULL,
  year                    integer NOT NULL,
  customer_id             integer,
  year_end_score          integer,
  year_end_grade          varchar(2),
  prev_year_score         integer,
  score_delta             integer,
  total_scans             integer DEFAULT 0,
  closed_findings         integer DEFAULT 0,
  surface_reduction       numeric(5,1),
  avg_critical_close_days numeric(5,1),
  monthly_scores          jsonb,
  top_achievement         text,
  sector_percentile       integer,
  svg_content             text,
  pdf_url                 varchar(500),
  email_sent_at           timestamp,
  created_at              timestamp DEFAULT now(),
  UNIQUE(domain, year)
);
```

Drizzle schema'ya ekle, npm run db:push çalıştır.

---

## BÖLÜM 2: REACT SKOR KARTI KOMPONENTİ

Dosya: `artifacts/frontend/src/components/SecurityScoreCard.tsx`

Props arayüzü:
- score: number (0-100)
- grade: string (A/B/C/D/F)
- domain: string
- companyName: string
- criticalCount: number
- highCount: number
- mediumCount: number
- sectorAvg: number
- scanDate: string
- variant: 'full' | 'compact' | 'share'

Renk sistemi — tam olarak bu hex kodlarını kullan:
- Arka plan: #060D1A
- Kart arka planı: #0A1828
- A notu: #2ECC71
- B notu: #00C8FF
- C notu: #F0C040
- D notu: #F5A623
- F notu: #E03A3A
- Birincil metin: #E8EDF5
- Soluk metin: #8896A8
- Kenar: #1A3050

Grade rengini döndüren yardımcı fonksiyon:
```typescript
function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: '#2ECC71', B: '#00C8FF', C: '#F0C040', D: '#F5A623', F: '#E03A3A'
  };
  return map[grade] ?? '#8896A8';
}
```

Komponent yapısı (Tailwind + inline style karışık kullanabilirsin):

**Header bölümü:**
- Sol: Shield ikonu (grade rengiyle bordered), şirket adı, domain
- Sağ: Tarih, durum badge

**Score Ring bölümü:**
- SVG dairesi, r=42, stroke-dasharray=263.9
- stroke-dashoffset = 263.9 - (score/100 * 263.9)
- Ortada büyük skor sayısı (grade rengiyle)
- Altında harf notu

**Grade Bar:**
- Kırmızı→amber→yeşil gradient (CSS linear-gradient)
- Marker nokta: grade rengi, glowing
- Altında F·0 / D·20 / C·40 / B·60 / A·80 etiketleri

**Sektör Karşılaştırma:**
- "Sektör: 54 · Sizin: 67 · +13 ↑" formatında
- Delta pozitifse yeşil, negatifse kırmızı

**Metrikler Satırı:**
- 3 eşit kolon: KRİTİK / YÜKSEK / ORTA
- Her biri: renkli nokta, büyük sayı, etiket

**Footer:**
- Sol: CYBERSTEP.IO · POWERED BY STEP AI
- Sağ: "A · ÜST DÜZEY" formatında badge (grade renginde)

variant='compact': sadece ring + skor + domain (dashboard widget, 200x200px)
variant='share': 840x620px, PNG üretimi için optimize

---

## BÖLÜM 3: SATORI PNG ÜRETİMİ

### 3.1 Kurulum
```bash
npm install satori @resvg/resvg-js
```

Not: @resvg/resvg-js zaten paylaşılabilir sonuç sayfası için kuruluysa tekrar kurmaya gerek yok.

### 3.2 Font Dosyaları

Inter fontunu Google Fonts'tan indir, şu klasöre koy:
`artifacts/api-server/src/assets/fonts/Inter-Regular.ttf`
`artifacts/api-server/src/assets/fonts/Inter-Bold.ttf`

### 3.3 OG Image Endpoint

Dosya: `artifacts/api-server/src/routes/og-image.ts`

```typescript
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

const interRegular = fs.readFileSync(path.join(__dirname, '../assets/fonts/Inter-Regular.ttf'));
const interBold    = fs.readFileSync(path.join(__dirname, '../assets/fonts/Inter-Bold.ttf'));

const ogLimiter = rateLimit({ windowMs: 60000, max: 20 });

router.get('/result/:token/og-image.png', ogLimiter, async (req, res) => {
  const scan = await db.query.domainScans.findFirst({
    where: eq(domainScans.badgeToken, req.params.token)
  });
  if (!scan || !scan.isPubliclyShared) return res.status(404).end();

  const color = gradeColor(scan.letterGrade);
  const pct = scan.overallScore / 100;

  // Satori JSX element — sadece flexbox, position:absolute yok
  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: '840px',
        height: '620px',
        background: '#060D1A',
        padding: '0',
        overflow: 'hidden',
      },
      children: [
        // Header strip
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '24px 32px',
              background: '#091520',
              borderBottom: '1px solid #1A3050',
            },
            children: [
              // domain
              {
                type: 'div',
                props: {
                  style: { flex: 1, display: 'flex', flexDirection: 'column' as const },
                  children: [
                    { type: 'span', props: { style: { fontSize: 22, fontWeight: 900, color: '#E8EDF5' }, children: scan.domain } },
                    { type: 'span', props: { style: { fontSize: 13, color: '#8896A8', marginTop: 4 }, children: 'CyberStep Güvenlik Raporu' } },
                  ]
                }
              },
              // grade badge
              {
                type: 'div',
                props: {
                  style: {
                    padding: '8px 20px',
                    borderRadius: 24,
                    border: `2px solid ${color}`,
                    background: `${color}20`,
                    fontSize: 16,
                    fontWeight: 900,
                    color,
                  },
                  children: `${scan.letterGrade} · ${getBadgeText(scan.letterGrade)}`
                }
              }
            ]
          }
        },
        // Main content: score + info
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              padding: '40px 48px',
              gap: '48px',
            },
            children: [
              // Score circle (CSS border trick — Satori SVG içinde SVG desteklemez)
              {
                type: 'div',
                props: {
                  style: {
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    border: `12px solid ${color}`,
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: '#060D1A',
                  },
                  children: [
                    { type: 'span', props: { style: { fontSize: 64, fontWeight: 900, color, lineHeight: 1 }, children: String(scan.overallScore) } },
                    { type: 'span', props: { style: { fontSize: 22, fontWeight: 700, color, marginTop: 4 }, children: scan.letterGrade } },
                  ]
                }
              },
              // Info column
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' as const, gap: '12px', flex: 1 },
                  children: [
                    { type: 'span', props: { style: { fontSize: 14, color: '#8896A8', letterSpacing: 2 }, children: 'GÜVENLİK SKORU' } },
                    { type: 'span', props: { style: { fontSize: 36, fontWeight: 900, color: '#E8EDF5', lineHeight: 1.2 }, children: getVerdictText(scan.letterGrade) } },
                    // Sector compare
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          gap: '8px',
                          padding: '10px 16px',
                          background: '#0D2035',
                          borderRadius: 8,
                          fontSize: 15,
                          color: '#8896A8',
                        },
                        children: [
                          { type: 'span', props: { children: 'Sektör: ' } },
                          { type: 'span', props: { style: { color: '#00C8FF', fontWeight: 700 }, children: '54' } },
                          { type: 'span', props: { children: '  ·  Sizin: ' } },
                          { type: 'span', props: { style: { color, fontWeight: 900 }, children: String(scan.overallScore) } },
                        ]
                      }
                    },
                    // Metrics row
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', gap: '16px', marginTop: '8px' },
                        children: [
                          metricBox('KRİTİK', scan.criticalCount, '#E03A3A'),
                          metricBox('YÜKSEK',  scan.highCount,    '#F5A623'),
                          metricBox('ORTA',    scan.mediumCount,  '#F0C040'),
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // Footer
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 32px',
              background: '#04090F',
              borderTop: '1px solid #1A3050',
            },
            children: [
              { type: 'span', props: { style: { fontSize: 12, color: '#4A6080', letterSpacing: 2 }, children: 'CYBERSTEP.IO  ·  POWERED BY STEP AI' } },
              { type: 'span', props: { style: { fontSize: 12, color: '#4A6080' }, children: new Date().toLocaleDateString('tr-TR') } },
            ]
          }
        }
      ]
    }
  };

  const svg = await satori(element, {
    width: 840,
    height: 620,
    fonts: [
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: interBold,    weight: 900, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg);
  const png = resvg.render().asPng();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.end(png);
});

// Yardımcılar
function metricBox(label: string, count: number, color: string) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '12px 20px',
        background: '#0D2035',
        borderRadius: 8,
        minWidth: 80,
      },
      children: [
        { type: 'span', props: { style: { fontSize: 28, fontWeight: 900, color }, children: String(count) } },
        { type: 'span', props: { style: { fontSize: 10, color: '#8896A8', marginTop: 4, letterSpacing: 1 }, children: label } },
      ]
    }
  };
}

function getVerdictText(grade: string): string {
  const map: Record<string, string> = {
    A: 'Yüksek Güvenlik\nSeviyesi',
    B: 'Orta Seviye\nRisk Mevcut',
    C: 'Dikkat!\nRisk Yüksek',
    D: 'Yüksek Risk\nAksiyon Gerekli',
    F: 'Kritik Risk!\nAcil Müdahale',
  };
  return map[grade] ?? 'Değerlendiriliyor';
}

function getBadgeText(grade: string): string {
  const map: Record<string, string> = {
    A: 'ÜST DÜZEY', B: 'GELİŞTİRİLEBİLİR',
    C: 'ORTA RİSK',  D: 'YÜKSEK RİSK', F: 'ACİL MÜDAHALE'
  };
  return map[grade] ?? 'SKORSUZ';
}
```

### 3.4 Route Kaydı

`artifacts/api-server/src/routes/public.ts` dosyasına ekle:
```typescript
import ogImageRouter from './og-image';
router.use('/api/public', ogImageRouter);
```

---

## BÖLÜM 4: YILLIK GÜVENLİK RAPORU CRON

### 4.1 Yardımcı Fonksiyonlar

`artifacts/api-server/src/lib/reports/annualReport.ts` oluştur:

```typescript
export function calculateMonthlyScores(scans: DomainScan[], year: number): number[] {
  // Her ay için en son taramanın skorunu al
  // Tarama yoksa önceki ayın skorunu taşı
  // 12 elemanlı array döndür [Ocak..Aralık]
  const months = Array(12).fill(null);
  scans.forEach(scan => {
    const month = new Date(scan.scannedAt).getMonth(); // 0-11
    months[month] = scan.overallScore;
  });
  // Boş ayları önceki değerle doldur
  let lastScore = 50;
  return months.map(s => { if (s !== null) lastScore = s; return lastScore; });
}

export function detectTopAchievement(scans: DomainScan[], year: number): string {
  // En hızlı kritik kapama, en büyük skor artışı, en uzun temiz seri gibi
  // Basit versiyon: en büyük tek ay artışını bul
  const monthly = calculateMonthlyScores(scans, year);
  let maxGain = 0, bestMonth = 0;
  for (let i = 1; i < 12; i++) {
    const gain = monthly[i] - monthly[i-1];
    if (gain > maxGain) { maxGain = gain; bestMonth = i; }
  }
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  if (maxGain > 5) return `${monthNames[bestMonth]}'da ${maxGain} puan artış sağlandı`;
  return 'Yıl boyunca tutarlı güvenlik seviyesi korundu';
}

export function calculateSectorPercentile(sector: string, score: number): number {
  // domain_scans tablosundan aynı sektördeki şirketlerin ortalama skorlarını çek
  // Kaçıncı yüzdelik dilimde olduğunu hesapla
  // Basit versiyon: score > 70 = %80, score > 55 = %60, score > 40 = %40
  if (score >= 70) return 80;
  if (score >= 55) return 60;
  if (score >= 40) return 40;
  return 20;
}
```

### 4.2 SVG Template Fonksiyonu

`artifacts/api-server/src/lib/reports/annualReportSvg.ts` oluştur.

Bu fonksiyon, yukarıda teslim edilen `yillik-guvenlik-raporu.svg` şablonunu alıp
tüm statik değerleri gerçek verilerle değiştirir.

Değiştirilecek placeholder'lar (sed/replace mantığı):
```
{{COMPANY_NAME}}    → data.companyName
{{DOMAIN}}          → data.domain
{{YEAR}}            → data.year
{{YEAR_END_SCORE}}  → data.yearEndScore
{{YEAR_END_GRADE}}  → data.yearEndGrade
{{GRADE_COLOR}}     → gradeColor(data.yearEndGrade)
{{PREV_SCORE}}      → data.prevYearScore
{{SCORE_DELTA}}     → data.scoreDelta >= 0 ? '+' + data.scoreDelta : data.scoreDelta
{{DELTA_COLOR}}     → data.scoreDelta >= 0 ? '#2ECC71' : '#E03A3A'
{{TOTAL_SCANS}}     → data.totalScans
{{CLOSED_FINDINGS}} → data.closedFindings
{{SURFACE_RED}}     → '%' + data.surfaceReduction
{{AVG_CLOSE_DAYS}}  → data.avgCriticalCloseDays
{{SECTOR_PCT}}      → data.sectorPercentile
{{TOP_ACHIEVEMENT}} → data.topAchievement
{{SCORE_OFFSET}}    → 251.2 - (data.yearEndScore / 100 * 251.2)
{{MONTHLY_BARS}}    → generateMonthlyBarsXML(data.monthlyScores)
```

SVG template dosyası: `artifacts/api-server/src/templates/annual-report-template.svg`
Bu dosyaya teslim edilen yillik-guvenlik-raporu.svg içeriğini kopyala,
yukarıdaki statik değerlerin yerine {{PLACEHOLDER}} koy.

### 4.3 Cron Job

Mevcut cron dosyasına (cronJobs.ts veya benzeri) ekle:

```typescript
// Yıllık rapor — her yıl 1 Ocak 09:00
await wrapCron('annual_security_report', '0 9 1 1 *', async () => {
  const year = new Date().getFullYear() - 1; // geçen yıl
  const customers = await getActiveCustomersWithScans(year);
  let sent = 0;

  for (const customer of customers) {
    try {
      const scans = await getYearScans(customer.domain, year);
      if (!scans.length) continue;

      const reportData = {
        companyName: customer.companyName,
        domain: customer.domain,
        year,
        yearEndScore:    scans[scans.length - 1].overallScore,
        yearEndGrade:    scans[scans.length - 1].letterGrade,
        prevYearScore:   scans[0].overallScore,
        scoreDelta:      scans[scans.length - 1].overallScore - scans[0].overallScore,
        totalScans:      scans.length,
        closedFindings:  await countClosedFindings(customer.domain, year),
        surfaceReduction: 0, // henüz hesaplanmıyor — 0 göster
        avgCriticalCloseDays: await avgCriticalCloseDays(customer.domain, year),
        monthlyScores:   calculateMonthlyScores(scans, year),
        topAchievement:  detectTopAchievement(scans, year),
        sectorPercentile: calculateSectorPercentile(customer.sector, scans[scans.length-1].overallScore),
      };

      const svgContent = generateAnnualReportSvg(reportData);

      // PDF üretimi (resvg-js ile)
      const { Resvg } = await import('@resvg/resvg-js');
      const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 800 } });
      const pngBuffer = resvg.render().asPng();
      // PNG'yi storage'a yükle (Supabase Storage veya local /uploads klasörü)
      const pdfUrl = await saveReport(pngBuffer, `${customer.domain}-${year}-annual.png`);

      await db.insert(annualReports).values({ ...reportData, svgContent, pdfUrl });
      await sendAnnualReportEmail(customer.email, customer.companyName, pdfUrl, year, reportData);

      sent++;
      await new Promise(r => setTimeout(r, 10000)); // 10 sn aralık
    } catch (err) {
      console.error(`Annual report failed for ${customer.domain}:`, err);
    }
  }
  console.log(`Annual reports: ${sent}/${customers.length} sent`);
});
```

### 4.4 Manuel Tetikleme Endpoint'i (test için)

```typescript
// POST /api/admin/reports/annual/generate
// Body: { domain?: string, year?: number }
router.post('/reports/annual/generate', adminAuth, async (req, res) => {
  const year = req.body.year ?? new Date().getFullYear() - 1;
  const domain = req.body.domain;
  // Tek domain için veya tümü için çalıştır
  await generateAnnualReports(year, domain);
  res.json({ success: true });
});
```

---

## BÖLÜM 5: FRONTEND ENTEGRASYONU

### 5.1 Tarama Sonuç Sayfasına Kart Ekleme

Mevcut tarama sonuç sayfasında SecurityScoreCard komponentini kullan:
```tsx
<SecurityScoreCard
  score={scan.overallScore}
  grade={scan.letterGrade}
  domain={scan.domain}
  companyName={scan.domain}
  criticalCount={scan.criticalCount ?? 0}
  highCount={scan.highCount ?? 0}
  mediumCount={scan.mediumCount ?? 0}
  sectorAvg={54}
  scanDate={scan.scannedAt}
  variant="full"
/>
```

### 5.2 Paylaş Butonu

is_publicly_shared=true ise göster:
```tsx
{scan.isPubliclyShared && (
  <div className="flex gap-3 mt-4">
    <button onClick={() => navigator.clipboard.writeText(`https://cyberstep.io/sonuc/${scan.badgeToken}`)}>
      Linki Kopyala
    </button>
    <a href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://cyberstep.io/sonuc/' + scan.badgeToken)}`} target="_blank">
      LinkedIn'de Paylaş
    </a>
  </div>
)}
```

### 5.3 OG Meta Tagları

/sonuc/:token sayfasının head bölümüne ekle:
```html
<meta property="og:title" content="{{domain}} — CyberStep Güvenlik Skoru" />
<meta property="og:description" content="Güvenlik Skoru: {{score}}/100 · Not: {{grade}}" />
<meta property="og:image" content="https://cyberstep.io/api/public/result/{{token}}/og-image.png" />
<meta property="og:image:width" content="840" />
<meta property="og:image:height" content="620" />
<meta name="twitter:card" content="summary_large_image" />
```

### 5.4 Müşteri Paneli — Geçmiş Raporlar

Müşteri paneline "Raporlarım" sekmesi ekle.
GET /api/customer/reports endpoint'i annual_reports tablosundan
o müşteriye ait raporları döndürür.
Her satırda: yıl, skor, not, "PDF İndir" linki.

---

## UYGULAMA SIRASI

1. annual_reports tablosu — Drizzle migration
2. SecurityScoreCard React komponenti (3 variant)
3. npm install satori @resvg/resvg-js
4. Inter fontlarını assets/fonts/ klasörüne koy
5. og-image.ts endpoint + rate limiter
6. OG meta tagları /sonuc/:token sayfasına ekle
7. annual-report-template.svg dosyası (statik SVG → placeholder'larla)
8. generateAnnualReportSvg() fonksiyonu
9. annual_security_report cron job (wrapCron ile)
10. Manuel tetikleme endpoint'i POST /api/admin/reports/annual/generate
11. Müşteri paneli "Raporlarım" sekmesi
12. Test: domain tara → /sonuc/:token OG görselini LinkedIn debugger ile doğrula

---

## KISITLAR VE NOTLAR

- Satori'de position:absolute yok — sadece flexbox kullan
- Satori'de SVG içinde SVG yok — score ring için CSS border-radius:50% + border trick kullan
- Font dosyaları server'da fiziksel olarak bulunmalı — CDN'den runtime çekilemez
- OG image endpoint: 20 istek/dk/IP rate limit
- Yıllık rapor e-postası: müşteri başına 10 saniye aralık (spam koruması)
- surfaceReduction hesabı ilk versiyonda 0 gösterilebilir — ileriki sprint'e ertelenebilir
- Annual report PNG formatında kaydedilir (PDF dönüşümü için ayrı kütüphane gerekmez)
- Manuel tetikleme endpoint'i test için zorunlu — Ocak'ı bekleme
