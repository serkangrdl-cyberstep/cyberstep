# CyberStep.io — Replit Düzeltme Promptu
## Kod Analizine Dayalı — Öncelikli Düzeltmeler

---

## BAĞLAM

Kaynak kod analizi yapıldı. Aşağıdaki düzeltmeler
gerçek kod bulgularına dayanıyor.
Her düzeltme için önce ilgili dosyayı oku,
mevcut durumu anla, sonra uygula.

---

## DÜZELTİM 1 — FREE SCAN RATE LİMİTER (KRİTİK)

**Dosya:** `src/routes/domain-scan/index.ts`

Bu dosyayı oku. İlk satırlarda rate limiter import
veya tanımı var mı kontrol et.

Eğer rate limiter YOKSA:

```typescript
// Dosyanın başına ekle (diğer import'lardan sonra):
import rateLimit from "express-rate-limit";

// İlk router.get veya router.post'tan önce:
const anonScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Saatlik ücretsiz tarama limitine ulaştınız. Hesap oluşturarak daha fazla tarama yapabilirsiniz." },
  keyGenerator: (req) => req.ip ?? "unknown",
  skip: (req) => {
    // Giriş yapmış kullanıcılar için atla
    return !!(req as any).customerId;
  },
});

const authScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Saatlik tarama limitine ulaştınız." },
  keyGenerator: (req) => String((req as any).customerId ?? req.ip),
});
```

Ücretsiz tarama endpoint'ine (POST veya GET /api/scan
veya benzeri) bu limiter'ı uygula:

```typescript
router.post("/domain-scan", anonScanLimiter, async (req, res) => {
  // mevcut kod
});
```

---

## DÜZELTİM 2 — FORTİNET CDN YANLIŞ SINIFLANDIRMA

**Dosya:** `src/services/portRiskClassifier.ts`

Bu dosyayı oku. `CDN_PROVIDER_PATTERNS` listesini bul.

Listede `fortinet` veya `fortiweb` varsa KALDIR:

```typescript
// KALDIR bu satırı:
{ pattern: /fortinet|fortiweb/i, name: "Fortinet" },
```

**Neden:** Fortinet bir CDN değil. Shodan'da
org="Fortinet Inc" görünce port riskleri
sıfırlanıyor. Bu false negative — RDP açık bir
FortiGate müşterisini "güvenli" gösteriyor.

Fortinet tespit edilince port risklerini
DÜŞÜRME, sadece raporda belirt:

```typescript
// PortRiskSummary'e ekle:
wafDetected: boolean;
wafProvider: string | null;

// Skor hesabında:
// WAF tespit edildi → raporlama bağlamını değiştir
// ama port risk seviyesini düşürme
```

---

## DÜZELTİM 3 — KRİTİK DB İNDEXLERİ

**Dosya:** `src/index.ts`

Startup migration bloğunu bul
(`ALTER TABLE IF NOT EXISTS` satırlarının olduğu yer).
Bu bloğa şu indexleri ekle:

```typescript
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS domain_scans_email_idx
  ON domain_scans (email)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS domain_scans_created_at_idx
  ON domain_scans (created_at DESC)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS assessments_email_idx
  ON assessments (email)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS fabric_events_customer_id_idx
  ON fabric_events (customer_id)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS fabric_events_created_at_idx
  ON fabric_events (created_at DESC)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS domain_scans_overall_score_idx
  ON domain_scans (overall_score)
`);
```

---

## DÜZELTİM 4 — ABONELİK OTOMATİK YENILEME

**Dosya:** `src/services/subscription-renewal.ts`

Bu dosyayı oku. Satır ~89'da şunu göreceksin:
```typescript
// Iyzico stored card renewal would go here.
```

Bu placeholder'ı gerçek implementasyonla değiştir.

**Önce Iyzico servisini incele:**
`src/services/iyzico.ts` dosyasını oku.
`createPaymentWithStoredCard` veya benzeri
bir fonksiyon var mı?

Varsa renewal'da kullan:

```typescript
// Placeholder yerine:
const iyzico = await import("../services/iyzico");

if (!iyzico.isIyzicoConfigured()) {
  // Iyzico key yoksa renewal linki gönder
  logger.warn({ customerId: cs.customerId },
    "Iyzico not configured, sending manual renewal link");
  // Mevcut reminder email gönder
  continue;
}

// Stored card varsa otomatik çek
const storedCardKey = cs.iyzicoCardUserKey;
// (Bu alanın customer_service_subscriptions
//  tablosunda olup olmadığını kontrol et)

