import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "dmarc-kontrol",
  title: "Ücretsiz DMARC, SPF ve DKIM Kontrol Aracı",
  metaDescription: "Domain'inizin DMARC, SPF ve DKIM kayıtları doğru yapılandırılmış mı? E-posta sahteciliği korumanızı ücretsiz test edin.",
  h1: "DMARC, SPF ve DKIM Kontrol — Ücretsiz",
  whatIsIt: "DMARC, SPF ve DKIM; e-posta sahteciliği (spoofing) ve oltalama (phishing) saldırılarına karşı en etkili DNS tabanlı koruma mekanizmalarıdır. Bu üç kayıt doğru yapılandırılmadığı durumda saldırganlar şirketiniz adına sahte e-posta gönderebilir, müşterilerinizi veya çalışanlarınızı kandırabilir. Bu araç, domain'inizin e-posta güvenlik yapılandırmasını saniyeler içinde kontrol eder.",
  howItWorks: [
    "Domain adresinizi girin (e-posta adresinizin @ sonrasındaki kısım)",
    "DMARC Kontrol butonuna basın",
    "SPF, DKIM ve DMARC kayıtlarınızın varlığını ve geçerliliğini görüntüleyin",
    "Eksik veya hatalı kayıt varsa önerilen düzeltme adımlarını görün",
  ],
  faq: [
    { q: "DMARC nedir?", a: "DMARC (Domain-based Message Authentication, Reporting & Conformance), e-posta gönderisinin doğruluğunu garanti eden bir protokoldür. SPF ve DKIM ile birlikte çalışır ve sahte e-postaların müşteri inbox'ına ulaşmasını engeller." },
    { q: "SPF olmadan ne olur?", a: "SPF olmadan herhangi biri şirketinizin domain'inden e-posta gönderebilir. Bu durum, phishing saldırıları ve marka itibar kayıplarına yol açar." },
    { q: "DKIM kaydı nasıl eklenir?", a: "DKIM kaydı, e-posta servis sağlayıcınız (Google Workspace, Microsoft 365 vb.) tarafından size verilir ve DNS yöneticinize TXT kaydı olarak eklenir. Detaylı rehber için Yardım Merkezimizi ziyaret edin." },
    { q: "DMARC politikası 'none', 'quarantine' ve 'reject' arasındaki fark?", a: "None: Sadece izleme, engelleme yok. Quarantine: Sahte mailler spam kutusuna gider. Reject: Sahte mailler tamamen reddedilir. Başlangıç için 'none', olgunlaştıkça 'reject' politikası önerilir." },
    { q: "Konfigürasyonum yanlış çıkarsa ne yapmalıyım?", a: "Ücretsiz Mini Değerlendirmemizi başlatın. DNS kayıtlarınızın doğru yapılandırılması için adım adım rehberlik sunuyoruz." },
  ],
  relatedTools: [
    { slug: "ssl-kontrol",              label: "SSL Kontrol" },
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
  ],
  toolComponent: "DmarcChecker",
};

export default function DmarcKontrol() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
