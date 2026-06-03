import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle2, XCircle, ChevronRight, Shield, Users, Clock, Award, UserCheck, Eye, FileText, Zap, Network, Globe, ScrollText, Building2, Activity, Server, Search, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRICING_PLANS } from "@/lib/constants";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery } from "@tanstack/react-query";

interface DbPlan { id: number; slug: string; name: string; price: string; currency: string; isActive: boolean; }

interface ServiceCatalogItem {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  features: string[];
  monthlyPriceTl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  Network, Globe, FileText, Building2, ScrollText, Activity, Server, Shield,
};

const ENTERPRISE_SLUGS = ["fortinet-fabric","dns-izleme","ct-log-izleme","microsoft-365","kvkk-bildirim","servicenow","soc-operasyon","observability"];

const ENTERPRISE_SERVICES_DATA = [
  {
    slug: "fortinet-fabric",
    icon: Network,
    category: "soc",
    label: "Fortinet Security Fabric",
    desc: "FortiGate, FortiAnalyzer ve FortiSIEM entegrasyonuyla ağınızdaki tehditleri gerçek zamanlı izleyin ve otomatik bloklama yapın.",
    features: ["Gerçek zamanlı olay korelasyonu", "Otomatik tehdit bloklama", "SOC analist triage desteği"],
    price: "4.990",
  },
  {
    slug: "dns-izleme",
    icon: Globe,
    category: "monitoring",
    label: "DNS İzleme",
    desc: "Alan adlarınızdaki değişiklikleri 5 dakikada bir denetleyin; yetkisiz subdomain, NS veya MX değişikliklerinde anında uyarı alın.",
    features: ["5 dakikada bir otomatik tarama", "Subdomain, NS, MX takibi", "E-posta ve WhatsApp uyarısı"],
    price: "990",
  },
  {
    slug: "ct-log-izleme",
    icon: ScrollText,
    category: "monitoring",
    label: "CT Log İzleme",
    desc: "Alan adınız için dünyada verilen tüm SSL sertifikalarını izleyin; sahte sertifika tespitinde anında bildirim alın.",
    features: ["crt.sh entegrasyonu", "Sahte sertifika tespiti", "Anlık uyarı sistemi"],
    price: "490",
  },
  {
    slug: "microsoft-365",
    icon: Building2,
    category: "monitoring",
    label: "Microsoft 365 Entegrasyonu",
    desc: "Azure AD riskli giriş olaylarını, şüpheli kullanıcı aktivitelerini ve lisans değişikliklerini otomatik olarak izleyin.",
    features: ["Azure AD OAuth bağlantısı", "Riskli giriş korelasyonu", "Kullanıcı risk skoru izleme"],
    price: "1.490",
  },
  {
    slug: "kvkk-bildirim",
    icon: FileText,
    category: "compliance",
    label: "KVKK Bildirim Sistemi",
    desc: "Veri ihlali olaylarını KVKK'nın gerektirdiği 72 saat içinde Kurul'a bildirmek için hazır süreç ve dokümantasyon.",
    features: ["72 saatlik bildirim sürecini otomatize edin", "Hazır bildirim şablonları", "Olay kaydı ve delil zinciri"],
    price: "1.990",
  },
  {
    slug: "servicenow",
    icon: Activity,
    category: "itsm",
    label: "ServiceNow Entegrasyonu",
    desc: "SOC vakalarını ServiceNow incident'larıyla çift yönlü senkronize edin. HMAC-SHA256 imzalı webhook ile güvenli entegrasyon.",
    features: ["Çift yönlü vaka senkronizasyonu", "HMAC-SHA256 güvenli webhook", "SLA ihlali uyarısı"],
    price: "2.490",
  },
  {
    slug: "soc-operasyon",
    icon: Shield,
    category: "soc",
    label: "SOC Operasyon Merkezi",
    desc: "7/24 güvenlik operasyonları; triage, playbook yönetimi, eskalasyon ve olay müdahale desteği.",
    features: ["7/24 triage ve eskalasyon", "Hazır playbook kütüphanesi", "Aylık SOC raporu"],
    price: "9.990",
  },
  {
    slug: "observability",
    icon: Server,
    category: "monitoring",
    label: "Observability & SIEM",
    desc: "Log kaynaklarınızı merkezi bir noktada toplayın; anomali tespiti ve öngörülü uyarılarla güvenlik görünürlüğünüzü artırın.",
    features: ["Çoklu log kaynağı bağlantısı", "AI destekli anomali tespiti", "Gerçek zamanlı dashboard"],
    price: "2.990",
  },
];

