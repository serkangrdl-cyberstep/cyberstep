# CyberStep — Asset Classification, WAF Durum Rozeti ve Tarama Önceliklendirme

## Replit Agent'a Ver

---

## ÖNCE KONTROL ET — HENÜZ DEĞİŞİKLİK YAPMA

Bu prompt üç ilişkili özelliği kapsıyor. Hepsi mevcut veriyi yeniden kullanıyor,
yeni büyük veri toplama gerektirmiyor. Önce mevcut yapıyı çıkar:

```
Aşağıdakileri kontrol et ve bana rapor ver, HENÜZ DEĞİŞİKLİK YAPMA:

1. Domain/subdomain tarama sonuçlarının tutulduğu ana tablo(lar) hangileri?
   (örn. domain_scans, lead_candidates, customer_tech_stack vb.)
   Şemalarını göster: psql $DATABASE_URL -c "\d <tablo_adı>"

2. crt.sh / subdomain keşif sonuçları nereye yazılıyor? Bir subdomain
   listesi/tablosu var mı? Varsa şemasını göster.

3. Her subdomain/asset için HTTP status code, content-type, technology
   stack gibi bilgiler toplanıyor mu? Hangi serviste/cron'da?

4. waf_detected, waf_provider, confidence_score, confidence_note
   kolonları mevcut mu? (Önceki WAF disclaimer promptunda eklenmiş
   olabilir — varsa kontrol et, yoksa bu prompt içinde ekleyeceğiz.)

5. Admin panelde lead detay modalının bulunduğu dosya yolu nedir?
   (örn. lead-discovery.tsx içindeki domain detay popup'ı)

6. Teaser mail ve PDF rapor üreten servis dosyaları hangileri?
   (leadTeaserEmail.ts, pdfReportGenerator.ts vb.)

Bu bilgileri özetle, ardından devam talimatını bekle. Mevcut tablo/alan
adlarını KORU — bu prompttaki örnek isimler (ör. asset_classification,
priority_score) sadece öneridir; senin şemanda zaten karşılığı olan bir
alan/kavram varsa onu kullan, yeniden icat etme.
```

---

## GENEL KURALLAR (TÜM BÖLÜMLER İÇİN)

- **Surgical/minimal diff**: Mevcut çalışan akışları (cron job'lar, scoring,
  teaser üretimi, PDF üretimi) BOZMA. Sadece üzerine ekleme yap.
- **Mevcut naming convention'a uy**: Eğer mevcut tablo `snake_case`,
  TypeScript tarafı `camelCase` kullanıyorsa aynı şekilde devam et.
- **Migration'lar additive olsun**: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  — mevcut kolonları değiştirme/silme yok.
- Her bölümden sonra build + smoke test yap, sorun yoksa devam et.
- Üç bölüm de bağımsız çalışabilir şekilde tasarlandı — istersen tek tek
  de uygulanabilir, ama sırayla gitmek (1 → 2 → 3) en az riskli yoldur.

---

## BÖLÜM 1 — ASSET CLASSIFICATION (Varlık Sınıflandırması)

### Amaç
Her taranan domain için, bulunan subdomain'leri/varlıkları otomatik olarak
kategorilere ayır: **Web App**, **API**, **Ölü/Hatalı Sayfa (4xx/5xx)**,
**Redirect**, **Diğer/Bilinmeyen**. Bu sınıflandırma hem ISR ekibine hem
müşteriye "şirketinizin dijital ayak izi büyüklüğü" mesajını verir.

### Veri Modeli

Mevcut subdomain/asset tablosuna (BÖLÜM ÖNCESİ kontrolde bulduğun tabloya)
şu alanları ekle — isimler örnek, kendi convention'ına göre uyarlayabilirsin:

```sql
ALTER TABLE <subdomain_tablosu>
  ADD COLUMN IF NOT EXISTS asset_classification text,  -- 'web_app' | 'api' | 'redirect' | 'error_4xx' | 'error_5xx' | 'unknown'
  ADD COLUMN IF NOT EXISTS http_status_code integer,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS classification_updated_at timestamp;
```

Eğer bu alanların bir kısmı zaten mevcutsa (örn. http_status_code zaten
başka bir isimle tutuluyorsa), o mevcut alanı kullan, yeni alan ekleme.

### Sınıflandırma Mantığı

Mevcut subdomain tarama/keşif fonksiyonunun (crt.sh sonrası HTTP probe
yapan adım) içine veya hemen sonrasına bir `classifyAsset()` fonksiyonu
ekle:

```typescript
function classifyAsset(httpStatus: number | null, contentType: string | null, url: string): string {
  if (httpStatus === null) return "unreachable";
  if (httpStatus >= 500) return "error_5xx";
  if (httpStatus >= 400) return "error_4xx";
  if (httpStatus >= 300 && httpStatus < 400) return "redirect";

  // API tespiti: content-type veya path bazlı basit heuristik
  if (contentType?.includes("application/json") ||
      contentType?.includes("application/xml") ||
      /\/api\/|\/v[0-9]+\//.test(url)) {
    return "api";
  }

  if (httpStatus >= 200 && httpStatus < 300) return "web_app";
  return "unknown";
}
```

