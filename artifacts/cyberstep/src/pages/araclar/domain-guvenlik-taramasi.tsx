import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "domain-guvenlik-taramasi",
  title: "Ücretsiz Domain Güvenlik Taraması — SPF, DKIM, DMARC, SSL, Kara Liste",
  metaDescription: "Şirket domain'inizin güvenlik açıkları var mı? SPF, DKIM, DMARC, SSL ve kara liste kontrolü — ücretsiz, saniyeler içinde.",
  h1: "Domain Güvenlik Taraması — Ücretsiz",
  whatIsIt: "Domain güvenlik taraması, şirketinizin internet adresi (domain) üzerindeki tüm güvenlik yapılandırmalarını analiz eder. E-posta sahteciliği (spoofing) korumaları olan SPF, DKIM ve DMARC kayıtlarınızın doğru yapılandırılmış olup olmadığı, SSL sertifikanızın geçerliliği, domain'inizin uluslararası kara listelerde görünüp görünmediğini tek raporda gösterir. Bu analiz, siber saldırganlar sizden önce zayıflığınızı tespit etmeden önleminizi almanızı sağlar.",
  howItWorks: [
    "Şirket domain adresinizi girin (örnek: sirketim.com.tr)",
    "Tara butonuna basın — analiz 20-30 saniye sürer",
    "SPF, DKIM, DMARC, SSL ve kara liste sonuçlarını görüntüleyin",
    "Kritik bulgular için açıklayıcı öneriler alın",
    "Tam rapor için Ücretsiz Değerlendirme'ye geçin",
  ],
  faq: [
    { q: "Domain güvenlik taraması ne kadar sürer?", a: "Tarama genellikle 20-30 saniye sürer. Sonuçlar anlık olarak güncellenir." },
    { q: "SPF kaydı nedir ve neden önemlidir?", a: "SPF (Sender Policy Framework), şirketiniz adına e-posta göndermeye yetkili sunucuları belirler. Olmadığı durumda saldırganlar sizin adresinizden e-posta gönderebilir." },
    { q: "DMARC olmadan ne olur?", a: "DMARC olmadan e-posta sahte gönderici adreslerinden geliyorsa mail sunucuları bunu anlayamaz. Müşterilerinize sahte faturalar veya oltalama mailleri gönderilebilir." },
    { q: "Kara listede görünmek ne anlama gelir?", a: "Kara listede olan domain'lerden gelen e-postalar spam kutusuna düşer veya engellenir. Bu, müşterilerinizin sizden gelecek maillerden haberdar olamaması anlamına gelir." },
    { q: "Tarama sonucu kritik bulgu çıktı ne yapmalıyım?", a: "Her bulgunun yanında açıklama ve çözüm önerisi sunulur. Daha kapsamlı analiz için Ücretsiz Mini Değerlendirmemizi başlatın." },
  ],
  relatedTools: [
    { slug: "ssl-kontrol",           label: "SSL Kontrol" },
    { slug: "dmarc-kontrol",         label: "DMARC Kontrol" },
    { slug: "dark-web-sorgulama",    label: "Dark Web Sorgu" },
  ],
  toolComponent: "DomainScanner",
};

export default function DomainGuvenlikTaramasi() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
