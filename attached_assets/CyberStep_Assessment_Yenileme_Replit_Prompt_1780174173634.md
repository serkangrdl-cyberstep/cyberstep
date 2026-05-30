# CyberStep — Assessment Yenileme Replit Agent Promptu
## Mini (20 soru) + Tam (60 soru) — Tam Tasarım + Uygulama

---

## REPLIT AGENT PROMPTU (Kopyala-Yapıştır)

You are updating the CyberStep.io assessment system. The existing app uses Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React. 

This update completely redesigns both assessment question sets with new questions, improved scoring, and updated UI. Follow every instruction exactly.

---

## PART 1: DATABASE — QUESTIONS TABLE UPDATE

First, check the existing `questions` table schema. If it doesn't have these columns, add them via migration:

```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS assessment_type varchar(10) DEFAULT 'both';
-- assessment_type: 'mini' | 'full' | 'both'
ALTER TABLE questions ADD COLUMN IF NOT EXISTS area_label varchar(100);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS help_text text;
-- help_text: plain Turkish explanation shown below question
ALTER TABLE questions ADD COLUMN IF NOT EXISTS conditional_skip boolean DEFAULT false;
-- If true, show "Bu alanı atlıyorum" option (for Area G software dev questions)
```

Then DELETE all existing questions and INSERT the new ones:

```sql
DELETE FROM questions;
```

### INSERT MINI ASSESSMENT QUESTIONS (20 questions, type='mini')

Scoring key: weight column = multiplier (1, 2, or 3)
Answer points: Evet=5, Kısmen=3, Hayır=0, Bilmiyorum=0
Question score = answer_points × weight
isRedAlarm=true means this finding appears prominently in report

```sql
INSERT INTO questions (domain, area_label, question_text, help_text, weight, isRedAlarm, assessment_type, sort_order) VALUES

-- ALAN A — Yönetişim ve Organizasyon
('A', 'Yönetişim ve Organizasyon',
 'Şirketinizde siber güvenlikten sorumlu atanmış bir kişi var mı?',
 'Bu kişi IT çalışanı olmak zorunda değil. "Bir sorun çıkarsa kim arar?" sorusunun cevabını bilen biri yeterli.',
 1, false, 'mini', 1),

('A', 'Yönetişim ve Organizasyon',
 'Şirketinizde kullanılan sistemler, yazılımlar ve hassas verilerin nerede tutulduğu listelenmiş mi?',
 'Müşteri bilgisi, personel verisi, finansal kayıtlar hangi programda veya bilgisayarda duruyor? Bunu biliyor musunuz?',
 1, false, 'mini', 2),

-- ALAN B — Kimlik ve Erişim Yönetimi
('B', 'Kimlik ve Erişim Yönetimi',
 'Çalışanlar e-posta ve iş uygulamalarına girerken SMS kodu veya telefon onayı (2FA) kullanıyor mu?',
 'Sadece şifre yetmiyor. "Girişi onayla" gibi ek bir adım, hesap ele geçirilmesini çok zorlaştırır.',
 3, true, 'mini', 3),

('B', 'Kimlik ve Erişim Yönetimi',
 'İşten ayrılan çalışanların şirket sistemlerine ve e-postaya erişimi aynı gün kapatılıyor mu?',
 'Ayrılan çalışanın hesabı açık kalırsa istemeden veya bilerek şirket verilerine erişebilir.',
 3, true, 'mini', 4),

-- ALAN C — E-posta ve Sosyal Mühendislik
('C', 'E-posta ve Sosyal Mühendislik',
 'IBAN değişikliği veya acil para transferi taleplerinde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?',
 'Saldırganlar yönetici gibi görünerek "acil havale yap" e-postası gönderiyor. Telefon ile teyit bu saldırıyı engeller.',
 3, true, 'mini', 5),

('C', 'E-posta ve Sosyal Mühendislik',
 'Şirket e-posta adresinizin taklit edilerek sahte mail gönderilmesini engelleyen teknik önlem alındı mı?',
 'Teknik önlem alınmadan saldırganlar sizin adınıza e-posta gönderebilir. Bu konuda IT destek aldınız mı?',
 2, true, 'mini', 6),

-- ALAN D — Cihaz ve Uç Nokta Güvenliği
('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Şirket bilgisayarlarında güncel zararlı yazılım koruma (antivirüs/güvenlik) çözümü aktif mi?',
 'Sadece Windows Defender yeterli değildir. Kurumsal bir güvenlik çözümü merkezi olarak yönetilmeli.',
 2, true, 'mini', 7),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Bilgisayarlar ve iş yazılımları (Windows, Office, muhasebe programı vb.) düzenli olarak güncelleniyor mu?',
 'Güncellenmemiş yazılımlar saldırganların en çok kullandığı giriş kapısı. Otomatik güncelleme açık mı?',
 2, false, 'mini', 8),

-- ALAN E — Ağ Güvenliği
('E', 'Ağ Güvenliği',
 'Şirketin internet bağlantısını koruyan bir güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?',
 'Modem/router içindeki basit güvenlik duvarı yeterli değildir. Kurumsal bir firewall cihazı veya yazılımı var mı?',
 3, true, 'mini', 9),

('E', 'Ağ Güvenliği',
 'Müşteri veya ziyaretçilere sunulan Wi-Fi ağı, şirketin iç ağından tamamen ayrı mı?',
 'Aynı Wi-Fi''ye bağlanan bir ziyaretçi, iç sistemlerinize erişebilir. Misafir ağı ayrı mı?',
 1, false, 'mini', 10),

-- ALAN F — Veri Koruma ve Yedekleme
('F', 'Veri Koruma ve Yedekleme',
 'Kritik verileriniz düzenli ve tercihen otomatik olarak yedekleniyor mu?',
 'Fidye yazılımı saldırısında yedek yoksa tüm verilerinizi kaybedebilirsiniz. Günlük otomatik yedek var mı?',
 3, true, 'mini', 11),

('F', 'Veri Koruma ve Yedekleme',
 'Alınan yedeklerin gerçekten çalıştığı son 12 ay içinde test edildi mi?',
 'Yedek almak yetmez; geri yüklenip yüklenmediği de test edilmeli. Son ne zaman denendi?',
 2, true, 'mini', 12),

-- ALAN G — Yazılım ve Dijital Araçlar
('G', 'Yazılım ve Dijital Araçlar',
 'Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?',
 'Ortak kullanılan tek şifre, kimin ne yaptığını izlemeyi imkânsız kılar ve güvenlik riskini artırır.',
 2, true, 'mini', 13),

('G', 'Yazılım ve Dijital Araçlar',
 'Çalışanların ChatGPT gibi yapay zeka araçlarına şirket verisi, müşteri bilgisi veya sözleşme yüklemesini önleyen kural var mı?',
 'Yapay zeka araçlarına yüklenen veriler üçüncü taraf sunucularda saklanabilir. KVKK açısından risk taşır.',
 1, false, 'mini', 14),

-- ALAN H — Fiziksel Güvenlik
('H', 'Fiziksel Güvenlik',
 'Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?',
 'Sunucu odası kilitli mi? Kimler girebilir? Fiziksel erişim, dijital saldırı kadar ciddi bir risktir.',
 2, false, 'mini', 15),

('H', 'Fiziksel Güvenlik',
 'Müşteri bilgisi veya finansal veri içeren belgeler güvenli şekilde imha ediliyor mu (kâğıt parçalama vb.)?',
 'Çöpe atılan belgeler bilgi hırsızlığına yol açabilir. Kâğıt imha makinesi kullanılıyor mu?',
 1, false, 'mini', 16),

-- ALAN I — Tedarik Zinciri ve Dijital Varlıklar
('I', 'Tedarik Zinciri ve Dijital Varlıklar',
 'Şirketin sosyal medya hesaplarına (Instagram, LinkedIn vb.) kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?',
 'Hesap ele geçirilmesi hem itibar kaybına hem müşteri dolandırıcılığına yol açar. Kaç kişi bu şifreler biliyor?',
 2, true, 'mini', 17),

('I', 'Tedarik Zinciri ve Dijital Varlıklar',
 'Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve bu konuda sorumlu kişi belirlenmiş mi?',
 'Domain yenilenmezse web siteniz ve e-postanız tamamen durur. Son yenileme ne zaman yapıldı?',
 1, false, 'mini', 18),

-- ALAN J — Olay Müdahalesi ve İş Sürekliliği
('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Şirkete siber saldırı yaşanırsa ilk 1 saatte kimin ne yapacağı önceden belirlenmiş mi?',
 'Panik anında plan yoksa değerli zaman kaybedilir. "Kim aranır, ne kapatılır, kim bilgilendirilir?" yazılı mı?',
 2, true, 'mini', 19),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'KVKK kapsamında müşteri verisi sızdığında 72 saat içinde bildirim yapma yükümlülüğünüz için hazırlık yapıldı mı?',
 'Kanuni zorunluluk: veri ihlalini öğrendiğinizden itibaren 72 saat içinde KVK Kurulu''na bildirim yapılmalı.',
 2, true, 'mini', 20);
```

