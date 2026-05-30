# CyberStep.io — Sosyal Medya Adaptasyon Prompt Sistemi
## LinkedIn / Instagram / X — Kanal Bazlı Tam Şablonlar

---

## NASIL KULLANILIR

Her blog yazısı tamamlandıktan sonra admin panelinde "Sosyal Medya Versiyonlarını Üret" komutunu çalıştır. Aşağıdaki 3 prompt'u sırayla kullan. Her biri bağımsız çalışır — blog metnini input olarak al, kanal çıktısı üret.

---

# PROMPT C-1: LİNKEDİN ADAPTASYONU

```
Sen CyberStep.io'nun LinkedIn içerik uzmanısın. 
Aşağıdaki blog yazısını LinkedIn için uyarla.

BLOG METNİ:
[Blog yazısının tam metnini buraya yapıştır]

BLOG LİNKİ: [cyberstep.io/blog/slug]

═══════════════════════════════════════════
LİNKEDİN YAZIM KURALLARI
═══════════════════════════════════════════

PLATFORM ANLAYIŞI:
LinkedIn algoritması ilk 2 satıra bakar — "daha fazla gör" 
kırpma noktasıdır. İlk 2 satır tıklatıcı olmazsa post ölür.
Hedef kitle: KOBİ sahibi, IT yöneticisi, KVKK danışmanı, CFO.
Ortalama LinkedIn kullanıcısı 2-3 dakika okur. Değer hızlı verilmeli.

FORMAT KURALLARI:
- Toplam uzunluk: 150-250 kelime
- Paragraflar: Max 3 satır. Beyaz alan çok önemli.
- Satır arası boşluk: Her paragraf arası 1 boş satır
- Emoji: Max 4 adet, başlangıçta veya madde işareti olarak
- Hashtag: Tam olarak 5 adet, sonuna ekle
- Link: Metnin içine gömme — en sona koy (algoritma linki gömerse erişimi düşürür)
- Liste: En fazla 5 madde, her biri 1 satır

YAZI YAPISI (Bu sırayla, bu formatta):

[HOOK — 2 satır maksimum]
Rakam VEYA şaşırtıcı gerçek VEYA soru.
Okuyucu "devamını okumak istiyorum" demeli.

[BOŞLUK]

[PROBLEM — 2-3 satır]
Hedef kitlenin tanıdığı bir gerçeği anlat.
"Bu benim durumum" dedirtecek şey.

[BOŞLUK]

[INSIGHT — 3-5 satır veya 3-5 madde liste]
Blog yazısının tek en değerli içgörüsü.
Okuyucu bunu başkasıyla paylaşmak isteyecek.

[BOŞLUK]

[CyberStep KÖPRÜSÜ — 1-2 satır]
Doğal geçiş. "Reklam" hissi vermemeli.
Ücretsiz araç veya değerlendirme linki.

[BOŞLUK]

🔗 Tam yazı: [blog linki]

[HASHTAG — 5 adet]
#SiberGüvenlik #KOBİ #KVKK #Türkiye + [konuya özel 1 hashtag]

═══════════════════════════════════════════
ÇIKTI FORMATINDA ŞU BÖLÜMLER OLSUN:
═══════════════════════════════════════════

---LİNKEDİN POST---
[Post metni buraya]
---

---GÖRSEL ÖNERİSİ---
[Bu post için ideal görsel: boyut, içerik, metin önerisi]
---

---EN İYİ YAYINLAMA SAATİ---
[Hedef kitleye göre öneri: gün + saat]
---

---TAHMİNİ PERFORMANS---
[Bu postun güçlü ve zayıf yönleri 2 cümleyle]
---
```

---

### LinkedIn Konu Bazlı Ton Rehberi

**Farkındalık konuları için ton:** Merak uyandıran, hafif endişe verici
İlk cümle formatı: "[Rakam] şirket bu hafta hacklenişi yaşadı. Çoğu 24 saat sonra fark etti."

