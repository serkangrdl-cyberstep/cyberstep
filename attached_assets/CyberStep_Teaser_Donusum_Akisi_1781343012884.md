# CyberStep — Teaser E-posta Yeniden Tasarımı ve Dönüşüm Akışı

## 1. Mevcut Taslağın Sorunları

| Sorun | Neden |
|---|---|
| Şirket tanıtımıyla açılıyor | Alıcı "bu kim, ne istiyor" diye düşünmeden önce ilgisini kaybeder — bulgu ile açılmalı |
| CVE-2007-6013 gibi çok eski CVE örneği | 19 yıllık bir CVE, "bu rapor şablonsal/otomatik" hissi verir, güveni zayıflatır — gerçek/güncel bulgu kullanılmalı |
| "İstanbul'daki teknoloji sektörü" gibi genellemeler | Doğrulanamaz, kişiselleştirme hissi yaratmıyor — gerçek sektör/lokasyon bilgisi varsa kullanılmalı, yoksa bu cümle çıkarılmalı |
| CTA "ücretsiz değerlendirmenizi başlatın" | Alıcı zaten tarandı — sıfırdan başlatma daha yüksek sürtünme; "hazırladığımız raporu görün" daha düşük sürtünme |
| Tek CTA, tek hedef | Rapor görüntüleme sonrası ne olacağı tanımsız — dönüşüm akışı eksik |

---

## 2. Yeni Teaser Yapısı (Şablon)

```
Konu: [Şirket Adı] için güvenlik taramamızda 1 kritik bulgu tespit edildi

Sayın [Şirket Adı] Yöneticisi,

[X] tarihinde [domain] alan adınız için gerçekleştirdiğimiz pasif güvenlik
taramasında dikkat çekici bir bulguya rastladık.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GENEL RİSK SKORU: [SKOR]/100  [RENK ETİKETİ: Kritik/Yüksek/Orta]

  ÖNE ÇIKAN BULGU:
  [Bulgu başlığı — örn. "E-posta Güvenlik Yapılandırması (DMARC) Eksik"]

  [1-2 cümle açıklama — teknik jargon yok, sonuç odaklı]
  Örn: "Bu eksiklik, saldırganların [domain] adına sahte e-posta
  göndermesine izin verebilir — fatura dolandırıcılığı ve CEO
  sahtekarlığı saldırılarında yaygın kullanılan bir yöntemdir."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bu tarama, halka açık DNS, sertifika ve ağ kayıtları üzerinden tamamen
pasif olarak gerçekleştirildi — sisteminize herhangi bir erişim
sağlanmadı.

[Varsa, doğrulanabilir bağlamsal istatistik — örn. Fortinet/DORinsight
2025 Türkiye raporu: "Türkiye'deki şirketlerin %65,2'si son 12 ayda en
az bir siber saldırıya uğradı."]

Sizin için hazırladığımız raporu görüntülemek üzere aşağıdaki butona
tıklayabilirsiniz — kayıt gerektirmez, raporunuz hazır.

  [ RAPORUMU GÖRÜNTÜLE → ]

Saygılarımızla,
CyberStep.io Ekibi
Türkiye merkezli siber güvenlik risk analizi platformu

---
Bu e-posta, [domain] alan adına ait halka açık kayıtların pasif
analizi sonucunda gönderilmiştir. Tarafımızla iletişime geçmek
istemiyorsanız [buradan] bildirebilirsiniz.
```

### Şablon Notları

- **Konu satırı**: "1 kritik bulgu tespit edildi" — sayı somut, merak uyandırır, ama abartılı değil. Eğer kalifikasyon kriteri overallScore < 60 ise ve birden fazla bulgu varsa, en yüksek önem derecesine sahip OLANI seç (clickbait değil, gerçek önceliklendirme)
- **Bağlamsal istatistik OPSİYONEL** — sadece gerçekten doğrulanabilir, genel (sektöre/lokasyona özel iddia içermeyen) bir kaynak varsa kullan. Yoksa bu blok tamamen çıkarılabilir, e-posta zarar görmez
- **Şeffaflık notu** ("halka açık kayıtların pasif analizi") — hem güven inşa eder hem de "bizi nasıl buldunuz" sorusuna önceden cevap verir, hem de KVKK açısından iyi pratik

---

## 3. Dönüşüm Akışı — Teaser'dan Ücretli Hizmete

### Aşama 1 — E-posta → Rapor Sayfası (Mevcut Freemium Mantığıyla Uyumlu)

"RAPORUMU GÖRÜNTÜLE" linki, mevcut freemium domain-scan sonuç sayfasına götürür — **kayıt gerektirmeden**:

- Genel skor (görsel, renk kodlu)
- İlk 3 bulgu (başlık + önem derecesi rozeti)
- Kısa açıklama metni
- Diğer bulgular + MITRE senaryoları + PDF → kilitli (blur overlay + "Ücretsiz Kayıt Ol" CTA)

