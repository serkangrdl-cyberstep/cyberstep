# CyberStep — Teaser Sayfası CTA Güncellemesi
## Replit Agent Promptu

---

## BAĞLAM

Teaser sayfası (/teaser/:token veya /sonuc/:token) şu an bulgular
gösteriyor ama müşterinin harekete geçebileceği net bir yol yok.

Bu prompt iki CTA ekliyor:
1. "Hemen Abone Ol" → ödeme onay ekranı → Iyzico
2. "Uzmanla Görüşün" → ISR'ye bildirim → takvim/form

Her ikisi de teaser sayfasının en altında, rapor içeriğinin hemen sonunda.

---

## ADIM 1 — MEVCUT TEASER SAYFASINI BUL

/teaser/:token veya /sonuc/:token route'unu bul.
Sayfanın şu an nasıl bittiğine bak — son bölüm ne gösteriyor.
Mevcut yapıyı bozmadan altına CTA bölümü ekleyeceğiz.

---

## ADIM 2 — BACKEND: GÖRÜŞME TALEBİ ENDPOINT'İ

```typescript
// POST /api/public/teaser/:token/meeting-request
// Müşteri "Uzmanla Görüşün" butonuna basınca çağrılır
// Auth gerektirmez — public endpoint

router.post('/teaser/:token/meeting-request', async (req, res) => {
  const { name, email, phone, message } = req.body;

  // Token ile scan'i bul
  const scan = await db.query.prospectScans.findFirst({
    where: eq(prospectScans.teaserToken, req.params.token)
  });
  if (!scan) return res.status(404).json({ error: 'Geçersiz token' });

  const lead = await db.query.enterpriseProspects.findFirst({
    where: eq(enterpriseProspects.id, scan.prospectId)
  });
  if (!lead) return res.status(404).json({ error: 'Lead bulunamadı' });

  // Görüşme talebini kaydet
  await db.insert(meetingRequests).values({
    prospectId: lead.id,
    scanId: scan.id,
    name: name || '',
    email: email || '',
    phone: phone || '',
    message: message || '',
    status: 'pending',
    requestedAt: new Date(),
  });

  // Lead statusunu güncelle
  await db.update(enterpriseProspects)
    .set({
      status: 'meeting_requested',
      contactEmail: email || lead.contactEmail,
      contactName: name || lead.contactName,
      lastActivityAt: new Date(),
    })
    .where(eq(enterpriseProspects.id, lead.id));

  // ISR'ye Telegram bildirimi
  await sendTelegramAlert(
    alertWarning(
      `🤝 Görüşme Talebi: ${lead.domain}`,
      `İsim: ${name || 'Belirtilmedi'}\nE-posta: ${email}\nTelefon: ${phone || 'Belirtilmedi'}\nSkor: ${scan.overallScore}/100\nNot: ${message || '-'}`
    )
  );

  // ISR'ye e-posta bildirimi
  await sendEmail({
    to: process.env.ISR_TEAM_EMAIL || 'isr@cyberstep.io',
    subject: `Görüşme Talebi: ${lead.domain} (${scan.overallScore}/100)`,
    html: buildMeetingRequestEmail({ lead, scan, name, email, phone, message }),
  });

  // Müşteriye onay maili
  if (email) {
    await sendEmail({
      to: email,
      subject: 'Görüşme Talebiniz Alındı — CyberStep',
      html: buildMeetingConfirmationEmail({ name, domain: lead.domain }),
    });
  }

  res.json({ success: true });
});
```

### meeting_requests tablosu

```sql
CREATE TABLE IF NOT EXISTS meeting_requests (
  id           serial PRIMARY KEY,
  prospect_id  integer REFERENCES enterprise_prospects(id),
  scan_id      integer REFERENCES prospect_scans(id),
  name         varchar(200),
  email        varchar(200),
  phone        varchar(50),
  message      text,
  status       varchar(30) DEFAULT 'pending',
  -- pending | contacted | scheduled | completed | cancelled
  requested_at timestamp DEFAULT now(),
  contacted_at timestamp,
  scheduled_at timestamp
);
```

Drizzle schema'ya ekle, npm run db:push.

---

## ADIM 3 — BACKEND: ÖDEME ONAY ENDPOINT'İ

