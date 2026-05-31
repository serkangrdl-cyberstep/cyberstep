# CyberStep.io — CRM & Muhasebe Modülü Tam Yenileme
## Replit Agent Promptu — Öncelik Sırasına Göre

---

## BAĞLAM

Mevcut stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
+ React + shadcn/ui + Iyzico + nodemailer.

Mevcut tablolar korunacak, genişletilecek.
10 bölüm sırayla uygulanacak.
Her bölüm bağımsız çalışabilir — sırayla ver.

---

## BÖLÜM 1: FATURA PDF + SERİ NO SİSTEMİ

### Öncelik: KRİTİK — Kurumsal müşteriye fatura kesilemiyor

### 1a — Database

```sql
-- Fatura seri numarası sayacı
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id serial PRIMARY KEY,
  prefix varchar(20) NOT NULL,
  -- 'CS-INV' | 'CS-PRO' (proforma)
  year integer NOT NULL,
  last_number integer DEFAULT 0,
  UNIQUE(prefix, year)
);

-- Fatura tablosunu genişlet
ALTER TABLE enterprise_invoices
  ADD COLUMN IF NOT EXISTS invoice_type varchar(20) DEFAULT 'invoice',
  -- 'invoice' | 'proforma' | 'credit_note'
  ADD COLUMN IF NOT EXISTS series varchar(10),
  -- 'CS-INV'
  ADD COLUMN IF NOT EXISTS sequence_number integer,
  -- 2026001, 2026002 ...
  ADD COLUMN IF NOT EXISTS full_invoice_number varchar(30),
  -- 'CS-INV-2026-001'
  ADD COLUMN IF NOT EXISTS customer_tax_id varchar(20),
  ADD COLUMN IF NOT EXISTS customer_tax_office varchar(100),
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_name varchar(255),
  ADD COLUMN IF NOT EXISTS line_items jsonb,
  -- [{description, quantity, unit_price, vat_rate, line_total}]
  ADD COLUMN IF NOT EXISTS subtotal_tl decimal(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount_tl decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vat_amount_tl decimal(12,2),
  ADD COLUMN IF NOT EXISTS total_tl decimal(12,2),
  ADD COLUMN IF NOT EXISTS currency varchar(5) DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS e_arsiv_uuid varchar(100),
  -- İleride e-arşiv entegrasyonu için
  ADD COLUMN IF NOT EXISTS pdf_path varchar(500),
  ADD COLUMN IF NOT EXISTS sent_at timestamp,
  ADD COLUMN IF NOT EXISTS reminder_1_sent_at timestamp,
  ADD COLUMN IF NOT EXISTS reminder_2_sent_at timestamp,
  ADD COLUMN IF NOT EXISTS reminder_3_sent_at timestamp;

-- Customers tablosuna fatura bilgisi ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_name varchar(255),
  ADD COLUMN IF NOT EXISTS billing_tax_id varchar(20),
  ADD COLUMN IF NOT EXISTS billing_tax_office varchar(100),
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_email varchar(255),
  ADD COLUMN IF NOT EXISTS billing_phone varchar(50),
  ADD COLUMN IF NOT EXISTS payment_terms integer DEFAULT 30;
  -- Kaç günde ödeme: 7, 15, 30, 45, 60
```

### 1b — Fatura Numarası Üretici

```typescript
// src/services/invoiceService.ts

export async function generateInvoiceNumber(
  prefix: 'CS-INV' | 'CS-PRO' = 'CS-INV'
): Promise<{ series: string; sequenceNumber: number; fullNumber: string }> {
  const year = new Date().getFullYear();

  // Atomic increment — race condition yok
  const result = await db.transaction(async (tx) => {
    // Upsert sequence
    await tx.execute(sql`
      INSERT INTO invoice_sequences (prefix, year, last_number)
      VALUES (${prefix}, ${year}, 1)
      ON CONFLICT (prefix, year)
      DO UPDATE SET last_number = invoice_sequences.last_number + 1
    `);

    const seq = await tx
      .select()
      .from(invoiceSequences)
      .where(
        and(
          eq(invoiceSequences.prefix, prefix),
          eq(invoiceSequences.year, year)
        )
      );
    return seq[0].lastNumber;
  });

  const padded = String(result).padStart(4, '0');
  return {
    series: prefix,
    sequenceNumber: result,
    fullNumber: `${prefix}-${year}-${padded}`,
    // CS-INV-2026-0001
  };
}
```

### 1c — Fatura PDF (Puppeteer)