if (storedCardKey) {
  const result = await iyzico.createPaymentWithStoredCard({
    price: String(cs.priceTl),
    paidPrice: String(cs.priceTlWithKdv),
    currency: "TRY",
    cardUserKey: storedCardKey,
    buyer: { /* customer bilgileri */ },
    basketItems: [{
      id: String(cs.id),
      name: service.label,
      price: String(cs.priceTl),
    }],
  });

  if (result.status === "success") {
    // Yenileme başarılı
    await db.update(customerServiceSubscriptionsTable).set({
      expiresAt: newExpiryDate,
      renewalAttemptCount: 0,
      lastPaymentAt: new Date(),
    }).where(eq(customerServiceSubscriptionsTable.id, cs.id));

    await sendReceiptEmail({ /* ... */ });
    logger.info({ customerId: cs.customerId },
      "Auto-renewal successful");
  } else {
    // Ödeme başarısız — dunning başlat
    await dunningManager.handlePaymentFailure(cs.customerId);
  }
} else {
  // Stored card yok — manuel yenileme linki gönder
  // (Mevcut reminder logic)
}
```

**Not:** `customerServiceSubscriptionsTable`'da
`iyzico_card_user_key` kolonu yoksa önce ekle:

```sql
ALTER TABLE customer_service_subscriptions
  ADD COLUMN IF NOT EXISTS iyzico_card_user_key TEXT;
```

Ödeme sırasında (`src/routes/payments/index.ts`)
başarılı ödemeden sonra `cardUserKey`'i kaydet.

---

## DÜZELTİM 5 — SOC ADMIN EMAIL KONTROLÜ

**Dosya:** `src/services/soc/soc-escalation.ts`
veya SOC eskalasyon yapan herhangi bir dosya

Bu dosyayı oku. SOC_ADMIN_EMAIL kullanıldığı yeri bul.

Eğer şöyle bir pattern varsa:

```typescript
const adminEmail = process.env["SOC_ADMIN_EMAIL"];
// email gönder...
```

Bunu şu şekilde güvenli hale getir:

```typescript
const adminEmail = process.env["SOC_ADMIN_EMAIL"];

if (!adminEmail) {
  // Sessiz fail yerine log at
  logger.error(
    { caseId: socCase.id, level: escalationLevel },
    "SOC_ADMIN_EMAIL not configured — escalation email NOT sent. Set this env var immediately."
  );
  // Telegram'a bildir (varsa)
  if (process.env["ADMIN_TELEGRAM_CHAT_ID"]) {
    void sendTelegram(
      process.env["ADMIN_TELEGRAM_CHAT_ID"],
      `🚨 SOC Eskalasyon emaili gönderilemedi!\nSOC_ADMIN_EMAIL tanımlı değil.\nCase: ${socCase.id}`
    );
  }
  return;
}
```

**Sonra:** Replit Secrets'ta SOC_ADMIN_EMAIL'in
set edildiğini kontrol et.

---

## DÜZELTİM 6 — POSTHOG API KEY KONTROLÜ

**Dosya:** `src/services/analytics.ts`

Bu dosyayı oku. PostHog key kontrolü var mı?

Eğer key yokken crash veya sessiz fail varsa:

```typescript
const POSTHOG_KEY = process.env["POSTHOG_API_KEY"];

export function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!POSTHOG_KEY) {
    // Sessiz geç — analytics optional
    return;
  }
  // mevcut PostHog kodu
}
```

Key yokken sistem çalışmaya devam etsin,
sadece analytics toplanmasın.

---

## DÜZELTİM 7 — CRON JOB TIMEZONE TUTARSIZLIĞI

**Dosya:** `src/index.ts`

Tüm cron schedule'larını tara.
Timezone parametresi var mı kontrol et:

```typescript
// YANLIŞ — UTC'de çalışır, İstanbul'da 3 saat kayar
cron.schedule("0 9 * * *", handler);

