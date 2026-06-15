# CyberStep — İç Tarama Faz 3: Claude AI Öneri Motoru
## Replit Agent Promptu

---

## BAĞLAM

Faz 1 ve Faz 2 tamamlandı:
- internal_scans tablosu dolu (script verisi)
- internal_scan_surveys tablosu dolu (anket verisi)
- Dış tarama verileri prospect_scans tablosunda

Bu prompt dış + iç + anket verilerini birleştirip
Claude Haiku ile vCISO kalitesinde aksiyon planı üretiyor.

Tetikleme: Upload endpoint'inde otomatik (arka planda) +
müşteri/ISR panelinde "Yeniden Üret" butonu.

Model: claude-haiku-4-5-20251001 (hızlı + ucuz)
Ortalama maliyet: ~$0.005 per analiz
Cache süresi: 24 saat

---

## BÖLÜM 1 — VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS ai_security_reports (
  id              serial PRIMARY KEY,
  customer_id     integer REFERENCES users(id) ON DELETE CASCADE,
  internal_scan_id integer REFERENCES internal_scans(id),

  -- Çıktı bölümleri (ayrı kolonlar — kolay sorgu için)
  executive_summary     text,        -- CEO'ya sunulabilir özet
  critical_actions      jsonb,       -- bu hafta yapılacaklar
  medium_term_actions   jsonb,       -- 30-90 gün
  long_term_actions     jsonb,       -- 6-12 ay
  cost_estimates        jsonb,       -- her öneri için maliyet
  benchmark_data        jsonb,       -- sektör karşılaştırma
  full_response         jsonb,       -- Claude'un tam yanıtı

  -- Meta
  model_used      varchar(50) DEFAULT 'claude-haiku-4-5-20251001',
  input_tokens    integer,
  output_tokens   integer,
  generated_at    timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_customer
  ON ai_security_reports(customer_id, generated_at DESC);
```

Drizzle schema'ya ekle, npm run db:push.

---

## BÖLÜM 2 — VERİ BİRLEŞTİRME FONKSİYONU

Yeni dosya: `artifacts/api-server/src/lib/ai/buildSecurityContext.ts`

```typescript
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';