```typescript
export async function generateInvoicePDF(
  invoiceId: number
): Promise<Buffer> {
  const invoice = await getInvoiceWithDetails(invoiceId);

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1a1a2e; }
  .page { padding:40px; }

  /* HEADER */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:20px; border-bottom:2px solid #060D1A; }
  .logo { font-size:24px; font-weight:800; color:#060D1A; }
  .logo span { color:#00C8FF; }
  .invoice-meta { text-align:right; }
  .invoice-title { font-size:20px; font-weight:700; color:#060D1A; margin-bottom:6px; }
  .invoice-number { font-size:14px; color:#00C8FF; font-weight:700; }
  .invoice-date { font-size:11px; color:#7B8FAF; margin-top:4px; }

  /* PARTIES */
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:32px; }
  .party-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#7B8FAF; margin-bottom:8px; font-weight:600; }
  .party-name { font-size:14px; font-weight:700; margin-bottom:4px; }
  .party-detail { font-size:11px; color:#4A5568; line-height:1.6; }

  /* TABLE */
  .items-table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  .items-table th { background:#060D1A; color:white; padding:10px 12px; text-align:left; font-size:11px; font-weight:600; }
  .items-table th:last-child { text-align:right; }
  .items-table td { padding:10px 12px; border-bottom:1px solid #F0F4F8; font-size:12px; }
  .items-table td:last-child { text-align:right; font-weight:600; }
  .items-table tr:last-child td { border-bottom:none; }

  /* TOTALS */
  .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:32px; }
  .totals { width:280px; }
  .total-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #F0F4F8; font-size:12px; }
  .total-row.grand { font-weight:700; font-size:15px; color:#060D1A; border-bottom:none; padding-top:12px; margin-top:4px; border-top:2px solid #060D1A; }
  .total-row.grand .amount { color:#00C8FF; }

  /* PAYMENT */
  .payment-info { background:#F8FAFF; border-radius:8px; padding:16px 20px; margin-bottom:24px; border-left:4px solid #00C8FF; }
  .payment-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#7B8FAF; margin-bottom:8px; }
  .payment-detail { font-size:12px; line-height:1.8; }

  /* FOOTER */
  .footer { border-top:1px solid #E8EDF5; padding-top:16px; display:flex; justify-content:space-between; font-size:10px; color:#A0AEC0; }

  /* STATUS BADGE */
  .status-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .status-paid { background:#C6F6D5; color:#276749; }
  .status-pending { background:#FEFCBF; color:#744210; }
  .status-overdue { background:#FED7D7; color:#822727; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="logo">Cyber<span>Step</span>.io</div>
      <div style="font-size:11px; color:#7B8FAF; margin-top:4px;">
        cyberstep.io · security@cyberstep.io
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">
        ${invoice.invoiceType === 'proforma' ? 'PROFORMA FATURA' : 'FATURA'}
      </div>
      <div class="invoice-number">${invoice.fullInvoiceNumber}</div>
      <div class="invoice-date">
        Düzenleme: ${formatDate(invoice.createdAt)}<br>
        Vade: ${formatDate(invoice.dueDate)}
      </div>
      <div style="margin-top:8px;">
        <span class="status-badge status-${getStatusClass(invoice.status)}">
          ${getStatusLabel(invoice.status)}
        </span>
      </div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Fatura Eden</div>
      <div class="party-name">CyberStep.io</div>
      <div class="party-detail">
        Siber Güvenlik Platformu<br>
        security@cyberstep.io<br>
        cyberstep.io
      </div>
    </div>
    <div>
      <div class="party-label">Fatura Edilen</div>
      <div class="party-name">${invoice.customerName}</div>
      <div class="party-detail">
        ${invoice.customerTaxId ? `Vergi No: ${invoice.customerTaxId}<br>` : ''}
        ${invoice.customerTaxOffice ? `Vergi Dairesi: ${invoice.customerTaxOffice}<br>` : ''}
        ${invoice.customerAddress ? invoice.customerAddress.replace(/\n/g, '<br>') : ''}
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:50%">Hizmet / Ürün</th>
        <th style="width:12%">Miktar</th>
        <th style="width:18%">Birim Fiyat</th>
        <th style="width:8%">KDV</th>
        <th style="width:12%">Tutar</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.lineItems.map(item => `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>₺${formatMoney(item.unitPrice)}</td>
        <td>%${item.vatRate}</td>
        <td>₺${formatMoney(item.lineTotal)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="total-row">
        <span>Ara Toplam</span>
        <span>₺${formatMoney(invoice.subtotalTl)}</span>
      </div>
      ${invoice.discountAmountTl > 0 ? `
      <div class="total-row" style="color:#E53E3E">
        <span>İndirim</span>
        <span>-₺${formatMoney(invoice.discountAmountTl)}</span>
      </div>` : ''}
      <div class="total-row">
        <span>KDV (%${invoice.vatRate})</span>
        <span>₺${formatMoney(invoice.vatAmountTl)}</span>
      </div>
      <div class="total-row grand">
        <span>GENEL TOPLAM</span>
        <span class="amount">₺${formatMoney(invoice.totalTl)}</span>
      </div>
    </div>
  </div>

  <div class="payment-info">
    <div class="payment-title">Ödeme Bilgileri</div>
    <div class="payment-detail">
      Ödeme Yöntemi: Banka Havalesi<br>
      Vade: ${formatDate(invoice.dueDate)}<br>
      Açıklama: ${invoice.fullInvoiceNumber}<br>
      ${process.env.BANK_IBAN ? `IBAN: ${process.env.BANK_IBAN}` : ''}
    </div>
  </div>

  ${invoice.notes ? `
  <div style="font-size:11px; color:#4A5568; margin-bottom:24px;">
    <strong>Not:</strong> ${invoice.notes}
  </div>` : ''}

  <div class="footer">
    <span>CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu</span>
    <span>${invoice.fullInvoiceNumber} · ${formatDate(invoice.createdAt)}</span>
  </div>

</div>
</body>
</html>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  // PDF'i kaydet
  const pdfPath = `invoices/${invoice.fullInvoiceNumber}.pdf`;
  await saveFile(pdfPath, pdf);

  await db.update(enterpriseInvoices)
    .set({ pdfPath })
    .where(eq(enterpriseInvoices.id, invoiceId));

  return pdf;
}
```

### 1d — API Rotaları

```
POST /api/invoices                    — Fatura oluştur (otomatik numara)
GET  /api/invoices                    — Liste (filtre: status, customer, date)
GET  /api/invoices/:id                — Detay
PUT  /api/invoices/:id                — Güncelle
GET  /api/invoices/:id/pdf            — PDF indir / üret
POST /api/invoices/:id/send           — E-posta ile gönder
POST /api/invoices/:id/mark-paid      — Ödendi işaretle
POST /api/invoices/:id/cancel         — İptal et (credit note oluştur)
GET  /api/invoices/overdue            — Vadesi geçmiş liste
GET  /api/customers/:id/invoices      — Müşteriye ait faturalar
```

### 1e — Admin Panel Fatura Listesi

```
/admin-panel/invoices

