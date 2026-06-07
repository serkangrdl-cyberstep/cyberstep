import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, ChevronRight, Shield, Users, Clock, Award, UserCheck,
  Eye, FileText, Zap, Network, Globe, ScrollText, Building2, Activity, Server,
  Search, Crosshair, AlertTriangle, Mail, BarChart2, Layers, Target, ShieldAlert,
  Cpu, Lock, Radio, GitBranch, TrendingUp, PlayCircle,
} from "lucide-react";
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
  serviceType?: string;
  priceTl?: string;
  isSelfService?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Network, Globe, FileText, Building2, ScrollText, Activity, Server, Shield,
  AlertTriangle, Mail, BarChart2, Layers, Target, ShieldAlert, Cpu, Lock,
  Radio, GitBranch, TrendingUp, Eye, Zap, Search, Crosshair, UserCheck,
};

function getIcon(slug: string): React.ElementType {
  const m: Record<string, React.ElementType> = {
    "fortinet-fabric": Network,
    "dns-izleme": Globe,
    "ct-log-izleme": ScrollText,
    "microsoft-365": Building2,
    "kvkk-bildirim": FileText,
    "servicenow": Activity,
    "soc-operasyon": Shield,
    "observability": Server,
    "soc-lite": ShieldAlert,
    "soc-standart": Shield,
    "soc-pro": Shield,
    "noc-lite": Radio,
    "noc-standart": Radio,
    "noc-pro": Radio,
    "tehdit-istihbarat-starter": AlertTriangle,
    "tehdit-istihbarat-standart": AlertTriangle,
    "tehdit-istihbarat-pro": AlertTriangle,
    "cve-izleme-lite": Lock,
    "cve-izleme-standart": Lock,
    "cve-izleme-pro": Lock,
    "easm-tek": Target,
    "easm-ceyreklik": Target,
    "easm-yillik": Target,
    "tprm-5": Layers,
    "tprm-10": Layers,
    "tprm-20": Layers,
    "pentest-lite-tek": Cpu,
    "pentest-lite-5domain": Cpu,
    "pentest-lite-yillik": Cpu,
    "eposta-guvenligi-tek": Mail,
    "eposta-guvenligi-izleme": Mail,
    "ai-security-assessment": Zap,
    "phishing-simulation": Zap,
    "eu-ai-act": FileText,
    "ai-red-team": ShieldAlert,
    "ai-tool-monitoring": Eye,
    "ai-policy-autoupdate": FileText,
    "leak-monitor": AlertTriangle,
    "bundle-full-protection": Layers,
    "bundle-enterprise-soc": Shield,
    "bundle-soc-noc-lite": Radio,
    "bundle-soc-noc-standart": Radio,
    "bundle-soc-noc-pro": Radio,
  };
  return m[slug] ?? Shield;
}

function fmtTL(v: string | number | undefined): string {
  const n = parseFloat(String(v ?? "0"));
  if (!n) return "Ücretsiz";
  return new Intl.NumberFormat("tr-TR").format(n);
}

function fmtTLLabel(v: string | number | undefined): string {
  const n = parseFloat(String(v ?? "0"));
  if (!n) return "Ücretsiz";
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

interface ServiceGroup {
  key: string;
  label: string;
  slugs: string[];
  desc?: string;
  badge?: string;
  comingSoon?: boolean;
}

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    key: "soc-noc",
    label: "SOC & NOC",
    desc: "7/24 güvenlik operasyonları ve ağ operasyon merkezi hizmetleri.",
    slugs: ["soc-lite","soc-standart","soc-operasyon","noc-lite","noc-standart","noc-pro","bundle-soc-noc-lite","bundle-soc-noc-standart"],
  },
  {
    key: "tehdit-istihbarat",
    label: "Tehdit İstihbarat & CVE",
    desc: "Gerçek zamanlı tehdit zekası, CVE izleme ve dark web takibi.",
    slugs: ["tehdit-istihbarat-starter","tehdit-istihbarat-standart","tehdit-istihbarat-pro","cve-izleme-lite","cve-izleme-standart","cve-izleme-pro","leak-monitor"],
  },
  {
    key: "easm-pentest",
    label: "EASM & Pentest Lite",
    desc: "Saldırgan bakış açısıyla dış saldırı yüzeyi yönetimi ve pentest.",
    slugs: ["easm-tek","easm-ceyreklik","easm-yillik","pentest-lite-tek","pentest-lite-5domain","pentest-lite-yillik"],
  },
  {
    key: "ai-guvenlik",
    label: "AI Güvenlik",
    desc: "Yapay zeka araçları, politika yönetimi ve AI simülasyon servisleri.",
    badge: "Yeni",
    slugs: ["ai-security-assessment","ai-tool-monitoring","ai-policy-autoupdate","phishing-simulation","ai-red-team","eu-ai-act"],
  },
  {
    key: "entegrasyon-izleme",
    label: "Entegrasyon & İzleme",
    desc: "Fortinet, Microsoft 365, DNS, CT Log, ServiceNow ve gözlemlenebilirlik.",
    slugs: ["fortinet-fabric","microsoft-365","servicenow","observability","dns-izleme","ct-log-izleme","kvkk-bildirim"],
  },
  {
    key: "tprm-eposta",
    label: "TPRM & E-posta",
    desc: "Tedarikçi risk yönetimi ve e-posta güvenlik denetimi.",
    slugs: ["tprm-5","tprm-10","tprm-20","eposta-guvenligi-tek","eposta-guvenligi-izleme"],
  },
];

