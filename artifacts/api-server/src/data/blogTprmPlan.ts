// ─── TPRM yazı planı ───────────────────────────────────────────────────────────
// Bu liste bitene kadar otomatik yayında önceliklidir (takvim ve BLOG_PLAN'dan önce).
// Bitince normal akışa dönülür; kendi indeksi ayrı tutulur ve baştan başlamaz.
export interface BlogTopic { category: string; title: string; keywords: string; angle: string; facts?: string[] }

export const TPRM_PLAN: BlogTopic[] = [
  { category: "TPRM", title: "Tedarikçi Risk Yönetimi (TPRM) Nedir? Türkiye'de Nereden Başlanır?", keywords: "tedarikçi risk yönetimi TPRM, üçüncü taraf risk yönetimi Türkiye", angle: "TPRM'in ne olduğunu, kimin neden ihtiyaç duyduğunu ve ilk üç adımı sade anlatan giriş rehberi", facts: ["arcelik", "target"] },
  { category: "TPRM", title: "Tedarikçi Güvenlik Anketi Neden Tek Başına Yetmez?", keywords: "tedarikçi güvenlik anketi, tedarikçi değerlendirme dışarıdan doğrulama", angle: "Anket beyan eder, doğrulamaz: anketi dışarıdan görünen verilerle karşılaştırmanın mantığı ve sınırları", facts: ["drift", "dhl-anket"] },
  { category: "TPRM", title: "Kritik Tedarikçiyi Nasıl Belirlersiniz? Tedarikçi Sınıflandırma Rehberi", keywords: "kritik tedarikçi belirleme, tedarikçi sınıflandırma veri erişimi", angle: "Veri erişimi, sisteme bağlantı ve iş sürekliliği ölçütleriyle üç katmanlı basit sınıflandırma", facts: ["change-healthcare", "target", "sgk7545", "kvkk12"] },
  { category: "TPRM", title: "Dördüncü Taraf Riski: Tedarikçinizin Tedarikçisi Kim?", keywords: "dördüncü taraf riski, alt yüklenici siber güvenlik", angle: "Tedarikçinin alt hizmet sağlayıcıları ve sözleşmede yansıtılması gereken şartlar; dışarıdan görünenin sınırı", facts: ["arcelik", "kutuphane-2039"] },
  { category: "TPRM", title: "KVKK'da Veri İşleyen Tedarikçi: Sorumluluk Kimde?", keywords: "KVKK veri işleyen sorumluluk, KVKK madde 12 tedarikçi", angle: "Veri sorumlusunun veri işleyenin tedbirlerinden sorumluluğu; denetim ve sözleşme adımları", facts: ["hepsiburada", "kvk-teknik", "vodafonenet", "kvkk12"] },
  { category: "TPRM", title: "Tedarikçi Sözleşmesinde Olması Gereken Siber Güvenlik Maddeleri", keywords: "tedarikçi sözleşmesi siber güvenlik maddeleri, ihlal bildirim süresi", angle: "İhlal bildirimi süresi, denetim hakkı, alt yüklenici, veri iadesi ve silme: kontrol listesi", facts: ["okta", "visa-mc-jpm", "bddk-destek", "kvkk12"] },
  { category: "TPRM", title: "Tedarikçi Güvenlik Skoru Nasıl Okunur? Dışarıdan Ölçümün Sınırları", keywords: "tedarikçi güvenlik skoru, dış yüzey tarama sınırları", angle: "Skor neyi ölçer, neyi ölçemez; iç erişim yönetimi ve süreçler neden dışarıdan görünmez", facts: ["solarwinds", "okta"] },
  { category: "TPRM", title: "Tedarikçi Çalışanlarının Sızmış Hesapları: Görünmeyen Giriş Kapısı", keywords: "infostealer sızmış kimlik bilgisi tedarikçi, çalınmış hesap tedarik zinciri", angle: "Çalınmış kimlik bilgilerinin tedarikçi üzerinden erişime dönüşmesi ve MFA, hesap yönetimi önlemleri", facts: ["target", "expedia"] },
  { category: "TPRM", title: "Tedarikçinizde İhlal Oldu: İlk 72 Saatte Müşteri Tarafı Ne Yapmalı?", keywords: "tedarikçi ihlali müdahale, üçüncü taraf veri ihlali plan", angle: "Tedarikçiden gelen ihlal bildirimine karşı müşteri şirketin adım adım planı ve KVKK bildirim ilişkisi", facts: ["baydoner", "kaseya"] },
  { category: "TPRM", title: "Tedarikçi Portföyünde Yoğunlaşma Riski: Hepsi Aynı Sağlayıcıya Bağlıysa", keywords: "yoğunlaşma riski tedarikçi, ortak bulut sağlayıcı bağımlılığı", angle: "Birden çok tedarikçinin aynı altyapıya bağlı olmasının tek olayı çoğaltması ve nasıl görülür", facts: ["crowdstrike", "change-healthcare"] },
  { category: "TPRM", title: "Tedarikçiyle Bulguyu Kapatmak: Aksiyon Planı ve Yeniden Tarama", keywords: "tedarikçi aksiyon planı, bulgu kapatma yeniden tarama", angle: "Bulguyu tedarikçiye iletmek, sorumlu ve süre belirlemek, düzeltmeyi yeniden ölçümle doğrulamak", facts: [] },
  { category: "TPRM", title: "Üçüncü Taraf Kaynaklı İhlallerden Dersler: Drift, MOVEit, Change Healthcare", keywords: "üçüncü taraf ihlali örnekleri, tedarik zinciri saldırısı dersler", angle: "Doğrulanmış kamuya açık vakalardan çıkan ortak örüntüler ve alınacak önlemler", facts: ["drift", "moveit", "change-healthcare"] },
];

