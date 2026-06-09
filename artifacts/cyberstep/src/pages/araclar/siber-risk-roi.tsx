import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "siber-risk-roi",
  title: "Siber Güvenlik Yatırım ROI Hesaplayıcı — 2026",
  metaDescription: "Siber güvenliğe yapılan yatırımın geri dönüşü nedir? Sektör ve şirket büyüklüğüne göre beklenen tasarruf ve kurtarılan maliyet hesaplayın.",
  h1: "Siber Güvenlik ROI Hesaplayıcı",
  whatIsIt: "Siber güvenlik harcamaları çoğu zaman 'maliyet' olarak görülür. Ancak doğru yaklaşımda bu bir yatırımdır. Ortalama bir KOBİ siber saldırısı 2.3 milyon TL'nin üzerinde maliyet yaratır (iş durma, itibar hasarı, KVKK cezası, dava vb.). Bu hesaplayıcı, sektörünüze ve şirket büyüklüğünüze göre beklenen risk maliyetini, güvenlik yatırımınızın kurtaracağı tutarı ve geri dönüş süresini hesaplar.",
  howItWorks: [
    "Sektörünüzü ve çalışan sayısını seçin",
    "Mevcut güvenlik harcamanızı girin (aylık veya yıllık)",
    "CyberStep hizmeti eklendiği senaryoyla karşılaştırma görüntüleyin",
    "Beklenen ROI, kurtarılan risk maliyeti ve geri dönüş süresini görüntüleyin",
  ],
  faq: [
    { q: "Siber saldırı ortalama ne kadara mal olur?", a: "IBM ve Verizon 2025 veri ihlali raporlarına göre küçük ve orta ölçekli işletmelerde ortalama veri ihlali maliyeti 3-5 milyon TL arasındadır. İş durma, itibar hasarı ve KVKK cezaları dahildir." },
    { q: "ROI hesaplamasına ne dahil edilir?", a: "Hesaplamaya veri ihlali olasılığı, ortalama ihlal maliyeti, KVKK ceza riski, iş durma süresi maliyeti ve güvenlik yatırım maliyeti dahil edilir." },
    { q: "Siber sigortam varsa ROI hesaplaması değişir mi?", a: "Evet. Siber sigorta prim maliyetleri ve karşılanan hasar limitleri göz önüne alındığında, güvenlik yatırımı yapmanın sigorta maliyet tasarrufu üzerine ek getiri sağladığı görülür." },
    { q: "Hangi sektörler en yüksek risk altında?", a: "Sağlık, finans ve perakende sektörleri en yüksek veri ihlali olasılığına sahiptir. Buna karşılık bilişim ve imalat sektörü altyapı saldırılarından daha fazla etkilenir." },
    { q: "Bu hesaplama ne kadar doğru?", a: "Hesaplama, sektör benchmark verilerine dayanan bir simülasyondur; gerçek sonuçlar farklı olabilir. Şirketinize özel analiz için Ücretsiz Mini Değerlendirme başlatın." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "kvkk-ceza-hesaplayici",   label: "KVKK Ceza Sim." },
  ],
  toolComponent: "RoiCalc",
};

export default function SiberRiskRoi() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
