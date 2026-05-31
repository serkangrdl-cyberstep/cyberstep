# CyberStep.io — ISR Modülü Bölüm 2
## Replit Talimatları: Mevcut Modülü Reaktive Et + Tam Entegrasyon Akışı

---

## REPLIT'E VERİLECEK BAŞLANGIÇ TALİMATI

```
Mevcut CyberStep.io projesinde daha önce kısmen geliştirilmiş
ve pasife alınmış bir ISR (İç Satış Temsilcisi) modülü var.

Önce şunları yap:
1. ISR ile ilgili mevcut dosyaları bul ve listele
2. Hangi route'ların comment-out veya disabled edildiğini tespit et
3. Hangi UI bileşenlerinin gizlendiğini tespit et
4. Veritabanında hangi ISR tablolarının mevcut olduğunu kontrol et

Sonra:
- Mevcut kodu SİLME — genişlet ve güncelle
- Pasife alınan route'ları reaktive et
- Gizlenen menü öğelerini geri getir
- Aşağıdaki yeni özellikleri mevcut yapının üstüne ekle
```

---

## BÖLÜM 8: TAM VERİ AKIŞI

```
ADIM 1 — LEAD BULMA
Apollo.io API (otomatik, gece 02:00)
    ↓
lead_scan_queue  [status: pending]
    ↓
Domain Tarama Motoru (gece 03:00)
    ↓
lead_scan_queue  [status: scored, lead_score: 0-100]
    ↓
Kontak Zenginleştirme Apollo + Hunter (gece 04:00)
    ↓
lead_scan_queue  [contacts: [{name, email, title}]]
    ↓
Sabah Raporu Admin e-posta (08:30)

ADIM 2 — CRM'E AKTARMA
Admin "CRM'e Ekle" tıklar
    ↓
isr_customers  [yeni kayıt]
    ↓
isr_deals  [stage: new_lead]
    ↓
contact_enrichment_log  [kontak kaydı]
    ↓
enterprise_prospects  [bağlantı oluşur]
    ↓
Pipeline Kanban'da görünür

ADIM 3 — TEASER RAPOR
Satış temsilcisi "Tara + Teaser" tıklar
    ↓
teaser_reports  [Claude AI → teaser + full_scenarios]
    ↓
Admin önizler ve onaylar
    ↓
E-posta gönderilir → /preview/:token
    ↓
isr_deals  [stage: teaser_sent]

ADIM 4 — PROSPECT İLGİ GÖSTERİR
Müşteri /preview/:token açar
    ↓
teaser_reports  [preview_viewed_at set]
    ↓
isr_deals  [stage: teaser_viewed]
    ↓
CTA tıklanırsa:
    ↓
isr_deals  [stage: demo_requested]
    ↓
Satış ekibine ANI bildirim: "🔥 Sıcak Lead"

ADIM 5 — TEKLİF VE SÖZLEŞME
Demo yapılır
    ↓
isr_quotes  [mevcut teklif modülü]
    ↓
Teklif kabul edilirse:
    ↓
enterprise_contracts  [yeni sözleşme]
    ↓
Müşteri imzalar → isr_deals  [stage: won]
    ↓
enterprise_contract_services  [is_active: true]
    ↓
customers  [portal erişimi oluşur]
```

---

## BÖLÜM 9: ISR EMAIL INBOX REAKTİVASYONU

### 9.1 — Tablo (mevcut yoksa oluştur)

```sql
CREATE TABLE IF NOT EXISTS isr_email_inbox (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES isr_customers(id),
  message_id varchar(255) UNIQUE,
  from_email varchar(255),
  from_name varchar(255),
  subject text,
  body_text text,
  received_at timestamp,
  is_processed boolean DEFAULT false,
  deal_id integer REFERENCES isr_deals(id),
  ai_summary text,
  ai_sentiment varchar(20),
  ai_suggested_action text,
  ai_is_hot_lead boolean DEFAULT false,
  ai_draft_reply text,
  reply_sent_at timestamp,
  created_at timestamp DEFAULT now()
);
```

### 9.2 — AI E-posta Analizi

```typescript
async function analyzeEmailWithAI(email, customer) {
  const prompt = `
