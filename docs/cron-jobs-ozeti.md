# CyberStep.io — Otomatik Görevler (Cron Jobs) Özeti

> **Son güncelleme:** 11 Haziran 2026  
> Sistemin arka planda, insan müdahalesi olmadan otomatik olarak yürüttüğü tüm görevlerin teknik olmayan özeti.

---

## 1. Güvenlik İzleme

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| DNS İzleyici | Her 5 dakikada (+0 dk) | Müşteri alan adlarının DNS kayıtlarını kontrol eder, değişiklik olursa alarm verir | Domain ele geçirme ve kayıt değişikliklerini anında yakalar |
| CT Phishing Tespiti | Her 4 saatte | İnternetteki SSL sertifika kayıtlarını (Certificate Transparency) tarar, müşteri adını taklit eden sahte siteleri arar; tespit edilince e-posta + SOC vakası açar | Müşteriye yönelik phishing hazırlıklarını sahte site yayına girmeden önce fark eder |
| SOC Olay Önceliklendirme | Her 5 dakikada (+1 dk) | Güvenlik cihazlarından gelen olayları değerlendirir, ciddi olanları vakaya dönüştürür | Güvenlik ekibinin önce en kritik olaylara bakmasını sağlar |
| SOC Yanıt Süresi Takibi | Her 5 dakikada (+2 dk) | Açık güvenlik vakalarının yanıt sürelerini kontrol eder, gecikenleri bildirir | SLA taahhütlerine uyulmasını güvence altına alır |
| Güvenlik Olay Korelasyonu | Her 15 dakikada | Farklı güvenlik cihazlarından (FortiGate, QRadar vb.) gelen olayları birleştirip bağlantı kurar | Tek başına anlamsız görünen olayların bir saldırı zincirinin parçası olduğunu ortaya çıkarır |
| Engelleme Doğrulama | Her 6 saatte | FortiManager'da uygulanan IP engellerinin hâlâ aktif olduğunu teyit eder | Güvenlik kurallarının silinmediğinden veya devre dışı kalmadığından emin olur |
| Ağ Cihazı Polling | Her 5 dakikada (+3 dk) | FortiGate cihazlarının anlık olaylarını ve metriklerini çeker | Ağ üzerindeki tehditleri gerçek zamanlı olarak görür |
| Sistem Erişilebilirlik Kontrolü | Her 5 dakikada (+4 dk) | Müşteri sistemlerinin çalışıp çalışmadığını ölçer | Kesintileri müşteri fark etmeden tespit eder |
| NOC Olay Değerlendirme | Her 15 dakikada | NOC alarm kuyruğunu tarar, kritikleri önceliklendirir | NOC ekibinin dikkatini doğru yere çeker |
| Sistem Normalin Güncellenmesi | Her saatte | Ağ cihazı metriklerinin "normal" değerini yeniden hesaplar | Anormallikleri tespit etmek için referans noktasını güncel tutar |
| Saldırı Yolu Analizi | Her gece 02:30 | AI destekli saldırı senaryolarını MITRE ATT&CK çerçevesiyle analiz eder | Saldırganın sistemde nasıl ilerleyebileceğini önceden modeller |
| Bulut Güvenlik Taraması | Her gece 03:45 | Müşterilerin bulut ortamlarını güvenlik açığı ve yanlış yapılandırma için tarar | AWS/Azure/GCP kaynaklarının güvenli kaldığından emin olur |
| GitHub Sır Taraması | Her Pazar 05:00 | GitHub depolarında yanlışlıkla paylaşılmış API anahtarı veya şifre arar | Kod sızıntısı kaynaklı veri ihlallerini önler |

---