const DEMO_SLUG_MAP: Record<string, string> = {
  "easm-tek": "easm",
  "easm-ceyreklik": "easm",
  "easm-yillik": "easm",
  "pentest-lite-tek": "easm",
  "pentest-lite-5domain": "easm",
  "pentest-lite-yillik": "easm",
  "eposta-guvenligi-tek": "email_security",
  "eposta-guvenligi-izleme": "email_security",
  "cve-izleme-lite": "cve_alert",
  "cve-izleme-standart": "cve_alert",
  "cve-izleme-pro": "cve_alert",
  "tprm-5": "tprm",
  "tprm-10": "tprm",
  "tprm-20": "tprm",
  "tehdit-istihbarat-starter": "threat_intel",
  "tehdit-istihbarat-standart": "threat_intel",
  "tehdit-istihbarat-pro": "threat_intel",
  "soc-lite": "board_report",
  "soc-standart": "board_report",
  "soc-operasyon": "board_report",
  "soc-pro": "board_report",
  "ai-security-assessment": "board_report",
  "phishing-simulation": "email_security",
  "eu-ai-act": "board_report",
  "ai-red-team": "threat_intel",
  "ai-tool-monitoring": "threat_intel",
  "ai-policy-autoupdate": "board_report",
  "domain-scan": "easm",
  "noc-lite": "board_report",
  "noc-standart": "board_report",
  "noc-pro": "board_report",
};