### INSERT FULL ASSESSMENT QUESTIONS (60 questions, type='full')

```sql
INSERT INTO questions (domain, area_label, question_text, help_text, weight, isRedAlarm, assessment_type, sort_order) VALUES

-- ALAN A — Yönetişim ve Risk Yönetimi (6 soru)
('A', 'Yönetişim ve Risk Yönetimi',
 'Şirketinizde siber güvenlikten sorumlu atanmış bir kişi veya ekip var mı?',
 'Bu kişinin teknik uzman olması şart değil. Siber güvenlik konusunda kararları kim alıyor, sorunları kim çözüyor?',
 1, false, 'full', 1),

('A', 'Yönetişim ve Risk Yönetimi',
 'Yıllık siber güvenlik bütçesi planlanıyor mu?',
 'Küçük bir bütçe bile olsa, güvenlik için ayrılan kaynağın belirlenmesi önemli bir olgunluk göstergesi.',
 1, false, 'full', 2),

('A', 'Yönetişim ve Risk Yönetimi',
 'Çalışanların şirket bilgisayarları, hesapları ve verilerini nasıl kullanacağına dair yazılı kurallar mevcut mu?',
 '"Kabul Edilebilir Kullanım Politikası" olarak da bilinir. İmzalatılmış bir belge var mı?',
 1, false, 'full', 3),

('A', 'Yönetişim ve Risk Yönetimi',
 'Şirkette kullanılan tüm sistemler, yazılımlar ve hassas verilerin nerede tutulduğuna dair güncel bir liste var mı?',
 'Hangi verinin hangi sistemde olduğunu bilmeden onu koruyamazsınız.',
 1, false, 'full', 4),

('A', 'Yönetişim ve Risk Yönetimi',
 'Üst yönetim veya ortaklar, şirketin siber güvenlik risklerini düzenli olarak gündeme alıyor mu?',
 'Yılda en az bir kez bile olsa, güvenlik durumunun üst yönetime raporlanması kritik.',
 1, false, 'full', 5),

('A', 'Yönetişim ve Risk Yönetimi',
 'Yeni işe giren çalışanlara işe başlarken siber güvenlik kuralları ve sorumlulukları anlatılıyor mu?',
 'Oryantasyon eğitimi, insan kaynaklı hataları ve ihmalleri önemli ölçüde azaltır.',
 1, false, 'full', 6),

-- ALAN B — Kimlik ve Erişim Yönetimi (6 soru)
('B', 'Kimlik ve Erişim Yönetimi',
 'Tüm çalışanlar için güçlü ve farklı şifreler kullanmaları zorunlu mu? (Şifre politikası var mı?)',
 'En az 12 karakter, büyük/küçük harf, rakam ve sembol içeren şifre. Aynı şifrenin birden fazla yerde kullanımı yasaklı mı?',
 1, false, 'full', 7),

('B', 'Kimlik ve Erişim Yönetimi',
 'Çalışanlar iş uygulamaları ve e-postaya SMS kodu veya uygulama onayı (2FA/MFA) ile giriş yapıyor mu?',
 'Bu tek önlem bile hesap ele geçirme saldırılarının büyük çoğunluğunu engeller.',
 3, true, 'full', 8),

('B', 'Kimlik ve Erişim Yönetimi',
 'Şirkete dışarıdan bağlanan çalışanlar ve IT yetkilileri ek doğrulama (VPN + 2FA) kullanıyor mu?',
 'Uzak erişim, saldırganların en çok hedeflediği giriş noktası. Ekstra koruma şart.',
 2, true, 'full', 9),

('B', 'Kimlik ve Erişim Yönetimi',
 'İşten ayrılan çalışanların tüm sistem, uygulama ve e-posta erişimleri ayrılış günü kapatılıyor mu?',
 'Ayrılan çalışanın hesabı açık kalması en yaygın güvenlik açıklarından. Prosedür yazılı mı?',
 3, true, 'full', 10),

('B', 'Kimlik ve Erişim Yönetimi',
 'Çalışanlar yalnızca kendi işleri için ihtiyaç duydukları sistemlere ve dosyalara erişebiliyor mu?',
 'Muhasebeci neden üretim verilerine erişebilsin? Her çalışan sadece ihtiyacı kadar yetkiye sahip olmalı.',
 1, false, 'full', 11),

('B', 'Kimlik ve Erişim Yönetimi',
 'Sistem yöneticisi veya IT yetkilisi hesapları düzenli olarak gözden geçiriliyor ve denetleniyor mu?',
 'Yüksek yetkili hesaplar en çok hedef alınanlardır. Bunların listesi ve kullanım kaydı tutuluyor mu?',
 2, true, 'full', 12),

-- ALAN C — E-posta ve Sosyal Mühendislik (6 soru)
('C', 'E-posta ve Sosyal Mühendislik',
 'Çalışanlara yılda en az bir kez sahte e-posta (phishing) ve dolandırıcılık farkındalık eğitimi veriliyor mu?',
 'Saldırıların büyük çoğunluğu çalışanları kandırarak başlar. Farkındalık eğitimi en etkili savunma araçlarından.',
 1, false, 'full', 13),

('C', 'E-posta ve Sosyal Mühendislik',
 'Şüpheli e-postaları bildirmek için çalışanların başvurabileceği net bir kişi veya kanal tanımlanmış mı?',
 '"Şüpheli bir şey gördüm, kime söyleyeyim?" sorusunun cevabı her çalışan tarafından biliniyor mu?',
 1, false, 'full', 14),

('C', 'E-posta ve Sosyal Mühendislik',
 'Gelen e-postalarda zararlı ek ve bağlantıları filtreleyen bir güvenlik sistemi aktif mi?',
 'E-posta güvenlik filtresi, zararlı e-postaların gelen kutusuna ulaşmadan engellenmesini sağlar.',
 2, true, 'full', 15),

('C', 'E-posta ve Sosyal Mühendislik',
 'Şirket e-posta adresinin taklit edilmesini engelleyen teknik ayarlar (SPF, DKIM, DMARC) yapılandırılmış mı?',
 'Bu ayarlar olmadan, saldırganlar sizin adınıza e-posta göndererek müşterilerinizi ve çalışanlarınızı kandırabilir.',
 2, true, 'full', 16),

('C', 'E-posta ve Sosyal Mühendislik',
 'IBAN değişikliği veya acil para transferi gibi taleplerde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?',
 '"CEO Dolandırıcılığı": Saldırgan yönetici kılığına girerek "acil havale yap" e-postası gönderir. Telefon teyidi bunu engeller.',
 3, true, 'full', 17),

('C', 'E-posta ve Sosyal Mühendislik',
 'Şirket içi iletişim ve müşteri yazışmaları için kullanılan WhatsApp gruplarına dair güvenlik kuralı var mı?',
 'WhatsApp gruplarında paylaşılan sözleşme, fatura veya müşteri bilgisi KVKK riski doğurabilir.',
 1, false, 'full', 18),

-- ALAN D — Cihaz ve Uç Nokta Güvenliği (6 soru)
('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Şirkette kullanılan tüm bilgisayarların güncel bir envanteri tutuluyor mu?',
 'Hangi bilgisayar var, kimin kullandığı, hangi yazılım yüklü? Bu liste olmadan güvenliği yönetmek mümkün değil.',
 1, false, 'full', 19),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Çalışan bilgisayarlarında merkezi olarak yönetilen zararlı yazılım koruma çözümü (EDR/antivirüs) aktif mi?',
 'Her bilgisayarda aynı koruma yazılımı, merkezi izleme ile yönetilmeli. Sadece Windows Defender yeterli değil.',
 2, true, 'full', 20),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'İşletim sistemi ve iş uygulamaları otomatik olarak güncelleniyor mu?',
 'Güncelleme gecikmesi, bilinen açıkların istismarını kolaylaştırır. Otomatik güncelleme açık mı?',
 2, false, 'full', 21),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Dizüstü bilgisayar ve mobil cihazlarda ekran kilidi ve disk şifrelemesi aktif mi?',
 'Cihaz çalınırsa veya kaybolursa şifrelenmiş disk, verilerin ele geçirilmesini engeller.',
 1, false, 'full', 22),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'Çalışanların kişisel cihazlarıyla (kendi telefon/bilgisayar) şirket sistemlerine bağlanmasına dair yazılı kural var mı?',
 'Kişisel cihazlar şirket güvenlik standartlarını karşılamayabilir. Bu konuda politika belirlenmiş mi?',
 1, false, 'full', 23),

('D', 'Cihaz ve Uç Nokta Güvenliği',
 'USB ve taşınabilir bellek kullanımı şirket bilgisayarlarında denetleniyor veya kısıtlanıyor mu?',
 'USB yoluyla veri sızdırma ve zararlı yazılım bulaştırma hâlâ yaygın bir saldırı yöntemi.',
 1, false, 'full', 24),

-- ALAN E — Ağ Güvenliği (6 soru)
('E', 'Ağ Güvenliği',
 'Şirketin internet bağlantısını koruyan kurumsal güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?',
 'Modem içindeki temel koruma kurumsal ağ için yeterli değil. Ayrı bir firewall cihazı veya yazılımı var mı?',
 3, true, 'full', 25),

('E', 'Ağ Güvenliği',
 'Misafir veya müşteri Wi-Fi ağı şirketin iç ağından tamamen ayrılmış mı?',
 'Aynı ağa bağlanan bir ziyaretçi, iç sistemlere erişebilir. Ayrı bir misafir SSID var mı?',
 1, false, 'full', 26),

('E', 'Ağ Güvenliği',
 'Ağ trafiği izleniyor ve olağandışı bağlantılar için uyarı sistemi kurulu mu?',
 '"Gece 3''te Rusya''ya veri gidiyor" gibi anomalileri tespit eden bir sistem var mı?',
 2, true, 'full', 27),

('E', 'Ağ Güvenliği',
 'Finans sistemi, müşteri veri tabanı gibi kritik sistemler ağ içinde diğerlerinden ayrılmış mı?',
 'Ağ segmentasyonu: bir bölüme sızan saldırgan otomatik olarak diğer bölümlere geçememeli.',
 2, true, 'full', 28),

('E', 'Ağ Güvenliği',
 'Kullanılmayan ağ portları ve servisler kapalı mı?',
 'Açık her port potansiyel giriş kapısıdır. Düzenli port taraması yapılıyor mu?',
 1, false, 'full', 29),

('E', 'Ağ Güvenliği',
 'Şirket dışından yönetim amaçlı sisteme bağlanmak (uzak masaüstü vb.) VPN üzerinden yapılıyor mu?',
 'Doğrudan açık RDP bağlantısı, fidye yazılımının en yaygın giriş noktası. VPN zorunlu mu?',
 2, true, 'full', 30),

-- ALAN F — Veri Koruma ve Yedekleme (6 soru)
('F', 'Veri Koruma ve Yedekleme',
 'Kritik veriler düzenli ve tercihen otomatik olarak yedekleniyor mu?',
 'Fidye yazılımı saldırısında yedek olmadan tüm verilerinizi kaybedebilirsiniz. Günlük otomatik yedek var mı?',
 3, true, 'full', 31),

('F', 'Veri Koruma ve Yedekleme',
 'Yedekler, ana sistemden fiziksel veya ağ olarak tamamen ayrı bir ortamda tutuluyor mu?',
 'Fidye yazılımı bağlı tüm diskleri şifreler. Yedek ayrı bir yerde (farklı lokasyon veya çevrimdışı disk) durmalı.',
 3, true, 'full', 32),

('F', 'Veri Koruma ve Yedekleme',
 'Yedeklerin başarıyla geri yüklenip yüklenmediği son 12 ay içinde test edildi mi?',
 'Alınan yedeğin gerçekten çalışıp çalışmadığı test edilmeden güvenilir sayılamaz.',
 2, true, 'full', 33),

('F', 'Veri Koruma ve Yedekleme',
 'Müşteri veya çalışanlara ait hassas veriler dışarıya gönderilirken şifreleniyor mu?',
 'E-posta eki, dosya transferi veya bulut paylaşımında hassas veri şifrelenmeli.',
 1, false, 'full', 34),

('F', 'Veri Koruma ve Yedekleme',
 'Sunucularda veya bulutta depolanan hassas veriler şifreli mi?',
 'Disk şifreleme: birisi fiziksel olarak erişse bile veri okunamaz olmalı.',
 1, false, 'full', 35),

('F', 'Veri Koruma ve Yedekleme',
 'KVKK kapsamındaki kişisel veriler (müşteri, çalışan bilgisi) için gerekli teknik ve idari tedbirler alındı mı?',
 'KVKK Madde 12 teknik önlem zorunluluğu. Yeterli önlem alınmadan yaşanan ihlallerde ceza artırılıyor.',
 3, true, 'full', 36),

-- ALAN G — Yazılım, Dijital Araçlar ve Hesap Güvenliği (6 soru)
('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?',
 'Ortak kullanılan tek şifre, kimin ne yaptığını izlemeyi imkânsız kılar ve yetkisiz erişim riskini artırır.',
 2, true, 'full', 37),

('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Kullanılan üçüncü taraf yazılım ve sistemlerin güvenlik güncellemeleri düzenli takip ediliyor mu?',
 'Muhasebe yazılımı, ERP, CRM — bunların güncel ve destek kapsamında olması kritik.',
 2, false, 'full', 38),

('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Çalışanların ChatGPT gibi yapay zeka araçlarına şirket verisi, müşteri bilgisi veya gizli belge yüklemesini önleyen kural veya farkındalık çalışması yapıldı mı?',
 'Bu araçlara yüklenen veriler üçüncü taraf sunucularda işlenir. KVKK ve gizlilik açısından ciddi risk taşır.',
 2, false, 'full', 39),

('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Şirket web sitesi veya e-ticaret platformu düzenli güvenlik kontrolünden geçiyor mu?',
 'Web siteniz ele geçirilirse müşterileriniz dolandırılabilir, KVKK yükümlülüğünüz doğar.',
 1, false, 'full', 40),

('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Bulut depolama (Google Drive, OneDrive, Dropbox) paylaşım izinleri düzenli gözden geçiriliyor mu?',
 'Eski çalışanlara veya harici kişilere verilmiş dosya izinleri kaldırıldı mı?',
 1, false, 'full', 41),

('G', 'Yazılım, Dijital Araçlar ve Hesap Güvenliği',
 'Şirket sosyal medya hesaplarına (Instagram, LinkedIn, Twitter/X vb.) kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?',
 'Sosyal medya hesabı ele geçirilmesi, müşteri dolandırıcılığına ve itibar kaybına yol açar.',
 2, true, 'full', 42),

-- ALAN H — Fiziksel Güvenlik (6 soru)
('H', 'Fiziksel Güvenlik',
 'Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?',
 'Kilitsiz sunucu odası = doğrudan veri erişimi. Fiziksel güvenlik, dijital kadar önemli.',
 2, false, 'full', 43),

('H', 'Fiziksel Güvenlik',
 'Ofise gelen ziyaretçiler kayıt altına alınıyor ve iç alanlarda yalnız bırakılmıyor mu?',
 'Ziyaretçi güvenlik politikası var mı? Misafir defteri veya elektronik kayıt tutuluyor mu?',
 1, false, 'full', 44),

('H', 'Fiziksel Güvenlik',
 'Çalışanların masayı terk ederken bilgisayar ekranlarını kilitlemesi zorunlu mu? (Politika + alışkanlık)',
 'Dakikalık bir ihmal, yetkisiz kişinin ekranı görmesine veya sisteme erişmesine yol açabilir.',
 1, false, 'full', 45),

('H', 'Fiziksel Güvenlik',
 'Müşteri bilgisi veya finansal veri içeren hassas belgeler güvenli şekilde imha ediliyor mu?',
 'Kâğıt imha makinesi kullanılıyor mu? Çöpe atılan belgeler ciddi bilgi sızıntısı riski taşır.',
 1, false, 'full', 46),

('H', 'Fiziksel Güvenlik',
 'Ofis dışında çalışılırken (ev, kafe, havalimanı) uyulması gereken cihaz güvenlik kuralları belirlenmiş mi?',
 'Halka açık Wi-Fi''de şifrelenmemiş bağlantı, VPN yoksa veri ele geçirme riski yaratır.',
 1, false, 'full', 47),

('H', 'Fiziksel Güvenlik',
 'Şirket cihazının kaybolması veya çalınması durumunda ne yapılacağı önceden belirlenmiş mi?',
 'Uzaktan silme, şifre değiştirme, bildirme prosedürü — bunlar tanımlı mı?',
 2, false, 'full', 48),

-- ALAN I — Tedarik Zinciri ve Üçüncü Taraf Yönetimi (6 soru)
('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Kritik hizmet sağlayıcıların (muhasebe yazılımı, bulut, ödeme sistemi) güvenlik uygulamaları değerlendiriliyor mu?',
 'Tedarikçiniz hacklenirse siz de etkilenebilirsiniz. Tedarikçi güvenliği kontrol ediliyor mu?',
 1, false, 'full', 49),

('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Dışarıdan çalışan muhasebeci, mali müşavir veya IT firmasının sistem erişimi sınırlı ve kayıt altında mı?',
 'Dış paydaşlar en az ayrıcalık prensibiyle yönetilmeli ve erişimleri işleri bittikten sonra kaldırılmalı.',
 2, true, 'full', 50),

('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Tedarikçi ve iş ortağı sözleşmelerinde veri gizliliği ve güvenlik maddeleri yer alıyor mu?',
 'Müşteri verisi paylaşılan her iş ortağıyla KVKK uyumlu veri işleme sözleşmesi (DPA) imzalanmalı.',
 1, false, 'full', 51),

('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Bulut hizmet sağlayıcılarının (hosting, e-posta, depolama) güvenlik sertifikasyonları kontrol ediliyor mu?',
 'ISO 27001, SOC 2 gibi sertifikalar, sağlayıcının minimum güvenlik standartlarını karşıladığını gösterir.',
 1, false, 'full', 52),

('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve sorumlu kişi belirlenmiş mi?',
 'Domain süresi dolarsa web siteniz ve tüm e-postalarınız anında çalışmayı durdurur.',
 2, false, 'full', 53),

('I', 'Tedarik Zinciri ve Üçüncü Taraf Yönetimi',
 'Üçüncü taraf erişimleri sadece ihtiyaç duydukları sistemlerle sınırlı tutuluyor mu?',
 'IT firmanız neden muhasebe verilerinize erişebilsin? Her dış erişim minimum yetki ile sınırlı olmalı.',
 2, false, 'full', 54),

-- ALAN J — Olay Müdahalesi ve İş Sürekliliği (6 soru)
('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Siber saldırı veya veri ihlali yaşanırsa ilk 1 saatte kimin ne yapacağı yazılı olarak belirlenmiş mi?',
 'Panik anında plan yoksa kritik saatler boşa gider. Acil müdahale planı hazır mı?',
 3, true, 'full', 55),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Olay müdahale planı son 12 ay içinde tatbikatla test edildi mi?',
 'Yazılı plan yetmez; pratikte de çalışıp çalışmadığı test edilmeli.',
 1, false, 'full', 56),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Siber saldırı sonrası müşterilere, iş ortaklarına ve yasal makamlara bildirim yapma süreci tanımlı mı?',
 '"Kiminle nasıl iletişim kurarız?" sorusunun cevabı kriz anında değil öncesinde hazırlanmalı.',
 1, false, 'full', 57),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'KVKK kapsamında veri ihlali yaşanırsa 72 saat içinde KVK Kurulu''na bildirim yapma yükümlülüğü için hazırlık yapıldı mı?',
 'Kanuni zorunluluk. 72 saati geçirmek ek idari para cezasına yol açar.',
 2, true, 'full', 58),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Uzun süreli sistem kesintisinde işin nasıl devam edeceğine dair iş sürekliliği planı hazırlanmış mı?',
 'Sunucu 3 gün çalışmazsa ne olur? Kritik işlemler manuel yürütülebilir mi?',
 1, false, 'full', 59),

('J', 'Olay Müdahalesi ve İş Sürekliliği',
 'Siber sigorta poliçesi değerlendirildi veya satın alındı mı?',
 'Siber sigorta; fidye ödemesi, veri kurtarma, müşteri bildirimi gibi maliyetleri karşılar.',
 1, false, 'full', 60);
```