Sen CyberStep.io satış asistanısın.

GÖNDEREN: ${email.from}
${customer
  ? `MÜŞTERİ: ${customer.companyName}, Aşama: ${customer.pipelineStage}`
  : 'YENİ KONTAK — CRM\'de kayıt yok'}
KONU: ${email.subject}
İÇERİK: ${email.text?.substring(0, 800)}

JSON döndür:
{
  "summary": "1 cümle özet",
  "sentiment": "positive|neutral|negative|urgent",
  "is_hot_lead": true/false,
  "intent": "demo_request|pricing_question|complaint|general",
  "suggested_action": "Satış temsilcisinin yapması gereken aksiyon",
  "deal_stage_update": null veya "Yeni pipeline aşaması",
  "draft_reply": "Hazır Türkçe yanıt taslağı",
  "urgency": "high|medium|low"
}`;

  return JSON.parse(await callClaude(prompt));
}
```

### 9.3 — Gelen Kutusu UI

```
/admin-panel/isr/inbox

Sol panel: e-posta listesi
  Filtreler: Tümü | İşlenmemiş | Sıcak 🔥 | Yanıt Gerekli

  Her satır:
  🔥 [Gönderen] [Konu]              [Tarih]
     AI: "Demo talep ediyor — acil"  [CRM bağlantısı]

Sağ panel: e-posta detayı
  Gönderen + CRM bağlantısı
  E-posta içeriği

  AI Analizi:
  ┌────────────────────────────────┐
  │ Niyet: Demo Talebi             │
  │ Duygu: Olumlu 😊              │
  │ Öneri: "Bugün içinde ara"      │
  └────────────────────────────────┘

  AI Yanıt Taslağı:
  [düzenlenebilir textarea]
  [Gönder] [Düzenle] [Reddet]

  [CRM'e Ekle] [Deal Güncelle] [Aktivite Kaydet]
```

---

## BÖLÜM 10: ISR ↔ ENTERPRISE CONTRACTS KÖPRÜSÜ

```typescript
// isr_quotes tablosuna ekle:
ALTER TABLE isr_quotes ADD COLUMN IF NOT EXISTS
  contract_id integer REFERENCES enterprise_contracts(id);

ALTER TABLE isr_quotes ADD COLUMN IF NOT EXISTS
  converted_to_contract_at timestamp;

// POST /api/isr/quotes/:id/convert-to-contract
export async function convertQuoteToContract(quoteId: number) {
  const quote = await getQuoteWithLines(quoteId);

  const contract = await db.insert(enterpriseContracts).values({
    companyName: quote.customerName,
    contractNumber: await generateContractNumber(),
    startDate: new Date(),
    totalAmountTl: quote.totalAmount,
    status: 'draft',
    createdBy: quote.createdBy,
  }).returning();

  // Teklif kalemlerini servis olarak ekle
  for (const line of quote.lines) {
    await db.insert(enterpriseContractServices).values({
      contractId: contract[0].id,
      serviceSlug: matchToServiceCatalog(line.description),
      serviceName: line.description,
      unitPriceTl: line.unitPrice,
      quantity: line.quantity,
      lineTotalTl: line.total,
      isActive: false,
    });
  }

  return contract[0];
}

// Deal "won" olduğunda otomatik aksiyon:
export async function onDealWon(dealId: number) {
  const deal = await getDealWithCustomer(dealId);

  // Sözleşmeyi aktif yap
  await db.update(enterpriseContracts)
    .set({ status: 'signed', signedAt: new Date() })
    .where(eq(enterpriseContracts.id, deal.contractId));

  // Tüm servisleri aktive et
  await db.update(enterpriseContractServices)
    .set({ isActive: true, activatedAt: new Date() })
    .where(eq(enterpriseContractServices.contractId, deal.contractId));

  // Müşteri portal erişimi oluştur
  await createCustomerPortalAccess(deal.customerId);

  // Aktivasyon e-postası gönder
  await sendActivationEmail(deal.customerId);
}
```

---

## BÖLÜM 11: SABAH LEAD RAPORU E-POSTASI

