import { Link } from "wouter";
import { CheckCircle2, XCircle, ChevronRight, Shield, Users, Clock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRICING_PLANS } from "@/lib/constants";

const TRUST_ITEMS = [
  { icon: Shield, text: "256-bit SSL şifreli güvenli ödeme" },
  { icon: Users, text: "500+ KOBİ tarafından tercih edildi" },
  { icon: Clock, text: "24-48 saat içinde uzman değerlendirmesi" },
  { icon: Award, text: "KVKK uyumlu veri işleme" },
];

const COMPARISON_ROWS = [
  { label: "Soru sayısı", mini: "20", full: "55" },
  { label: "Güvenlik alanı", mini: "5", full: "10" },
  { label: "Anlık risk skoru", mini: true, full: true },
  { label: "Kırmızı alarm tespiti", mini: true, full: true },
  { label: "Sektör karşılaştırması", mini: true, full: true },
  { label: "Uzman ön değerlendirmesi", mini: true, full: true },
  { label: "PDF rapor indirme", mini: false, full: true },
  { label: "Detaylı aksiyon planı", mini: false, full: true },
  { label: "KVKK uyumluluk analizi", mini: false, full: true },
  { label: "Ağ güvenliği değerlendirmesi", mini: false, full: true },
  { label: "Tedarik zinciri analizi", mini: false, full: true },
  { label: "Birebir uzman görüşmesi (1 saat)", mini: false, full: true },
];

export default function Pricing() {
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
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {PRICING_PLANS.map((plan) => (
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
                {COMPARISON_ROWS.map((row, i) => (
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
                ))}
              </tbody>
            </table>
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