Bu fonksiyonu, mevcut subdomain keşif/probe cron'unun her sonucu için
çağır ve `asset_classification`, `http_status_code`, `content_type`
alanlarını doldur.

### Özet Görünüm — Lead Detay Modalı

Admin panelde lead detay modalında (BÖLÜM ÖNCESİ kontrolde bulduğun dosya),
"SHODAN TESPİT DETAYI" bölümünün üstüne veya yanına, Detectify'daki
"Classification" panosuna benzer bir özet kutusu ekle:

```
VARLIK SINIFLANDIRMASI
┌─────────────────────────────────┐
│ Web Uygulamaları:      4         │
│ API'ler:               1         │
│ Yönlendirmeler (3xx):  2         │
│ Hata Veren (4xx/5xx):  2         │
│ Toplam Subdomain:      9         │
└─────────────────────────────────┘
```

Bu sayıları, ilgili domain'e bağlı subdomain kayıtlarını
`asset_classification` alanına göre GROUP BY ile sayan basit bir
sorgudan üret. Mevcut modal layout'unu bozmadan, mantıklı bir
konuma (örn. Shodan kutusunun üstü) ekle.

### Teaser'a Entegrasyon

Teaser mail şablonuna (leadTeaserEmail.ts), eğer toplam subdomain sayısı
1'den büyükse, şu cümleyi ekle (mevcut metnin uygun bir yerine, örn.
risk skoru açıklamasından önce):

```typescript
function buildAssetSummaryLine(totalSubdomains: number, webApps: number, apis: number): string | null {
  if (totalSubdomains <= 1) return null;
  return `Taramamız, ${domain} altında toplam ${totalSubdomains} dijital varlık tespit etti (${webApps} web uygulaması, ${apis} API dahil). Bu varlıkların güvenlik durumu hakkında bilgi sahibi olmak, saldırı yüzeyinizi yönetmenin ilk adımıdır.`;
}
```

Bu satır opsiyonel/koşullu — `totalSubdomains <= 1` ise hiç eklenmesin
(tek domain'lik küçük işletmelerde anlamsız olur).

---

## BÖLÜM 2 — WAF/CONFIDENCE DURUM ROZETİ (Görsel Status Badge)

### Önkoşul Kontrolü
Eğer önceki WAF disclaimer prompt'u (confidence_score, waf_detected,
waf_provider, confidence_note alanları) zaten uygulanmışsa, bu bölüm
SADECE görsel rozet ekler — yeni alan/migration gerekmez. Eğer
uygulanmamışsa, önce o prompt'taki migration'ı uygula.

### Amaç
Detectify'daki "Completed / Stopped / With warnings / Blocked by WAF"
durum etiketlerine benzer şekilde, CyberStep admin panelinde her domain
taramasının yanına görsel bir durum rozeti ekle. Bu, ISR ekibinin
"bu lead'e nasıl yaklaşmalıyım" sorusunu tek bakışta cevaplar.

### Rozet Mantığı

```typescript
type ScanConfidenceBadge = {
  label: string;
  color: "green" | "amber" | "gray";
};

function getScanConfidenceBadge(confidenceScore: number, wafDetected: boolean): ScanConfidenceBadge {
  if (!wafDetected || confidenceScore >= 85) {
    return { label: "Tam Görünürlük", color: "green" };
  }
  if (confidenceScore >= 70) {
    return { label: "Kısmi Görünürlük (Yüksek Güven)", color: "amber" };
  }
  return { label: "Kısmi Görünürlük — WAF Arkası", color: "amber" };
}
```

### UI Entegrasyonu — Lead Listesi ve Detay Modalı