function ServiceCard({ svc }: { svc: ServiceCatalogItem }) {
  const Icon = getIcon(svc.slug);
  const price = fmtTL(svc.monthlyPriceTl);
  const features: string[] = Array.isArray(svc.features) ? svc.features.slice(0, 3) : [];
  const isBundle = svc.category === "bundle";
  const suffix = svc.serviceType === "one_time" ? "· tek seferlik + KDV"
    : svc.serviceType === "annual" ? "/ yıl + KDV"
    : "/ ay + KDV";
  const demoType = DEMO_SLUG_MAP[svc.slug];

  return (
    <div className={`rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors ${isBundle ? "border-primary/30 bg-primary/3" : ""}`}>
      {isBundle && (
        <div className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300/50 dark:border-green-700/50 px-2 py-0.5 rounded-full w-fit">
          Paket
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {demoType && (
          <Link
            href={`/demo?rapor=${demoType}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-full transition-colors whitespace-nowrap"
          >
            <PlayCircle className="h-3 w-3" />
            Demo Gör
          </Link>
        )}
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">{svc.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{svc.shortDescription}</p>
      </div>
      {features.length > 0 && (
        <ul className="space-y-1 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />{f}
            </li>
          ))}
        </ul>
      )}
      <div className="pt-2 border-t mt-auto">
        <p className="text-base font-bold text-primary mb-2">
          {price} {price !== "Ücretsiz" && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
        </p>
        {svc.isActive && svc.isSelfService !== false ? (
          <Link
            href={`/satin-al/${svc.slug}`}
            className="block w-full text-center text-xs bg-primary text-primary-foreground py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Satın Al
          </Link>
        ) : (
          <Link
            href="/iletisim"
            className="block w-full text-center text-xs bg-primary text-primary-foreground py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Teklif Al
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Pricing() {
  usePageMeta({
    title: "Hizmetler & Fiyatlar | CyberStep.io",
    description: "KOBİ'ler icin siber guvenlik hizmetleri ve fiyatları. Ucretsiz Mini Degerlendirme ile baslayin, SOC, EASM, TPRM ve daha fazlasını kesfin.",
    keywords: "siber güvenlik hizmetleri, siber güvenlik fiyatları, SOC hizmet fiyatı, EASM fiyat, TPRM fiyat",
    canonicalPath: "/fiyatlar",
  });

  const [activeGroup, setActiveGroup] = useState<string>("soc-noc");

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

  const { data: serviceCatalogRaw = [] } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["public-service-catalog"],
    queryFn: () => fetch("/api/public/service-catalog").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dbPlansRaw } = useQuery<DbPlan[]>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const serviceCatalog: ServiceCatalogItem[] = Array.isArray(serviceCatalogRaw) ? serviceCatalogRaw : [];
  const dbPlans = Array.isArray(dbPlansRaw) ? dbPlansRaw : [];
  const fullDbPlan = dbPlans.find(p => p.slug === "full");
  const fullPriceLabel = fullDbPlan ? fmtTLLabel(fullDbPlan.price) : PRICING_PLANS[1].priceLabel;

  const plans = PRICING_PLANS.map(p =>
    p.id === "full" && fullDbPlan
      ? { ...p, priceLabel: fullPriceLabel }
      : p
  );

  const currentGroup = SERVICE_GROUPS.find(g => g.key === activeGroup) ?? SERVICE_GROUPS[0];
  const currentServices = serviceCatalog.filter(s => currentGroup.slugs.includes(s.slug));

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <section className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">Hizmetler & Fiyatlar</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">Şeffaf Fiyatlarla Siber Güvenlik Hizmetleri</h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            Mini değerlendirme ücretsiz. SOC, EASM, TPRM ve daha fazlası için aşağıdaki hizmet kataloğunu inceleyin.
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
            <Badge className="bg-primary/20 text-primary border-primary/40 mb-3">Yeni</Badge>
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

            {/* AI Oltalama */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">AI Oltalama Simülasyonu</p>
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

      {/* Tüm Kurumsal Servisler — Sekmeli */}
      <section id="kurumsal-servisler" className="pb-16 bg-muted/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10 pt-10">
            <Badge className="bg-primary/20 text-primary border-primary/40 mb-3">Kurumsal</Badge>
            <h2 className="text-2xl font-bold mb-2">Tüm Kurumsal Servisler</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              SOC, NOC, EASM, tehdit istihbaratı, pentest, TPRM ve daha fazlası. Her servis bağımsız satın alınabilir veya paket halinde alınabilir.
            </p>
          </div>

          {/* Tab navigation */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {SERVICE_GROUPS.map(g => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  activeGroup === g.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {g.label}
                {g.badge && (
                  <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                    {g.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active group description */}
          {currentGroup.desc && (
            <p className="text-center text-sm text-muted-foreground mb-6">{currentGroup.desc}</p>
          )}

          {/* Service cards */}
          {currentServices.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {currentServices.map(svc => (
                <ServiceCard key={svc.slug} svc={svc} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Servisler yükleniyor...
            </div>
          )}

          {/* Coming soon tiles */}
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-background p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm text-foreground/70">Dark Web İzleme</p>
                  <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">Yakında</span>
                </div>
                <p className="text-xs text-muted-foreground">Credential sızıntı tespiti ve dark web forum takibi — 2026 Q4</p>
              </div>
              <Link href="/roadmap" className="shrink-0 text-xs border border-muted-foreground/30 text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                Erken Erişim
              </Link>
            </div>
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-background p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Crosshair className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm text-foreground/70">APT Grup İzleme</p>
                  <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">Yakında</span>
                </div>
                <p className="text-xs text-muted-foreground">Türkiye'yi hedefleyen tehdit aktörü profilleri ve MITRE ATT&CK haritalama — 2026 Q4</p>
              </div>
              <Link href="/roadmap" className="shrink-0 text-xs border border-muted-foreground/30 text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                Erken Erişim
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
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