---

## PART 2: SCORING LOGIC UPDATE

Update the scoring calculation file (`src/scoring.ts` or wherever scores are calculated):

```typescript
// ANSWER VALUES
export const ANSWER_VALUES = {
  'evet': 5,
  'kismen': 3,
  'hayir': 0,
  'bilmiyorum': 0  // Changed from 1 to 0 — "don't know" = "no" for security
} as const;

// WEIGHT MULTIPLIERS
export const WEIGHT_MULTIPLIERS = {
  1: 1,   // Normal
  2: 2,   // Önemli
  3: 3    // Kritik
} as const;

// MAX SCORES
export const MAX_SCORES = {
  mini: 195,  // Calculated: (5×3×5) + (9×2×5) + (6×1×5) = 75+90+30 = 195
  full: 480   // Calculated: (7×3×5) + (20×2×5) + (33×1×5) = 105+200+165 = 470
              // Note: recalculate after inserting questions
} as const;

// RISK THRESHOLDS (percentage of max score)
export const RISK_THRESHOLDS = {
  mini: {
    KRITIK:  { min: 0,   max: 30  },  // 0-58 raw
    YUKSEK:  { min: 31,  max: 50  },  // 59-97 raw
    ORTA:    { min: 51,  max: 70  },  // 98-136 raw
    DUSUK:   { min: 71,  max: 85  },  // 137-165 raw
    IYI:     { min: 86,  max: 100 }   // 166-195 raw
  },
  full: {
    KRITIK:  { min: 0,   max: 30  },
    YUKSEK:  { min: 31,  max: 50  },
    ORTA:    { min: 51,  max: 70  },
    DUSUK:   { min: 71,  max: 85  },
    IYI:     { min: 86,  max: 100 }
  }
} as const;

export function calculateScore(
  answers: { questionId: number; answer: string; weight: number }[],
  assessmentType: 'mini' | 'full'
): {
  rawScore: number;
  maxScore: number;
  percentage: number;
  riskLevel: string;
  domainScores: Record<string, { score: number; maxScore: number; percentage: number }>;
  redAlarmCount: number;
} {
  let rawScore = 0;
  let maxScore = 0;
  const domainScores: Record<string, { score: number; maxScore: number }> = {};

  for (const answer of answers) {
    const value = ANSWER_VALUES[answer.answer as keyof typeof ANSWER_VALUES] ?? 0;
    const weighted = value * answer.weight;
    const maxWeighted = 5 * answer.weight;
    
    rawScore += weighted;
    maxScore += maxWeighted;
    
    // Domain breakdown
    // (domain letter comes from question lookup)
  }

  const percentage = Math.round((rawScore / maxScore) * 100);
  
  const thresholds = RISK_THRESHOLDS[assessmentType];
  let riskLevel = 'ORTA';
  for (const [level, range] of Object.entries(thresholds)) {
    if (percentage >= range.min && percentage <= range.max) {
      riskLevel = level;
      break;
    }
  }

  // Convert domain scores to percentages
  const domainScoresWithPct = Object.fromEntries(
    Object.entries(domainScores).map(([k, v]) => [
      k,
      { ...v, percentage: Math.round((v.score / v.maxScore) * 100) }
    ])
  );

  return {
    rawScore,
    maxScore,
    percentage,
    riskLevel,
    domainScores: domainScoresWithPct,
    redAlarmCount: 0 // calculate separately
  };
}
```

