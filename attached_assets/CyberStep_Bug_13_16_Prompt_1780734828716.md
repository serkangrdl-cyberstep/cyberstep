# CyberStep.io — Bug 13 + Bug 16 Düzeltmesi
## Replit Agent Promptu

---

## BUG 13 — CT LOG SUBDOMAIN "!" YANLIŞ GÖSTERGE

**Sorun:**
nb.net.tr raporunda:
"16 alt alan adı SSL sertifika geçmişinde" → !

CT log'da subdomain görünmesi normal.
Uyarı değil, bilgi olmalı.

**Düzeltme:**

```typescript
// crt.sh subdomain kontrolü yapan fonksiyonu bul
// Rapordaki indicator atamasını güncelle:

function evaluateCTLog(subdomainCount: number): {
  indicator: "ok" | "info" | "warning";
  label: string;
  note: string;
} {
  if (subdomainCount === 0) {
    return {
      indicator: "ok",
      label: "Subdomain tespit edilmedi",
      note: "",
    };
  }

  // 50'den fazla = gerçek uyarı
  if (subdomainCount > 50) {
    return {
      indicator: "warning",
      label: `${subdomainCount} subdomain tespit edildi`,
      note:
        "Çok sayıda subdomain saldırı yüzeyini " +
        "artırır. Gereksiz subdomainleri kaldırın.",
    };
  }

  // Normal aralık (1-50) = bilgi, uyarı değil
  return {
    indicator: "info",
    label: `${subdomainCount} alt alan adı tespit edildi`,
    note:
      "SSL sertifika geçmişinde görülen subdomainler. " +
      "Tümünün güncel ve gerekli olduğunu doğrulayın.",
  };
}
```

**Rapor göstergesini güncelle:**
```typescript
// Raporda indicator → simge eşlemesi:
// "ok"      → ✅  (yeşil tik)
// "info"    → ℹ️  (mavi bilgi — ! değil)
// "warning" → !   (sarı uyarı)
// "error"   → ✗   (kırmızı hata)

// CT log satırı için:
// 16 subdomain → ℹ️ (info) → "!" değil
```

---

## BUG 16 — DMARC REJECT VARKEN EMAIL SPOOFING SENARYOSU

**Sorun:**
manivela.net.tr → DMARC p=reject (en güçlü)
Ama MITRE'da: "SPF Bypass ile E-posta Spoofing" YÜKSEK

DMARC p=reject aktifken email spoofing
pratikte imkânsız. Bu senaryo üretilmemeli.

**Düzeltme:**

MITRE prompt'unu bul. `dmarcPolicy` değişkeninin
prompt'a geçildiği yere şu kuralı ekle:

```typescript
// MITRE Claude prompt'una ekle:

const dmarcContext = `
DMARC KORUMA DURUMU: ${dmarcPolicy || "yok"}

EMAIL SPOOFING / PHISHING SENARYOSU KURALI:
  p=reject     → Bu senaryo KESİNLİKLE ÜRETME.
                 DMARC reject aktif = e-posta
                 sahteciliği teknik olarak engellendi.
                 
  p=quarantine → Senaryo üretebilirsin ama
                 maksimum seviye "Orta" olsun.
                 Quarantine tam engel değil.
                 
  p=none       → Senaryo üret, seviye "Yüksek" olabilir.
                 İzleme modu, koruma yok.
                 
  kayıt yok    → Senaryo üret, seviye "Yüksek" olabilir.
                 Hiç koruma yok.
`;

// Bu context'i MITRE prompt'unun içine ekle
// (skor ve wafProvider context'inin yanına)
```

---

## TEST İÇİN KONTROL TABLOSU

```
BUG 13 doğrulandı:
  □ nb.net.tr tarandı
  □ CT log satırında "ℹ️" (! değil)
  □ Not: "tümünün güncel..." yazıyor

BUG 16 doğrulandı:
  □ manivela.net.tr tarandı
  □ MITRE'da email spoofing senaryosu YOK
  □ Genel seviye "Düşük" (92 puan)

Regresyon yok:
  □ guzel.net.tr tarandı
  □ DMARC quarantine → email senaryo var ama "Orta"
  □ Cloudflare → CDN bypass senaryosu yok
```

---

*CyberStep.io — Bug 13+16 Düzeltmesi — Haziran 2026*
