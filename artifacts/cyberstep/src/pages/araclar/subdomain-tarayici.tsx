import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";

const config: ToolSeoConfig = {
  slug: "subdomain-tarayıcı",
  title: "Ücretsiz Subdomain Tarayıcı — Alt Alan Adı Keşfi",
  metaDescription: "Domain'inizin alt alan adlarını (subdomain) keşfedin. Gizli kalan, korunmasız sunucuları tespit edin. Ücretsiz, anında sonuç.",
  h1: "Subdomain Tarayıcı — Alt Alan Adı Keşfi",
  whatIsIt: "Subdomain taraması, bir şirketin ana domain'i altında kayıtlı tüm alt alan adlarını tespit etme işlemidir. Her subdomain aslında ayrı bir sunucu veya servis anlamına gelir: mail.sirketiniz.com, test.sirketiniz.com, vpn.sirketiniz.com gibi. Bu servislerin bir kısmı unutulmuş, yamalanmamış ya da güvenlik politikalarının dışında kalmış olabilir. Saldırganlar hedef seçmeden önce tam olarak bu keşif aşamasını yapar. Bu araç, crt.sh sertifika kayıtları ve DNS analizini kullanarak domain'inize ait tüm alt alan adlarını ortaya çıkarır; korunmasız olanlar \"Gölge IT\" riski oluşturur.",
  howItWorks: [
    "Domain adresinizi alana girin (örnek: sirketiniz.com.tr)",
    "Tara butonuna basın — sertifika kayıtları ve DNS verileri sorgulanır",
    "Tespit edilen subdomainlerin listesi ve güvenlik durumu görüntülenir",
    "WAF/CDN koruması olmayan, erişilebilir sunucular \"Yüksek Risk\" olarak işaretlenir",
    "Sonuçları CyberStep platformuna kaydederek izleme altına alabilirsiniz",
  ],
  faq: [
    { q: "Subdomain taraması neden önemlidir?", a: "Her subdomain, potansiyel bir saldırı yüzeyi oluşturur. Şirketler zamanla test ortamları, eski API'lar veya dış kaynak hizmetleri için subdomain açar; ancak bunların bir kısmını güvenli hale getirmeyi veya kapatmayı unutur. Subdomain taraması bu açıkları ortaya çıkarır." },
    { q: "Hangi subdomain'ler risk oluşturur?", a: "WAF veya CDN koruması olmadan doğrudan erişilebilir olanlar en yüksek riski taşır. Özellikle 'test', 'dev', 'staging', 'admin', 'vpn' gibi prefixli alt alan adları saldırıların ilk hedefi olur." },
    { q: "Subdomain takeover nedir?", a: "Bir subdomain DNS'te kayıtlıdır ancak işaret ettiği servis (ör. eski bir Heroku, GitHub Pages) silinmiştir. Saldırgan o servisi sahiplenerek sizin subdomain'iniz üzerinden phishing veya kötü amaçlı içerik yayabilir." },
    { q: "Bu tarama rakipler tarafından da yapılabilir mi?", a: "Evet. Sertifika şeffaflık kayıtları (crt.sh) herkese açıktır. Rakipleriniz veya saldırganlar bu veriyi kolayca elde edebilir. Bu nedenle siz de kendi subdomain envanterinizi düzenli olarak gözden geçirmelisiniz." },
    { q: "Subdomain sayısını azaltmak nasıl güvenliği artırır?", a: "Her aktif subdomain bakım, yama ve izleme gerektirir. Kullanılmayan alt alan adlarını DNS'ten kaldırmak, saldırı yüzeyini doğrudan küçültür ve güvenlik operasyon yükünü azaltır." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "ssl-kontrol",              label: "SSL Kontrol" },
    { slug: "dmarc-kontrol",            label: "DMARC Kontrol" },
  ],
  toolComponent: "SubdomainScanner",
};

export default function SubdomainTarayici() {
  return <ToolSeoPage config={config} />;
}
