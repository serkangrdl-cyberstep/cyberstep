// ─── TPRM yazı planı ───────────────────────────────────────────────────────────
// Bu liste bitene kadar otomatik yayında önceliklidir (takvim ve BLOG_PLAN'dan önce).
// Bitince normal akışa dönülür; kendi indeksi ayrı tutulur ve baştan başlamaz.
export interface BlogTopic { category: string; title: string; keywords: string; angle: string }

export const TPRM_PLAN: BlogTopic[] = [
  { category: "TPRM", title: "Tedarikçi Risk Yönetimi (TPRM) Nedir? Türkiye'de Nereden Başlanır?", keywords: "tedarikçi risk yönetimi TPRM, üçüncü taraf risk yönetimi Türkiye", angle: "TPRM'in ne olduğunu, kimin neden ihtiyaç duyduğunu ve ilk üç adımı sade anlatan giriş rehberi" },
  { category: "TPRM", title: "Tedarikçi Güvenlik Anketi Neden Tek Başına Yetmez?", keywords: "tedarikçi güvenlik anketi, tedarikçi değerlendirme dışarıdan doğrulama", angle: "Anket beyan eder, doğrulamaz: anketi dışarıdan görünen verilerle karşılaştırmanın mantığı ve sınırları" },
  { category: "TPRM", title: "Kritik Tedarikçiyi Nasıl Belirlersiniz? Tedarikçi Sınıflandırma Rehberi", keywords: "kritik tedarikçi belirleme, tedarikçi sınıflandırma veri erişimi", angle: "Veri erişimi, sisteme bağlantı ve iş sürekliliği ölçütleriyle üç katmanlı basit sınıflandırma" },
  { category: "TPRM", title: "Dördüncü Taraf Riski: Tedarikçinizin Tedarikçisi Kim?", keywords: "dördüncü taraf riski, alt yüklenici siber güvenlik", angle: "Tedarikçinin alt hizmet sağlayıcıları ve sözleşmede yansıtılması gereken şartlar; dışarıdan görünenin sınırı" },
  { category: "TPRM", title: "KVKK'da Veri İşleyen Tedarikçi: Sorumluluk Kimde?", keywords: "KVKK veri işleyen sorumluluk, KVKK madde 12 tedarikçi", angle: "Veri sorumlusunun veri işleyenin tedbirlerinden sorumluluğu; denetim ve sözleşme adımları" },
  { category: "TPRM", title: "Tedarikçi Sözleşmesinde Olması Gereken Siber Güvenlik Maddeleri", keywords: "tedarikçi sözleşmesi siber güvenlik maddeleri, ihlal bildirim süresi", angle: "İhlal bildirimi süresi, denetim hakkı, alt yüklenici, veri iadesi ve silme: kontrol listesi" },
  { category: "TPRM", title: "Tedarikçi Güvenlik Skoru Nasıl Okunur? Dışarıdan Ölçümün Sınırları", keywords: "tedarikçi güvenlik skoru, dış yüzey tarama sınırları", angle: "Skor neyi ölçer, neyi ölçemez; iç erişim yönetimi ve süreçler neden dışarıdan görünmez" },
  { category: "TPRM", title: "Tedarikçi Çalışanlarının Sızmış Hesapları: Görünmeyen Giriş Kapısı", keywords: "infostealer sızmış kimlik bilgisi tedarikçi, çalınmış hesap tedarik zinciri", angle: "Çalınmış kimlik bilgilerinin tedarikçi üzerinden erişime dönüşmesi ve MFA, hesap yönetimi önlemleri" },
  { category: "TPRM", title: "Tedarikçinizde İhlal Oldu: İlk 72 Saatte Müşteri Tarafı Ne Yapmalı?", keywords: "tedarikçi ihlali müdahale, üçüncü taraf veri ihlali plan", angle: "Tedarikçiden gelen ihlal bildirimine karşı müşteri şirketin adım adım planı ve KVKK bildirim ilişkisi" },
  { category: "TPRM", title: "Tedarikçi Portföyünde Yoğunlaşma Riski: Hepsi Aynı Sağlayıcıya Bağlıysa", keywords: "yoğunlaşma riski tedarikçi, ortak bulut sağlayıcı bağımlılığı", angle: "Birden çok tedarikçinin aynı altyapıya bağlı olmasının tek olayı çoğaltması ve nasıl görülür" },
  { category: "TPRM", title: "Tedarikçiyle Bulguyu Kapatmak: Aksiyon Planı ve Yeniden Tarama", keywords: "tedarikçi aksiyon planı, bulgu kapatma yeniden tarama", angle: "Bulguyu tedarikçiye iletmek, sorumlu ve süre belirlemek, düzeltmeyi yeniden ölçümle doğrulamak" },
  { category: "TPRM", title: "Üçüncü Taraf Kaynaklı İhlallerden Dersler: Drift, MOVEit, Change Healthcare", keywords: "üçüncü taraf ihlali örnekleri, tedarik zinciri saldırısı dersler", angle: "Doğrulanmış kamuya açık vakalardan çıkan ortak örüntüler ve alınacak önlemler" },
];

// TPRM yazılarında kullanılabilecek doğrulanmış olgular (kaynaklarıyla). Model bunların dışında vaka,
// rakam veya alıntı üretmemelidir.
export const TPRM_VERIFIED_FACTS = `- Verizon 2026 DBIR: ihlallerde üçüncü tarafın yer aldığı pay %48; bir önceki yıla göre %60 artış (küresel veridir, Türkiye'ye özel oran yoktur).
- Salesloft Drift (Ağustos 2025): Drift entegrasyonuna ait çalınmış OAuth anahtarlarıyla müşterilerin Salesforce verilerine erişildi; Cloudflare, Palo Alto Networks, Proofpoint gibi şirketler etkilendiklerini açıkladı. Salesforce'un kendi açığı sömürülmedi.
- Change Healthcare (Şubat 2024): tek bir sağlayıcının kesintisi ABD'de sağlık hizmetlerini ülke çapında aksattı.
- MOVEit (2023): tek bir yazılımdaki açık binlerce kuruluşu etkiledi.
- Visa, Mastercard, JPMorgan (19 Kasım 2026): üç şirket de kendi ağlarının ihlal edilmediğini, verinin üçüncü taraf hizmet sağlayıcılardan sızdığını açıkladı; sağlayıcılar adıyla açıklanmadı. Grubun iddia ettiği veri miktarları doğrulanmış değildir.
- Expedia (Kasım 2026): şirket, üçüncü taraf bir veri platformu sağlayıcısının ele geçirildiğini doğruladı; grubun iddia ettiği kayıt sayısı doğrulanmadı.
- VodafoneNet (Ocak 2026): KVKK bildirimine göre çalınan veri, bir bölgesel hizmet sağlayıcının (veri işleyen) sisteminden elde edilmiş olabilir; etkilenen kişi sayısı en fazla 321.504 olarak bildirildi. Kaynağın veri işleyen olması kesinleşmiş değildir.
- Arçelik (Nisan 2026): saldırganlar, üçüncü taraf bir hizmet sağlayıcının alt yüklenicisi üzerinden iç hizmet yönetim platformuna ulaştı; ana sistemlerin etkilenmediği belirtildi.
- Hepsiburada (KVKK Kurul kararı 2026/2438, 4 Kasım 2026): sohbet altyapısı sağlayan bir hizmet firması üzerinden 2022 tarihli destek kayıtlarından 9.882 kişi etkilendi; firmanın adı açıklanmadı.
- KVKK madde 12: veri sorumlusu, veri işleyenin aldığı tedbirlerden de sorumludur.`;
