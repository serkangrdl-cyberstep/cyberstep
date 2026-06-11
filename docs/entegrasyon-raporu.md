# CyberStep.io — Entegrasyon Kataloğu Raporu

**Tarih:** Haziran 2026  
**Kapsam:** Tüm platform ve güvenlik entegrasyonları — durum, seviye, maliyet ve amaç  

---

## Yönetici Özeti

| Durum | Adet |
|-------|------|
| Aktif (API key gerekmez, her zaman açık) | 18 |
| Aktif (API key mevcut, çalışıyor) | 9 |
| API Key Bekliyor (kod hazır, key girilmemiş) | 14 |
| Müşteri Başına Yapılandırılır | 11 |
| Planlanıyor / Hazırlık Aşaması | 4 |
| **Toplam** | **56** |

**Maliyet Dağılımı:** 22 entegrasyon tamamen ücretsiz — bunlar platform değerinin büyük kısmını oluşturuyor. 8 entegrasyon freemium (ücretsiz başlar, yüksek hacimde ücretlendirilir). 14 entegrasyon ticari/ücretli.

---

## 1. Tehdit İstihbaratı

### 1.1 CISA KEV
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — sunucu başlangıcında indirilir, 24 saatte bir yenilenir |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** CVE'lerin tümü eşit önemde değildir. CISA KEV, ABD siber güvenlik ajansının gerçek fidye yazılımı ve APT saldırılarında aktif olarak kullanıldığını doğruladığı ~1.100 CVE'yi listeler. Bir müşterinin altyapısında KEV'deki bir açık varsa bu en öncelikli uyarıdır.

**Nasıl çalışır:** Shadow IT taramasıyla tespit edilen yazılım versiyonları (WordPress, Apache, jQuery vb.) KEV listesiyle eşleştirilir. Eşleşen her CVE tarama raporunda kırmızı alarm olarak işaretlenir. EPSS puanıyla birleştirildiğinde "teorik açık" ile "yarın istismar edilecek açık" ayrımı yapılır.

---

### 1.2 URLhaus (Abuse.ch)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — her domain taramasında anlık sorgu |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Bir sitenin zararlı yazılım dağıtımında kullanılıp kullanılmadığını tespit eder. 200.000+ zararlı URL içeren bu liste, e-posta filtrelerinden kaçan phishing linklerini de kapsar.

**Nasıl çalışır:** Her domain taramasında URLhaus API'sine anlık sorgu atılır. Eşleşme varsa tarama raporunda "Zararlı İçerik Dağıtımı" uyarısı olarak gösterilir.

---

### 1.3 Feodo Tracker (Abuse.ch)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — domain IP'leri botnet C2 listesiyle karşılaştırılır |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Emotet, TrickBot, IcedID, QakBot gibi aktif botnet komuta-kontrol (C2) sunucularının IP listesi. Bir müşterinin sunucusu bu IP aralığındaysa saldırganlar sistemi zaten kontrol altında tutuyor olabilir.

**Nasıl çalışır:** Domain'in A kayıtları DNS ile çözümlenir, Feodo C2 IP listesiyle (6 saatte bir yenilenen) karşılaştırılır. Eşleşme varsa kritik alarm üretilir.

---

### 1.4 ThreatFox (Abuse.ch)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — her taramada IOC veritabanı sorgusu |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** 1M+ güvenlik ihlali göstergesi (IOC) barındıran bu veritabanı APT grupları ve fidye çetelerini (Cobalt Strike, LockBit, Emotet) yakalar. Anonim kullanım ücretsiz.

**Nasıl çalışır:** Her domain taramasında ThreatFox API'sine sorgu atılır. Eşleşme varsa tehdit tipi ve malware adı rapora eklenir.

---

### 1.5 USOM
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — BTK/USOM listesiyle anlık eşleştirme |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Türkiye'ye özgü siber tehditleri yakalar. Uluslararası tehdit listelerinde görünmeyebilecek, BTK'nın zararlı olarak işaretlediği domain'lerin tespiti için kritik. CyberStep'in "Türk KOBİ'ye özel" konumlanmasını destekler.

**Nasıl çalışır:** usom.gov.tr'den periyodik olarak çekilen kara liste önbellekte tutulur. Domain taramasında anlık eşleştirme yapılır.

---

## 2. İtibar & Kötücül Yazılım

### 2.1 VirusTotal
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Ücretsiz: 500 istek/gün | Premium: $30/ay |
| **Entegrasyon Seviyesi** | Kod hazır, API key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `VIRUSTOTAL_API_KEY` |

**Neden kuruldu:** Tek bir kara listeye güvenmek yerine Kaspersky, Sophos, CrowdStrike gibi 70 farklı güvenlik firmasının motorunu tek API çağrısıyla kullanır. Tarama raporunda "VirusTotal İtibar" kartı olarak gösterilir.

---

### 2.2 Google Safe Browsing
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ücretsiz (10.000 istek/gün) |
| **Entegrasyon Seviyesi** | Kod hazır, API key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `GOOGLE_SAFE_BROWSING_API_KEY` |