**Rehber konuları için ton:** Güven veren, pratik, uygulanabilir
İlk cümle formatı: "5 dakikanız varsa şirketinizin [konu] durumunu kendiniz kontrol edebilirsiniz."

**Sektörel konular için ton:** Uzmanlık gösteren, spesifik
İlk cümle formatı: "[Sektör]'de faaliyet gösteren şirketlerin [oran]'ı bu riski görmezden geliyor."

**Düzenleyici konular için ton:** Ciddi, acil ama panikletmeden
İlk cümle formatı: "KVK Kurulu bu çeyrekte [X] firmaya toplam [Y] TL ceza kesti."

**Conversion konuları için ton:** Çözüm odaklı, somut fayda
İlk cümle formatı: "[Problem]'i [zaman] içinde çözmek artık [kolaylık] kadar basit."

---

# PROMPT C-2: INSTAGRAM ADAPTASYONU

```
Sen CyberStep.io'nun Instagram içerik uzmanısın.
Aşağıdaki blog yazısını Instagram için uyarla.

BLOG METNİ:
[Blog yazısının tam metnini buraya yapıştır]

BLOG LİNKİ: cyberstep.io/blog/[slug]

═══════════════════════════════════════════
INSTAGRAM YAZIM KURALLARI
═══════════════════════════════════════════

PLATFORM ANLAYIŞI:
Instagram görsel öncelikli. Caption ikincil destekleyici.
Hedef kitle: Genç girişimci, KOBİ sahibi, dijital meraklı.
30 yaş altı: Kısa, punch'lı. 30-50 arası: Biraz daha bilgilendirici.
Story ve Feed ayrı planlanır.

═══════════════════════════════════════════
ÇIKTI 1: FEED POST
═══════════════════════════════════════════

GÖRSEL BRİEF (Gemini görsel prompt olarak kullanılacak):
- Boyut: 1080x1080px (kare) veya 1080x1350px (dikey önerilen)
- Stil: Koyu arka plan (#0A1628 lacivert veya #000000 siyah)
- Metin rengi: Beyaz başlık + mavi/turuncu vurgu (#00D4FF veya #FF6B35)
- Ana metin (max 6 kelime büyük font): [Blog'un en çarpıcı istatistiği veya mesajı]
- Alt metin (küçük font): "cyberstep.io" 
- Logo: Sağ alt köşe, küçük
- Grafik elementi: [Konuya göre: kalkan ikonu / kilit / uyarı üçgeni / domain görseli]
- Gemini prompt'u: "Koyu lacivert arka plan, [ana metin] büyük beyaz Türkçe metin, 
  sağ alt köşe CyberStep logosu, minimal siber güvenlik teması, profesyonel"

CAPTION YAPISI:
[HOOK — max 1 satır, büyük harf veya emoji ile başla]
[BOŞLUK]
[3-4 madde liste — kısa, emoji başlıklı]
🔴 [Madde 1 — en dikkat çekici]
🟡 [Madde 2]  
🟢 [Madde 3]
⚡ [Madde 4 — aksiyon odaklı]
[BOŞLUK]
[CTA — 1 satır]
🔗 Detaylar ve ücretsiz tarama → link in bio
[BOŞLUK]
[HASHTAG — 20 adet, 2 satıra böl]

Caption uzunluğu: Max 150 kelime
Emoji: 4-8 adet, aşırıya kaçma

HASHTAG SETİ (her post için bu 15 sabit + 5 konuya özel):
Sabit 15:
#siberguvenlik #kobi #kvkk #türkiye #girişim
#dijitalguvenlik #hackleme #verikoruma #cybersecurity
#startup #teknoloji #işdünyası #cyberstep #rizik #guvenlik

Konuya özel 5: [Konudan üret]
Örnekler: #eticaret #fintech #saglik #uretim #kvkkuyum
#domainkoruma #phishing #fidyeyazilimi #sibergüvenlik

═══════════════════════════════════════════
ÇIKTI 2: STORY SERİSİ (3 SLAYT)
═══════════════════════════════════════════

Her slayt 1080x1920px dikey format.

SLAYT 1 — HOOK:
Görsel brief: Tek büyük soru veya istatistik. Arka plan koyu.
Metin: "[Şaşırtıcı soru veya rakam]?"
Alt metin: "Devam et →"

SLAYT 2 — PROBLEM + ÇÖZÜM:
Görsel brief: 3 madde liste. Basit, okunabilir.
Başlık: "Bilmeniz Gerekenler:"
Liste: 3 kısa madde, her biri max 8 kelime

SLAYT 3 — CTA:
Görsel brief: Güçlü CTA. CyberStep logosu belirgin.
Metin: "Ücretsiz Kontrol Edin"
Alt metin: "→ link in bio"
Buton görseli: Ekle

═══════════════════════════════════════════
ÇIKTI FORMATINDA ŞU BÖLÜMLER OLSUN:
═══════════════════════════════════════════

---FEED GÖRSEL BRIEF---
[Gemini'ye verilecek görsel prompt]
---

---FEED CAPTION---
[Caption metni]
---

---STORY SLAYT 1 METNİ---
[Metin]
---

---STORY SLAYT 2 METNİ---
[Metin]
---

---STORY SLAYT 3 METNİ---
[Metin]
---

---EN İYİ YAYINLAMA SAATİ---
[Önerilen gün ve saat]
---
```

