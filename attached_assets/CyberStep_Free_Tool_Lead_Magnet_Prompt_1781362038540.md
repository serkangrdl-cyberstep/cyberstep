# CyberStep — Ücretsiz "Risk Skoru Rozeti" Lead Magnet Aracı

## Replit Agent'a Ver

---

## BAĞLAM (Replit Agent için değil, sana not)

Bu prompt iki ayrı esinlenmeden geliyor:

1. **SecurityScorecard'ın Chrome eklentisi** — ziyaret ettiğiniz her
   web sitesi için anında bir A-F harf notu gösteren tarayıcı eklentisi;
   tıklandığında SecurityScorecard'ın halka açık rapor sayfasına gider.
2. **Shodan/Censys modeli** — "tek işi iyi yapan, ücretsiz/herkese açık
   bir arama/sorgu aracı" organik trafik ve marka bilinirliği yaratıyor,
   ücretli derinlemesine analiz ayrı bir kapıdan satılıyor.

CyberStep'in mevcut micro-tool hub'ı (4 ücretsiz araç) zaten bu
yöndedir. Bu prompt, bunlardan birini veya yeni bir aracı, **"herkese
açık, anlık, paylaşılabilir bir skor"** etrafında yeniden çerçeveleyerek
organik/viral yayılım potansiyelini artırmayı hedefler.

---

## ÖNCE KONTROL ET — HENÜZ DEĞİŞİKLİK YAPMA

```
Aşağıdakileri kontrol et ve bana rapor ver, HENÜZ DEĞİŞİKLİK YAPMA:

1. Mevcut micro-tool hub'daki 4 ücretsiz aracı listele — her birinin
   route'u, ne yaptığı, ne kadar süre/kaynak harcadığı (örn. tam tarama
   mı, hafif bir kontrol mü).

2. Bu araçlardan herhangi biri zaten bir "skor" veya "puan" üretiyor mu?
   (0-100 risk skoru, A-F harf notu vb.) Hangi dosyada, nasıl hesaplanıyor?

3. Üretilen sonuç için paylaşılabilir bir public URL/sayfa var mı?
   (örn. `/scan-result/:id` gibi, kimlik doğrulama gerektirmeyen)

4. Mevcut rate-limiting/abuse koruması var mı bu ücretsiz araçlarda?
   (Çünkü bu prompt sonucunda araç viral olursa trafik artabilir.)

5. Sosyal medya görsel üretim altyapısı (LinkedIn/Instagram post
   görselleri üreten kod) hangi dosyada — bu, "paylaşılabilir rozet
   görseli" üretmek için yeniden kullanılabilir mi?

Bu bilgileri özetle, ardından devam talimatını bekle.
```

---

## GENEL KURALLAR

- Mevcut micro-tool hub'ı ve scoring mantığını BOZMA — bu prompt,
  üzerine bir "paylaşılabilir sonuç sayfası + rozet" katmanı ekler.