Üst kısım — özet kartlar:
┌──────────────┬───────────────┬──────────────┬──────────────┐
│ Bu Ay        │ Vadesi Geçmiş │ Bu Ay        │ Toplam       │
│ Kesilen      │ Alacak        │ Tahsilat     │ Alacak       │
│ ₺245.000     │ ₺38.500 🔴    │ ₺198.000     │ ₺83.500      │
└──────────────┴───────────────┴──────────────┴──────────────┘

Filtreler: Durum | Müşteri | Tarih aralığı | Tutar aralığı

Tablo:
Fatura No | Müşteri | Tutar | Durum | Düzenleme | Vade | Aksiyonlar
[PDF] [Gönder] [Ödendi] [Hatırlatma Gönder]
```

---

## BÖLÜM 2: TAHSİLAT TAKİBİ + OTOMATİK HATIRLATMA

### 2a — Tahsilat Otomasyonu Cron

```typescript
// Her gün 09:00 — vadesi geçmiş faturaları kontrol et
cron.schedule('0 9 * * *', async () => {

  const today = new Date();

  // Vadesi 1 gün geçmiş — ilk hatırlatma
  const overdue1 = await db.select().from(enterpriseInvoices)
    .where(
      and(
        eq(enterpriseInvoices.status, 'pending'),
        lte(enterpriseInvoices.dueDate,
            new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
        isNull(enterpriseInvoices.reminder1SentAt)
      )
    );

  for (const inv of overdue1) {
    await sendPaymentReminder(inv, 1);
    await db.update(enterpriseInvoices)
      .set({ reminder1SentAt: new Date() })
      .where(eq(enterpriseInvoices.id, inv.id));
  }

  // Vadesi 5 gün geçmiş — ikinci hatırlatma
  const overdue5 = await db.select().from(enterpriseInvoices)
    .where(
      and(
        eq(enterpriseInvoices.status, 'pending'),
        lte(enterpriseInvoices.dueDate,
            new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)),
        isNotNull(enterpriseInvoices.reminder1SentAt),
        isNull(enterpriseInvoices.reminder2SentAt)
      )
    );

  for (const inv of overdue5) {
    await sendPaymentReminder(inv, 2);
    await db.update(enterpriseInvoices)
      .set({ reminder2SentAt: new Date(), status: 'overdue' })
      .where(eq(enterpriseInvoices.id, inv.id));
  }

  // Vadesi 15 gün geçmiş — son uyarı + admin alarmı
  const overdue15 = await db.select().from(enterpriseInvoices)
    .where(
      and(
        eq(enterpriseInvoices.status, 'overdue'),
        lte(enterpriseInvoices.dueDate,
            new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)),
        isNotNull(enterpriseInvoices.reminder2SentAt),
        isNull(enterpriseInvoices.reminder3SentAt)
      )
    );

  for (const inv of overdue15) {
    await sendPaymentReminder(inv, 3); // Son uyarı — servis durdurma tehdidi
    await sendAdminOverdueAlert(inv);  // Admin'e manuel takip bildirimi
    await db.update(enterpriseInvoices)
      .set({ reminder3SentAt: new Date() })
      .where(eq(enterpriseInvoices.id, inv.id));
  }
});

async function sendPaymentReminder(
  invoice: EnterpriseInvoice,
  reminderNumber: 1 | 2 | 3
): Promise<void> {

  const templates = {
    1: {
      subject: `Hatırlatma: ${invoice.fullInvoiceNumber} — Ödeme bekleniyor`,
      tone: 'Nazik hatırlatma. Belki gözden kaçtı.'
    },
    2: {
      subject: `Acil: ${invoice.fullInvoiceNumber} — Vadesi geçti`,
      tone: 'Aciliyet vurgula. Hesap dondurma olabilir.'
    },
    3: {
      subject: `Son Uyarı: ${invoice.fullInvoiceNumber} — Servis askıya alınacak`,
      tone: 'Kesin dil. Servis 48 saat içinde durdurulacak.'
    }
  };

  const tmpl = templates[reminderNumber];

  // Claude ile kişiselleştirilmiş e-posta
  const body = await generateReminderEmail(invoice, tmpl.tone);

  await sendEmail({
    to: invoice.billingEmail || invoice.customerEmail,
    subject: tmpl.subject,
    html: buildReminderEmailHTML(body, invoice),
    attachments: [{ filename: `${invoice.fullInvoiceNumber}.pdf`,
                    path: invoice.pdfPath }]
  });
}
```

### 2b — Tek Tıkla Ödeme Linki

```typescript
// Her fatura için benzersiz ödeme linki üret
// /odeme/:invoice_token → Iyzico ödeme sayfası