---

## PART 3: RISK LEVEL DISPLAY CONSTANTS

Create or update `src/constants/riskLevels.ts`:

```typescript
export const RISK_LEVEL_CONFIG = {
  KRITIK: {
    label: 'KRİTİK',
    color: '#FF1744',
    bg: 'rgba(255,23,68,0.12)',
    icon: '🚨',
    description: 'Acil önlem alınması gereken kritik güvenlik açıkları mevcut.',
    action: 'Bu hafta bir güvenlik uzmanıyla görüşün ve en kritik bulguları kapatın.'
  },
  YUKSEK: {
    label: 'YÜKSEK',
    color: '#FF4560',
    bg: 'rgba(255,69,96,0.10)',
    icon: '🔴',
    description: 'Ciddi güvenlik açıkları tespit edildi. Kısa vadede müdahale gerekiyor.',
    action: 'Bu ay içinde aksiyona geçin. Kritik bulgulardan başlayın.'
  },
  ORTA: {
    label: 'ORTA',
    color: '#FFB020',
    bg: 'rgba(255,176,32,0.10)',
    icon: '🟡',
    description: 'Temel güvenlik kontrolleri kısmen mevcut, iyileştirme gerekiyor.',
    action: 'Öncelikli açıkları bu çeyrekte kapatın.'
  },
  DUSUK: {
    label: 'DÜŞÜK',
    color: '#00B8D9',
    bg: 'rgba(0,184,217,0.10)',
    icon: '🔵',
    description: 'Güvenlik duruşunuz iyi, bazı boşluklar mevcut.',
    action: 'Eksik kontrolleri tamamlayın ve sürekli izlemeyi güçlendirin.'
  },
  IYI: {
    label: 'İYİ',
    color: '#00E096',
    bg: 'rgba(0,224,150,0.10)',
    icon: '🟢',
    description: 'Güçlü güvenlik duruşu. Sürekli izleme ile bu seviyeyi koruyun.',
    action: 'Sertifikasyon için tam değerlendirme yaptırmayı düşünün.'
  }
} as const;

// AREA DESCRIPTIONS (shown in report and wizard)
export const AREA_CONFIG = {
  A: { label: 'Yönetişim ve Organizasyon',       icon: '🏛️', weight: 10 },
  B: { label: 'Kimlik ve Erişim Yönetimi',        icon: '🔑', weight: 15 },
  C: { label: 'E-posta ve Sosyal Mühendislik',    icon: '📧', weight: 15 },
  D: { label: 'Cihaz ve Uç Nokta Güvenliği',      icon: '💻', weight: 12 },
  E: { label: 'Ağ Güvenliği',                     icon: '🌐', weight: 12 },
  F: { label: 'Veri Koruma ve Yedekleme',         icon: '💾', weight: 15 },
  G: { label: 'Yazılım ve Dijital Araçlar',       icon: '⚙️', weight: 8  },
  H: { label: 'Fiziksel Güvenlik',                icon: '🔒', weight: 5  },
  I: { label: 'Tedarik Zinciri ve Üçüncü Taraf',  icon: '🔗', weight: 8  },
  J: { label: 'Olay Müdahalesi ve İş Sürekliliği', icon: '🚑', weight: 10 }
} as const;
```