export async function buildSecurityContext(customerId: number): Promise<string> {

  // 1. Müşteri bilgisi
  const customer = await db.query.users.findFirst({
    where: eq(users.id, customerId),
    columns: { email: true, companyName: true, sector: true }
  });

  // 2. Dış tarama — prospect_scans üzerinden
  const prospect = await db.query.enterpriseProspects.findFirst({
    where: eq(enterpriseProspects.customerId, customerId)
  });

  let externalScan = null;
  if (prospect) {
    externalScan = await db.query.prospectScans.findFirst({
      where: eq(prospectScans.prospectId, prospect.id),
      orderBy: desc(prospectScans.scannedAt)
    });
  }

  // 3. İç tarama
  const internalScan = await db.query.internalScans.findFirst({
    where: eq(internalScans.customerId, customerId),
    orderBy: desc(internalScans.scannedAt)
  });

  // 4. Anket
  const survey = await db.query.internalScanSurveys.findFirst({
    where: eq(internalScanSurveys.customerId, customerId)
  });

  // ── CONTEXT METNİ OLUŞTUR ───────────────────────────────────────────────
  const lines: string[] = [];

  lines.push('=== ŞİRKET BİLGİSİ ===');
  lines.push(`Şirket: ${customer?.companyName || 'Bilinmiyor'}`);
  lines.push(`Sektör: ${customer?.sector || 'Bilinmiyor'}`);
  lines.push(`Domain: ${prospect?.domain || 'Bilinmiyor'}`);

  if (externalScan) {
    lines.push('');
    lines.push('=== DIŞ TARAMA SONUÇLARI ===');
    lines.push(`Dış Güvenlik Skoru: ${externalScan.overallScore}/100 (${externalScan.letterGrade})`);
    lines.push(`Kritik Bulgu: ${externalScan.criticalCount || 0}`);
    lines.push(`Yüksek Risk: ${externalScan.highCount || 0}`);
    lines.push(`Orta Risk: ${externalScan.mediumCount || 0}`);
    lines.push(`SPF: ${externalScan.hasSpf ? 'VAR' : 'YOK'}`);
    lines.push(`DMARC: ${externalScan.hasDmarc ? 'VAR' : 'YOK'}`);
    lines.push(`DKIM: ${externalScan.hasDkim ? 'VAR' : 'YOK'}`);
    if (externalScan.sslDaysLeft !== null) {
      lines.push(`SSL Sertifikası: ${externalScan.sslDaysLeft} gün kaldı`);
    }
    if (externalScan.openPortCount) {
      lines.push(`Açık Port Sayısı: ${externalScan.openPortCount}`);
    }
    if (externalScan.httpHeaderScore !== null) {
      lines.push(`HTTP Güvenlik Başlıkları: ${externalScan.httpHeaderScore}/100`);
    }
    if (externalScan.wafDetected) {
      lines.push(`WAF/CDN: ${externalScan.wafProvider || 'Tespit edildi'}`);
    }
    // CVE bilgileri varsa
    if (externalScan.criticalCves?.length) {
      lines.push(`Kritik CVE'ler: ${externalScan.criticalCves.slice(0,5).join(', ')}`);
    }
  }

  if (internalScan?.rawData) {
    const raw = internalScan.rawData as any;
    lines.push('');
    lines.push('=== İÇ TARAMA SONUÇLARI ===');
    lines.push(`İç Güvenlik Skoru: ${internalScan.internalScore}/100`);
    lines.push(`Tarama Tarihi: ${internalScan.scannedAt?.toLocaleDateString('tr-TR')}`);

    // OS bilgisi
    if (raw.os) {
      lines.push(`İşletim Sistemi: ${raw.os.name} ${raw.os.version || ''}`);
      if (raw.os.is_eol) lines.push('⚠ EOL İşletim Sistemi Tespit Edildi');
      if (raw.os.last_patch_date) {
        lines.push(`Son Yama: ${raw.os.last_patch_date}`);
      }
      if (raw.os.auto_update === false) {
        lines.push('⚠ Otomatik güncelleme kapalı');
      }
    }

    // Güvenlik
    if (raw.security) {
      const av = raw.security.av || {};
      if (!av.enabled && !raw.security.av_detected) {
        lines.push('⚠ AV/EDR tespit edilmedi');
      } else if (av.name) {
        lines.push(`AV/EDR: ${av.name}`);
        if (av.signature_outdated) lines.push('⚠ AV imzaları güncel değil');
      }
      if (raw.security.firewall) {
        const fw = raw.security.firewall;
        if (!fw.private_enabled && !fw.domain_enabled) {
          lines.push('⚠ Güvenlik duvarı kapalı');
        }
      }
      if (raw.security.bitlocker?.enabled === false) {
        lines.push('⚠ Disk şifreleme (BitLocker) kapalı');
      }
      if (raw.security.luks_encryption === false) {
        lines.push('⚠ Disk şifreleme (LUKS) kapalı');
      }
    }

    // Kimlik / AD
    if (raw.identity) {
      const id = raw.identity;
      lines.push(`Kimlik Modu: ${id.mode}`);
      if (id.domain_admin_count !== null && id.domain_admin_count !== undefined) {
        lines.push(`Domain Admin Sayısı: ${id.domain_admin_count}`);
      }
      if (id.kerberoastable_accounts > 0) {
        lines.push(`⚠ Kerberoastable hesap: ${id.kerberoastable_accounts}`);
      }
      if (id.asrep_roastable > 0) {
        lines.push(`⚠ AS-REP Roastable hesap: ${id.asrep_roastable}`);
      }
      if (id.password_never_expires > 3) {
        lines.push(`⚠ Şifre süresi dolmayan hesap: ${id.password_never_expires}`);
      }
      if (id.stale_users_90d > 5) {
        lines.push(`⚠ 90+ gün giriş yapmayan hesap: ${id.stale_users_90d}`);
      }
      if (id.password_policy) {
        const pw = id.password_policy;
        lines.push(`Şifre min uzunluk: ${pw.min_length}`);
        lines.push(`Şifre karmaşıklık: ${pw.complexity_enabled ? 'Açık' : 'KAPALI'}`);
      }
      if (id.sudo_nopasswd_entries > 0) {
        lines.push(`⚠ Sudo NOPASSWD kuralı: ${id.sudo_nopasswd_entries}`);
      }
      if (id.ssh_permit_empty_passwords === 'yes') {
        lines.push('⚠ SSH boş şifreye izin veriyor');
      }
    }

    // Skor breakdown
    if (internalScan.scoreBreakdown) {
      const bd = internalScan.scoreBreakdown as any;
      lines.push('');
      lines.push('Kategori Skorları:');
      Object.entries(bd).forEach(([k, v]) => {
        lines.push(`  ${k}: ${v}`);
      });
    }

    // Bulgular
    if (internalScan.scoreBreakdown) {
      const findings = (internalScan as any).findings as any[];
      if (findings?.length) {
        lines.push('');
        lines.push('İç Tarama Bulguları (önem sırasına göre):');
        findings.slice(0, 10).forEach(f => {
          lines.push(`  [${f.severity.toUpperCase()}] ${f.finding} (-${f.points} puan)`);
        });
      }
    }
  }

  if (survey) {
    lines.push('');
    lines.push('=== GÜVENLİK ANKETİ ===');

    // Yedekleme
    lines.push(`Yedekleme: ${survey.backupEnabled ? 'VAR' : 'YOK'}`);
    if (survey.backupEnabled) {
      lines.push(`  Sıklık: ${survey.backupFrequency || 'Belirtilmemiş'}`);
      lines.push(`  Off-site: ${survey.backupOffsite ? 'VAR' : 'YOK'}`);
      lines.push(`  Immutable: ${survey.backupImmutable ? 'VAR' : 'YOK'}`);
      if (survey.backupLastTestDate) {
        const days = Math.floor(
          (Date.now() - new Date(survey.backupLastTestDate).getTime()) / 86400000
        );
        lines.push(`  Son test: ${days} gün önce`);
      }
    }

    // IR
    lines.push(`IR Planı: ${survey.irPlanExists ? 'VAR' : 'YOK'}`);
    if (survey.irPlanExists && survey.irPlanLastTest) {
      const days = Math.floor(
        (Date.now() - new Date(survey.irPlanLastTest).getTime()) / 86400000
      );
      lines.push(`  Son tatbikat: ${days} gün önce`);
    }

    // Eğitim
    lines.push(`Güvenlik Eğitimi: ${survey.securityTraining ? 'VAR' : 'YOK'}`);
    lines.push(`Phishing Simülasyonu: ${survey.phishingSimulation ? 'VAR' : 'YOK'}`);

    // Uyumluluk
    lines.push(`KVKK VERBİS: ${survey.kvkkVerbisRegistered ? 'KAYITLI' : 'KAYITSIZ'}`);
    lines.push(`Siber Sigorta: ${survey.cyberInsurance ? 'VAR' : 'YOK'}`);
    lines.push(`ISO 27001: ${survey.iso27001 ? 'VAR' : 'YOK'}`);
    lines.push(`SIEM: ${survey.siemExists ? 'VAR' : 'YOK'}`);
    lines.push(`SOC: ${survey.socType || 'YOK'}`);
  }

  return lines.join('\n');
}
```

---

## BÖLÜM 3 — AI RAPOR ÜRETİCİ

Yeni dosya: `artifacts/api-server/src/lib/ai/generateSecurityReport.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { buildSecurityContext } from './buildSecurityContext';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SecurityReportOutput {
  executiveSummary: string;
  criticalActions: ActionItem[];
  mediumTermActions: ActionItem[];
  longTermActions: ActionItem[];
  costEstimates: CostItem[];
  benchmarkData: BenchmarkData;
}

