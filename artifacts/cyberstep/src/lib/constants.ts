export const SECTORS = [
  "Perakende/Ticaret",
  "Üretim/Sanayi",
  "Sağlık",
  "Finans/Sigorta",
  "Eğitim",
  "Hizmet Sektörü",
  "Teknoloji",
  "Diğer"
];

export const EMPLOYEE_COUNTS = [
  "1-10",
  "11-50",
  "51-250",
  "250+"
];

export const MINI_ASSESSMENT_SECTIONS = [
  {
    id: "A",
    title: "Yönetişim ve Organizasyon",
    questions: [
      { id: 1,  text: "Şirketinizde siber güvenlikten sorumlu atanmış bir kişi var mı?", isCritical: false, weight: 1 as const, helpText: "Bu kişi IT çalışanı olmak zorunda değil. \"Bir sorun çıkarsa kim arar?\" sorusunun cevabını bilen biri yeterli." },
      { id: 2,  text: "Şirketinizde kullanılan sistemler, yazılımlar ve hassas verilerin nerede tutulduğu listelenmiş mi?", isCritical: false, weight: 1 as const, helpText: "Müşteri bilgisi, personel verisi, finansal kayıtlar hangi programda veya bilgisayarda duruyor? Bunu biliyor musunuz?" },
    ]
  },
  {
    id: "B",
    title: "Kimlik ve Erişim Yönetimi",
    questions: [
      { id: 3,  text: "Çalışanlar e-posta ve iş uygulamalarına girerken SMS kodu veya telefon onayı (2FA) kullanıyor mu?", isCritical: true, weight: 3 as const, helpText: "Sadece şifre yetmiyor. \"Girişi onayla\" gibi ek bir adım, hesap ele geçirilmesini çok zorlaştırır." },
      { id: 4,  text: "İşten ayrılan çalışanların şirket sistemlerine ve e-postaya erişimi aynı gün kapatılıyor mu?", isCritical: true, weight: 3 as const, helpText: "Ayrılan çalışanın hesabı açık kalırsa istemeden veya bilerek şirket verilerine erişebilir." },
    ]
  },
  {
    id: "C",
    title: "E-posta ve Sosyal Mühendislik",
    questions: [
      { id: 5,  text: "IBAN değişikliği veya acil para transferi taleplerinde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?", isCritical: true, weight: 3 as const, helpText: "Saldırganlar yönetici gibi görünerek \"acil havale yap\" e-postası gönderiyor. Telefon ile teyit bu saldırıyı engeller." },
      { id: 6,  text: "Şirket e-posta adresinizin taklit edilerek sahte mail gönderilmesini engelleyen teknik önlem alındı mı?", isCritical: false, weight: 2 as const, helpText: "Teknik önlem alınmadan saldırganlar sizin adınıza e-posta gönderebilir. Bu konuda IT destek aldınız mı?" },
    ]
  },
  {
    id: "D",
    title: "Cihaz ve Uç Nokta Güvenliği",
    questions: [
      { id: 7,  text: "Şirket bilgisayarlarında güncel zararlı yazılım koruma (antivirüs/güvenlik) çözümü aktif mi?", isCritical: false, weight: 2 as const, helpText: "Sadece Windows Defender yeterli değildir. Kurumsal bir güvenlik çözümü merkezi olarak yönetilmeli." },
      { id: 8,  text: "Bilgisayarlar ve iş yazılımları (Windows, Office, muhasebe programı vb.) düzenli olarak güncelleniyor mu?", isCritical: false, weight: 2 as const, helpText: "Güncellenmemiş yazılımlar saldırganların en çok kullandığı giriş kapısı. Otomatik güncelleme açık mı?" },
    ]
  },
  {
    id: "E",
    title: "Ağ Güvenliği",
    questions: [
      { id: 9,  text: "Şirketin internet bağlantısını koruyan bir güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?", isCritical: true, weight: 3 as const, helpText: "Modem/router içindeki basit güvenlik duvarı yeterli değildir. Kurumsal bir firewall cihazı veya yazılımı var mı?" },
      { id: 10, text: "Müşteri veya ziyaretçilere sunulan Wi-Fi ağı, şirketin iç ağından tamamen ayrı mı?", isCritical: false, weight: 1 as const, helpText: "Aynı Wi-Fi'ye bağlanan bir ziyaretçi, iç sistemlerinize erişebilir. Misafir ağı ayrı mı?" },
    ]
  },
  {
    id: "F",
    title: "Veri Koruma ve Yedekleme",
    questions: [
      { id: 11, text: "Kritik verileriniz düzenli ve tercihen otomatik olarak yedekleniyor mu?", isCritical: true, weight: 3 as const, helpText: "Fidye yazılımı saldırısında yedek yoksa tüm verilerinizi kaybedebilirsiniz. Günlük otomatik yedek var mı?" },
      { id: 12, text: "Alınan yedeklerin gerçekten çalıştığı son 12 ay içinde test edildi mi?", isCritical: false, weight: 2 as const, helpText: "Yedek almak yetmez; geri yüklenip yüklenmediği de test edilmeli. Son ne zaman denendi?" },
    ]
  },
  {
    id: "G",
    title: "Yazılım ve Dijital Araçlar",
    questions: [
      { id: 13, text: "Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?", isCritical: false, weight: 2 as const, helpText: "Ortak kullanılan tek şifre, kimin ne yaptığını izlemeyi imkânsız kılar ve güvenlik riskini artırır." },
      { id: 14, text: "Çalışanların ChatGPT gibi yapay zeka araçlarına şirket verisi, müşteri bilgisi veya sözleşme yüklemesini önleyen kural var mı?", isCritical: false, weight: 1 as const, helpText: "Yapay zeka araçlarına yüklenen veriler üçüncü taraf sunucularda saklanabilir. KVKK açısından risk taşır." },
    ]
  },
  {
    id: "H",
    title: "Fiziksel Güvenlik",
    questions: [
      { id: 15, text: "Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?", isCritical: false, weight: 2 as const, helpText: "Sunucu odası kilitli mi? Kimler girebilir? Fiziksel erişim, dijital saldırı kadar ciddi bir risktir." },
      { id: 16, text: "Müşteri bilgisi veya finansal veri içeren belgeler güvenli şekilde imha ediliyor mu (kağıt parçalama vb.)?", isCritical: false, weight: 1 as const, helpText: "Çöpe atılan belgeler bilgi hırsızlığına yol açabilir. Kağıt imha makinesi kullanılıyor mu?" },
    ]
  },
  {
    id: "I",
    title: "Tedarik Zinciri ve Dijital Varlıklar",
    questions: [
      { id: 17, text: "Şirketin sosyal medya hesaplarına (Instagram, LinkedIn vb.) kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?", isCritical: false, weight: 2 as const, helpText: "Hesap ele geçirilmesi hem itibar kaybına hem müşteri dolandırıcılığına yol açar. Kaç kişi bu şifreleri biliyor?" },
      { id: 18, text: "Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve bu konuda sorumlu kişi belirlenmiş mi?", isCritical: false, weight: 1 as const, helpText: "Domain yenilenmezse web siteniz ve e-postanız tamamen durur. Son yenileme ne zaman yapıldı?" },
    ]
  },
  {
    id: "J",
    title: "Olay Müdahalesi ve İş Sürekliliği",
    questions: [
      { id: 19, text: "Şirkete siber saldırı yaşanırsa ilk 1 saatte kimin ne yapacağı önceden belirlenmiş mi?", isCritical: false, weight: 2 as const, helpText: "Panik anında plan yoksa değerli zaman kaybedilir. \"Kim aranır, ne kapatılır, kim bilgilendirilir?\" yazılı mı?" },
      { id: 20, text: "KVKK kapsamında müşteri verisi sızdığında 72 saat içinde bildirim yapma yükümlülüğünüz için hazırlık yapıldı mı?", isCritical: false, weight: 2 as const, helpText: "Kanuni zorunluluk: veri ihlalini öğrendiğinizden itibaren 72 saat içinde KVK Kurulu'na bildirim yapılmalı." },
    ]
  },
];

