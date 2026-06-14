# CyberStep ISR Süreci — Kopukluk Giderme
## Replit Agent Promptu

---

## BAĞLAM

Sistemde üç kopukluk var. Sırayla düzelt, her adımı tamamla sonrakine geç.

Stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
Mevcut: SMTP servisi çalışıyor (bülten + onboarding e-postalarında), SMTP_PASS secret tanımlı
Mevcut: isr_customers tablosu var, lead → müşteri kopyalama çalışıyor
Mevcut: /panel/isr IMAP inbox sayfası var

---

## KOPUKLUK 1 — Teaser E-posta SMTP Bağlantısı

### Sorun
/api/isr/leads/:id/send-teaser endpoint'i e-posta göndermek yerine sadece teaserSentAt alanını dolduruyor. Gerçek gönderim yok.

### Yapılacak

Mevcut mail servisini (bülten/onboarding'de kullanılan sendEmail fonksiyonu) bu endpoint'e bağla.

1. /api/isr/leads/:id/send-teaser endpoint'ini güncelle:

```typescript
router.post('/leads/:id/send-teaser', adminAuth, async (req, res) => {
  const lead = await db.query.enterpriseProspects.findFirst({
    where: eq(enterpriseProspects.id, parseInt(req.params.id))
  });
  if (!lead) return res.status(404).json({ error: 'Lead bulunamadi' });

  const scan = await db.query.prospectScans.findFirst({
    where: eq(prospectScans.prospectId, lead.id),
    orderBy: desc(prospectScans.scannedAt)
  });
  if (!scan) return res.status(400).json({ error: 'Once tarama yapilmali' });
  if (!scan.teaserToken) return res.status(400).json({ error: 'Teaser token eksik' });

  const teaserUrl = process.env.APP_URL + '/teaser/' + scan.teaserToken;

  await sendEmail({
    to: lead.contactEmail,
    subject: lead.companyName + ' — Alan Adiniza Iliskin Guvenlik Bulgusu',
    html: buildTeaserEmailHtml({ lead, scan, teaserUrl })
  });

  await db.update(enterpriseProspects)
    .set({ status: 'teaser_sent', lastActivityAt: new Date() })
    .where(eq(enterpriseProspects.id, lead.id));

  await db.update(prospectScans)
    .set({ teaserSentAt: new Date() })
    .where(eq(prospectScans.id, scan.id));

  res.json({ success: true, sentTo: lead.contactEmail });
});
```

2. buildTeaserEmailHtml() fonksiyonunu yaz:
Dosya: artifacts/api-server/src/lib/email-templates/isrEmails.ts

E-posta icerigi (Turkce, HTML):
- Buyuk guvenlik skoru + harf notu (renkli)
- Kritik/yuksek/orta bulgu sayilari
- AI saldiri ozeti (3 cumle, kirmizi uyari kutusu)
- "Raporumu Goruntule" CTA butonu → teaserUrl
- Footer: CyberStep imzasi, 7 gunluk gecerlilik notu
- Renkler: arka plan #060D1A, accent #00C8FF, buton #F5A623

3. Preview endpoint'ine dokunma:
GET /api/isr/leads/:id/teaser-preview → HTML dondurur, mail gondermez. Bu calisiyorsa koru.

---

## KOPUKLUK 2 — "Musteri Yap" Sonrasi Otomatik Deal

### Sorun
Lead → isr_customers kopyalaniyor ama deal otomatik acilmiyor, ISR temsilcisine bildirim gitmiyor.

### Veritabani

isr_deals tablosu yoksa olustur:

```sql
CREATE TABLE IF NOT EXISTS isr_deals (
  id                  serial PRIMARY KEY,
  customer_id         integer REFERENCES isr_customers(id) ON DELETE CASCADE,
  prospect_id         integer REFERENCES enterprise_prospects(id),
  title               varchar(255),
  status              varchar(30) DEFAULT 'new',
  estimated_value_tl  numeric(10,2),
  probability_pct     integer DEFAULT 20,
  assigned_to         varchar(100),
  notes               text,
  lost_reason         varchar(255),
  created_at          timestamp DEFAULT now(),
  last_activity_at    timestamp DEFAULT now(),
  expected_close_date date,
  closed_at           timestamp
);
```

Drizzle schema'ya ekle, npm run db:push.

### "Musteri Yap" Endpoint'ini Guncelle

Mevcut convert endpoint'inde lead → isr_customers kopyalamadan SONRA ekle:

```typescript
// 1. Otomatik deal olustur
const estimatedValue = scan?.overallScore < 40 ? 5990 : 2990;

const newDeal = await db.insert(isrDeals).values({
  customerId: newCustomer.id,
  prospectId: lead.id,
  title: lead.companyName + ' — CyberStep Degerlendirme',
  status: 'new',
  estimatedValueTl: estimatedValue,
  probabilityPct: 20,
  assignedTo: lead.assignedTo || 'isr-team',
  notes: 'Lead skoru: ' + (scan?.overallScore ?? 'N/A') + ' | Otomatik olusturuldu',
  expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}).returning();

// 2. ISR temsilcisine bildirim e-postasi
const isrEmail = getIsrEmail(lead.assignedTo);
await sendEmail({
  to: isrEmail,
  subject: 'Yeni Deal: ' + lead.companyName,
  html: buildDealNotificationHtml({
    companyName: lead.companyName,
    domain: lead.domain,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    score: scan?.overallScore,
    dealId: newDeal[0].id,
    dealUrl: process.env.APP_URL + '/panel/isr/deal/' + newDeal[0].id,
  })
});
```

getIsrEmail() yardimci fonksiyon — ayri dosyaya yaz:
artifacts/api-server/src/lib/isr/teamConfig.ts

```typescript
export function getIsrEmail(assignedTo: string): string {
  const map: Record<string, string> = {
    'isr-team': process.env.ISR_TEAM_EMAIL || 'isr@cyberstep.io',
    'serkan':   process.env.ISR_SERKAN_EMAIL || 'serkan@cyberstep.io',
  };
  return map[assignedTo] ?? map['isr-team'];
}
```

.env'e ekle:
ISR_TEAM_EMAIL=isr@cyberstep.io
ISR_SERKAN_EMAIL=serkan@cyberstep.io

---

## KOPUKLUK 3 — Otomatik Takip Cron'lari

Mevcut wrapCron altyapisina iki yeni cron ekle (mevcut cron dosyasina).

### Cron 1: D+3 Hatirlatma (Teaser goruntulenmediyse)

```typescript
// Her gun 10:00 — teaser_followup_d3
await wrapCron('teaser_followup_d3', '0 10 * * *', async () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysAgo  = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  const stale = await db.query.enterpriseProspects.findMany({
    where: and(
      eq(enterpriseProspects.status, 'teaser_sent'),
      lte(enterpriseProspects.lastActivityAt, threeDaysAgo),
      gte(enterpriseProspects.lastActivityAt, fourDaysAgo)
    )
  });

  for (const lead of stale) {
    const scan = await db.query.prospectScans.findFirst({
      where: and(
        eq(prospectScans.prospectId, lead.id),
        isNull(prospectScans.teaserViewedAt)
      ),
      orderBy: desc(prospectScans.scannedAt)
    });
    if (!scan) continue;

    if (lead.assignedTo) {
      await sendEmail({
        to: getIsrEmail(lead.assignedTo),
        subject: 'Takip Gerekli: ' + lead.companyName + ' (3 gundur acilmadi)',
        html: buildFollowupReminderHtml({
          leadName: lead.companyName,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          daysSinceSent: 3,
          score: scan.overallScore,
          leadUrl: process.env.APP_URL + '/panel/isr/lead/' + lead.id,
          action: 'Telefon aramasi veya LinkedIn mesaji oneririz'
        })
      });
    }

    await db.update(enterpriseProspects)
      .set({ lastActivityAt: new Date() })
      .where(eq(enterpriseProspects.id, lead.id));
  }

  console.log('D+3 followup: ' + stale.length + ' lead icin hatirlatma gonderildi');
});
```

### Cron 2: D+7 Follow-up (Goruntulendi ama donusum yok)

```typescript
// Her gun 10:30 — teaser_followup_d7
await wrapCron('teaser_followup_d7', '30 10 * * *', async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  const viewed = await db.query.enterpriseProspects.findMany({
    where: and(
      eq(enterpriseProspects.status, 'teaser_viewed'),
      lte(enterpriseProspects.lastActivityAt, sevenDaysAgo),
      gte(enterpriseProspects.lastActivityAt, eightDaysAgo)
    )
  });

  for (const lead of viewed) {
    const scan = await db.query.prospectScans.findFirst({
      where: eq(prospectScans.prospectId, lead.id),
      orderBy: desc(prospectScans.scannedAt)
    });

    // 1. Adaya otomatik D+7 e-postasi
    if (lead.contactEmail && scan?.teaserToken) {
      const teaserUrl = process.env.APP_URL + '/teaser/' + scan.teaserToken;
      await sendEmail({
        to: lead.contactEmail,
        subject: lead.companyName + ' — Guvenlik Raporunuz Hala Sizi Bekliyor',
        html: buildD7FollowupHtml({
          companyName: lead.companyName,
          contactName: lead.contactName,
          domain: lead.domain,
          score: scan.overallScore,
          grade: scan.letterGrade,
          teaserUrl,
          urgencyNote: scan.criticalCount > 0
            ? 'Raporunuzda ' + scan.criticalCount + ' kritik bulgu bulunuyor — bu aciklar zaman gectikce daha riskli hale geliyor.'
            : 'Guvenlik durumunuzu iyilestirmek icin adimlari goruntuleyin.'
        })
      });
    }

    // 2. ISR temsilcisine bildir
    if (lead.assignedTo) {
      await sendEmail({
        to: getIsrEmail(lead.assignedTo),
        subject: 'D+7 Follow-up Gonderildi: ' + lead.companyName,
        html: buildFollowupReminderHtml({
          leadName: lead.companyName,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          daysSinceSent: 7,
          score: scan?.overallScore,
          leadUrl: process.env.APP_URL + '/panel/isr/lead/' + lead.id,
          action: 'Rapor acildi, 7 gun gecti. Telefon aramasi zamani.'
        })
      });
    }

    await db.update(enterpriseProspects)
      .set({ lastActivityAt: new Date(), status: 'followup_sent' })
      .where(eq(enterpriseProspects.id, lead.id));
  }

  console.log('D+7 followup: ' + viewed.length + ' lead icin gonderildi');
});
```

---

## E-POSTA TEMPLATE FONKSIYONLARI

Dosya: artifacts/api-server/src/lib/email-templates/isrEmails.ts

Asagidaki 4 fonksiyonu yaz (HTML string dondurur):

buildTeaserEmailHtml({ lead, scan, teaserUrl })
- Mevcut teaser template varsa import et veya yeni yaz
- Renkler: bg #060D1A, accent #00C8FF, buton #F5A623

buildDealNotificationHtml({ companyName, domain, contactName, contactEmail, score, dealId, dealUrl })
- ISR temsilcisine yeni deal bildirimi
- Sade, metin agirlikli, "Deal'i Goruntule" butonu

buildFollowupReminderHtml({ leadName, contactName, contactEmail, daysSinceSent, score, leadUrl, action })
- ISR temsilcisine hatirlatma
- Kac gundur bekledigini, onerilen aksiyonu goster

buildD7FollowupHtml({ companyName, contactName, domain, score, grade, teaserUrl, urgencyNote })
- Adaya gonderilecek D+7 e-postasi
- Daha kisa ve acil ton
- Kritik bulgu varsa urgencyNote one cikar
- Tek CTA: teaserUrl

---

## STATUS AKISI — GUNCEL

```
lead olusturuldu     → status: 'new'
tarama yapildi       → status: 'scanned'
teaser gonderildi    → status: 'teaser_sent'     ← artik gercek SMTP
teaser goruntulendi  → status: 'teaser_viewed'   ← mevcut calisıyor
D+3 hatirlatma       → status degismez, ISR'ye bildirim
D+7 follow-up        → status: 'followup_sent'
demo talebi          → status: 'demo_requested'
musteri yapildi      → isr_customers'a tasinir
                     → isr_deals'e deal otomatik acilir   ← YENI
                     → ISR temsilcisine mail gider         ← YENI
deal won             → status: 'won', closedAt doldurulur
deal lost            → status: 'lost', lostReason girer
```

---

## TEST SIRASI

1. Teaser SMTP: gercek bir lead icin "Gonder" butonuna bas, inbox'ta gorundugunu dogrula
2. Preview: /api/isr/leads/:id/teaser-preview HTML dondurur, mail gondermez
3. Musteri Yap: lead → isr_customers + isr_deals yeni kayit + ISR'ye mail
4. D+3 cron manuel tetikle: teaserSentAt 3 gun once, goruntulenmemis lead → ISR'ye mail gelsin
5. D+7 cron manuel tetikle: teaserViewedAt 7 gun once lead → adaya + ISR'ye mail gelsin

---

## KISITLAR

- Mevcut teaser preview endpoint'ine dokunma
- Mevcut lead → isr_customers kopyalama mantigina dokunma, sadece sonrasina ekle
- SMTP icin mevcut sendEmail servisini kullan, yeni kutüphane ekleme
- Tüm cron job'lar wrapCron pattern ile mevcut cron dosyasina eklenir
- isr_deals tablosu yoksa olustur, varsa dokunma
