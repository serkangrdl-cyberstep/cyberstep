# CyberStep — Kaynak Kalite Dashboard
## Replit Agent Promptu

---

## BAĞLAM

Domain keşif kaynakları genişledi (crt_sh, certstream, shodan, shodan_asn, urlscan, virustotal_subdomain, ripestat).
Her kaynağın kalifikasyon oranını, lead üretim hızını ve dönüşüm performansını
admin panelde tek ekranda görmek gerekiyor.

Stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React + shadcn/ui
Mevcut: /panel/admin rotası var, enterprise_prospects tablosu mevcut, source kolonu eklendi.

---

## BÖLÜM 1 — VERİTABANI SORGULARI

### 1.1 Kaynak bazlı özet sorgusu

Backend'e yeni endpoint ekle: `GET /api/admin/source-stats`

```typescript
router.get('/source-stats', adminAuth, async (req, res) => {
  // Tarih filtresi — varsayılan son 30 gün
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Kaynak bazlı metrikler
  const stats = await db.execute(sql`
    SELECT
      COALESCE(source, 'unknown')                    AS source,
      COUNT(*)                                        AS total_discovered,
      COUNT(*) FILTER (WHERE status != 'new')         AS total_scanned,
      COUNT(*) FILTER (WHERE overall_score IS NOT NULL AND overall_score < 60)
                                                      AS qualified_count,
      COUNT(*) FILTER (WHERE status = 'teaser_sent') AS teaser_sent,
      COUNT(*) FILTER (WHERE status = 'teaser_viewed') AS teaser_viewed,
      COUNT(*) FILTER (WHERE status IN ('demo_requested','won'))
                                                      AS converted,
      ROUND(AVG(overall_score) FILTER (WHERE overall_score IS NOT NULL), 1)
                                                      AS avg_score,
      ROUND(
        COUNT(*) FILTER (WHERE overall_score IS NOT NULL AND overall_score < 60)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE overall_score IS NOT NULL), 0) * 100
      , 1)                                            AS qualification_rate,
      MIN(discovered_at)                              AS first_seen,
      MAX(discovered_at)                              AS last_seen,
      COUNT(*) FILTER (WHERE discovered_at >= ${since})
                                                      AS discovered_last_period
    FROM enterprise_prospects
    GROUP BY source
    ORDER BY total_discovered DESC
  `);

  // Genel toplam
  const totals = await db.execute(sql`
    SELECT
      COUNT(*)                                         AS total,
      COUNT(*) FILTER (WHERE overall_score IS NOT NULL AND overall_score < 60)
                                                       AS total_qualified,
      ROUND(
        COUNT(*) FILTER (WHERE overall_score IS NOT NULL AND overall_score < 60)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE overall_score IS NOT NULL), 0) * 100
      , 1)                                             AS overall_qualification_rate,
      COUNT(DISTINCT source)                           AS active_sources
    FROM enterprise_prospects
  `);

  // Günlük keşif trendi (son 14 gün)
  const trend = await db.execute(sql`
    SELECT
      DATE(discovered_at)   AS day,
      source,
      COUNT(*)              AS count
    FROM enterprise_prospects
    WHERE discovered_at >= NOW() - INTERVAL '14 days'
    GROUP BY DATE(discovered_at), source
    ORDER BY day ASC
  `);

  // TLD dağılımı
  const tldStats = await db.execute(sql`
    SELECT
      CASE
        WHEN domain LIKE '%.com.tr'  THEN 'com.tr'
        WHEN domain LIKE '%.net.tr'  THEN 'net.tr'
        WHEN domain LIKE '%.org.tr'  THEN 'org.tr'
        WHEN domain LIKE '%.biz.tr'  THEN 'biz.tr'
        WHEN domain LIKE '%.edu.tr'  THEN 'edu.tr'
        WHEN domain LIKE '%.web.tr'  THEN 'web.tr'
        WHEN domain LIKE '%.gen.tr'  THEN 'gen.tr'
        WHEN domain LIKE '%.info.tr' THEN 'info.tr'
        ELSE 'other'
      END                         AS tld,
      COUNT(*)                    AS total,
      ROUND(AVG(overall_score) FILTER (WHERE overall_score IS NOT NULL), 1) AS avg_score,
      COUNT(*) FILTER (WHERE overall_score IS NOT NULL AND overall_score < 60) AS qualified
    FROM enterprise_prospects
    GROUP BY tld
    ORDER BY total DESC
  `);

  res.json({
    stats: stats.rows,
    totals: totals.rows[0],
    trend: trend.rows,
    tldStats: tldStats.rows,
    period: days,
  });
});
```

---

## BÖLÜM 2 — FRONTEND DASHBOARD

Admin panele yeni sayfa ekle: `/panel/admin/source-dashboard`

Dosya: `artifacts/frontend/src/pages/admin/SourceDashboard.tsx`

### 2.1 Sayfa Yapısı

Dört bölüm:

**A) Üst — 4 KPI Kartı (tek satır)**
**B) Orta sol — Kaynak Karşılaştırma Tablosu**
**C) Orta sağ — Günlük Keşif Trend Grafiği**
**D) Alt — TLD Dağılımı**