export async function generatePaymentLink(invoiceId: number): Promise<string> {
  const token = generateSecureToken(); // 32 char random
  await db.update(enterpriseInvoices)
    .set({ paymentToken: token })
    .where(eq(enterpriseInvoices.id, invoiceId));

  return `${process.env.BASE_URL}/odeme/${token}`;
}

// Hatırlatma e-postalarına bu link eklenir
// Müşteri linke tıklar → Iyzico ile online ödeme
// Ödeme başarılı → fatura otomatik "ödendi" işaretlenir
```

---

## BÖLÜM 3: MRR / ARR DASHBOARD

### 3a — Database Views

```sql
-- Aylık gelir özeti view'i
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', paid_at) AS month,
  COUNT(*) AS invoice_count,
  SUM(total_tl) AS total_revenue,
  SUM(CASE WHEN billing_cycle = 'monthly' THEN total_tl ELSE 0 END) AS mrr_contribution,
  SUM(CASE WHEN billing_cycle = 'annual' THEN total_tl / 12.0 ELSE 0 END) AS arr_contribution,
  COUNT(DISTINCT customer_id) AS paying_customers
FROM enterprise_invoices
WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', paid_at)
ORDER BY month DESC;

-- Aktif abonelik MRR hesabı
CREATE OR REPLACE VIEW current_mrr AS
SELECT
  SUM(
    CASE
      WHEN ecs.billing_type = 'monthly'
        THEN ecs.line_total_tl
      WHEN ecs.billing_type = 'annual'
        THEN ecs.line_total_tl / 12.0
      ELSE 0
    END
  ) AS mrr,
  COUNT(DISTINCT ec.customer_id) AS active_customers
FROM enterprise_contract_services ecs
JOIN enterprise_contracts ec ON ecs.contract_id = ec.id
WHERE ecs.is_active = true
  AND ec.status = 'active'
  AND (ec.end_date IS NULL OR ec.end_date > NOW());
```

### 3b — Revenue Dashboard Sayfası

```
/admin-panel/revenue

Üst kısım — anlık metrikler:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Anlık MRR    │ ARR          │ Müşteri      │ Ort. Deal    │
│ ₺142.500     │ ₺1.710.000   │ 67 aktif     │ ₺2.127       │
│ +₺12K ay/ay  │              │ +5 bu ay     │              │
└──────────────┴──────────────┴──────────────┴──────────────┘

Grafikler:
1. MRR trendi — son 12 ay çizgi grafik
2. Gelir kaynağı dağılımı — pie chart
   (Tam Değerlendirme / AI Servisleri / Abonelikler / Sanal CISO)
3. Churn & Expansion — waterfall chart
   (Yeni + Upsell - Churn - Downsell = Net MRR)
4. Müşteri başına gelir dağılımı — histogram

KPI Tablosu:
Metrik                    Bu Ay      Geçen Ay   Değişim
─────────────────────────────────────────────────────────
Yeni MRR                  ₺28.500    ₺24.200    +17.8%
Churn MRR                 ₺8.200     ₺11.400    -28.1%
Expansion MRR             ₺12.300    ₺9.800     +25.5%
Net MRR Değişimi          ₺32.600    ₺22.600    +44.2%
Churn Rate                %4.2       %5.8       İyi
Net Revenue Retention     %118       %108       İyi
```

---

## BÖLÜM 4: MÜŞTERİ 360° GÖRÜNÜMÜ

### 4a — Unified Customer View

```
/admin-panel/customers/:id

Üst bar:
[Avatar] Şirket Adı  |  Domain  |  Plan: Kurumsal  |  Durum: Aktif 🟢
Müşteri since: Mart 2026  |  LTV: ₺42.800  |  Sağlık: 78/100

Sekmeler:
[ Genel | Güvenlik | Servisler | İletişim | Faturalar | Görevler | Notlar ]

─── GENEL SEKMESİ ──────────────────────────────────────────
Sol sütun:
  Şirket bilgisi (düzenlenebilir)
  Fatura bilgisi
  Atanan temsilci
  Etiketler (tag input)

Sağ sütun:
  Aktivite özeti kartları:
  ┌─────────────────────────────────┐
  │ Son giriş: 2 gün önce          │
  │ Bu ay değerlendirme: 2         │
  │ Açık görev: 3                  │
  │ Ödenmemiş fatura: ₺8.900       │
  └─────────────────────────────────┘

Son 5 aktivite zaman çizelgesi (tüm sekmelerin özeti)

─── GÜVENLİK SEKMESİ ────────────────────────────────────────
Domain güvenlik skoru trendi (6 aylık grafik)
Son tarama bulgular listesi
AI saldırı senaryoları (varsa)
[Yeniden Tara Butonu]

─── SERVİSLER SEKMESİ ───────────────────────────────────────
Aktif servisler + bitiş tarihleri
Kullanım istatistikleri
[Servis Ekle] → yeni sözleşme akışını başlatır

─── İLETİŞİM SEKMESİ ────────────────────────────────────────
Tüm e-posta gönderim geçmişi
(trigger e-postaları, faturalar, bültenler — hepsi)
Telefon notları
[+ Yeni İletişim Kaydı]

