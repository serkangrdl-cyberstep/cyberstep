# CyberStep — Tarama Paneli Tutarlılık + UI Temizlik Denetimi
## Replit Agent Promptu

---

## BAĞLAM

İki ekran görüntüsü incelendi (örnek domain: money.com.tr — Shodan kaynaklı).
Kod yazmadan önce SADECE ANALİZ yap, bulguları aşağıdaki formatta özetle.
Hiçbir alanı tahminle "doğru/yanlış" deme — şemayı ve hesaplama kodunu oku.

---

## ADIM 1 — TECH FINGERPRINT SKOR ALANI

`9 teknoloji (/100)` şeklinde, skor payı boş basılıyor.

- Tech fingerprint sonuçlarına bir skor/puan hesaplanıyor mu, yoksa sadece
  teknoloji listesi mi tutuluyor?
- Eğer skor hesaplanıyorsa: hangi fonksiyon, neden `null`/`undefined` dönüyor?
- Eğer skor hiç hesaplanmıyorsa: frontend neden `(/100)` template'ini basıyor?
  İlgili component'i bul, ya skoru hesapla ya da bu template'i kaldır.

---

## ADIM 2 — HAM INTERNAL ETİKETLERİN UI'A SIZMASI

Ekranda doğrudan şu ham değerler görünüyor: `mail_security`, `is_ecommerce`,
`budget_indicator_high`, `analytics` (tekrarlı, hangi araç olduğu belirtilmeden).

- Bu etiketler hangi tabloda/kolonda tutuluyor? (örn. `tech_fingerprint.category`,
  `tech_fingerprint.signal_tags` gibi)
- Bunlar İÇ skorlama/lead-önceliklendirme sinyalleri mi? (`budget_indicator_high`
  ismi öyle düşündürüyor — teyit et)
- İnsan-okunur bir mapping katmanı var mı, yoksa enum/slug doğrudan mı basılıyor?

Bulgudan sonra: müşteri/Netsys'e açık panellerde (ISR ekranı dahil) ham slug
yerine okunur etiket gösteren bir mapping tablosu ekle, örnek:
`budget_indicator_high` → `"Yüksek Bütçe Potansiyeli"`,
`is_ecommerce` → `"E-ticaret Altyapısı"`,
`mail_security` → ilgili aracın gerçek adı (örn. "Microsoft 365 / Proofpoint" vb.)
Her teknoloji satırında hangi gerçek üründen geldiği (Hotjar, Segment, Google
Analytics gibi) ayrı ayrı görünmeli — şu an "analytics" 4 kez tekrar ediyor,
hangi aracın hangisi olduğu kayboluyor.

---

## ADIM 3 — SPF/DKIM/DMARC/MX: "FAIL" vs "N/A" AYRIMI

İlk ekranda (Domain Tarama Sonuçları): SPF ✗, DKIM ✗, DMARC ✓ (p=reject), MX ✗.
İkinci ekranda (Tech Fingerprint): `spf` ve `dmarc` "tespit edildi" olarak listede var.

- Bu iki panel SPF/DMARC'ı farklı kaynaklardan mı okuyor (biri DNS sorgusu,
  biri Shodan/pasif fingerprint)? Kodda iki ayrı kontrol fonksiyonu var mı?
- MX kaydı yoksa (yani domain mail almıyorsa), SPF/DKIM kontrolü mantıken
  "uygulanamaz" (N/A) olmalı, "başarısız" (✗ kırmızı) değil. Şu an MX yokken
  SPF/DKIM otomatik kırmızı mı işaretleniyor? Kodda bu koşul var mı?
- Eğer MX yokken SPF/DKIM hâlâ kırmızı/fail basılıyorsa, bu yanlış pozitif —
  müşteri "biz bu domainde mail kullanmıyoruz" dediğinde rapor güvenilirliği
  sarsılır. Mantığı şuna çevir: MX yoksa SPF/DKIM/DMARC durumunu "N/A — bu
  domain mail almıyor" olarak göster, risk skoruna dahil etme veya ayrı/düşük
  ağırlıkla dahil et.
- İki panel arasındaki SPF/DMARC sinyalini TEK bir kaynağa indir veya ikisi
  arasındaki farkı (örn. "DNS kaydı var" vs "aktif kullanılıyor") UI'da açıkça
  etiketle, böylece çelişkili görünmesin.

---

## ADIM 4 — "TAM GÖRÜNÜRLÜK" ROZETİ ANLAM NETLİĞİ

Rozet yeşil ve olumlu görünüyor ama Risk Skoru 58/100, HTTP header skoru 0/100.

- Bu rozetin gerçek anlamı: "tarama hiçbir engelle karşılaşmadan tamamlandı"
  mı, yoksa "domain güvenli" mi? Kodda hangi koşulda tetikleniyor?
- Eğer anlamı "tarama tamamlandı" ise, metni "Tüm Kontroller Tamamlandı" veya
  "Tarama Engellenmedi" gibi risk skorundan bağımsız, yanlış izlenim
  yaratmayacak bir ifadeye çevir. Şu anki haliyle satış/demo sırasında "her
  şey iyi" gibi yanlış okunabilir.

---

## ADIM 5 — KRİTİK BULGU SAYACI EŞİĞİ

Risk Skoru 58/100 olmasına rağmen Kritik Bulgu: 0.

- "Kritik" etiketi sadece CVE/KEV eşleşmesine mi ayrılmış, yoksa SPF/DKIM/HTTP
  header gibi bulgular hiç "kritik" seviyesine çıkamıyor mu? Eşik/severity
  mantığını bul.
- Bu bilinçli bir tasarımsa (kritik = sadece istismar edilebilir CVE) sorun
  yok, sadece UI'da "0 Kritik Bulgu" yanında risk skorunun neden yüksek
  olduğunu açıklayan kısa bir alt metin ("X orta seviye bulgu" gibi) ekle —
  aksi halde "0 kritik ama 58 risk" çelişkili görünüyor.

---

## ÇIKTI FORMATI

Kod değiştirmeden önce şu formatta özetle:

```
TESPİT:
1. Tech fingerprint skoru: [bulgu]
2. Ham etiket sızıntısı: [hangi tablo/component, kaç yerde]
3. SPF/DKIM/MX mantığı: [iki panel aynı kaynaktan mı, MX yokken davranış ne]
4. Tam Görünürlük rozeti: [tetikleme koşulu]
5. Kritik Bulgu eşiği: [severity mantığı]

ÖNERİLEN DEĞİŞİKLİKLER:
[Her madde için 1-2 cümlelik somut fix]
```

Onay almadan kod değişikliği yapma — önce tespiti paylaş.
