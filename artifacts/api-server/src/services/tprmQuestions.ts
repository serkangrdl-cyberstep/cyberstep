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
];
