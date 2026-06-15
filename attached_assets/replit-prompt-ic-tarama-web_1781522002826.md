# CyberStep — İç Tarama: Durum Tespiti + Web Sitesi Entegrasyonu
## Replit Agent Promptu

---

## ADIM 1 — MEVCUT DURUMU TESPİT ET

Önce şunları bul ve özetle. Kod yazmadan önce bu analizi tamamla.

### 1a. İç Tarama Ekranları — Nerede Ne Var?

Şu dosyaları bul ve hangi UI bileşenlerini içerdiğini oku:

- `ic-tarama.tsx` veya `internal-scan` içeren tüm frontend dosyaları
- `/hesabim/` altındaki tüm sayfalar
- Müşteri dashboard bileşenleri

Her dosya için şunları tespit et:
- Hangi sekme veya bölümler var
- Hangi veriler gösteriliyor
- Hangi butonlar var (Script İndir, Rapor Üret vb.)
- Eksik veya yarım kalan bölüm var mı

### 1b. Admin / ISR Paneli — Nerede Ne Var?

- `/panel/admin` veya `/panel/isr` altında iç tarama ile ilgili ne var
- AI raporu admin tarafında görünüyor mu
- Fortinet verisi admin panelinde var mı

### 1c. Web Sitesi — Şu An Ne Var?

Ana web sitesi dosyalarını bul (landing page, hizmetler sayfası vb.):
- `index.tsx`, `landing.tsx`, `home.tsx` veya benzeri
- `hizmetler.tsx`, `services.tsx`, `packages.tsx` veya benzeri
- `pricing.tsx`, `fiyatlar.tsx` veya benzeri

Her dosyada şunları kontrol et:
- İç tarama / internal scan'den bahsediliyor mu
- vCISO hizmetinden bahsediliyor mu
- AI öneri motorundan bahsediliyor mu
- Fortinet entegrasyonundan bahsediliyor mu
- Paket içerikleri güncel mi (Kalkan, Zırh, vCISO paketleri)

### 1d. Tespitleri Özetle

Analiz tamamlandıktan sonra şu formatta özetle:

```
MEVCUT DURUM:

Müşteri Paneli:
  ✓ [Çalışan ekranlar]
  ✗ [Eksik veya yarım ekranlar]

Admin/ISR Paneli:
  ✓ [Çalışan ekranlar]
  ✗ [Eksik ekranlar]

Web Sitesi:
  ✓ [Mevcut içerik]
  ✗ [Eksik veya güncellenmesi gereken içerik]
```

---

## ADIM 2 — MÜŞTERİ PANELİ EKSİKLERİNİ TAMAMLA

Adım 1'de tespit edilen eksiklikleri gider.

### Müşteri Paneli — /hesabim/ic-tarama

Sekme yapısı şöyle olmalı (eksik olanı ekle, mevcut olana dokunma):

**Sekme 1: Tarama Sonuçları**
- İç Tarama Skoru (büyük, renkli daire)
- Skor breakdown — kategori bazlı (OS, güvenlik, kimlik, ağ)
- Bulgular listesi — severity'ye göre sıralı, her bulgu için öneri
- Son tarama tarihi + hostname
- "Yeniden Tara" → script indirme

**Sekme 2: Güvenlik Anketi**
- 5 kart: Yedekleme, Olay Müdahale, Eğitim, Uyumluluk, İzleme
- Her kart tamamlanmış mı göstergesi (✓ / boş)
- Tamamlanma yüzdesi üstte

**Sekme 3: AI Güvenlik Raporu**
- Rapor yoksa: "Rapor Üret" butonu + açıklama
- Rapor varsa: 5 alt sekme (Özet, Kritik, Orta, Uzun, Maliyet)
- Benchmark şeridi
- Son üretim tarihi + "Yeniden Üret"

**Sekme 4: Fortinet Fabric** (entegrasyon varsa)
- Bağlantı durumu
- Firmware versiyonu + EOL uyarısı
- Policy özeti
- VPN durumu
- Son senkronizasyon

Eksik sekme varsa ekle. Mevcut sekmelerin içeriği eksikse tamamla.

### Script İndirme Sayfası İyileştirmesi

Script indirme kartlarına şunu ekle (yoksa):

```tsx
// Her OS kartında:
// 1. Gereksinimler: "Windows 10+ / PowerShell 5.1+"
// 2. Nasıl çalıştırılır: 3 adım
// 3. Gizlilik notu: "Script sadece okuma yapar, hiçbir şeyi değiştirmez"
// 4. Örnek çıktı önizlemesi (mock JSON)
```

---

## ADIM 3 — WEB SİTESİNE İÇ TARAMA İÇERİĞİ EKLE

Web sitesinde aşağıdaki içerikleri ekle veya güncelle.
Türkçe, sade, teknik olmayan dil kullan.
CyberStep'in marka sesi: güvenilir, net, abartısız.