### 2.2 KPI Kartları

```tsx
// Renk sistemi — CyberStep palette
const C = {
  bg: '#060D1A',
  bg2: '#0A1828',
  cyan: '#00C8FF',
  amber: '#F5A623',
  green: '#2ECC71',
  red: '#E03A3A',
  muted: '#8896A8',
  border: '#1A3050',
};

// KPI kartları
const kpis = [
  {
    label: 'Toplam Domain',
    value: totals.total,
    color: C.cyan,
    icon: '🌐',
    sub: 'Tüm kaynaklar',
  },
  {
    label: 'Kvalifiye Lead',
    value: totals.total_qualified,
    color: C.amber,
    icon: '🎯',
    sub: `%${totals.overall_qualification_rate} oran`,
  },
  {
    label: 'Aktif Kaynak',
    value: totals.active_sources,
    color: C.green,
    icon: '📡',
    sub: 'crt.sh, certstream...',
  },
  {
    label: 'Genel Kali. Oranı',
    value: `%${totals.overall_qualification_rate}`,
    color: totals.overall_qualification_rate >= 20 ? C.green : C.amber,
    icon: '📊',
    sub: 'Hedef: >%20',
  },
];
```

### 2.3 Kaynak Karşılaştırma Tablosu

Sütunlar:
- Kaynak adı (ikon ile: crt_sh→🔐, certstream→📡, shodan→🔍, urlscan→🌐, virustotal→🦠, ripestat→🗺️)
- Toplam Keşfedilen
- Taranan
- Kvalifiye (#)
- **Kalifikasyon % → renkli progress bar** (<%15 kırmızı, %15-25 amber, >%25 yeşil)
- Ort. Skor
- Teaser Gönderim
- Dönüşüm
- Son Keşif (kaç saat/gün önce)

```tsx
function QualificationBar({ rate }: { rate: number }) {
  const color = rate >= 25 ? '#2ECC71' : rate >= 15 ? '#F5A623' : '#E03A3A';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 80, height: 6, background: '#1A3050', borderRadius: 3, overflow: 'hidden'
      }}>
        <div style={{
          width: `${Math.min(rate, 100)}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.8s ease',
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{rate}%</span>
    </div>
  );
}

// Kaynak ikon map
const SOURCE_ICONS: Record<string, string> = {
  crt_sh: '🔐',
  certstream: '📡',
  shodan: '🔍',
  shodan_asn: '🗄️',
  urlscan: '🌐',
  virustotal_subdomain: '🦠',
  ripestat: '🗺️',
  manual: '✏️',
  unknown: '❓',
};

// Kaynak display isim
const SOURCE_LABELS: Record<string, string> = {
  crt_sh: 'crt.sh',
  certstream: 'Certstream',
  shodan: 'Shodan',
  shodan_asn: 'Shodan ASN',
  urlscan: 'URLScan.io',
  virustotal_subdomain: 'VirusTotal',
  ripestat: 'RIPEStat',
  manual: 'Manuel',
  unknown: 'Bilinmiyor',
};
```

### 2.4 Trend Grafiği

shadcn/ui'de `recharts` kullan (zaten mevcut olabilir, yoksa npm install recharts):

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// trend verisi: [{day, source, count}] → recharts formatına çevir
function formatTrendData(trend: TrendRow[]) {
  const byDay: Record<string, Record<string, number>> = {};
  trend.forEach(row => {
    if (!byDay[row.day]) byDay[row.day] = {};
    byDay[row.day][row.source] = row.count;
  });
  return Object.entries(byDay).map(([day, sources]) => ({
    day: day.slice(5), // MM-DD formatı
    ...sources,
  }));
}

// Her kaynak için ayrı renk
const SOURCE_COLORS: Record<string, string> = {
  certstream: '#00C8FF',
  crt_sh: '#F5A623',
  shodan: '#9B59B6',
  shodan_asn: '#E03A3A',
  urlscan: '#2ECC71',
  virustotal_subdomain: '#00B4A6',
  ripestat: '#E67E22',
};
```

### 2.5 TLD Dağılımı

Yatay bar chart veya tablo:

```tsx
// Her TLD için:
// tld | toplam | qualifiye | ort. skor | kalifikasyon %
// com.tr | 6.240 | ████████ 24% | 62 | yeşil
// net.tr | 1.420 | ██████   18% | 58 | amber
// org.tr |   380 | ████     11% | 45 | kırmızı
// edu.tr |   120 | ██        8% | 38 | kırmızı (düşük öncelik)
```

### 2.6 Dönem Filtresi

Sağ üstte dropdown:
- Son 7 gün
- Son 30 gün (varsayılan)
- Son 90 gün
- Tüm zamanlar

Seçim değişince API'ye `?days=7` gibi parametre gönderir.

### 2.7 Tam Sayfa Kodu Taslağı

