import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "ssl-kontrol",
  title: "Ücretsiz SSL Sertifika Kontrol Aracı",
  metaDescription: "Web sitenizin SSL sertifikası geçerli mi? Bitiş tarihi ne zaman? Ücretsiz kontrol edin.",
  h1: "SSL Sertifikanızı Ücretsiz Kontrol Edin",
  whatIsIt: "SSL (Secure Sockets Layer) sertifikası, web siteniz ile ziyaretçileriniz arasındaki iletişimi şifreleyen bir güvenlik protokolüdür. Geçerli bir SSL sertifikası olmadığında ziyaretçiler 'Güvenli Değil' uyarısı görür, arama motorlarında siteniz geri plana atılır ve müşteri güveni azalır. Bu araçla domain'inizin SSL durumunu, geçerlilik süresini ve olası sorunları saniyeler içinde kontrol edebilirsiniz.",
  howItWorks: [
    "Domain adresinizi alana girin (örnek: sirketiniz.com.tr)",
    "Kontrol Et butonuna basın",
    "SSL sertifikası geçerliliği, bitiş tarihi ve konfigürasyonu görüntüleyin",
    "Sorun varsa önerimizle düzeltme adımlarına bakın",
  ],
  faq: [
    { q: "SSL sertifikası neden önemlidir?", a: "SSL, site ziyaretçilerinin verilerini şifreleyerek korur. Olmadığı durumda Chrome ve diğer tarayıcılar siteyi 'güvenli değil' olarak işaretler, SEO skoru düşer ve müşteri güveni azalır." },
    { q: "SSL sertifikam kaç günde bir yenilenmelidir?", a: "Çoğu SSL sertifikası 1 yıl geçerlidir. Let's Encrypt ücretsiz sertifikaları her 90 günde bir yenilenir. Bitiş tarihinden en az 30 gün önce yenileme yapılmalıdır." },
    { q: "www ve www-siz domain için ayrı SSL gerekir mi?", a: "Wildcard veya multi-domain (SAN) sertifikalıysanız her ikisi de kapsanır. Standart sertifika sadece belirtilen domain'i korur." },
    { q: "SSL sertifikası ücretsiz olabilir mi?", a: "Evet. Let's Encrypt, ücretsiz ve açık kaynak SSL sertifikası sunar. Çoğu hosting sağlayıcısı bu sertifikayı otomatik kurabilir." },
    { q: "SSL skorum düşük çıktı ne yapmalıyım?", a: "Ücretsiz Mini Değerlendirmemizi başlatın. SSL dahil tüm güvenlik açıklarını raporluyoruz ve her biri için adım adım çözüm sunuyoruz." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "dmarc-kontrol",            label: "DMARC Kontrol" },
  ],
  toolComponent: "SSLChecker",
};

export default function SslKontrol() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
