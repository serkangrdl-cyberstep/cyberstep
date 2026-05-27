// Full Assessment scoring configuration (55 questions, 10 domains)
export const FULL_QUESTIONS: Array<{
  number: number;
  weight: 1 | 2;
  isRedAlarm: boolean;
  domain: string;
  text: string;
}> = [
  // A. Yönetişim ve Risk Yönetimi
  { number: 1,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",       text: "Siber güvenlikten sorumlu kişi veya ekip var mı?" },
  { number: 2,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",       text: "Yıllık siber güvenlik bütçesi planlanıyor mu?" },
  { number: 3,  weight: 2, isRedAlarm: true,  domain: "Yönetişim ve Risk Yönetimi",       text: "Yazılı bir siber güvenlik politikası mevcut mu?" },
  { number: 4,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",       text: "Kritik iş sistemlerinin güncel envanteri var mı?" },
  { number: 5,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",       text: "Hassas veriler veri sınıflandırma şemasına göre kategorize ediliyor mu?" },
  { number: 6,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",       text: "Üst yönetim siber güvenlik risklerini düzenli gözden geçiriyor mu?" },
  // B. Kimlik ve Erişim Yönetimi
  { number: 7,  weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim Yönetimi",        text: "Tüm çalışanlar için güçlü parola politikası uygulanıyor mu?" },
  { number: 8,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",        text: "Çalışanlar iş uygulamalarına MFA/2FA ile giriş yapıyor mu?" },
  { number: 9,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",        text: "Uzak erişim ve yönetici hesaplarında ek doğrulama zorunlu mu?" },
  { number: 10, weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",        text: "İşten ayrılan çalışanların tüm erişimleri aynı gün kapatılıyor mu?" },
  { number: 11, weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim Yönetimi",        text: "Kullanıcılar en az ayrıcalık prensibiyle yetkilendirildi mi?" },
  { number: 12, weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",        text: "Ayrıcalıklı hesaplar düzenli olarak denetleniyor mu?" },
  // C. E-posta ve Sosyal Mühendislik
  { number: 13, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",    text: "Çalışanlara yılda en az bir kez phishing farkındalık eğitimi veriliyor mu?" },
  { number: 14, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",    text: "Phishing simülasyon testleri düzenli yapılıyor mu?" },
  { number: 15, weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",    text: "E-posta güvenlik filtresi devrede mi?" },
  { number: 16, weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",    text: "SPF, DKIM ve DMARC kayıtları yapılandırılmış mı?" },
  { number: 17, weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",    text: "IBAN/para transferi taleplerinde ikinci doğrulama uygulanıyor mu?" },
  { number: 18, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",    text: "Şüpheli e-postaları raporlayacak net bir süreç tanımlı mı?" },
  // D. Uç Nokta ve Cihaz Güvenliği
  { number: 19, weight: 1, isRedAlarm: false, domain: "Uç Nokta ve Cihaz Güvenliği",      text: "Tüm şirket cihazlarının güncel envanteri tutuluyor mu?" },
  { number: 20, weight: 2, isRedAlarm: true,  domain: "Uç Nokta ve Cihaz Güvenliği",      text: "Merkezi uç nokta koruma (EDR/antivirüs) çözümü var mı?" },
  { number: 21, weight: 1, isRedAlarm: false, domain: "Uç Nokta ve Cihaz Güvenliği",      text: "İşletim sistemi ve uygulamalar otomatik güncelleniyor mu?" },
  { number: 22, weight: 1, isRedAlarm: false, domain: "Uç Nokta ve Cihaz Güvenliği",      text: "Dizüstü ve mobil cihazlarda disk şifrelemesi aktif mi?" },
  { number: 23, weight: 1, isRedAlarm: false, domain: "Uç Nokta ve Cihaz Güvenliği",      text: "BYOD politikası belirlenmiş mi?" },
  { number: 24, weight: 1, isRedAlarm: false, domain: "Uç Nokta ve Cihaz Güvenliği",      text: "USB ve çıkarılabilir depolama cihazlarının kullanımı denetleniyor mu?" },
  // E. Ağ Güvenliği
  { number: 25, weight: 2, isRedAlarm: true,  domain: "Ağ Güvenliği",                     text: "Güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?" },
  { number: 26, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                     text: "Misafir Wi-Fi ağı iç ağdan ayrılmış mı?" },
  { number: 27, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                     text: "Ağ trafiği izleniyor ve alarm kurulu mu?" },
  { number: 28, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                     text: "Kritik sistemler VLAN ile ayrılmış mı?" },
  { number: 29, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                     text: "Kullanılmayan ağ portları kapalı mı?" },
  // F. Veri Koruma ve Yedekleme
  { number: 30, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",         text: "Kritik veriler düzenli ve otomatik yedekleniyor mu?" },
  { number: 31, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",         text: "Yedekler üretim ortamından fiziksel/mantıksal olarak ayrılmış mı?" },
  { number: 32, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",         text: "Yedek geri yükleme testleri son 12 ayda yapıldı mı?" },
  { number: 33, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",         text: "Hassas veriler aktarım sırasında şifreleniyor mu?" },
  { number: 34, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",         text: "Hassas veriler beklemede (at rest) şifreleniyor mu?" },
  { number: 35, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",         text: "KVKK kapsamındaki tedbirler alındı mı?" },
  // G. Yazılım ve Uygulama Güvenliği
  { number: 36, weight: 1, isRedAlarm: false, domain: "Yazılım ve Uygulama Güvenliği",    text: "Üçüncü taraf yazılım güvenlik güncellemeleri takip ediliyor mu?" },
  { number: 37, weight: 1, isRedAlarm: false, domain: "Yazılım ve Uygulama Güvenliği",    text: "Güvenli kodlama standartları uygulanıyor mu?" },
  { number: 38, weight: 1, isRedAlarm: false, domain: "Yazılım ve Uygulama Güvenliği",    text: "Web uygulamaları güvenlik açığı taramasından geçiyor mu?" },
  { number: 39, weight: 1, isRedAlarm: false, domain: "Yazılım ve Uygulama Güvenliği",    text: "Kod dağıtımında onay süreci uygulanıyor mu?" },
  { number: 40, weight: 2, isRedAlarm: true,  domain: "Yazılım ve Uygulama Güvenliği",    text: "API uç noktaları kimlik doğrulama ile korunuyor mu?" },
  // H. Fiziksel Güvenlik
  { number: 41, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                text: "Sunucu odasına fiziksel erişim kontrol altında mı?" },
  { number: 42, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                text: "Ziyaretçi erişimleri kayıt altına alınıyor mu?" },
  { number: 43, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                text: "Çalışanlar ekranlarını kilitlemeden ayrılıyor mu? (Politika var mı?)" },
  { number: 44, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                text: "Hassas belgeler güvenli imha ediliyor mu?" },
  { number: 45, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                text: "Ofis dışında cihaz güvenliği politikası mevcut mu?" },
  // I. Tedarik Zinciri ve Üçüncü Taraf
  { number: 46, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf",  text: "Kritik tedarikçilerin siber güvenlik uygulamaları değerlendiriliyor mu?" },
  { number: 47, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf",  text: "Bulut hizmet sağlayıcıların güvenlik sertifikasyonları kontrol ediliyor mu?" },
  { number: 48, weight: 2, isRedAlarm: true,  domain: "Tedarik Zinciri ve Üçüncü Taraf",  text: "Üçüncü taraf erişimleri en az ayrıcalık ile sınırlandırılıyor mu?" },
  { number: 49, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf",  text: "Tedarikçi sözleşmelerinde veri güvenliği maddeleri yer alıyor mu?" },
  { number: 50, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf",  text: "Bulut depolama paylaşım izinleri düzenli kontrol ediliyor mu?" },
  // J. Olay Müdahale ve İş Sürekliliği
  { number: 51, weight: 2, isRedAlarm: true,  domain: "Olay Müdahale ve İş Sürekliliği",  text: "Yazılı bir siber olay müdahale planı (Incident Response Plan) mevcut mu?" },
  { number: 52, weight: 1, isRedAlarm: false, domain: "Olay Müdahale ve İş Sürekliliği",  text: "Olay müdahale planı son 12 ayda test edildi mi?" },
  { number: 53, weight: 1, isRedAlarm: false, domain: "Olay Müdahale ve İş Sürekliliği",  text: "Siber saldırı durumunda yasal bildirim süreçleri tanımlı mı?" },
  { number: 54, weight: 1, isRedAlarm: false, domain: "Olay Müdahale ve İş Sürekliliği",  text: "İş sürekliliği planı (BCP) ve kurtarma süresi hedefleri (RTO/RPO) belirlenmiş mi?" },
  { number: 55, weight: 1, isRedAlarm: false, domain: "Olay Müdahale ve İş Sürekliliği",  text: "Siber sigorta poliçesi değerlendirildi mi?" },
];

// Mini Assessment scoring configuration
export const MINI_QUESTIONS: Array<{
  number: number;
  weight: 1 | 2;
  isRedAlarm: boolean;
  domain: string;
  text: string;
}> = [
  // A. Firma ve Yönetişim
  { number: 1,  weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim",        text: "Şirketinizde siber güvenlikten ana sorumlu bir kişi veya rol net olarak tanımlı mı?" },
  { number: 2,  weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim",        text: "Kritik iş uygulamalarınızın ve temel sistemlerinizin listesi güncel olarak mevcut mu?" },
  { number: 3,  weight: 2, isRedAlarm: true,  domain: "Firma ve Yönetişim",        text: "Yeni işe giren ve işten ayrılan çalışanlar için kullanıcı hesabı açma/kapama süreci tanımlı mı?" },
  { number: 4,  weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim",        text: "Şirketinizde hassas bilgilerin hangi sistemlerde tutulduğu güncel bir envanterle takip ediliyor mu?" },
  // B. Kimlik, Erişim ve Uzak Erişim
  { number: 5,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim",          text: "Çalışanlar e-posta ve iş uygulamalarına girerken MFA/2FA kullanıyor mu?" },
  { number: 6,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim",          text: "Uzak erişim, VPN, yönetici yetkili hesaplarda ek doğrulama zorunlu mu?" },
  { number: 7,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim",          text: "İşten ayrılan çalışanların sistem erişimleri aynı gün kaldırılıyor mu?" },
  { number: 8,  weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim",          text: "Aynı kullanıcı hesabının birden fazla kişi tarafından kullanımı engelleniyor mu?" },
  // C. E-posta ve Kullanıcı Kaynaklı Riskler
  { number: 9,  weight: 1, isRedAlarm: false, domain: "E-posta ve İnsan Faktörü",  text: "Çalışanlara şüpheli e-posta ve parola hırsızlığı riskleri hakkında farkındalık eğitimi veriliyor mu?" },
  { number: 10, weight: 1, isRedAlarm: false, domain: "E-posta ve İnsan Faktörü",  text: "Şüpheli e-posta geldiğinde çalışanların bunu kime bildireceği biliniyor mu?" },
  { number: 11, weight: 2, isRedAlarm: true,  domain: "E-posta ve İnsan Faktörü",  text: "IBAN değişikliği veya acil para transferi gibi durumlarda e-posta dışında ikinci doğrulama uygulanıyor mu?" },
  { number: 12, weight: 2, isRedAlarm: true,  domain: "E-posta ve İnsan Faktörü",  text: "E-posta alan adınız üzerinden sahte mail gönderilmesini engelleyecek (SPF, DKIM, DMARC) yapılandırmalar devrede mi?" },
  // D. Cihaz ve Uç Nokta Güvenliği
  { number: 13, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği",           text: "Şirkette kullanılan bilgisayarların güncel bir listesi tutuluyor mu?" },
  { number: 14, weight: 2, isRedAlarm: true,  domain: "Cihaz Güvenliği",           text: "Çalışan bilgisayarlarında zararlı yazılımlara karşı merkezi bir güvenlik çözümü bulunuyor mu?" },
  { number: 15, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği",           text: "Bilgisayarlar ve iş uygulamaları düzenli olarak güncelleniyor mu?" },
  { number: 16, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği",           text: "Dizüstü veya mobil cihazlarda ekran kilidi ve güçlü parola uygulanıyor mu?" },
  // E. Veri Koruma, Yedekleme ve Olay Hazırlığı
  { number: 17, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",  text: "Kritik verileriniz düzenli olarak (tercihen otomatik) yedekleniyor mu?" },
  { number: 18, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",  text: "Alınan yedeklerin geri yüklenip çalışabildiği son 12 ayda test edildi mi?" },
  { number: 19, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",  text: "Bir siber olay yaşanırsa ilk kimin devreye gireceği ve ne yapılacağı yazılı olarak belli mi?" },
  { number: 20, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",  text: "Hassas dosyalara kimlerin erişebildiği düzenli olarak kontrol ediliyor mu?" },
];

export const ANSWER_SCORES: Record<string, number> = {
  evet: 5,
  kismen: 3,
  bilmiyorum: 1,
  hayir: 0,
};

export function calculateScore(answers: Array<{ questionNumber: number; answer: string }>) {
  let totalScore = 0;
  let maxScore = 0;
  const redAlarmQuestions: number[] = [];

  const domainMap: Record<string, { score: number; maxScore: number }> = {};

  for (const q of MINI_QUESTIONS) {
    const ans = answers.find((a) => a.questionNumber === q.number);
    const rawScore = ans ? (ANSWER_SCORES[ans.answer] ?? 0) : 0;
    const weighted = rawScore * q.weight;
    const maxWeighted = 5 * q.weight;

    totalScore += weighted;
    maxScore += maxWeighted;

    if (!domainMap[q.domain]) {
      domainMap[q.domain] = { score: 0, maxScore: 0 };
    }
    domainMap[q.domain].score += weighted;
    domainMap[q.domain].maxScore += maxWeighted;

    if (q.isRedAlarm && rawScore === 0) {
      redAlarmQuestions.push(q.number);
    }
  }

  const domainScores = Object.entries(domainMap).map(([domain, vals]) => ({
    domain,
    score: vals.score,
    maxScore: vals.maxScore,
    percent: Math.round((vals.score / vals.maxScore) * 100),
  }));

  const scorePercent = Math.round((totalScore / maxScore) * 100);
  let riskLevel: string;
  if (scorePercent >= 80) riskLevel = "Düşük";
  else if (scorePercent >= 60) riskLevel = "Orta";
  else if (scorePercent >= 40) riskLevel = "Yüksek";
  else riskLevel = "Kritik";

  return {
    totalScore,
    maxScore,
    scorePercent,
    riskLevel,
    redAlarmCount: redAlarmQuestions.length,
    redAlarmQuestions,
    domainScores,
  };
}