**Neden kuruldu:** Chrome/Firefox/Safari'nin güvensiz işaretlediği domainleri tespit eder. 4 milyar kullanıcı verisiyle beslenen en geniş kapsamlı gerçek kullanıcı tabanlı phishing ve malware tespiti.

---

### 2.3 AbuseIPDB
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Ücretsiz: 1.000/gün | Basic: $20/ay |
| **Entegrasyon Seviyesi** | Kod hazır, API key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `ABUSEIPDB_API_KEY` |

**Neden kuruldu:** Mail sunucusu IP'si kara listedeyse e-postalar otomatik spam kutusuna düşer; web sunucusu kötü itibarına sahipse SEO zarar görür. Domain'in MX ve A kayıtlarındaki IP'ler sorgulanır.

---

### 2.4 AlienVault OTX
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Kod hazır, API key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `OTX_API_KEY` |

**Neden kuruldu:** 200.000+ güvenlik araştırmacısının katkısıyla oluşan küresel tehdit platformu. Domain'in kaç aktif tehdit kampanyasında görüntülendiğini ve Türkiye'ye hedefli saldırılarla ilişkisini gösterir.

---

### 2.5 GreyNoise
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Community: Ücretsiz 1.000/gün | Teams: $99/ay |
| **Entegrasyon Seviyesi** | Kod hazır, API key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `GREYNOISE_API_KEY` |

**Neden kuruldu:** "Bu IP bizi hedef alıyor mu yoksa sadece genel internet taraması mı yapıyor?" sorusunu yanıtlar. Yanlış alarmları dramatik azaltır, Shodan verileriyle birlikte IP niyetini sınıflandırır.

---

## 3. Güvenlik Vendor Feed'leri

> Bu kategorideki entegrasyonlar henüz API key girilmemiş, kod altyapısı hazır. Ticari bütçe gerektirdiğinden müşteri talebine göre aktifleştirilecek.

### 3.1 FortiGuard (Fortinet)
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ticari — Web lookup ücretsiz, tam IoC feed ticari abonelik |
| **Gerekli Ortam Değişkeni** | `FORTIGUARD_API_KEY` |

**Neden kuruldu:** Fortinet dünyanın en büyük güvenlik vendor'larından biri. FortiGuard Labs milyonlarca cihazdan beslenen gerçek zamanlı tehdit verisi sağlar; Türkiye'deki KOBİ'lerin büyük kısmı FortiGate kullanır, bu nedenle vendor uyumu kritik.

---

### 3.2 Palo Alto Unit 42 / AutoFocus
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ticari — AutoFocus + WildFire abonelik |
| **Gerekli Ortam Değişkeni** | `AUTOFOCUS_API_KEY` |

**Neden kuruldu:** Dünya çapında en saygın tehdit araştırma ekiplerinden Unit 42'nin kampanya ve aktör istihbaratı. Enterprise müşterilere yönelik derin APT analizi için.

---

### 3.3 Check Point ThreatCloud
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ticari |
| **Gerekli Ortam Değişkeni** | `CHECKPOINT_API_KEY` |

**Neden kuruldu:** Check Point güvenlik duvarlarından toplanan devasa telemetriyle gerçek zamanlı tehdit korelasyonu.

---

### 3.4 Cisco Talos / Umbrella
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ticari |
| **Gerekli Ortam Değişkeni** | `TALOS_API_KEY` |

**Neden kuruldu:** İnternet trafiğinin önemli kısmını gözlemleyen Cisco Talos'un DNS katmanı görünürlüğü benzersizdir. Domain itibarı sorgulamasında tamamlayıcı veri kaynağı.

---

## 4. CTI Platformları

### 4.1 MISP
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor (self-hosted kurulum gerektirir) |
| **Maliyet** | Açık kaynak (ücretsiz, altyapı maliyeti müşteriye ait) |
| **Gerekli Ortam Değişkeni** | `MISP_API_KEY` |

**Neden kuruldu:** MISP, güvenlik toplulukları arasında yapılandırılmış IOC paylaşımının fiili standardıdır. SOC Pro müşteriler için kendi MISP örneklerinden periyodik IOC senkronizasyonu planlanıyor.

---

### 4.2 OpenCTI
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor (self-hosted kurulum gerektirir) |
| **Maliyet** | Açık kaynak (ücretsiz) |
| **Gerekli Ortam Değişkeni** | `OPENCTI_API_TOKEN` |

**Neden kuruldu:** STIX2 tabanlı GraphQL API ile tehdit göstergesi ve aktör ilişkilerini grafik veri modeliyle yönetir. Büyük kurumsal müşterilerin mevcut CTI altyapısına entegrasyon için.

---

## 5. Güvenlik Cihazı Entegrasyonları (Müşteri Başına)

> Bu entegrasyonlar platform genelinde değil, her müşteri için ayrı ayrı yapılandırılır. Müşteri kendi cihazı için erişim bilgilerini yönetim panelinden girer.

### 5.1 Jira
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin Jira aboneliği |
| **Entegrasyon Seviyesi** | Çift yönlü — kritik/yüksek bulgulardan otomatik ticket oluşturma |

