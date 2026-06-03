import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CheckCircle2, ChevronRight, ArrowRight, Shield, Network, Globe, FileText, Building2, ScrollText, Activity, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ServiceCatalogItem {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  features: string[];
  howItWorks: { step: string; desc: string }[];
  faq: { q: string; a: string }[];
  monthlyPriceTl: string;
  setupFeeTl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

const ICONS: Record<string, React.ElementType> = {
  Network, Globe, FileText, Building2, ScrollText, Activity, Server, Shield,
};

const CATEGORY_LABELS: Record<string, string> = {
  soc: "SOC & Güvenlik Operasyonları",
  monitoring: "Sürekli İzleme",
  compliance: "Uyumluluk",
  itsm: "IT Servis Yönetimi",
};

const CATEGORY_COLORS: Record<string, string> = {
  soc: "bg-red-500/20 text-red-300 border-red-500/30",
  monitoring: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  compliance: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  itsm: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function fmtTL(val: string | number) {
  return new Intl.NumberFormat("tr-TR").format(Number(val));
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Servis Bulunamadı</h1>
        <p className="text-muted-foreground mb-4">Aradığınız servis mevcut değil.</p>
        <Link href="/fiyatlar" className="text-primary hover:underline">Tüm servisler</Link>
      </div>
    </div>
  );
}

export default function ServislerPage() {
  const [, params] = useRoute("/servisler/:slug");
  const slug = params?.slug ?? "";

  const { data: allServices = [], isLoading } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["public-service-catalog"],
    queryFn: () => fetch("/api/public/service-catalog").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const service = allServices.find(s => s.slug === slug);

  usePageMeta({
    title: service ? `${service.label} | CyberStep.io` : "Servis | CyberStep.io",
    description: service?.shortDescription ?? "CyberStep.io kurumsal güvenlik servisleri",
    canonicalPath: `/servisler/${slug}`,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!service) return <NotFound />;

  const Icon = ICONS[service.icon] ?? Shield;
  const catColor = CATEGORY_COLORS[service.category] ?? "bg-primary/20 text-primary border-primary/30";
  const features: string[] = Array.isArray(service.features) ? service.features : [];
  const howItWorks: { step: string; desc: string }[] = Array.isArray(service.howItWorks) ? service.howItWorks : [];
  const faq: { q: string; a: string }[] = Array.isArray(service.faq) ? service.faq : [];
  const hasSetup = Number(service.setupFeeTl) > 0;

  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="py-20 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <Badge className={`border text-xs font-semibold px-3 py-1 ${catColor}`}>
                {CATEGORY_LABELS[service.category] ?? service.category}
              </Badge>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">{service.label}</h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl">{service.shortDescription}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/satin-al/${service.slug}`}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Hemen Başla <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/iletisim?servis=${service.slug}`}
                className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary/10 transition-colors"
              >
                Demo İste
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fiyat + özellikler */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Özellikler listesi */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6">Neler dahil?</h2>
              {features.length > 0 ? (
                <ul className="space-y-3">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Özellik listesi yakında eklenecek.</p>
              )}

              {service.longDescription && (
                <div className="mt-8 prose prose-sm max-w-none text-muted-foreground">
                  <p>{service.longDescription}</p>
                </div>
              )}
            </div>

            {/* Fiyat kartı */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aylık Fiyat</p>
                <p className="text-4xl font-bold text-primary mb-1">{fmtTL(service.monthlyPriceTl)} TL</p>
                <p className="text-sm text-muted-foreground mb-1">aylık + KDV</p>
                {hasSetup && (
                  <p className="text-xs text-muted-foreground mb-4">
                    + {fmtTL(service.setupFeeTl)} TL kurulum ücreti (tek seferlik)
                  </p>
                )}
                <div className="space-y-2 mt-4">
                  <Link
                    href={`/satin-al/${service.slug}`}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Satın Al <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/iletisim?servis=${service.slug}`}
                    className="w-full flex items-center justify-center gap-2 border border-border py-3 rounded-xl font-medium hover:bg-muted/50 transition-colors text-sm"
                  >
                    Demo İste
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      {howItWorks.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl font-bold text-center mb-10">Nasıl çalışır?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {howItWorks.map((step, i) => (
                <div key={i} className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold text-lg">{i + 1}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.step}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SSS */}
      {faq.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl font-bold text-center mb-8">Sık Sorulan Sorular</h2>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <details key={i} className="group border rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium list-none hover:bg-muted/40 transition-colors">
                    {item.q}
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{service.label} için hazır mısınız?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Ücretsiz demo talebinde bulunun veya hemen satın alarak hizmetinizi başlatın.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/satin-al/${service.slug}`} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              Hemen Başla <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/fiyatlar" className="inline-flex items-center gap-2 border border-primary/30 text-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary/10 transition-colors">
              Tüm Servisler
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