// DOĞRU — İstanbul saatiyle çalışır
cron.schedule("0 9 * * *", handler, {
  timezone: "Europe/Istanbul"
});
```

Tüm cron.schedule çağrılarına
`{ timezone: "Europe/Istanbul" }` ekle.

**Özellikle kritik olanlar:**
- Sabah brifing emaili (08:00)
- Onboarding D+3/D+7 (10:30)
- Blog autopilot (09:00)
- Sosyal medya (Pazar 20:00)
- Dunning check (10:15)
- Upsell engine (23:00)

---

## DÜZELTİM 8 — FREE SCAN'DE SHODAN/HIBP GRACEFUL FALLBACK

**Dosya:** `src/routes/domain-scan/index.ts`

SHODAN_API_KEY veya HIBP_API_KEY yokken
tarama tamamen başarısız oluyorsa düzelt.

Her harici API çağrısını şu pattern ile sar:

```typescript
// SHODAN kontrolü
let shodanResult = null;
if (process.env["SHODAN_API_KEY"]) {
  try {
    shodanResult = await checkShodan(domain);
  } catch (e) {
    logger.warn({ domain, err: e }, "Shodan check failed, skipping");
  }
}

// HIBP kontrolü
let hibpResult = { breachCount: 0, breaches: [] };
if (process.env["HIBP_API_KEY"]) {
  try {
    hibpResult = await checkHIBP(domain);
  } catch (e) {
    logger.warn({ domain, err: e }, "HIBP check failed, skipping");
  }
}

// Sonuçlar null olsa da tarama tamamlanmalı
```

Bu olmadan API key eksikken tarama crash oluyor.

---

## DÜZELTİM 9 — SCORING ACCURACY (DAHA ÖNCE KONUŞMUŞTUK)

**Dosya:** `src/routes/domain-scan/index.ts`
veya scoring ile ilgili dosya

Şu iyileştirmeleri uygula:

**SSL gün eşikleri:**
```typescript
function getSSLSeverity(daysLeft: number) {
  if (daysLeft <= 0)  return "critical";
  if (daysLeft <= 7)  return "critical";
  if (daysLeft <= 14) return "high";
  if (daysLeft <= 30) return "medium"; // critical değil
  if (daysLeft <= 60) return "low";
  return "ok";
}
```

**DMARC none = medium (critical değil):**
```typescript
// p=none → medium, critical değil
if (dmarcPolicy === "none") severity = "medium";
if (!dmarcRecord) severity = "high";
```

**SPF softfail = medium (critical değil):**
```typescript
if (spfRecord?.includes("~all")) severity = "medium";
if (!spfRecord) severity = "high";
if (spfRecord?.includes("+all")) severity = "critical";
```

**HTTP header eksikliği max = medium:**
```typescript
// Header eksikliği hiçbir zaman critical olmasın
const HEADER_SEVERITY = {
  "content-security-policy": "medium",
  "strict-transport-security": "medium",
  "x-frame-options": "low",
  "x-content-type-options": "low",
  "referrer-policy": "low",
};
```

---

## DÜZELTİM 10 — E-FATURA (PARASÜT API)

**Yeni dosya:** `src/services/einvoice.ts`

```typescript
// Parasüt API ile e-fatura/e-arşiv kesimi
// Her başarılı ödemeden sonra çağrılır

