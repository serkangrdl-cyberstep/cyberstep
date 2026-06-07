import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "ssl-kontrol",
  title: "Ucretsiz SSL Sertifika Kontrol Araci",
  metaDescription: "Web sitenizin SSL sertifikasi gecerli mi? Bitis tarihi ne zaman? Ucretsiz kontrol edin.",
  h1: "SSL Sertifikanizi Ucretsiz Kontrol Edin",
  whatIsIt: "SSL (Secure Sockets Layer) sertifikasi, web siteniz ile ziyaretcileriniz arasindaki iletisimi sifreleyen bir guvenlik protokolüdür. Gecerli bir SSL sertifikasi olmadiginda ziyaretciler 'Guvenli Degil' uyarisi gorür, arama motorlarinda siteniz geri plana atilir ve musteri guveni azalir. Bu aracla domain'inizin SSL durumunu, gecerlilik suresini ve olasi sorunlari saniyeler icinde kontrol edebilirsiniz.",
  howItWorks: [
    "Domain adresinizi alana girin (ornek: sirketiniz.com.tr)",
    "Kontrol Et butonuna basin",
    "SSL sertifikasi gecerliligi, bitis tarihi ve konfigurasyonu goruntuleyin",
    "Sorun varsa onerimizle duzeltme adimlarina bakin",
  ],
  faq: [
    { q: "SSL sertifikasi neden onemlidir?", a: "SSL, site ziyaretcilerinin verilerini sifrelayerek korur. Olmadigi durumda Chrome ve diger tarayicilar siteyi 'guvenli degil' olarak isaretler, SEO skoru duser ve musteri guveni azalir." },
    { q: "SSL sertifikam kac günde bir yenilenmelidir?", a: "Cogu SSL sertifikasi 1 yil gecerlidir. Let's Encrypt ucretsiz sertifikalari her 90 günde bir yenilenir. Bitis tarihinden en az 30 gün once yenileme yapilmalidir." },
    { q: "www ve www-siz domain icin ayri SSL gerekir mi?", a: "Wildcard veya multi-domain (SAN) sertifikali iseniz her ikisi de kapsanir. Standart sertifika sadece belirtilen domain'i korur." },
    { q: "SSL sertifikasi ucretsiz olabilir mi?", a: "Evet. Let's Encrypt, ucretsiz ve acik kaynak SSL sertifikasi sunar. Cogu hosting saglayicisi bu sertifikayi otomatik kurabilir." },
    { q: "SSL skorum dusuk cikti ne yapmaliyim?", a: "Ucretsiz Mini Degerlendirmemizi baslatin. SSL dahil tum guvenlik aciklarini raporluyoruz ve her biri icin adim adim cozum sunuyoruz." },
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
