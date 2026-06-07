import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "kvkk-ceza-hesaplayici",
  title: "KVKK Ceza Simulatoru — 2026 Guncel Para Cezasi Hesaplama",
  metaDescription: "KVKK ihlalinde ne kadar ceza alabilirsiniz? 2026 guncel ceza skalasina gore sirket buyuklugune ve ihlalin turune gore hesaplayin.",
  h1: "KVKK Ceza Riski Hesaplayici — 2026 Guncel",
  whatIsIt: "Kisisel Verilerin Korunmasi Kanunu (KVKK) kapsaminda sirketler, veri ihlali bildirmeme, DPA sozlesmesi imzalatmama veya VERBIS kaydi yaptirmama durumlarinda para cezasiyla karsilasabilir. Bu hesaplayici, sirketinizin buyuklugune ve tespit edilen ihlal turlere gore tahmini ceza riskini gosterir. Reel ceza KVKK Kurulu takdirine gore degisebilir; bu arac yalnizca ogretici amaclidir.",
  howItWorks: [
    "Sirket buyuklugunuzu seciniz (calisanlar sayisina gore)",
    "Tespit edilen veya saniginiz ihlalleri isaretleyin",
    "Ceza Riskini Hesapla butonuna basin",
    "Tahmini para cezasi tutarini gorun",
    "Riski azaltmak icin Ucretsiz KVKK Degerlendirmesini alin",
  ],
  faq: [
    { q: "KVKK cezalari ne kadar?", a: "2026 itibariyle KVKK veri ihlali bildirmeme cezasi kucuk isletmeler icin 94.688 TL, buyuk isletmeler icin 472.130 TL'ye kadar cikabilir. Cezalar her yil yeniden duzenlenmektedir." },
    { q: "VERBIS kaydi zorunlu mu?", a: "50'den fazla calisani olan veya yillik 25 milyon TL'nin uzerinde cirosu olan sirketler icin VERBIS kaydi zorunludur. Kaydolmamak cezaya yol acar." },
    { q: "DPA sozlesmesi nedir?", a: "DPA (Veri Isleme Anlasmas), verileri sizin adina isleyen uc taraf sirketlerle imzalanmasi gereken bir sozlesmedir. Yoksa KVKK Madde 11 kapsaminda ceza olusabilir." },
    { q: "Ceza odedikten sonra ihlal durumu duzelir mi?", a: "Hayir. Ceza odenmesi ihlalin duzeltildigini gostermez. Ihlal devam ediyorsa yeni ceza doneminde tekrar ceza uygulanabilir." },
    { q: "KVKK uyumunu nasil saglayabilirim?", a: "CyberStep'in Ucretsiz Mini Degerlendirmesi, KVKK uyum durumunuzu analiz eder ve oncelikli adimlari gosterir. 20 soruda tamamlanir." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
  ],
  toolComponent: "KVKKPenalty",
};

export default function KvkkCezaHesaplayici() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
