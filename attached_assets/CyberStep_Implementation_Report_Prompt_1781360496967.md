# CyberStep — Uygulama Raporu Hazırlama Talebi

## Replit Agent'a Ver

---

## AMAÇ

Son uygulanan iki prompt seti tamamlandı:

- **A — Detectify-Inspired Prompt** (Asset Classification, WAF/Confidence
  Durum Rozeti, Tarama Önceliklendirme)
- **B — Intruder-Inspired Prompt** (Güven Rozeti, Acil Tehdit Bildirimi,
  AI Analist Markalaması, Bayi/İş Ortaklığı Sayfası)

Bu özelliklerin gerçekte ne kadarının, hangi şekilde, hangi isimlerle
uygulandığını netleştirmek gerekiyor — bu prompt'lar "kendi şemana uydur"
talimatı içerdiğinden, gerçek implementasyon orijinal taslaktan farklılaşmış
olabilir. Aşağıdaki raporu hazırla.

---

## YAPILACAKLAR

### 1. Kod Tabanını Tara

Aşağıdaki konularla ilgili son commit'leri/değişiklikleri incele
(git log, değişen dosyalar, migration'lar):

```
git log --oneline -30
```

Her bölüm için hangi dosyalarda değişiklik yapıldığını listele.

### 2. Her Özellik İçin Aşağıdaki Bilgileri Topla

**A1 — Asset Classification**
- Hangi tabloya hangi kolonlar eklendi? (gerçek isimler — `asset_classification`
  yerine farklı bir isim kullanıldıysa onu yazsın)
- `classifyAsset()` fonksiyonu nerede, hangi kategori isimleri kullanılıyor?
- Lead detay modalındaki özet kutusu hangi dosyada, nasıl görünüyor?
- Teaser'a eklenen "X dijital varlık tespit edildi" cümlesi uygulandı mı,
  hangi koşulla tetikleniyor?

**A2 — WAF/Confidence Durum Rozeti**
- Rozet mantığı (`getScanConfidenceBadge` veya eşdeğeri) hangi dosyada?
- Hangi renk/etiket kombinasyonları kullanılıyor (gerçek metinler)?
- Lead listesinde mi, detay modalında mı, ikisinde de mi gösteriliyor?

**A3 — Tarama Önceliklendirme**
- `priority_score` / `priority_reason` (veya eşdeğer isimler) hangi
  tabloda, nasıl hesaplanıyor (gerçek kriterler — login formu, CMS,
  API tespiti vb. hangileri uygulandı)?
- Admin panelde "Öncelikli İnceleme Önerileri" listesi var mı, nerede
  görünüyor?

**B1 — Güven Rozeti**
- `badge_token`, `badge_enabled`, `badge_impression_count` (veya eşdeğer)
  hangi tabloda?
- `/api/badge/:token` endpoint'i çalışıyor mu, gerçek route neresi?
- Müşteri hesap sayfasında "Güven Rozeti" bölümü hangi dosyada, embed
  kodu nasıl görünüyor (gerçek HTML/SVG çıktısını al)?
- Hangi müşteri segmentine gösteriliyor (sadece ücretli mi)?

**B2 — Acil Tehdit Bildirimi**
- `emerging_threat_alerts` tablosu (veya eşdeğeri) oluşturuldu mu, şeması?
- CVE eşleştirme cron'u hangi dosyada, hangi cron grubuna eklendi?
- Bu özellik uygulandı mı yoksa "önkoşul yok" diyerek atlandı mı?
  (CVE/customer_tech_stack altyapısı yetersizse atlanmış olabilir)
- HITL onay kuyruğu admin panelde nerede görünüyor?

**B3 — AI Analist Markalaması**
- Hangi isim seçildi (Adım / Step AI / CyberStep Analist / başka)?
- Bu isim teaser, PDF, admin panelin hangilerinde kullanılıyor —
  gerçek örnek metinleri al (örn. teaser'daki imza cümlesi).
- Görsel ikon/kimlik oluşturuldu mu, nerede?

**B4 — Bayi/İş Ortaklığı Sayfası**
- Hangi route'ta yayında? (`/is-ortakligi`, `/partner` veya başka)
- Sayfanın gerçek başlık/CTA metinleri nedir (taslaktan değişmiş olabilir)?
- Form submit akışı nereye kaydediyor, `inquiry_type` ayrımı yapıldı mı?
- Navbar'a link eklendi mi?

### 3. Uygulanmayan / Kısmen Uygulanan Kısımları Belirt

Her iki prompt'ta da "önkoşul yoksa atla" veya "zaman kısıtlıysa öncelik
sırası" notları vardı. Hangi alt-bölümler:
- Tam uygulandı
- Kısmen uygulandı (neden, ne eksik)
- Hiç uygulanmadı (neden — önkoşul mu yoktu, yoksa zaman mı kalmadı)

### 4. Test Durumu

Her iki prompt'un sonunda tanımlı TEST adımları çalıştırıldı mı?
Hangi test domain'i/müşteri ile test edildi, sonuçlar ne oldu?
Regresyon testi (eski lead'ler için) yapıldı mı, sorun çıktı mı?

---

## ÇIKTI FORMATI

Yukarıdaki bilgileri, aşağıdaki yapıda bir Markdown dosyası olarak
oluştur:

```
/docs/implementation-reports/2026-06-detectify-intruder-features.md
```

(Eğer `/docs` klasörü yoksa, projenin kök dizininde uygun bir konuma
— mevcut dokümantasyon konvansiyonuna uy.)

Dosya yapısı:

```markdown
# Uygulama Raporu: Detectify & Intruder Esinli Özellikler
Tarih: <bugünün tarihi>
Uygulayan: Replit Agent

## Özet
[2-3 cümle: toplam kaç bölüm uygulandı, genel durum]

## A — Detectify-Inspired Özellikler

### A1 — Asset Classification
**Durum**: ✅ Tam / 🟡 Kısmi / ❌ Uygulanmadı
**Değişen dosyalar**: ...
**Şema değişiklikleri**: ...
**Davranış**: [gerçek örnek çıktı/ekran açıklaması]
**Notlar**: [orijinal taslaktan farklar, varsa]

### A2 — WAF/Confidence Durum Rozeti
[aynı format]

### A3 — Tarama Önceliklendirme
[aynı format]

## B — Intruder-Inspired Özellikler

### B1 — Güven Rozeti
[aynı format]

### B2 — Acil Tehdit Bildirimi
[aynı format]

### B3 — AI Analist Markalaması
[aynı format]

### B4 — Bayi/İş Ortaklığı Sayfası
[aynı format]

## Test Sonuçları
[hangi domain/müşteri ile test edildi, sonuçlar]

## Bilinen Eksikler / Sonraki Adımlar
[uygulanmayan kısımlar, önerilen takip]

## Veritabanı Şema Özeti (Bu Oturumda Eklenen Tüm Kolonlar/Tablolar)
[tek bir konsolide liste — ileride referans için]
```

---

## KURALLAR

- Bu rapor SADECE dokümantasyon amaçlıdır — kod değişikliği YAPMA.
- Gerçek dosya yollarını, gerçek tablo/kolon isimlerini, gerçek
  fonksiyon imzalarını kullan — taslak prompt'lardaki örnek isimleri
  KOPYALAMA, sadece gerçekten ne uygulandıysa onu yaz.
- Mümkünse her özellik için 1 kısa ekran görüntüsü tarifi veya örnek
  veri çıktısı (örn. bir SQL sorgusu sonucu) ekle — sözel açıklama
  yerine kanıt.
- Rapor tamamlandığında dosya yolunu ve `git commit` durumunu bildir.