─── FATURALAR SEKMESİ ───────────────────────────────────────
Müşteriye ait tüm faturalar
Toplam ödenen / bekleyen tutar
[Fatura Oluştur]

─── GÖREVLER SEKMESİ ────────────────────────────────────────
Açık ve tamamlanan görevler
[+ Görev Ekle]

─── NOTLAR SEKMESİ ──────────────────────────────────────────
İç notlar (müşteriye görünmez)
Zaman damgalı, kim yazdı bilgisi ile
```

### 4b — Customer Timeline Component

```typescript
// Tüm müşteri aksiyonlarını tek zaman çizelgesinde birleştirir
interface TimelineEvent {
  type: 'login' | 'scan' | 'report_view' | 'payment' | 'invoice' |
        'email_sent' | 'email_opened' | 'support' | 'stage_change' |
        'note' | 'task_completed' | 'score_change';
  timestamp: Date;
  title: string;
  description?: string;
  actor?: string; // Kim yaptı (müşteri mi, admin mi)
  metadata?: Record<string, unknown>;
}

// Tüm tablolardan birleştir:
// customer_activity_events + isr_activities +
// enterprise_invoices + growth_triggers +
// teaser_reports + domain_scans
```

---

## BÖLÜM 5: ETİKET + SEGMENT SİSTEMİ

### 5a — Database

```sql
CREATE TABLE IF NOT EXISTS customer_tags (
  id serial PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL,
  color varchar(20) DEFAULT '#7B8FAF',
  -- hex renk kodu
  description varchar(255),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  customer_id integer REFERENCES customers(id),
  tag_id integer REFERENCES customer_tags(id),
  assigned_at timestamp DEFAULT now(),
  assigned_by varchar(100),
  PRIMARY KEY (customer_id, tag_id)
);

-- Hazır etiketleri seed et
INSERT INTO customer_tags (name, color, description) VALUES
  ('vip',              '#F6E05E', 'Stratejik müşteri'),
  ('yenileme-yakın',   '#FC8181', '30 gün içinde yenilenecek'),
  ('upsell-adayı',     '#68D391', 'Upsell potansiyeli yüksek'),
  ('churn-riski',      '#FC8181', 'Churn riski tespit edildi'),
  ('referral-aktif',   '#76E4F7', 'Aktif referral veriyor'),
  ('kvkk-öncelikli',   '#B794F4', 'KVKK danışmanlık ihtiyacı'),
  ('enterprise',       '#F6AD55', 'Kurumsal sözleşme'),
  ('partner',          '#4FD1C5', 'Partner hesabı'),
  ('ödeme-sorunu',     '#FC8181', 'Gecikmiş ödeme geçmişi'),
  ('yüksek-risk',      '#FC8181', 'Güvenlik skoru kritik');
```

### 5b — Segment Tanımları

```typescript
// Dinamik segment hesaplayıcı
// Her gece çalışır, etiketleri otomatik günceller

export async function updateAutomaticTags(): Promise<void> {

  const allCustomers = await getActiveCustomers();

  for (const customer of allCustomers) {

    const score = await getLatestHealthScore(customer.id);
    const contract = await getActiveContract(customer.id);
    const lastInvoice = await getLastInvoice(customer.id);

    // Yenileme yakın — 30 gün içinde bitiyor
    if (contract?.endDate) {
      const daysLeft = getDaysUntil(contract.endDate);
      if (daysLeft <= 30 && daysLeft > 0) {
        await addTagIfNotExists(customer.id, 'yenileme-yakın');
      } else {
        await removeTag(customer.id, 'yenileme-yakın');
      }
    }

    // Churn riski — sağlık skoru 40 altı
    if (score && score.healthScore < 40) {
      await addTagIfNotExists(customer.id, 'churn-riski');
    } else {
      await removeTag(customer.id, 'churn-riski');
    }

    // Upsell adayı — skor 70+ ama Başlangıç planında
    if (score && score.healthScore > 70 && customer.plan === 'baslangic') {
      await addTagIfNotExists(customer.id, 'upsell-adayı');
    }

    // Ödeme sorunu — son fatura gecikmiş
    if (lastInvoice?.status === 'overdue') {
      await addTagIfNotExists(customer.id, 'ödeme-sorunu');
    } else {
      await removeTag(customer.id, 'ödeme-sorunu');
    }

    // Yüksek risk — güvenlik skoru 30 altı
    const secScore = await getLatestSecurityScore(customer.id);
    if (secScore && secScore < 30) {
      await addTagIfNotExists(customer.id, 'yüksek-risk');
    }
  }
}
```

### 5c — Segmente Göre Toplu İşlem

```
Admin panel → Müşteriler → Filtrele: Etiket = "upsell-adayı"

Toplu aksiyon dropdown:
  ✉️ Seçilenlere e-posta gönder
  📋 Seçilenlere görev ata
  🏷️ Seçilenlere etiket ekle/çıkar
  👤 Seçilenleri temsilciye ata
  📊 Seçilenleri Excel'e aktar