```
Konu: 📊 Günlük Lead Raporu — [Tarih] — [N] yeni lead

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 ÖNCELİKLİ LEADLER (Skor 80+)
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Acme Finans — acme.com.tr
   Lead Skor: 87/100 | Risk: KRİTİK 🔴
   Kontak: Ahmet Yılmaz (CFO) — ahmet@acme.com.tr
   Neden: "Açık RDP + 3 kritik CVE, finans sektörü"
   → CRM'e Ekle: [link]

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DÜN ÖZETI
━━━━━━━━━━━━━━━━━━━━━━━━━━
Taranan domain:      47
Yüksek öncelikli:    12
Kontak bulunan:       8
Teaser görüntüleyen:  3
CTA tıklayan:         1 🔥

━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ BUGÜN TAKİP
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Gamma Lojistik — Demo 14:00
• Delta Sağlık — 7 gündür cevap yok
• Sigma E-ticaret — Sözleşme bekleniyor

→ Pipeline: [admin link]
```

---

## BÖLÜM 12: MÜŞTERİ PORTAL — ENTERPRISE TAB

```tsx
// Sözleşmesi olan müşteriler için özel portal görünümü

export function EnterpriseTab() {
  return (
    <div>
      {/* Sözleşme özet kartı */}
      <ContractCard
        contractNumber="CS-2026-0001"
        status="active"
        validUntil="31.12.2026"
      />

      {/* Aktif servisler */}
      <h2>Aktif Servisleriniz</h2>
      <ServicesGrid />
      {/*
        Her kart:
        ┌──────────────────────────────────┐
        │ 🛡️ Tam Güvenlik Değerlendirmesi  │
        │ ✅ Aktif | Geçerli: 31.12.2026   │
        │ [Servisi Kullan →]               │
        └──────────────────────────────────┘
      */}

      {/* Faturalar */}
      <InvoiceTable />

      {/* Yeni servis talebi */}
      <div className="add-service">
        <p>Yeni servis eklemek ister misiniz?</p>
        <button>+ Servis Talebi Oluştur</button>
        {/* Admin'e bildirim gider, ekip 24 saatte döner */}
      </div>
    </div>
  );
}
```

---

## BÖLÜM 13: REPLIT UYGULAMA SIRASI

```
ADIM 1 — Mevcut ISR kodunu tara ve raporla
  "Hangi dosyalar var, hangileri disabled?" listesi çıkar

ADIM 2 — Veritabanı
  ALTER TABLE'ları çalıştır
  Yeni tabloları oluştur

ADIM 3 — Backend servisler
  apolloService.ts
  hunterService.ts
  linkedinWorkflow.ts
  isrEmailProcessor.ts (reaktive veya yeni)
  leadScoringService.ts

ADIM 4 — Cron joblar (7 adet)
  02:00 Apollo şirket çek
  03:00 Domain tara + lead skor
  04:00 Kontak zenginleştir
  08:30 Sabah lead raporu
  09:00 Teaser takip (3 gün)
  09:30 CTA takip (7 gün)
  08:00 Sözleşme yenileme

ADIM 5 — API route'ları
  Mevcut ISR route'larını reaktive et
  Yeni endpoint'leri ekle
  Köprü route'larını ekle

ADIM 6 — Frontend
  Admin sol menüsünü güncelle
  Pipeline Kanban oluştur
  Lead Üretim sayfası
  Müşteri Detay güncellemesi
  Gelen Kutusu reaktivasyonu
  Portal Enterprise sekmesi

ADIM 7 — Secrets
  APOLLO_API_KEY
  HUNTER_API_KEY
  ISR_IMAP_HOST, PORT, USER, PASSWORD
  SALES_TEAM_EMAIL

ADIM 8 — Test
  Manuel domain tarama testi
  Pipeline stage değişiklik testi
  Quote → Contract dönüşüm testi
```

---

## BÖLÜM 14: MALİYET & KAPASİTE