1. **Lead listesi tablosunda** (admin panelde domain/lead satırlarının
   listelendiği görünüm — Surface Monitoring'deki "Status" sütunu gibi),
   her satıra küçük bir rozet ekle:

```tsx
<span className={`px-2 py-0.5 text-xs rounded-full border ${
  badge.color === "green"
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-amber-50 text-amber-800 border-amber-300"
}`}>
  {badge.label}
</span>
```

2. **Lead detay modalında**, Risk Skoru'nun yanına aynı rozeti ekle
   (BÖLÜM 1'deki Varlık Sınıflandırması kutusunun yakınına konabilir,
   ama mevcut "Risk Skoru / Kritik Bulgu / Kaynak" satırının en doğal
   yeri — oraya ekle).

Mevcut tablo/kart yapısını bozmadan, sadece bu rozeti uygun bir
boşluğa ekle. Eğer satır zaten dar ise, rozeti bir tooltip/ikon
olarak da gösterebilirsin (ⓘ ikonu + hover'da açıklama).

---

## BÖLÜM 3 — TARAMA ÖNCELİKLENDİRME (Scan Recommendations Benzeri)

### Amaç
Detectify'ın "bu domain HTTPS dönüyor, 200 veriyor, script/fonksiyon
barındırıyor → derin tarama öner" mantığına benzer şekilde, CyberStep'in
keşfettiği subdomain'ler arasından "hangisi öncelikli olarak derinlemesine
incelenmeli" sinyalini üret. Bu, ISR ekibinin veya bayinin zamanını en
yüksek-değerli hedefe yönlendirmesini sağlar.

### Öncelik Skoru Hesaplama

BÖLÜM 1'deki `asset_classification` ve mevcut risk/CVE verilerini
kullanarak basit bir öncelik puanı hesapla. Mevcut subdomain tablosuna
ekle:

```sql
ALTER TABLE <subdomain_tablosu>
  ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_reason text;
```

Hesaplama mantığı (mevcut scoring rubric'inle uyumlu şekilde ayarla):

```typescript
function calculatePriorityScore(asset: {
  classification: string;
  httpStatus: number | null;
  hasLoginForm: boolean;     // varsa mevcut taramadan
  technologies: string[];    // varsa mevcut tech stack tespitinden
}): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  if (asset.classification === "api") {
    score += 30;
    reasons.push("API endpoint");
  }
  if (asset.classification === "web_app" && asset.hasLoginForm) {
    score += 25;
    reasons.push("Giriş formu tespit edildi");
  }
  if (asset.technologies?.some(t => /wordpress|joomla|drupal/i.test(t))) {
    score += 20;
    reasons.push("CMS tespit edildi (yaygın hedef)");
  }
  if (asset.classification === "error_5xx") {
    score += 10;
    reasons.push("Sunucu hatası — yanlış yapılandırma olabilir");
  }

  return { score, reason: reasons.join(", ") || "Standart" };
}
```

`hasLoginForm` ve `technologies` alanları zaten mevcut taramadan
geliyorsa kullan; gelmiyorsa bu kriterleri atla, sadece elindeki
veriyle (classification, httpStatus) skorla — eksik veri için
fonksiyonu zorla genişletme.

### Admin Panel Görünümü

Lead detay modalında, BÖLÜM 1'deki Varlık Sınıflandırması kutusunun
altına, en yüksek `priority_score`'a sahip 3-5 subdomain'i listele:

```
ÖNCELİKLİ İNCELEME ÖNERİLERİ
┌──────────────────────────────────────────────┐
│ api.example.com         Öncelik: 30           │
│   → API endpoint                              │
│                                                │
│ admin.example.com       Öncelik: 25           │
│   → Giriş formu tespit edildi                 │
└──────────────────────────────────────────────┘
```

Bu liste, ISR ekibinin "AI Attack Surface Analizi" yaparken hangi
subdomain'lere odaklanacağını gösterir — ücretli rapor içeriğini
zenginleştirmek için de kullanılabilir (PDF'e "öncelikli varlıklar"
bölümü olarak eklenebilir, opsiyonel).

---

## TEST

1. Migration'ları uygula, build et:
   ```
   pnpm --filter @workspace/api-server run build
   pnpm --filter @workspace/cyberstep run build
   ```

2. Mevcut taranmış bir domain için sınıflandırma/öncelik hesaplamasını
   geriye dönük çalıştır (küçük bir migration script ile, 5-10 domain'lik
   bir örnek üzerinde test et):
   ```sql
   SELECT domain, asset_classification, priority_score, http_status_code
   FROM <subdomain_tablosu> WHERE root_domain = '<test_domain>'
   ORDER BY priority_score DESC LIMIT 10;
   ```

3. Admin panelde test domain'inin detay modalını aç:
   - Varlık Sınıflandırması kutusu doğru sayıları gösteriyor mu?
   - WAF/Confidence rozeti doğru renk ve etiketle görünüyor mu?
   - Öncelikli İnceleme Önerileri listesi mantıklı sıralanıyor mu?

4. Bu test domain için teaser üret, eğer subdomain sayısı > 1 ise
   yeni cümlenin eklendiğini doğrula:
   ```sql
   SELECT domain, teaser_body FROM lead_candidates WHERE domain = '<test_domain>';
   ```

5. Mevcut/eski lead'ler için regresyon testi: birkaç eski lead'in
   detay modalını aç, sayfa hata vermeden açılıyor mu (yeni alanlar
   NULL olduğunda da kutu/rozet düzgün render oluyor mu — örn.
   "Varlık Sınıflandırması: Henüz hesaplanmadı" gibi bir fallback
   göster).

6. git commit && git push.

---

## NOT — ÖNCELİK SIRASI

Eğer zaman kısıtlıysa, tek bölüm uygula: **BÖLÜM 2 (WAF rozeti)**.
En düşük efor, mevcut WAF disclaimer altyapısının üzerine sadece görsel
katman ekliyor ve ISR ekibine anında fayda sağlıyor. BÖLÜM 1 ve 3 daha
fazla yeni veri işleme gerektirdiğinden, sonraki bir oturumda ayrı
ayrı da ele alınabilir.