```

---

## BÖLÜM 6: GÖREV + HATIRLATICI MOTORU

### 6a — Database

```sql
CREATE TABLE IF NOT EXISTS crm_tasks (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  deal_id integer REFERENCES isr_deals(id),

  title varchar(255) NOT NULL,
  description text,
  task_type varchar(30) DEFAULT 'general',
  -- 'call' | 'email' | 'demo' | 'follow_up' |
  -- 'renewal' | 'onboarding' | 'general'

  priority varchar(10) DEFAULT 'medium',
  -- 'high' | 'medium' | 'low'

  due_date date,
  due_time time,

  assigned_to varchar(100),
  -- Satış temsilcisi email veya adı

  status varchar(20) DEFAULT 'open',
  -- 'open' | 'completed' | 'cancelled' | 'snoozed'

  completed_at timestamp,
  completed_by varchar(100),
  completion_note text,

  -- Hatırlatıcılar
  reminder_sent_at timestamp,
  reminder_2_sent_at timestamp,

  -- Oluşturan
  created_by varchar(100),
  created_at timestamp DEFAULT now(),

  -- Tekrar eden görev
  is_recurring boolean DEFAULT false,
  recurrence_pattern varchar(20),
  -- 'daily' | 'weekly' | 'monthly'
  next_occurrence_date date
);
```

### 6b — Görev Hatırlatıcı Cron

```typescript
// Her sabah 08:00 — bugünkü ve gecikmiş görevler
cron.schedule('0 8 * * *', async () => {

  // Bugün vadesi gelen görevler
  const todayTasks = await db.select()
    .from(crmTasks)
    .where(
      and(
        eq(crmTasks.status, 'open'),
        eq(crmTasks.dueDate, today()),
        isNull(crmTasks.reminderSentAt)
      )
    );

  for (const task of todayTasks) {
    await sendTaskReminder(task, 'today');
    await db.update(crmTasks)
      .set({ reminderSentAt: new Date() })
      .where(eq(crmTasks.id, task.id));
  }

  // Gecikmiş görevler (2 günden fazla)
  const overdueTasks = await db.select()
    .from(crmTasks)
    .where(
      and(
        eq(crmTasks.status, 'open'),
        lt(crmTasks.dueDate,
           new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        isNull(crmTasks.reminder2SentAt)
      )
    );

  for (const task of overdueTasks) {
    await sendTaskReminder(task, 'overdue');
    await db.update(crmTasks)
      .set({ reminder2SentAt: new Date() })
      .where(eq(crmTasks.id, task.id));
  }
});
```

### 6c — Görev Widget (Admin Dashboard)

```
Admin dashboard sağ panel — Bugünün Görevleri:

┌──────────────────────────────────────────────────────┐
│ 📋 Bugünkü Görevler (5)           [+ Yeni Görev]    │
├──────────────────────────────────────────────────────┤
│ 🔴 Acme Finans — Demo hazırlığı         10:00       │
│    Satış: Ahmet K.                   [✓] [→]        │
├──────────────────────────────────────────────────────┤
│ 🟡 Beta Tech — Teklif takibi            Bugün       │
│    Satış: Mehmet S.                  [✓] [→]        │
├──────────────────────────────────────────────────────┤
│ 🟢 Gamma Ltd — Yenileme görüşmesi       14:30       │
│    Satış: Ayşe T.                    [✓] [→]        │
├──────────────────────────────────────────────────────┤
│ ⚠️ Gecikmiş: 3 görev var              [Hepsini Gör] │
└──────────────────────────────────────────────────────┘
```

---

## BÖLÜM 7: NPS OTOMASYONU

### 7a — Database

```sql
CREATE TABLE IF NOT EXISTS nps_surveys (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  survey_token varchar(64) UNIQUE NOT NULL,

  trigger_type varchar(30),
  -- 'post_purchase_30d' | 'quarterly' | 'post_support' | 'manual'

  sent_at timestamp,
  opened_at timestamp,
  responded_at timestamp,

  score integer,
  -- 0-10
  category varchar(20),
  -- 'promoter' (9-10) | 'passive' (7-8) | 'detractor' (0-6)

  feedback_text text,

  -- Takip aksiyonu
  followup_action varchar(30),
  -- 'referral_invite' | 'churn_prevention' | 'none'
  followup_sent_at timestamp,

  created_at timestamp DEFAULT now()
);
```

### 7b — NPS Cron + Aksiyon

```typescript
// Ödeme yapıldıktan 30 gün sonra NPS gönder
cron.schedule('0 10 * * *', async () => {

  // 30 gün önce ilk ödemesi yapılan müşteriler
  const targets = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.status, 'active'),
        between(
          customers.firstPaymentAt,
          new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ),
        // NPS daha önce gönderilmedi mi?
        notExists(
          db.select().from(npsSurveys)
            .where(eq(npsSurveys.customerId, customers.id))
        )
      )
    );

  for (const customer of targets) {
    const token = generateSecureToken();
    await db.insert(npsSurveys).values({
      customerId: customer.id,
      surveyToken: token,
      triggerType: 'post_purchase_30d',
      sentAt: new Date(),
    });

    await sendNPSEmail(customer, token);
  }
});