// TPRM yazılarında kullanılabilecek doğrulanmış olgular (kaynaklarıyla). Model bunların dışında vaka,
// rakam veya alıntı üretmemelidir.
export interface TprmSource { title: string; url: string }
export interface TprmFact { id: string; kind: "case" | "stat" | "law"; text: string; sources?: TprmSource[] }

// Doğrulanmış olgular (kaynaklarıyla). Model bunların dışında vaka, rakam veya alıntı üretmemelidir.
export const TPRM_FACT_ITEMS: TprmFact[] = [
  { id: "verizon", kind: "stat", text: "Verizon 2026 DBIR (Kasım 2024 – Ekim 2025 arası olayları kapsar): ihlallerde üçüncü tarafın yer aldığı pay %48; bir önceki yıla göre %60 artış (küresel veridir, Türkiye'ye özel oran yoktur). \"2026 yılında yaşanan ihlaller\" DEME; \"Verizon'un 2026 raporuna göre\" de.", sources: [{ title: "Verizon 2026 DBIR özeti (Help Net Security)", url: "https://www.helpnetsecurity.com/?p=371418" }] },
  { id: "drift", kind: "case", text: "Salesloft Drift (Ağustos 2025): Drift entegrasyonuna ait çalınmış OAuth anahtarlarıyla müşterilerin Salesforce verilerine erişildi; Cloudflare, Palo Alto Networks, Proofpoint gibi şirketler etkilendiklerini açıkladı. Salesforce'un kendi açığı sömürülmedi; bu bir yazılım açığı değil, çalınmış erişim anahtarı vakasıdır (\"açığından sızdı\" DEME)." },
  { id: "change-healthcare", kind: "case", text: "Change Healthcare (Şubat 2024): tek bir sağlayıcının kesintisi ABD'de sağlık hizmetlerini ülke çapında aksattı." },
  { id: "moveit", kind: "case", text: "MOVEit (2023): tek bir yazılımdaki açık binlerce kuruluşu etkiledi." },
  { id: "visa-mc-jpm", kind: "case", text: "Visa, Mastercard, JPMorgan (19 Kasım 2026): üç şirket de kendi ağlarının ihlal edilmediğini, verinin üçüncü taraf hizmet sağlayıcılardan sızdığını açıkladı; sağlayıcılar adıyla açıklanmadı. Grubun iddia ettiği veri miktarları doğrulanmış değildir.", sources: [{ title: "SecurityWeek: JPMorgan, Visa, Mastercard Cite Third-Party Incidents", url: "https://www.securityweek.com/jpmorgan-visa-mastercard-cite-third-party-incidents-amid-data-leak/" }] },
  { id: "expedia", kind: "case", text: "Expedia (Kasım 2026): şirket, üçüncü taraf bir veri platformu sağlayıcısının ele geçirildiğini doğruladı; grubun iddia ettiği kayıt sayısı doğrulanmadı." },
  { id: "vodafonenet", kind: "case", text: "VodafoneNet (Ocak 2026): KVKK bildirimine göre çalınan veri, bir bölgesel hizmet sağlayıcının (veri işleyen) sisteminden elde edilmiş olabilir; etkilenen kişi sayısı en fazla 321.504 olarak bildirildi. Kaynağın veri işleyen olması kesinleşmiş değildir.", sources: [{ title: "CNBC-e: KVKK'dan 'Vodafone Net' için veri ihlali duyurusu", url: "https://www.cnbce.com/teknoloji/kvkkdan-vodafone-net-icin-veri-ihlali-duyurusu-320-bin-kisi-etkilenmis-olabilir-h24391" }] },
  { id: "arcelik", kind: "case", text: "Arçelik (Nisan 2026): saldırganlar, üçüncü taraf bir hizmet sağlayıcının alt yüklenicisi üzerinden iç hizmet yönetim platformuna ulaştı; ana sistemlerin etkilenmediği belirtildi.", sources: [{ title: "Yüzde100Yerli: Tedarik zincirinde siber sızıntı, Arçelik'ten ihlal bildirimi (9 Mayıs 2026)", url: "https://www.yuzde100yerli.com/en/tedarik-zincirinde-siber-sizinti-arcelikten-ihlal-bildirimi/" }] },
  { id: "hepsiburada", kind: "case", text: "Hepsiburada (KVKK Kurul kararı 2026/2438, 4 Kasım 2026): sohbet altyapısı sağlayan bir hizmet firması üzerinden 2022 tarihli destek kayıtlarından 9.882 kişi etkilendi; firmanın adı açıklanmadı. KVKK Kurulu yalnızca ihlal bildirimini internet sitesinde yayımlamaya karar verdi; Kurulun şirkete karşı işlem başlattığı, dava açıldığı veya ceza verildiği bilgisi YOKTUR, bunları yazma (\"dava\", \"işlem başlattı\", \"ceza\" DEME).", sources: [{ title: "KVKK kamuoyu duyurusu: D-Market Elektronik Hizmetler ve Ticaret A.Ş. (4 Kasım 2026; arşiv kopyası)", url: "https://web.archive.org/web/20261126151317/https://www.kvkk.gov.tr/Icerik/9080/kamuoyu-duyurusu-veri-ihlali-bildirimi-d-market-elektronik-hizmetler-ve-ticaret-a-s" }] },
  { id: "kvkk12", kind: "law", text: "KVKK madde 12/2: kişisel veriler veri sorumlusu adına başka bir kişi tarafından işleniyorsa veri sorumlusu, güvenlik tedbirlerinin alınması konusunda bu kişilerle müştereken sorumludur (sorumluluk tedarikçiye devredilmez; tedarikçi ihlale neden olsa da veri sorumlusu KVKK sürecinin muhatabı olabilir). Bu madde TPRM programını açıkça zorunlu kılmaz; \"TPRM zorunlu uyum süreci\" DEME, \"veri sorumlusunun sorumluluğu tedarikçi seçimini ve denetimini önemli kılar\" gibi yaz." },
  { id: "target", kind: "case", text: "Target (Kasım–Aralık 2013): saldırganlar, bir hizmet tedarikçisinden (klima/soğutma firması Fazio Mechanical) çalınan ağ kimlik bilgileriyle Target ağına girdi; Target yaklaşık 40 milyon ödeme kartı kaydının çalındığını, ayrıca yaklaşık 70 milyon müşteriye ait kişisel kaydın etkilendiğini açıkladı." },
  { id: "crowdstrike", kind: "case", text: "CrowdStrike (19 Temmuz 2024): bir güvenlik yazılımı sağlayıcısının hatalı güncellemesi, Microsoft'un tahminine göre yaklaşık 8,5 milyon Windows cihazını çökertti; saldırı değil, tek bir sağlayıcıya bağımlılığın sonucuydu ve havayolu, hastane, banka gibi birçok sektörde kesinti yarattı." },
  { id: "solarwinds", kind: "case", text: "SolarWinds Orion (2020): Orion yazılımının Mart–Haziran 2020 arası sürümlerine zararlı kod yerleştirildi; şirketin SEC bildirimine göre yaklaşık 18.000'e kadar müşteri bu sürümleri kullanmış olabilirdi." },
  { id: "okta", kind: "case", text: "Okta (Eylül–Ekim 2023): çalınmış bir kimlik bilgisiyle Okta'nın müşteri destek sistemine girildi; 134 müşteriye ait dosyalara (Okta müşterilerinin %1'inden azı) erişildi ve bazı dosyalardaki oturum belirteçleri kullanıldı. BeyondTrust şüpheli etkinliği 2 Ekim'de bildirdi; Okta müşterilere ihlali 19–20 Ekim'de duyurdu." },
  { id: "kaseya", kind: "case", text: "Kaseya VSA (Temmuz 2021): yönetilen hizmet sağlayıcıların (MSP) kullandığı yazılımdaki açık sömürüldü; Kaseya'ya göre yaklaşık 60 müşteri (çoğu MSP) ve 1.500'den az alt müşteri işletme etkilendi. Zincirin iki katman altındaki şirketler, hiç ilişkileri olmadığı bir yazılımdan etkilendi." },
  { id: "baydoner", kind: "case", text: "Baydöner (KVKK bildirimi, Mart 2026): ihlal 15 Şubat 2026'da başladı, 8 Mart 2026'da tespit edildi; şirketin tedarikçisi tarafından geliştirilen ve yönetilen müşteri hizmetleri / çağrı merkezi platformu üzerinden yaklaşık 1,5 milyon kişinin bulunduğu veri tabanına yetkisiz erişim yaşandı. Sorumlu tedarikçinin adı bildirimde yoktur; yazma." },
  { id: "kvk-teknik", kind: "case", text: "KVK Teknik Servis (KVKK kamuoyu duyurusu, 4 Kasım 2026): veri işleyen nezdinde barındırılan 624 chat kaydına yetkisiz erişildi; etkilenen gruplar müşteriler/potansiyel müşteriler; etkilenen kişi sayısı duyuru tarihinde belirlenememişti (veri işleyenden bekleniyordu). Sayıyı kesinleşmiş gibi yazma.", sources: [{ title: "KVKK kamuoyu duyurusu: KVK Teknik Servis Hiz. ve Tic. A.Ş. (4 Kasım 2026; arşiv kopyası)", url: "https://web.archive.org/web/20261126152428/https://www.kvkk.gov.tr/Icerik/9081/kamuoyu-duyurusu-veri-ihlali-bildirimi-kvk-teknik-servis-hiz-ve-tic-a-s" }] },
  { id: "kutuphane-2039", kind: "case", text: "KVKK Kurulu'nun 16 Eylül 2026 tarihli 2026/2039 sayılı kararıyla çok sayıda şirketin ihlal bildirimi yayımlandı; bu bildirimlerin birçoğunda yetkisiz erişimin üçüncü taraf bir yazılım kütüphanesindeki güvenlik zafiyeti üzerinden gerçekleştiği belirtildi (örnek: Mersin Mana Tarım'da 695 kişi; bir perakende şirketinde 1.271.096 müşteri (firma adını yazıda anma); ikisinde de ihlal veri işleyenin kullandığı üçüncü taraf yazılım kütüphanesindeki zafiyetten kaynaklandı). Yazılım kütüphanesinin adı ve tek bir ortak saldırgan olduğu bildirimlerde yer almıyor; ima etme. Kurul yalnızca bildirimlerin yayımlanmasına karar verdi; ceza yok.", sources: [{ title: "KVKK kamuoyu duyurusu: Mersin Mana Tarım (16 Eylül 2026; arşiv kopyası)", url: "https://web.archive.org/web/20261006184929/https://www.kvkk.gov.tr/Icerik/8979/kamuoyu-duyurusu-veri-ihlali-bildirimi-mersin-mana-tarim-sanayi-ve-ticaret-ltd-sti" }, { title: "KVKK kamuoyu duyurusu: Deniz Deniz Butik Tekstil (Kurul Kararı 2026/2039; arşiv kopyası)", url: "https://web.archive.org/web/20261006192654/https://www.kvkk.gov.tr/Icerik/8985/kamuoyu-duyurusu-veri-ihlali-bildirimi-deniz-deniz-butik-tekstil-sanayi-ve-ticaret-anonim-sirketi" }, { title: "Yeniçağ: KVKK açıkladı, 12 şirketin verileri çalındı", url: "https://www.yenicaggazetesi.com/kvkk-acikladi-12-sirketin-verileri-calindi-1072719h.htm" }] },
  { id: "dhl-anket", kind: "case", text: "DHL AG (KVKK kamuoyu duyurusu, 11 Kasım 2026): veri sorumlusunun merkezi çalışan anketleri için hizmet aldığı veri işleyenin işlettiği veri analizi ve raporlama ortamına yetkisiz erişildi. Etkilenen kişi sayısını veya ayrıntıyı bu olgunun dışına taşıma." },
  { id: "sgk7545", kind: "law", text: "7545 sayılı Siber Güvenlik Kanunu: kapsamdaki kamu kurumları ve kuruluşlar ile gerçek ve tüzel kişiler (madde 2), mevzuatın öngördüğü siber güvenlik tedbirlerini almak ve Siber Güvenlik Başkanlığı'nın düzenleyici işlemlerine uymakla yükümlüdür (madde 7/1-b,d); kamu kurumlarında ve kritik altyapılarda kullanılacak siber güvenlik ürün, sistem ve hizmetleri Başkanlıkça yetkilendirilmiş ve belgelendirilmiş tedarikçilerden temin edilir (madde 7/1-c). Kanun metninde genel bir \"tedarikçi risk yönetimi programı\" zorunluluğu olduğunu YAZMA; \"Kanun kapsamındaysanız\" diye koşullu yaz." },
  { id: "bddk-destek", kind: "law", text: "BDDK (bankalar): Bankaların Destek Hizmeti Almalarına İlişkin Yönetmelik (Resmî Gazete 5 Kasım 2011, sayı 28106) ve Bankaların Bilgi Sistemleri ve Elektronik Bankacılık Hizmetleri Hakkında Yönetmelik (Resmî Gazete 15 Mart 2020, sayı 31069); ikincisinde \"dış hizmet\", destek hizmetleri dahil bankaların bilgi sistemlerine ilişkin dışarıdan temin ettikleri hizmetler olarak tanımlanır. Madde numarası veya somut yükümlülük (denetim, raporlama, bildirim süresi) YAZMA; yalnızca bankaların dış hizmet / destek hizmeti alımının BDDK düzenlemesine tabi olduğunu söyle." },
];

