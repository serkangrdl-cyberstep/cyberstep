import type { RiskDomains } from "./vendorIntake";

/** TPRM tedarikçi anketi soruları: Evet=10 / Kısmen=5 / Hayır=0, en fazla 100 (beyan puanı; doğrulanmamıştır). */
export const TPRM_QUESTIONS = [
  // Erişim ve kimlik
  { id: 2, category: "Erişim ve kimlik", text: "Tüm kritik sistem hesaplarında çok faktörlü doğrulama (MFA) aktif mi?", weight: 1 },
  { id: 12, category: "Erişim ve kimlik", text: "Uzaktan erişim (VPN, uzak masaüstü, yönetim panelleri) yalnızca MFA ile mi yapılıyor?", weight: 1 },
  { id: 13, category: "Erişim ve kimlik", text: "Çalışan işten ayrıldığında veya görev değiştirdiğinde erişimleri aynı gün kapatılıyor/gözden geçiriliyor mu?", weight: 1 },
  { id: 14, category: "Erişim ve kimlik", text: "Çalışan kimlik bilgilerinin sızıp sızmadığı (infostealer, veri sızıntısı) izleniyor ve etkilenen hesapların parolası sıfırlanıyor mu?", weight: 1 },
  // Güvenlik operasyonu
  { id: 4, category: "Güvenlik operasyonu", text: "Yazılım ve işletim sistemleri otomatik veya zamanında güncelleniyor mu?", weight: 1 },
  { id: 9, category: "Güvenlik operasyonu", text: "Son 12 ayda bir güvenlik açığı taraması veya sızma testi yaptırdınız mı?", weight: 1 },
  { id: 15, category: "Güvenlik operasyonu", text: "Kritik sistemlerde günlük kayıtları (log) tutuluyor ve olağan dışı hareketler izleniyor mu (SIEM/EDR/SOC)?", weight: 1 },
  // Veri koruma
  { id: 8, category: "Veri koruma", text: "Müşteri ve iş ortağı verilerini şifreli saklıyor musunuz?", weight: 1 },
  { id: 16, category: "Veri koruma", text: "Müşteri verisine erişim yalnızca işi gereği olan kişilerle sınırlı ve kayıt altında mı?", weight: 1 },
  { id: 17, category: "Veri koruma", text: "Müşteri verisinin tutulduğu ülke/bölge ve yurt dışına aktarım durumu sözleşmede veya yazılı olarak açıkça belirtilmiş mi?", weight: 1 },
  { id: 5, category: "Veri koruma", text: "Kritik verilerinizin düzenli yedeği alınıyor ve geri yükleme test ediliyor mu?", weight: 1 },
  { id: 18, category: "Veri koruma", text: "Yedekleriniz ana ağdan ayrı (çevrimdışı veya değiştirilemez) saklanıyor mu?", weight: 1 },
  // Olay yönetimi
  { id: 6, category: "Olay yönetimi", text: "Bir siber güvenlik olay müdahale planınız (CSIRP) var mı?", weight: 1 },
  { id: 19, category: "Olay yönetimi", text: "Müşteri verisini etkileyen bir olayda müşteriyi önceden belirlenmiş kısa bir sürede (ör. 24–72 saat) bilgilendirmeyi taahhüt ediyor musunuz?", weight: 1 },
  // Alt hizmet sağlayıcılar (dördüncü taraf)
  { id: 7, category: "Alt hizmet sağlayıcılar", text: "Sisteminize erişen üçüncü tarafların erişimleri izleniyor ve yönetiliyor mu?", weight: 1 },
  { id: 11, category: "Alt hizmet sağlayıcılar", text: "Müşteri verisini paylaştığınız alt hizmet sağlayıcıların (pazarlama, bulut, çağrı merkezi vb.) listesini tutuyor ve güvenliklerini değerlendiriyor musunuz?", weight: 1 },
  { id: 20, category: "Alt hizmet sağlayıcılar", text: "Alt hizmet sağlayıcılarınızla yaptığınız sözleşmelerde, bizim verimiz için aynı güvenlik ve ihlal bildirimi şartları yer alıyor mu?", weight: 1 },
  { id: 21, category: "Alt hizmet sağlayıcılar", text: "Bu alt hizmet sağlayıcılardan biri ihlal yaşarsa müşterilerinize bildirim yapacağınız bir süreç tanımlı mı?", weight: 1 },
  // Kurumsal yönetim ve farkındalık
  { id: 1, category: "Kurumsal yönetim", text: "Çalışanlarınız yılda en az bir kez siber güvenlik eğitimi alıyor mu?", weight: 1 },
  { id: 10, category: "Kurumsal yönetim", text: "Çalışanlarınıza yönelik sosyal mühendislik / phishing simülasyonu yapıyor musunuz?", weight: 1 },
  { id: 3, category: "Kurumsal yönetim", text: "E-posta güvenliği için SPF, DKIM ve DMARC kaydı uyguluyor musunuz?", weight: 1 },
  { id: 22, category: "Kurumsal yönetim", text: "Geçerli bir bilgi güvenliği belgeniz var mı (ISO 27001, SOC 2 vb.) ve kapsamı bu hizmeti içeriyor mu?", weight: 1 },
  // Yapay zekâ
  { id: 24, category: "Yapay zekâ kullanımı", text: "Hizmetinizde müşteri verisiyle çalışan yapay zekâ/otomatik karar sistemleri kullanıyor musunuz ve bunların envanterini tutuyor musunuz?", weight: 1 },
  { id: 25, category: "Yapay zekâ kullanımı", text: "Müşteri verisi, müşterinin yazılı izni olmadan yapay zekâ modellerini eğitmek veya iyileştirmek için kullanılmıyor mu?", weight: 1 },
  { id: 26, category: "Yapay zekâ kullanımı", text: "Yapay zekâ çıktıları ve otomatik kararlar için insan gözetimi ve yanlış sonuçlara karşı kontrol süreci tanımlı mı?", weight: 1 },
  // Operasyonel süreklilik
  { id: 27, category: "Operasyonel süreklilik", text: "Hizmet sürekliliği için iş sürekliliği (BCP) ve felaket kurtarma (DR) planınız yazılı ve yılda en az bir kez test ediliyor mu?", weight: 1 },
  { id: 28, category: "Operasyonel süreklilik", text: "Sözleşmede hizmet düzeyi (SLA) ve kabul edilebilir kesinti/geri dönüş süreleri (RTO/RPO) tanımlı mı?", weight: 1 },
  { id: 29, category: "Operasyonel süreklilik", text: "Kritik bir bileşeniniz (bulut, yazılım, alt hizmet sağlayıcı) devre dışı kalırsa alternatif bir yöntem veya sağlayıcıya geçebiliyor musunuz?", weight: 1 },
  // Sözleşme ve zafiyet yönetimi (Siber Dayanıklılık Yönetmeliği taslağı Md. 43 ve 69 ile uyumlu sorular; beyan niteliğindedir)
  { id: 30, category: "Sözleşme ve zafiyet yönetimi", text: "Hizmetinizi veya müşteri verisini etkileyebilecek güvenlik açıklarını müşterilerinize sözleşmede belirlenmiş bir sürede bildirmeyi taahhüt ediyor musunuz?", weight: 1 },
  { id: 31, category: "Sözleşme ve zafiyet yönetimi", text: "Kritik güvenlik yamalarını sözleşmede veya yazılı politikada belirlenmiş sürelerde uyguluyor musunuz?", weight: 1 },
  { id: 32, category: "Sözleşme ve zafiyet yönetimi", text: "Sözleşme bittiğinde müşterinin sistemlerine erişiminiz derhal kapatılıyor ve müşteri verisi iade ediliyor veya güvenli biçimde imha edilip yazılı teyit veriliyor mu?", weight: 1 },
  { id: 33, category: "Sözleşme ve zafiyet yönetimi", text: "Müşteriye özel yazılım veya entegrasyon geliştiriyorsanız, canlıya almadan önce kaynak kod güvenlik analizi yapıyor ve gerektiğinde kaynak kod emaneti (escrow) sunabiliyor musunuz?", weight: 1 },
  { id: 23, category: "Kurumsal yönetim", text: "Kişisel veriler için KVKK kapsamında veri sorumlusu/işleyen yükümlülüklerinizi yazılı olarak yönetiyor musunuz (VERBİS, aydınlatma, ihlal prosedürü)?", weight: 1 },
];

