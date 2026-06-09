import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "kvkk-ceza-hesaplayici",
  title: "KVKK Ceza Simülatörü — 2026 Güncel Para Cezası Hesaplama",
  metaDescription: "KVKK ihlalinde ne kadar ceza alabilirsiniz? 2026 güncel ceza skalasına göre şirket büyüklüğüne ve ihlalin türüne göre hesaplayın.",
  h1: "KVKK Ceza Riski Hesaplayıcı — 2026 Güncel",
  whatIsIt: "Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında şirketler, veri ihlali bildirmeme, DPA sözleşmesi imzalatmama veya VERBİS kaydı yaptırmama durumlarında para cezasıyla karşılaşabilir. Bu hesaplayıcı, şirketinizin büyüklüğüne ve tespit edilen ihlal türlerine göre tahmini ceza riskini gösterir. Gerçek ceza KVKK Kurulu takdirine göre değişebilir; bu araç yalnızca öğretici amaçlıdır.",
  howItWorks: [
    "Şirket büyüklüğünüzü seçin (çalışan sayısına göre)",
    "Tespit edilen veya şüphelendiğiniz ihlalleri işaretleyin",
    "Ceza Riskini Hesapla butonuna basın",
    "Tahmini para cezası tutarını görün",
    "Riski azaltmak için Ücretsiz KVKK Değerlendirmesini alın",
  ],
  faq: [
    { q: "KVKK cezaları ne kadar?", a: "2026 itibarıyla KVKK veri ihlali bildirmeme cezası küçük işletmeler için 94.688 TL, büyük işletmeler için 472.130 TL'ye kadar çıkabilir. Cezalar her yıl yeniden düzenlenmektedir." },
    { q: "VERBİS kaydı zorunlu mu?", a: "50'den fazla çalışanı olan veya yıllık 25 milyon TL'nin üzerinde cirosu olan şirketler için VERBİS kaydı zorunludur. Kaydolmamak cezaya yol açar." },
    { q: "DPA sözleşmesi nedir?", a: "DPA (Veri İşleme Anlaşması), verileri sizin adınıza işleyen üçüncü taraf şirketlerle imzalanması gereken bir sözleşmedir. Yoksa KVKK Madde 11 kapsamında ceza oluşabilir." },
    { q: "Ceza ödedikten sonra ihlal durumu düzelir mi?", a: "Hayır. Ceza ödenmesi ihlalin düzeltildiğini göstermez. İhlal devam ediyorsa yeni ceza döneminde tekrar ceza uygulanabilir." },
    { q: "KVKK uyumunu nasıl sağlayabilirim?", a: "CyberStep'in Ücretsiz Mini Değerlendirmesi, KVKK uyum durumunuzu analiz eder ve öncelikli adımları gösterir. 20 soruda tamamlanır." },
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