// NPS cevabı gelince
export async function onNPSResponse(
  token: string,
  score: number,
  feedback: string
): Promise<void> {

  const category = score >= 9 ? 'promoter'
                 : score >= 7 ? 'passive'
                 : 'detractor';

  await db.update(npsSurveys).set({
    score, feedback,
    category,
    respondedAt: new Date(),
  }).where(eq(npsSurveys.surveyToken, token));

  if (category === 'promoter') {
    // Referral daveti gönder — 24 saat sonra
    await scheduleFollowup(token, 'referral_invite', 24);
  } else if (category === 'detractor') {
    // Churn önleme dizisi başlat — anlık
    await startChurnPreventionSequence(token);
    // Admin'e bildirim
    await notifyAdmin('nps_detractor', { token, score, feedback });
  }
}
```

### 7c — NPS Yanıt Sayfası

```
/nps/:token — Public sayfa

"CyberStep'i bir iş arkadaşınıza tavsiye etme olasılığınız nedir?"

[0] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]
Kesinlikle tavsiye etmem                 Kesinlikle tavsiye ederim

[İsteğe bağlı geri bildirim textarea]

[Gönder] butonu

Gönderim sonrası:
- 9-10: "Teşekkürler! Bir arkadaşınızı davet etmek ister misiniz?"
        → Referral linki göster
- 0-6:  "Geri bildiriminiz için teşekkürler. Ekibimiz
         kısa sürede sizinle iletişime geçecek."
```

---

## BÖLÜM 8: MÜŞTERİ PORTALI GENİŞLETME

### 8a — Yeni Portal Sayfaları

```
Mevcut: /hesabim (temel dashboard)

Eklenecek:
/hesabim/faturalar        — Fatura listesi + PDF indir
/hesabim/servisler        — Aktif servisler yönetimi
/hesabim/destek           — Destek talebi oluştur
/hesabim/domainler        — Takip edilen domainler
/hesabim/odeme-yontemi    — Ödeme güncelleme
/hesabim/bildirimler      — Bildirim tercihleri
/hesabim/api-key          — API anahtarı yönetimi
```

### 8b — Self-Servis Akışları

```typescript
// Müşteri kendi domain'ini ekleyebilir
POST /api/portal/domains
// Domain tarama kuyruğuna eklenir, müşteriye bildirim

// Müşteri destek talebi açabilir
POST /api/portal/support
// Admin panele bildirim + otomatik ticket numarası

// Müşteri aboneliğini dondurabilir (max 3 ay)
POST /api/portal/subscription/pause
// Iyzico'da sonraki ödeme dondurulur
// Servisler 30 gün aktif kalır

// Müşteri planını yükseltebilir
POST /api/portal/subscription/upgrade
// Iyzico'da plan değişikliği
// Orantılı ek fatura kesilir
```

---

## BÖLÜM 9: MUHASEBE YAZILIMI ENTEGRASYONU

### 9a — Logo / Luca / Paraşüt Webhook Çıktısı

```typescript
// Fatura oluşturulunca muhasebe yazılımına gönder
export async function syncInvoiceToAccounting(
  invoiceId: number
): Promise<void> {

  const invoice = await getInvoiceWithDetails(invoiceId);
  const provider = process.env.ACCOUNTING_PROVIDER;
  // 'logo' | 'luca' | 'parasut' | 'webhook'

  if (provider === 'parasut') {
    await syncToParasut(invoice);
  } else if (provider === 'logo') {
    await syncToLogo(invoice);
  } else if (provider === 'webhook') {
    // Genel webhook — her muhasebe yazılımı alabilir
    await axios.post(process.env.ACCOUNTING_WEBHOOK_URL!, {
      event: 'invoice.created',
      invoice: {
        number: invoice.fullInvoiceNumber,
        date: invoice.createdAt,
        due_date: invoice.dueDate,
        customer_name: invoice.customerName,
        customer_tax_id: invoice.customerTaxId,
        subtotal: invoice.subtotalTl,
        vat_amount: invoice.vatAmountTl,
        total: invoice.totalTl,
        line_items: invoice.lineItems,
        status: invoice.status,
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCOUNTING_WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
      }
    });
  }
}
```

### 9b — Admin Ayarlar Sayfasına Muhasebe Bölümü Ekle

```
/admin-panel/settings/accounting

Muhasebe Yazılımı Entegrasyonu:
  Sağlayıcı: ○ Logo  ○ Luca  ○ Paraşüt  ● Genel Webhook  ○ Yok

  Webhook URL: [_________________________]
  Secret Key:  [_________________________]
  [Bağlantıyı Test Et]

  Otomatik Senkronizasyon:
  [✓] Fatura oluşturulunca gönder
  [✓] Ödeme alınınca güncelle
  [✓] İptal/kredi notu oluşturulunca gönder

  Son senkronizasyon: [tarih]
  Hata sayısı: 0
```

---

## BÖLÜM 10: ABONELİK YAŞAM DÖNGÜSÜ YÖNETİMİ

### 10a — Abonelik Değişiklik Motoru

```typescript
// src/services/subscriptionLifecycle.ts