**Neden kuruldu:** Güvenlik bulgularını IT operasyon iş akışlarına taşır. Kritik veya yüksek önem dereceli bulgular tespit edildiğinde tanımlı Jira projesine otomatik ticket açılır; müşteri ekibinin ayrıca takip sistemi kurmasına gerek kalmaz.

**Nasıl çalışır:** Müşteri panelinden Jira URL, e-posta, API token ve proje anahtarı girilir. Yeni kritik bulgu oluştuğunda `createJiraTicket()` çağrılır, ticket ID `vendor_events` tablosuna kaydedilir.

---

### 5.2 FortiManager
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin Fortinet lisansı |
| **Entegrasyon Seviyesi** | Otomatik müdahale — tespit → otomatik IP bloklama |

**Neden kuruldu:** Tespit edilen zararlı IP'lerin müşterinin FortiGate firewall'ına otomatik blok kuralı olarak gönderilmesi. "Tespit et ve otomatik savun" döngüsü kurar. Bu entegrasyon diğerlerine kıyasla en yüksek operasyonel değeri taşır.

**Nasıl çalışır:** AES-256-GCM ile şifrelenmiş kimlik bilgileri (`ENCRYPTION_KEY` Secret gerektirir). SOC triage tespit ettiğinde `autoBlockOnFortiManager()` çağrılır; FortiManager REST API'siyle ADOM kapsamında adres nesnesi ve blok kuralı oluşturulur.

---

### 5.3 IBM QRadar
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin QRadar lisansı |
| **Entegrasyon Seviyesi** | Tek yönlü — güvenlik olayları QRadar'a iletilir |

**Neden kuruldu:** SIEM'i QRadar olan büyük kurumsal müşterilerin CyberStep'teki olayları kendi merkezi güvenlik panosunda görmesi için. QRadar Custom Event Processor (CEP) üzerinden olaylar syslog formatında iletilir.

---

### 5.4 Fortinet FortiSIEM
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin FortiSIEM lisansı |
| **Entegrasyon Seviyesi** | Tek yönlü — olaylar FortiSIEM'e iletilir |

**Neden kuruldu:** Fortinet ekosistemi kullanan kurumsal müşterilere yönelik. FortiSIEM REST API'siyle olaylar doğrudan iletilir.

---

### 5.5 CrowdStrike Falcon
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin CrowdStrike lisansı |
| **Entegrasyon Seviyesi** | Çift yönlü — IOC push + tehdit paylaşımı |

**Neden kuruldu:** Tespit edilen zararlı IP, domain ve hash'lerin CrowdStrike Falcon'a IOC olarak gönderilmesi. Müşterinin EDR sistemiyle senkron çalışır; aynı IOC'yi hem CyberStep SOC hem de endpoint koruması engeller.

---

### 5.6 Trend Micro Vision One
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin Trend Micro lisansı |
| **Entegrasyon Seviyesi** | Tek yönlü — IOC'ler Suspicious Object List'e eklenir |

**Neden kuruldu:** Trend Micro kullanan müşteriler için tespit edilen zararlı göstergelerin endpoint korumasına otomatik beslenmesi.

---

### 5.7 FortiGate Firewall (Doğrudan)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin FortiGate lisansı |
| **Entegrasyon Seviyesi** | Çift yönlü — log okuma + otomatik kural yazma |

**Neden kuruldu:** FortiManager'sız ortamlar için doğrudan FortiGate API entegrasyonu. Tehdit log'ları çekilir, tespit edilen IOC'ler için adres nesnesi ve blok kuralı oluşturulur.

---

### 5.8 Microsoft 365 (Graph API)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri OAuth onayıyla) |
| **Maliyet** | Microsoft 365 lisansına dahil |
| **Entegrasyon Seviyesi** | OAuth2 çok-kiracılı — denetim log izleme + SOC korelasyonu |
| **Gerekli Ortam Değişkeni** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |

**Neden kuruldu:** Türkiye'deki KOBİ'lerin büyük çoğunluğu Microsoft 365 kullanıyor. Azure AD denetim logları, şüpheli giriş denemeleri ve olağandışı yetkili işlemler SOC korelasyonuna beslenir. "Müşteride MS365'ten şüpheli bir login var mı?" sorusunu yanıtlar.

**Nasıl çalışır:** Müşteri, OAuth2 PKCE akışıyla CyberStep'e Graph API okuma izni verir. Polling cron'u her 15 dakikada denetim loglarını çeker, şüpheli olayları `fabric_events` tablosuna işler ve SOC'ta korelasyon yapılır.

---

### 5.9 ServiceNow ITSM
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri yapılandırmasıyla) |
| **Maliyet** | Müşterinin ServiceNow lisansı |
| **Entegrasyon Seviyesi** | Çift yönlü — SOC case ↔ INC ticket senkronizasyonu |
| **Gerekli Ortam Değişkeni** | `SERVICENOW_INSTANCE_URL` (müşteri başına) |

**Neden kuruldu:** ITSM süreçleri ServiceNow üzerinden yürüyen müşterilerde SOC vakalarının IT operasyon iş akışlarıyla entegrasyonu. Manuel veri girişini ortadan kaldırır, SLA takibini merkezileştirir.