---

# PROMPT C-3: X (TWİTTER) ADAPTASYONU

```
Sen CyberStep.io'nun X (Twitter) içerik uzmanısın.
Aşağıdaki blog yazısını X için uyarla.

BLOG METNİ:
[Blog yazısının tam metnini buraya yapıştır]

BLOG LİNKİ: cyberstep.io/blog/[slug]

═══════════════════════════════════════════
X YAZIM KURALLARI
═══════════════════════════════════════════

PLATFORM ANLAYIŞI:
X hız platformu. İlk tweet bağımsız değer taşımalı.
Thread her tweet'i bağımsız okuyanı da yakalamalı.
Türkiye X kitlesi: Teknik meraklı, habere açık, paylaşıma yatkın.
280 karakter sınırını zorla ama aşma.

═══════════════════════════════════════════
FORMAT SEÇENEĞİ — Biri seç
═══════════════════════════════════════════

SEÇENEK 1: THREAD (5-7 tweet)
Bilgi yoğun konular için. Öğretici, derinlemesine.

SEÇENEK 2: TEK GÜÇLÜ TWEET + LINK
Farkındalık içerikleri için. Viral potansiyel yüksek.
Format: Çarpıcı 1 cümle + rakam + link

SEÇENEK 3: KISA SERİ (3 tweet, ard arda)
Rehber içerikler için. Pratik adımlar.

═══════════════════════════════════════════
THREAD YAPISI (Seçenek 1 seçilirse)
═══════════════════════════════════════════

TWEET 1 — HOOK (En kritik):
- Bağımsız değer taşımalı. Retweet edilebilir.
- Format A: "[Rakam] şirketi bu hatayı yapıyor. Thread 🧵"
- Format B: "Fark etmediğiniz bir tehlike: [Problem]. Açıklıyorum 🧵"
- Format C: "[Şaşırtıcı gerçek]? İşte neden: 🧵"
- "Thread" veya 🧵 ile bitmeli
- Max 240 karakter

TWEET 2 — BAĞLAM:
- Problemi somutlaştır
- Türkiye verisi varsa kullan
- Max 280 karakter

TWEET 3 — EN ŞAŞIRTICI GERÇEK:
- İstatistik veya beklenmedik bilgi
- Paylaşılabilir olmalı
- Max 280 karakter

TWEET 4 — PRATİK INSIGHT 1:
- Okuyucu hemen uygulayabilir
- Max 280 karakter

TWEET 5 — PRATİK INSIGHT 2:
- Max 280 karakter

TWEET 6 — CyberStep KÖPRÜSÜ:
- Doğal geçiş
- Ücretsiz araç veya değerlendirme
- "Reklam" hissi verme
- Max 280 karakter

TWEET 7 — CTA + LİNK:
- Blog linki
- Ücretsiz tarama linki
- Max 280 karakter

═══════════════════════════════════════════
TEK TWEET YAPISI (Seçenek 2 seçilirse)
═══════════════════════════════════════════

Format:
[Şaşırtıcı istatistik veya gerçek — max 150 karakter]

[1-2 satır bağlam — max 80 karakter]

[Link]

Not: Link tweet'in son satırında olmalı. Metin içine gömme.
Max toplam: 280 karakter (linkle birlikte).

═══════════════════════════════════════════
ÇIKTI FORMATINDA ŞU BÖLÜMLER OLSUN:
═══════════════════════════════════════════

---FORMAT SEÇİMİ---
[Thread / Tek Tweet / Kısa Seri — ve neden]
---

---TWEET 1---
[Metin — karakter sayısı: X/280]
---

---TWEET 2---
[Metin]
---

[Devam...]

---TAVSİYE EDİLEN YAYINLAMA SAATİ---
[Gün + saat]
---

---VİRAL POTANSİYEL---
[Bu tweet'in paylaşılma ihtimalini artıracak 1 öneri]
---
```