## 2. Tehdit İstihbaratı

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| CISA Tehdit Veritabanı Güncelleme | Her gece 01:00 | ABD Siber Güvenlik Ajansı'nın (CISA) aktif istismar edilen zafiyet listesini indirir | En güncel tehdit bilgisiyle müşteri sistemlerini karşılaştırır |
| Siber İstihbarat Akışları | Her 6 saatte | 9 farklı tehdit istihbaratı kaynağını tarar, yeni IOC (tehdit göstergesi) ekler | Bilinen zararlı IP, domain ve dosyalar için uyarı verebilir |
| CVE Güvenlik Açığı Takibi | Her 2 saatte | Yeni açıklanan CVE'leri çeker, müşteri teknoloji stackiyle eşleştirir | Müşteriye özgü kritik açıkları otomatik tespit eder |
| **Kritik CVE Müşteri Bildirimi** | **Her 4 saatte** | **CVSS 9.0+ olan ve henüz bildirilmemiş eşleşmeleri tarar; etkilenen müşterilere otomatik acil e-posta gönderir** | **Kritik açıkları müşteriye insan müdahalesi olmadan anında iletir** |
| Piyasa ve Tehdit Trendi İzleme | Her 4 saatte | Siber güvenlik haberlerini ve sektör trendlerini takip eder | İçerik üretimi ve tehdit raporları için güncel veri sağlar |
| SSL Sertifika Keşfi | Her gece 01:00 | Yeni kurulan Türk şirketlerinin SSL sertifikalarını izler | Potansiyel satış adayı (lead) tespit eder |
| CVE Tehdit Eşleştirme | Her gece 02:30 | Yeni CVE'leri mevcut müşteri profilleriyle eşleştirir | Kime hangi açık mail atılacağını otomatik belirler |
| Port Tarama | Her Pazar 04:00 | İnternet üzerinde açık port/servis tespiti yapar | Yeni potansiyel müşteri adayı keşfeder |
| **USOM Kara Liste Yenileme** | **Her gece 03:15** | **Türkiye Ulusal Siber Olaylar Müdahale Merkezi'nin (USOM) zararlı URL/IP listesini indirir; domain tarama motoru bu listeyi referans olarak kullanır** | **Yerli tehdit istihbaratını otomatik günceller; Türkiye'ye özgü saldırı altyapılarını daha hızlı tespit eder** |

---

