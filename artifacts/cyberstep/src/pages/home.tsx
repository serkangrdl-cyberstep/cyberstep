import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, ChevronRight, CheckCircle, BarChart, ShieldAlert, Building2, TrendingUp, Award, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { value: "500+", label: "KOBİ Analiz Edildi" },
  { value: "3.2dk", label: "Ortalama Test Süresi" },
  { value: "%94", label: "Müşteri Memnuniyeti" },
  { value: "20", label: "Kritik Kontrol Noktası" },
];

const TESTIMONIALS = [
  {
    name: "Ahmet Yılmaz",
    title: "Genel Müdür",
    company: "Yılmaz Tekstil A.Ş.",
    sector: "Üretim",
    text: "Siber güvenlik konusunda nerede durduğumuzu hiç bilmiyorduk. CyberStep testi sayesinde 3 kritik açığımızı fark ettik ve hemen aksiyon aldık. Uzman ekibin değerlendirmesi son derece aydınlatıcıydı.",
    score: "Kritik",
  },
  {
    name: "Fatma Demir",
    title: "Finans Direktörü",
    company: "Demir Muhasebe Yazılım",
    sector: "Teknoloji",
    text: "Müşteri verilerini işleyen bir şirket olarak güvenlik sorumluluğumuz büyük. Rapor, önceliklerimizi netleştirdi. Eksiklerimizi görsel olarak anlamak çok işe yaradı.",
    score: "Yüksek",
  },
  {
    name: "Mehmet Çelik",
    title: "Operasyon Müdürü",
    company: "Çelik Lojistik Ltd.",
    sector: "Hizmet",
    text: "Teknik bilgimiz sınırlı ama test sorular açık ve anlaşılırdı. Uzman değerlendirmesi geldikten sonra BT danışmanımızla birebir çalıştık. Kesinlikle tavsiye ediyorum.",
    score: "Orta",
  },
];

const SECTOR_RISKS = [
  {
    sector: "Finans & Sigorta",
    icon: "🏦",
    risks: ["IBAN sahtekarlığı ve BEC saldırıları", "Müşteri veri sızıntısı", "Fidye yazılımı ile iş sürekliliği kaybı"],
    color: "border-blue-200 bg-blue-50/50",
  },
  {
    sector: "Sağlık",
    icon: "🏥",
    risks: ["Hasta kayıtlarına yetkisiz erişim", "KVKK uyumsuzluk cezaları", "Tıbbi cihaz güvenlik açıkları"],
    color: "border-red-200 bg-red-50/50",
  },
  {
    sector: "Perakende & E-ticaret",
    icon: "🛒",
    risks: ["Ödeme sistemi veri hırsızlığı", "Müşteri hesabı ele geçirme", "Tedarik zinciri saldırıları"],
    color: "border-orange-200 bg-orange-50/50",
  },
  {
    sector: "Üretim & Sanayi",
    icon: "🏭",
    risks: ["OT/IT sistemlerinde güvenlik açıkları", "Üretim duruşuna yol açan fidye yazılımı", "Fikri mülkiyet hırsızlığı"],
    color: "border-purple-200 bg-purple-50/50",
  },
];

const FAQS = [
  {
    q: "Değerlendirme teknik bilgi gerektiriyor mu?",
    a: "Hayır. Test, teknik olmayan yöneticiler için tasarlanmıştır. Sorular günlük iş süreçlerinizle ilgilidir ve herhangi bir teknik altyapı gerektirmez.",
  },
  {
    q: "Cevaplarım güvende mi?",
    a: "Verileriniz şifreli olarak saklanır ve yalnızca sizinle paylaşılır. Üçüncü taraflarla kesinlikle paylaşılmaz.",
  },
  {
    q: "Sonuçları ne zaman alacağım?",
    a: "Test tamamlandıktan sonra risk skorunuz ve kırmızı alarm sayınız anında gösterilir. Uzman ekibimiz sonuçlarınızı değerlendirip detaylı raporu 24-48 saat içinde iletir.",
  },
  {
    q: "Raporun tamamını neden hemen göremiyorum?",
    a: "Doğru ve yanıltıcı olmayan bir değerlendirme için uzman ekibimiz AI analizini inceleyip onaylar. Bu süreç raporun kalitesini garanti eder.",
  },
  {
    q: "Mini ve Tam Değerlendirme arasındaki fark nedir?",
    a: "Mini Değerlendirme 20 soru ile genel risk profilinizi ortaya koyar. Yakında sunulacak Tam Değerlendirme ise 55 soru, sektör karşılaştırması ve birebir uzman danışmanlığı içerir.",
  },
];

const scoreColor: Record<string, string> = {
  Kritik: "bg-red-100 text-red-700 border-red-200",
  Yüksek: "bg-orange-100 text-orange-700 border-orange-200",
  Orta: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

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
  if (num === 0) return "Ücretsiz";
  return new Intl.NumberFormat("tr-TR").format(num) + " ₺";
}