/** Risk alanına göre soru seti: temel kategoriler herkese; alt sağlayıcı/yapay zekâ/süreklilik yalnızca ilgili alan işaretliyse. Alan bilgisi yoksa tümü. */
export function questionsFor(d: RiskDomains | null): typeof TPRM_QUESTIONS {
  if (!d) return TPRM_QUESTIONS;
  return TPRM_QUESTIONS.filter((q) => {
    if (q.category === "Alt hizmet sağlayıcılar") return d.fourthParty || d.data;
    if (q.category === "Yapay zekâ kullanımı") return d.ai;
    if (q.category === "Operasyonel süreklilik") return d.operational;
    if (q.category === "Sözleşme ve zafiyet yönetimi") return q.id === 33 ? d.cyber : (d.cyber || d.data);
    return true;
  });
}

const ANSWER_POINTS = { evet: 10, kismen: 5, hayir: 0 } as const;

/** Beyan puanı 0–100: soru sayısı değişse de ölçek sabit kalır (10 soruda eski hesapla aynıdır). */
export function selfScoreOf(answers: Array<{ answer: keyof typeof ANSWER_POINTS }>, questionCount = TPRM_QUESTIONS.length): number {
  const sum = answers.reduce((s, a) => s + ANSWER_POINTS[a.answer], 0);
  return Math.round((sum * 100) / (questionCount * 10));
}
