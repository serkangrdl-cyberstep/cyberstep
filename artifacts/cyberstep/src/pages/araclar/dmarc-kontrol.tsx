import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "dmarc-kontrol",
  title: "Ucretsiz DMARC, SPF ve DKIM Kontrol Araci",
  metaDescription: "Domain'inizin DMARC, SPF ve DKIM kayitlari dogru yapilandirilmis mi? E-posta sahteciligi korumanizi ucretsiz test edin.",
  h1: "DMARC, SPF ve DKIM Kontrol — Ucretsiz",
  whatIsIt: "DMARC, SPF ve DKIM; e-posta sahteciligi (spoofing) ve oltalama (phishing) saldirilarina karsi en etkili DNS tabanli koruma mekanizmalaridir. Bu uc kayit dogru yapilandirilmadigi durumda saldirganlar sirketiniz adina sahte e-posta gonderebilir, musterilerinizi veya calisanlarinizi kandirabilir. Bu arac, domain'inizin e-posta guvenlik yapilanirmasini saniyeler icinde kontrol eder.",
  howItWorks: [
    "Domain adresinizi girin (e-posta adresinizin @ sonrasindaki kisim)",
    "DMARC Kontrol butonuna basin",
    "SPF, DKIM ve DMARC kayitlarinizin varligini ve gecerliligini goruntuleyin",
    "Eksik veya hatali kayit varsa onerilen duzeltme adimlarini gorun",
  ],
  faq: [
    { q: "DMARC nedir?", a: "DMARC (Domain-based Message Authentication, Reporting & Conformance), e-posta gondericisinin dogrulugunu garanti eden bir protokoldur. SPF ve DKIM ile birlikte calisir ve sahte e-postalarin musteri inboxina ulasmasini engeller." },
    { q: "SPF olmadan ne olur?", a: "SPF olmadan herhangi biri sirketinizin domain'inden e-posta gonderebilir. Bu durum, phishing saldirilari ve marka itibar kayiplarina yol acar." },
    { q: "DKIM kaydi nasil eklenir?", a: "DKIM kaydi, e-posta servis saglayiciniz (Google Workspace, Microsoft 365 vb.) tarafindan size verilir ve DNS yoneticinize TXT kaydi olarak eklenir. Detayli rehber icin Yardim Merkezimizi ziyaret edin." },
    { q: "DMARC politikasi 'none', 'quarantine' ve 'reject' arasindaki fark?", a: "None: Sadece izleme, engelleme yok. Quarantine: Sahte mailler spam kutusuna gider. Reject: Sahte mailler tamamen reddedilir. Baslangic icin 'none', olgunlastikca 'reject' politikasi onerilir." },
    { q: "Konfigurasyonum yanlis cikarsa ne yapmaliyim?", a: "Ucretsiz Mini Degerlendirmemizi baslatin. DNS kayitlarinizin dogru yapilandirilmasi icin adim adim rehberlik sunuyoruz." },
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
