import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";

const config: ToolSeoConfig = {
  slug: "siber-risk-roi",
  title: "Siber Guvenlik Yatirim ROI Hesaplayici — 2026",
  metaDescription: "Siber guvenlige yapilan yatirimin geri donusu nedir? Sektor ve sirket buyuklugune gore beklenen tasarruf ve kurtarilan maliyet hesaplayin.",
  h1: "Siber Guvenlik ROI Hesaplayici",
  whatIsIt: "Siber guvenlik harcamalari cogu zaman 'maliyet' olarak gorulur. Ancak dogru yaklasimda bu bir yatirimdir. Ortalama bir KOBi siber saldirisi 2.3 milyon TL'nin uzerinde maliyet yaratir (is durma, itibar hasari, KVKK cezasi, dava vb.). Bu hesaplayici, sektorunuze ve sirket buyuklugune gore beklenen risk maliyetini, guvenlik yatiriminizin kurtaracagi tutari ve geri donus suresini hesaplar.",
  howItWorks: [
    "Sektorunuzu ve calisanlar sayisini secin",
    "Mevcut guvenlik harcamanizi girin (aylik veya yillik)",
    "CyberStep hizmeti eklendigi senaryoyla karsilastirma goruntuleyin",
    "Beklenen ROI, kurtarilan risk maliyeti ve geri donus suresini goruntuleyin",
  ],
  faq: [
    { q: "Siber saldiri ortalama ne kadara mal olur?", a: "IBM ve Verizon 2025 veri ihlali raporlarina gore kucuk ve orta olcekli isletmelerde ortalama veri ihlali maliyeti 3-5 milyon TL arasindadir. Is durma, itibar hasari ve KVKK cezalari dahildir." },
    { q: "ROI hesaplamasina ne dahil edilir?", a: "Hesaplamaya veri ihlali olasıligi, ortalama ihlal maliyeti, KVKK ceza riski, is durma suresi maliyeti ve guvenlik yatirim maliyeti dahil edilir." },
    { q: "Siber sigortam varsa ROI hesaplamasi degisir mi?", a: "Evet. Siber sigorta prim maliyetleri ve karsilanan hasar limitleri goz onune alindiginda, guvenlik yatirimi yapmanin sigorta maliyet tasarrufu uzerine ek getiri sagladigi gorulur." },
    { q: "Hangı sektorler en yuksek risk altinda?", a: "Salik, finans ve perakende sektorleri en yuksek veri ihlali olasıligina sahiptir. Buna karsilik bilisim ve imalat sektoru altyapi saldirilarindan daha fazla etkilenir." },
    { q: "Bu hesaplama ne kadar dogru?", a: "Hesaplama, sektör benchmark verilerine dayanan bir simulasyondur; gercek sonuclar farkli olabilir. Sirketinize ozel analiz icin Ucretsiz Mini Degerlendirme baslatın." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "kvkk-ceza-hesaplayici",   label: "KVKK Ceza Sim." },
  ],
  toolComponent: "RoiCalc",
};

export default function SiberRiskRoi() {
  return <ToolSeoPage config={config} />;
}