/** Tüm olgular tek metin (testler ve geriye dönük kullanım için). */
export const TPRM_VERIFIED_FACTS = TPRM_FACT_ITEMS.map(f => `- ${f.text}`).join("\n");

const CASE_IDS = TPRM_FACT_ITEMS.filter(f => f.kind === "case").map(f => f.id);

/**
 * Bir yazı için kullanılabilecek olgu alt kümesi. Yazıya özel vakalar konunun `facts` alanından gelir;
 * alan yoksa plandaki sıraya göre döndürülür. Böylece her yazı aynı örneklere yaslanmaz.
 */
export function selectFactsForTopic(topic: BlogTopic, planIndex: number): string {
  let ids: string[];
  if (topic.facts) {
    ids = [...topic.facts];
  } else {
    const start = Math.abs(planIndex >= 0 ? planIndex * 2 : hash(topic.title)) % CASE_IDS.length;
    ids = [CASE_IDS[start], CASE_IDS[(start + 1) % CASE_IDS.length]];
  }
  if (/kvkk|sözleşme|veri işleyen|sorumluluk/i.test(`${topic.title} ${topic.keywords}`) && !ids.includes("kvkk12")) ids.push("kvkk12");
  return ids
    .map(id => TPRM_FACT_ITEMS.find(f => f.id === id))
    .filter((f): f is TprmFact => !!f)
    .map(f => `- ${f.text}`)
    .join("\n");
}

