# Ücretli pakete geçiş — ilk müşteri kontrol listesi

Kod hazır: ücretli paketler key ve paket adı girilince devreye girer. Ayarların hepsi
**Admin → Entegrasyon Merkezi** sayfasından (ya da Railway ortam değişkeni olarak) girilebilir.
Sayfanın üstündeki "Ücretli paketler ve ticari mod" kartı aylık sabit veri maliyetini,
günlük kota kullanımını ve son 30 günün AI harcamasını gösterir.

Fiyatlar Kasım 2026 listeleridir. Maliyet/fiyat senaryoları için hesaplayıcı:
https://claude.ai/artifact/1KiPxiCDty3Cqpbd27H1ye

## 1. Lisans uyumu (ilk ücretli müşteriden önce, zorunlu)

| Adım | Neden | Ayar |
|---|---|---|
| Google Web Risk key'i alın | Safe Browsing API'si yalnızca ticari olmayan kullanım içindir. Web Risk ayda 100 bin sorguya kadar ücretsiz. | `WEB_RISK_API_KEY` |
| VirusTotal'ı kapatın ya da Premium alın | Ücretsiz (Public) API ticari üründe kullanılamaz. Premium teklif bazlı. | Premium alınırsa `VIRUSTOTAL_PLAN=premium` |
| Ticari modu açın | Lisansı uygun olmayan ücretsiz kaynakları taramadan çıkarır; skor onları "ölçülmedi" sayar. | `COMMERCIAL_MODE=true` |

Ticari modda Web Risk key'i yoksa Safe Browsing kontrolü atlanır; VIRUSTOTAL_PLAN premium değilse
VirusTotal atlanır. Taramada bu kaynaklar `license_restricted` olarak işaretlenir.

## 2. Veri sağlayıcıları (ihtiyaca göre)

| Sağlayıcı | Ne zaman | Paket | Ayar |
|---|---|---|---|
| Shodan | Zaten var (Freelancer $69/ay, ticari kullanım dahil) | Hacim artınca Small Business $359 | `SHODAN_PLAN=freelancer` (seçilince günlük kota 2.000'e çıkar) |
| Censys Platform | Gizli sunucu tespiti satılacaksa | Starter $79/ay (500 kredi ≈ 500 tedarikçi/ay) | `CENSYS_PAT`, `CENSYS_ORG_ID`, `CENSYS_PLAN=starter` |
| AbuseIPDB | Günde 1.000 sorguyu aşınca | Basic $25/ay | `ABUSEIPDB_PLAN=basic` |
| DeHashed | Dark web / kimlik sızıntısı modülü | $21,99/ay + sorgu başı ~$0,03 | `DEHASHED_API_KEY`, `DEHASHED_EMAIL` |
| HIBP | Müşterinin kendi alan adı sızıntı izleme | Core 1 $5,29 → Core 3 $43,99 (5 alan adı) | `HIBP_API_KEY`, `HIBP_PLAN` |

Notlar:
- Censys TPRM taramasında tedarikçi başına 30 günde bir sorgulanır (`CENSYS_REFRESH_DAYS`).
  Sorgu biçimi `CENSYS_PLATFORM_QUERY` ile değiştirilebilir (varsayılan `host.services.cert.names: "{domain}"`).
  Platform entegrasyonu gerçek bir key ile henüz denenmedi: key girildikten sonra Entegrasyon Merkezi'ndeki
  Censys testini çalıştırın ve ilk taramanın loglarına bakın.
- HIBP alan adı araması DNS doğrulaması ister; tedarikçi alan adlarında kullanılamaz.
- `<SAĞLAYICI>_DAILY_LIMIT` paketin günlük kotasını elle ezer.

## 3. Yapay zekâ (Railway geçişiyle birlikte)

- Railway'de `ANTHROPIC_API_KEY` ve `GEMINI_API_KEY` tanımlayın (Replit AI proxy'si dışarıda çalışmaz).
- Daha ucuz yeni nesil modellere kod değiştirmeden geçmek için:
  - `AI_HAIKU_MODEL=claude-haiku-5-5` ($0,10/$0,50 — Haiku 4.5'in onda biri)
  - `AI_SONNET_MODEL=claude-sonnet-5-5` ($2/$10 — Sonnet 4.6'dan ucuz)
- Kodda `gemini-2.5-flash` sabit yazılı (13 yer). Google bu modeli emekliye ayırıyorsa
  Gemini çağrıları resmi API'de hata verebilir; geçişte kontrol edin.

## 4. Fiyat ve sözleşme

- Yıllık TL fiyat sabitse kur riski bizde kalır (son 12 ayda USD/TL ~%19 arttı).
  Sözleşmeye yıllık kur/TÜFE güncellemesi koyun ya da hesaplayıcıdaki kur tamponunu fiyata ekleyin.
- Maliyetin büyük kısmı sabit; 3–4 ücretli müşteriden sonra brüt marj hızla yükselir.
