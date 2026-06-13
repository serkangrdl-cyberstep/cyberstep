# CyberStep — Certstream Pipeline ve Lead Kalifikasyon Durum Tespiti

Bu bir KOD DEĞİŞİKLİĞİ görevi DEĞİL — sadece bilgi toplama / durum tespiti. Aşağıdaki soruların her birine, ilgili kod dosyalarını okuyarak ve gerekirse veritabanı sorguları çalıştırarak cevap ver. Amaç: Certstream → kalifikasyon → lead pipeline akışının mevcut mimarisini netleştirmek, "otorite/envanter" stratejisi için yol haritası tasarlamak.

Cevapları bu sırayla, başlıklar halinde rapor et. Kod değiştirme, sadece oku ve raporla.

---

## 1. Certstream Veri Girişi (Intake)

- Certstream'den gelen ham domain bilgisi nereye yazılıyor — hangi tablo(lar)? Şema/kolon listesini göster (`\d tablo_adi` veya Drizzle schema dosyası)
- Bir domain ilk göründüğünde hangi alanlar dolduruluyor: sadece domain adı mı, yoksa ilk görülme tarihi, sertifika bilgisi (issuer, SAN'lar), kaynak (`certstream` vs `crtsh_batch`) gibi meta veri de var mı?
- Günlük/haftalık ne kadar yeni domain ekleniyor — son 7 günün günlük sayılarını sorgula (`SELECT DATE(created_at), COUNT(*) FROM <tablo> WHERE source='certstream' GROUP BY 1 ORDER BY 1 DESC LIMIT 7`)
- Duplicate kontrolü var mı — aynı domain birden fazla kez Certstream'den geçerse (yeni sertifika, subdomain değişikliği vb.) tekrar mı ekleniyor, yoksa upsert/dedup mantığı mı var?

## 2. Kalifikasyon Cron — Mevcut Mantık

- Kalifikasyon cron'unun dosya yolunu ve `wrapCron` kaydını bul, tam fonksiyonu göster
- Bu cron hangi tabloyu/durumu okuyor (örn. `status='new'` veya `qualified=NULL` gibi bir filtre var mı)?
- Kalifikasyon sırasında HANGİ kontroller/sorgular çalışıyor — listele (örn. sadece DNS/MX kaydı var mı kontrolü, SPF/DMARC kontrolü, WHOIS, başka bir şey?)
- Bu kontroller hangi dış kaynaklara gidiyor (kendi DNS sorgusu mu, yoksa Shodan/crt.sh/RIPE gibi OSINT zincirine mi giriyor)?
- Kalifikasyon SONUCU nereye yazılıyor — domain kaydı güncelleniyor mu (örn. `status='qualified'`), yoksa ayrı bir `leads` tablosuna mı yeni satır ekleniyor?
- Kalifikasyon eşiği/kriteri nedir — kod içinde sabit bir skor/koşul var mı (örn. "overallScore < 60" gibi mevcut MITRE eşiklerine benzer bir şey)?

## 3. Hacim ve Performans — Mevcut Darboğazlar

- Son 7 günde kaç domain Certstream'den geldi, kaçı kalifikasyon cron'undan geçti, kaçı "kalifiye lead" olarak işaretlendi? (3 ayrı sayı — dönüşüm oranını görmek için)
  ```sql
  SELECT 
    (SELECT COUNT(*) FROM <certstream_tablosu> WHERE created_at > NOW() - INTERVAL '7 days') as toplam_domain,
    (SELECT COUNT(*) FROM <certstream_tablosu> WHERE created_at > NOW() - INTERVAL '7 days' AND <kalifikasyon_durumu_kolonu> IS NOT NULL) as kalifikasyon_calisti,
    (SELECT COUNT(*) FROM <leads_tablosu> WHERE created_at > NOW() - INTERVAL '7 days') as kalifiye_lead;
  ```
- Kalifikasyon cron'unun ortalama çalışma süresi ne — `cron_job_runs` tablosunda bu job için son 7 günün `duration` değerlerini sorgula
- Cron, bir çalıştırmada KAÇ domain işliyor — sabit bir batch limiti var mı (örn. `LIMIT 500`)? Eğer birikim hızı bu limitin üzerindeyse, kuyruk birikiyor mu?
- Backlog var mı — kalifikasyon bekleyen (henüz işlenmemiş) domain sayısı şu an kaç?

## 4. Dış Kaynak Kullanımı ve Rate Limit Riski

- Kalifikasyon adımı sırasında çağrılan her dış API/servis için (Shodan, crt.sh, RIPE, VirusTotal, AbuseIPDB, USOM, HIBP, Censys, Wayback varsa) günlük/aylık rate limit veya quota bilgisi kodda/yorumlarda belirtilmiş mi?
- Bu kaynaklardan hangileri kalifikasyon adımında (her domain için), hangileri sadece "kalifiye" olduktan SONRA (daha az sayıda domain için) çağrılıyor? Bu ayrım kodda net mi?

## 5. Mevcut Domain Envanterinin Büyüklüğü ve Dağılımı

- Şu an toplamda kaç domain Certstream kaynağından DB'de kayıtlı? (`SELECT COUNT(*) FROM <tablo> WHERE source='certstream'`)
- Bu domainlerin durum dağılımı ne (kalifiye / kalifiye değil / işlenmemiş) — `GROUP BY` ile sayıları göster
- Hiç DNS/temel kontrol yapılmamış (tamamen "ham", sadece domain adı bilinen) domain sayısı kaç?

## 6. Veri Modelinde "Katmanlı Tarama" İçin Hazırlık

- Domain tablosunda, bir domain'in "son ne zaman tarandığı" (`last_scanned_at` benzeri) veya "tarama önceliği/seviyesi" gibi bir alan var mı? Yoksa böyle bir alan eklemek migration gerektirir mi (kolon ekleme — ALTER TABLE seviyesinde, basit mi karmaşık mı)?
- Mevcut şemada, bir domain'in "Tier 1 (müşteri/lead) / Tier 2 (izleniyor) / Tier 3 (ham envanter)" gibi bir sınıflandırmaya uygun bir alan (örn. `tier`, `priority`, `category`) var mı, yoksa bu kavramsal olarak yeni mi?

---

## ÇIKTI

Yukarıdaki 6 bölümü ayrı başlıklar halinde, kod referansları (dosya:satır) ve sorgu sonuçlarıyla birlikte raporla. Eğer bir soruya kodda net cevap bulunamıyorsa "kodda bu bilgi yok / belirsiz" yaz, tahmin etme. Rapor sonunda, "Katmanlı Tarama Mimarisi İçin Mevcut Altyapı Hazırlığı" başlığıyla 1 paragraf özet değerlendirme ekle: şu an eklenmesi gereken minimum şema değişikliği ne olurdu (varsa).
