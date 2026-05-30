export const FULL_QUESTIONS: Array<{
  number: number;
  weight: 1 | 2 | 3;
  isRedAlarm: boolean;
  domain: string;
  text: string;
}> = [
  // A. Yönetişim ve Risk Yönetimi
  { number: 1,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Şirketinizde siber güvenlikten sorumlu atanmış bir kişi veya ekip var mı?" },
  { number: 2,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Yıllık siber güvenlik bütçesi planlanıyor mu?" },
  { number: 3,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Çalışanların şirket bilgisayarları, hesapları ve verilerini nasıl kullanacağına dair yazılı kurallar mevcut mu?" },
  { number: 4,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Şirkette kullanılan tüm sistemler, yazılımlar ve hassas verilerin nerede tutulduğuna dair güncel bir liste var mı?" },
  { number: 5,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Üst yönetim veya ortaklar, şirketin siber güvenlik risklerini düzenli olarak gündeme alıyor mu?" },
  { number: 6,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Risk Yönetimi",                   text: "Yeni işe giren çalışanlara işe başlarken siber güvenlik kuralları ve sorumlulukları anlatılıyor mu?" },
  // B. Kimlik ve Erişim Yönetimi
  { number: 7,  weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim Yönetimi",                    text: "Tüm çalışanlar için güçlü ve farklı şifreler kullanmaları zorunlu mu?" },
  { number: 8,  weight: 3, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",                    text: "Çalışanlar iş uygulamaları ve e-postaya SMS kodu veya uygulama onayı (2FA) ile giriş yapıyor mu?" },
  { number: 9,  weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",                    text: "Şirkete dışarıdan bağlanan çalışanlar ve IT yetkilileri ek doğrulama (VPN + 2FA) kullanıyor mu?" },
  { number: 10, weight: 3, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",                    text: "İşten ayrılan çalışanların tüm sistem, uygulama ve e-posta erişimleri ayrılış günü kapatılıyor mu?" },
  { number: 11, weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim Yönetimi",                    text: "Çalışanlar yalnızca kendi işleri için ihtiyaç duydukları sistemlere ve dosyalara erişebiliyor mu?" },
  { number: 12, weight: 2, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",                    text: "Sistem yöneticisi veya IT yetkilisi hesapları düzenli olarak gözden geçiriliyor ve denetleniyor mu?" },
  // C. E-posta ve Sosyal Mühendislik
  { number: 13, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",                text: "Çalışanlara yılda en az bir kez sahte e-posta ve dolandırıcılık farkındalık eğitimi veriliyor mu?" },
  { number: 14, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",                text: "Şüpheli e-postaları bildirmek için çalışanların başvurabileceği net bir kişi veya kanal tanımlanmış mı?" },
  { number: 15, weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",                text: "Gelen e-postalarda zararlı ek ve bağlantıları filtreleyen bir güvenlik sistemi aktif mi?" },
  { number: 16, weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",                text: "Şirket e-posta adresinin taklit edilmesini engelleyen teknik ayarlar (SPF, DKIM, DMARC) yapılandırılmış mı?" },
  { number: 17, weight: 3, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",                text: "IBAN değişikliği veya acil para transferi gibi taleplerde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?" },
  { number: 18, weight: 1, isRedAlarm: false, domain: "E-posta ve Sosyal Mühendislik",                text: "Şirket içi iletişim için kullanılan WhatsApp gruplarına dair güvenlik kuralı var mı?" },
  // D. Cihaz ve Uç Nokta Güvenliği
  { number: 19, weight: 1, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "Şirkette kullanılan tüm bilgisayarların güncel bir envanteri tutuluyor mu?" },
  { number: 20, weight: 2, isRedAlarm: true,  domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "Çalışan bilgisayarlarında merkezi olarak yönetilen zararlı yazılım koruma çözümü (EDR/antivirüs) aktif mi?" },
  { number: 21, weight: 2, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "İşletim sistemi ve iş uygulamaları otomatik olarak güncelleniyor mu?" },
  { number: 22, weight: 1, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "Dizüstü bilgisayar ve mobil cihazlarda ekran kilidi ve disk şifrelemesi aktif mi?" },
  { number: 23, weight: 1, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "Çalışanların kişisel cihazlarıyla şirket sistemlerine bağlanmasına dair yazılı kural var mı?" },
  { number: 24, weight: 1, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",                  text: "USB ve taşınabilir bellek kullanımı şirket bilgisayarlarında denetleniyor veya kısıtlanıyor mu?" },
  // E. Ağ Güvenliği
  { number: 25, weight: 3, isRedAlarm: true,  domain: "Ağ Güvenliği",                                 text: "Şirketin internet bağlantısını koruyan kurumsal güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?" },
  { number: 26, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                                 text: "Misafir veya müşteri Wi-Fi ağı şirketin iç ağından tamamen ayrılmış mı?" },
  { number: 27, weight: 2, isRedAlarm: true,  domain: "Ağ Güvenliği",                                 text: "Ağ trafiği izleniyor ve olağandışı bağlantılar için uyarı sistemi kurulu mu?" },
  { number: 28, weight: 2, isRedAlarm: true,  domain: "Ağ Güvenliği",                                 text: "Finans sistemi, müşteri veri tabanı gibi kritik sistemler ağ içinde diğerlerinden ayrılmış mı?" },
  { number: 29, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                                 text: "Kullanılmayan ağ portları ve servisler kapalı mı?" },
  { number: 30, weight: 2, isRedAlarm: true,  domain: "Ağ Güvenliği",                                 text: "Şirket dışından yönetim amaçlı sisteme bağlanmak (uzak masaüstü vb.) VPN üzerinden yapılıyor mu?" },
  // F. Veri Koruma ve Yedekleme
  { number: 31, weight: 3, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",                     text: "Kritik veriler düzenli ve tercihen otomatik olarak yedekleniyor mu?" },
  { number: 32, weight: 3, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",                     text: "Yedekler, ana sistemden fiziksel veya ağ olarak tamamen ayrı bir ortamda tutuluyor mu?" },
  { number: 33, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",                     text: "Yedeklerin başarıyla geri yüklenip yüklenmediği son 12 ay içinde test edildi mi?" },
  { number: 34, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",                     text: "Müşteri veya çalışanlara ait hassas veriler dışarıya gönderilirken şifreleniyor mu?" },
  { number: 35, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme",                     text: "Sunucularda veya bulutta depolanan hassas veriler şifreli mi?" },
  { number: 36, weight: 3, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",                     text: "KVKK kapsamındaki kişisel veriler için gerekli teknik ve idari tedbirler alındı mı?" },
  // G. Yazılım, Dijital Araçlar ve Hesap Güvenliği
  { number: 37, weight: 2, isRedAlarm: true,  domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?" },
  { number: 38, weight: 2, isRedAlarm: false, domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Kullanılan üçüncü taraf yazılım ve sistemlerin güvenlik güncellemeleri düzenli takip ediliyor mu?" },
  { number: 39, weight: 2, isRedAlarm: false, domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Çalışanların yapay zeka araçlarına şirket verisi veya gizli belge yüklemesini önleyen kural yapıldı mı?" },
  { number: 40, weight: 1, isRedAlarm: false, domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Şirket web sitesi veya e-ticaret platformu düzenli güvenlik kontrolünden geçiyor mu?" },
  { number: 41, weight: 1, isRedAlarm: false, domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Bulut depolama paylaşım izinleri düzenli gözden geçiriliyor mu?" },
  { number: 42, weight: 2, isRedAlarm: true,  domain: "Yazılım, Dijital Araçlar ve Hesap Güvenliği",  text: "Şirket sosyal medya hesaplarına kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?" },
  // H. Fiziksel Güvenlik
  { number: 43, weight: 2, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?" },
  { number: 44, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Ofise gelen ziyaretçiler kayıt altına alınıyor ve iç alanlarda yalnız bırakılmıyor mu?" },
  { number: 45, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Çalışanların masayı terk ederken bilgisayar ekranlarını kilitlemesi zorunlu mu?" },
  { number: 46, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Müşteri bilgisi veya finansal veri içeren hassas belgeler güvenli şekilde imha ediliyor mu?" },
  { number: 47, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Ofis dışında çalışılırken uyulması gereken cihaz güvenlik kuralları belirlenmiş mi?" },
  { number: 48, weight: 2, isRedAlarm: false, domain: "Fiziksel Güvenlik",                            text: "Şirket cihazının kaybolması veya çalınması durumunda ne yapılacağı önceden belirlenmiş mi?" },
  // I. Tedarik Zinciri ve Üçüncü Taraf Yönetimi
  { number: 49, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Kritik hizmet sağlayıcıların güvenlik uygulamaları değerlendiriliyor mu?" },
  { number: 50, weight: 2, isRedAlarm: true,  domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Dışarıdan çalışan muhasebeci, mali müşavir veya IT firmasının sistem erişimi sınırlı ve kayıt altında mı?" },
  { number: 51, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Tedarikçi ve iş ortağı sözleşmelerinde veri gizliliği ve güvenlik maddeleri yer alıyor mu?" },
  { number: 52, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Bulut hizmet sağlayıcılarının güvenlik sertifikasyonları kontrol ediliyor mu?" },
  { number: 53, weight: 2, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve sorumlu kişi belirlenmiş mi?" },
  { number: 54, weight: 2, isRedAlarm: false, domain: "Tedarik Zinciri ve Üçüncü Taraf Yönetimi",    text: "Üçüncü taraf erişimleri sadece ihtiyaç duydukları sistemlerle sınırlı tutuluyor mu?" },
  // J. Olay Müdahalesi ve İş Sürekliliği
  { number: 55, weight: 3, isRedAlarm: true,  domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "Siber saldırı veya veri ihlali yaşanırsa ilk 1 saatte kimin ne yapacağı yazılı olarak belirlenmiş mi?" },
  { number: 56, weight: 1, isRedAlarm: false, domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "Olay müdahale planı son 12 ay içinde tatbikatla test edildi mi?" },
  { number: 57, weight: 1, isRedAlarm: false, domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "Siber saldırı sonrası müşterilere, iş ortaklarına ve yasal makamlara bildirim yapma süreci tanımlı mı?" },
  { number: 58, weight: 2, isRedAlarm: true,  domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "KVKK kapsamında veri ihlali yaşanırsa 72 saat içinde KVK Kurulu'na bildirim yapma yükümlülüğü için hazırlık yapıldı mı?" },
  { number: 59, weight: 1, isRedAlarm: false, domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "Uzun süreli sistem kesintisinde işin nasıl devam edeceğine dair iş sürekliliği planı hazırlanmış mı?" },
  { number: 60, weight: 1, isRedAlarm: false, domain: "Olay Müdahalesi ve İş Sürekliliği",           text: "Siber sigorta poliçesi değerlendirildi veya satın alındı mı?" },
];

export const MINI_QUESTIONS: Array<{
  number: number;
  weight: 1 | 2 | 3;
  isRedAlarm: boolean;
  domain: string;
  text: string;
}> = [
  // A. Yönetişim ve Organizasyon
  { number: 1,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Organizasyon",         text: "Şirketinizde siber güvenlikten sorumlu atanmış bir kişi var mı?" },
  { number: 2,  weight: 1, isRedAlarm: false, domain: "Yönetişim ve Organizasyon",         text: "Şirketinizde kullanılan sistemler, yazılımlar ve hassas verilerin nerede tutulduğu listelenmiş mi?" },
  // B. Kimlik ve Erişim Yönetimi
  { number: 3,  weight: 3, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",         text: "Çalışanlar e-posta ve iş uygulamalarına girerken SMS kodu veya telefon onayı (2FA) kullanıyor mu?" },
  { number: 4,  weight: 3, isRedAlarm: true,  domain: "Kimlik ve Erişim Yönetimi",         text: "İşten ayrılan çalışanların şirket sistemlerine ve e-postaya erişimi aynı gün kapatılıyor mu?" },
  // C. E-posta ve Sosyal Mühendislik
  { number: 5,  weight: 3, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",     text: "IBAN değişikliği veya acil para transferi taleplerinde e-postaya ek olarak telefon ile doğrulama yapılıyor mu?" },
  { number: 6,  weight: 2, isRedAlarm: true,  domain: "E-posta ve Sosyal Mühendislik",     text: "Şirket e-posta adresinizin taklit edilerek sahte mail gönderilmesini engelleyen teknik önlem alındı mı?" },
  // D. Cihaz ve Uç Nokta Güvenliği
  { number: 7,  weight: 2, isRedAlarm: true,  domain: "Cihaz ve Uç Nokta Güvenliği",       text: "Şirket bilgisayarlarında güncel zararlı yazılım koruma (antivirüs/güvenlik) çözümü aktif mi?" },
  { number: 8,  weight: 2, isRedAlarm: false, domain: "Cihaz ve Uç Nokta Güvenliği",       text: "Bilgisayarlar ve iş yazılımları (Windows, Office, muhasebe programı vb.) düzenli olarak güncelleniyor mu?" },
  // E. Ağ Güvenliği
  { number: 9,  weight: 3, isRedAlarm: true,  domain: "Ağ Güvenliği",                      text: "Şirketin internet bağlantısını koruyan bir güvenlik duvarı (firewall) aktif ve yapılandırılmış mı?" },
  { number: 10, weight: 1, isRedAlarm: false, domain: "Ağ Güvenliği",                      text: "Müşteri veya ziyaretçilere sunulan Wi-Fi ağı, şirketin iç ağından tamamen ayrı mı?" },
  // F. Veri Koruma ve Yedekleme
  { number: 11, weight: 3, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",          text: "Kritik verileriniz düzenli ve tercihen otomatik olarak yedekleniyor mu?" },
  { number: 12, weight: 2, isRedAlarm: true,  domain: "Veri Koruma ve Yedekleme",          text: "Alınan yedeklerin gerçekten çalıştığı son 12 ay içinde test edildi mi?" },
  // G. Yazılım ve Dijital Araçlar
  { number: 13, weight: 2, isRedAlarm: true,  domain: "Yazılım ve Dijital Araçlar",        text: "Muhasebe, ERP veya stok yazılımına her çalışan kendi kullanıcı adı ve şifresiyle giriyor mu?" },
  { number: 14, weight: 1, isRedAlarm: false, domain: "Yazılım ve Dijital Araçlar",        text: "Çalışanların yapay zeka araçlarına şirket verisi, müşteri bilgisi veya sözleşme yüklemesini önleyen kural var mı?" },
  // H. Fiziksel Güvenlik
  { number: 15, weight: 2, isRedAlarm: false, domain: "Fiziksel Güvenlik",                 text: "Sunucu, ağ cihazı veya kritik sistemlerin bulunduğu alanlara yetkisiz kişilerin girmesi engelleniyor mu?" },
  { number: 16, weight: 1, isRedAlarm: false, domain: "Fiziksel Güvenlik",                 text: "Müşteri bilgisi veya finansal veri içeren belgeler güvenli şekilde imha ediliyor mu (kağıt parçalama vb.)?" },
  // I. Tedarik Zinciri ve Dijital Varlıklar
  { number: 17, weight: 2, isRedAlarm: true,  domain: "Tedarik Zinciri ve Dijital Varlıklar", text: "Şirketin sosyal medya hesaplarına (Instagram, LinkedIn vb.) kimlerin erişimi var ve bu hesaplarda 2FA aktif mi?" },
  { number: 18, weight: 1, isRedAlarm: false, domain: "Tedarik Zinciri ve Dijital Varlıklar", text: "Web sitesinin alan adı (domain) yenileme tarihi takip ediliyor ve bu konuda sorumlu kişi belirlenmiş mi?" },
  // J. Olay Müdahalesi ve İş Sürekliliği
  { number: 19, weight: 2, isRedAlarm: true,  domain: "Olay Müdahalesi ve İş Sürekliliği", text: "Şirkete siber saldırı yaşanırsa ilk 1 saatte kimin ne yapacağı önceden belirlenmiş mi?" },
  { number: 20, weight: 2, isRedAlarm: true,  domain: "Olay Müdahalesi ve İş Sürekliliği", text: "KVKK kapsamında müşteri verisi sızdığında 72 saat içinde bildirim yapma yükümlülüğünüz için hazırlık yapıldı mı?" },
];

export const ANSWER_SCORES: Record<string, number> = {
  evet: 5,
  kismen: 3,
  bilmiyorum: 0,
  hayir: 0,
};

export function calculateScore(
  answers: Array<{ questionNumber: number; answer: string }>,
  questionSet: typeof MINI_QUESTIONS = MINI_QUESTIONS
) {
  let totalScore = 0;
  let maxScore = 0;
  const redAlarmQuestions: number[] = [];

  const domainMap: Record<string, { score: number; maxScore: number }> = {};

  for (const q of questionSet) {
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
  if (scorePercent >= 86) riskLevel = "İyi";
  else if (scorePercent >= 71) riskLevel = "Düşük";
  else if (scorePercent >= 51) riskLevel = "Orta";
  else if (scorePercent >= 31) riskLevel = "Yüksek";
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
