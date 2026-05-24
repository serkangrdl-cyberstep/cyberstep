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
    title: "Firma ve Yönetişim",
    questions: [
      { id: 1, text: "Şirketinizde siber güvenlikten ana sorumlu bir kişi veya rol net olarak tanımlı mı?", isCritical: false },
      { id: 2, text: "Kritik iş uygulamalarınızın ve temel sistemlerinizin listesi güncel olarak mevcut mu?", isCritical: false },
      { id: 3, text: "Yeni işe giren ve işten ayrılan çalışanlar için kullanıcı hesabı açma/kapama süreci tanımlı mı?", isCritical: true },
      { id: 4, text: "Şirketinizde hassas bilgilerin hangi sistemlerde tutulduğu güncel bir envanterle takip ediliyor mu?", isCritical: false },
    ]
  },
  {
    id: "B",
    title: "Kimlik, Erişim ve Uzak Erişim",
    questions: [
      { id: 5, text: "Çalışanlar e-posta ve iş uygulamalarına girerken MFA/2FA kullanıyor mu?", isCritical: true },
      { id: 6, text: "Uzak erişim, VPN, yönetici yetkili hesaplarda ek doğrulama zorunlu mu?", isCritical: true },
      { id: 7, text: "İşten ayrılan çalışanların sistem erişimleri aynı gün kaldırılıyor mu?", isCritical: true },
      { id: 8, text: "Aynı kullanıcı hesabının birden fazla kişi tarafından kullanımı engelleniyor mu?", isCritical: false },
    ]
  },
  {
    id: "C",
    title: "E-posta ve Kullanıcı Kaynaklı Riskler",
    questions: [
      { id: 9, text: "Çalışanlara şüpheli e-posta ve parola hırsızlığı riskleri hakkında farkındalık eğitimi veriliyor mu?", isCritical: false },
      { id: 10, text: "Şüpheli e-posta geldiğinde çalışanların bunu kime bildireceği biliniyor mu?", isCritical: false },
      { id: 11, text: "IBAN değişikliği veya acil para transferi gibi durumlarda e-posta dışında ikinci doğrulama uygulanıyor mu?", isCritical: true },
      { id: 12, text: "E-posta alan adınız üzerinden sahte mail gönderilmesini engelleyecek (SPF, DKIM, DMARC) yapılandırmalar devrede mi?", isCritical: true },
    ]
  },
  {
    id: "D",
    title: "Cihaz ve Uç Nokta Güvenliği",
    questions: [
      { id: 13, text: "Şirkette kullanılan bilgisayarların güncel bir listesi tutuluyor mu?", isCritical: false },
      { id: 14, text: "Çalışan bilgisayarlarında zararlı yazılımlara karşı merkezi bir güvenlik çözümü bulunuyor mu?", isCritical: true },
      { id: 15, text: "Bilgisayarlar ve iş uygulamaları düzenli olarak güncelleniyor mu?", isCritical: false },
      { id: 16, text: "Dizüstü veya mobil cihazlarda ekran kilidi ve güçlü parola uygulanıyor mu?", isCritical: false },
    ]
  },
  {
    id: "E",
    title: "Veri Koruma, Yedekleme ve Olay Hazırlığı",
    questions: [
      { id: 17, text: "Kritik verileriniz düzenli olarak (tercihen otomatik) yedekleniyor mu?", isCritical: true },
      { id: 18, text: "Alınan yedeklerin geri yüklenip çalışabildiği son 12 ayda test edildi mi?", isCritical: true },
      { id: 19, text: "Bir siber olay yaşanırsa ilk kimin devreye gireceği ve ne yapılacağı yazılı olarak belli mi?", isCritical: false },
      { id: 20, text: "Hassas dosyalara kimlerin erişebildiği düzenli olarak kontrol ediliyor mu?", isCritical: false },
    ]
  }
];