export interface ActionItem {
  priority: number;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';     // uygulama zorluğu
  impact: 'low' | 'medium' | 'high';     // güvenlik etkisi
  timeline: string;                        // "Bu hafta", "30 gün içinde"
  responsible: string;                    // "IT Yöneticisi", "Dış Danışman"
  category: string;                       // "identity", "backup", "os" vb.
}

export interface CostItem {
  action: string;
  estimated_cost_tl: string;   // "Ücretsiz", "₺500-2.000", "₺10.000+"
  cost_type: string;           // "one_time", "monthly", "annual"
  notes: string;
}

export interface BenchmarkData {
  sector_average_score: number;
  company_score: number;
  percentile: number;         // sektörün kaçıncı yüzdeliğinde
  common_gaps: string[];      // sektörde en sık görülen eksiklikler
}

export async function generateSecurityReport(
  customerId: number,
  internalScanId: number
): Promise<SecurityReportOutput> {

  const context = await buildSecurityContext(customerId);

  const systemPrompt = `Sen CyberStep'in kıdemli güvenlik danışmanısın (vCISO seviyesi).
Türkiye'deki KOBİ ve orta ölçekli şirketlere siber güvenlik danışmanlığı yapıyorsun.

Türk iş ortamını, KVKK mevzuatını ve yerel IT altyapısını iyi biliyorsun.
Önerilerin uygulanabilir, önceliklendirilmiş ve maliyet bilinçli olmalı.

KURAL: Her zaman JSON formatında yanıt ver. Başka metin ekleme.`;

  const userPrompt = `Aşağıdaki güvenlik verilerine dayanarak kapsamlı güvenlik raporu hazırla.

${context}

Şu JSON yapısında yanıt ver:
{
  "executive_summary": "3-4 paragraf. CEO'ya sunulabilir dil. Teknik terim kullanma. Mevcut durum, temel riskler ve önerilen yön.",

  "critical_actions": [
    {
      "priority": 1,
      "title": "Kısa aksiyon başlığı",
      "description": "Ne yapılacak, nasıl yapılacak, neden önemli",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "timeline": "Bu hafta içinde",
      "responsible": "IT Yöneticisi",
      "category": "identity|os|backup|network|security|compliance"
    }
  ],

  "medium_term_actions": [
    {
      "priority": 1,
      "title": "...",
      "description": "...",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "timeline": "30-60 gün içinde",
      "responsible": "...",
      "category": "..."
    }
  ],

  "long_term_actions": [
    {
      "priority": 1,
      "title": "...",
      "description": "...",
      "effort": "medium|high",
      "impact": "high",
      "timeline": "6-12 ay içinde",
      "responsible": "...",
      "category": "..."
    }
  ],

  "cost_estimates": [
    {
      "action": "Hangi aksiyon için",
      "estimated_cost_tl": "₺X.XXX - ₺X.XXX",
      "cost_type": "one_time|monthly|annual",
      "notes": "Açıklama veya alternatif"
    }
  ],

  "benchmark_data": {
    "sector_average_score": 55,
    "company_score": 62,
    "percentile": 60,
    "common_gaps": [
      "Sektörde en sık görülen eksiklik 1",
      "Sektörde en sık görülen eksiklik 2",
      "Sektörde en sık görülen eksiklik 3"
    ]
  }
}

Kritik aksiyonlar: maksimum 5 madde, en yüksek etkili olanlar.
Orta vadeli: maksimum 6 madde.
Uzun vadeli: maksimum 4 madde.
Maliyet tahmini: her kritik aksiyon için en az bir tahmini maliyet.
Tüm Türkçe yaz.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text'
    ? response.content[0].text : '';

  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    executiveSummary: parsed.executive_summary,
    criticalActions: parsed.critical_actions || [],
    mediumTermActions: parsed.medium_term_actions || [],
    longTermActions: parsed.long_term_actions || [],
    costEstimates: parsed.cost_estimates || [],
    benchmarkData: parsed.benchmark_data || {
      sector_average_score: 55,
      company_score: 0,
      percentile: 50,
      common_gaps: [],
    },
  };
}
```

---

## BÖLÜM 4 — BACKEND ENDPOINT'LERİ

```typescript
// POST /api/internal-scan/generate-report
// Manuel tetikleme — "Rapor Üret" butonu

router.post('/internal-scan/generate-report', customerAuth, async (req, res) => {
  const customerId = req.user.id;

  // Cache kontrolü — son 24 saatte üretildiyse tekrar üretme
  const existing = await db.query.aiSecurityReports.findFirst({
    where: and(
      eq(aiSecurityReports.customerId, customerId),
      gte(aiSecurityReports.generatedAt,
        new Date(Date.now() - 24 * 60 * 60 * 1000))
    ),
    orderBy: desc(aiSecurityReports.generatedAt)
  });

  if (existing && !req.body.force) {
    return res.json({
      report: existing,
      cached: true,
      cachedAt: existing.generatedAt,
    });
  }

  // Son iç taramayı bul
  const internalScan = await db.query.internalScans.findFirst({
    where: eq(internalScans.customerId, customerId),
    orderBy: desc(internalScans.scannedAt)
  });

  if (!internalScan) {
    return res.status(400).json({
      error: 'Önce iç tarama çalıştırılmalı'
    });
  }

  try {
    // AI rapor üret
    const report = await generateSecurityReport(customerId, internalScan.id);

    // DB'ye kaydet
    const saved = await db.insert(aiSecurityReports).values({
      customerId,
      internalScanId: internalScan.id,
      executiveSummary: report.executiveSummary,
      criticalActions: report.criticalActions,
      mediumTermActions: report.mediumTermActions,
      longTermActions: report.longTermActions,
      costEstimates: report.costEstimates,
      benchmarkData: report.benchmarkData,
      fullResponse: report,
      generatedAt: new Date(),
    }).returning();

    res.json({ report: saved[0], cached: false });

  } catch (err) {
    console.error('AI rapor hatası:', err);
    res.status(500).json({ error: 'Rapor üretilemedi, tekrar deneyin' });
  }
});

// GET /api/internal-scan/latest-report
// En son raporu getir

router.get('/internal-scan/latest-report', customerAuth, async (req, res) => {
  const report = await db.query.aiSecurityReports.findFirst({
    where: eq(aiSecurityReports.customerId, req.user.id),
    orderBy: desc(aiSecurityReports.generatedAt)
  });
  res.json(report || null);
});
```

### Upload endpoint'ine otomatik tetikleme ekle

Mevcut `/api/internal-scan/upload` endpoint'ini bul.
Skor hesaplandıktan SONRA, arka planda rapor üret:

```typescript
// upload endpoint'inde, res.json() çağrısından SONRA:

// Arka planda AI raporu üret (await etme — kullanıcıyı beklettirme)
generateSecurityReport(customerId, saved[0].id)
  .then(report => db.insert(aiSecurityReports).values({
    customerId,
    internalScanId: saved[0].id,
    executiveSummary: report.executiveSummary,
    criticalActions: report.criticalActions,
    mediumTermActions: report.mediumTermActions,
    longTermActions: report.longTermActions,
    costEstimates: report.costEstimates,
    benchmarkData: report.benchmarkData,
    fullResponse: report,
    generatedAt: new Date(),
  }))
  .catch(err => console.error('Arka plan AI raporu hatası:', err));
// await etme — yanıt zaten gönderildi
```

---

## BÖLÜM 5 — FRONTEND: AI RAPOR SEKMESİ

`/hesabim/ic-tarama` sayfasına üçüncü sekme ekle:

**Sekme yapısı:**
- Sekme 1: Tarama Sonuçları
- Sekme 2: Güvenlik Anketi
- Sekme 3: AI Güvenlik Raporu ← yeni

```tsx
// AISecurityReport.tsx

import { useState, useEffect } from 'react';

export function AISecurityReport({ customerId }: { customerId: number }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'summary' | 'critical' | 'medium' | 'long' | 'cost'
  >('summary');

  useEffect(() => { fetchReport(); }, []);

  async function fetchReport() {
    const res = await fetch('/api/internal-scan/latest-report', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data) { setReport(data); setCached(true); }
  }

  async function generateReport(force = false) {
    setLoading(true);
    try {
      const res = await fetch('/api/internal-scan/generate-report', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      setReport(data.report);
      setCached(data.cached);
    } finally {
      setLoading(false);
    }
  }

  // Rapor yok
  if (!report && !loading) return (
    <div style={{
      background: '#0A1828', border: '1px solid #1A3050',
      borderRadius: 14, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#E8EDF5', marginBottom: 8 }}>
        AI Güvenlik Raporu
      </div>
      <div style={{ fontSize: 13, color: '#8896A8', marginBottom: 22, lineHeight: 1.6 }}>
        Dış tarama, iç tarama ve anket verilerinizi birleştirerek<br/>
        vCISO kalitesinde aksiyon planı oluşturur.
      </div>
      <button
        onClick={() => generateReport()}
        style={{
          background: '#9B59B6', color: 'white', border: 'none',
          borderRadius: 10, padding: '12px 28px',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >
        🚀 Rapor Üret
      </button>
    </div>
  );

  // Yükleniyor
  if (loading) return (
    <div style={{
      background: '#0A1828', border: '1px solid #9B59B6',
      borderRadius: 14, padding: 40, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>🤖</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#9B59B6' }}>
        Güvenlik raporu hazırlanıyor...
      </div>
      <div style={{ fontSize: 13, color: '#8896A8', marginTop: 6 }}>
        Tüm veriler analiz ediliyor, aksiyon planı oluşturuluyor
      </div>
    </div>
  );

  const r = report;
  const sections = [
    { key: 'summary',  label: '📋 Yönetici Özeti' },
    { key: 'critical', label: '🔴 Kritik Aksiyonlar' },
    { key: 'medium',   label: '🟡 Orta Vadeli' },
    { key: 'long',     label: '🟢 Uzun Vadeli' },
    { key: 'cost',     label: '💰 Maliyet Tahmini' },
  ] as const;

  return (
    <div style={{
      background: '#0A1828', border: '1px solid #9B59B6',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#091520', padding: '16px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1A3050',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E8EDF5' }}>
              AI Güvenlik Raporu
            </div>
            <div style={{ fontSize: 11, color: '#8896A8' }}>
              {cached ? 'Önbellekten' : 'Şimdi üretildi'} ·{' '}
              {new Date(r.generatedAt).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>
        <button
          onClick={() => generateReport(true)}
          style={{
            background: 'transparent', border: '1px solid #1A3050',
            color: '#8896A8', borderRadius: 8,
            padding: '6px 14px', fontSize: 11, cursor: 'pointer',
          }}
        >
          🔄 Yeniden Üret
        </button>
      </div>

      {/* Benchmark şeridi */}
      {r.benchmarkData && (
        <div style={{
          background: 'rgba(155,89,182,0.08)',
          borderBottom: '1px solid rgba(155,89,182,0.2)',
          padding: '10px 24px',
          display: 'flex', gap: 32, alignItems: 'center',
        }}>
          <div style={{ fontSize: 12, color: '#8896A8' }}>
            Sektör Karşılaştırması:
          </div>
          <div style={{ fontSize: 13, color: '#E8EDF5' }}>
            Sektör Ort: <strong style={{ color: '#8896A8' }}>
              {r.benchmarkData.sector_average_score}
            </strong>
          </div>
          <div style={{ fontSize: 13, color: '#E8EDF5' }}>
            Sizin Skorunuz: <strong style={{ color: '#9B59B6' }}>
              {r.benchmarkData.company_score}
            </strong>
          </div>
          <div style={{ fontSize: 13, color: '#E8EDF5' }}>
            Yüzdelik: <strong style={{ color: '#2ECC71' }}>
              %{r.benchmarkData.percentile}
            </strong>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #1A3050',
        background: '#060D1A', overflowX: 'auto',
      }}>
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            style={{
              padding: '11px 18px', fontSize: 12, fontWeight: 600,
              background: 'transparent', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              color: activeSection === sec.key ? '#9B59B6' : '#8896A8',
              borderBottom: activeSection === sec.key
                ? '2px solid #9B59B6' : '2px solid transparent',
            }}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ padding: 24 }}>

        {/* YÖNETİCİ ÖZETİ */}
        {activeSection === 'summary' && (
          <div style={{
            fontSize: 14, color: '#E8EDF5',
            lineHeight: 1.8, whiteSpace: 'pre-wrap',
          }}>
            {r.executiveSummary}
            {r.benchmarkData?.common_gaps?.length > 0 && (
              <div style={{
                marginTop: 24, background: '#060D1A',
                border: '1px solid #1A3050', borderRadius: 10, padding: 16,
              }}>
                <div style={{ fontSize: 12, color: '#8896A8', marginBottom: 10,
                  letterSpacing: 1, textTransform: 'uppercase' }}>
                  Sektörde En Sık Görülen Eksiklikler
                </div>
                {r.benchmarkData.common_gaps.map((gap: string, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, marginBottom: 6,
                    fontSize: 13, color: '#8896A8',
                  }}>
                    <span style={{ color: '#9B59B6' }}>•</span> {gap}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AKSİYON LİSTESİ */}
        {(activeSection === 'critical' ||
          activeSection === 'medium' ||
          activeSection === 'long') && (
          <ActionList
            items={
              activeSection === 'critical' ? r.criticalActions :
              activeSection === 'medium'   ? r.mediumTermActions :
                                             r.longTermActions
            }
            color={
              activeSection === 'critical' ? '#E03A3A' :
              activeSection === 'medium'   ? '#F5A623' : '#2ECC71'
            }
          />
        )}

        {/* MALİYET TAHMİNİ */}
        {activeSection === 'cost' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.costEstimates?.map((item: any, i: number) => (
              <div key={i} style={{
                background: '#060D1A', border: '1px solid #1A3050',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EDF5' }}>
                    {item.action}
                  </div>
                  {item.notes && (
                    <div style={{ fontSize: 11, color: '#8896A8', marginTop: 3 }}>
                      {item.notes}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2ECC71' }}>
                    {item.estimated_cost_tl}
                  </div>
                  <div style={{ fontSize: 10, color: '#4A6080', marginTop: 2 }}>
                    {item.cost_type === 'one_time' ? 'Tek seferlik' :
                     item.cost_type === 'monthly' ? '/ay' : '/yıl'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// Aksiyon listesi komponenti
function ActionList({ items, color }: { items: any[]; color: string }) {
  const effortLabel = { low: 'Kolay', medium: 'Orta', high: 'Zor' };
  const impactLabel = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items?.map((item: any, i: number) => (
        <div key={i} style={{
          background: '#060D1A', border: `1px solid ${color}22`,
          borderRadius: 10, padding: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            gap: 12, marginBottom: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: color, color: '#060D1A',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {item.priority}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#E8EDF5' }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: '#8896A8', marginTop: 4 }}>
                ⏱ {item.timeline} · 👤 {item.responsible}
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 13, color: '#8896A8', lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(0,200,255,0.1)', color: '#00C8FF',
              borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>
              Uygulama: {effortLabel[item.effort as keyof typeof effortLabel] || item.effort}
            </span>
            <span style={{
              background: `${color}15`, color,
              borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>
              Etki: {impactLabel[item.impact as keyof typeof impactLabel] || item.impact}
            </span>
            <span style={{
              background: 'rgba(155,89,182,0.1)', color: '#9B59B6',
              borderRadius: 6, padding: '3px 10px', fontSize: 11,
            }}>
              {item.category}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## BÖLÜM 6 — ISR PANELİNDE AI RAPORU

ISR'nin lead/müşteri detay sayfasında AI raporu da görünür.
Mevcut ISR Copilot bölümünün yanına "Güvenlik Raporu" sekmesi ekle:

```tsx
// ISR panelinde müşteri sayfasında:
// Eğer müşterinin ai_security_reports kaydı varsa
// "Tam Güvenlik Raporu Gör" linki göster

const reportRes = await fetch(`/api/admin/customer/${customerId}/security-report`);
```

Yeni admin endpoint:

```typescript
// GET /api/admin/customer/:customerId/security-report
router.get('/admin/customer/:customerId/security-report', adminAuth, async (req, res) => {
  const report = await db.query.aiSecurityReports.findFirst({
    where: eq(aiSecurityReports.customerId, parseInt(req.params.customerId)),
    orderBy: desc(aiSecurityReports.generatedAt)
  });
  res.json(report || null);
});
```

---

## TEST

1. `buildSecurityContext()` fonksiyonu — veri olan müşteri için context oluşturuyor mu?
   Context içinde dış tarama, iç tarama ve anket verileri var mı?

2. `generateSecurityReport()` — Claude API çağrısı JSON dönüyor mu?
   Parse hatası var mı?

3. Upload endpoint'inde arka plan üretimi — hata loglanıyor mu?

4. `POST /api/internal-scan/generate-report` → rapor DB'ye kaydedildi mi?

5. Cache çalışıyor mu? İkinci çağrıda `cached: true` dönmeli.

6. `force: true` ile cache bypass çalışıyor mu?

7. Frontend — "Rapor Üret" butonu görünüyor mu?

8. 5 sekme düzgün çalışıyor mu?

9. Benchmark şeridi skor gösteriyor mu?

10. Happy.com.tr gibi bir müşteri için test et —
    executive summary Türkçe ve anlaşılır mı?
    Kritik aksiyonlar mantıklı mı?

---

## KISITLAR

- Model claude-haiku-4-5-20251001 — değiştirme
- max_tokens: 3000 — yeterli, artırma (maliyet artar)
- Arka plan üretimi hata fırlatırsa sessizce logla — upload'u bloklama
- JSON parse hatası olursa console.error, kullanıcıya "Tekrar deneyin"
- Cache 24 saat — aynı müşteri için günde 1 API çağrısı
- buildSecurityContext() null-safe yazılmış — eksik veri varsa atla
- Tablo ve kolon adlarını mevcut Drizzle şemasına göre ayarla
- aiSecurityReports Drizzle adını mevcut konvansiyona uydur