export const FULL_ASSESSMENT_SECTIONS = [
  {
    id: "A",
    title: "Yönetişim ve Risk Yönetimi",
    questions: [
      { id: 1,  text: "Şirketinizde siber güvenlikten sorumlu atanmış bir kişi veya ekip var mı?", isCritical: false, weight: 1 as const, helpText: "Bu kişinin teknik uzman olması şart değil. Siber güvenlik konusunda kararları kim alıyor, sorunları kim çözüyor?" },
      { id: 2,  text: "Yıllık siber güvenlik bütçesi planlanıyor mu?", isCritical: false, weight: 1 as const, helpText: "Küçük bir bütçe bile olsa, güvenlik için ayrılan kaynağın belirlenmesi önemli bir olgunluk göstergesi." },
      { id: 3,  text: "Çalışanların şirket bilgisayarları, hesapları ve verilerini nasıl kullanacağına dair yazılı kurallar mevcut mu?", isCritical: false, weight: 1 as const, helpText: "\"Kabul Edilebilir Kullanım Politikası\" olarak da bilinir. İmzalatılmış bir belge var mı?" },
      { id: 4,  text: "Şirkette kullanılan tüm sistemler, yazılımlar ve hassas verilerin nerede tutulduğuna dair güncel bir liste var mı?", isCritical: false, weight: 1 as const, helpText: "Hangi verinin hangi sistemde olduğunu bilmeden onu koruyamazsınız." },
      { id: 5,  text: "Üst yönetim veya ortaklar, şirketin siber güvenlik risklerini düzenli olarak gündeme alıyor mu?", isCritical: false, weight: 1 as const, helpText: "Yılda en az bir kez bile olsa, güvenlik durumunun üst yönetime raporlanması kritik." },
      { id: 6,  text: "Yeni işe giren çalışanlara işe başlarken siber güvenlik kuralları ve sorumlulukları anlatılıyor mu?", isCritical: false, weight: 1 as const, helpText: "Oryantasyon eğitimi, insan kaynaklı hataları ve ihmalleri önemli ölçüde azaltır." },
    ]
  },
  {
    id: "B",
    title: "Kimlik ve Erişim Yönetimi",
    questions: [
      { id: 7,  text: "Tüm çalışanlar için güçlü ve farklı şifreler kullanmaları zorunlu mu?", isCritical: false, weight: 1 as const, helpText: "En az 12 karakter, büyük/küçük harf, rakam ve sembol içeren şifre. Aynı şifrenin birden fazla yerde kullanımı yasaklı mı?" },
      { id: 8,  text: "Çalışanlar iş uygulamaları ve e-postaya SMS kodu veya uygulama onayı (2FA) ile giriş yapıyor mu?", isCritical: true, weight: 3 as const, helpText: "Bu tek önlem bile hesap ele geçirme saldırılarının büyük çoğunluğunu engeller." },
      { id: 9,  text: "Şirkete dışarıdan bağlanan çalışanlar ve IT yetkilileri ek doğrulama (VPN + 2FA) kullanıyor mu?", isCritical: false, weight: 2 as const, helpText: "Uzak erişim, saldırganların en çok hedeflediği giriş noktası. Ekstra koruma şart." },
      { id: 10, text: "İşten ayrılan çalışanların tüm sistem, uygulama ve e-posta erişimleri ayrılış günü kapatılıyor mu?", isCritical: true, weight: 3 as const, helpText: "Ayrılan çalışanın hesabı açık kalması en yaygın güvenlik açıklarından. Prosedür yazılı mı?" },
      { id: 11, text: "Çalışanlar yalnızca kendi işleri için ihtiyaç duydukları sistemlere ve dosyalara erişebiliyor mu?", isCritical: false, weight: 1 as const, helpText: "Muhasebeci neden üretim verilerine erişebilsin? Her çalışan sadece ihtiyacı kadar yetkiye sahip olmalı." },
      { id: 12, text: "Sistem yöneticisi veya IT yetkilisi hesapları düzenli olarak gözden geçiriliyor ve denetleniyor mu?", isCritical: false, weight: 2 as const, helpText: "Yüksek yetkili hesaplar en çok hedef alınanlardır. Bunların listesi ve kullanım kaydı tutuluyor mu?" },
    ]
  },
  {
    id: "C",
    title: "E-posta ve Sosyal Mühendislik",
    questions: [
      { id: 13, text: "Çalışanlara yılda en az bir kez sahte e-posta (phishing) ve dolandırıcılık farkındalık eğitimi veriliyor mu?", isCritical: false, weight: 1 as const, helpText: "Saldırıların büyük çoğunluğu çalışanları kandırarak başlar. Farkındalık eğitimi en etkili savunma araçlarından." },
      { id: 14, text: "Şüpheli e-postaları bildirmek için çalışanların başvurabileceği net bir kişi veya kanal tanımlanmış mı?", isCritical: false, weight: 1 as const, helpText: "\"Şüpheli bir şey gördüm, kime söyleyeyim?\" sorusunun cevabı her çalışan tarafından biliniyor mu?" },
      { id: 15, text: "Gelen e-postalarda zararlı ek ve bağlantıları filtreleyen bir güvenlik sistemi aktif mi?", isCritical: false, weight: 2 as const, helpText: "E-posta güvenlik filtresi, zararlı e-postaların gelen kutusuna ulaşmadan engellenmesini sağlar." },
      { id: 16, text: "Şirket e-posta adresinin taklit edilmesini engelleyen teknik ayarlar (SPF, DKIM, DMARC) yapılandırılmış mı?", isCritical: false, weight: 2 as const, helpText: "Bu ayarlar olmadan, saldırganlar sizin adınıza e-posta göndererek müşterilerinizi ve çalışanlarınızı kandırabilir." },
      { id: 17, text: "IBAN değişikliği veya acil para transferi gibi taleplerde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?", isCritical: true, weight: 3 as const, helpText: "\"CEO Dolandırıcılığı\": Saldırgan yönetici kılığına girerek \"acil havale yap\" e-postası gönderir. Telefon teyidi bunu engeller." },
      { id: 18, text: "Şirket içi iletişim ve müşteri yazışmaları için kullanılan WhatsApp gruplarına dair güvenlik kuralı var mı?", isCritical: false, weight: 1 as const, helpText: "WhatsApp gruplarında paylaşılan sözleşme, fatura veya müşteri bilgisi KVKK riski doğurabilir." },
    ]
  },
  {
    id: "D",
    title: "Cihaz ve Uç Nokta Güvenliği",
    questions: [
      { id: 19, text: "Şirkette kullanılan tüm bilgisayarların güncel bir envanteri tutuluyor mu?", isCritical: false, weight: 1 as const, helpText: "Hangi bilgisayar var, kimin kullandığı, hangi yazılım yüklü? Bu liste olmadan güvenliği yönetmek mümkün değil." },
      { id: 20, text: "Çalışan bilgisayarlarında merkezi olarak yönetilen zararlı yazılım koruma çözümü (EDR/antivirüs) aktif mi?", isCritical: false, weight: 2 as const, helpText: "Her bilgisayarda aynı koruma yazılımı, merkezi izleme ile yönetilmeli. Sadece Windows Defender yeterli değil." },
      { id: 21, text: "İşletim sistemi ve iş uygulamaları otomatik olarak güncelleniyor mu?", isCritical: false, weight: 2 as const, helpText: "Güncelleme gecikmesi, bilinen açıkların istismarını kolaylaştırır. Otomatik güncelleme açık mı?" },
      { id: 22, text: "Dizüstü bilgisayar ve mobil cihazlarda ekran kilidi ve disk şifrelemesi aktif mi?", isCritical: false, weight: 1 as const, helpText: "Cihaz çalınırsa veya kaybolursa şifrelenmiş disk, verilerin ele geçirilmesini engeller." },
      { id: 23, text: "Çalışanların kişisel cihazlarıyla (kendi telefon/bilgisayar) şirket sistemlerine bağlanmasına dair yazılı kural var mı?", isCritical: false, weight: 1 as const, helpText: "Kişisel cihazlar şirket güvenlik standartlarını karşılamayabilir. Bu konuda politika belirlenmiş mi?" },
      { id: 24, text: "USB ve taşınabilir bellek kullanımı şirket bilgisayarlarında denetleniyor veya kısıtlanıyor mu?", isCritical: false, weight: 1 as const, helpText: "USB yoluyla veri sızdırma ve zararlı yazılım bulaştırma hâlâ yaygın bir saldırı yöntemi." },
    ]
  },
  {
    id: "E",
    title: "Ağ Güvenliği",
    questions: [
      { id: 25, text: "Şirketin internet bağlantısını koruyan kurumsal güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?", isCritical: true, weight: 3 as const, helpText: "Modem içindeki temel koruma kurumsal ağ için yeterli değil. Ayrı bir firewall cihazı veya yazılımı var mı?" },
      { id: 26, text: "Misafir veya müşteri Wi-Fi ağı şirketin iç ağından tamamen ayrılmış mı?", isCritical: false, weight: 1 as const, helpText: "Aynı ağa bağlanan bir ziyaretçi, iç sistemlere erişebilir. Ayrı bir misafir SSID var mı?" },
      { id: 27, text: "Ağ trafiği izleniyor ve olağandışı bağlantılar için uyarı sistemi kurulu mu?", isCritical: false, weight: 2 as const, helpText: "\"Gece 3'te Rusya'ya veri gidiyor\" gibi anomalileri tespit eden bir sistem var mı?" },
      { id: 28, text: "Finans sistemi, müşteri veri tabanı gibi kritik sistemler ağ içinde diğerlerinden ayrılmış mı?", isCritical: false, weight: 2 as const, helpText: "Ağ segmentasyonu: bir bölüme sızan saldırgan otomatik olarak diğer bölümlere geçememeli." },
      { id: 29, text: "Kullanılmayan ağ portları ve servisler kapalı mı?", isCritical: false, weight: 1 as const, helpText: "Açık her port potansiyel giriş kapısıdır. Düzenli port taraması yapılıyor mu?" },
      { id: 30, text: "Şirket dışından yönetim amaçlı sisteme bağlanmak (uzak masaüstü vb.) VPN üzerinden yapılıyor mu?", isCritical: false, weight: 2 as const, helpText: "Doğrudan açık RDP bağlantısı, fidye yazılımının en yaygın giriş noktası. VPN zorunlu mu?" },
    ]
  },
  {
    id: "F",
    title: "Veri Koruma ve Yedekleme",
    questions: [
      { id: 31, text: "Kritik veriler düzenli ve tercihen otomatik olarak yedekleniyor mu?", isCritical: true, weight: 3 as const, helpText: "Fidye yazılımı saldırısında yedek olmadan tüm verilerinizi kaybedebilirsiniz. Günlük otomatik yedek var mı?" },
      { id: 32, text: "Yedekler, ana sistemden fiziksel veya ağ olarak tamamen ayrı bir ortamda tutuluyor mu?", isCritical: true, weight: 3 as const, helpText: "Fidye yazılımı bağlı tüm diskleri şifreler. Yedek ayrı bir yerde (farklı lokasyon veya çevrimdışı disk) durmalı." },
      { id: 33, text: "Yedeklerin başarıyla geri yüklenip yüklenmediği son 12 ay içinde test edildi mi?", isCritical: false, weight: 2 as const, helpText: "Alınan yedeğin gerçekten çalışıp çalışmadığı test edilmeden güvenilir sayılamaz." },
      { id: 34, text: "Müşteri veya çalışanlara ait hassas veriler dışarıya gönderilirken şifreleniyor mu?", isCritical: false, weight: 1 as const, helpText: "E-posta eki, dosya transferi veya bulut paylaşımında hassas veri şifrelenmeli." },
      { id: 35, text: "Sunucularda veya bulutta depolanan hassas veriler şifreli mi?", isCritical: false, weight: 1 as const, helpText: "Disk şifreleme: birisi fiziksel olarak erişse bile veri okunamaz olmalı." },
      { id: 36, text: "KVKK kapsamındaki kişisel veriler (müşteri, çalışan bilgisi) için gerekli teknik ve idari tedbirler alındı mı?", isCritical: true, weight: 3 as const, helpText: "KVKK Madde 12 teknik önlem zorunluluğu. Yeterli önlem alınmadan yaşanan ihlallerde ceza artırılıyor." },
    ]
  },
  {
    id: "G",
    title: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",
    questions: [
      { id: 37, text: "Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?", isCritical: false, weight: 2 as const, helpText: "Ortak kullanılan tek şifre, kimin ne yaptığını izlemeyi imkânsız kılar ve yetkisiz erişim riskini artırır." },
      { id: 38, text: "Kullanılan üçüncü taraf yazılım ve sistemlerin güvenlik güncellemeleri düzenli takip ediliyor mu?", isCritical: false, weight: 2 as const, helpText: "Muhasebe yazılımı, ERP, CRM — bunların güncel ve destek kapsamında olması kritik." },
      { id: 39, text: "Çalışanların ChatGPT gibi yapay zeka araçlarına şirket verisi, müşteri bilgisi veya gizli belge yüklemesini önleyen kural veya farkındalık çalışması yapıldı mı?", isCritical: false, weight: 2 as const, helpText: "Bu araçlara yüklenen veriler üçüncü taraf sunucularda işlenir. KVKK ve gizlilik açısından ciddi risk taşır." },
      { id: 40, text: "Şirket web sitesi veya e-ticaret platformu düzenli güvenlik kontrolünden geçiyor mu?", isCritical: false, weight: 1 as const, helpText: "Web siteniz ele geçirilirse müşterileriniz dolandırılabilir, KVKK yükümlülüğünüz doğar." },
      { id: 41, text: "Bulut depolama (Google Drive, OneDrive, Dropbox) paylaşım izinleri düzenli gözden geçiriliyor mu?", isCritical: false, weight: 1 as const, helpText: "Eski çalışanlara veya harici kişilere verilmiş dosya izinleri kaldırıldı mı?" },
      { id: 42, text: "Şirket sosyal medya hesaplarına (Instagram, LinkedIn, Twitter/X vb.) kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?", isCritical: false, weight: 2 as const, helpText: "Sosyal medya hesabı ele geçirilmesi, müşteri dolandırıcılığına ve itibar kaybına yol açar." },
    ]
  },
  {
    id: "H",
    title: "Fiziksel Güvenlik",
    questions: [
      { id: 43, text: "Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?", isCritical: false, weight: 2 as const, helpText: "Kilitsiz sunucu odası = doğrudan veri erişimi. Fiziksel güvenlik, dijital kadar önemli." },
      { id: 44, text: "Ofise gelen ziyaretçiler kayıt altına alınıyor ve iç alanlarda yalnız bırakılmıyor mu?", isCritical: false, weight: 1 as const, helpText: "Ziyaretçi güvenlik politikası var mı? Misafir defteri veya elektronik kayıt tutuluyor mu?" },
      { id: 45, text: "Çalışanların masayı terk ederken bilgisayar ekranlarını kilitlemesi zorunlu mu?", isCritical: false, weight: 1 as const, helpText: "Dakikalık bir ihmal, yetkisiz kişinin ekranı görmesine veya sisteme erişmesine yol açabilir." },
      { id: 46, text: "Müşteri bilgisi veya finansal veri içeren hassas belgeler güvenli şekilde imha ediliyor mu?", isCritical: false, weight: 1 as const, helpText: "Kağıt imha makinesi kullanılıyor mu? Çöpe atılan belgeler ciddi bilgi sızıntısı riski taşır." },
      { id: 47, text: "Ofis dışında çalışılırken (ev, kafe, havalimanı) uyulması gereken cihaz güvenlik kuralları belirlenmiş mi?", isCritical: false, weight: 1 as const, helpText: "Halka açık Wi-Fi'de şifrelenmemiş bağlantı, VPN yoksa veri ele geçirme riski yaratır." },
      { id: 48, text: "Şirket cihazının kaybolması veya çalınması durumunda ne yapılacağı önceden belirlenmiş mi?", isCritical: false, weight: 2 as const, helpText: "Uzaktan silme, şifre değiştirme, bildirme prosedürü — bunlar tanımlı mı?" },
    ]
  },
  {
    id: "I",
    title: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",
    questions: [
      { id: 49, text: "Kritik hizmet sağlayıcıların (muhasebe yazılımı, bulut, ödeme sistemi) güvenlik uygulamaları değerlendiriliyor mu?", isCritical: false, weight: 1 as const, helpText: "Tedarikçiniz hacklenirse siz de etkilenebilirsiniz. Tedarikçi güvenliği kontrol ediliyor mu?" },
      { id: 50, text: "Dışarıdan çalışan muhasebeci, mali müşavir veya IT firmasının sistem erişimi sınırlı ve kayıt altında mı?", isCritical: false, weight: 2 as const, helpText: "Dış paydaşlar en az ayrıcalık prensibiyle yönetilmeli ve erişimleri işleri bittikten sonra kaldırılmalı." },
      { id: 51, text: "Tedarikçi ve iş ortağı sözleşmelerinde veri gizliliği ve güvenlik maddeleri yer alıyor mu?", isCritical: false, weight: 1 as const, helpText: "Müşteri verisi paylaşılan her iş ortağıyla KVKK uyumlu veri işleme sözleşmesi (DPA) imzalanmalı." },
      { id: 52, text: "Bulut hizmet sağlayıcılarının (hosting, e-posta, depolama) güvenlik sertifikasyonları kontrol ediliyor mu?", isCritical: false, weight: 1 as const, helpText: "ISO 27001, SOC 2 gibi sertifikalar, sağlayıcının minimum güvenlik standartlarını karşıladığını gösterir." },
      { id: 53, text: "Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve sorumlu kişi belirlenmiş mi?", isCritical: false, weight: 2 as const, helpText: "Domain süresi dolarsa web siteniz ve tüm e-postalarınız anında çalışmayı durdurur." },
      { id: 54, text: "Üçüncü taraf erişimleri sadece ihtiyaç duydukları sistemlerle sınırlı tutuluyor mu?", isCritical: false, weight: 2 as const, helpText: "IT firmanız neden muhasebe verilerinize erişebilsin? Her dış erişim minimum yetki ile sınırlı olmalı." },
    ]
  },
  {
    id: "J",
    title: "Olay Müdahalesi ve İş Sürekliliği",
    questions: [
      { id: 55, text: "Siber saldırı veya veri ihlali yaşanırsa ilk 1 saatte kimin ne yapacağı yazılı olarak belirlenmiş mi?", isCritical: true, weight: 3 as const, helpText: "Panik anında plan yoksa kritik saatler boşa gider. Acil müdahale planı hazır mı?" },
      { id: 56, text: "Olay müdahale planı son 12 ay içinde tatbikatla test edildi mi?", isCritical: false, weight: 1 as const, helpText: "Yazılı plan yetmez; pratikte de çalışıp çalışmadığı test edilmeli." },
      { id: 57, text: "Siber saldırı sonrası müşterilere, iş ortaklarına ve yasal makamlara bildirim yapma süreci tanımlı mı?", isCritical: false, weight: 1 as const, helpText: "\"Kiminle nasıl iletişim kurarız?\" sorusunun cevabı kriz anında değil öncesinde hazırlanmalı." },
      { id: 58, text: "KVKK kapsamında veri ihlali yaşanırsa 72 saat içinde KVK Kurulu'na bildirim yapma yükümlülüğü için hazırlık yapıldı mı?", isCritical: false, weight: 2 as const, helpText: "Kanuni zorunluluk. 72 saati geçirmek ek idari para cezasına yol açar." },
      { id: 59, text: "Uzun süreli sistem kesintisinde işin nasıl devam edeceğine dair iş sürekliliği planı hazırlanmış mı?", isCritical: false, weight: 1 as const, helpText: "Sunucu 3 gün çalışmazsa ne olur? Kritik işlemler manuel yürütülebilir mi?" },
      { id: 60, text: "Siber sigorta poliçesi değerlendirildi veya satın alındı mı?", isCritical: false, weight: 1 as const, helpText: "Siber sigorta; fidye ödemesi, veri kurtarma, müşteri bildirimi gibi maliyetleri karşılar." },
    ]
  },
];