## 3. Lead Üretimi & Satış Otomasyonu

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Satış E-posta Kutusu Okuma (ISR) | Her 10 dakikada | IMAP ile satış gelen kutusunu okur, AI ile gelen mailleri sınıflandırır, otomatik teklif süreci başlatır | Satış sorgularına insan müdahalesi olmadan anında yanıt verir |
| Lead Damlatma Kampanyası | Her saatte | Yeni lead adaylarına önceden hazırlanmış e-posta serisini zamanında gönderir | Potansiyel müşteriyi düzenli dokunuşlarla ısıtır |
| Lead Puanlama & Nitelendirme | Her saatte | Lead adaylarını şirket büyüklüğü, sektör ve davranışa göre puanlar | Satış ekibinin zamanını en değerli adaylara harcamasını sağlar |
| **RIPE DNS Lead Keşfi** | **Her gece 02:00** | **RIPE NCC'den Türkiye IPv4 prefix listesini çeker, örneklem IP'leri HackerTarget reverse DNS ile domain adlarına çevirir, .tr domain'lerini lead adayı olarak kaydeder** | **API key gerektirmez; crt.sh ve Shodan'dan bağımsız üçüncü bir lead kaynağı — gece taramaları ~60 prefix, günde 40-80 yeni aday potansiyeli** |
| Alan Adı Keşfi (crt.sh) | Her gece 03:00 | SSL sertifika kayıtlarından yeni Türk şirketlerini bulur | Henüz siber güvenlik hizmeti almayan şirketleri erken keşfeder |
| **Ücretsiz Tarama Takip E-postası** | **Her saat** | **Ücretsiz tarama yapan anonim kullanıcıları 24-72 saat sonra tespit eder; skor ve öne çıkan bulgularla kişiselleştirilmiş e-posta gönderir, kayıt CTA'sı ekler** | **Ücretsiz kullanıcıları ücretli aboneliğe dönüştürme fırsatını otomatik değerlendirir** |
| Shodan Lead Tarama | Her gece 04:15 | Shodan üzerinden açık servis/port bulunduran şirketleri tespit eder — **4 sorgu/gece** (2'den artırıldı, 8 sorguluk havuz sırayla taranır) | Güvenlik açığı olan potansiyel müşterileri otomatik bulur; günlük keşif kapasitesi iki katına çıktı |
| **SSL Süresi Dolmak Üzere Büyüme Alarmı** | **Her gece 22:00** | **SSL sertifikası 30 gün içinde dolacak olan izlenen domain'leri tespit eder; ilgili şirkete "sertifikanız doluyor" içerikli kişiselleştirilmiş büyüme e-postası gönderir** | **Müşteri olmayan şirketlere tam zamanında değer odaklı dokunuş yapar; dönüşüm olasılığı yüksek zamanlı outreach** |
| **CVE Eşleşme Büyüme Alarmı** | **Her gece 23:30** | **Yeni kritik CVE'lerle eşleşen teknoloji stacki bulunan izlenen şirketleri tarar; "sisteminizi etkileyen açık tespit ettik" konulu büyüme e-postası gönderir** | **Güvenlik tehdit anında potansiyel müşteriye ulaşır; en yüksek dönüşüm zamanlamasını yakalar** |
| **Port Değişim Takip Alarmı** | **Her Pazar 01:00** | **İzlenen şirketlerin açık port profilini önceki haftayla karşılaştırır; yeni kritik port tespit edilince büyüme alarmı tetikler** | **Hedef şirketin IT ortamındaki değişiklikleri erken yakalar; güncel ve bağlamsal outreach sağlar** |

---

## 4. Müşteri İletişimi & Onboarding

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Hoş Geldiniz E-postası (Gün 1) | Her gün 10:00 | Yeni kayıtlı müşterilere kayıt sonrası 1. günde tanıtım maili gönderir | İlk izlenimi güçlendirir, aktivasyonu başlatır |
| Aktivasyon E-postaları (Gün 3 & 7) | Her gün 10:30 | Kayıt sonrası 3. ve 7. günde teşvik edici e-posta gönderir | Kullanıcının platforma alışmasını hızlandırır |
| Ödeme Hatırlatma | Her gün 10:00 | Ödeme yapılmamış faturalar için kibarca hatırlatma gönderir | Sessiz churn ve ödeme kayıplarını azaltır |
| 30 Gün Öncesi Yenileme Hatırlatma | Her gün 09:45 | Aboneliği 30 gün içinde dolacak müşterilere hatırlatma gönderir | Yenileme kararını erkenden almalarını sağlar |
| **Abonelik Otomatik Yenileme** | **Her gün 09:00** | **Aboneliği dolan müşterilerin yenileme işlemini otomatik başlatır; ödeme alınamazsa dunning kuyruğuna ekler** | **Abonelik sürekliliğini sağlar, manuel takip ihtiyacını ortadan kaldırır** |
| Abonelik Bitiş Bildirimi | Her gün 10:00 | Aboneliği sona eren müşterilere bildirim gönderir | Farkında olmadan hizmet kesintisi yaşanmasını önler |
| E-posta Serisi İşleyici | Her 30 dakikada | Zamanı gelen drip kampanya e-postalarını kuyruğa alır ve gönderir | Tüm müşteri iletişimini otomatik ve zamanında yönetir |
| Geciken Ödeme Takibi (Dunning) | Her gün 10:15 | Vadesi geçmiş ödemeler için art arda hatırlatma e-postası gönderir | Tahsilatı otomatik yönetir, kayıp geliri geri kazanır |
| Müşteri Memnuniyeti Anketi (NPS) | Her Salı 11:00 | Belirli müşterilere NPS anketi gönderir | Memnuniyetsizliği erken fark etmeyi sağlar |
| **Churn Otomatik Müdahale** | **Her gün 08:30** | **Sağlık skoru 40'ın altına düşen ve henüz müdahale edilmemiş aktif müşterileri tespit eder; kişiselleştirilmiş "sizi kaybetmek istemiyoruz" e-postası gönderir, admin'e özet bildirim yapar** | **Churn riskini erken müdahaleyle otomatik azaltır; satış ekibinin manuel takibine gerek kalmaz** |
| **Müşteri Aktivasyon İzleyici** | **Her gün 11:00** | **Kayıttan 5-14 gün geçmiş ama henüz ilk taramasını yapmamış müşterilere otomatik "ilk taramayı dene" hatırlatması gönderir; nudge1SentAt flag ile tekrar gönderimi engeller** | **İlk aktivasyonu hızlandırır, kurulum aşamasında kaybedilen müşteri oranını düşürür** |
| **Otomatik Fatura Oluşturma** | **Her gün 06:00** | **Son 24 saatte aktif olan yeni abonelikleri tarar; müşteriye fatura numaralı HTML makbuz e-postası gönderir, invoices tablosuna kaydeder, tekrar gönderimini engeller** | **Manuel fatura takibini tamamen ortadan kaldırır, muhasebe kaydını otomatikleştirir** |

---

## 5. Raporlama & Analitik

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Günlük Özet Raporu | Her gün 08:00 | Bir önceki günün güvenlik ve operasyon özetini hazırlar | Ekip her sabah durumu tek bakışta görebilir |
| Haftalık Güvenlik Değişim Raporu | Her Pazartesi 08:00 | Geçen haftanın güvenlik puanı değişimini ve yeni bulguları raporlar | Müşterinin haftadan haftaya nasıl ilerlediğini gösterir |
| SOC Haftalık Özeti | Her Pazartesi 09:00 | SOC vakalarının haftalık özetini üretir | SOC performansını ve açık vakaları tek raporda sunar |
| Fortinet Haftalık Raporu | Her Pazartesi 08:30 | FortiGate/FortiManager'dan haftalık güvenlik raporu üretir | Müşterinin Fortinet ekosistemindeki durumunu özetler |
| Piyasa Haftalık Özeti | Her Cuma 09:00 | Haftanın siber güvenlik haberlerini ve tehdit özetini hazırlar | İçerik ekibine ve müşterilere güncel bir bakış sunar |
| CISO Haftalık Tehdit Özeti | Her Cuma 09:30 | CISO'lar için haftalık tehdit istihbarat özeti oluşturur | Üst yönetime sunulmak üzere teknik olmayan tehdit özeti |
| Haftalık Siber Güvenlik Bülteni | Her Cuma 08:00 | AI ile Türkçe siber güvenlik bülteni oluşturur ve abone listesine gönderir | Marka bilinirliğini ve müşteri bağlılığını artırır |
| CISO Yönetim Kurulu Raporu | Her ayın 25'i 09:00 | Yönetim kuruluna sunulmak üzere aylık yönetici özeti üretir | Teknik olmayan üst yönetimin riski kavramasını kolaylaştırır |
| Uyum Skoru Raporu | Her ayın 1'i 08:00 | Müşterinin güvenlik uyum puanını hesaplar, trend analizi ekler | Aylık ilerlemeyi nesnel olarak ölçer |
| Yıllık Rapor Hatırlatması | Her ayın 1'i 09:00 | Yıllık rapor dönemine girenler için otomatik hatırlatma gönderir | Önemli raporların gözden kaçmasını önler |
| Demo Rapor Yenileme | Her ayın 1'i 10:00 | Demo hesapların örnek raporlarını taze ve güncel tutar | Satış demoları her zaman gerçekçi ve güncel görünür |
| **SOC Aylık AI Maliyet Raporu** | **Her ayın 1'i 09:00** | **Bir önceki ayda SOC triage, korelasyon ve playbook üretimi için harcanan AI (Claude) maliyetini hesaplar; servis bazlı dökümü admin'e e-posta ile gönderir** | **SOC hizmetinin AI maliyet yapısını şeffaf tutar; bütçe planlaması ve müşteri fiyatlandırması için temel veri** |

---

## 6. Sistem & Altyapı

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Günlük Cron Sağlık E-postası | Her gün 07:00 | Tüm otomatik görevlerin çalışıp çalışmadığını kontrol eder; sorunlu veya durmuş cron varsa admin'e e-posta ile alarm gönderir | Sessizce duran bir cron'un haftalarca fark edilmeden kalmasını önler |
| Platform Maliyet Kontrolü | Her gece 23:30 | AI API maliyetlerini ve platform giderlerini hesaplar | Bütçe aşımlarını erkenden yakalar |
| Webhook Yeniden Deneme | Her 10 dakikada | Başarısız olan dış sistem bildirimlerini yeniden gönderir | Entegrasyon hatalarında veri kaybı olmaz |
| ServiceNow Ticket Senkronizasyonu | Her 15 dakikada | SOC vakalarını ServiceNow IT sistemiyle çift yönlü senkronize eder | Müşterinin kendi ITSM sistemiyle otomatik uyum sağlar |
| ServiceNow Bağlantı Sağlığı | Her saatte | ServiceNow bağlantısının çalışır durumda olduğunu kontrol eder | Entegrasyon kesilmesini proaktif fark eder |
| Microsoft 365 Log Takibi | Her 15 dakikada | Microsoft 365 oturum açma loglarını çeker, şüpheli aktiviteyi SOC'a bildirir | Bulut ofis uygulamalarındaki tehditleri de kapsar |
| FortiManager Bağlantı Sağlığı | Her gece 02:45 | FortiManager API bağlantısının çalıştığını kontrol eder | Güvenlik cihazı entegrasyonunun sürekliliğini sağlar |
| Onay Görevleri Temizleme (HITL) | Her 15 dakikada | Süresi dolan insan onayı bekleyen görevleri kapatır | Askıda kalan onay taleplerinin sistemi tıkamasını önler |
| Doğrulama Kuyruğu | Her saatte | Bekleyen doğrulama görevlerini işler | Kullanıcı ve veri doğrulamalarının gecikmeden tamamlanmasını sağlar |
| Günlük + Haftalık Veritabanı Yedeği | Her gece 03:00 (günlük) + Her Pazar 04:00 (haftalık tam yedek) | Tüm veritabanının yedeğini alır; günlük yedek maksimum 24 saatlik kayıp penceresini sağlar, haftalık ek güvenlik katmanı oluşturur | Günlük yedekle maksimum 24 saatlik veri kaybı penceresi; haftalık tam yedek ek güvenlik katmanı |
| Alan Adı Yeniden Tarama | Her gün 09:30 | Müşteri alan adlarını güncel tehdit imzalarıyla yeniden tarar | Önceden temiz görünen domain'lerdeki yeni tehditleri yakalar |
| **AI Çıktı Kalite İzleme** | **Her gün 09:30** | **Son 24 saatte oluşturulan raporları kontrol eder: çok kısa aiAnalysis (<400 karakter), boş rapor ve yüksek hata oranı varsa admin'e e-posta alarmı gönderir; ai_cost_log'dan servis bazlı hata oranını da denetler** | **AI raporlama kalitesi düşmeden proaktif müdahaleye olanak tanır; kullanıcı şikayeti gelmeden sistemi yakalar** |
| **Platform Smoke Test** | **Her saat :05** | **API /healthz, PostgreSQL bağlantısı ve Gemini API erişimini test eder; herhangi biri başarısız olursa anında Telegram + e-posta alarmı gönderir** | **Production bozulmaları kullanıcı şikayetiyle değil, otomatik izlemeyle tespit edilir** |
| **Tedarikçi Portföyü Yeniden Tarama** | **Her gece 02:00** | **Müşterilerin tedarikçi portföyünde kayıtlı ve aktif izleme açık olan tüm vendor domain'lerini otomatik olarak yeniden tarar; skor değişikliği varsa hem müşteri hem tedarikçi için alert tetikler** | **Tedarikçi risk profilinin güncel kalmasını sağlar; müşterinin tedarik zinciri kaynaklı riskleri gözden kaçırmadan yakalamasını güvence altına alır** |

---

## 7. AI & İçerik Üretimi

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Blog Otopilot | Her Pazartesi & Perşembe 09:00 | SEO odaklı Türkçe siber güvenlik blog yazısı üretir | İnsan yazmadan organik trafik ve marka otoritesi oluşturur |
| Sosyal Medya İçerik Üretimi | Her Pazar 20:00 | Haftanın sosyal medya paylaşımlarını AI ile hazırlar | Sosyal medya varlığını tutarlı ve düzenli tutar |
| Haber Toplama | Her gün 06:00 | RSS beslemelerinden siber güvenlik haberlerini otomatik toplar | Editörün kaynakları tek tek dolaşması gerekmez |
| Haber Zenginleştirme | Her gün 06:30 | Toplanan haberleri AI ile özetler ve kategorize eder | Ham haberi okunabilir ve yayına hazır hale getirir |
| Haftalık Digest Oluşturma | Her Cuma 07:00 | Haftanın en önemli siber güvenlik haberlerini derleyip digest üretir | Müşterilere ve abonelere kurumsal haftalık bülten |
| AI Araç Politika İzleme | Her Pazar 02:00 | AI araçlarındaki politika değişikliklerini takip eder | Şirketin AI kullanım politikasının güncel kalmasını sağlar |
| AI Politika Çeyreklik Güncelleme | Ocak, Nisan, Temmuz, Ekim ayı başı 03:00 | AI politikalarını 4 ayda bir kapsamlı günceller | Düzenleyici değişikliklere periyodik uyum sağlar |
| Üst Satış (Upsell) Motoru | Her gece 23:00 | AI ile müşteri kullanım verilerini analiz eder, yükseltme fırsatı tespit eder | İnsan müdahalesi olmadan gelir artırma fırsatı yaratır |
| Müşteri Sağlık Skoru | Her gece 02:00 | Her müşterinin platform kullanımını, ödeme geçmişini ve güvenlik olgunluğunu birleştirip skor üretir | Churn riski taşıyan müşterileri önceden fark eder |

---

## 8. Yasal Uyumluluk (KVKK)

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| Veri Saklama Politikası | Her ayın 1'i 03:00 | Saklama süresi dolmuş kişisel verileri işaretler | KVKK'nın zorunlu kıldığı veri minimizasyonunu otomatik uygular |
| Zamanlanmış Veri Silme | Her gece 04:00 | İşaretlenmiş verileri sistemden güvenli şekilde kaldırır | KVKK'ya yasal uyumu sağlar, elle müdahaleye gerek kalmaz |
| 72 Saatlik Bildirim Takibi | Her 30 dakikada | Veri ihlali oluştuğunda KVKK'nın 72 saatlik bildirim yükümlülüğünü sayar ve hatırlatır | Yasal bildirim süresinin kaçırılması riskini ortadan kaldırır |

---

## 9. Büyüme & Fiyatlandırma

| Görev | Ne Zaman Çalışır | Ne Yapar | Faydası |
|---|---|---|---|
| IOC Kredi Sıfırlama | Her ayın 1'i 08:30 | Her müşterinin aylık IOC (tehdit göstergesi sorgulama) hakkını sıfırlar | Adil kullanım kotasını otomatik yönetir, abonelik değerini koruyan önemli bir gelir parametresi |
| Enflasyon Fiyat Hatırlatma | Her Pazartesi 09:30 | Enflasyon oranına göre fiyat güncelleme önerisini iç ekibe iletir | Fiyatların piyasa maliyetiyle uyumlu kalmasını hatırlatır |
| **Otomatik TÜFE Fiyat Güncelleme** | **Her yıl 1 Ocak 09:00** | **TUFE_ANNUAL_RATE env değişkenindeki yıllık oran kadar tüm servis fiyatlarını otomatik artırır; admin'e önce/sonra tablo içeren e-posta gönderir** | **Fiyatları manuel takip etmeden enflasyonla uyumlu tutar** |
| SLA İhlal Raporu | Her gün 08:00 | Önceki gün SLA'sı ihlal edilen müşteri vakalarını listeler | Hizmet kalitesini nesnel olarak takip etmeyi sağlar |
| Otomatik Etiketleme | Her gece 03:30 | Müşteri davranışına göre segment etiketleri (aktif, pasif, risk altında vb.) atar | CRM ve kampanyaların doğru segmente ulaşmasını sağlar |
| Görev Hatırlatmaları | Her gün 08:30 | Vadesi yaklaşan iç görevleri ekibe hatırlatır | Operasyonel görevlerin gözden kaçmasını önler |
| **SLA Proaktif Uyarı** | **Her 30 dakika** | **Açık veya inceleme aşamasındaki SOC vakalarında SLA süresinin %80'i geçmişse SOC adminine Telegram + e-posta uyarısı gönderir; kaç dakika kaldığını gösterir** | **SLA ihlalini belgelemek yerine önler; SOC ekibi ihlal gerçekleşmeden müdahale eder** |

---

## Özet Rakamlar

| Kategori | Cron Sayısı |
|---|---|
| Güvenlik İzleme | 13 |
| Tehdit İstihbaratı | 9 |
| Lead Üretimi & Satış | 10 |
| Müşteri İletişimi & Onboarding | 12 |
| Raporlama & Analitik | 12 |
| Sistem & Altyapı | 15 |
| AI & İçerik Üretimi | 9 |
| Yasal Uyumluluk (KVKK) | 3 |
| Büyüme & Fiyatlandırma | 7 |
| **TOPLAM** | **90** |
