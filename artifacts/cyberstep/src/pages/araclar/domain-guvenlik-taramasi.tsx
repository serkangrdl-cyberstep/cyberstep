import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "domain-guvenlik-taramasi",
  title: "Ucretsiz Domain Guvenlik Taramasi — SPF, DKIM, DMARC, SSL, Kara Liste",
  metaDescription: "Sirket domain'inizin guvenlik aciklari varmi? SPF, DKIM, DMARC, SSL ve kara liste kontrolü — ucretsiz, saniyeler icinde.",
  h1: "Domain Guvenlik Taramasi — Ucretsiz",
  whatIsIt: "Domain guvenlik taramasi, sirketinizin internet adresi (domain) uzerindeki tum guvenlik yapilandirimalarini analiz eder. E-posta sahteciligi (spoofing) korumalari olan SPF, DKIM ve DMARC kayitlarinizin dogru yapilandirilmis olup olmadigi, SSL sertifikanizin gecerliligi, domain'inizin uluslararasi kara listelerde gorunup gorunmedigini tek raporda gosterir. Bu analiz, siber saldirganlar sizden once zaafinizi tespit etmeden onleminizi almanizi saglar.",
  howItWorks: [
    "Sirket domain adresinizi girin (ornek: sirketim.com.tr)",
    "Tara butonuna basin — analiz 20-30 saniye surer",
    "SPF, DKIM, DMARC, SSL ve kara liste sonuclarini goruntuleyin",
    "Kritik bulgular icin aciklayici oneriler alin",
    "Tam rapor icin Ucretsiz Degerlendirme'ye gecin",
  ],
  faq: [
    { q: "Domain guvenlik taramasi ne kadar surer?", a: "Tarama genellikle 20-30 saniye surer. Sonuclar anlik olarak guncellenir." },
    { q: "SPF kaydi nedir ve neden onemlidir?", a: "SPF (Sender Policy Framework), sirketiniz adina e-posta gondermeye yetkili sunuculari belirler. Olmadigi durumda saldirganlar sizin adresinizden e-posta gonderebilir." },
    { q: "DMARC olmadan ne olur?", a: "DMARC olmadan e-posta sahte gondericilerden geliyorsa mail sunuculari bunu anlayamaz. Musterilerinize sahte faturalar veya oltalama mailleri gonderilebilir." },
    { q: "Kara listede gorunmek ne anlama gelir?", a: "Kara listede olan domain'lerden gelen e-postalar spam kutusuna duser veya engellenir. Bu, musterilerinizin sizden gelecek maillerden haberdar olamamasi anlamina gelir." },
    { q: "Tarama sonucu kritik bulgu cikti ne yapmaliyim?", a: "Her bulgunun yaninda aciklama ve cozum onerisi sunulur. Daha kapsamli analiz icin Ucretsiz Mini Degerlendirmemizi baslatin." },
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
