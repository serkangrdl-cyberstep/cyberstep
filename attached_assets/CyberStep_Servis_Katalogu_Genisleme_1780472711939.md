# CyberStep.io — Servis Kataloğu
## Mevcut Entegrasyonlara Dayalı Servisler

**Tarih:** Haziran 2026
**Versiyon:** 2.0

---

## TEMEL MİMARİ KURAL

```
CyberStep → Müşteri cihazına bilgi GÖNDERIR   ✅
CyberStep ← Müşteri cihazından bilgi ALMAZ    ❌

Tek istisna — SOC/NOC:
  Müşteri kendi isteğiyle webhook gönderir
  Biz talep etmeyiz, içeri girmeyiz
  Neyi göndereceğini müşteri seçer
```

Tüm servisler public kaynaklara dayanır:
Shodan, crt.sh, NVD, HIBP, CISA KEV, USOM,
VirusTotal, DMARC/SPF/DKIM, SSL Labs, GreyNoise, OTX.

---

## SERVİSLER

---

### 1 — Dış Saldırı Yüzeyi Değerlendirmesi (EASM)

Müşteriye sorulacak tek şey: Domain adresiniz.

```
Dışarıdan tespit edilenler:
  Açık portlar ve servisler (Shodan)
  Alt domain envanteri (crt.sh)
  Yazılım versiyonları → CVE eşleştirme (NVD)
  EPSS: "Bu açığın istismar olasılığı %X"
  CISA KEV: "Aktif saldırılarda kullanılıyor"
  GreyNoise: "Altyapınız aktif taranıyor"
  OTX: Tehdit kampanyası bağlantısı
  HIBP: Çalışan email sızıntısı
  DMARC/SPF/DKIM: Email sahteciliği riski
  WAF durumu ve bypass riski
  SSL/TLS yapılandırması

Çıktı:
  Türkçe PDF (20-30 sayfa)
  Yönetici özeti (2 sayfa)
  KVKK/7545 bağlamı
  Önceliklendirilmiş aksiyon listesi
```

**Fiyat:**
```
Tek değerlendirme:        5.990 TL
Çeyreklik tekrar:         3.990 TL/çeyrek
Yıllık abonelik:          2.500 TL/ay
```

---

### 2 — Tehdit İstihbarat Besleme Servisi

CyberStep tehdit listelerini toplar, müşteri cihazına gönderir.
Müşteriden hiçbir veri alınmaz.

```
CyberStep toplar (otomatik, sürekli):
  CISA KEV — aktif istismar edilen CVE'ler (6 saatte bir)
  ThreatFox — IOC listesi (günlük)
  Feodo Tracker — botnet C2 IP'leri (6 saatte bir)
  URLhaus — zararlı URL'ler (günlük)
  USOM — Türkiye kara listesi (günlük)

CyberStep gönderir:
  FortiGate → Address object olarak blok listesi
  FortiManager → Merkezi dağıtım (çok cihaz)
  Generic Webhook → Diğer cihazlar için

Müşteri sadece "hangi cihaza göndersin" ayarını yapar.
```

**Satış konuşması:**
*"Bu listeleri kendiniz takip etmek için
USOM, ThreatFox, CISA'yı ayrı ayrı
izlemeniz gerekir. Biz bunları birleştirip
FortiGate'inize otomatik yolluyoruz."*

**Fiyat:**
```
Starter — 1 cihaz, günlük güncelleme:    1.990 TL/ay
Standart — 5 cihaz, 6 saatlik güncelleme: 3.490 TL/ay
Pro — sınırsız cihaz, saatlik:           5.990 TL/ay
```

---

### 3 — CVE İzleme ve Etki Bildirimi

Müşterinin tech stack'ini dışarıdan tespit edip,
yeni CVE çıkınca eşleştirip bildiririz.

```
Adım 1 — Tech stack tespiti (dışarıdan):
  WordPress versiyonu, nginx, PHP, Apache,
  jQuery sürümü, SSL sertifika otoritesi...
  Shodan banner + HTTP header analizi.
  Müşteriden veri alınmaz.

Adım 2 — Sürekli CVE izleme:
  NVD'den her 2 saatte yeni CVE'ler
  CISA KEV güncellemeleri (kritik olanlar)
  EPSS ile istismar olasılığı hesabı

Adım 3 — Eşleştirme:
  "Müşterinin stack'inde bu CVE var mı?"

Adım 4 — Bildirim:
  Email → CTO/IT direktörüne
  SMS → Kritik CVE'lerde (NetGSM)
  Telegram → Anlık (isteğe bağlı)
  FortiGate → CVE'yi tetikleyen bilinen IP'leri blokla
```

**Fiyat:**
```
Lite — 1 domain, email bildirimi:          990 TL/ay
Standart — 5 domain, SMS dahil:          2.490 TL/ay
Pro — sınırsız, Telegram + auto-block:   4.990 TL/ay
```

---

### 4 — E-posta Güvenlik Sertifikasyonu

Tamamen DNS sorgusu. Müşteri sistemine dokunulmaz.

```
DNS analizi (public):
  SPF kaydı — softfail/hardfail/eksik
  DMARC politikası — none/quarantine/reject
  DKIM yapılandırması ve anahtar uzunluğu
  BIMI kaydı (marka doğrulama)
  MX kayıtları

IP itibar (public):
  Mail sunucu IP → 15+ DNSBL listesi
  AbuseIPDB geçmişi
  VirusTotal itibar

Sızıntı (HIBP — public):
  Şirket domain'inde kaç adres ifşa edilmiş?

Çıktı:
  PDF rapor
  Adım adım düzeltme kılavuzu
  30 gün sonra "düzeltildi mi?" tekrar kontrolü
```