export const PRICING_PLANS = [
  {
    id: "mini",
    name: "Mini Değerlendirme",
    price: 0,
    priceLabel: "Ücretsiz",
    description: "İlk adım olarak şirketinizin genel siber güvenlik durumunu hızlıca öğrenin.",
    questionCount: 20,
    domainCount: 10,
    features: [
      "20 soruluk hızlı risk değerlendirmesi",
      "10 güvenlik alanı (A-J)",
      "Anlık risk skoru ve kırmızı alarm tespiti",
      "Yapay zeka destekli temel rapor",
      "Domain tarama: SPF, DMARC, DKIM, MX, SSL",
      "HIBP veri sızıntısı kontrolü",
      "Kara liste ve Shadow IT servis tespiti",
      "Sektörel kıyaslama aracı (ücretsiz)",
      "KVKK VERBİS yükümlülük kontrolü (ücretsiz)",
      "KVKK ceza simülatörü (ücretsiz)",
      "Phishing farkındalık testi (ücretsiz)",
      "Siber sigorta prim hesaplayıcı (ücretsiz)",
      "KEP ihtiyaç değerlendirmesi (ücretsiz)",
      "ERP güvenlik tarama listesi (ücretsiz)",
    ],
    notIncluded: [
      "HTTP güvenlik başlıkları analizi",
      "URLhaus & USOM zararlı alan taraması",
      "crt.sh Alt Alan Şeffaflığı (subdomain tespiti)",
      "NIST NVD CVE güvenlik açığı taraması",
      "VirusTotal domain reputation taraması",
      "AbuseIPDB IP kötüye kullanım geçmişi",
      "Shodan internet maruziyet taraması",
      "KVKK Madde 12 Teknik Tedbir Haritası",
      "NIST CSF 2.0 Uyum Seviyesi",
      "PDF rapor indirme",
      "Birebir uzman danışmanlık görüşmesi",
    ],
    cta: "Hemen Başla",
    href: "/assessment/start",
    highlight: false,
    badge: null,
  },
  {
    id: "full",
    name: "Tam Değerlendirme",
    price: 4900,
    priceLabel: "₺4.900",
    priceSuffix: "/ tek seferlik + KDV",
    description: "Derinlemesine analiz, kapsamlı tehdit istihbaratı ve birebir uzman görüşmesiyle güvenliğinizi zirveye taşıyın.",
    questionCount: 60,
    domainCount: 10,
    features: [
      "60 soruluk kapsamlı risk değerlendirmesi",
      "10 güvenlik alanı (A-J)",
      "Detaylı AI raporu",
      "Mini değerlendirmedeki tüm özellikler dahil",
      "HTTP güvenlik başlıkları analizi",
      "URLhaus & USOM zararlı alan taraması",
      "crt.sh Alt Alan Şeffaflığı (subdomain tespiti)",
      "NIST NVD CVE güvenlik açığı taraması",
      "VirusTotal domain reputation taraması",
      "AbuseIPDB IP kötüye kullanım geçmişi",
      "Shodan internet maruziyet taraması (ücretli)",
      "KVKK Madde 12 Teknik Tedbir Haritası",
      "NIST CSF 2.0 Uyum Seviyesi",
      "PDF rapor indirme",
      "30 günlük otomatik yeniden tarama bildirimi",
      "Sektörel karşılaştırma",
      "Birebir uzman danışmanlık görüşmesi (1 saat)",
    ],
    notIncluded: [],
    cta: "Satın Al",
    href: "/assessment/full/start",
    highlight: true,
    badge: "En Kapsamlı",
  },
] as const;