```tsx
// artifacts/frontend/src/pages/admin/SourceDashboard.tsx

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SourceDashboard() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/source-stats?days=${period}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [period]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: '#8896A8', fontSize: 16 }}>
      Yükleniyor...
    </div>
  );

  const trendData = formatTrendData(data.trend);
  const sources = Object.keys(SOURCE_COLORS).filter(s =>
    data.stats.some((row: any) => row.source === s)
  );

  return (
    <div style={{ padding: '24px 32px', background: '#060D1A', minHeight: '100vh', color: '#E8EDF5' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#E8EDF5' }}>
            📡 Kaynak Kalite Dashboard
          </h1>
          <p style={{ fontSize: 13, color: '#8896A8', marginTop: 4 }}>
            Domain keşif kaynaklarının performans karşılaştırması
          </p>
        </div>
        {/* Period selector */}
        <select
          value={period}
          onChange={e => setPeriod(Number(e.target.value))}
          style={{
            background: '#0A1828', border: '1px solid #1A3050', color: '#E8EDF5',
            padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer'
          }}
        >
          <option value={7}>Son 7 gün</option>
          <option value={30}>Son 30 gün</option>
          <option value={90}>Son 90 gün</option>
          <option value={9999}>Tüm zamanlar</option>
        </select>
      </div>

      {/* KPI kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {/* map kpis buraya */}
      </div>

      {/* Orta — tablo + grafik */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Kaynak tablosu */}
        <div style={{ background: '#0A1828', border: '1px solid #1A3050', borderRadius: 14, padding: '20px 0', overflow: 'hidden' }}>
          <div style={{ padding: '0 20px 14px', fontSize: 14, fontWeight: 700, color: '#E8EDF5', borderBottom: '1px solid #1A3050' }}>
            Kaynak Karşılaştırması
          </div>
          {/* tablo header + rows */}
          {data.stats.map((row: any) => (
            <SourceRow key={row.source} row={row} />
          ))}
        </div>

        {/* Trend grafiği */}
        <div style={{ background: '#0A1828', border: '1px solid #1A3050', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E8EDF5', marginBottom: 16 }}>
            Günlük Keşif Trendi
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <XAxis dataKey="day" stroke="#1A3050" tick={{ fill: '#8896A8', fontSize: 11 }} />
              <YAxis stroke="#1A3050" tick={{ fill: '#8896A8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0A1828', border: '1px solid #1A3050', borderRadius: 8 }}
                labelStyle={{ color: '#E8EDF5' }}
              />
              <Legend />
              {sources.map(s => (
                <Line key={s} type="monotone" dataKey={s}
                  stroke={SOURCE_COLORS[s]} strokeWidth={2}
                  dot={false} name={SOURCE_LABELS[s] || s} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TLD dağılımı */}
      <div style={{ background: '#0A1828', border: '1px solid #1A3050', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#E8EDF5', marginBottom: 16 }}>
          TLD Dağılımı
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {data.tldStats.map((tld: any) => (
            <TldCard key={tld.tld} tld={tld} />
          ))}
        </div>
      </div>

    </div>
  );
}
```

---

## BÖLÜM 3 — ADMIN PANEL MENÜYE EKLE

Mevcut admin panel navigation'ına yeni link ekle:

```tsx
// Admin sidebar veya nav'da:
{ label: '📡 Kaynak Dashboard', href: '/panel/admin/source-dashboard' }
```

Router'a da ekle:
```tsx
<Route path="/panel/admin/source-dashboard" element={<SourceDashboard />} />
```

---

## BÖLÜM 4 — OPSIYONEL: OTOMATIK UYARI

Bir kaynağın kalifikasyon oranı 7 günlük ortalamanın çok altına düşerse
Telegram alert gönder (mevcut Telegram alert servisi varsa kullan):

```typescript
// Haftada 1 — source_quality_check
await wrapCron('source_quality_check', '0 9 * * 1', async () => {
  const stats = await getSourceStats(30);

  for (const source of stats) {
    if (
      source.total_scanned > 50 && // yeterli veri varsa
      source.qualification_rate < 10 // oran %10 altındaysa
    ) {
      await sendTelegramAlert(
        alertWarning(
          `Kaynak Kalitesi Düşük: ${source.source}`,
          `Kalifikasyon oranı: %${source.qualification_rate} (${source.qualified_count}/${source.total_scanned})\nBu kaynaktan gelen domainler için pre-filter değerlendirin.`
        )
      );
    }
  }
});
```

---

## TEST

1. `/api/admin/source-stats` → JSON döndürüyor mu?
2. Her kaynak için `source` kolonu dolu mu? (NULL'lar `unknown` görünmeli)
3. `/panel/admin/source-dashboard` sayfası açılıyor mu?
4. Dönem filtresi değişince veri güncelleniyor mu?
5. Trend grafiğinde birden fazla kaynak çizgisi görünüyor mu?

---

## KISITLAR

- recharts zaten projede varsa tekrar yükleme
- Mevcut admin auth middleware'ini kullan — yeni endpoint korunmalı
- `overall_score` null olabilir (henüz taranmamış) — FILTER kullanıldı, sıfıra bölme koruması var
- source kolonu henüz eklenmemişse: `ALTER TABLE enterprise_prospects ADD COLUMN IF NOT EXISTS source varchar(50)`
- Tablo ve kolon adlarını mevcut şemaya göre ayarla