Bu sayfa zaten mevcut freemium modelle aynı — fark, kullanıcının buraya bir e-posta linkiyle, kendi şirketine özel sonuçla gelmesi. Bu, soğuk bir ziyaretçiden çok daha yüksek dönüşüm potansiyeli taşır.

### Aşama 2 — Kayıt → Tam Rapor + "Sonraki Adım" Bloğu

Kullanıcı ücretsiz kayıt olup tam raporu görüntülediğinde, raporun SONUNA (mevcut PDF/sayfa yapısını bozmadan, ek bir bölüm olarak) şu eklenmeli:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BU BULGULAR NE ANLAMA GELİYOR?

  Raporunuzdaki [N] bulgu, [domain] için toplam [TAHMİNİ RİSK/TL
  AÇIKLAMASI] potansiyel etki taşıyabilir.
  [Sektörünüzdeki/benzer büyüklükteki şirketler için referans
  istatistik varsa buraya]

  CyberStep, bu bulguları kapatmanıza yardımcı olacak somut adımlar
  sunan ücretli hizmetler sağlıyor:

  → AI Saldırı Yüzeyi Analizi — Bulgularınızın detaylı MITRE ATT&CK
    senaryoları ve önceliklendirilmiş aksiyon planı (4.990 TL)

  → Sürekli İzleme — Bu bulguların durumunu aylık takip edin, yeni
    riskler ortaya çıktığında haberdar olun

  [ ÜCRETLİ HİZMETLERİ İNCELE → ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Bu blok, mevcut "Kritik Sızıntı 2" (rapor "tıklatıcı değil") sorununu da çözüyor — skor/bulgu ile ücretli hizmet arasında doğrudan bir köprü kuruyor.

### Aşama 3 — Dönüşmeyenler İçin Drip Devamı

Eğer kullanıcı Aşama 2'de ücretli hizmete geçmezse, mevcut drip e-posta dizisine (0/2/4/7 gün) bu lead bir "teaser-originated" etiketiyle girer — drip içeriği, raporda gösterilen SPESİFİK bulguya referans vermeye devam etmeli (genel pazarlama mesajı değil, "Geçen hafta [domain] için tespit ettiğimiz [bulgu] hâlâ açık" gibi takip).

### Aşama 4 — Bulgu Durumu Değişirse Yeniden Tetikleme

Eğer bu domain daha sonra (katmanlı tarama modelinde Tier 2'ye geçtiğinde) yeniden taranır ve:
- **Bulgu düzeltilmişse**: "Tebrikler, [bulgu] düzeltilmiş görünüyor — skorunuz X'ten Y'ye yükseldi" şeklinde pozitif bir takip e-postası (ilişki kurma, satış basıncı yok)
- **Yeni bir bulgu eklenmişse veya skor düşmüşse**: bu, Tier 3→2 "geçiş olayı" olarak yeni bir teaser tetikler — aynı şablon, yeni bulgu

Bu son adım, "tek seferlik teaser" yerine **sürekli izleme hizmetinin canlı bir kanıtı** haline gelir — daha önce tartıştığımız "neden abone olayım" sorusuna somut bir cevap: "çünkü biz sizi zaten takip ediyoruz, bu e-posta onun kanıtı."

---

## 4. Özet — Akış Diyagramı

```
Kalifiye Domain (otomatik tarama)
        │
        ▼
  Teaser E-postası ──────► [Yeni Şablon: bulgu-odaklı, tek CTA]
        │
        ▼
  Rapor Sayfası (kayıtsız, freemium — ilk 3 bulgu)
        │
        ├──► Kayıt Olmaz → Drip dizisine düşer (mevcut 0/2/4/7 gün,
        │                   spesifik bulguya referansla güncellenir)
        │
        ▼
  Kayıt Olur → Tam Rapor + "Sonraki Adım" bloğu
        │
        ├──► Ücretli Hizmet Satın Alır → Onboarding
        │
        └──► Almaz → Drip + Tier geçişlerinde yeniden tetiklenen
                      takip e-postaları (pozitif/negatif değişim)
```

---

## 5. Replit İçin Uygulama Notu (Opsiyonel — Onay Sonrası)

Eğer bu akışın uygulanmasını istersen, ayrı bir prompt hazırlanabilir. Önerilen kapsam:
- Mevcut teaser e-posta şablonunun (`leadTeaserEmail.ts` veya eşdeğeri) yukarıdaki yapıya göre güncellenmesi — en yüksek önem derecesine sahip TEK bulguyu seçen mantık eklenmesi
- Rapor sayfasına "Sonraki Adım" bloğunun eklenmesi (mevcut freemium kilit yapısına ek, üzerine yazma değil)
- Drip e-posta şablonlarının spesifik bulguya referans verecek şekilde güncellenmesi
- Tier geçiş olaylarında (gelecekteki katmanlı tarama modeli) tetiklenen "durum değişikliği" e-postası için temel bir hook/fonksiyon iskeleti