function fmtTL(price: string | undefined): string {
  const n = parseFloat(price ?? "0");
  if (!n) return "";
  return new Intl.NumberFormat("tr-TR").format(n) + " TL + KDV";
}

const TRUST_ITEMS = [
  { icon: Shield, text: "256-bit SSL şifreli güvenli ödeme" },
  { icon: Users, text: "500+ şirket tarafından tercih edildi" },
  { icon: Clock, text: "Tam Değerlendirme'de uzman doğrulaması dahil" },
  { icon: Award, text: "KVKK uyumlu veri işleme" },
];

type CompRow =
  | { header: true; label: string }
  | { header?: false; label: string; mini: string | boolean; full: string | boolean };

const COMPARISON_ROWS: CompRow[] = [
  { header: true, label: "Değerlendirme" },
  { label: "Soru sayısı", mini: "20", full: "60" },
  { label: "Güvenlik alanı", mini: "5", full: "10" },
  { label: "Anlık risk skoru ve kırmızı alarm", mini: true, full: true },
  { label: "Yapay zeka raporu", mini: "Temel", full: "Detaylı" },
  { label: "Sektörel karşılaştırma", mini: false, full: true },
  { label: "PDF rapor indirme", mini: false, full: true },
  { label: "Detaylı öncelikli aksiyon planı", mini: false, full: true },
  { label: "Birebir uzman görüşmesi (1 saat)", mini: false, full: true },
  { label: "30 günlük otomatik yeniden tarama", mini: false, full: true },
  { header: true, label: "Alan Adı Tarama" },
  { label: "SPF / DMARC / DKIM / MX / SSL", mini: true, full: true },
  { label: "HIBP veri sızıntısı kontrolü", mini: true, full: true },
  { label: "Kara liste ve Shadow IT tespiti", mini: true, full: true },
  { label: "HTTP güvenlik başlıkları analizi", mini: false, full: true },
  { label: "URLhaus zararlı URL kontrolü", mini: false, full: true },
  { label: "USOM kara liste domain taraması", mini: false, full: true },
  { label: "crt.sh Alt Alan Şeffaflığı (subdomain)", mini: false, full: true },
  { label: "NIST NVD CVE güvenlik açığı taraması", mini: false, full: true },
  { label: "VirusTotal domain reputation taraması", mini: false, full: true },
  { label: "AbuseIPDB IP kötüye kullanım geçmişi", mini: false, full: true },
  { label: "Shodan internet maruziyet taraması", mini: false, full: "Ücretli" },
  { header: true, label: "Uyumluluk" },
  { label: "KVKK Madde 12 Teknik Tedbir Haritası", mini: false, full: true },
  { label: "NIST CSF 2.0 Uyum Seviyesi", mini: false, full: true },
  { header: true, label: "Ücretsiz Güvenlik Araçları (Tüm Paketlerde)" },
  { label: "Karanlık Web Sızıntı İzleyici", mini: true, full: true },
  { label: "KVKK VERBİS Yükümlülük Kontrolü", mini: true, full: true },
  { label: "KVKK İdari Ceza Simülatörü", mini: true, full: true },
  { label: "Microsoft 365 Güvenlik Denetim Listesi", mini: true, full: true },
  { label: "Siber Sigorta Prim Hesaplayıcı", mini: true, full: true },
  { label: "KEP İhtiyaç Değerlendirmesi", mini: true, full: true },
  { label: "ERP Güvenlik Tarama Listesi", mini: true, full: true },
  { label: "Sektörel Siber Güvenlik Kıyaslama", mini: true, full: true },
  { label: "Phishing E-posta Farkındalık Testi", mini: true, full: true },
  { label: "Alan Adı Güvenlik Hızlı Tarama", mini: true, full: true },
];