**Fiyat:**
```
Tek seferlik denetim:   2.500 TL
Yıllık izleme:            990 TL/ay
```

---

### 5 — Tedarikçi Risk Tarama (TPRM Lite)

Müşteri tedarikçi domain listesi verir.
Her tedarikçiyi biz dışarıdan tarayıp raporlarız.

```
Müşteri: tedarikçi domain listesi (CSV)

CyberStep her tedarikçi için:
  EASM taraması (servis 1 ile aynı)
  HIBP sızıntı kontrolü
  DMARC/SPF durumu
  Kara liste kontrolü
  SSL durumu

Çıktı:
  Tedarikçi risk matrisi (A-F skoru)
  En riskli tedarikçiler vurgulu
  BDDK 3. taraf risk yönetimi bağlamı
  Board'a hazır PDF
```

**Fiyat:**
```
5 tedarikçi:              2.500 TL
10 tedarikçi:             4.000 TL
20 tedarikçi:             6.500 TL
Çeyreklik tekrar (20):    3.000 TL/çeyrek
```

---

### 6 — Pentest Lite Raporu

Pasif keşif. Sisteme dokunulmaz, aktif exploit yapılmaz.

```
Altyapı haritalama:
  Shodan: açık portlar, banner, versiyon
  crt.sh: subdomain envanteri,
          terk edilmiş sistemler (takeover riski)

CVE önceliklendirme:
  NVD eşleştirme
  EPSS: istismar olasılığı
  CISA KEV: "Bu açık aktif saldırılarda kullanılıyor"

Tehdit korelasyonu:
  GreyNoise: altyapı aktif taranıyor mu?
  OTX: tehdit kampanyasıyla bağlantı?
  ThreatFox: C2 altyapısı ilişkisi?

Saldırı senaryosu (Claude):
  Tespit edilen açıklar nasıl zincirlenir?
  MITRE ATT&CK çerçevesinde

WAF analizi:
  WAF var mı, hangisi?
  Kaynak sunucuya direkt IP erişimi açık mı?

Rapor ilk sayfası notu:
  "Pasif EASM değerlendirmesi.
   Active exploitation yapılmamıştır.
   Tüm veriler public kaynaklardan."
```

**Fiyat:**
```
Tek domain:               7.500 TL
5 domain:                15.000 TL
Yıllık çeyreklik:        24.000 TL/yıl
```

---

## MEVCUT SERVİSLERİN GÜNCELLENEN TANIMI

---

### AI SOC — Webhook Modeli

Müşteri FortiGate'te Automation Stitch kurar.
Alarm tetiklenince CyberStep'e gönderir.
Biz içeri girmeyiz.

```
Müşteri kontrolünde:
  Hangi alarm tiplerini göndersin?
  Hangi veri alanları gitsin?
  Müşteri seçer, müşteri filtreler.

CyberStep tarafında:
  Gelen alarm → Claude triage
  Kritik → bildir
  Yanlış alarm → filtrele
  IOC tespiti → FortiGate'e blok gönder

Sözleşmede:
  "Alarm verileri 30 gün tutulur, arşivlenmez.
   Minimal veri prensibi uygulanır."
```

Fiyatlar değişmez.

---

### Fortinet Entegrasyon — Tek Yönlü

Tek değişiklik: Yön.

```
ÇIKIŞ (CyberStep → FortiGate):
  Zararlı IP listesi → Address object
  CVE ile ilişkili IP'ler → Blok kuralı
  C2 sunucuları → Otomatik blok
  Tehdit istihbarat listesi → Günlük push

GİRİŞ (FortiGate → CyberStep):
  Sadece SOC/NOC müşterisi ve
  müşteri aktif olarak kurmak isterse
  Biz talep etmeyiz
```

**Satış konuşması:**
*"Sisteminize bağlanmıyoruz.
Tespit ettiğimiz zararlı IP'leri
FortiGate'inize gönderiyoruz.
Siz 'kabul et' diyorsunuz."*

---

## FİYAT TABLOSU ÖZETİ

```
Yeni servisler:
  EASM Değerlendirmesi       5.990 TL/tek | 2.500 TL/ay
  Tehdit İstihbarat Besleme  1.990-5.990 TL/ay
  CVE İzleme                   990-4.990 TL/ay
  E-posta Sertifikasyonu     2.500 TL/tek | 990 TL/ay
  Tedarikçi Risk (TPRM)      2.500-6.500 TL/tek
  Pentest Lite               7.500-15.000 TL/tek

Mevcut servisler (değişmez):
  AI SOC Lite/Standart/Pro
  AI NOC Lite/Standart/Pro
  SOC+NOC kombinasyonları
  Başlangıç/Tam Koruma paketleri
```

---

## MÜŞTERİYE SATIŞ KONUŞMASI

*"CyberStep sisteminize bağlanmıyor.
Dışarıdan bakıyoruz.
Tespit ettiğimiz tehditleri size bildiriyor,
FortiGate'inize gönderiyoruz.
Sisteminizin içini görmüyoruz,
bilmiyoruz, istemiyoruz."*

---

*CyberStep.io — Servis Kataloğu — Haziran 2026*
*Sıfır Müşteri Verisi Modeli*
