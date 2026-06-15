# CyberStep — ISR Copilot (AI Destekli Satış Asistanı)
## Replit Agent Promptu

---

## BAĞLAM

ISR ekibi her lead için tarama verilerini yorumlayıp satış stratejisi belirlemekte zorlanıyor.
Bu modül ISR'nin "Copilot Başlat" butonuna basmasıyla tetiklenir.
Claude Haiku API'si o lead'in tüm tarama verisini alır, ISR'ye özel satış rehberi üretir.

Stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React
Mevcut: Anthropic SDK kurulu (Claude AI zaten kullanılıyor)
Model: claude-haiku-4-5-20251001 (ucuz + hızlı, bu iş için yeterli)

---

## BÖLÜM 1 — BACKEND ENDPOINT

### 1.1 Yeni endpoint

```typescript
// POST /api/isr/leads/:id/copilot
// ISR "Copilot Başlat" butonuna basınca çağrılır
// Sonuç DB'ye kaydedilir, her çağrıda yeniden üretilmez (cache)

router.post('/leads/:id/copilot', isrAuth, async (req, res) => {
  const leadId = parseInt(req.params.id);

  // 1. Mevcut copilot var mı kontrol et (bugün üretilmişse yeniden üretme)
  const existing = await db.query.isrCopilotCache.findFirst({
    where: and(
      eq(isrCopilotCache.prospectId, leadId),
      gte(isrCopilotCache.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
    )
  });
  if (existing) return res.json({ copilot: existing.content, cached: true });

  // 2. Lead + tarama verisini çek
  const lead = await db.query.enterpriseProspects.findFirst({
    where: eq(enterpriseProspects.id, leadId)
  });
  if (!lead) return res.status(404).json({ error: 'Lead bulunamadı' });

  const scan = await db.query.prospectScans.findFirst({
    where: eq(prospectScans.prospectId, leadId),
    orderBy: desc(prospectScans.scannedAt)
  });
  if (!scan) return res.status(400).json({ error: 'Tarama verisi yok' });

  // 3. Tech stack ve diğer veriler
  const techStack = await db.query.customerTechStack.findMany({
    where: eq(customerTechStack.prospectId, leadId)
  });

  // 4. Claude Haiku çağrısı
  const copilotContent = await generateCopilot(lead, scan, techStack);

  // 5. Cache'e kaydet
  await db.insert(isrCopilotCache).values({
    prospectId: leadId,
    content: copilotContent,
    createdAt: new Date(),
  }).onConflictDoUpdate({
    target: isrCopilotCache.prospectId,
    set: { content: copilotContent, createdAt: new Date() }
  });

  res.json({ copilot: copilotContent, cached: false });
});
```