---

## PART 4: FRONTEND WIZARD UPDATE

Update the assessment wizard component (`src/components/AssessmentWizard.tsx` or similar):

### 4a — Help Text Display
Under each question text, show the help_text from database in a subtle gray box:
```tsx
{question.helpText && (
  <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-3 border-gray-300">
    <p className="text-sm text-gray-600 leading-relaxed">
      💡 {question.helpText}
    </p>
  </div>
)}
```

### 4b — Answer Options
Update answer button labels and behavior:

```tsx
const ANSWER_OPTIONS = [
  { value: 'evet',       label: 'Evet',        sublabel: 'Tam anlamıyla uygulanıyor',   points: 5, color: 'green'  },
  { value: 'kismen',     label: 'Kısmen',      sublabel: 'Kısmen uygulanıyor',          points: 3, color: 'yellow' },
  { value: 'hayir',      label: 'Hayır',       sublabel: 'Henüz uygulanmıyor',          points: 0, color: 'red'    },
  { value: 'bilmiyorum', label: 'Bilmiyorum',  sublabel: 'Bu konuda bilgim yok',        points: 0, color: 'gray'   }
];
```

Show a subtle note when user selects "Bilmiyorum":
```tsx
{selectedAnswer === 'bilmiyorum' && (
  <p className="text-xs text-amber-600 mt-1">
    ⚠️ "Bilmiyorum" yanıtı, güvenlik değerlendirmesinde "Hayır" ile aynı etkiye sahiptir.
  </p>
)}
```