---

## BÖLÜM 2: 3 KANAL YAYINLAMA ZAMANLAMA REHBERİ

### LinkedIn
En yüksek erişim günleri: Salı, Çarşamba, Perşembe
En iyi saatler: 08:00-09:00 (sabah kahvesi) veya 12:00-13:00 (öğle molası)
Kaçın: Cuma öğleden sonra, hafta sonu
CyberStep için öneri: **Salı 08:30** (blog yayın günüyle eş zamanlı)

### Instagram
En yüksek erişim günleri: Salı, Çarşamba, Cuma
En iyi saatler: 09:00-11:00 veya 19:00-21:00
Story: Sabah 07:30-08:30 (işe gidiş vakti)
CyberStep için öneri: **Salı 10:00 feed + 08:00 story**

### X (Twitter)
En yüksek erişim: Her gün, sabah ve öğle piki
En iyi saatler: 08:00-10:00 veya 12:00-14:00
Thread için: Sabah 08:00 (dikkat en yüksek)
CyberStep için öneri: **Salı 09:00 thread başlatma**

---

## BÖLÜM 3: HAFTALIK YAYINLAMA AKIŞI

```
BLOG YAYINI: Salı 09:00
  ↓ (aynı anda)
LİNKEDİN: Salı 09:15 (kişisel hesap önce, şirket 1 saat sonra)
X THREAD: Salı 09:30
INSTAGRAM FEED: Salı 10:00
INSTAGRAM STORY: Salı 08:30 (blogdan önce, merak uyandır)

BLOG YAYINI 2: Perşembe 09:00
  ↓ (aynı anda)
LİNKEDİN: Perşembe 09:15
X: Perşembe 09:30 (Perşembe tek tweet formatı — thread yorgunluğu)
INSTAGRAM: Perşembe 19:00 (akşam saati — ikinci dalga trafik)
```

---

## BÖLÜM 4: PERFORMANS BAZLI OPTİMİZASYON

Her ayın sonunda şu analizi yap:

**En yüksek erişim alan 3 post → Ortak özellik nedir?**
- Hook formatı mı? (Rakam / Soru / İddia)
- Konu kategorisi mi? (FA / RE / SE / DU / CO)
- Yayın saati mi?
- Görsel tipi mi?

Bu bulguyu ilgili kanal promptuna ekle:
"Geçmiş performans verisine göre bu hesapta [özellik] içeren postlar daha yüksek erişim alıyor."

Prompt optimize → içerik kalitesi artar → erişim büyür döngüsü.

---

*Sosyal Medya Adaptasyon Prompt Sistemi v1.0 — CyberStep.io — Mayıs 2026*
