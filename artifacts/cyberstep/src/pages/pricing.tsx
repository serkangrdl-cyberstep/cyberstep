import { Link } from "wouter";
import { CheckCircle2, XCircle, ChevronRight, Shield, Users, Clock, Award, UserCheck, Eye, FileText, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRICING_PLANS } from "@/lib/constants";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery } from "@tanstack/react-query";

interface DbPlan { id: number; slug: string; name: string; price: string; currency: string; isActive: boolean; }

function fmtTL(price: string | undefined): string {
  const n = parseFloat(price ?? "0");
  if (!n) return "";
  return new Intl.NumberFormat("tr-TR").format(n) + " TL";
}

const TRUST_ITEMS = [
  { icon: Shield, text: "256-bit SSL şifreli güvenli ödeme" },
  { icon: Users, text: "500+ KOBİ tarafından tercih edildi" },
  { icon: Clock, text: "24-48 saat içinde uzman değerlendirmesi" },
  { icon: Award, text: "KVKK uyumlu veri işleme" },
];

type CompRow =
  | { header: true; label: string }
  | { header?: false; label: string; mini: string | boolean; full: string | boolean };

const COMPARISON_ROWS: CompRow[] = [
  { header: true, label: "Değerlendirme" },
  { label: "Soru sayısı", mini: "20", full: "55" },
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
                <p className="text-xs text-muted-foreground mt-1">tek seferlik — 7 günlük memnuniyet garantisi</p>
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
                <p className="text-xl font-bold text-primary mb-3">990 TL <span className="text-sm font-normal text-muted-foreground">/ yıl</span></p>
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
                <p className="text-xl font-bold text-primary mb-3">490 TL <span className="text-sm font-normal text-muted-foreground">/ ay</span></p>
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
                <p className="text-xl font-bold text-primary mb-3">1.990 TL <span className="text-sm font-normal text-muted-foreground">· tek seferlik</span></p>
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
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">%30 Tasarruf</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">AI Politika + AI Araç İzleme (12 ay) + AI Phishing Simülasyonu — tam koruma paketinde.</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="line-through text-muted-foreground">8.850 TL</span>
                  <span className="text-2xl font-bold text-primary">5.990 TL</span>
                  <span className="text-muted-foreground">/ yıl</span>
                </div>
              </div>
              <Link href="/iletisim" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shrink-0">
                Paket Teklifi Al <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* vCISO upsell card */}
      <section className="pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <UserCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground">Sanal CISO Hizmeti</h3>
                <span className="text-xs font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">Kurumsal</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                CISO'nuz yoksa, kiralamak zorunda da degilsiniz. Sertifikalı partner CISO'lardan aylık yönetim kurulu raporu,
                güvenlik stratejisi, olay müdahalesi koordinasyonu ve düzenleyici destek — aylık <strong className="text-foreground">8.000 TL</strong>'den.
              </p>
            </div>
            <Link
              href="/sanal-ciso"
              className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
            >
              Detaylar ve Teklif <ChevronRight className="ml-1.5 h-4 w-4" />
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
