/** Blog taslağı: Visa/Mastercard/JPMorgan üçüncü taraf vakası (20 Kasım 2026). Taslak olarak eklenir; yayın yönetim panelinden. */
export const THIRD_PARTY_CASE_POST = {
  slug: "visa-mastercard-jpmorgan-ucuncu-taraf-vakasi",
  title: "Visa, Mastercard ve JPMorgan Vakası: Saldırı Ana Sistemden Değil, Tedarikçiden Geldi",
  excerpt: "19 Kasım 2026'da üç dev finans kuruluşu, müşteri verilerinin üçüncü taraf hizmet sağlayıcılardan sızdığını açıkladı. Vaka, tedarikçi riskinin neden ana sistem güvenliğinden bağımsız ele alınması gerektiğini gösteriyor.",
  seoTitle: "Visa, Mastercard, JPMorgan Üçüncü Taraf Vakası: Tedarikçi Riski Dersleri",
  metaDescription: "n0n grubunun Visa, Mastercard ve JPMorgan ile ilişkilendirilen veri sızıntısı ve Expedia, Jack Henry, VodafoneNet, Arçelik örnekleri: tedarikçi riski nasıl yönetilir?",
  focusKeyword: "üçüncü taraf risk yönetimi",
  seoTags: ["üçüncü taraf risk", "tedarikçi güvenliği", "n0n", "tedarik zinciri saldırısı", "KVKK", "TPRM"],
  linkedinPostTr: "Visa, Mastercard ve JPMorgan: saldırı ana sistemlere değil, tedarikçilere geldi.\n\n19 Kasım'da üç şirket de kendi ağlarının ihlal edilmediğini, müşteri verisinin üçüncü taraf hizmet sağlayıcılardan sızdığını açıkladı. Ödeme verisi etkilenmedi; ancak pazarlama verisi ve e-posta adresleri yayımlandı.\n\nDers: en gelişmiş EDR/SIEM yatırımı, verinizi paylaştığınız tedarikçinin güvenliği zayıfsa sizi korumaz. Doğru soru artık \"Biz ne kadar güvendeyiz?\" değil, \"Verimizi tutan tedarikçiler ne kadar güvende?\"\n\nDetaylar ve Türkiye'den örnekler blogumuzda.",
  refsJson: [
    { title: "SecurityWeek: JPMorgan, Visa, Mastercard Cite Third-Party Incidents", url: "https://www.securityweek.com/jpmorgan-visa-mastercard-cite-third-party-incidents-amid-data-leak/" },
    { title: "Skift: Expedia Confirms Cyberattack Through Third-Party Vendor", url: "https://skift.com/?p=848794" },
    { title: "Jack Henry basın açıklaması", url: "https://ir.jackhenry.com/node/25421" },
    { title: "Verizon 2026 DBIR özeti (Help Net Security)", url: "https://www.helpnetsecurity.com/?p=371418" },
    { title: "SOCRadar: n0n grubu profili", url: "https://socradar.io/free-tools/ransomware-intelligence/groups/n0n" },
  ],
  content: `
<p>19 Kasım 2026'da Visa, Mastercard ve JPMorgan Chase, müşterileriyle ilişkilendirilen verilerin <strong>üçüncü taraf hizmet sağlayıcılardan</strong> sızdığını açıkladı. Veriyi yayımlayan, Eylül 2026'da ortaya çıkan <strong>n0n</strong> adlı veri hırsızlığı ve şantaj grubu. Üç şirket de kendi ağlarının ihlal edilmediğini söylüyor.</p>

<h2>Ne oldu, şirketler ne dedi?</h2>
<ul>
<li><strong>Visa:</strong> Olayın Asya-Pasifik'teki bir üçüncü taraf hizmet sağlayıcıyla ilgili olduğunu, kendi sistemlerinin ve kart numaralarının etkilenmediğini belirtti.</li>
<li><strong>Mastercard:</strong> Belirli bir fayda programına kayıtlı küçük bir kart sahibi grubunun e-posta adreslerinin, ödeme dışı bilgi olarak, bir üçüncü taraf sağlayıcıda açığa çıktığını açıkladı.</li>
<li><strong>JPMorgan:</strong> Hizmet sağlayıcılarından birinin hedef alındığını, pazarlama verilerinin (müşteri adı ve e-posta) erişildiğini bildirdi. Reuters'ın aktardığına göre yayımlanan dosyalarda 16.000'den fazla müşteri e-postası var.</li>
</ul>
<p>Etkilenen tedarikçilerin hiçbiri kamuoyuna adıyla açıklanmadı. Grubun iddia ettiği veri miktarları bağımsız olarak doğrulanmış değil; Mastercard'a ait olduğu öne sürülen bazı kayıtların test verisi olabileceği de belirtiliyor.</p>

<h2>Asıl ders: Saldırının nereden geldiği</h2>
<p>Saldırganlar bu kurumların ana sistemlerini hedef almak zorunda kalmadı. Müşteri verisini işleyen tedarikçiler riskin merkezine oturdu. Bir kurum milyonlarca dolarlık EDR, SIEM, DLP ve Zero Trust yatırımı yapabilir; ancak verisini paylaştığı bir tedarikçinin güvenliği yetersizse bu yatırımların koruyamadığı bir yol açık kalır.</p>

<h2>Tek bir vaka değil, bir örüntü</h2>
<ul>
<li><strong>Expedia (Kasım 2026):</strong> Şirket, saldırganların üçüncü taraf bir veri platformu sağlayıcısını ele geçirip bu sağlayıcının güvenilir erişimiyle birden fazla şirkete ulaştığını doğruladı. Wiz ve Sentra'nın bulgularına göre giriş, Qubole'a ait çalınmış bir tedarikçi anahtarıyla yapıldı. n0n'un iddia ettiği milyar mertebesindeki kayıt sayısı Expedia tarafından doğrulanmadı.</li>
<li><strong>Jack Henry (2026):</strong> ABD'li bankacılık teknolojisi sağlayıcısı, sesli oltalama (vishing) ile başlayan bir ihlalde 10'dan az müşteri kurumun verisinin etkilendiğini, 7.200'den fazla müşterisini bilgilendirdiğini ve şantaja boyun eğmediğini açıkladı.</li>
<li><strong>VodafoneNet (Ocak 2026):</strong> KVKK'ya yapılan bildirime göre çalınan verinin, hizmet verdiği bölgesel bir hizmet sağlayıcının (veri işleyen) sisteminden elde edilmiş olabileceği değerlendiriliyor; etkilenen kişi sayısı en fazla 321.504 olarak bildirildi.</li>
<li><strong>Arçelik (Nisan 2026):</strong> Şirket, bir iç hizmet yönetim platformuna yapılan saldırıda saldırganların, üçüncü taraf bir hizmet sağlayıcının alt yüklenicisi üzerinden içeri girdiğini açıkladı; ana sistemlerin etkilenmediği belirtildi.</li>
</ul>
<p>Verizon'un 2026 Veri İhlali Araştırma Raporu'na göre üçüncü tarafların dahil olduğu ihlaller bir yılda %60 artarak tüm ihlallerin %48'ine ulaştı.</p>

<h2>n0n ne yapıyor?</h2>
<p>SOCRadar'a göre n0n, geleneksel fidye yazılımı yerine veri hırsızlığı ve yayımlama tehdidiyle şantaj yapıyor. Grubun saldırılarda çalınmış kimlik bilgilerini (infostealer kaynaklı) kullandığı bildiriliyor; ancak bu üç vakada ilk erişimin nasıl sağlandığı açıklanmış değil.</p>

<h2>Türkiye'deki şirketler için çıkarılacak dersler</h2>
<ol>
<li><strong>Tedarikçilerinizi envanterleyin ve sınıflandırın.</strong> Hangi tedarikçi veriye erişiyor, sisteminize bağlanıyor, kritik bir süreci destekliyor?</li>
<li><strong>Anketle yetinmeyin.</strong> Beyan, bir zaman noktasını gösterir. Dışarıdan görünen güvenlik duruşunu (açık servisler, e-posta güvenliği, sızmış kimlik bilgileri) sürekli izleyin ve beyanla karşılaştırın.</li>
<li><strong>Dördüncü tarafı sorun.</strong> Tedarikçiniz verinizi hangi alt hizmet sağlayıcılarla paylaşıyor? Sözleşmede aynı güvenlik ve ihlal bildirimi şartları var mı?</li>
<li><strong>Yoğunlaşmayı görün.</strong> Birçok tedarikçiniz aynı bulut veya e-posta sağlayıcısına bağlıysa, tek bir olay birçok tedarikçinizi birden etkiler.</li>
<li><strong>Olay bildirim sürelerini yazılı bağlayın.</strong> KVKK kapsamında veri sorumlusu olarak, veri işleyenlerinizin aldığı tedbirlerden de sorumlusunuz.</li>
</ol>

<h2>CyberStep bu konuda ne yapar?</h2>
<p>CyberStep TPRM, tedarikçilerinizin internetten görünen güvenlik duruşunu (güvenlik açıkları, açık servisler, SSL/TLS, e-posta güvenliği, sızmış kimlik bilgisi kayıtları) sürekli puanlar; tedarikçi anketini taramayla karşılaştırıp çelişkileri işaretler; dışarıdan görünen hizmet sağlayıcıları ve portföydeki yoğunlaşmayı gösterir. Dürüst olalım: dışarıdan tarama, bir tedarikçinin içeride tuttuğu pazarlama verisinin nerede olduğunu göstermez. Bu yüzden anket ve veri akışı sorularıyla birlikte kullanılması gerekir.</p>
<p><a href="/iletisim">Tedarikçi risk portföyünüzü ücretsiz pilotla görmek için bize ulaşın.</a></p>
`.trim(),
};