**Nasıl çalışır:** SOC case açılınca ServiceNow Table API'ye POST atılır, INC numarası kaydedilir. 15 dakikada bir cron SN durumunu çeker; SN'de kapanan vakalar CyberStep'te de kapatılır. Analist notları SN `work_notes`'a yazılır. Benzersiz index (`UNIQUE(customer_id)`) upsert çakışmalarını önler.

---

## 6. Altyapı & Açık Yönetimi

### 6.1 Shodan
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (ücretli plan — Member) |
| **Maliyet** | Ücretli — Member: $49/ay |
| **Entegrasyon Seviyesi** | Çift kullanım: domain tarama + lead discovery |
| **Gerekli Ortam Değişkeni** | `SHODAN_API_KEY` |

**Neden kuruldu:** İki kritik amaç: (1) Müşteri domain taramasında açık portları (RDP:3389, MongoDB:27017, Elasticsearch:9200) tespit eder. Veri sızdıran açık veritabanları en sık bulunan kritik açık. (2) Türkiye'de potansiyel müşteri firmalar için lead discovery — Türkçe TLD'lere sahip şirketleri SSL sertifika bazlı tarar. Ücretsiz "oss" plan search API'yi devre dışı bırakır; `basic`/`dev`/`member` plan gerekli.

**Nasıl çalışır:** Domain taramasında IP Shodan'da sorgulanır, açık port ve CVE listesi rapora eklenir. Lead discovery'de `SHODAN_FREE_QUERIES` listesinden **4 sorgu/gece** (gün-bazlı 8 sorguluk havuzdan idx1–idx4 rotasyonu) farklı TR sektörü sorguları çalıştırılır; sonuçlar `lead_candidates` tablosuna işlenir. *(Haziran 2026: 2'den 4 sorgu/geceye yükseltildi — günlük keşif kapasitesi iki katına çıktı.)*

---

### 6.2 SecurityTrails
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Ücretsiz: 50/ay | API: $50/ay'dan |
| **Gerekli Ortam Değişkeni** | `SECURITYTRAILS_API_KEY` |

**Neden kuruldu:** Geçmiş DNS kayıtları ve gizli subdomain'ler saldırı yüzeyini ortaya çıkarır. crt.sh'in bulamadığı pasif DNS verisini sağlar; domain el değiştirme ve altyapı değişikliklerini geriye dönük gösterir.

---

### 6.3 Censys
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Ücretsiz: 250 sorgu/ay |
| **Gerekli Ortam Değişkeni** | `CENSYS_API_ID`, `CENSYS_API_SECRET` |

**Neden kuruldu:** Shodan'a tamamlayıcı internet tarama veri kaynağı. TLS yapılandırması ve sertifika ayrıntılarını farklı bakış açısıyla doğrular.

---

### 6.4 Cloudflare Radar
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Ücretsiz (API token gerektirir) |
| **Gerekli Ortam Değişkeni** | `CLOUDFLARE_API_TOKEN` |

**Neden kuruldu:** Türkiye internet trafiği ve DDoS anomalileri. Müşteriye yönelik tehditleri makro bağlama oturtur; "Bu hafta Türkiye'de saldırı dalgası var mı?" sorusunu yanıtlar.

---

### 6.5 WhoisXML API
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Ücretsiz: 1.000/ay |
| **Gerekli Ortam Değişkeni** | `WHOISXML_API_KEY` |

**Neden kuruldu:** Domain el değiştirme ve DNS manipülasyon tespiti. KOBİ'lerde giderek artan Domain Hijacking tehdidine karşı; sahiplik değişikliği veya şüpheli DNS manipülasyonu otomatik uyarı üretir.

---

### 6.6 crt.sh (Certificate Transparency Logs)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) — iki amaçla kullanılıyor |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — domain tarama + lead discovery |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** (1) Müşteri domain taramasında gizli alt alanları ortaya çıkarır — eski test sunucuları, terk edilmiş projeler genellikle korumasız kalır. (2) Lead discovery'de Türk TLD'lerine (`.com.tr`, `.net.tr`, `.org.tr`, `.bel.tr`, `.edu.tr`) ait sertifika logları taranarak potansiyel müşteri firma listesi oluşturulur.

**Nasıl çalışır:** `daysBack: 90` penceresiyle ilgili TLD için sertifika şeffaflık logları sorgulanır. Kurumsal skor (10+) filtresini geçen unique root domain'ler `lead_candidates` tablosuna yazılır. Paralel istekler FIFO kuyruğuyla serileştirilir (429 rate-limit'i önlemek için).

---

## 7. Protokol & Sertifika

### 7.1 Qualys SSL Labs
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — her taramada harf notu alınır |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** TLS protokol versiyonu, şifre zayıflığı, sertifika zinciri ve HSTS kontrolü için endüstri standardı bağımsız değerlendirme. PCI-DSS uyumluluğu için SSL notunun A olması zorunlu; bu not müşteriye doğrudan görünür ve somut aksiyon gerektirir.

---

### 7.2 Mozilla Observatory
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — her taramada başlık analizi |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** SSL Labs ile tamamlayıcı: TLS değil HTTP katmanı güvenlik başlıklarını (CSP, HSTS, X-Frame-Options) değerlendirir. Eksik CSP başlığı XSS saldırılarının kapısını açar. A-F harf notu müşteriye açıklamak kolaydır.