### 3a. Ana Sayfaya (veya Hizmetler Sayfasına) Yeni Bölüm

Başlık: **"Dışarıdan Değil, İçeriden Bakın"**

```
Metin:
CyberStep'in iç tarama aracı, ağınızın içindeki riskleri 
dışarıdan görülemeyen açıları da dahil ederek ortaya çıkarır.

Tek bir script çalıştırın — sisteminizin tam güvenlik 
fotoğrafını çıkaralım.
```

4 özellik kartı:

```
🔍 Derin Envanter
Ağdaki tüm cihazlar, işletim sistemi versiyonları,
açık portlar ve servisler otomatik tespit edilir.

🔑 Kimlik Güvenliği  
Active Directory yapısı, admin hesapları, şifre politikası
ve riskli yapılandırmalar analiz edilir.

🤖 AI Aksiyon Planı
Tüm bulgular Claude AI tarafından değerlendirilerek
önceliklendirilmiş, maliyet tahminiyle aksiyon planı oluşturulur.

🛡️ Fortinet Entegrasyonu
Fortinet altyapınız varsa firewall politikaları, VPN durumu
ve endpoint uyumluluğu da rapora dahil edilir.
```

### 3b. Paket İçeriklerini Güncelle

Kalkan, Zırh ve vCISO paketlerinin içerik listelerini bul.
Şu satırları ekle (yoksa):

**Kalkan Paketi** — eklenecek:
```
✓ İç tarama scripti (Windows + Linux)
✓ Temel envanter ve güvenlik skoru
```

**Zırh Paketi** — eklenecek:
```
✓ İç tarama + AD/kimlik analizi
✓ Fortinet Fabric entegrasyonu
✓ AI aksiyon planı (aylık)
```

**vCISO Paketi** — eklenecek:
```
✓ Tam iç tarama (tüm katmanlar)
✓ AI destekli vCISO raporu
✓ Güvenlik anketi ve uyumluluk değerlendirmesi
✓ Fortinet policy analizi
✓ Aylık AI aksiyon planı güncellemesi
```

### 3c. Nasıl Çalışır Bölümü (yoksa ekle)

Başlık: **"3 Adımda İç Tarama"**

```
1. Script İndirin
   Tek tıkla Windows (.ps1) veya Linux (.sh) 
   scriptini indirin. Kurulum gerekmez.

2. Çalıştırın
   IT ekibiniz scripti çalıştırır (5 dakika).
   Sonuçlar otomatik olarak platforma yüklenir.

3. Raporunuzu Alın
   AI güvenlik raporunuz hazır. 
   Kritik aksiyonlar, maliyet tahminleri ve
   öncelik sırası ile eksiksiz aksiyon planı.
```

### 3d. Güven / Gizlilik Notu (web sitesinde mutlaka olsun)

```
🔒 Gizliliğiniz Güvende

İç tarama scripti yalnızca okuma yapar.
Hiçbir dosyayı değiştirmez, silmez veya kopyalamaz.
Toplanan veriler yalnızca güvenlik analizi için kullanılır
ve şifreli bağlantı üzerinden iletilir.
```

---

## ADIM 4 — SEO META VERİLERİ

İç tarama sayfası veya hizmetler sayfasına ekle:

```tsx
// <head> içine:
<title>İç Ağ Güvenlik Taraması | CyberStep</title>
<meta name="description"
  content="CyberStep iç tarama aracı ile ağınızın içindeki 
  güvenlik açıklarını tespit edin. AI destekli aksiyon planı, 
  Fortinet entegrasyonu, KVKK uyumluluk analizi." />
<meta name="keywords"
  content="iç tarama, ağ güvenliği, siber güvenlik, 
  Active Directory analizi, Fortinet, vCISO, KVKK" />
```

---

## ADIM 5 — TEST LİSTESİ

Her şey tamamlandıktan sonra kontrol et:

**Müşteri Paneli:**
- [ ] /hesabim/ic-tarama sayfası açılıyor
- [ ] Script indirme çalışıyor (Windows + Linux)
- [ ] Tarama yüklenince skor görünüyor
- [ ] AI Raporu sekmesi çalışıyor
- [ ] Anket kaydediliyor

**Web Sitesi:**
- [ ] "Dışarıdan Değil, İçeriden Bakın" bölümü görünüyor
- [ ] Paket içerikleri güncel
- [ ] "3 Adımda İç Tarama" bölümü var
- [ ] Gizlilik notu var
- [ ] Mobil görünümde bozulma yok

---

## KISITLAR

- Adım 1 tamamlanmadan Adım 2 ve 3'e geçme
- Mevcut çalışan UI'ya dokunma — sadece eksik olanı ekle
- Web sitesi metinleri Türkçe, sade, teknik terim yok
- Paket içerikleri mevcut fiyatlandırmayı değiştirmesin
- Gizlilik notunu her yerde göster — müşteri güveni kritik