```typescript
// GET /api/public/teaser/:token/checkout-preview
// "Hemen Abone Ol" öncesi onay ekranı için veri

router.get('/teaser/:token/checkout-preview', async (req, res) => {
  const scan = await db.query.prospectScans.findFirst({
    where: eq(prospectScans.teaserToken, req.params.token)
  });
  if (!scan) return res.status(404).json({ error: 'Geçersiz token' });

  const lead = await db.query.enterpriseProspects.findFirst({
    where: eq(enterpriseProspects.id, scan.prospectId)
  });

  // Skora göre önerilen paket
  const recommendedPlan = scan.overallScore < 40
    ? { name: 'Zırh', price: 5990, description: 'Gelişmiş koruma' }
    : { name: 'Kalkan', price: 2990, description: 'Temel koruma ve izleme' };

  res.json({
    domain: lead?.domain,
    score: scan.overallScore,
    grade: scan.letterGrade,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
    plan: recommendedPlan,
  });
});
```

---

## ADIM 4 — FRONTEND: CTA BÖLÜMİ

Teaser sayfasının sonuna eklenecek React/JSX bölümü.
Mevcut teaser sayfasının render fonksiyonunu bul, en alta ekle.

```tsx
// TeaserCTA.tsx — yeni komponent

import { useState } from 'react';

interface TeaserCTAProps {
  token: string;
  domain: string;
  score: number;
  grade: string;
}

export function TeaserCTA({ token, domain, score, grade }: TeaserCTAProps) {
  const [view, setView] = useState<'main' | 'checkout' | 'meeting' | 'done'>('main');
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [meetingForm, setMeetingForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Ödeme onay ekranını aç
  async function openCheckout() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/teaser/${token}/checkout-preview`);
      const data = await res.json();
      setCheckoutData(data);
      setView('checkout');
    } catch {
      setError('Bir hata oluştu, tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  // Görüşme formu gönder
  async function submitMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingForm.email) { setError('E-posta zorunlu'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/public/teaser/${token}/meeting-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingForm),
      });
      if (!res.ok) throw new Error();
      setView('done');
    } catch {
      setError('Bir hata oluştu, tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  // Iyzico ödeme sayfasına yönlendir
  function goToPayment() {
    if (!checkoutData) return;
    // Mevcut Iyzico checkout flow'unu kullan
    // Plan bilgisini query param ile geçir
    const plan = checkoutData.plan.name.toLowerCase();
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/odeme?plan=${plan}&domain=${domain}&return=${returnUrl}`;
  }

  // ── ANA GÖRÜNÜM ──────────────────────────────────────────────────────────
  if (view === 'main') return (
    <div style={{
      margin: '32px 0 16px',
      background: 'linear-gradient(135deg,#0D2035,#091520)',
      border: '1.5px solid #1A3050',
      borderRadius: 18, overflow: 'hidden',
    }}>
      {/* Üst şerit */}
      <div style={{
        background: '#091520', padding: '18px 24px',
        borderBottom: '1px solid #1A3050', textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: '#8896A8', marginBottom: 4 }}>
          {domain} için güvenlik skoru
        </div>
        <div style={{
          fontSize: 38, fontWeight: 900,
          color: score >= 70 ? '#2ECC71' : score >= 50 ? '#F5A623' : '#E03A3A',
        }}>
          {score}/100 · {grade}
        </div>
        <div style={{ fontSize: 13, color: '#8896A8', marginTop: 4 }}>
          Tam raporu görmek ve güvenliğinizi artırmak için aşağıdaki seçeneklerden birini seçin
        </div>
      </div>

      {/* CTA butonları */}
      <div style={{ padding: '24px 24px 20px' }}>

        {/* PRIMARY — Hemen Abone Ol */}
        <button
          onClick={openCheckout}
          disabled={loading}
          style={{
            width: '100%', padding: '16px',
            background: '#00C8FF', color: '#060D1A',
            border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 900, cursor: 'pointer',
            marginBottom: 12,
            opacity: loading ? 0.7 : 1,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          🔒 Hemen Abone Ol — ₺2.990/ay
        </button>

        {/* SECONDARY — Uzmanla Görüş */}
        <button
          onClick={() => setView('meeting')}
          style={{
            width: '100%', padding: '14px',
            background: 'transparent',
            color: '#E8EDF5',
            border: '1.5px solid #1A3050',
            borderRadius: 12, fontSize: 15,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          💬 Uzmanla Görüşün
        </button>

        {/* Alt not */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 16,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {['İstediğiniz zaman iptal', 'Türkçe destek', 'KVKK uyumlu'].map(t => (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: '#8896A8',
            }}>
              <span style={{ color: '#2ECC71' }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── ÖDEME ONAY EKRANI ────────────────────────────────────────────────────
  if (view === 'checkout' && checkoutData) return (
    <div style={{
      margin: '32px 0 16px',
      background: '#0A1828', border: '1.5px solid #00C8FF',
      borderRadius: 18, overflow: 'hidden',
    }}>
      <div style={{
        background: '#091520', padding: '16px 24px',
        borderBottom: '1px solid #1A3050',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8EDF5' }}>
          📦 Sipariş Özeti
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Paket detayı */}
        <div style={{
          background: '#060D1A', border: '1px solid #1A3050',
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E8EDF5' }}>
                CyberStep {checkoutData.plan.name} Paketi
              </div>
              <div style={{ fontSize: 13, color: '#8896A8', marginTop: 4 }}>
                {checkoutData.domain} için · {checkoutData.plan.description}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#2ECC71' }}>
                ₺{checkoutData.plan.price.toLocaleString('tr-TR')}
              </div>
              <div style={{ fontSize: 12, color: '#8896A8' }}>/ay · KDV dahil</div>
            </div>
          </div>
        </div>

        {/* Ne alıyorsunuz */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#8896A8', marginBottom: 8, letterSpacing: 1 }}>
            PAKET İÇERİĞİ
          </div>
          {[
            'Sürekli dış saldırı yüzeyi izleme',
            'SSL sertifikası takibi ve uyarıları',
            'E-posta güvenlik yapılandırma rehberi',
            'Aylık yönetici güvenlik raporu',
            'Tehdit istihbaratı izleme',
            'Türkçe teknik destek',
          ].map(item => (
            <div key={item} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 6, fontSize: 13, color: '#E8EDF5',
            }}>
              <span style={{ color: '#2ECC71', flexShrink: 0 }}>✓</span>
              {item}
            </div>
          ))}
        </div>

        {/* Butonlar */}
        <button
          onClick={goToPayment}
          style={{
            width: '100%', padding: '14px',
            background: '#2ECC71', color: '#060D1A',
            border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 900, cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          ✓ Ödemeye Geç
        </button>
        <button
          onClick={() => setView('main')}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent', color: '#8896A8',
            border: '1px solid #1A3050', borderRadius: 10,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          ← Geri
        </button>

        <div style={{ fontSize: 11, color: '#4A6080', textAlign: 'center', marginTop: 12 }}>
          Güvenli ödeme · Iyzico altyapısı · İstediğiniz zaman iptal
        </div>
      </div>
    </div>
  );

  // ── GÖRÜŞME FORMU ────────────────────────────────────────────────────────
  if (view === 'meeting') return (
    <div style={{
      margin: '32px 0 16px',
      background: '#0A1828', border: '1.5px solid #1A3050',
      borderRadius: 18, overflow: 'hidden',
    }}>
      <div style={{
        background: '#091520', padding: '16px 24px',
        borderBottom: '1px solid #1A3050',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8EDF5' }}>
          💬 Uzmanla Görüşün
        </div>
        <div style={{ fontSize: 12, color: '#8896A8', marginTop: 4 }}>
          Güvenlik uzmanımız 24 saat içinde sizi arayacak
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {error && (
          <div style={{
            background: 'rgba(224,58,58,0.1)', border: '1px solid #E03A3A',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: '#E03A3A', marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {/* Form — shadcn/ui Input kullan veya native input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Adınız Soyadınız"
            value={meetingForm.name}
            onChange={e => setMeetingForm(p => ({ ...p, name: e.target.value }))}
            style={{
              background: '#060D1A', border: '1px solid #1A3050',
              borderRadius: 8, padding: '12px 14px',
              color: '#E8EDF5', fontSize: 14, outline: 'none',
            }}
          />
          <input
            type="email"
            placeholder="E-posta adresiniz *"
            value={meetingForm.email}
            onChange={e => setMeetingForm(p => ({ ...p, email: e.target.value }))}
            style={{
              background: '#060D1A', border: '1px solid #1A3050',
              borderRadius: 8, padding: '12px 14px',
              color: '#E8EDF5', fontSize: 14, outline: 'none',
            }}
          />
          <input
            type="tel"
            placeholder="Telefon numaranız"
            value={meetingForm.phone}
            onChange={e => setMeetingForm(p => ({ ...p, phone: e.target.value }))}
            style={{
              background: '#060D1A', border: '1px solid #1A3050',
              borderRadius: 8, padding: '12px 14px',
              color: '#E8EDF5', fontSize: 14, outline: 'none',
            }}
          />
          <textarea
            placeholder="Merak ettiğiniz bir şey var mı? (opsiyonel)"
            value={meetingForm.message}
            onChange={e => setMeetingForm(p => ({ ...p, message: e.target.value }))}
            rows={3}
            style={{
              background: '#060D1A', border: '1px solid #1A3050',
              borderRadius: 8, padding: '12px 14px',
              color: '#E8EDF5', fontSize: 14, outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={submitMeeting}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: '#00C8FF', color: '#060D1A',
            border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 900, cursor: 'pointer',
            marginTop: 16, opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Gönderiliyor...' : 'Görüşme Talep Et →'}
        </button>
        <button
          onClick={() => setView('main')}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent', color: '#8896A8',
            border: '1px solid #1A3050', borderRadius: 10,
            fontSize: 14, cursor: 'pointer', marginTop: 8,
          }}
        >
          ← Geri
        </button>
      </div>
    </div>
  );

  // ── TAMAMLANDI ────────────────────────────────────────────────────────────
  if (view === 'done') return (
    <div style={{
      margin: '32px 0 16px',
      background: 'rgba(46,204,113,0.06)',
      border: '1.5px solid #2ECC71',
      borderRadius: 18, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#2ECC71', marginBottom: 8 }}>
        Talebiniz Alındı!
      </div>
      <div style={{ fontSize: 14, color: '#8896A8', lineHeight: 1.6 }}>
        Güvenlik uzmanımız en geç <strong style={{ color: '#E8EDF5' }}>24 saat</strong> içinde
        {meetingForm.email && (
          <> <strong style={{ color: '#E8EDF5' }}>{meetingForm.email}</strong> adresine{' '}</>
        )}
        ulaşacak.
      </div>
      {meetingForm.phone && (
        <div style={{ fontSize: 13, color: '#8896A8', marginTop: 6 }}>
          Telefon: {meetingForm.phone}
        </div>
      )}
    </div>
  );

  return null;
}
```

---

## ADIM 5 — TEASER SAYFASINA EKLE

Mevcut teaser/sonuç sayfasında bulgular gösterildikten sonra:

```tsx
import { TeaserCTA } from '@/components/TeaserCTA';

// Teaser sayfasının sonuna ekle:
<TeaserCTA
  token={token}
  domain={scan.domain}
  score={scan.overallScore}
  grade={scan.letterGrade}
/>
```

---

## ADIM 6 — ISR PANELİNE GÖRÜŞME TALEPLERİ SEKMESİ

Admin/ISR paneline "Görüşme Talepleri" listesi ekle.

```typescript
// GET /api/isr/meeting-requests
router.get('/meeting-requests', isrAuth, async (req, res) => {
  const requests = await db.query.meetingRequests.findMany({
    where: eq(meetingRequests.status, 'pending'),
    orderBy: desc(meetingRequests.requestedAt),
    with: {
      prospect: {
        columns: { domain: true, overallScore: true, letterGrade: true, sector: true }
      }
    }
  });
  res.json(requests);
});

// PATCH /api/isr/meeting-requests/:id — durumu güncelle
router.patch('/meeting-requests/:id', isrAuth, async (req, res) => {
  const { status } = req.body;
  await db.update(meetingRequests)
    .set({ status, contactedAt: status === 'contacted' ? new Date() : undefined })
    .where(eq(meetingRequests.id, parseInt(req.params.id)));
  res.json({ success: true });
});
```

ISR panelinde basit liste:
- Domain, skor, isim, e-posta, telefon, talep tarihi
- Durum butonları: "Arandı", "Planlandı", "Tamamlandı"

---

## E-POSTA ŞABLONLARI

### ISR bildirimi (buildMeetingRequestEmail)

```typescript
function buildMeetingRequestEmail({ lead, scan, name, email, phone, message }: any): string {
  return `
<div style="font-family:Arial;background:#060D1A;padding:32px;max-width:560px;border-radius:12px">
  <h2 style="color:#00C8FF;margin:0 0 16px">🤝 Yeni Görüşme Talebi</h2>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin-bottom:16px">
    <div style="color:#8896A8;font-size:12px;margin-bottom:4px">DOMAIN</div>
    <div style="color:#E8EDF5;font-size:18px;font-weight:700">${lead.domain}</div>
    <div style="color:#F5A623;font-size:15px;margin-top:4px">Skor: ${scan.overallScore}/100 · ${scan.letterGrade}</div>
  </div>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin-bottom:16px">
    <div style="color:#8896A8;font-size:12px;margin-bottom:8px">İLETİŞİM</div>
    <div style="color:#E8EDF5">İsim: ${name || 'Belirtilmedi'}</div>
    <div style="color:#E8EDF5">E-posta: ${email}</div>
    <div style="color:#E8EDF5">Telefon: ${phone || 'Belirtilmedi'}</div>
    ${message ? `<div style="color:#8896A8;margin-top:8px">Not: ${message}</div>` : ''}
  </div>
  <a href="${process.env.APP_URL}/panel/isr/meeting-requests"
     style="display:block;background:#00C8FF;color:#060D1A;text-align:center;
            padding:12px;border-radius:8px;font-weight:900;text-decoration:none">
    Görüşme Taleplerini Gör →
  </a>
</div>`;
}
```

### Müşteri onay maili (buildMeetingConfirmationEmail)

```typescript
function buildMeetingConfirmationEmail({ name, domain }: any): string {
  return `
<div style="font-family:Arial;background:#060D1A;padding:32px;max-width:560px;border-radius:12px">
  <h2 style="color:#2ECC71;margin:0 0 16px">✅ Talebiniz Alındı</h2>
  <p style="color:#E8EDF5">Merhaba${name ? ' ' + name : ''},</p>
  <p style="color:#8896A8;line-height:1.6">
    <strong style="color:#E8EDF5">${domain}</strong> için güvenlik görüşme talebinizi aldık.
    Uzmanımız en geç <strong style="color:#2ECC71">24 saat</strong> içinde sizinle iletişime geçecek.
  </p>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin:20px 0">
    <div style="color:#8896A8;font-size:13px">Bu süreçte yapabilecekleriniz:</div>
    <div style="color:#E8EDF5;margin-top:8px">
      ✓ E-posta güvenliğiniz için DMARC kaydı ekleyin<br>
      ✓ SSL sertifikanızın yenileme tarihini kontrol edin<br>
      ✓ IT ekibinizi görüşmeye dahil edin
    </div>
  </div>
  <p style="color:#4A6080;font-size:12px">
    CyberStep · cyberstep.io · info@cyberstep.io
  </p>
</div>`;
}
```

---

## TEST

1. Teaser sayfasını aç → CTA bölümü görünüyor mu?
2. "Hemen Abone Ol" → sipariş özeti ekranı → paket ve fiyat doğru mu?
3. "Ödemeye Geç" → Iyzico ödeme sayfasına yönleniyor mu?
4. "Uzmanla Görüşün" → form açılıyor mu?
5. Form doldur, gönder → ISR'ye Telegram + e-posta geliyor mu?
6. Müşteriye onay maili gidiyor mu?
7. "Geri" butonları çalışıyor mu?
8. ISR panelinde /panel/isr/meeting-requests listesi görünüyor mu?

---

## KISITLAR

- Form için HTML form etiketi kullanma — onClick/onChange ile yönet (mevcut kural)
- Iyzico yönlendirme URL'ini mevcut ödeme akışına göre ayarla
- E-posta şablonları mevcut sendEmail servisini kullan
- Telegram alert mevcut sendTelegramAlert + alertWarning fonksiyonlarını kullan
- meeting_requests tablosu yoksa oluştur, varsa dokunma
- Tablo ve kolon adlarını mevcut şemaya göre ayarla
- /odeme route'u yoksa mevcut Iyzico checkout başlangıç endpoint'ini kullan