```
API Maliyetleri (aylık):
  Apollo.io Basic:  $49  (10.000 şirket + 1.000 kontak)
  Hunter.io Starter: $49  (500 domain araması)
  Toplam:          ~$100/ay (~3.200 TL)

Kapasite (aylık):
  Apollo'dan çekilen şirket: 3.000
  Taranan domain:            1.500
  Lead skor 60+:              ~300
  Kontak bulunan:             ~200
  Teaser gönderilebilir:      100-150
  CTA tıklama (%5-10):        5-15 sıcak lead
  Win rate (%20-30):          1-5 yeni müşteri

ROI:
  1 Sanal CISO müşterisi = 8.000 TL/ay
  İlk ayda yatırım geri dönüşü: %150
  Yıllık 3 müşteri, ort. 45K TL deal:
  Gelir: 135.000 TL — API maliyet: 38.400 TL
  Net katkı: ~96.000 TL/yıl
```

---

## BÖLÜM 15: SABİTLER

```typescript
// Pipeline stage etiketleri
export const STAGE_LABELS = {
  new_lead:       'Yeni Lead',
  qualified:      'Niteliklendirildi',
  teaser_sent:    'Teaser Gönderildi',
  teaser_viewed:  'Teaser Görüntülendi',
  demo_requested: 'Demo Talep Etti',
  demo_scheduled: 'Demo Planlandı',
  demo_done:      'Demo Yapıldı',
  proposal_sent:  'Teklif Gönderildi',
  contract_sent:  'Sözleşme Gönderildi',
  negotiating:    'Müzakerede',
  won:            'Kazanıldı ✅',
  lost:           'Kaybedildi ❌',
  no_response:    'Yanıt Yok',
};

// Stage başarı olasılıkları
export const STAGE_PROBABILITY = {
  new_lead: 5, qualified: 15, teaser_sent: 20,
  teaser_viewed: 30, demo_requested: 50,
  demo_scheduled: 55, demo_done: 65,
  proposal_sent: 70, contract_sent: 85,
  negotiating: 75, won: 100, lost: 0,
};

// Servis slug → portal yönlendirme
export const SERVICE_ROUTES = {
  'tam-degerlendirme':   '/hesabim/degerlendirmeler',
  'ai-guvenlik':         '/ai-guvenlik-degerlendirmesi',
  'eu-ai-act':           '/eu-ai-act',
  'ai-red-team':         '/ai-red-team',
  'deepfake-analizi':    '/deepfake-analizi',
  'ai-arac-izleme':      '/hesabim/ai-izleme',
  'ai-politika':         '/hesabim/ai-politika',
  'sanal-ciso':          '/hesabim/sanal-ciso',
  'sizinti-izleyici':    '/sizinti-izleyici',
  'marka-koruma':        '/marka-koruma',
  'dora-bddk':           '/dora-bddk-uyum',
  'tprm':                '/tedarik-zinciri',
};
```

---

## TOPLAM ÖZET

```
VERİTABANI (13 tablo)
✅ isr_customers       — ALTER (genişletildi)
✅ isr_deals           — ALTER (pipeline stage)
✅ isr_activities      — YENİ
✅ isr_email_inbox     — REAKTİVE / YENİ
✅ sales_team          — YENİ
✅ lead_scan_queue     — YENİ
✅ contact_enrichment  — YENİ
✅ lead_campaigns      — YENİ
✅ enterprise_prospects — Bölüm 1'den
✅ teaser_reports      — Bölüm 1'den
✅ enterprise_contracts — Bölüm 1'den
✅ contract_services   — Bölüm 1'den
✅ enterprise_invoices — Bölüm 1'den

CRON JOBLAR (7 adet)
✅ 02:00 Apollo şirket çek
✅ 03:00 Domain tara + skor
✅ 04:00 Kontak zenginleştir
✅ 08:30 Sabah lead raporu
✅ 09:00 3 günlük teaser takip
✅ 09:30 7 günlük CTA takip
✅ 08:00 Sözleşme yenileme

FRONTEND (8 sayfa)
✅ Pipeline Kanban
✅ Müşteriler/Leads
✅ Lead Üretimi
✅ Gelen Kutusu
✅ Satış Raporları
✅ Sözleşmeler
✅ Faturalar
✅ Portal Enterprise Sekmesi
```

---

*CyberStep.io ISR Modülü Bölüm 2 — Mayıs 2026*