- Marka paleti: #060D1A, #00C8FF, #F5A623, #E8EDF5.
- Rate-limiting ŞART — public, kimlik doğrulamasız bir endpoint
  kötüye kullanılabilir (örn. başkasının domain'ini sürekli tarama).

---

## BÖLÜM 1 — PAYLAŞILABİLİR SONUÇ SAYFASI

### Amaç
Mevcut ücretsiz araçlardan birinin (en uygun olanı — BÖLÜM ÖNCESİ
kontrolünde belirlenecek, muhtemelen halihazırda bir skor üreten araç)
sonucu için, kalıcı ve paylaşılabilir bir public URL oluştur:

```
https://cyberstep.io/sonuc/:resultId
```

Bu sayfa:
- Domain adını ve skoru gösterir (SecurityScorecard'ın A-F harf notuna
  benzer şekilde, basit bir görsel — CyberStep'in 0-100 skalasını
  harfe çevirebilirsin: 80-100 = A, 60-79 = B, 40-59 = C, 20-39 = D,
  0-19 = F)
- "Bu skor neyi gösteriyor?" kısa açıklaması
- CTA: "Kendi domain'inizi ücretsiz tarayın" (micro-tool hub'a link)
- Open Graph / Twitter Card meta tag'leri — sosyal medyada paylaşıldığında
  güzel bir önizleme görünmesi için (görsel + başlık + açıklama)

### Veri Modeli

```sql
ALTER TABLE <scan_results_tablosu>
  ADD COLUMN IF NOT EXISTS public_result_id text UNIQUE,  -- nanoid veya benzeri, tahmin edilemez
  ADD COLUMN IF NOT EXISTS is_publicly_shared boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS letter_grade text;  -- 'A' | 'B' | 'C' | 'D' | 'F'
```

`public_result_id`, kullanıcı tarama sonucunu paylaşmayı seçtiğinde
üretilsin (varsayılan olarak paylaşılmasın — kullanıcı onayı gerekir,
"Sonucumu Paylaş" butonuna basınca `is_publicly_shared = true` olur ve
ID üretilir).

```typescript
function calculateLetterGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}
```

---

## BÖLÜM 2 — PAYLAŞILABİLİR ROZET GÖRSELİ

### Amaç
Her sonuç sayfası için, sosyal medyada paylaşılabilecek bir görsel
(1200x630px — standart OG image boyutu) otomatik üret. Bu görsel:

```
┌─────────────────────────────────────┐
│  [CyberStep logo]                    │
│                                       │
│        example.com                   │
│                                       │
│         ┌─────┐                      │
│         │  B  │   ← büyük harf notu  │
│         └─────┘                      │
│                                       │
│   Siber Güvenlik Skoru: 72/100       │
│                                       │
│   cyberstep.io ile ücretsiz tarayın  │
└─────────────────────────────────────┘
```

Tasarım: #060D1A zemin, harf notu rengi skora göre değişsin (A/B =
#00C8FF cyan, C = #F5A623 amber, D/F = kırmızı tonu — mevcut risk
renk kodlamasıyla tutarlı olsun, varsa).

Mevcut görsel üretim altyapısını (sosyal medya post görselleri için
kullanılan — Sharp, Canvas, veya benzeri) yeniden kullan. Yeni bir
kütüphane ekleme.

Görsel, `/api/og-image/:resultId` endpoint'inden dinamik olarak
üretilsin (veya üretilip cache'lensin — tercih sana göre, ama her
istek için yeniden render etmek maliyetli olabilir, bir kere üretip
saklamak daha iyi).

---

## BÖLÜM 3 — RATE LIMITING VE KÖTÜYE KULLANIM KORUMASI

### Amaç
Public, kimlik doğrulamasız tarama endpoint'i için:

```typescript
// Aynı IP'den günde maksimum N tarama (örn. 5)
// Aynı domain için son 24 saatte zaten taranmışsa, yeni tarama yerine
// önbellekteki sonucu döndür (kaynak tasarrufu + tutarlılık)
```

Eğer mevcut araçlarda zaten bir rate-limiting middleware'i varsa, onu
bu endpoint'e de uygula. Yoksa basit bir IP-bazlı sayaç ekle (Redis
varsa onu kullan, yoksa basit bir DB tablosu):

```sql
CREATE TABLE IF NOT EXISTS public_scan_rate_limits (
  ip_address text NOT NULL,
  scan_date date NOT NULL,
  scan_count integer DEFAULT 1,
  PRIMARY KEY (ip_address, scan_date)
);
```

---

## BÖLÜM 4 — "KENDİ SİTENİZİ TARAYIN" CTA AKIŞI

### Amaç
Sonuç sayfasındaki "Kendi domain'inizi ücretsiz tarayın" CTA'sı,
ziyaretçiyi mevcut lead-generation akışına (teaser/lead_candidates
tablosuna kayıt) yönlendirsin — bu, viral paylaşımdan gelen organik
trafiği mevcut satış hunisine bağlar.

Eğer mevcut micro-tool hub zaten bu akışa sahipse (kullanıcı domain
girer → tarama başlar → sonuç + teaser e-posta), bu bölüm sadece "giriş
noktası" ekler — CTA'dan gelen kullanıcılar aynı akışa düşer, ekstra
bir şey yapılmasına gerek yok. Eğer ayrı bir akışsa, mevcut akışa
yönlendir, yeni bir akış icat etme.

---

## TEST

1. Build:
   ```
   pnpm --filter @workspace/api-server run build
   ```

2. Bir test domain için tarama yap, "Sonucumu Paylaş" butonuna bas,
   `public_result_id` üretildiğini doğrula:
   ```sql
   SELECT public_result_id, is_publicly_shared, letter_grade
   FROM <scan_results_tablosu> WHERE domain = '<test_domain>';
   ```

3. `/sonuc/<public_result_id>` sayfasını tarayıcıda aç:
   - Harf notu, skor, domain adı doğru görünüyor mu?
   - OG meta tag'leri doğru mu? (Facebook/LinkedIn debugger ile test
     edilebilir, veya `curl` ile `<head>` içeriğini kontrol et)

4. `/api/og-image/<public_result_id>` görselini tarayıcıda aç, görsel
   marka paletine uygun mu, doğru harf notu/skor görünüyor mu?

5. Rate limiting testi: aynı IP'den arka arkaya birkaç tarama isteği
   gönder, limit aşıldığında doğru hata mesajı dönüyor mu?

6. "Kendi domain'inizi tarayın" CTA'sına tıkla, mevcut lead akışına
   doğru yönlendiriyor mu?

7. git commit && git push.

---

## NOT — GİZLİLİK

`is_publicly_shared = false` (varsayılan) olan sonuçlar ASLA
`/sonuc/:id` üzerinden erişilebilir olmamalı — kullanıcı paylaşmayı
seçmediyse, ID tahmin edilse bile sonuç gösterilmemeli (404 dönsün).
Bu, bir şirketin kendi rızası olmadan skorunun internette görünmesini
engeller.
