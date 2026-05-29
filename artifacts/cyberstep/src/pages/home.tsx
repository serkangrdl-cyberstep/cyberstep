import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpecialDayBanner } from "@/components/special-day-banner";
import { Shield, ChevronRight, CheckCircle, BarChart, ShieldAlert, Building2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";
import { usePageMeta } from "@/hooks/use-page-meta";

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield, CheckCircle, ShieldAlert, Building2,
};

interface ConsultingService { id: number; title: string; description: string; icon: string; isActive: boolean; sortOrder: number; }
interface TechPartner { id: number; name: string; logoUrl: string; websiteUrl: string | null; isActive: boolean; }

interface PricingPlan {
  id: number;
  slug: string;
  name: string;
  price: string;
  currency: string;
  description: string;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

function formatPrice(plan: PricingPlan): string {
  const num = parseFloat(plan.price);
  if (num === 0) return "";
  return new Intl.NumberFormat("tr-TR").format(num) + " ₺";
}

function getPlanMeta(plan: PricingPlan): { cta: "mini" | "full"; href: string; highlight: boolean; isFree: boolean; available: boolean } {
  if (plan.slug === "mini") {
    return { cta: "mini", href: "/assessment/start", highlight: false, isFree: parseFloat(plan.price) === 0, available: true };
  }
  const hasPrice = parseFloat(plan.price) > 0;
  return { cta: "full", href: hasPrice ? "/assessment/full/start" : "#", highlight: true, isFree: false, available: hasPrice };
}

const scoreColor: Record<string, string> = {
  Kritik: "bg-red-100 text-red-700 border-red-200",
  Yüksek: "bg-orange-100 text-orange-700 border-orange-200",
  Orta: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en"
      ? "Free Cybersecurity Risk Analysis for SMBs | CyberStep.io"
      : "KOBİ'ler icin Ucretsiz Siber Guvenlik Risk Analizi | CyberStep.io",
    description: lang === "en"
      ? "Measure your company's cybersecurity maturity in 5 minutes. Discover vulnerabilities and get a personalized action roadmap."
      : "Sirketinizin siber guvenlik olgunlugunu 5 dakikada olcun. Zayif noktalarinizi kesfedin ve kisisellestirilmis yol haritasi alin.",
    canonicalPath: "/",
    lang,
  });

  // FAQPage JSON-LD — Google'ın Rich Results (zengin sonuç) için
  useEffect(() => {
    const id = "ld-json-faqpage";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    const faqs = [
      {
        q: lang === "en" ? "Does the assessment require technical knowledge?" : "Değerlendirme teknik bilgi gerektiriyor mu?",
        a: lang === "en"
          ? "No. The test is designed for non-technical managers. Questions relate to your daily business processes and require no technical background."
          : "Hayır. Test, teknik olmayan yöneticiler için tasarlanmıştır. Sorular günlük iş süreçlerinizle ilgilidir ve herhangi bir teknik altyapı gerektirmez.",
      },
      {
        q: lang === "en" ? "Are my answers secure?" : "Cevaplarım güvende mi?",
        a: lang === "en"
          ? "Your data is stored encrypted and shared only with you. It is never shared with third parties."
          : "Verileriniz şifreli olarak saklanır ve yalnızca sizinle paylaşılır. Üçüncü taraflarla kesinlikle paylaşılmaz.",
      },
      {
        q: lang === "en" ? "When will I receive my results?" : "Sonuçları ne zaman alacağım?",
        a: lang === "en"
          ? "Your risk score and red alarm count are shown instantly after completing the test. Our expert team delivers the detailed report within 24-48 hours."
          : "Test tamamlandıktan sonra risk skorunuz anında gösterilir. Uzman ekibimiz detaylı raporu 24-48 saat içinde iletir.",
      },
      {
        q: lang === "en" ? "Why can't I see the full report immediately?" : "Raporun tamamını neden hemen göremiyorum?",
        a: lang === "en"
          ? "For an accurate assessment, our expert team reviews and approves the AI analysis. This process guarantees report quality."
          : "Doğru bir değerlendirme için uzman ekibimiz AI analizini inceleyip onaylar. Bu süreç raporun kalitesini garanti eder.",
      },
      {
        q: lang === "en" ? "What is the difference between Mini and Full Assessment?" : "Mini ve Tam Değerlendirme arasındaki fark nedir?",
        a: lang === "en"
          ? "Mini Assessment reveals your general risk profile with 20 questions. Full Assessment includes 55 questions, sector comparison, and one-on-one expert consulting."
          : "Mini Değerlendirme 20 soru ile genel risk profilinizi ortaya koyar. Tam Değerlendirme 55 soru, sektör karşılaştırması ve birebir uzman danışmanlığı içerir.",
      },
    ];
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    });
    return () => { el?.remove(); };
  }, [lang]);

  const { data: pricingPlans, isLoading: pricingLoading } = useQuery<PricingPlan[]>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: consultingServices = [] } = useQuery<ConsultingService[]>({
    queryKey: ["public-consulting"],
    queryFn: () => fetch("/api/public/consulting-services").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: techPartners = [] } = useQuery<TechPartner[]>({
    queryKey: ["public-tech-partners"],
    queryFn: () => fetch("/api/public/tech-partners").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const STATS = [
    { value: "500+", label: t(T.home.statsAnalyzed, lang) },
    { value: "3.2dk", label: t(T.home.statsTime, lang) },
    { value: "%94", label: t(T.home.statsSatisfaction, lang) },
    { value: "20", label: t(T.home.statsPoints, lang) },
  ];

  const SECTOR_RISKS = [
    {
      sector: t(T.home.financeLabel, lang),
      icon: "🏦",
      risks: [t(T.home.financeRisk1, lang), t(T.home.financeRisk2, lang), t(T.home.financeRisk3, lang)],
      color: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20",
    },
    {
      sector: t(T.home.healthLabel, lang),
      icon: "🏥",
      risks: [t(T.home.healthRisk1, lang), t(T.home.healthRisk2, lang), t(T.home.healthRisk3, lang)],
      color: "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20",
    },
    {
      sector: t(T.home.retailLabel, lang),
      icon: "🛒",
      risks: [t(T.home.retailRisk1, lang), t(T.home.retailRisk2, lang), t(T.home.retailRisk3, lang)],
      color: "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/20",
    },
    {
      sector: t(T.home.mfgLabel, lang),
      icon: "🏭",
      risks: [t(T.home.mfgRisk1, lang), t(T.home.mfgRisk2, lang), t(T.home.mfgRisk3, lang)],
      color: "border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-900/20",
    },
  ];

  const FAQS = [
    { q: t(T.home.faq1q, lang), a: t(T.home.faq1a, lang) },
    { q: t(T.home.faq2q, lang), a: t(T.home.faq2a, lang) },
    { q: t(T.home.faq3q, lang), a: t(T.home.faq3a, lang) },
    { q: t(T.home.faq4q, lang), a: t(T.home.faq4a, lang) },
    { q: t(T.home.faq5q, lang), a: t(T.home.faq5a, lang) },
  ];

  const TESTIMONIALS = [
    {
      name: "Ahmet Yılmaz",
      title: lang === "en" ? "General Manager" : "Genel Müdür",
      company: "Yılmaz Tekstil A.Ş.",
      sector: lang === "en" ? "Manufacturing" : "Üretim",
      text: lang === "en"
        ? "We never knew where we stood on cybersecurity. Thanks to the CyberStep assessment, we identified 3 critical vulnerabilities and took immediate action."
        : "Siber güvenlik konusunda nerede durduğumuzu hiç bilmiyorduk. CyberStep testi sayesinde 3 kritik açığımızı fark ettik ve hemen aksiyon aldık.",
      score: lang === "en" ? "Critical" : "Kritik",
    },
    {
      name: "Fatma Demir",
      title: lang === "en" ? "Finance Director" : "Finans Direktörü",
      company: "Demir Muhasebe Yazılım",
      sector: lang === "en" ? "Technology" : "Teknoloji",
      text: lang === "en"
        ? "As a company handling customer data, we have a large security responsibility. The report clarified our priorities and helped us visualize our gaps."
        : "Müşteri verilerini işleyen bir şirket olarak güvenlik sorumluluğumuz büyük. Rapor, önceliklerimizi netleştirdi.",
      score: lang === "en" ? "High" : "Yüksek",
    },
    {
      name: "Mehmet Çelik",
      title: lang === "en" ? "Operations Manager" : "Operasyon Müdürü",
      company: "Çelik Lojistik Ltd.",
      sector: lang === "en" ? "Service" : "Hizmet",
      text: lang === "en"
        ? "Our technical knowledge is limited but the test questions were clear and understandable. After the expert assessment, we worked with our IT consultant. Highly recommended."
        : "Teknik bilgimiz sınırlı ama test sorular açık ve anlaşılırdı. Uzman değerlendirmesi geldikten sonra BT danışmanımızla birebir çalıştık.",
      score: lang === "en" ? "Medium" : "Orta",
    },
  ];

  const scoreColorEn: Record<string, string> = {
    Critical: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  const STATIC_PLANS = [
    {
      name: t(T.home.miniName, lang),
      displayPrice: t(T.home.free, lang),
      description: t(T.home.miniDesc, lang),
      features: [
        t(T.home.miniFeature1, lang),
        t(T.home.miniFeature2, lang),
        t(T.home.miniFeature3, lang),
        t(T.home.miniFeature4, lang),
        t(T.home.miniFeature5, lang),
      ],
      cta: t(T.home.miniCta, lang),
      href: "/assessment/start",
      highlight: false,
      badge: undefined as string | undefined,
    },
    {
      name: t(T.home.fullName, lang),
      displayPrice: t(T.home.comingSoon, lang),
      description: t(T.home.fullDesc, lang),
      features: [
        t(T.home.fullFeature1, lang),
        t(T.home.fullFeature2, lang),
        t(T.home.fullFeature3, lang),
        t(T.home.fullFeature4, lang),
        t(T.home.fullFeature5, lang),
        t(T.home.fullFeature6, lang),
      ],
      cta: t(T.home.fullCta, lang),
      href: "#",
      highlight: true,
      badge: t(T.home.comingSoon, lang),
      disabled: true,
    },
  ];

  const displayPlans = pricingPlans && pricingPlans.length > 0
    ? pricingPlans.map(plan => {
        const meta = getPlanMeta(plan);
        const priceStr = meta.isFree ? t(T.home.free, lang) : (formatPrice(plan) || t(T.home.comingSoon, lang));
        return {
          name: plan.name,
          displayPrice: priceStr,
          description: plan.description,
          features: plan.features,
          cta: meta.cta === "mini" ? t(T.home.miniCta, lang) : t(T.home.fullCta, lang),
          href: meta.href,
          highlight: meta.highlight,
          badge: (meta.highlight && !meta.available) ? t(T.home.comingSoon, lang) : undefined,
          disabled: meta.highlight && !meta.available,
        };
      })
    : STATIC_PLANS;

  return (
    <div className="flex flex-col flex-1">
      <SpecialDayBanner />
      {/* Hero */}
      <section className="py-20 md:py-32 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              <span>{t(T.home.heroBadge, lang)}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              {t(T.home.heroTitle, lang)}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {t(T.home.heroSubtitle, lang)}
            </p>
            <div className="pt-4">
              <Link
                href="/assessment/start"
                className="inline-flex items-center justify-center rounded-md text-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8"
              >
                {t(T.home.heroCta, lang)}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center text-center">
                <span className="text-4xl font-bold text-primary">{stat.value}</span>
                <span className="text-sm text-muted-foreground mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">{t(T.home.howTitle, lang)}</h2>
            <p className="text-muted-foreground mt-4">{t(T.home.howSub, lang)}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">{lang === "en" ? "1. Complete the Form" : "1. Formu Doldurun"}</h3>
              <p className="text-muted-foreground">{t(T.home.step1sub, lang)}</p>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <BarChart className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">{lang === "en" ? "2. See Your Risk Score" : "2. Risk Skorunuzu Görün"}</h3>
              <p className="text-muted-foreground">{t(T.home.step2sub, lang)}</p>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">{lang === "en" ? "3. Get Your Expert Report" : "3. Uzman Raporunuzu Alın"}</h3>
              <p className="text-muted-foreground">{t(T.home.step3sub, lang)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sector Risks */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t(T.home.sectorBadge, lang)}</Badge>
            <h2 className="text-3xl font-bold">{t(T.home.sectorTitle, lang)}</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {t(T.home.sectorSub, lang)}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {SECTOR_RISKS.map((s) => (
              <div key={s.sector} className={`rounded-xl border p-5 ${s.color}`}>
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className="font-semibold text-base mb-3">{s.sector}</h3>
                <ul className="space-y-2">
                  {s.risks.map((r) => (
                    <li key={r} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consulting Services */}
      {consultingServices.length > 0 && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">{t(T.home.consultingBadge, lang)}</Badge>
              <h2 className="text-3xl font-bold">{t(T.home.consultingTitle, lang)}</h2>
              <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
                {t(T.home.consultingSub, lang)}
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {consultingServices.map(service => {
                const Icon = LUCIDE_ICONS[service.icon] ?? Shield;
                return (
                  <div key={service.id} className="bg-card rounded-xl border p-6 shadow-sm flex flex-col gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-2">{service.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-10">
              <Link href="/iletisim" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
                {t(T.home.consultingCta, lang)} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t(T.home.pricingBadge, lang)}</Badge>
            <h2 className="text-3xl font-bold">{t(T.home.pricingTitle, lang)}</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              {t(T.home.pricingSub, lang)}
            </p>
          </div>
          {pricingLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {displayPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-8 flex flex-col gap-6 shadow-sm relative ${
                    plan.highlight ? "border-primary/40 bg-primary/5 shadow-primary/10" : "bg-card"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1">{plan.badge}</Badge>
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-3xl font-bold text-primary">{plan.displayPrice}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 transition-colors ${
                      (plan as { disabled?: boolean }).disabled
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    onClick={(plan as { disabled?: boolean }).disabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                  >
                    {plan.cta}
                    {!(plan as { disabled?: boolean }).disabled && <ChevronRight className="ml-2 h-4 w-4" />}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t(T.home.testimonialsBadge, lang)}</Badge>
            <h2 className="text-3xl font-bold">{t(T.home.testimonialsTitle, lang)}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((test) => (
              <div key={test.name} className="bg-card rounded-xl border p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {test.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{test.name}</p>
                      <p className="text-xs text-muted-foreground">{test.title}, {test.company}</p>
                    </div>
                  </div>
                  <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${(scoreColor[test.score] ?? scoreColorEn[test.score]) ?? ""}`}>
                    {test.score}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{test.text}"</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {test.sector}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">Neden CyberStep?</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {lang === "en"
                  ? "Cybersecurity is climbed step by step"
                  : "Siber güvenlik kat merdivenini çıkar gibi, basamak basamak ilerler"}
              </h2>
              <p className="text-slate-400 leading-relaxed">
                {lang === "en"
                  ? "You can't take all security measures at once — not even large enterprises can. The question isn't 'am I completely secure?' but 'am I one step ahead of yesterday?'"
                  : "Tüm güvenlik önlemlerini bir seferde alamazsınız — büyük kurumlar bile alamaz. Soru 'tamamen güvende miyim?' değil, 'dünden bir adım ileride miyim?' olmalı."}
              </p>
              <p className="text-slate-400 leading-relaxed">
                {lang === "en"
                  ? "CyberStep shows you which step to take next. Not a 100-page report — a clear, prioritized roadmap tailored to your sector and scale."
                  : "CyberStep size bir sonraki adımı gösterir. 100 sayfalık bir rapor değil — sektörünüze ve ölçeğinize göre net, önceliklendirilmiş bir yol haritası."}
              </p>
              <div className="pt-2">
                <a href="/hakkimizda" className="inline-flex items-center gap-2 text-emerald-400 font-medium hover:text-emerald-300 transition-colors text-sm">
                  {lang === "en" ? "Read our full story" : "Tam hikayemizi okuyun"}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { num: "1", title: lang === "en" ? "Know where you stand" : "Nerede durduğunu bil", desc: lang === "en" ? "20 questions, instant AI analysis, personalized risk report." : "20 soru, anında AI analizi, kişisel risk raporu." },
                { num: "2", title: lang === "en" ? "Set your priority" : "Önceliğini belirle", desc: lang === "en" ? "Which gap to close first? A ranked action plan for your scale." : "Hangi açığı önce kapatacaksın? Ölçeğine göre sıralı aksiyon planı." },
                { num: "3", title: lang === "en" ? "Advance and measure" : "İlerle ve ölç", desc: lang === "en" ? "Your security maturity score grows with every step you take." : "Her adımda güvenlik olgunluk skorun yükselir ve belgelenir." },
              ].map((item) => (
                <div key={item.num} className="flex gap-4 p-5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {item.num}
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t(T.home.faqBadge, lang)}</Badge>
            <h2 className="text-3xl font-bold">{t(T.home.faqTitle, lang)}</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border rounded-xl bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-medium text-sm hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 pt-1 text-sm text-muted-foreground border-t bg-muted/10">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Partners */}
      {techPartners.length > 0 && (
        <section className="py-16 bg-muted/20 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t(T.home.partnersBadge, lang)}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-10 max-w-5xl mx-auto">
              {techPartners.map(partner => (
                <a
                  key={partner.id}
                  href={partner.websiteUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  title={partner.name}
                >
                  <img
                    src={partner.logoUrl}
                    alt={partner.name}
                    className="h-8 max-w-[120px] object-contain grayscale hover:grayscale-0 transition-all"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Bottom */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">{t(T.home.ctaTitle, lang)}</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {t(T.home.ctaSub, lang)}
          </p>
          <Link
            href="/assessment/start"
            className="inline-flex items-center justify-center rounded-md text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 transition-colors"
          >
            {t(T.home.ctaBtn, lang)} <ChevronRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
