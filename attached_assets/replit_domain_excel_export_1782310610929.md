# Replit Agent Prompt — Domain Listesi Excel Export

---

## Görev

Admin Panel → Lead Discovery → Sonuçlar sayfasında listelenen domain kayıtlarını (prod'da şu an 31.167 adet) Excel'e export eden bir özellik geliştir.

---

## İstenen Özellik

### 1. Export Butonu

`/admin/lead-discovery` veya sonuçların listelendiği sayfaya bir **"Excel'e Aktar"** butonu ekle. Buton sayfanın sağ üst köşesinde, mevcut filtreler korunarak çalışsın.

### 2. Export Edilecek Kolonlar

Aşağıdaki kolonları bu sırayla Excel'e yaz:

Aşağıdaki hedef kolonları, keşif adımında bulduğun **gerçek kolon adlarıyla** eşleştir. Karşılığı yoksa o kolonu atla, hata verme.

| Hedef Kolon (Excel) | Hedef Bilgi | Olası Kaynak |
|---|---|---|
| Domain | Alan adı | `domains` tablosu |
| IP Adresi | Son tespit edilen IP | `domains` veya `domain_scans` |
| Risk Skoru | 0-100 arası son skor | `domain_scans` |
| Risk Seviyesi | critical / high / medium / low | `domain_scans` |
| Durum | active / inactive / unknown | `domains` |
| Kayıt Tarihi | İlk keşif tarihi | `domains.created_at` |
| Son Tarama | En son tarama tarihi | `domain_scans` |
| Ülke | GeoIP ülke kodu | `domains` |
| Şehir | GeoIP şehir | `domains` |
| Sektör | Sektör bilgisi | `domains` veya `companies` — varsa |
| Şirket Adı | Eşleşen şirket adı | `companies` — tablo varsa |
| Açık Port Sayısı | Tespit edilen açık port adedi | `domain_scans` |
| CVE Sayısı | Tespit edilen CVE adedi | `domain_scans` |
| WAF Tespit | true / false | `domain_scans` |
| Kaynak | certstream / crtsh / import / manual | `domains` |

> **Kural:** Kolon mevcut değilse veya NULL ise Excel'de boş bırak, hata fırlatma. Keşif sonucunda hangi kolonların eşleştiğini, hangilerinin atlandığını geliştirme öncesi özetle.

### 3. Filtreleme

Export butonu **mevcut aktif filtreleri** dikkate alsın:
- Risk seviyesi filtresi seçiliyse sadece o seviyeyi export et
- Arama/search aktifse sadece filtrelenmiş sonuçları al
- Filtre yoksa tüm 31.167 kaydı export et

### 4. Backend API Endpoint

```
GET /api/admin/domains/export
Query params:
  - format=xlsx (zorunlu)
  - riskLevel=critical|high|medium|low (opsiyonel)
  - search=string (opsiyonel)
  - limit=50000 (max, default tümü)
```

Response: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
Content-Disposition: `attachment; filename="cyberstep_domains_YYYY-MM-DD.xlsx"`

### 5. Excel Formatı

- **Kütüphane:** `exceljs` (zaten kullanılıyorsa) veya `xlsx`
- **Sheet adı:** "Domains"
- **Header satırı:** Bold, arka plan rengi `#0E1A2E`, font rengi `#00C8FF`
- **Satır yüksekliği:** 18px
- **Kolon genişliği:** İçeriğe göre auto-fit (min 12, max 40 karakter)
- **Freeze:** İlk satır (header) dondurulsun
- **Risk Seviyesi renk kodlaması:**
  - critical → `#FF4444` kırmızı arka plan
  - high → `#FF8C00` turuncu
  - medium → `#F5A623` sarı
  - low → `#00C8FF` mavi
- **Tarih formatı:** `DD.MM.YYYY HH:mm` (Türkiye formatı)

### 6. Büyük Veri Performansı

31K+ kayıt için:
- Stream-based yazma kullan (exceljs streaming API)
- Veritabanı sorgusunu paginate et (1000'er kayıt batch)
- Timeout: 120 saniye
- Frontend'de loading spinner + "X kayıt hazırlanıyor..." mesajı göster
- Export tamamlanınca otomatik download başlasın

### 7. Hata Yönetimi

- Export 30 saniyeyi aşarsa frontend'e "işlem devam ediyor" mesajı ver
- Veritabanı hatasında 500 dön, frontend toast notification göster
- Boş sonuç setinde "Export edilecek kayıt bulunamadı" uyarısı ver

---

## Başlamadan Önce — Keşif Adımları

Geliştirmeye başlamadan önce aşağıdakileri kontrol et ve bana rapor et:

### 1. Veritabanı Şeması Kontrolü

Şu tabloların gerçek kolon adlarını listele:
- `domains` tablosu — tüm kolonlar
- `domain_scans` tablosu — tüm kolonlar
- `companies` tablosu — var mı, varsa kolonlar

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('domains', 'domain_scans', 'companies')
ORDER BY table_name, ordinal_position;
```

### 2. Kayıt Sayısı & Veri Kalitesi Kontrolü

```sql
-- Toplam domain sayısı
SELECT COUNT(*) FROM domains;

-- Taranmış domain sayısı (en az 1 scan'i olan)
SELECT COUNT(DISTINCT domain_id) FROM domain_scans;

-- Sektör bilgisi dolu olan domain sayısı
SELECT COUNT(*) FROM domains WHERE sector IS NOT NULL AND sector != '';

-- Risk skoru dağılımı
SELECT risk_level, COUNT(*) 
FROM domain_scans ds
WHERE scanned_at = (SELECT MAX(scanned_at) FROM domain_scans WHERE domain_id = ds.domain_id)
GROUP BY risk_level;
```

### 3. Mevcut Paket Kontrolü

`package.json`'a bak — `exceljs` veya `xlsx` yüklü mü?

### 4. Admin Panel Rotası

`/admin/lead-discovery` sayfasının frontend dosyası ve mevcut API endpoint'i nerede? Mevcut listeleme query'si nasıl çalışıyor?

---

## Keşif Sonucuna Göre Geliştir

Yukarıdaki kontrollerin sonuçlarına göre:

- Kolon adları farklıysa → gerçek adları kullan, prompt'taki tablo sadece hedefi gösteriyor
- `companies` tablosu yoksa → o join'i atla
- `sector` kolonu `domains`'de değil başka tablodaysa → doğru tablodan al
- Excel kütüphanesi yoksa → `exceljs` yükle (`npm install exceljs`)
- Taranmış domain sayısı 31K'dan azsa → sadece scan'i olan domain'leri export et, header'da "X taranmış domain" yaz

---

## Teknik Notlar

- Auth: Mevcut admin middleware'i kullan, yetkisiz erişime izin verme
- ORM: Drizzle ORM ile mevcut tabloları join et — gerçek şemaya göre
- `domain_scans` tablosundan her domain için **en son scan'i** al
- Geliştirme öncesi keşif bulgularını özetle, sonra koda geç

---

## Test

Geliştirme tamamlandıktan sonra:
1. 100 kayıtlık test export yap, kolonları kontrol et
2. Filtreli export test et (sadece critical)
3. Tüm kayıtları export et, dosya boyutu ve süreyi logla
4. Excel dosyasını aç, Türkçe karakter sorunu olmadığını doğrula

---

*CyberStep Admin Panel — Domain Export Feature v1.0*
