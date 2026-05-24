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