---

### 7.3 NVD CVE (NIST)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — shadow IT yazılımları CVE veritabanıyla eşleştirilir |
| **Gerekli Ortam Değişkeni** | `NVD_API_KEY` (rate-limit artışı için opsiyonel) |

**Neden kuruldu:** Tespit edilen servislerin (WordPress eklenti versiyonu, jQuery sürümü, Apache versiyonu) bilinen açıklarını NVD'nin 200.000+ CVE'sinden tarar. CVSS puanı yüksek açıklar öncelikli olarak raporlanır.

**Nasıl çalışır:** Her 2 saatte bir CISA KEV ve NVD feed'i indirilir. Teknografik parmak izi eşleşmesiyle CVE'ler müşteri tech stack'ine map edilir; Claude AI Türkçe etki açıklaması üretir, e-posta bildirimi gönderilir.

---

### 7.4 EPSS (FIRST.org)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — NVD CVE'leri EPSS puanıyla zenginleştirilir |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** NVD'nin CVSS puanı teorik şiddeti ölçer; EPSS ise gerçek saldırı verilerinden makine öğrenimiyle hesaplanmış "önümüzdeki 30 günde istismar olasılığı" yüzdesini verir. Önceliklendirme kararlarını dramatik iyileştirir. Pentest Lite modülünde de KEV+EPSS zenginleştirmesi kullanılır.

---

## 8. E-posta & Kimlik

### 8.1 Have I Been Pwned (HIBP)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — her taramada domain bazlı sızıntı sorgusu |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Çalışan kimlik bilgilerinin dark web'de bulunması hesap ele geçirme riskini dramatik artırır. "Şirketinize ait e-postalar 750+ veri sızıntısında var mı?" sorusu müşterinin anlayacağı somut bir risk ifadesidir.

---

### 8.2 SPF / DMARC / DKIM Analizi
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz (DNS sorgusu) |
| **Entegrasyon Seviyesi** | Tam — her taramada DNS kayıtları analizi |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Bu kayıtlar eksikse saldırganlar şirket adına sahte e-posta gönderebilir. CEO fraud saldırılarının %91'i e-posta sahteciliğiyle başlar. Türkiye'deki KOBİ'lerin büyük çoğunluğunda bu kayıtlar eksik veya hatalı — düzeltmesi kolay, etkisi yüksek bulgu.

---

### 8.3 DNSBL Kara Listeleri
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — 15+ liste DNS sorgusuyla kontrol edilir |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Spamhaus, Barracuda, SORBS, SpamCop gibi 15+ kara listede IP ve domain kontrolü. Kara listedeki mail sunucusunun gönderdiği e-postalar otomatik spam kutusuna düşer — müşteri bunun farkında bile olmayabilir.

---

## 9. Yapay Zeka

### 9.1 Google Gemini 2.5 Flash
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz plan (Replit AI Integrations otomatik sağlar) |
| **Entegrasyon Seviyesi** | Tam — Mini Assessment raporları + SSE chat |
| **Gerekli Ortam Değişkeni** | `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL` (Replit otomatik) |

**Neden kuruldu:** Ham güvenlik verilerini CEO'nun anlayabileceği, aksiyona dönüştürülebilir Türkçe rapora çevirir. Ücretsiz planda kullanıcılar için temel AI motoru. Assessment tamamlanınca tüm bulgular Gemini'ye gönderilir, sektöre özel risk raporu oluşturulur.

---

### 9.2 Anthropic Claude Sonnet 4.6
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (Starter/Pro plan müşteriler + platform işlemleri) |
| **Maliyet** | Ücretli plan (Replit AI Integrations — token bazlı) |
| **Entegrasyon Seviyesi** | Tam — 10+ farklı modül tarafından kullanılıyor |
| **Gerekli Ortam Değişkeni** | `ANTHROPIC_API_KEY` (Replit AI Integrations) |

**Neden kuruldu:** Güvenlik bulgularında bağlam anlama, nüans ve Türkçe ifade kalitesi açısından Gemini'den önde gelir. Platform işlemleri (SOC triage, pentest analizi, haftalık bülten, yönetim raporu, saldırı yolu analizi, AI güvenlik değerlendirmesi, digest özeti) Claude ile çalışır.

**Kullanıldığı modüller:**
- SOC Otomatik Triage & Playbook (`claude-haiku-4-5` hız, `claude-sonnet-4-6` derin)
- Attack Path Analysis (MITRE ATT&CK mapped saldırı zinciri)
- Pentest Lite (EPSS/KEV zenginleştirmeli senaryo analizi)
- Haftalık Güvenlik Bülten (7 bölümlü içerik)
- Yönetim Kurulu Raporu (C-suite özeti)
- AI Güvenlik Değerlendirmesi (rapor + politika belgesi)
- CVE Türkiye Etki Sistemi (Türkçe etki açıklaması)
- Intelligence Report Engine (aylık pazar raporu)
- Digest Haber Özeti

---

## 10. İletişim