export async function createEInvoice(params: {
  customerEmail: string;
  customerName: string;
  companyName: string;
  taxNumber?: string;
  amount: number;      // KDV hariç TL
  kdv: number;         // KDV tutarı
  total: number;       // Toplam TL
  serviceLabel: string;
  paymentRef: string;
}): Promise<{ invoiceNo: string; pdfUrl: string } | null> {

  const apiKey = process.env["PARASUT_API_KEY"];
  const companyId = process.env["PARASUT_COMPANY_ID"];

  if (!apiKey || !companyId) {
    logger.warn("PARASUT_API_KEY veya PARASUT_COMPANY_ID eksik — e-fatura atlandı");
    return null;
  }

  try {
    // 1. Token al
    const tokenResp = await axios.post(
      "https://api.parasut.com/oauth/token",
      {
        grant_type: "client_credentials",
        client_id: process.env["PARASUT_CLIENT_ID"],
        client_secret: process.env["PARASUT_CLIENT_SECRET"],
      }
    );
    const token = tokenResp.data.access_token;

    // 2. Fatura oluştur
    const invoiceResp = await axios.post(
      `https://api.parasut.com/v4/${companyId}/sales_invoices`,
      {
        data: {
          type: "SalesInvoice",
          attributes: {
            item_type: params.taxNumber ? "e_invoice" : "e_archive",
            description: params.serviceLabel,
            issue_date: new Date().toISOString().split("T")[0],
            due_date: new Date().toISOString().split("T")[0],
            currency: "TRY",
          },
          relationships: {
            contact: {
              data: {
                type: "Contact",
                attributes: {
                  name: params.companyName || params.customerName,
                  email: params.customerEmail,
                  tax_number: params.taxNumber ?? null,
                },
              },
            },
            details: {
              data: [{
                type: "SalesInvoiceDetail",
                attributes: {
                  description: params.serviceLabel,
                  quantity: 1,
                  unit_price: params.amount,
                  vat_rate: 20,
                },
              }],
            },
          },
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const invoiceId = invoiceResp.data.data.id;
    const invoiceNo = invoiceResp.data.data.attributes.invoice_no;
    const pdfUrl = invoiceResp.data.data.attributes.pdf_url;

    logger.info({ invoiceNo, customerEmail: params.customerEmail },
      "E-fatura oluşturuldu");

    return { invoiceNo, pdfUrl };
  } catch (e) {
    logger.error({ err: e }, "E-fatura oluşturma hatası");
    return null; // Fatura başarısız olsa da satış devam etsin
  }
}
```

**Entegrasyon:** `src/routes/payments/index.ts`'te
başarılı ödeme sonrası ekle:

```typescript
// Ödeme başarılı oldu, sonrasında:
setImmediate(() => {
  void createEInvoice({
    customerEmail: customer.email,
    customerName: customer.contactName,
    companyName: customer.companyName,
    taxNumber: customer.taxNumber,
    amount: prices.base,
    kdv: prices.kdv,
    total: prices.total,
    serviceLabel: service.label,
    paymentRef: paymentResult.paymentId,
  });
});
```

**Yeni env variables:**
```
PARASUT_API_KEY=
PARASUT_CLIENT_ID=
PARASUT_CLIENT_SECRET=
PARASUT_COMPANY_ID=
```

---

## TEST SENARYOLARI

```
1. Rate limiter testi:
   curl -X POST /api/domain-scan -d '{"domain":"test.com"}'
   4 kez tekrarla → 4. istekte 429 hatası gelmeli

2. Fortinet CDN düzeltme:
   Shodan'dan fortinet ISP'li bir IP tara
   → Port 3389 açıksa "critical" göstermeli
   → Önceden "none" gösteriyordu

3. DB index testi:
   SELECT * FROM pg_indexes WHERE tablename = 'domain_scans';
   → email_idx ve created_at_idx görünmeli

4. Auto-renewal testi:
   Test aboneliği oluştur → expiry tarihini geçmiş yap
   → stored card varsa Iyzico çağrısı yapıldı mı?
   → Yoksa renewal email gönderildi mi?

5. SOC admin email testi:
   SOC_ADMIN_EMAIL env var'ı geçici kaldır
   → SOC eskalasyonu trigger et
   → Logger'da "SOC_ADMIN_EMAIL not configured" görünmeli
   → Telegram bildirimi gelmeli

6. E-fatura testi:
   Parasut sandbox ile test ödemesi yap
   → createEInvoice çağrıldı mı?
   → invoiceNo döndü mü?

7. Cron timezone testi:
   Log'larda cron çalışma zamanlarını kontrol et
   → 08:00 cron saat 08:00 İstanbul'da mı çalışıyor?
   → UTC offset hesapla (UTC+3)
```

---

## ENVIRONMENT VARIABLES KONTROL LİSTESİ

```bash
# Replit Secrets'ta bu değerlerin SET olduğunu doğrula:

# ZORUNLU (satıştan önce):
IYZICO_API_KEY=           # Üretimde "sandbox" ile başlamayan
IYZICO_SECRET_KEY=
SOC_ADMIN_EMAIL=          # eskalasyon emaili

# TARAMA KALİTESİ (bu hafta):
HIBP_API_KEY=             # haveibeenpwned.com/API/Key ($3.50/ay)
ABUSEIPDB_API_KEY=        # abuseipdb.com/register (ücretsiz)
GOOGLE_SAFE_BROWSING_API_KEY=  # console.cloud.google.com (ücretsiz)

# LEAD GENERATION:
SHODAN_API_KEY=           # Var — kontrol et
HUNTER_API_KEY=           # $34/ay
APOLLO_API_KEY=           # Freemium

# ANALİTİK:
POSTHOG_API_KEY=          # app.posthog.com (ücretsiz)
POSTHOG_HOST=             # https://app.posthog.com

# E-FATURA (önümüzdeki hafta):
PARASUT_API_KEY=
PARASUT_CLIENT_ID=
PARASUT_CLIENT_SECRET=
PARASUT_COMPANY_ID=
```

---

*CyberStep.io — Replit Düzeltme Promptu — Haziran 2026*
*Gerçek Kod Analizine Dayalı — Bölüm Bölüm Uygula*