// Plan yükseltme
export async function upgradeSubscription(
  customerId: number,
  newPlan: string,
  effectiveDate: Date = new Date()
): Promise<void> {

  const current = await getActiveSubscription(customerId);
  const remaining = getDaysRemaining(current.nextBillingDate);
  const dailyRate = current.priceMonthly / 30;
  const creditAmount = remaining * dailyRate;

  // Orantılı kredi hesapla
  const newPlanPrice = PLAN_PRICES[newPlan];
  const upgradeCharge = newPlanPrice - creditAmount;

  if (upgradeCharge > 0) {
    // Fark faturası kes
    await createProformaInvoice(customerId, upgradeCharge,
      `Plan yükseltme: ${current.plan} → ${newPlan}`);
  }

  // Iyzico'da plan değiştir
  await iyzicoService.updateSubscriptionPlan(
    current.iyzicoSubscriptionId,
    newPlan
  );

  // Kayıt güncelle
  await db.update(customers)
    .set({ plan: newPlan, updatedAt: new Date() })
    .where(eq(customers.id, customerId));

  // Yeni servisleri aktive et
  await activateNewPlanServices(customerId, newPlan);

  // Müşteriye bildirim
  await sendPlanChangeEmail(customerId, current.plan, newPlan);
}

// Abonelik dondurma
export async function pauseSubscription(
  customerId: number,
  pauseDays: number = 30
): Promise<void> {

  if (pauseDays > 90) throw new Error('Maksimum dondurma 90 gün');

  const resumeDate = addDays(new Date(), pauseDays);

  await iyzicoService.pauseSubscription(
    customerId, resumeDate
  );

  await db.update(customers).set({
    status: 'paused',
    pausedUntil: resumeDate,
  }).where(eq(customers.id, customerId));

  await sendPauseConfirmationEmail(customerId, resumeDate);
}

// Yenileme başarısız olunca
export async function onRenewalFailed(
  customerId: number,
  attemptNumber: number
): Promise<void> {

  const graceActions = {
    1: () => sendPaymentFailedEmail(customerId, 1),
    // İlk başarısız — nazik e-posta, 3 gün içinde tekrar dene
    2: () => sendPaymentFailedEmail(customerId, 2),
    // İkinci başarısız — ödeme güncelleme linki
    3: async () => {
      await sendPaymentFailedEmail(customerId, 3);
      await suspendAccount(customerId);
      // Hesap askıya alınır, veri silinmez
    }
  };

  await graceActions[attemptNumber]?.();
}
```

### 10b — Abonelik Durumu Durum Makinesi

```
Aktif
  ↓ Manuel durdurma      → Durdurulmuş (max 90 gün) → Aktif
  ↓ Ödeme başarısız (3x) → Askıya Alınmış → Aktif (ödeme alınınca)
  ↓ İptal                → İptal Edilmiş (veriler 90 gün korunur)
  ↓ Sözleşme bitti       → Süresi Dolmuş → Yenileme teklifi
  ↑ Yeni kayıt           → Deneme (14 gün) → Aktif (ödeme alınınca)
```

---

## ADMİN PANEL MENÜ GÜNCELLEMESİ

```
─── Müşteriler & CRM ────────────────
  👥  Müşteriler          /admin-panel/customers
  🏷️  Segmentler         /admin-panel/segments
  📋  Görevler           /admin-panel/tasks
  💬  NPS Sonuçları      /admin-panel/nps

─── Satış & ISR ─────────────────────
  (mevcut ISR menüsü)

─── Muhasebe & Finans ───────────────
  🧾  Faturalar          /admin-panel/invoices
  💰  Tahsilat           /admin-panel/collections
  📈  Gelir Dashboard    /admin-panel/revenue
  📊  MRR / ARR          /admin-panel/mrr

─── Ayarlar ─────────────────────────
  ⚙️  Genel              /admin-panel/settings
  💳  Muhasebe Enteg.    /admin-panel/settings/accounting
  🏦  Banka Bilgileri    /admin-panel/settings/banking
  📧  E-posta Şablonları /admin-panel/settings/email-templates
```

---

## ENVIRONMENT VARIABLES

```
# Muhasebe
ACCOUNTING_PROVIDER=webhook
ACCOUNTING_WEBHOOK_URL=
ACCOUNTING_WEBHOOK_SECRET=

# Banka (fatura ödeme bilgisi)
BANK_NAME=
BANK_IBAN=
BANK_ACCOUNT_NAME=CyberStep.io

# Abonelik
MAX_PAUSE_DAYS=90
PAYMENT_RETRY_INTERVAL_DAYS=3
GRACE_PERIOD_DAYS=7
```

---

## UYGULAMA SIRASI

```
SPRINT 1 (Bu hafta):
  ✓ Bölüm 1: Fatura PDF + seri no sistemi
  ✓ Bölüm 2: Tahsilat takibi + otomatik hatırlatma
  Test: Fatura oluştur → PDF indir → e-posta gönder

SPRINT 2 (Gelecek hafta):
  ✓ Bölüm 3: MRR/ARR dashboard
  ✓ Bölüm 4: Müşteri 360° görünümü
  Test: Müşteri sayfasında tüm sekmeler

SPRINT 3:
  ✓ Bölüm 5: Etiket + segment sistemi
  ✓ Bölüm 6: Görev + hatırlatıcı motoru
  Test: Toplu etiketleme, görev atama

SPRINT 4:
  ✓ Bölüm 7: NPS otomasyonu
  ✓ Bölüm 8: Müşteri portalı genişletme
  Test: NPS e-postası → cevap → aksiyon

SPRINT 5:
  ✓ Bölüm 9: Muhasebe entegrasyonu
  ✓ Bölüm 10: Abonelik yaşam döngüsü
  Test: Plan değişikliği → fark faturası → muhasebe sync
```

---

*CyberStep.io CRM & Muhasebe Modülü — Mayıs 2026*