function getPlanMeta(plan: PricingPlan): { cta: string; href: string; highlight: boolean; badge?: string } {
  if (plan.slug === "mini") {
    return { cta: "Hemen Başla", href: "/assessment/start", highlight: false };
  }
  return { cta: "Bildirim Al", href: "#", highlight: true, badge: "Yakında" };
}

const STATIC_PRICING = [
  {
    name: "Mini Değerlendirme",
    displayPrice: "Ücretsiz",
    description: "İlk adım olarak şirketinizin genel siber güvenlik durumunu hızlıca öğrenin.",
    features: [
      "20 kritik kontrol sorusu",
      "5 temel güvenlik alanı",
      "Anlık risk skoru",
      "Kırmızı alarm tespiti",
      "Uzman ön değerlendirmesi",
    ],
    cta: "Hemen Başla",
    href: "/assessment/start",
    highlight: false,
    badge: undefined as string | undefined,
  },
  {
    name: "Tam Değerlendirme",
    displayPrice: "Yakında",
    description: "Derinlemesine analiz ve tam kapsamlı aksiyon planı ile güvenliğinizi zirveye taşıyın.",
    features: [
      "55 kapsamlı soru",
      "10 güvenlik alanı",
      "PDF rapor indirme",
      "Sektör karşılaştırması",
      "Uzman danışmanlık görüşmesi",
      "Öncelikli aksiyon yol haritası",
    ],
    cta: "Bildirim Al",
    href: "#",
    highlight: true,
    badge: "Yakında",
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: pricingPlans, isLoading: pricingLoading } = useQuery<PricingPlan[]>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const displayPlans = pricingPlans && pricingPlans.length > 0
    ? pricingPlans.map(plan => {
        const meta = getPlanMeta(plan);
        return {
          name: plan.name,
          displayPrice: formatPrice(plan),
          description: plan.description,
          features: plan.features,
          ...meta,
        };
      })
    : STATIC_PRICING;

  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="py-20 md:py-32 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              <span>KOBİ'ler için Siber Güvenlik Analizi</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Siber risklerinizi görünür kılın, önlem alın.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Şirketinizin siber güvenlik olgunluğunu 5 dakikada ölçün. Zayıf noktalarınızı keşfedin ve profesyonel bir yol haritası ile güvende kalın.
            </p>
            <div className="pt-4">
              <Link
                href="/assessment/start"
                className="inline-flex items-center justify-center rounded-md text-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8"
              >
                Ücretsiz Değerlendirme Başla
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
            <h2 className="text-3xl font-bold text-foreground">Nasıl Çalışır?</h2>
            <p className="text-muted-foreground mt-4">Sadece 3 adımda siber güvenlik durumunuzu analiz edin.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">1. Formu Doldurun</h3>
              <p className="text-muted-foreground">İşletmenizle ilgili 20 kritik soruyu yanıtlayın. Teknik bilgi gerektirmez.</p>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <BarChart className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">2. Risk Skorunuzu Görün</h3>
              <p className="text-muted-foreground">Cevaplarınız analiz edilir, risk skorunuz ve kritik açıklarınız anında hesaplanır.</p>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">3. Uzman Raporunuzu Alın</h3>
              <p className="text-muted-foreground">Uzman ekibimiz sonuçlarınızı değerlendirip 24-48 saat içinde kişiselleştirilmiş raporu iletir.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sector Risks */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Sektörel Riskler</Badge>
            <h2 className="text-3xl font-bold">Sektörünüzü Etkileyen Tehditler</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Her sektörün kendine özgü siber güvenlik riskleri vardır. CyberStep, sektörünüze özel risk profilinizi çıkarır.
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

      {/* Pricing */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Fiyatlandırma</Badge>
            <h2 className="text-3xl font-bold">Şeffaf ve Erişilebilir</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Mini değerlendirme tamamen ücretsiz. Daha derin analiz için Tam Değerlendirme yakında geliyor.
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
                      plan.highlight
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    onClick={plan.highlight ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                  >
                    {plan.cta}
                    {!plan.highlight && <ChevronRight className="ml-2 h-4 w-4" />}
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
            <Badge variant="outline" className="mb-4">Referanslar</Badge>
            <h2 className="text-3xl font-bold">KOBİ'ler Ne Diyor?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-card rounded-xl border p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.title}, {t.company}</p>
                    </div>
                  </div>
                  <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${scoreColor[t.score] ?? ""}`}>
                    {t.score}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {t.sector}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">SSS</Badge>
            <h2 className="text-3xl font-bold">Sık Sorulan Sorular</h2>
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

      {/* CTA Bottom */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Güvenliğinizi test etmek için bir dakikanız var mı?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Ücretsiz Mini Değerlendirme ile şirketinizin siber güvenlik açıklarını hemen keşfedin.
          </p>
          <Link
            href="/assessment/start"
            className="inline-flex items-center justify-center rounded-md text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 transition-colors"
          >
            Ücretsiz Başla <ChevronRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