export default function Pricing() {
  usePageMeta({
    title: "Fiyatlar | CyberStep.io",
    description: "KOBİ'ler icin siber guvenlik degerlendirme paketleri. Ucretsiz Mini Degerlendirme ile baslayin, tam analizle buyumeye devam edin.",
    keywords: "siber güvenlik fiyatları, güvenlik değerlendirmesi fiyat, KVKK uyum fiyat, SOC hizmet fiyatı",
    canonicalPath: "/fiyatlar",
  });

  // Service + Offer JSON-LD — Google zengin sonuçlar ve fiyat kartları için
  useEffect(() => {
    const id = "ld-json-service";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "CyberStep Siber Güvenlik Değerlendirmesi",
      "provider": {
        "@type": "Organization",
        "name": "CyberStep.io",
        "url": "https://cyberstep.io",
      },
      "offers": [
        {
          "@type": "Offer",
          "name": "Mini Değerlendirme",
          "price": "0",
          "priceCurrency": "TRY",
          "description": "20 soruluk ücretsiz siber güvenlik risk değerlendirmesi",
          "url": "https://cyberstep.io/degerlendirme",
        },
        {
          "@type": "Offer",
          "name": "Tam Değerlendirme",
          "price": "5990",
          "priceCurrency": "TRY",
          "description": "60 soruluk kapsamlı güvenlik değerlendirmesi, sektör karşılaştırması ve uzman danışmanlık",
          "url": "https://cyberstep.io/fiyatlar",
        },
      ],
      "areaServed": "TR",
      "availableLanguage": "Turkish",
    });
    return () => { el?.remove(); };
  }, []);

  const { data: serviceCatalog = [] } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["public-service-catalog"],
    queryFn: () => fetch("/api/public/service-catalog").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dbPlansRaw } = useQuery<DbPlan[]>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const dbPlans = Array.isArray(dbPlansRaw) ? dbPlansRaw : [];
  const fullDbPlan = dbPlans.find(p => p.slug === "full");
  const fullPriceLabel = fullDbPlan ? fmtTL(fullDbPlan.price) : PRICING_PLANS[1].priceLabel;

  const plans = PRICING_PLANS.map(p =>
    p.id === "full" && fullDbPlan
      ? { ...p, priceLabel: fullPriceLabel }
      : p
  );

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <section className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">Fiyatlandırma</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">Şeffaf ve Adil Fiyatlar</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Mini değerlendirme tamamen ücretsiz. Daha derin bir analiz için Tam Değerlendirme paketi tek seferlik ödemedir.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* KVKK maliyet karşılaştırma */}
          <div className="max-w-4xl mx-auto mb-8 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/50 p-5">
            <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Neden değer?</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center">
              <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border p-4 shadow-sm">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">KVKK minimum idari ceza</p>
                <p className="text-3xl font-bold text-amber-600">94.000 TL</p>
                <p className="text-xs text-muted-foreground mt-1">yıllık yeniden değerleme oranıyla artıyor</p>
              </div>
              <div className="text-xl font-bold text-muted-foreground">↔</div>
              <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border p-4 shadow-sm">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Tam Değerlendirme</p>
                <p className="text-3xl font-bold text-primary">{fullPriceLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">tek seferlik ödeme</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 flex flex-col gap-6 shadow-sm ${
                  plan.highlight
                    ? "border-primary/50 bg-primary/5 shadow-primary/10 shadow-md"
                    : "bg-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-4xl font-bold text-primary">{plan.priceLabel}</span>
                    {"priceSuffix" in plan && plan.priceSuffix && (
                      <span className="text-sm text-muted-foreground mb-1">{plan.priceSuffix}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="font-bold text-primary">{plan.questionCount}</span>
                    <span className="text-muted-foreground">soru</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="font-bold text-primary">{plan.domainCount}</span>
                    <span className="text-muted-foreground">alan</span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`inline-flex items-center justify-center rounded-md text-sm font-semibold h-12 px-6 transition-colors ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-2 border-primary text-primary hover:bg-primary/10"
                  }`}
                >
                  {plan.cta}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">Detaylı Karşılaştırma</h2>
          <div className="rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground w-1/2">Özellik</th>
                  <th className="text-center px-6 py-4 font-semibold">Mini</th>
                  <th className="text-center px-6 py-4 font-semibold text-primary">Tam</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) =>
                  row.header ? (
                    <tr key={row.label}>
                      <td colSpan={3} className="px-6 py-2.5 text-xs font-bold text-primary uppercase tracking-wider bg-primary/5 border-b">
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.label} className={`border-b last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      <td className="px-6 py-3.5 font-medium">{row.label}</td>
                      <td className="px-6 py-3.5 text-center">
                        {typeof row.mini === "boolean" ? (
                          row.mini
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            : <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className="font-semibold">{row.mini}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {typeof row.full === "boolean" ? (
                          row.full
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            : <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className="font-bold text-primary">{row.full}</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* AI Güvenlik Servisleri */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-3">Yeni</Badge>
            <h2 className="text-2xl font-bold mb-2">AI Güvenlik Servisleri</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Yapay zeka araçlarının yayılmasıyla birlikte yeni uyum yükümlülükleri doğuyor. Politikanızı güncel tutun, araçlarınızı izleyin, saldırıları önceden görün.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {/* AI Politika */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">AI Politika Otogüncelleme</p>
                <p className="text-sm text-muted-foreground leading-relaxed">KVKK uyumlu yapay zeka kullanım politikası — her çeyrek otomatik güncellenir, PDF + Word indirme.</p>
              </div>
              <ul className="space-y-1.5">
                {["Şirkete özel AI politikası", "4 çeyreklik otomatik güncelleme", "Araç değişikliğinde tetikleme", "Onay ve versiyon takibi"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">990 TL <span className="text-sm font-normal text-muted-foreground">/ yıl + KDV</span></p>
                <Link href="/ai-politika" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Politikamı Oluştur <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>

            {/* AI Araç İzleme */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">AI Araç İzleme</p>
                <p className="text-sm text-muted-foreground leading-relaxed">ChatGPT, Gemini, Copilot gizlilik politikası değişince anında e-posta bildirimi alın.</p>
              </div>
              <ul className="space-y-1.5">
                {["20+ AI aracı haftalık kontrol", "Kritik değişikliklerde anında uyarı", "KVKK uyum puanı güncelleme", "Özelleştirilebilir bildirim seviyesi"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">490 TL <span className="text-sm font-normal text-muted-foreground">/ ay + KDV</span></p>
                <Link href="/ai-arac-izleme" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  İzlemeyi Başlat <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>

            {/* AI Phishing */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">AI Phishing Simülasyonu</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Saldırganların şirketinize yönelik hazırlayacağı AI destekli e-postayı önce siz görün. Tek seferlik.</p>
              </div>
              <ul className="space-y-1.5">
                {["Kamuya açık veri OSINT analizi", "3 gerçekçi saldırı senaryosu", "Her senaryo için koruma yöntemi", "SPF / DMARC açık tespiti"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">1.990 TL <span className="text-sm font-normal text-muted-foreground">· tek seferlik + KDV</span></p>
                <Link href="/ai-phishing-simulasyonu" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Simülasyonu Başlat <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Bundle card */}
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/8 to-primary/3 p-7">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-lg font-bold">AI Koruma Paketi</h3>
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">%32 Tasarruf</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">AI Güvenlik Değerlendirmesi + AI Araç İzleme (12 ay) + AI Politika Otogüncelleme — üç AI güvenlik servisini birlikte alın.</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="line-through text-muted-foreground">9.770 TL + KDV</span>
                  <span className="text-2xl font-bold text-primary">9.990 TL</span>
                  <span className="text-muted-foreground">/ yıl + KDV</span>
                </div>
              </div>
              <Link href="/iletisim" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shrink-0">
                Paket Teklifi Al <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Kurumsal Güvenlik Servisleri */}
      <section id="kurumsal-servisler" className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-3">Kurumsal</Badge>
            <h2 className="text-2xl font-bold mb-2">Kurumsal Güvenlik Servisleri</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Fortinet, Microsoft 365, DNS ve KVKK gibi entegrasyonları aylık abonelikle aktive edin. Her servis ayrı satın alınabilir.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Render from DB catalog; fallback to static icons only */}
            {((): ServiceCatalogItem[] => {
              const fromDb = (serviceCatalog as ServiceCatalogItem[]).filter(s => ENTERPRISE_SLUGS.includes(s.slug));
              if (fromDb.length > 0) return fromDb;
              return ENTERPRISE_SERVICES_DATA.map(s => ({ slug: s.slug, label: s.label, shortDescription: s.desc, features: s.features, monthlyPriceTl: s.price.replace(".", ""), icon: s.slug, isActive: true } as unknown as ServiceCatalogItem));
            })().map((svc) => {
              const Icon = SERVICE_ICONS[svc.icon] ?? SERVICE_ICONS[ENTERPRISE_SERVICES_DATA.find(s => s.slug === svc.slug)?.slug ?? ""] ?? Shield;
              const price = new Intl.NumberFormat("tr-TR").format(Number(svc.monthlyPriceTl));
              const features: string[] = Array.isArray(svc.features) ? svc.features.slice(0, 3) : (ENTERPRISE_SERVICES_DATA.find(s => s.slug === svc.slug)?.features ?? []);
              return (
                <div key={svc.slug} className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{svc.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{svc.shortDescription}</p>
                  </div>
                  <ul className="space-y-1 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t">
                    <p className="text-base font-bold text-primary mb-2">{price} TL <span className="text-xs font-normal text-muted-foreground">/ ay + KDV</span></p>
                    <Link href={`/servisler/${svc.slug}`} className="block w-full text-center text-xs bg-primary text-primary-foreground py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                      İncele
                    </Link>
                  </div>
                </div>
              );
            })}
            {/* Yakında: Dark Web İzleme */}
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full tracking-wide">Yakında</span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1 text-foreground/70">Dark Web İzleme</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kimlik bilgisi sızıntıları ve dark web forum takibi
                </p>
              </div>
              <ul className="space-y-1 flex-1">
                {["Credential leak tespiti","Dark web forum izleme","Anlık e-posta uyarısı"].map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                <p className="text-xs text-muted-foreground mb-2">2026 Q4 yol haritasında</p>
                <Link href="/roadmap" className="block w-full text-center text-xs border border-muted-foreground/30 text-muted-foreground py-1.5 rounded-lg font-medium hover:bg-muted/50 transition-colors">
                  Erken Erişim Listesi
                </Link>
              </div>
            </div>

            {/* Yakında: APT Grup İzleme */}
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full tracking-wide">Yakında</span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Crosshair className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1 text-foreground/70">APT Grup İzleme</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Türkiye'yi hedefleyen tehdit aktörü profilleri ve TTPs analizi
                </p>
              </div>
              <ul className="space-y-1 flex-1">
                {["Türkiye odaklı APT profilleri","MITRE ATT&CK TTP haritası","Sektörel hedefleme uyarısı"].map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                <p className="text-xs text-muted-foreground mb-2">2026 Q4 yol haritasında</p>
                <Link href="/roadmap" className="block w-full text-center text-xs border border-muted-foreground/30 text-muted-foreground py-1.5 rounded-lg font-medium hover:bg-muted/50 transition-colors">
                  Erken Erişim Listesi
                </Link>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Her servis için ayrıntılı bilgi almak isterseniz{" "}
            <Link href="/iletisim" className="text-primary hover:underline">bizimle iletişime geçin</Link>.
          </p>
        </div>
      </section>

      {/* CISO Asistan upsell card */}
      <section className="pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <UserCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground">CISO Asistan Paketi</h3>
                <span className="text-xs font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">Otomasyon</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                CISO'nuzun rutin raporlama yükünü üstleniyoruz. Aylık yönetim kurulu raporu, haftalık tehdit özeti,
                7545 ve KVKK uyum skoru, 7 güvenlik politikası şablonu — <strong className="text-foreground">2.500 TL/ay + KDV</strong>.
              </p>
            </div>
            <Link
              href="/ciso-asistan-paketi"
              className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
            >
              Paketi İncele <ChevronRight className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* vCISO Yakında 2027 card */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <UserCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-foreground/70">Sanal CISO Hizmeti</h3>
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full tracking-wide">Yakında</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sertifikalı partner CISO'lardan aylık görüşme, güvenlik stratejisi ve olay müdahalesi koordinasyonu. 2027 yol haritasında.
              </p>
            </div>
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center rounded-xl text-sm font-medium h-10 px-5 border border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"
            >
              Erken Erişim Listesi <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-10 border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="h-4 w-4 text-primary shrink-0" />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