/** Bir yazıya atanan olguların kaynak bağlantıları (aynı seçim mantığı; yalnızca kaynağı olan olgular). */
export function sourcesForTopic(topic: BlogTopic, planIndex: number, content?: string): TprmSource[] {
  const text = selectFactsForTopic(topic, planIndex);
  const seen = new Set<string>();
  const out: TprmSource[] = [];
  for (const f of TPRM_FACT_ITEMS) {
    if (!f.sources || !text.includes(f.text)) continue;
    // İçerik verildiyse yalnızca yazıda gerçekten anılan olgunun kaynağı eklenir (olgunun ilk sözcüğü: firma/rapor adı)
    if (content && !content.toLowerCase().includes(f.text.split(/[ (:,]/)[0].toLowerCase())) continue;
    for (const src of f.sources) if (!seen.has(src.url)) { seen.add(src.url); out.push(src); }
  }
  return out;
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// TPRM yazılarında hem üretim prompt'una hem ikinci kontrole verilen kesin kurallar.
export const TPRM_WRITING_RULES = `- Dışarıdan taramayı anlatırken "tedarikçiye haber vermeden", "izinsiz", "fark ettirmeden" gibi ifadeler KULLANMA; yalnızca "kamuya açık kaynaklardan okunabilen sinyaller" de.
- Verizon oranını her zaman dönemiyle ve "küresel" olduğunu belirterek ver (Kasım 2024 – Ekim 2025). "%60 artmış oran" yerine "yaklaşık %60 artarak %48'e ulaştı" yaz.
- MOVEit "tek sağlayıcıya bağımlılık" örneği DEĞİLDİR; yalnızca "tek bir yazılımdaki açığın binlerce kuruluşu etkilemesi" olarak kullan. Tek sağlayıcı bağımlılığı için yalnızca Change Healthcare kullanılabilir.
- Drift olayını yazılım açığı olarak anlatma; çalınmış OAuth anahtarı olarak anlat.
- KVKK madde 12'yi "müşterek sorumluluk" olarak anlat; "tedarikçinin tedbirlerinden sorumlusunuz" ya da TPRM'in zorunlu olduğu ifadesini kullanma.
- Olgular arasında "ortak örüntü/ortak nokta" kurma; yalnızca her olgunun kendi metninde yazan ortak özelliği söyle (ör. kaynağı kesin olmayan bir vakayı "veri işleyen kaynaklı" sayma).
- Olgu metninde olmayan sonuç, etki veya yorum ekleme (ör. "süreci karmaşık hale getirdi", "tedarikçi seçme sorumluluğu"); KVKK md. 12'de olmayan yükümlülüğü ("seçme" gibi) yasaya atfetme; denetimi "önerilir" diye yaz.
- Hepsiburada kararını yalnızca ihlal bildiriminin yayımlanması olarak anlat; işlem, ceza, dava, soruşturma ima etme.
- KVKK kamuoyu duyurularını yalnızca duyurudaki ifadelerle ve tarihleriyle an; Kurulun yayımlama kararını ceza, soruşturma veya kusur tespiti gibi anlatma. Duyuruda adı geçmeyen tedarikçiyi tahmin etme.
- Mevzuatı (7545, BDDK, KVKK) yalnızca atanmış olgudaki kapsamda an; madde numarası, süre veya yaptırım ekleme; "zorunludur" yerine "kapsamdaysanız ... düzenlemeye tabidir" kullan.
- "Zorunludur", "şarttır", "mecburdur" gibi ifadeleri TPRM adımları için KULLANMA; yalnızca atanmış mevzuat olgusu bunu söylüyorsa ve kapsam koşuluyla ("kapsamdaysanız") kullan. Öneri için "önerilir", "yararlıdır" yaz.
- 7545 madde 7/1-c yalnızca siber güvenlik ürün/sistem/hizmeti alımıyla ilgilidir; bunu genel tedarikçi sınıflandırmasına veya her tedarikçiye bağlama.
- Target'ta Fazio Mechanical için "tedarikçisi" yaz ("hizmetçisi" değil); rakamları "Target açıkladı" ile ver ("etkilendi/çalındı", "ulaştı" değil).
- Katman/ölçüt sistemi anlatırken tanım tek ve tutarlı olsun (örn. hiç Evet → Katman 3, bir → Katman 2, iki veya üç → Katman 1); "bir kademe yukarı taşır" gibi belirsiz ifade kullanma.
- Atanmış olgularda olmayan genel sayı veya oran verme ("onlarca, yüzlerce tedarikçi", "çoğu işletme" gibi); gerekirse niteliksel yaz ("uzun bir liste").
- Tüm listeleri <ul><li> veya <ol><li> etiketleriyle yaz; paragrafları <p>, başlıkları <h2>/<h3> ile yaz.`;