### 1.2 generateCopilot() fonksiyonu

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateCopilot(
  lead: EnterpriseProspect,
  scan: ProspectScan,
  techStack: CustomerTechStack[]
): Promise<CopilotContent> {

  // Tarama verisini özet metne çevir
  const scanSummary = buildScanSummary(lead, scan, techStack);

  const systemPrompt = `Sen CyberStep'in ISR (İç Satış Temsilcisi) asistanısın.
Türkiye'deki şirketlere siber güvenlik SaaS hizmeti satıyorsunuz.

Ürün kataloğu:
- Kalkan Paketi: ₺2.990/ay — Dış saldırı yüzeyi izleme, SSL takibi, aylık rapor
- Zırh Paketi: ₺5.990/ay — Kalkan + gelişmiş tehdit istihbaratı + öncelikli destek
- vCISO Danışmanlık: ₺4.990/ay — Teknik rehberlik, KVKK uyum yol haritası, haftalık görüşme
- AI Saldırı Analizi: ₺4.990 tek seferlik — Derinlemesine güvenlik raporu

ISR teknik değil, satış odaklı. Karmaşık terimler kullanma.
Cevaplarını JSON formatında ver. Türkçe yaz.`;

  const userPrompt = `Aşağıdaki lead için ISR satış rehberi hazırla:

${scanSummary}

Şu an durumu: ${lead.status}
Son aktivite: ${lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString('tr-TR') : 'Yok'}

JSON formatında şunları üret:
{
  "musteri_ozeti": "2-3 cümle, ISR'nin okuyup hemen anlayacağı sade özet",
  "satis_acisi": "Bu müşteri için en güçlü satış açısı (tek paragraf)",
  "aciliyet_faktoru": "Neden şimdi harekete geçmeli (somut, tarih/rakam ile)",
  "onerilen_paket": {
    "isim": "paket adı",
    "fiyat": "₺X/ay",
    "neden": "Bu müşteri için neden bu paket (3 madde)"
  },
  "gorusmede_sor": [
    {"soru": "soru metni", "amac": "bu soruyu neden soruyoruz"},
    {"soru": "soru metni", "amac": "..."},
    {"soru": "soru metni", "amac": "..."}
  ],
  "itirazlar": [
    {"itiraz": "Fiyat pahalı", "cevap": "..."},
    {"itiraz": "Şu an ihtiyacımız yok", "cevap": "..."},
    {"itiraz": "Başka bir sistemimiz var", "cevap": "..."}
  ],
  "linkedin_mesaji": "150 kelime altı, doğal, satışçı olmayan LinkedIn mesaj taslağı",
  "followup_mail_d3": {
    "konu": "mail konusu",
    "icerik": "mail içeriği (3-4 paragraf, HTML değil düz metin)"
  },
  "followup_mail_d7": {
    "konu": "mail konusu",
    "icerik": "mail içeriği (daha kısa, daha acil ton)"
  },
  "bir_sonraki_adim": "ISR şu an ne yapmalı (tek net aksiyon)",
  "upsell_zamani": "Hangi koşulda üst pakete geçiş önerilmeli"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // JSON parse
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as CopilotContent;
}
```

### 1.3 buildScanSummary() — tarama verisini metne çevir

```typescript
function buildScanSummary(
  lead: EnterpriseProspect,
  scan: ProspectScan,
  techStack: CustomerTechStack[]
): string {
  const techs = techStack.map(t => `${t.technology} (${t.category})`).join(', ');

  const findings = [];
  if (!scan.hasDmarc)   findings.push('DMARC eksik — e-posta sahtecilik riski');
  if (!scan.hasDkim)    findings.push('DKIM eksik — mail güvenliği zayıf');
  if (!scan.hasSpf)     findings.push('SPF eksik — spam riski');
  if (scan.sslDaysLeft && scan.sslDaysLeft < 60)
    findings.push(`SSL sertifikası ${scan.sslDaysLeft} günde bitiyor`);
  if (scan.openPortCount > 8)
    findings.push(`${scan.openPortCount} açık port — geniş saldırı yüzeyi`);
  if (scan.httpHeaderScore !== null && scan.httpHeaderScore < 30)
    findings.push('HTTP güvenlik başlıkları eksik (0/100)');

  // Tech stack'ten sektör tespiti
  const isEcommerce = techStack.some(t =>
    ['ikas','shopify','woocommerce','magento','opencart'].includes(t.technology?.toLowerCase())
  );
  const hasCloudflare = techStack.some(t =>
    t.technology?.toLowerCase().includes('cloudflare')
  );

  return `
Domain: ${lead.domain}
Şirket: ${lead.companyName || 'Bilinmiyor'}
Sektör: ${lead.sector || 'Bilinmiyor'}
E-Ticaret: ${isEcommerce ? 'EVET' : 'Hayır'}
CDN/WAF: ${hasCloudflare ? 'Cloudflare kullanıyor' : 'Yok'}

Güvenlik Skoru: ${scan.overallScore}/100
Harf Notu: ${scan.letterGrade}
Kritik Bulgu: ${scan.criticalCount || 0}
Yüksek Risk: ${scan.highCount || 0}
Orta Risk: ${scan.mediumCount || 0}

Tespit Edilen Sorunlar:
${findings.map(f => `- ${f}`).join('\n')}

Teknoloji Yığını: ${techs || 'Tespit edilemedi'}

Kaynak: ${lead.source || 'certstream'}
Keşfedilme: ${lead.discoveredAt ? new Date(lead.discoveredAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
`;
}
```

### 1.4 CopilotContent tip tanımı

```typescript
interface CopilotContent {
  musteri_ozeti: string;
  satis_acisi: string;
  aciliyet_faktoru: string;
  onerilen_paket: {
    isim: string;
    fiyat: string;
    neden: string[];
  };
  gorusmede_sor: Array<{ soru: string; amac: string }>;
  itirazlar: Array<{ itiraz: string; cevap: string }>;
  linkedin_mesaji: string;
  followup_mail_d3: { konu: string; icerik: string };
  followup_mail_d7: { konu: string; icerik: string };
  bir_sonraki_adim: string;
  upsell_zamani: string;
}
```

---

## BÖLÜM 2 — VERİTABANI

### 2.1 Cache tablosu

```sql
CREATE TABLE IF NOT EXISTS isr_copilot_cache (
  id           serial PRIMARY KEY,
  prospect_id  integer UNIQUE REFERENCES enterprise_prospects(id) ON DELETE CASCADE,
  content      jsonb NOT NULL,
  model_used   varchar(50) DEFAULT 'claude-haiku-4-5-20251001',
  tokens_used  integer,
  created_at   timestamp DEFAULT now()
);
```

Drizzle schema'ya ekle, npm run db:push.

---

## BÖLÜM 3 — FRONTEND

### 3.1 ISR Lead Detay Sayfasına Copilot Bölümü Ekle

Mevcut lead detay sayfasını bul (/panel/isr/lead/:id veya benzeri).
Sayfanın altına yeni "ISR Copilot" bölümü ekle.

```tsx
// ISRCopilot.tsx komponenti

import { useState } from 'react';

interface ISRCopilotProps {
  leadId: number;
  leadStatus: string;
}

export function ISRCopilot({ leadId, leadStatus }: ISRCopilotProps) {
  const [copilot, setCopilot] = useState<CopilotContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'ozet' | 'gorusme' | 'mailler' | 'itirazlar'
  >('ozet');

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch(`/api/isr/leads/${leadId}/copilot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setCopilot(data.copilot);
      setCached(data.cached);
    } catch (err) {
      console.error('Copilot hatası:', err);
    } finally {
      setLoading(false);
    }
  }

  // Henüz başlatılmadıysa
  if (!copilot && !loading) {
    return (
      <div style={{
        background: '#0A1828', border: '1px solid #1A3050',
        borderRadius: 14, padding: 24, marginTop: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E8EDF5' }}>
              ISR Copilot
            </div>
            <div style={{ fontSize: 12, color: '#8896A8' }}>
              Bu lead için AI destekli satış rehberi — görüşme soruları,
              mail taslakları, itiraz cevapları
            </div>
          </div>
        </div>
        <button
          onClick={handleStart}
          style={{
            background: '#00C8FF', color: '#060D1A',
            border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          🚀 Copilot Başlat
        </button>
      </div>
    );
  }

  // Yükleniyor
  if (loading) {
    return (
      <div style={{
        background: '#0A1828', border: '1px solid #00C8FF',
        borderRadius: 14, padding: 32, marginTop: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
        <div style={{ color: '#00C8FF', fontWeight: 700, fontSize: 15 }}>
          Müşteri analiz ediliyor...
        </div>
        <div style={{ color: '#8896A8', fontSize: 13, marginTop: 6 }}>
          Satış rehberi hazırlanıyor
        </div>
      </div>
    );
  }

  if (!copilot) return null;

  // Copilot hazır — tab'lı görünüm
  return (
    <div style={{
      background: '#0A1828', border: '1px solid #00C8FF',
      borderRadius: 14, marginTop: 24, overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        background: '#091520', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1A3050',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#E8EDF5' }}>
            ISR Copilot
          </span>
          {cached && (
            <span style={{
              fontSize: 10, color: '#8896A8', background: '#1A3050',
              padding: '2px 8px', borderRadius: 10,
            }}>cache</span>
          )}
        </div>
        {/* Önerilen paket badge */}
        <div style={{
          background: 'rgba(0,200,255,0.1)', border: '1px solid #00C8FF',
          borderRadius: 20, padding: '4px 14px',
          fontSize: 12, fontWeight: 700, color: '#00C8FF',
        }}>
          📦 {copilot.onerilen_paket.isim} — {copilot.onerilen_paket.fiyat}
        </div>
      </div>

      {/* Aciliyet banner */}
      <div style={{
        background: 'rgba(245,166,35,0.08)', borderBottom: '1px solid rgba(245,166,35,0.2)',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>⚡</span>
        <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600 }}>
          {copilot.aciliyet_faktoru}
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #1A3050',
        background: '#060D1A',
      }}>
        {([
          { key: 'ozet',     label: '📋 Özet' },
          { key: 'gorusme',  label: '💬 Görüşme' },
          { key: 'mailler',  label: '✉️ Mailler' },
          { key: 'itirazlar', label: '🛡️ İtirazlar' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 20px', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? '#00C8FF' : '#8896A8',
              borderBottom: activeTab === tab.key
                ? '2px solid #00C8FF' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab içerikleri */}
      <div style={{ padding: 24 }}>

        {/* ÖZET TAB */}
        {activeTab === 'ozet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Müşteri özeti */}
            <div style={{
              background: '#060D1A', border: '1px solid #1A3050',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ fontSize: 11, color: '#8896A8', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 8 }}>
                Müşteri Özeti
              </div>
              <div style={{ fontSize: 14, color: '#E8EDF5', lineHeight: 1.6 }}>
                {copilot.musteri_ozeti}
              </div>
            </div>

            {/* Satış açısı */}
            <div style={{
              background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.2)',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ fontSize: 11, color: '#00C8FF', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 8 }}>
                🎯 Satış Açısı
              </div>
              <div style={{ fontSize: 14, color: '#E8EDF5', lineHeight: 1.6 }}>
                {copilot.satis_acisi}
              </div>
            </div>

            {/* Önerilen paket detay */}
            <div style={{
              background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.2)',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ fontSize: 11, color: '#2ECC71', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 10 }}>
                📦 Önerilen Paket
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2ECC71', marginBottom: 8 }}>
                {copilot.onerilen_paket.isim} — {copilot.onerilen_paket.fiyat}
              </div>
              {copilot.onerilen_paket.neden.map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#2ECC71', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#E8EDF5' }}>{n}</span>
                </div>
              ))}
            </div>

            {/* Bir sonraki adım */}
            <div style={{
              background: '#F5A623', borderRadius: 10, padding: 16,
            }}>
              <div style={{ fontSize: 11, color: '#060D1A', letterSpacing: 1,
                textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                ▶ ŞİMDİ NE YAPMALI
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#060D1A' }}>
                {copilot.bir_sonraki_adim}
              </div>
            </div>

          </div>
        )}

        {/* GÖRÜŞME TAB */}
        {activeTab === 'gorusme' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#8896A8', marginBottom: 4 }}>
              Görüşmede bu soruları sor — her biri bir ihtiyacı ortaya çıkarır
            </div>
            {copilot.gorusmede_sor.map((item, i) => (
              <div key={i} style={{
                background: '#060D1A', border: '1px solid #1A3050',
                borderRadius: 10, padding: 16,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#00C8FF', color: '#060D1A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E8EDF5',
                      marginBottom: 6 }}>
                      {item.soru}
                    </div>
                    <div style={{ fontSize: 12, color: '#8896A8' }}>
                      💡 {item.amac}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{
              background: 'rgba(155,89,182,0.08)', border: '1px solid rgba(155,89,182,0.2)',
              borderRadius: 10, padding: 14, marginTop: 8,
            }}>
              <div style={{ fontSize: 11, color: '#9B59B6', letterSpacing: 1, marginBottom: 6 }}>
                📈 UPSELL ZAMANI
              </div>
              <div style={{ fontSize: 13, color: '#E8EDF5' }}>
                {copilot.upsell_zamani}
              </div>
            </div>
          </div>
        )}

        {/* MAİLLER TAB */}
        {activeTab === 'mailler' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* LinkedIn mesajı */}
            <MailBlock
              title="💼 LinkedIn Mesajı"
              subtitle="Teaser açılmadıysa D+3'te gönder"
              color="#0077B5"
              subject={null}
              content={copilot.linkedin_mesaji}
            />

            {/* D+3 mail */}
            <MailBlock
              title="✉️ D+3 Takip Maili"
              subtitle="Teaser gönderildi, 3 gün geçti, açılmadı"
              color="#F5A623"
              subject={copilot.followup_mail_d3.konu}
              content={copilot.followup_mail_d3.icerik}
            />

            {/* D+7 mail */}
            <MailBlock
              title="✉️ D+7 Takip Maili"
              subtitle="Açıldı ama dönüş yok — daha acil ton"
              color="#E03A3A"
              subject={copilot.followup_mail_d7.konu}
              content={copilot.followup_mail_d7.icerik}
            />

          </div>
        )}

        {/* İTİRAZLAR TAB */}
        {activeTab === 'itirazlar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#8896A8', marginBottom: 4 }}>
              Görüşmede karşılaşacağın itirazlar ve hazır cevaplar
            </div>
            {copilot.itirazlar.map((item, i) => (
              <div key={i} style={{
                background: '#060D1A', border: '1px solid #1A3050',
                borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{
                  background: 'rgba(224,58,58,0.08)',
                  borderBottom: '1px solid #1A3050',
                  padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>❌</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#E03A3A' }}>
                    "{item.itiraz}"
                  </span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#2ECC71', fontSize: 14, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#E8EDF5', lineHeight: 1.6 }}>
                      {item.cevap}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Footer — yenile butonu */}
      <div style={{
        padding: '12px 24px', borderTop: '1px solid #1A3050',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <button
          onClick={handleStart}
          style={{
            background: 'transparent', border: '1px solid #1A3050',
            color: '#8896A8', borderRadius: 8,
            padding: '6px 16px', fontSize: 12, cursor: 'pointer',
          }}
        >
          🔄 Yeniden Üret
        </button>
      </div>
    </div>
  );
}

// Mail blok yardımcı komponenti
function MailBlock({
  title, subtitle, color, subject, content
}: {
  title: string; subtitle: string; color: string;
  subject: string | null; content: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = subject ? `Konu: ${subject}\n\n${content}` : content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: '#060D1A', border: `1px solid ${color}33`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        background: `${color}11`, borderBottom: `1px solid ${color}33`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{title}</div>
          <div style={{ fontSize: 11, color: '#8896A8', marginTop: 2 }}>{subtitle}</div>
        </div>
        <button
          onClick={copy}
          style={{
            background: color, color: '#060D1A', border: 'none',
            borderRadius: 6, padding: '5px 12px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
        </button>
      </div>
      {subject && (
        <div style={{
          padding: '8px 16px', borderBottom: '1px solid #1A3050',
          fontSize: 12, color: '#8896A8',
        }}>
          <strong style={{ color: '#E8EDF5' }}>Konu:</strong> {subject}
        </div>
      )}
      <div style={{
        padding: 16, fontSize: 13, color: '#E8EDF5',
        lineHeight: 1.7, whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  );
}
```

### 3.2 Lead detay sayfasına ekle

ISRCopilot komponentini mevcut lead detay sayfasının en altına ekle:

```tsx
// /panel/isr/lead/:id sayfasında, ISR AKSİYONLARI bölümünün altına:
import { ISRCopilot } from '@/components/ISRCopilot';

// JSX içinde:
<ISRCopilot leadId={lead.id} leadStatus={lead.status} />
```

---

## BÖLÜM 4 — TOKEN MALİYET LOGU (opsiyonel ama önerilir)

Claude API çağrısından token sayısını al ve DB'ye kaydet:

```typescript
// generateCopilot() içinde response aldıktan sonra:
const inputTokens  = response.usage.input_tokens;
const outputTokens = response.usage.output_tokens;

// Cache insert'te tokens_used kolonuna yaz:
await db.insert(isrCopilotCache).values({
  prospectId: leadId,
  content: copilotContent,
  modelUsed: 'claude-haiku-4-5-20251001',
  tokensUsed: inputTokens + outputTokens,
  createdAt: new Date(),
});

// Admin dashboard'da toplam maliyet görülebilsin:
// Haiku fiyatı: input $0.80/1M token, output $4/1M token
// Ortalama çağrı ~2500 token = ~$0.003
```

---

## TEST

1. `/api/isr/leads/:id/copilot` POST → JSON dönüyor mu?
2. JSON parse hatası var mı? (Claude bazen ```json bloğu ekliyor — clean fonksiyonu hallediyor)
3. İkinci çağrıda cache devreye giriyor mu? (`cached: true` dönmeli)
4. Frontend'de "Copilot Başlat" butonu görünüyor mu?
5. 4 tab düzgün geçiş yapıyor mu?
6. "Kopyala" butonu clipboard'a yazıyor mu?
7. Happy.com.tr ile test et — e-ticaret + KVKK açısı çıkmalı

---

## KISITLAR

- Model: claude-haiku-4-5-20251001 — daha ucuz model kullanma, Haiku bu iş için yeterli
- Cache süresi: 24 saat — aynı lead için günde 1 API çağrısı
- JSON parse hatası olursa console'a yaz, kullanıcıya "Tekrar dene" göster
- Mevcut ISR auth middleware'ini kullan
- ANTHROPIC_API_KEY zaten .env'de tanımlı olmalı — yoksa ekle
- buildScanSummary() içindeki tablo ve kolon adlarını mevcut şemaya göre ayarla
- onerilen_paket.neden array olarak geliyor — map ile render et