export const FULL_ASSESSMENT_SECTIONS = [
  {
    id: "A",
    title: "Yönetişim ve Risk Yönetimi",
    questions: [
      { id: 1,  text: "Şirketinizde siber güvenlikten sorumlu atanmış bir kişi veya ekip var mı?", isCritical: false },
      { id: 2,  text: "Yıllık siber güvenlik bütçesi planlanıyor mu?", isCritical: false },
      { id: 3,  text: "Yazılı bir siber güvenlik politikası veya yönergesi mevcut mu?", isCritical: true },
      { id: 4,  text: "Kritik iş sistemlerinin ve uygulamalarının güncel envanteri tutuluyor mu?", isCritical: false },
      { id: 5,  text: "Hassas veriler resmi bir veri sınıflandırma şemasına göre kategorize ediliyor mu?", isCritical: false },
      { id: 6,  text: "Yönetim kurulu veya üst yönetim, siber güvenlik risklerini düzenli olarak gözden geçiriyor mu?", isCritical: false },
    ]
  },
  {
    id: "B",
    title: "Kimlik ve Erişim Yönetimi",
    questions: [
      { id: 7,  text: "Tüm çalışanlar için güçlü parola politikası uygulanıyor mu?", isCritical: false },
      { id: 8,  text: "Çalışanlar iş uygulamalarına MFA/2FA ile giriş yapıyor mu?", isCritical: true },
      { id: 9,  text: "Uzak erişim, VPN ve yönetici hesaplarında ek doğrulama zorunlu mu?", isCritical: true },
      { id: 10, text: "İşten ayrılan çalışanların tüm erişimleri aynı gün kapatılıyor mu?", isCritical: true },
      { id: 11, text: "Kullanıcı hesapları sadece ihtiyaç duydukları yetkilere sahip (en az ayrıcalık prensibi) mi?", isCritical: false },
      { id: 12, text: "Ayrıcalıklı hesaplar (yönetici, root) düzenli olarak denetleniyor mu?", isCritical: true },
    ]
  },
  {
    id: "C",
    title: "E-posta ve Sosyal Mühendislik",
    questions: [
      { id: 13, text: "Çalışanlara yılda en az bir kez phishing farkındalık eğitimi veriliyor mu?", isCritical: false },
      { id: 14, text: "Phishing simülasyon testleri düzenli yapılıyor mu?", isCritical: false },
      { id: 15, text: "E-posta güvenlik filtresi (spam, zararlı ek engelleme) devrede mi?", isCritical: true },
      { id: 16, text: "E-posta alan adı için SPF, DKIM ve DMARC kayıtları yapılandırılmış mı?", isCritical: true },
      { id: 17, text: "IBAN veya para transferi taleplerinde e-posta dışında doğrulama uygulanıyor mu?", isCritical: true },
      { id: 18, text: "Şüpheli e-postaları raporlayacak net bir kanal ve süreç tanımlı mı?", isCritical: false },
    ]
  },
  {
    id: "D",
    title: "Uç Nokta ve Cihaz Güvenliği",
    questions: [
      { id: 19, text: "Tüm şirket cihazlarının güncel bir envanteri tutuluyor mu?", isCritical: false },
      { id: 20, text: "Çalışan bilgisayarlarında merkezi, yönetilen uç nokta koruma (EDR/antivirüs) çözümü var mı?", isCritical: true },
      { id: 21, text: "İşletim sistemi ve uygulamalar otomatik güncelleniyor mu?", isCritical: false },
      { id: 22, text: "Dizüstü ve mobil cihazlarda ekran kilidi ve disk şifrelemesi aktif mi?", isCritical: false },
      { id: 23, text: "Kişisel cihazların (BYOD) şirket kaynaklarına erişim politikası belirlenmiş mi?", isCritical: false },
      { id: 24, text: "USB ve çıkarılabilir depolama cihazlarının kullanımı denetleniyor ya da kısıtlanıyor mu?", isCritical: false },
    ]
  },
  {
    id: "E",
    title: "Ağ Güvenliği",
    questions: [
      { id: 25, text: "Şirket ağında güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?", isCritical: true },
      { id: 26, text: "Misafir Wi-Fi ağı, iç ağdan ayrılmış mı?", isCritical: false },
      { id: 27, text: "Ağ trafiği izleniyor ve anormal hareketler için alarm kurulu mu?", isCritical: false },
      { id: 28, text: "Kritik sistemler, iç ağ içinde segment/VLAN ile ayrılmış mı?", isCritical: false },
      { id: 29, text: "Kullanılmayan ağ bağlantı noktaları (port) kapalı mı?", isCritical: false },
    ]
  },
  {
    id: "F",
    title: "Veri Koruma ve Yedekleme",
    questions: [
      { id: 30, text: "Kritik veriler düzenli ve otomatik olarak yedekleniyor mu?", isCritical: true },
      { id: 31, text: "Yedekler, üretim ortamından fiziksel veya mantıksal olarak ayrılmış mı?", isCritical: true },
      { id: 32, text: "Yedek geri yükleme testleri son 12 ayda gerçekleştirildi mi?", isCritical: true },
      { id: 33, text: "Hassas veriler aktarım sırasında şifreleniyor mu?", isCritical: false },
      { id: 34, text: "Hassas veriler beklemede (at rest) şifreleniyor mu?", isCritical: false },
      { id: 35, text: "KVKK kapsamındaki kişisel veriler için gerekli teknik ve idari tedbirler alındı mı?", isCritical: true },
    ]
  },
  {
    id: "G",
    title: "Yazılım ve Uygulama Güvenliği",
    questions: [
      { id: 36, text: "Kullanılan üçüncü taraf yazılım ve kütüphanelerin lisans ve güvenlik güncellemeleri takip ediliyor mu?", isCritical: false },
      { id: 37, text: "Şirket tarafından geliştirilen uygulamalar için güvenli kodlama standartları uygulanıyor mu?", isCritical: false },
      { id: 38, text: "Web uygulamaları için güvenlik açığı taraması (DAST/SAST) yapılıyor mu?", isCritical: false },
      { id: 39, text: "Üretim ortamına kod dağıtımında onay/review süreci uygulanıyor mu?", isCritical: false },
      { id: 40, text: "API uç noktaları kimlik doğrulama ve yetkilendirme mekanizmalarıyla korunuyor mu?", isCritical: true },
    ]
  },
  {
    id: "H",
    title: "Fiziksel Güvenlik",
    questions: [
      { id: 41, text: "Sunucu odası veya ağ ekipmanlarına fiziksel erişim kontrol altında mı?", isCritical: false },
      { id: 42, text: "Ziyaretçi erişimleri kayıt altına alınıyor ve refakat ediliyor mu?", isCritical: false },
      { id: 43, text: "Çalışanlar ekranlarını kilitlemeden masa başından ayrılıyor mu? (Politika var mı?)", isCritical: false },
      { id: 44, text: "Hassas belgeler güvenli şekilde imha ediliyor mu (kağıt parçalama vb.)?", isCritical: false },
      { id: 45, text: "Ofis dışında çalışma durumunda cihaz güvenliği politikası mevcut mu?", isCritical: false },
    ]
  },
  {
    id: "I",
    title: "Tedarik Zinciri ve Üçüncü Taraf",
    questions: [
      { id: 46, text: "Kritik yazılım ve hizmet sağlayıcıların siber güvenlik uygulamaları değerlendiriliyor mu?", isCritical: false },
      { id: 47, text: "Bulut hizmet sağlayıcılarınızın güvenlik sertifikasyonları (ISO 27001, SOC 2 vb.) kontrol ediliyor mu?", isCritical: false },
      { id: 48, text: "Üçüncü taraf erişimleri en az ayrıcalık prensibiyle sınırlandırılıyor mu?", isCritical: true },
      { id: 49, text: "Tedarikçi sözleşmelerinde veri güvenliği ve gizlilik maddeleri yer alıyor mu?", isCritical: false },
      { id: 50, text: "Bulut depolama servislerinde (Google Drive, OneDrive vb.) paylaşım izinleri düzenli kontrol ediliyor mu?", isCritical: false },
    ]
  },
  {
    id: "J",
    title: "Olay Müdahale ve İş Sürekliliği",
    questions: [
      { id: 51, text: "Yazılı bir siber olay müdahale planı (Incident Response Plan) mevcut mu?", isCritical: true },
      { id: 52, text: "Olay müdahale planı son 12 ayda test edildi mi?", isCritical: false },
      { id: 53, text: "Siber saldırı durumunda müşteri ve yasal bildirim süreçleri tanımlı mı?", isCritical: false },
      { id: 54, text: "İş sürekliliği planı (BCP) hazırlanmış ve kritik sistemler için kurtarma süresi hedefleri (RTO/RPO) belirlenmiş mi?", isCritical: false },
      { id: 55, text: "Siber sigorta poliçesi değerlendirildi mi?", isCritical: false },
    ]
  }
];

