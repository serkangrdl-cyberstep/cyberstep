/** TPRM tedarikçi anketi soruları: Evet=10 / Kısmen=5 / Hayır=0, en fazla 100 (beyan puanı; doğrulanmamıştır). */
export const TPRM_QUESTIONS = [
  { id: 1, text: "Çalışanlarınız yılda en az bir kez siber güvenlik eğitimi alıyor mu?", weight: 1 },
  { id: 2, text: "Tüm kritik sistem hesaplarında çok faktörlü doğrulama (MFA) aktif mi?", weight: 1 },
  { id: 3, text: "E-posta güvenliği için SPF, DKIM ve DMARC kaydı uyguluyor musunuz?", weight: 1 },
  { id: 4, text: "Yazılım ve işletim sistemleri otomatik veya zamanında güncelleniyor mu?", weight: 1 },
  { id: 5, text: "Kritik verilerinizin düzenli yedeği alınıyor ve geri yükleme test ediliyor mu?", weight: 1 },
  { id: 6, text: "Bir siber güvenlik olay müdahale planınız (CSIRP) var mı?", weight: 1 },
  { id: 7, text: "Sisteminize erişen üçüncü tarafların erişimleri izleniyor ve yönetiliyor mu?", weight: 1 },
  { id: 8, text: "Müşteri ve iş ortağı verilerini şifreli saklıyor musunuz?", weight: 1 },
  { id: 9, text: "Son 12 ayda bir güvenlik açığı taraması veya sızma testi yaptırdınız mı?", weight: 1 },
  { id: 10, text: "Çalışanlarınıza yönelik sosyal mühendislik / phishing simülasyonu yapıyor musunuz?", weight: 1 },
  { id: 11, text: "Müşteri verisini paylaştığınız alt hizmet sağlayıcıların (pazarlama, bulut, çağrı merkezi vb.) listesini tutuyor ve güvenliklerini değerlendiriyor musunuz?", weight: 1 },
];

const ANSWER_POINTS = { evet: 10, kismen: 5, hayir: 0 } as const;

/** Beyan puanı 0–100: soru sayısı değişse de ölçek sabit kalır (10 soruda eski hesapla aynıdır). */
export function selfScoreOf(answers: Array<{ answer: keyof typeof ANSWER_POINTS }>, questionCount = TPRM_QUESTIONS.length): number {
  const sum = answers.reduce((s, a) => s + ANSWER_POINTS[a.answer], 0);
  return Math.round((sum * 100) / (questionCount * 10));
}
