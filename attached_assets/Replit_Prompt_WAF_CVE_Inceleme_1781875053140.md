# GÖREV: WAF Arkasındaki CVE Eşleşmelerinin Doğruluğunu Sorgula (SADECE İNCELEME — KOD DEĞİŞİKLİĞİ YAPMA)

## Amaç

Mevcut mimaride bir potansiyel doğruluk sorununu araştırıyoruz: WAF (Web Application Firewall) tespit edilen domain'lerde, CVE eşleşmelerinin bir kısmı pratikte istismar edilemiyor olabilir (WAF zaten blokluyor olabilir), ya da tam tersi — WAF'ın kapsamadığı bir katmandaki (örn. ağ seviyesi, SSH, doğrudan TCP) CVE'ler hâlâ tam risk taşıyor olabilir ve bunlar yanlışlıkla "WAF var, daha güvenli" algısıyla hafife alınıyor olabilir.

**Bu bir geliştirme görevi DEĞİL.** Hiçbir dosyayı değiştirme, hiçbir migration çalıştırma, hiçbir kod satırı yazma. Sadece mevcut veritabanını ve kod tabanını sorgulayıp aşağıdaki soruların cevaplarını bir rapor halinde sun.

---

## ARAŞTIRMA SORULARI

### 1. Mevcut WAF tespiti nasıl çalışıyor?

- `domain_scans` tablosundaki `waf_detected` alanı nasıl dolduruluyor? Hangi sinyallerle tespit ediliyor (HTTP header, davranışsal test, bilinen WAF imzaları)?
- `waf_detected` boolean mı, yoksa hangi WAF ürünü olduğunu (Cloudflare, Akamai, AWS WAF vb.) da kaydeden bir alan var mı?
- Bu alanın doluluk oranı ne? (`SELECT COUNT(*) FILTER (WHERE waf_detected IS NOT NULL) * 100.0 / COUNT(*) FROM domain_scans` gibi bir sorguyla kontrol et)

### 2. CVE eşleştirme mantığı WAF durumunu hiç dikkate alıyor mu?

- `cve_domain_matches` tablosunun şemasını incele. WAF varlığıyla ilgili herhangi bir alan, flag, veya not içeriyor mu?
- CVE eşleştirme kodunu (muhtemelen `cve_domain_matches` tablosunu dolduran fonksiyon/servis) bul ve oku. Eşleştirme sadece banner/versiyon bilgisine mi dayanıyor, yoksa WAF tespitini herhangi bir şekilde girdi olarak kullanıyor mu?
- Şu an CVE skoru/önceliklendirmesi (Domain Risk Score'a katkısı) hesaplanırken `waf_detected` alanı formülde herhangi bir yerde referans alınıyor mu? (Domain Risk Score hesaplama fonksiyonunu bul ve bu çapraz referansı ara.)

### 3. Hangi CVE'ler "WAF katmanında" hangileri "WAF katmanı dışında" sınıflandırılabilir?

Mevcut `cve_domain_matches` verisinde, kayıtlı CVE'leri CWE (Common Weakness Enumeration) kategorisine veya bilinen zafiyet tipine göre incelemen mümkünse:

- Kaç tanesi tipik olarak HTTP/web katmanında istismar edilen türden (örn. path traversal, SQL injection, XSS, SSRF — WAF'ın teorik olarak kapsama alanına giren)?
- Kaç tanesi ağ/protokol seviyesinde istismar edilen türden (örn. SSH, RDP, doğrudan TCP servis zafiyetleri — WAF'ın kapsamadığı)?
- Bu ayrımı yapabilmek için mevcut veride CWE ID veya zafiyet kategorisi bilgisi tutuluyor mu, yoksa sadece ham CVE ID mi var?

### 4. WAF tespit edilen domainlerde mevcut skor dağılımı nasıl?

Şu sorguyu (veya mantıksal eşdeğerini) çalıştırıp sonucu raporla:

```sql
SELECT
  waf_detected,
  COUNT(*) AS domain_sayisi,
  ROUND(AVG(overall_score), 1) AS ortalama_skor,
  COUNT(*) FILTER (WHERE overall_score < 60) AS dusuk_skorlu_sayisi
FROM domain_scans
GROUP BY waf_detected;
```

Amaç: WAF tespit edilen domainlerin ortalama skoru, WAF tespit edilmeyenlere göre belirgin şekilde farklı mı? Eğer fark yoksa, bu WAF'ın skor formülünde hiç etkisi olmadığının bir göstergesi olabilir (mevcut durumun doğrulanması).

### 5. WAF + Kritik CVE kesişimindeki domain sayısı nedir?

```sql
SELECT COUNT(DISTINCT ds.id) AS etkilenen_domain_sayisi
FROM domain_scans ds
JOIN cve_domain_matches cdm ON cdm.domain_scan_id = ds.id
WHERE ds.waf_detected = true
  AND cdm.severity IN ('CRITICAL', 'HIGH'); -- gerçek alan/değer adlarını şemaya göre uyarla
```

Bu, sorunun gerçek ölçeğini gösterir — eğer kesişim çok küçükse (örn. 5 domain), bu düşük öncelikli bir iyileştirme; büyükse (yüzlerce domain), önceliklendirilmesi gereken bir konu.

### 6. Mevcut PDF raporlarında veya UI'da WAF/CVE ilişkisi hakkında herhangi bir açıklayıcı not var mı?

- Vendor risk kartı, teknik bulgu raporu veya benzeri çıktılarda, bir CVE'nin yanında "WAF arkasında" gibi bir bağlamsal not gösteriliyor mu?
- Yoksa bu bilgi hiç kullanıcıya/müşteriye yansıtılmıyor mu?

---

## BEKLENEN ÇIKTI FORMATI

Lütfen bulgularını şu yapıda bir özet rapor halinde sun (markdown, dosya olarak kaydetme — sadece yanıt olarak yaz):

```
## WAF/CVE Çapraz Referans — Mevcut Durum Analizi

### 1. WAF Tespit Mekanizması
[bulgular]

### 2. CVE Eşleştirmede WAF Kullanımı
[bulgular — şu an entegre mi, değil mi, net cevap]

### 3. CVE Kategori Dağılımı (Web Katmanı vs Ağ Katmanı)
[bulgular, eğer kategori verisi mevcutsa; mevcut değilse bunu açıkça belirt]

### 4. Skor Dağılımı Karşılaştırması
[sorgu sonucu + yorum]

### 5. Etkilenen Domain Ölçeği
[sayı + bağlam]

### 6. Mevcut Kullanıcı Arayüzü/Rapor Yansıması
[var/yok]

### Genel Değerlendirme
[2-3 cümlelik özet: sorun gerçek mi, ölçeği ne, mevcut mimaride bunu
çözmek için hangi tabloya/fonksiyona dokunulması gerekirdi — SADECE
TESPİT, AKSİYON ÖNERME, KOD YAZMA]
```

---

## KESİN SINIRLAR (TEKRAR VURGU)

- ❌ Hiçbir dosyayı düzenleme
- ❌ Hiçbir veritabanı migration'ı çalıştırma
- ❌ Hiçbir yeni alan/tablo ekleme
- ❌ Hiçbir fonksiyonu değiştirme
- ✅ Sadece oku, sorgula, raporla
- ✅ Belirsiz veya eksik veri durumunda "bu bilgi mevcut değil" diye açıkça belirt, varsayım yapma