### 10.1 SMTP E-posta
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif |
| **Maliyet** | Değişken (SMTP sağlayıcısına göre) |
| **Entegrasyon Seviyesi** | Tam — tüm sistem e-postaları bu kanaldan geçer |
| **Gerekli Ortam Değişkeni** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Secret) |

**Neden kuruldu:** Platform e-posta altyapısı — müşteri raporları, güvenlik bildirimleri, onboarding serisi (D+3, D+7), SOC eskalasyonları, haftalık bülten, yenileme hatırlatmaları ve teaser e-postaları bu kanal üzerinden gönderilir.

---

### 10.2 ISR IMAP (AI Satış Asistanı)
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (super-admin özel) |
| **Maliyet** | Ücretsiz (IMAP erişimi) |
| **Entegrasyon Seviyesi** | Tam — 5 dakikada bir e-posta okuma + otomatik AI yanıt |
| **Gerekli Ortam Değişkeni** | `ISR_IMAP_HOST`, `ISR_IMAP_PORT`, `ISR_IMAP_USER`, `ISR_IMAP_PASS` (Secret) |

**Neden kuruldu:** 7/24 çalışan AI satış temsilcisi. Potansiyel müşteri e-postasını 5 dakika içinde bağlam bilinçli Türkçe yanıtla karşılar. Gemini AI ile yanıt üretilir, SMTP ile gönderilir.

---

## 11. Bildirim & Alarm

### 11.1 Generic Webhook
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri tanımlamasıyla) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — HMAC-SHA256 imzalı outbound POST |

**Neden kuruldu:** Zapier, Make, n8n veya müşteri kendi endpoint'iyle tek entegrasyon noktasından 5.000+ uygulamaya köprü kurulur. "Biz Notion/Slack/Teams kullanıyoruz" diyen müşteriyi 10 dakikada çözer. Başarısız teslimatlar 10 dakikada bir 5 denemeye kadar retry yapılır.

---

### 11.2 Telegram Bot
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri tanımlamasıyla) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — SOC alarmları MarkdownV2 formatında iletilir |

**Neden kuruldu:** Türkiye'de IT direktörlerinin tercihi. WhatsApp'a bağımlılığı ortadan kaldırır; kurumsal ağlarda kısıtlanmaz. Kritik vakalar, SLA ihlalleri ve case kapanışları anlık bildirim olarak gelir.

---

### 11.3 NetGSM SMS
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (müşteri tanımlamasıyla) |
| **Maliyet** | Kullanım bazlı (SMS başına birkaç kuruş) |
| **Entegrasyon Seviyesi** | Tam — XML API, AES-256-GCM şifreli kimlik bilgisi |

**Neden kuruldu:** WhatsApp kurumsal ağlarda kısıtlanabilir veya down olabilir; SMS kritik alarm için yedek kanaldır. NetGSM Türkiye'nin lider SMS operatörü. Kritik SOC alarmları ve SLA ihlalleri için kullanılır.

---

### 11.4 Microsoft Teams (Planned)
| Alan | Bilgi |
|------|-------|
| **Durum** | Planlanıyor (kod taslağı mevcut) |
| **Maliyet** | Microsoft 365 lisansına dahil |
| **Entegrasyon Seviyesi** | Kod tasarımı tamamlandı, müşteri UI'ı hazır |

**Neden kuruldu:** KOBİ'lerde Slack'ten yaygın. IT ekiplerinin zaten açık tuttuğu kanala alarm düşmesi yanıt süresini kısaltır. Incoming Webhook üzerinden Adaptive Card formatında iletilecek.

---

### 11.5 OpsGenie (Planned)
| Alan | Bilgi |
|------|-------|
| **Durum** | Planlanıyor (kod tasarımı mevcut) |
| **Maliyet** | Essentials: $9/kullanıcı/ay |
| **Entegrasyon Seviyesi** | Kod tasarımı tamamlandı, müşteri UI'ı hazır |

**Neden kuruldu:** SOC Pro tier için on-call rotasyonu şart. SLA ihlali anında nöbetçi analisti uyandırır; eskalasyon politikası OpsGenie tarafında yönetilir. Jira ile native entegre olduğundan kurumsal müşterilerde tercih edilir.

---

## 12. Ödeme & Faturalandırma