export const PRICING_PLANS = [
  {
    id: "mini",
    name: "Mini Değerlendirme",
    price: 0,
    priceLabel: "Ücretsiz",
    description: "İlk adım olarak şirketinizin genel siber güvenlik durumunu hızlıca öğrenin.",
    questionCount: 20,
    domainCount: 5,
    features: [
      "20 kritik kontrol sorusu",
      "5 temel güvenlik alanı",
      "Anlık risk skoru ve kırmızı alarm sayısı",
      "Alan bazlı puan dağılımı",
      "Sektör karşılaştırması",
      "Uzman ön değerlendirmesi (24-48 saat)",
    ],
    notIncluded: [
      "PDF rapor indirme",
      "Detaylı aksiyon planı",
      "10 güvenlik alanı analizi",
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
    priceSuffix: "/ tek seferlik",
    description: "Derinlemesine analiz, tam aksiyon planı ve birebir uzman görüşmesiyle güvenliğinizi zirveye taşıyın.",
    questionCount: 55,
    domainCount: 10,
    features: [
      "55 kapsamlı soru",
      "10 güvenlik alanı",
      "Anlık risk skoru ve kırmızı alarm",
      "Alan bazlı puan dağılımı",
      "Sektör karşılaştırması",
      "PDF rapor indirme",
      "Detaylı öncelikli aksiyon planı",
      "Birebir uzman danışmanlık görüşmesi (1 saat)",
      "KVKK uyumluluk değerlendirmesi",
    ],
    notIncluded: [],
    cta: "Satın Al",
    href: "/assessment/full/start",
    highlight: true,
    badge: "En Kapsamlı",
  },
] as const;
