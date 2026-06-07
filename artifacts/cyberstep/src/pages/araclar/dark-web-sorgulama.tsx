import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "dark-web-sorgulama",
  title: "Ucretsiz Dark Web Sizinti Sorgulama — Sirket Verileriniz Satista mi?",
  metaDescription: "Sirket e-postaniz veya domain'iniz dark web'de satisa sunulmus mu? Ucretsiz sorgulayın, veri sizintisi varsa aninda ogrenin.",
  h1: "Dark Web Sizinti Sorgulama — Ucretsiz",
  whatIsIt: "Dark web, yasadisi iceriklerin ve calinti verilerin alisverisinin yapildigi, normal tarayicilarla erisilemeyen internet katmanidir. Siber saldirganlar ele gecirdikleri kullanici adi, sifre ve kurumsal verileri dark web'de satisa cikarir. Bu arac, sirketinizin e-posta adresleri veya domain'inin bilinen veri ihlali veri tabanlariyla eslesip eslesmedigini sorgular. Sizinti erken tespit edildiginde hasari minimuma indirmek mumkundur.",
  howItWorks: [
    "Sorgulamak istediginiz e-posta veya domain adresini girin",
    "Sorgula butonuna basin",
    "Bilinen veri ihlali tablolariyla karsilastirilir",
    "Sizinti tespit edilirse hangi ihlalden kaynaklandigi gosterilir",
    "Onemsediginiz adresler icin surekli izleme aktif edin",
  ],
  faq: [
    { q: "Dark web sorgulamasi nasil calisir?", a: "Sorgu, Have I Been Pwned gibi bilinen veri ihlali veri tabanlari ve CyberStep'in kendi threat intelligence kaynaklariyla karsilastirilir. Gercek zamanli dark web izlemesi Premium planda mevcuttur." },
    { q: "Adresim bulunduysa ne yapmaliyim?", a: "Ilgili servislerinizdeki sifreleri hemen degistirin. 2FA (iki faktorlu dogrulama) aktif edin. Hangi verilerin sizdigini tespit icin CyberStep raporu alin." },
    { q: "Kurumsal e-postalar neden dark web'e duser?", a: "Calisanlarinizin kullandigi 3. parti servislerin (LinkedIn, Dropbox, Adobe vb.) veri ihlallerinde kurumsal e-postalar da ele gecirilir. Bu nedenle kurumsal ve kisisel sifre kullanimi kesinlikle ayrilmalidir." },
    { q: "Dark web izleme ile sorgulamasi arasindaki fark?", a: "Sorgu tek seferlik bir kontrol yapar. Izleme ise surekli tarayarak yeni sizintilar ortaya ciktiginda aninda bildirim gonderir. Izleme ozelligimiz Baslangic planinda mevcuttur." },
    { q: "Kac e-posta adresi sorgulanabilir?", a: "Ucretsiz sorgulama tek bir adres icin gecerlidir. Toplu kurumsal sorgulama ve surekli izleme icin Baslangic veya Buyume planina gecin." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "ssl-kontrol",             label: "SSL Kontrol" },
  ],
  toolComponent: "DarkWeb",
};

export default function DarkWebSorgulama() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