### 12.1 Iyzico Ödeme
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Komisyonlu — %2,5 + 0,25 TL/işlem |
| **Entegrasyon Seviyesi** | Kod altyapısı hazır |
| **Gerekli Ortam Değişkeni** | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` |

**Neden kuruldu:** Türkiye'nin lider ödeme altyapısı. BKM Express, 3D Secure, taksit desteği ve BDDK lisansı. Stripe'a kıyasla Türk bankalarıyla daha düşük red oranı. Abonelik yenilemeleri otomatik tahsil edilir.

---

### 12.2 E-Fatura / E-Arşiv (GİB)
| Alan | Bilgi |
|------|-------|
| **Durum** | Planlanıyor |
| **Maliyet** | GİB entegratörü aboneliği (Editel/Logo/Mikro) |
| **Gerekli Ortam Değişkeni** | `E_INVOICE_API_KEY`, `E_INVOICE_API_URL` |

**Neden kuruldu:** Türkiye'de belirli ciro üstü şirketler için e-Fatura/e-Arşiv zorunludur. Enterprise fatura oluşturulduğunda UBL-TR 2.1 XML otomatik üretilip GİB entegratörüne gönderilecek.

---

## 13. Satış & Lead Gen (Dahili)

### 13.1 Certstream
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (WebSocket her zaman açık) |
| **Maliyet** | Ücretsiz (certstream.calidog.io açık endpoint) |
| **Entegrasyon Seviyesi** | Tam — gerçek zamanlı CT log akışı, Türk TLD filtresi |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** Real-time sertifika şeffaflık log akışı. Yeni `.com.tr`, `.net.tr`, `.org.tr` sertifikası düzenlendiğinde anlık olarak yakalanır. Lead generation için crt.sh'e tamamlayıcı; crt.sh haftalık toplu tarama yaparken Certstream anlık yakalamayı sağlar.

**Nasıl çalışır:** Kalıcı WebSocket bağlantısı (`wss://certstream.calidog.io`) Türk TLD sertifikalarını filtreler. Saatlik cron kuyruktaki domain'leri `lead_candidates` tablosuna işler.

---

### 13.2 Apollo.io
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Basic: $49/ay |
| **Entegrasyon Seviyesi** | Kod hazır, key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `APOLLO_API_KEY` |

**Neden kuruldu:** Tespit edilen potansiyel müşteri domain'leri için karar verici isimlerini (CTO, IT Direktörü, CISO) ve e-posta adreslerini otomatik bulur. Lead enrichment pipeline'ının ikinci aşaması.

---

### 13.3 Hunter.io
| Alan | Bilgi |
|------|-------|
| **Durum** | API Key Bekliyor |
| **Maliyet** | Freemium — Starter: $34/ay |
| **Entegrasyon Seviyesi** | Kod hazır, key girilince aktifleşir |
| **Gerekli Ortam Değişkeni** | `HUNTER_API_KEY` |

**Neden kuruldu:** Apollo'ya tamamlayıcı e-posta doğrulama ve kişi keşfi. Şirketin e-posta formatını ve doğrulanmış iletişim adreslerini sağlar.

---

### 13.4 RIPE stat.ripe.net
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz |
| **Entegrasyon Seviyesi** | Tam — gece 02:00 otomatik çalışır |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** crt.sh ve Shodan'dan bağımsız üçüncü bir lead kaynağı. RIPE NCC'nin Türkiye'ye tahsis ettiği ~2.000 IPv4 prefix bloğunu sağlar. API key gerektirmez, tamamen açık bir API'dir. Bu kaynakla sertifika loglarında görünmeyen yeni Türk şirketlerini ve kurumları keşfetmek mümkün.

**Nasıl çalışır:** Her gece 02:00'de (İstanbul saati) `stat.ripe.net/data/country-resource-list/data.json?resource=TR` sorgulanır. Dönen prefix listesinden ~60 rastgele prefix seçilir (HackerTarget günlük limit koruması), her prefix için örnek IP'ler üretilir. Bu IP'ler HackerTarget reverse DNS ile hostname'e çevrilir. `.tr` uzantılı domain'ler `lead_candidates` tablosuna yazılır; günde 40-80 yeni aday potansiyeli.

---

### 13.5 HackerTarget
| Alan | Bilgi |
|------|-------|
| **Durum** | Aktif (her zaman açık) |
| **Maliyet** | Ücretsiz (~100 istek/gün) |
| **Entegrasyon Seviyesi** | Tam — RIPE DNS pipeline'ının ikinci aşaması |
| **Gerekli Ortam Değişkeni** | Yok |

**Neden kuruldu:** IP adresini hostname'e çeviren reverse DNS lookup API'si. API key gerektirmez, ücretsizdir. RIPE stat'tan alınan ham IP aralıklarını insan tarafından tanınabilir domain adlarına dönüştürür. Sadece RIPE DNS pipeline'ında kullanılır (müşteri tarama akışında kullanılmaz).

**Nasıl çalışır:** `https://api.hackertarget.com/reverseiplookup/?q={IP}` endpoint'i çağrılır. `.tr` hostname döndürüyorsa root domain çıkarılır, `lead_candidates` tablosuna eklenir. Günlük ~100 istek limiti `maxPrefixes: 60` parametresiyle korunur (her prefix 1 IP = 60 istek/gece).

---

## Entegrasyon Durumu Özet Tablosu