### 4c — Progress Display
Show area progress in wizard header:
```tsx
// Show current area name and icon
<div className="flex items-center gap-2 text-sm text-gray-600">
  <span>{AREA_CONFIG[currentArea].icon}</span>
  <span>Alan {currentArea}: {AREA_CONFIG[currentArea].label}</span>
  <span className="text-gray-400">•</span>
  <span>Soru {currentQuestionIndex + 1} / {totalQuestions}</span>
</div>
```

### 4d — Mini vs Full indicator on question cards
For mini assessment questions, mark critical ones with subtle badge:
```tsx
{question.weight === 3 && (
  <span className="inline-flex items-center text-xs text-red-600 font-medium">
    ● Kritik kontrol
  </span>
)}
```

---

## PART 5: REPORT GENERATION — CLAUDE PROMPT UPDATE

Update the Claude/Gemini report generation prompt. Find the function that calls AI API for report generation and replace the prompt with this:

### Mini Assessment Report Prompt:
```typescript
const MINI_REPORT_PROMPT = (data: AssessmentData) => `
Sen CyberStep.io'nun Sanal CISO'susun. 
Aşağıdaki mini değerlendirme sonuçlarına göre Türkçe bir risk raporu hazırla.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}
ÇALIŞAN SAYISI: ${data.employeeCount}
TOPLAM SKOR: ${data.rawScore} / ${data.maxScore} (${data.percentage}%)
RİSK SEVİYESİ: ${data.riskLevel}

