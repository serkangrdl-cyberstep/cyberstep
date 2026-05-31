import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpecialDayBanner } from "@/components/special-day-banner";
import { Shield, ChevronRight, CheckCircle, BarChart, ShieldAlert, Building2, ChevronDown, ChevronUp, Loader2, Globe, Search, XCircle, CheckCircle2, AlertCircle, Lock, AtSign, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";
import { usePageMeta } from "@/hooks/use-page-meta";

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield, CheckCircle, ShieldAlert, Building2,
};

interface ConsultingService { id: number; title: string; description: string; icon: string; isActive: boolean; sortOrder: number; }
interface TechPartner { id: number; name: string; logoUrl: string; websiteUrl: string | null; isActive: boolean; }
interface Advisory { id: number; title: string; source: string; link: string | null; summary: string | null; severity: string; published_at: string; }

interface BadgeAdvantageItem {
  id: number; title: string; partnerName: string; description: string;
  discountPercent: number | null; badgeText: string | null;
}

function BadgeAdvantagesSection({ lang }: { lang: string }) {
  const { data: advantages } = useQuery<BadgeAdvantageItem[]>({
    queryKey: ["badge-advantages-public"],
    queryFn: () => fetch("/api/badge-advantages").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const list = Array.isArray(advantages) ? advantages : [];
  if (list.length === 0) return null;
  return (
    <section className="py-20 bg-muted/30 border-y">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            {lang === "en" ? "Badge Benefits" : "Rozet Avantajları"}
          </Badge>
          <h2 className="text-3xl font-bold">
            {lang === "en" ? "CyberStep Verified Badge Perks" : "CyberStep Doğrulandı Rozet Avantajları"}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            {lang === "en"
              ? "Companies that earn the CyberStep Verified badge gain exclusive partner discounts and privileges."
              : "CyberStep Doğrulandı rozetini kazanan firmalar, iş ortaklarımızın sunduğu özel ayrıcalıklardan yararlanır."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {list.map(a => (
            <div key={a.id} className="bg-background rounded-2xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm leading-snug">{a.title}</h3>
                {a.discountPercent && (
                  <span className="shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    %{a.discountPercent}
                  </span>
                )}
              </div>
              <p className="text-xs text-primary font-medium mb-2">{a.partnerName}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground">
            {lang === "en"
              ? "Complete a CyberStep on-site audit to earn the Verified badge."
              : "CyberStep sahaya doğrulama denetimini tamamlayarak rozeti kazanın."}
          </p>
          <a
            href="mailto:info@cyberstep.io?subject=Doğrulama Denetimi Talebi"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary hover:underline"
          >
            {lang === "en" ? "Request audit" : "Denetim talep et"} <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

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

interface QuickScanResult {
  id: number;
  domain: string;
  overallScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  sslPass: boolean;
  blacklisted: boolean;
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [quickDomain, setQuickDomain] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<QuickScanResult | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const { lang } = useLanguage();

  async function handleQuickScan(e: React.FormEvent) {
    e.preventDefault();
    const d = quickDomain.trim();
    if (!d) return;
    setQuickLoading(true);
    setQuickResult(null);
    setQuickError(null);
    try {
      const res = await fetch("/api/domain-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Tarama başarısız oldu");
      }
      const data = await res.json() as QuickScanResult;
      setQuickResult(data);
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setQuickLoading(false);
    }
  }
  usePageMeta({
    title: lang === "en"
      ? "Turkey's Cybersecurity Risk Platform | CyberStep.io"
      : "Turkiye'nin Siber Guvenlik Risk Platformu | CyberStep.io",
    description: lang === "en"
      ? "See your company through an attacker's eyes. AI-powered analysis, KVKK compliance, financial risk estimation. Start with a free domain scan."
      : "Saldirgánin gozuyle sirketinize bakin. Dis saldiri yüzeyi, AI guvenlik analizi, KVKK uyumu. Ucretsiz domain taramasiyla baslayin.",
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

  const { data: advisories = [] } = useQuery<Advisory[]>({
    queryKey: ["public-security-advisories"],
    queryFn: () => fetch("/api/public/security-advisories?limit=4").then(r => r.json()),
    staleTime: 10 * 60 * 1000,
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
    { value: "20dk", label: t(T.home.statsTime, lang) },
    { value: "60+", label: t(T.home.statsSatisfaction, lang) },
    { value: "22", label: t(T.home.statsPoints, lang) },
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
      {/* Beta Banner */}
      <div className="bg-primary/10 border-b border-primary/20 text-primary py-2.5 px-4 text-sm text-center">
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">YENİ</span>
          Platform sürekli gelişiyor. Yeni özellikler her hafta ekleniyor.
        </span>
      </div>
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
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-400 pt-2">
              <span>{lang === "en" ? "Avg. cyberattack cost:" : "Ortalama siber saldırı maliyeti:"} <strong className="text-white">285.000 TL</strong></span>
              <span className="opacity-30">·</span>
              <span>{lang === "en" ? "CyberStep annual cost:" : "CyberStep yıllık maliyeti:"} <strong className="text-emerald-400">23.880 TL</strong></span>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/assessment/start"
                className="inline-flex items-center justify-center rounded-md text-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8"
              >
                {t(T.home.heroCta, lang)}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/domain-tarama"
                className="inline-flex items-center justify-center rounded-md text-base font-medium transition-colors border border-white/20 text-white hover:bg-white/10 h-14 px-8"
              >
                {lang === "en" ? "Scan Your Domain Free" : "Domain'inizi Ücretsiz Tarayın"}
                <ChevronRight className="ml-2 h-4 w-4" />
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">{lang === "en" ? "1. Complete the Assessment" : "1. Değerlendirmeyi Tamamlayın"}</h3>
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
              <h3 className="text-xl font-semibold">{lang === "en" ? "3. Get Your AI Report Instantly" : "3. AI Raporunuzu Anında Alın"}</h3>
              <p className="text-muted-foreground">{t(T.home.step3sub, lang)}</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300/60 dark:border-amber-700/50 rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-amber-800 dark:text-amber-200">{lang === "en" ? "4. Expert Verification" : "4. Uzman Doğrulaması"}</h3>
              <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                {lang === "en"
                  ? "Full Assessment reports are reviewed by a certified cybersecurity consultant within 24 hours. After approval, the 'Expert Verified' badge is added to your report."
                  : "Tam Değerlendirme raporları 24 saat içinde uzman siber güvenlik danışmanı tarafından incelenir. Onay sonrası raporunuza 'Uzman Doğrulandı' rozeti eklenir ve sizi bilgilendiririz."}
              </p>
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

      {/* Domain Scan Live Widget */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-4">
                <Globe className="h-4 w-4" />
                <span>{lang === "en" ? "Free Domain Security Check" : "Ücretsiz Alan Adı Güvenlik Kontrolü"}</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                {lang === "en" ? "What Is Your Domain Security Score?" : "Alan Adınızın Güvenlik Skoru Kaç?"}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {lang === "en"
                  ? "Instantly check SPF, DMARC, SSL and blacklist status of your company's domain — no registration required."
                  : "Şirketinizin alan adında SPF, DMARC, SSL ve kara liste durumunu anında kontrol edin. Kayıt gerekmez."}
              </p>
            </div>

            <form onSubmit={handleQuickScan} className="flex flex-col sm:flex-row gap-3 mb-8">
              <Input
                value={quickDomain}
                onChange={(e) => { setQuickDomain(e.target.value); setQuickResult(null); setQuickError(null); }}
                placeholder={lang === "en" ? "yourcompany.com" : "sirketiniz.com"}
                className="flex-1 h-12 bg-card/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                disabled={quickLoading}
              />
              <Button type="submit" disabled={quickLoading || !quickDomain.trim()} className="h-12 px-6 font-medium shrink-0">
                {quickLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{lang === "en" ? "Scanning..." : "Taranıyor..."}</> : <><Search className="h-4 w-4 mr-2" />{lang === "en" ? "Scan" : "Tara"}</>}
              </Button>
            </form>

            {quickError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {quickError}
              </div>
            )}

            {quickResult && (
              <div className="bg-card/10 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm text-white/60 mb-0.5">{lang === "en" ? "Scanned domain" : "Taranan alan adı"}</p>
                    <p className="font-semibold text-white">{quickResult.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/50 mb-0.5">{lang === "en" ? "Security Score" : "Güvenlik Skoru"}</p>
                    <span className={`text-4xl font-bold ${quickResult.overallScore >= 70 ? "text-emerald-400" : quickResult.overallScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {quickResult.overallScore}
                      <span className="text-base font-normal text-white/40">/100</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "SPF", pass: quickResult.spfPass, icon: AtSign },
                    { label: "DMARC", pass: quickResult.dmarcPass, icon: Mail },
                    { label: "SSL", pass: quickResult.sslPass, icon: Lock },
                    { label: lang === "en" ? "Blacklist" : "Kara Liste", pass: !quickResult.blacklisted, icon: Shield },
                  ].map(({ label, pass, icon: Icon }) => (
                    <div key={label} className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 border ${pass ? "bg-emerald-950/40 border-emerald-700/30" : "bg-red-950/40 border-red-700/30"}`}>
                      <Icon className={`h-5 w-5 ${pass ? "text-emerald-400" : "text-red-400"}`} />
                      <span className="text-xs font-medium text-white/80">{label}</span>
                      {pass
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    href={`/domain-tarama?id=${quickResult.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-10 text-sm font-medium transition-colors"
                  >
                    {lang === "en" ? "View Full Report" : "Tam Raporu Görüntüle"} <ChevronRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => { setQuickResult(null); setQuickDomain(""); }}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg h-10 text-sm font-medium transition-colors"
                  >
                    {lang === "en" ? "Scan Another Domain" : "Başka Alan Adı Tara"}
                  </button>
                </div>
              </div>
            )}

            {!quickResult && !quickError && !quickLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { label: lang === "en" ? "Email Security" : "E-posta Güvenliği", desc: "SPF / DMARC / DKIM" },
                  { label: "SSL / HTTPS", desc: lang === "en" ? "Certificate Check" : "Sertifika Kontrolü" },
                  { label: lang === "en" ? "Blacklist" : "Kara Liste", desc: lang === "en" ? "7 DNSBL" : "7 DNSBL Listesi" },
                  { label: lang === "en" ? "HTTP Headers" : "HTTP Başlıkları", desc: "HSTS / CSP / XFO" },
                ].map(({ label, desc }) => (
                  <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-4">
                    <p className="text-sm font-semibold text-white mb-1">{label}</p>
                    <p className="text-xs text-white/50">{desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Siber Güvenlik Duyuruları */}
      {advisories.length > 0 && (
        <section className="py-16 bg-muted/30 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-3">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Güncel Tehdit İstihbaratı
              </Badge>
              <h2 className="text-2xl font-bold">Siber Güvenlik Duyuruları</h2>
              <p className="text-muted-foreground mt-2 text-sm max-w-lg mx-auto">
                USOM, BTK ve uluslararası kaynaklardan derlenen güncel siber güvenlik uyarıları
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
              {advisories.map((adv) => {
                const severityClass =
                  adv.severity === "critical" ? "border-red-200 bg-red-50/60" :
                  adv.severity === "high" ? "border-orange-200 bg-orange-50/60" :
                  "border-yellow-200 bg-yellow-50/60";
                const badgeClass =
                  adv.severity === "critical" ? "bg-red-100 text-red-700 border-red-200" :
                  adv.severity === "high" ? "bg-orange-100 text-orange-700 border-orange-200" :
                  "bg-yellow-100 text-yellow-700 border-yellow-200";
                const badgeLabel =
                  adv.severity === "critical" ? "Kritik" :
                  adv.severity === "high" ? "Yüksek" : "Orta";
                return (
                  <div key={adv.id} className={`rounded-xl border p-4 ${severityClass}`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${badgeClass}`}>
                            {badgeLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{adv.source}</span>
                        </div>
                        <p className="text-sm font-semibold leading-snug mb-1">
                          {adv.link ? (
                            <a href={adv.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {adv.title}
                            </a>
                          ) : adv.title}
                        </p>
                        {adv.summary && (
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{adv.summary}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(adv.published_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CyberStep Rozet Avantajları */}
      <BadgeAdvantagesSection lang={lang} />

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

      {/* Neden CyberStep - Long Form */}
      <section className="py-24 bg-slate-950 text-white border-t border-slate-800">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-4">Neden CyberStep?</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-3xl mx-auto">
              Siber güvenlik bir gecede tamamlanmaz.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div className="space-y-5 text-slate-300 leading-relaxed">
              <p>
                Merdiveni tek seferde çıkmak mümkün değildir — her basamak bir üstekinin zeminini hazırlar.
                Bir basamağı atlayamazsın. Kısamazsın. Ama doğru basamakları, doğru sırayla atarsan zirveye ulaşırsın.
              </p>
              <p>
                Türkiye'deki şirketlerin büyük çoğunluğu bu merdivende nerede durduğunu bilmiyor.
                Hangi basamakta olduklarını görecek araçları yok. Yol haritaları yok.
                Mevcut araçlar İngilizce, erişilmez fiyatlı ve teknik ekip gerektiriyor.
              </p>
              <p className="text-white font-medium">
                CyberStep bu boşluk için doğdu — ve büyüdükçe o boşluğun ne kadar derin olduğunu gördük.
              </p>
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">İsmimizde iki anlam iç içe</p>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  İngilizce'de <em>step</em> hem <strong className="text-white">adım</strong> hem de <strong className="text-white">ayak izi</strong> demek.
                  Bu tesadüf değil — bilinçli bir tercih.
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Siber güvenliğin en kritik kavramlarından biri dijital ayak izi: şirketinizin dışarıdan görünen saldırı yüzeyi.
                  Bir saldırgan sizi hedef almadan önce ayak izinizi takip eder — hangi sistemler açık, hangi veriler sızmış, hangi kapılar kilitlenmemiş.
                </p>
                <p className="text-slate-300 text-sm leading-relaxed mt-3 font-medium">
                  CyberStep hem güvenlik adımlarınızı planlar hem dijital izinizi yönetir. Adım adım, iz bırakarak.
                </p>
              </div>
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Neden .io?</p>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  Bu bir danışmanlık firması değil, bir platform. <strong className="text-white">.io</strong> bilinçli bir sinyal:
                  yapay zeka ve bulut altyapısı üzerine kurulu, sürekli büyüyen bir teknoloji ekosistemi.
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Dış saldırı yüzeyi taraması, sürekli maruz kalma yönetimi, yapay zeka güvenlik analizi, EU AI Act uyumu,
                  KVKK entegrasyonu, firewall otomasyonu — bunlar ayrı araçlar değil, birbiriyle konuşan tek bir platform.
                </p>
                <p className="text-emerald-400 text-sm font-semibold mt-3">Türkiye'de ilk kez, Türkçe.</p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <a href="/hakkimizda" className="inline-flex items-center gap-2 text-emerald-400 font-medium hover:text-emerald-300 transition-colors text-sm">
              Ekibimizi ve hikayemizi tanıyın
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">Felsefemiz</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {lang === "en"
                  ? "Don't buy 'security'. Buy business continuity."
                  : "\"Güvenlik\" almayın. İş sürekliliği satın alın."}
              </h2>
              <p className="text-slate-400 leading-relaxed">
                {lang === "en"
                  ? "A business owner doesn't need to understand MFA or EDR. They need to know: 'if a ransomware hits tomorrow, how many days does my business stop? What does it cost?' CyberStep answers exactly that."
                  : "Bir şirket sahibinin MFA ya da EDR'ı anlaması gerekmiyor. Şunu bilmesi gerekiyor: 'Yarın fidye saldırısı gelse işim kaç gün durur? Maliyeti ne olur?' CyberStep tam bunu gösteriyor."}
              </p>
              <p className="text-slate-400 leading-relaxed">
                {lang === "en"
                  ? "Not a 100-page audit report — a Cyber Health Report that ranks 'close this first', written in plain language, tailored to your sector."
                  : "100 sayfalık denetim raporu değil — 'önce şunu kapat' sıralamasıyla, sektörünüze özel, teknik jargon olmadan yazılmış bir Siber Sağlık Karnesi."}
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
                { num: "1", title: lang === "en" ? "Find your biggest threat" : "En büyük tehdidini bul", desc: lang === "en" ? "20 questions reveal which gap ransomware, data breach or KVKK fines would exploit first." : "20 soru; fidye saldırısının, veri sızıntısının ya da KVKK cezasının hangi açıktan gireceğini gösterir." },
                { num: "2", title: lang === "en" ? "Close it in order" : "Öncelik sırasıyla kapat", desc: lang === "en" ? "'Close this first' — a ranked action plan, no jargon, written for business owners not IT teams." : "'Önce şunu kapat' — teknik bilgi gerektirmeden, iş sahibinin anlayacağı dilde öncelik planı." },
                { num: "3", title: lang === "en" ? "Measure your progress" : "İlerlemeyi belgele", desc: lang === "en" ? "Your security score grows with each step — visible proof for customers, banks, insurers and tender committees." : "Güvenlik skorunuz her adımda yükselir — müşterilere, bankaya, sigortacıya, ihale komitesine gösterebileceğiniz somut kanıt." },
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

      {/* Ücretsiz Güvenlik Araçları */}
      <section className="py-20 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">
              <Shield className="h-3 w-3 mr-1" />
              Ücretsiz Araçlar
            </Badge>
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "Free Security Analysis Tools" : "Ücretsiz Siber Güvenlik Analiz Araçları"}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {lang === "en"
                ? "10 free tools developed specifically for Turkish SMEs. No registration required — assess your risks instantly."
                : "Türk şirketleri için özel geliştirilen ücretsiz araçlar. Kayıt gerektirmez — risklerinizi anında ölçün."}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {[
              {
                href: "/sizinti-izleyici",
                icon: "🔍",
                title: lang === "en" ? "Dark Web Leak Monitor" : "Karanlık Web Sızıntı İzleyici",
                what: lang === "en" ? "Checks if your corporate domain or email addresses have appeared in dark web data dumps." : "Şirket alan adınızın veya e-postalarınızın karanlık web veri ihlali listelerinde yer alıp almadığını kontrol eder.",
                why: lang === "en" ? "Leaked credentials are used in 80% of cyberattacks. Early detection prevents account takeovers." : "Sızdırılan kimlik bilgileri siber saldırıların %80'inde kullanılır. Erken tespit hesap ele geçirilmesini önler.",
                price: "2.900 TL/yıl",
              },
              {
                href: "/kvkk-verbis",
                icon: "📋",
                title: "KVKK VERBİS Yükümlülük Kontrolü",
                what: "Şirketinizin VERBİS'e kayıt yaptırma yükümlülüğü olup olmadığını 3 soruda belirler.",
                why: "VERBİS'e kayıtsız kalan yükümlü şirketler 94.000 TL'ye kadar idari ceza riskiyle karşı karşıyadır.",
              },
              {
                href: "/m365-denetim",
                icon: "☁️",
                title: "Microsoft 365 Güvenlik Denetimi",
                what: "Microsoft 365 ortamınızdaki 26 kritik güvenlik ayarını 5 kategoride kontrol eder: Kimlik, Veri, E-posta, İzleme ve Mobil.",
                why: "M365'teki yanlış yapılandırmalar, kuruluş içi veri sızdırma ve hesap ele geçirme saldırılarının ana nedenidir.",
              },
              {
                href: "/siber-sigorta",
                icon: "🛡️",
                title: lang === "en" ? "Cyber Insurance Premium Calculator" : "Siber Sigorta Prim Hesaplayıcı",
                what: lang === "en" ? "Estimates your likely cyber insurance premium range based on your company profile and security posture." : "Şirket profilinize ve güvenlik olgunluğunuza göre siber sigorta prim aralığınızı tahmin eder.",
                why: lang === "en" ? "Cyber incidents cost Turkish companies an average of 700K–2.1M TL. Insurance provides financial protection." : "Siber olaylar Türk şirketlerine ortalama 700K–2,1M TL'ye mal olmaktadır. Sigorta finansal koruma sağlar.",
              },
              {
                href: "/kep-rehberi",
                icon: "📧",
                title: "KEP İhtiyaç Değerlendirmesi",
                what: "Şirketinizin Kayıtlı Elektronik Posta (KEP) hesabı açmasının zorunlu veya önerilen olup olmadığını 3 soruda belirler.",
                why: "Yasal tebligatlarda KEP kullanılmaması, mahkeme süreçlerinde ciddi hak kayıplarına yol açabilir.",
              },
              {
                href: "/erp-tarama",
                icon: "🗄️",
                title: "ERP Güvenlik Tarama Listesi",
                what: "SAP, Logo Tiger, Netsis, Mikro gibi ERP sistemlerindeki 11 kritik güvenlik denetim maddesini kategorize eder.",
                why: "ERP sistemleri şirketin en kritik verisini barındırır. Fidye yazılımı saldırılarının birincil hedefidir.",
              },
              {
                href: "/sektorel-kiyaslama",
                icon: "📊",
                title: "Sektörel Siber Güvenlik Kıyaslama",
                what: "Siber güvenlik puanınızı 9 farklı sektörün ortalamasıyla karşılaştırır; olay maliyetleri ve en yaygın tehditleri gösterir.",
                why: "Hangi alanda geride olduğunuzu bilmek, kaynakları doğru riske yönlendirmenizi sağlar.",
              },
              {
                href: "/kvkk-ceza-sim",
                icon: "⚖️",
                title: "KVKK Ceza Simülatörü",
                what: "Seçtiğiniz KVKK ihlali türü ve ağırlaştırıcı/hafifletici koşullara göre KVK Kurulu'nun uygulayabileceği idari para cezasını hesaplar.",
                why: "Ceza maliyetini önceden bilmek, uyum yatırımlarının geri dönüşünü somutlaştırır ve önceliklendirme yapar.",
              },
              {
                href: "/phishing-sim",
                icon: "🎣",
                title: "Phishing Farkındalık Testi",
                what: "Gerçek kimlik avı senaryolarına dayanan 6 e-posta örneğiyle çalışanların phishing farkındalık seviyesini ölçer.",
                why: "Kimlik avı saldırıları tüm ihlallerin %90'ından fazlasının başlangıç noktasıdır. İnsan faktörü en büyük risktir.",
              },
              {
                href: "/domain-tarama",
                icon: "🌐",
                title: lang === "en" ? "Domain Security Scan" : "Alan Adı Güvenlik Taraması",
                what: lang === "en" ? "Analyzes SPF, DMARC, DKIM, SSL, blacklists and HTTP security headers for your domain in seconds." : "Alan adınızın SPF, DMARC, DKIM, SSL, kara liste durumunu ve HTTP güvenlik başlıklarını saniyeler içinde analiz eder.",
                why: lang === "en" ? "An unconfigured domain becomes a launchpad for phishing attacks on your customers and partners." : "Yapılandırılmamış bir alan adı, müşterilerinize ve iş ortaklarınıza yönelik phishing saldırıları için zemin hazırlar.",
              },
              {
                href: "/saldiri-simulasyonu",
                icon: "🎯",
                title: "Saldırı Simülasyonu — Siber İkiz",
                what: "Gemini AI, şirket profilinizi analiz ederek gerçekçi bir saldırı senaryosu oluşturur: saldırgan nasıl girer, ilk 24 saat ne olur, tahmini finansal etki nedir?",
                why: "Soyut riskleri somut hikâyeye dönüştürür. Patronun bütçe kararı vermesini kolaylaştıran en güçlü araç.",
              },
              {
                href: "/finansal-kayip",
                icon: "💸",
                title: "Siber Kayıp Hesaplayıcı",
                what: "Sektör, çalışan sayısı ve ciro bilgisine göre altı kategoride TL bazında siber saldırı finansal etkisini hesaplar.",
                why: "IBM CODB ve Verizon DBIR verilerine dayalı. 'Siber güvenlik neden gerekli?' sorusunu TL rakamıyla yanıtlar.",
              },
              {
                href: "/marka-koruma",
                icon: "🛡️",
                title: "Marka Koruma ve Taklit Domain Tespiti",
                what: "Alan adınızın 70+ varyantını DNS üzerinden kontrol eder. Phishing ve müşteri yönlendirme için kayıtlı sahte domain'leri tespit eder.",
                why: "Tüketicilerin %73'ü marka taklidi içeren olumsuz deneyimden sonra o markadan ayrılır. KVKK yükümlülüğü de söz konusu olabilir.",
              },
              {
                href: "/ai-guvenlik-degerlendirmesi",
                icon: "🤖",
                title: "Yapay Zeka Güvenlik Değerlendirmesi",
                what: "ChatGPT, Gemini, Copilot gibi 20+ AI aracının KVKK uyum durumu, veri saklama politikası ve şirket riskleri. 25 soruluk analizle AI veri maruz kalma haritası çıkarılır.",
                why: "KVKK'ya göre ABD menşeli AI araçlarına kişisel veri göndermek yurt dışı aktarım sayılır. Ücretsiz ChatGPT'ye girilen veriler model eğitimi için kullanılabilir.",
                price: "2.900 TL",
              },
              {
                href: "/tedarik-zinciri",
                icon: "🔗",
                title: "TPRM — Tedarik Zinciri Risk Yönetimi",
                what: "Tedarikçi domain taraması, AI risk skorkartı ve tedarikçiye anket linki gönderimi. Beyan + teknik tarama = bileşik risk skoru. DORA Madde 28 uyumlu 3 kademe TPRM modülü.",
                why: "Üretim sektöründe tehdit aktörü faaliyetleri son yılda %71 arttı; saldırıların büyük bölümü tedarikçi ağı üzerinden gerçekleşti. Avrupa alıcıları TPRM raporu istiyor.",
              },
              {
                href: "/roi-hesaplayici",
                icon: "🧮",
                title: "Siber Risk ROI Hesaplayıcı",
                what: "Sektör ve çalışan sayısına göre olası siber saldırı maliyetini, KVKK ceza riskini ve CyberStep ile sağlanacak tasarrufu TL bazında hesaplar.",
                why: "IBM 2024 verilerine göre şirketlerin ortalama siber saldırı maliyeti 350 bin – 1,2 milyon TL. ROI hesabı bütçe kararını somutlaştırır.",
              },
              {
                href: "/guven-rozeti",
                icon: "🏅",
                title: "AI Güven Rozeti",
                what: "Alan adınızı tarar, canlı güncellenen güvenlik skoru rozeti oluşturur. Tek satır HTML ile web sitenize ekleyin.",
                why: "SSL logosunun siber güvenlik versiyonu — müşteri güvenini somutlaştıran, görünür ve gömülebilir bir güvence.",
              },
              {
                href: "/dora-bddk-uyum",
                icon: "⚖️",
                title: "BDDK / SPK / EPDK / DORA Uyum Analizi",
                what: "Siber güvenlik puanınızı BDDK BSY, SPK VIII/54, EPDK ve DORA (AB) makalelerine eşler. Gemini AI domain bazlı uyum boşluğu ve yol haritası üretir.",
                why: "DORA Ocak 2025'te yürürlüğe girdi. BDDK ve SPK benzer niceliksel ICT risk zorunluluğuna hazırlanıyor. Şimdi bu dili konuşan platform olun.",
              },
              {
                href: "/eu-ai-act",
                icon: "🇪🇺",
                title: "EU AI Act Uyum Skoru",
                what: "20 soruluk değerlendirme ile şirketinizin AB Yapay Zeka Yasası kapsamındaki uyum durumunu ve risk kategorisini belirler.",
                why: "1 Ağustos 2026'dan itibaren AB'ye ürün veya hizmet sunan şirketler yükümlü. Ceza: 35 milyon Euro'ya kadar.",
                price: "1.990 TL",
              },
              {
                href: "/ai-red-team",
                icon: "🎯",
                title: "AI Red Team Raporu",
                what: "Kamuya açık kaynaklardan AI ile toplanan istihbarat — teknoloji altyapısı, yönetici bilgileri, e-posta formatı, sızıntı geçmişi. 30 dakikada saldırgan bakış açısı.",
                why: "Bir saldırgan sizi hedef almadan önce tam olarak bu analizi yapar. Açığı onlardan önce görün.",
                price: "2.490 TL",
              },
              {
                href: "/deepfake-analizi",
                icon: "🎭",
                title: "Deepfake & Ses Klonu Analizi",
                what: "Yöneticilerinizin YouTube, LinkedIn ve haber kaynaklarındaki dijital izini analiz eder. CEO fraud saldırılarına karşı ses klonu risk haritası çıkarır.",
                why: "Modern ses klonlama araçları 3 dakika ses örnekle çalışıyor. CEO fraud saldırıları Türkiye'de yılda milyonlarca TL zarara neden oluyor.",
                price: "1.490 TL",
              },
              {
                href: "/sahte-dokuman",
                icon: "📄",
                title: "AI Sahte Doküman Tespiti",
                what: "Fatura, sözleşme, kimlik ve diğer belgeleri yapay zeka ile analiz eder. Metadata anomalisi, format tutarsızlığı ve manipülasyon izleri tespit edilir.",
                why: "AI ile üretilen sahte belgeler artık gözle ayırt edilemiyor. Muhasebe ve hukuk süreçlerinde tedarikçi kimliği doğrulaması kritik.",
                price: "49 TL / tarama",
              },
              {
                href: "/ai-phishing-simulasyonu",
                icon: "🎣",
                title: "AI Phishing Simülasyonu",
                what: "Şirketinizi hedef alacak yapay zeka destekli phishing e-postasını saldırganlardan önce görün. OSINT analizi + 3 gerçekçi senaryo + her senaryo için koruma yöntemi.",
                why: "Saldırganlar artık şirketinizin web sitesini, LinkedIn profilini ve kamuya açık verilerini yapay zeka ile analiz edip çalışanlarınıza özel e-postalar hazırlıyor.",
                price: "1.990 TL",
              },
              {
                href: "/ai-arac-izleme",
                icon: "📡",
                title: "AI Araç İzleme",
                what: "ChatGPT, Gemini, Copilot gizlilik politikası değişince anında e-posta bildirimi alın. 20+ AI aracı haftalık kontrol, KVKK uyum puanı güncelleme.",
                why: "AI araç politikaları sessiz sedasız değişiyor. Şirketinize ait veri aniden farklı bir ülkede işlenmeye başlayabilir.",
                price: "490 TL/ay",
              },
              {
                href: "/ai-politika",
                icon: "📑",
                title: "AI Politika Otogüncelleme",
                what: "Şirketinizin yapay zeka kullanım politikasını yasal değişikliklere göre otomatik güncelleyen canlı belge. KVKK, EU AI Act ve sektörel düzenlemeler takip edilir.",
                why: "Manuel politika güncelleme hem zaman alır hem hatalara açıktır. Politika boşlukları KVKK ihlali ve EU AI Act cezasına yol açabilir.",
                price: "990 TL/yıl",
              },
              {
                href: "/sanal-ciso",
                icon: "🛡️",
                title: "Sanal CISO",
                what: "Sertifikalı partner CISO'lardan aylık yönetim kurulu raporu, güvenlik stratejisi, olay müdahalesi koordinasyonu ve düzenleyici destek.",
                why: "CISO pozisyonu yıllık 2-4 milyon TL maaşla geliyor. Şirketlerin %99'unun tam zamanlı CISO'ya ihtiyacı yok — ama CISO düzeyinde stratejiye ihtiyacı var.",
                price: "8.000 TL/ay",
              },
            ].map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="group block rounded-xl border bg-card p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl shrink-0 mt-0.5">{tool.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors leading-snug">
                        {tool.title}
                      </h3>
                      {"price" in tool && tool.price && (
                        <span className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {tool.price}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wide">Ne yapar?</span>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{tool.what}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Neden gerekli?</span>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{tool.why}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-primary mt-3 group-hover:gap-2 transition-all font-medium">
                      {lang === "en" ? "Launch tool" : "Aracı Aç"} <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </a>
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

      {/* vCISO callout */}
      <section className="py-16 bg-background border-t">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="flex-1">
                <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mb-3">
                  Sanal CISO · vCISO as a Service
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Sirketinizin CISO'su olsun —<br className="hidden sm:block" /> kadro maliyeti olmadan
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                  Şirketlerin yüzde 99'unun CISO'su yok. Tam zamanlı CISO yıllık 2–4 milyon TL maaşla geliyor.
                  CyberStep Sanal CISO'su aylık yönetim kurulu sunumu, yıllık güvenlik stratejisi,
                  olay müdahalesi ve düzenleyici destek sunar — sertifikalı partner uzmanlardan.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Aylık YK Raporu", "Güvenlik Stratejisi", "Olay Müdahalesi", "KVKK / BDDK Desteği"].map(tag => (
                    <span key={tag} className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 shrink-0">
                <div className="text-center mb-1">
                  <p className="text-xs text-muted-foreground">Baslangic fiyati</p>
                  <p className="text-3xl font-black text-primary">8.000 TL<span className="text-sm font-normal text-muted-foreground">/ay</span></p>
                </div>
                <Link
                  href="/sanal-ciso"
                  className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-12 px-7 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Detaylar ve Teklif
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
                <Link
                  href="/sanal-ciso#basvuru"
                  className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-12 px-7 border-2 border-primary text-primary hover:bg-primary/10 transition-colors"
                >
                  Hemen Teklif Al
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

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