| Entegrasyon | Kategori | Durum | Maliyet | Seviye |
|-------------|----------|-------|---------|--------|
| CISA KEV | Tehdit İstihbaratı | Aktif | Ücretsiz | Tam |
| URLhaus | Tehdit İstihbaratı | Aktif | Ücretsiz | Tam |
| Feodo Tracker | Tehdit İstihbaratı | Aktif | Ücretsiz | Tam |
| ThreatFox | Tehdit İstihbaratı | Aktif | Ücretsiz | Tam |
| USOM | Tehdit İstihbaratı | Aktif | Ücretsiz | Tam |
| VirusTotal | İtibar & Kötücül Yazılım | API Key Bekliyor | Freemium ($0–$30/ay) | Kod Hazır |
| Google Safe Browsing | İtibar & Kötücül Yazılım | API Key Bekliyor | Ücretsiz | Kod Hazır |
| AbuseIPDB | İtibar & Kötücül Yazılım | API Key Bekliyor | Freemium ($0–$20/ay) | Kod Hazır |
| AlienVault OTX | İtibar & Kötücül Yazılım | API Key Bekliyor | Ücretsiz | Kod Hazır |
| GreyNoise | İtibar & Kötücül Yazılım | API Key Bekliyor | Freemium ($0–$99/ay) | Kod Hazır |
| FortiGuard | Vendor Feed | API Key Bekliyor | Ticari | Kod Hazır |
| Palo Alto Unit 42 | Vendor Feed | API Key Bekliyor | Ticari | Kod Hazır |
| Check Point ThreatCloud | Vendor Feed | API Key Bekliyor | Ticari | Kod Hazır |
| Cisco Talos | Vendor Feed | API Key Bekliyor | Ticari | Kod Hazır |
| MISP | CTI Platform | API Key Bekliyor | Açık Kaynak | Kod Hazır |
| OpenCTI | CTI Platform | API Key Bekliyor | Açık Kaynak | Kod Hazır |
| Jira | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| FortiManager | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam (Otomatik Blok) |
| IBM QRadar | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| FortiSIEM | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| CrowdStrike Falcon | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| Trend Micro Vision One | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| FortiGate (Doğrudan) | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Tam |
| Microsoft 365 | Müşteri Entegrasyonu | Aktif | MS365 Lisansı | OAuth2 Çift Yönlü |
| ServiceNow | Müşteri Entegrasyonu | Aktif | Müşteri Lisansı | Çift Yönlü Senkron |
| Shodan | Altyapı & Keşif | Aktif | $49/ay | Tam (Tarama + Lead, 4 sorgu/gece) |
| SecurityTrails | Altyapı & Keşif | API Key Bekliyor | $0–$50/ay | Kod Hazır |
| Censys | Altyapı & Keşif | API Key Bekliyor | $0–Ücretli | Kod Hazır |
| Cloudflare Radar | Altyapı & Keşif | API Key Bekliyor | Ücretsiz | Kod Hazır |
| WhoisXML | Altyapı & Keşif | API Key Bekliyor | Freemium | Kod Hazır |
| crt.sh | Altyapı & Keşif | Aktif | Ücretsiz | Tam (Tarama + Lead) |
| Qualys SSL Labs | Protokol & Sertifika | Aktif | Ücretsiz | Tam |
| Mozilla Observatory | Protokol & Sertifika | Aktif | Ücretsiz | Tam |
| NVD CVE (NIST) | Protokol & Sertifika | Aktif | Ücretsiz | Tam |
| EPSS (FIRST.org) | Protokol & Sertifika | Aktif | Ücretsiz | Tam |
| HIBP | E-posta & Kimlik | Aktif | Ücretsiz | Tam |
| SPF/DMARC/DKIM | E-posta & Kimlik | Aktif | Ücretsiz | Tam |
| DNSBL Kara Listeleri | E-posta & Kimlik | Aktif | Ücretsiz | Tam |
| Gemini 2.5 Flash | Yapay Zeka | Aktif | Ücretsiz Plan | Tam |
| Claude Sonnet 4.6 | Yapay Zeka | Aktif | Ücretli (token) | Tam (10+ modül) |
| SMTP E-posta | İletişim | Aktif | SMTP sağlayıcısı | Tam |
| ISR IMAP | İletişim | Aktif | Ücretsiz | Tam |
| Generic Webhook | Bildirim & Alarm | Aktif | Ücretsiz | Tam |
| Telegram Bot | Bildirim & Alarm | Aktif | Ücretsiz | Tam |
| NetGSM SMS | Bildirim & Alarm | Aktif | Kullanım bazlı | Tam |
| MS Teams | Bildirim & Alarm | Planlanıyor | MS365 dahil | Tasarım Hazır |
| OpsGenie | Bildirim & Alarm | Planlanıyor | $9/kullanıcı/ay | Tasarım Hazır |
| Iyzico | Ödeme | API Key Bekliyor | %2,5 + 0,25 TL | Altyapı Hazır |
| E-Fatura (GİB) | Ödeme | Planlanıyor | Entegratör aboneliği | Planlanıyor |
| Certstream | Satış & Lead Gen | Aktif | Ücretsiz | Tam |
| Apollo.io | Satış & Lead Gen | API Key Bekliyor | $49/ay | Kod Hazır |
| Hunter.io | Satış & Lead Gen | API Key Bekliyor | $34/ay | Kod Hazır |
| RIPE stat.ripe.net | Satış & Lead Gen | Aktif | Ücretsiz | Tam (RIPE DNS Lead) |
| HackerTarget | Satış & Lead Gen | Aktif | Ücretsiz | Tam (Reverse DNS) |
| Calendly | Üretkenlik | API Key Bekliyor | Freemium | Kod Hazır |

---

*Son güncelleme: 11 Haziran 2026 — CyberStep.io Teknik Ekibi*