ALAN SONUÇLARI:
${Object.entries(data.domainScores).map(([domain, score]) => 
  `Alan ${domain} (${AREA_CONFIG[domain as keyof typeof AREA_CONFIG].label}): ${score.percentage}%`
).join('\n')}

KIRMIZI ALARM SORULAR (Hayır veya Bilmiyorum cevaplanan kritik kontroller):
${data.redAlarmAnswers.map(q => `- ${q.questionText}`).join('\n')}

RAPORU ŞU FORMATTA ÜRETİN (JSON):
{
  "executive_summary": "2-3 cümle. Patron dili. Teknik terim yok. TL risk varsa belirt.",
  
  "risk_statement": "Tek güçlü cümle. Örnek: Şirketinizin e-posta altyapısı, CEO adına sahte ödeme talebi gönderilebilecek şekilde yapılandırılmış.",
  
  "top_3_risks": [
    {
      "title": "Kısa başlık (max 6 kelime)",
      "description": "Bu risk ne anlama geliyor? (1-2 cümle, teknik olmayan dil)",
      "business_impact": "Bu olursa ne olur? (₺ veya operasyonel etki)",
      "action": "Bu hafta yapılabilecek tek somut adım",
      "effort": "kolay | orta | zor",
      "urgency": "bu_hafta | bu_ay | 3_ay_icinde"
    }
  ],
  
  "domain_comments": {
    "A": "1 cümle yorum (sadece dikkat çekecek bir şey varsa)",
    "B": "...",
    "C": "...",
    "D": "...",
    "E": "...",
    "F": "...",
    "G": "...",
    "H": "...",
    "I": "...",
    "J": "..."
  },
  
  "kvkk_note": "KVKK açısından bu sonuçların ne anlama geldiğini 1-2 cümlede belirt. Ceza riski varsa tahmini TL tutarını yaz.",
  
  "next_step": "Müşteriyi Tam Değerlendirme''ye yönlendirecek doğal bir cümle.",
  
  "financial_risk_estimate": {
    "min_tl": 0,
    "max_tl": 0,
    "basis": "Bu tahminin dayandığı 2-3 faktör"
  }
}

ÖNEMLİ KURALLAR:
- Asla "SPF", "DKIM", "DMARC", "CVE", "SIEM", "EDR" gibi teknik terim kullanma — her birini iş diline çevir
- TL tutarları Türkiye sektör verilerine dayandır
- Ton: ciddi ama panikletmeyen, çözüm odaklı, danışman gibi
- Sadece JSON döndür, başka metin ekleme
`;
```

### Full Assessment Report Prompt:
```typescript
const FULL_REPORT_PROMPT = (data: AssessmentData) => `
Sen CyberStep.io'nun Sanal CISO'susun.
Ücretli Tam Değerlendirme raporu hazırlıyorsun. Bu rapor profesyonel ve kapsamlı olmalı.

ŞİRKET: ${data.companyName}
SEKTÖR: ${data.sector}
ÇALIŞAN SAYISI: ${data.employeeCount}
TOPLAM SKOR: ${data.rawScore} / ${data.maxScore} (${data.percentage}%)
RİSK SEVİYESİ: ${data.riskLevel}

