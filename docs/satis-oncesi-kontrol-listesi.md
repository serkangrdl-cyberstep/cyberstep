# Satış öncesi kontrol listesi (TPRM)

Durum: `[ ]` yapılmadı · `[~]` kısmen · `[x]` tamam. "Doğrulanmadı" = şartlar henüz okunmadı; varsayım yapılmamalı.

## 1. Veri kaynakları: lisans durumu (araştırma: 20 Kas 2026, resmi şartlar/SSS sayfaları)

Sınıflar: **K** = kullanılabilir (atıf varsa uygula) · **İ** = yazılı izin/ticari plan gerekir · **A** = alternatif lazım. Şartlar değişebilir; satıştan önce bir kez daha kontrol et. Hukuki görüş değildir.

| Kaynak | Sınıf | Bulgu | Yapılacak |
|---|---|---|---|
| NVD API | K | Kamu malı; ticari ürüne açık. "Bu ürün NVD API kullanır, NVD onaylı değildir" notu isteniyor | Rapor/arayüz altbilgisine bu notu ekle |
| FIRST EPSS | K | Ücretsiz, ticari ürüne açık (kullanım sözleşmesi, FIRST'e atıf) | Altbilgiye atıf ekle |
| VulnCheck KEV / NVD++ (Community) | K | Ücretsiz, ticari ürüne açık; **belirgin atıf zorunlu** | Rapor ve arayüzde "VulnCheck KEV" atfı |
| abuse.ch Feodo, SSLBL | K | CC0, ticari serbest | — |
| abuse.ch ThreatFox, URLhaus, MalwareBazaar | İ | Ticari/kâr amaçlı kullanım için Spamhaus üzerinden ücretli abonelik gerekebilir; veriyle yapay zekâ modeli eğitmek/iyileştirmek yasak | Kodda ThreatFox `Auth-Key` ile çağrılıyor. Ticari abonelik al ya da bu iki kaynağı skordan çıkar; Feodo kalsın |
| RansomLook | K (atıfla) | İçerik CC BY 4.0, ticari serbest; kaynak kod AGPL. `/search?query=` uç noktası var, limit belgelenmemiş, anahtar yalnız export'ta | Kodda yok. Eşleşme alan adıyla değil başlıkla olur (yanlış pozitif riski); sürüm 2 konusu |
| ransomware.live | İ | Ticari kullanım yasak, yazılı onay şart | Kullanma |
| VirusTotal Public API | İ | Ticari kullanım yasak | Ticari lisans al ya da skordan çıkar (kodda `checkVirusTotal`) |
| Google Safe Browsing | A | Ticari ürün için uygun değil | Web Risk API (ücretli) ya da çıkar (kodda `checkGoogleSafeBrowsing`) |
| Censys | İ | Free/Researcher/anonim kullanıcıya iç iş dahil **her ticari kullanım yasak** | Starter/Search planı ya da kaldır |
| Have I Been Pwned | A | Alan adı araması yalnız sahipliği doğrulanmış alan için; Pro plan MSP/bulk doğrulama sunsa da tedarikçinin alanını biz doğrulayamayız | Tedarikçi bazlı HIBP'yi kullanma; ihlal verisi için Hudson Rock'a dayan |
| Hudson Rock | İ | Ücretsiz API'nin ticari kullanım şartı bulunamadı (yalnız genel site şartları) | Yazılı teyit iste ya da ticari plan |
| AlienVault OTX | İ | EULA: son kullanıcıya yalnız ticari olmayan kullanım için ücretsiz | LevelBlue'dan izin/ticari lisans ya da çıkar |
| Qualys SSL Labs | İ | Ticari kullanım için Qualys'in açık izni gerekir; v3 kapanma riski | Yazılı izin iste; alternatif: kendi TLS testimiz |
| Mozilla (MDN) Observatory | İ | Şartlara göre yalnız **sahibinin izin verdiği** siteler taranmalı; ticari kullanım açık değil | Tedarikçi onayıyla taranmıyorsa kullanma; kendi başlık denetimimizle değiştir |
| crt.sh | Doğrulanmadı | Sertifika şeffaflık logları kamusal; crt.sh'nin ticari şartı okunmadı | Şartı oku; yedek: Certspotter |

Kural: "İ" ve "A" kaynaklar çözülene kadar satışa konu özellikte "hazır" sayılmaz; skor/rapordan çıkarılabilir ya da lisans alınır. Karar bekleyen: hangi kaynak ücretli plana geçilecek, hangisi çıkarılacak.

### Lisans anahtarı (altyapı hazır)
- `DATASOURCE_LICENSE_ENFORCE=1` → yalnızca `DATASOURCE_LICENSE_<KAYNAK>=1` olan kaynaklar çağrılır, diğerleri "ölçülemedi" sayılır. Varsayılan kapalı (hepsi çalışır).
- Kaynak adları: VIRUSTOTAL, SAFEBROWSING, CENSYS, OTX, SSLLABS, HUDSONROCK, THREATFOX, URLHAUS, MOZILLA, RANSOMLOOK.
- Satıştan önce: ENFORCE=1 yap; lisansını/iznini aldığın kaynakları 1 yap. Safe Browsing yerine ücretli Web Risk için `WEB_RISK_API_KEY` ver (anahtar varsa o kullanılır).
- RansomLook bilgi amaçlı (skora girmez), tam alan adı eşleşmesiyle `tprmExtra.ransomLook` içine yazılır; atıf raporda otomatik.
- Certspotter (ücretli, `CERTSPOTTER_API_KEY`) crt.sh yedeği olarak eklendi; CISA KEV zaten kullanılıyor. Ayrıntı: "Veri Kaynakları Lisans Rehberi" dökümanı.

## 2. Temizlik
- [ ] Demo uçlarını kaldır: `routes/admin-panel/tprm-demo.ts`
- [ ] sasa-demo hesabını ve test tedarikçilerini (11–24) sil

## 3. Ürün/hukuk
- [ ] BDDK eşlemesini uyum/hukuk ile doğrulat
- [ ] Destek erişimi talebi için bildirim e-postası (e-posta servisi hazır olunca)
- [ ] E-posta servisi ve Iyzico (en son)
- [ ] Kullanım koşulları/KVKK metninde tedarikçi taramasının dayanağı ve dış kaynak atıfları
- [ ] **Yazılı onay çerçevesi (hukuk):** Müşterinin tedarikçisinden aldığı yazılı onayla aktif zafiyet taraması / derin kontrol yapılması için avukat görüşü (TCK 243-244 yetkisiz erişim riski, onay metni şablonu, kapsam/IP aralığı/süre, tedarikçinin üçüncü taraf barındırıcısı için ayrı izin gerekip gerekmediği). Onay kaydı ve kapısı (`vendorHasConsent`) hazır; **aktif tarama modülü henüz yok** — hukuk onayı çıkmadan yazılmamalı.
- [ ] Kanıt belgeleri ve onay belgeleri veritabanında saklanıyor (3 MB sınır): saklama süresi, KVKK aydınlatma ve silme politikası belirlenmeli; virüs taraması yok (yalnızca PDF/PNG/JPG içerik doğrulaması).
- [ ] Alt sağlayıcı beyanı ve kanıt belgeleri doğrulanmamış beyandır; müşteri sözleşmelerinde bu ifade korunmalı.