ALAN DETAYLARI:
${Object.entries(data.domainScores).map(([domain, score]) => 
  `Alan ${domain} — ${AREA_CONFIG[domain as keyof typeof AREA_CONFIG].label}: ${score.percentage}% (${score.score}/${score.maxScore})`
).join('\n')}

TÜM CEVAPLAR:
${data.allAnswers.map(a => `[Alan ${a.domain}] ${a.questionText}: ${a.answer} (${a.weight}x ağırlık)`).join('\n')}

JSON FORMATINDA ÜRETİN:
{
  "executive_summary": "Yönetim kuruluna sunulabilecek 4-5 cümle özet. Teknik olmayan dil, iş etkisi odaklı.",
  
  "risk_headline": "En kritik tek cümle bulgu.",
  
  "maturity_level": {
    "level": 1-5,
    "label": "Başlangıç | Gelişmekte | Orta | İleri | Optimize",
    "description": "Bu seviyenin ne anlama geldiği 1 cümle"
  },
  
  "findings": [
    {
      "id": 1,
      "domain": "B",
      "severity": "critical | high | medium | low",
      "title": "Kısa başlık",
      "description": "Teknik olmayan açıklama (2-3 cümle)",
      "business_impact": "Bu olursa ne olur",
      "mitre_technique": "T1078 (isteğe bağlı)",
      "remediation": "Spesifik aksiyon adımı",
      "effort": "kolay | orta | zor",
      "timeframe": "bu_hafta | bu_ay | 3_ay | 6_ay"
    }
  ],
  
  "domain_analysis": {
    "A": { "summary": "2-3 cümle", "strengths": [], "gaps": [] },
    "B": { ... },
    ...
  },
  
  "financial_risk": {
    "min_tl": 0,
    "max_tl": 0,
    "avg_tl": 0,
    "kvkk_fine_risk_tl": 0,
    "basis": "Hesaplama dayanaklarını listele"
  },
  
  "kvkk_analysis": {
    "risk_level": "YÜKSEK | ORTA | DÜŞÜK",
    "relevant_articles": ["Md.12", "Md.18"],
    "estimated_fine_tl": 0,
    "priority_actions": ["KVKK özelinde yapılması gerekenler"]
  },
  
  "sector_benchmark": {
    "comment": "Sektör karşılaştırması 1-2 cümle"
  },
  
  "roadmap": {
    "this_week": ["Acil, düşük çaba gerektiren aksiyonlar"],
    "this_month": ["Bu ay tamamlanabilecekler"],
    "quarter": ["3 ay içinde yapılması gerekenler"],
    "six_months": ["6 aylık plan"]
  },
  
  "certification_eligibility": {
    "eligible": true/false,
    "tier": null | "standard" | "gold" | "platinum",
    "blocking_items": ["Sertifika için kapatılması gereken bulgular"]
  },
  
  "board_summary": {
    "one_liner": "Yönetim kurulu için tek cümle",
    "key_numbers": {
      "score": "${data.percentage}",
      "critical_findings": 0,
      "risk_tl": "₺X - ₺Y"
    }
  }
}

KURALLAR:
- Tüm teknik terimleri Türkçe iş diline çevir
- TL tutarları gerçekçi ve Türkiye verilerine dayalı olsun
- findings listesi önem sırasına göre sıralı olsun
- Sadece JSON döndür
`;
```

---

## PART 6: ADMIN PANEL — QUESTION MANAGEMENT UPDATE

In the admin panel questions section, update to show:
- `area_label` column
- `weight` with badge: 1=Normal (gray), 2=Önemli (yellow), 3=Kritik (red)
- `assessment_type` filter: All | Mini | Full
- `help_text` in expanded row view
- Question count by area and type summary card at top

---

## PART 7: SCORING DISPLAY IN REPORT

Update the report display to show `Bilmiyorum` answers differently:

```tsx
// In the findings/answers display:
const ANSWER_DISPLAY = {
  'evet':       { label: 'Evet',        color: 'green',  icon: '✅' },
  'kismen':     { label: 'Kısmen',      color: 'yellow', icon: '🟡' },
  'hayir':      { label: 'Hayır',       color: 'red',    icon: '❌' },
  'bilmiyorum': { label: 'Bilmiyorum',  color: 'gray',   icon: '❓' }
};

// Show note: "Bilmiyorum yanıtları güvenlik değerlendirmesinde Hayır olarak işlendi"
// Display this note if assessment contains any bilmiyorum answers
```

---

## PART 8: MAX SCORE VALIDATION

After inserting all questions, run this to verify and update max scores:

```typescript
// Add this to the server startup or as a migration:
async function validateAndUpdateMaxScores() {
  const miniQuestions = await db.select().from(questions).where(eq(questions.assessmentType, 'mini'));
  const fullQuestions = await db.select().from(questions).where(eq(questions.assessmentType, 'full'));
  
  const miniMax = miniQuestions.reduce((sum, q) => sum + (5 * q.weight), 0);
  const fullMax = fullQuestions.reduce((sum, q) => sum + (5 * q.weight), 0);
  
  console.log(`Mini max score: ${miniMax}`);
  console.log(`Full max score: ${fullMax}`);
  
  // Update constants file with these values
}
```

---

## SUMMARY OF CHANGES

1. ✅ 20 mini questions — redesigned, all 10 areas covered (2 per area)
2. ✅ 60 full questions — redesigned, all 10 areas (6 per area)  
3. ✅ Bilmiyorum = 0 points (was 1)
4. ✅ Weight system: 1=Normal, 2=Önemli, 3=Kritik (was 1x/2x only)
5. ✅ help_text field — plain Turkish explanation per question
6. ✅ Risk thresholds: 5 levels from KRİTİK to İYİ (percentage based)
7. ✅ Turkish KOBİ-specific questions added: AI tools, WhatsApp, domain security, accounting software, social media accounts
8. ✅ Technical jargon removed from all questions
9. ✅ Alan G made realistic for non-developer companies
10. ✅ Claude prompts updated for both report types
11. ✅ Frontend wizard updated with help text, better answer display
12. ✅ Mathematical errors corrected

---

*CyberStep Assessment Yenileme — Replit Agent Promptu — Mayıs 2026*
