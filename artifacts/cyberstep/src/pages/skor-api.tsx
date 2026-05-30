import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle2, ArrowRight, Zap, Code2, Globe, ShoppingCart, Users, Building2, Truck, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

const USE_CASES = [
  { icon: ShoppingCart, title: "E-Ticaret Pazaryeri", desc: "Tedarikçi güvenlik skoru satıcı profilinde görünür. Alıcı güvenilir satıcıyı tercih eder.", example: "Trendyol, HepsiBurada, Amazon Türkiye" },
  { icon: Users, title: "İK Platformu", desc: "İşveren veya işe alınan firma için güvenlik skoru. Kurumsal müşteri bunu ister.", example: "LinkedIn, Kariyer.net, Yenibiris" },
  { icon: Building2, title: "Bankacılık / Kredi", desc: "Kredi başvurusunda şirket siber skoru bir değerlendirme kriteri olarak kullanılır.", example: "KOBİ Kredi Platformları, Fintech'ler" },
  { icon: Truck, title: "Lojistik / Tedarik", desc: "Kargo firması tedarikçi seçiminde güvenlik skorunu kullanır. Risk yönetimi.", example: "Yurtiçi, MNG, Tedarikçi yönetim yazılımları" },
  { icon: Globe, title: "Sigorta / Fintech", desc: "Poliçe başvurusunda otomatik risk değerlendirmesi. Manuel anket gereksiz.", example: "Sigorta şirketleri, Risk yönetim platformları" },
  { icon: Shield, title: "Siber Güvenlik Yazılımı", desc: "Mevcut güvenlik platformuna Türkiye domain skoru entegre edin.", example: "SIEM, SOAR, GRC platformları" },
];

const TIERS = [
  {
    name: "Starter",
    price: "0,05 TL",
    unit: "/ çağrı",
    desc: "Test ve küçük hacimler",
    monthly: "500 çağrı/ay dahil",
    features: ["REST API erişimi", "JSON yanıt", "Temel skor + grade", "Sandbox ortamı", "E-posta destek"],
    cta: "Ücretsiz Başla",
    highlight: false,
  },
  {
    name: "Growth",
    price: "0,03 TL",
    unit: "/ çağrı",
    desc: "Büyüyen platformlar",
    monthly: "10.000 çağrı/ay",
    features: ["Tüm Starter özellikleri", "Aylık geçmiş domain skoru", "Webhook bildirimleri", "Önbellekli yanıtlar (5dk)", "SLA garantisi (%99.9)", "Telefon destek"],
    cta: "Growth'a Geç",
    highlight: true,
    badge: "En Popüler",
  },
  {
    name: "Enterprise",
    price: "Özel",
    unit: "fiyat",
    desc: "Yüksek hacim · Özel SLA",
    monthly: "Sınırsız çağrı",
    features: ["Tüm Growth özellikleri", "Özel rate limit", "Webhook + Push feed", "Türkiye IoC verisi (opsiyonel)", "Özel SLA · %99.99", "Dedicated müşteri temsilcisi"],
    cta: "Teklif Al",
    highlight: false,
  },
];

const RESPONSE_SAMPLE = `{
  "domain": "sirket.com.tr",
  "status": "scanned",
  "score": 72,
  "grade": "B",
  "risk": "medium",
  "lastScanAt": "2026-05-29T10:30:00Z",
  "summary": {
    "spf": true,
    "dmarc": false,
    "ssl": true,
    "blacklisted": false
  }
}`;

const USE_CASE_OPTIONS = ["E-ticaret / Pazaryeri", "İK / İşe Alım", "Bankacılık / Fintech", "Lojistik / Tedarik Zinciri", "Sigorta", "Siber Güvenlik Yazılımı", "Diğer"];

type FormState = { name: string; email: string; company: string; phone: string; useCase: string; estimatedVolume: string; message: string };
const EMPTY: FormState = { name: "", email: "", company: "", phone: "", useCase: "", estimatedVolume: "", message: "" };

export default function SkorApi() {
  usePageMeta({
    title: "Skor API | CyberStep.io",
    description: "Kredi notu gibi çalışan domain güvenlik skoru API'si. E-ticaret, bankacılık, IK, lojistik platformları için çağrı başı 0.05 TL.",
  });

  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCopy = () => {
    navigator.clipboard.writeText(RESPONSE_SAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, leadType: "score-api" }),
      });
      if (res.ok) {
        toast({ title: "Başvurunuz alındı", description: "API erişim ekibimiz 1 iş günü içinde size ulaşacak." });
        setForm(EMPTY);
      } else throw new Error();
    } catch {
      toast({ title: "Hata", description: "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/25 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
              <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">
                <Code2 className="h-3.5 w-3.5 mr-1.5" />CyberStep Skor API
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
                Güvenlik Skoru<br />Herhangi Bir Platforma
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Kredi notu API'si gibi çalışan domain güvenlik skoru.
                E-ticaret, bankacılık, İK, lojistik — herhangi bir platform
                CyberStep API'sini entegre ederek anlık güvenlik skoru sorgulayabilir.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-8">
                  <a href="#basvuru">API Erişimi Al <ArrowRight className="h-4 w-4 ml-2" /></a>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <a href="#fiyatlar">Fiyatları Gör</a>
                </Button>
              </div>
            </div>
            {/* Code sample */}
            <div className="md:w-96 w-full">
              <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-xs text-slate-400 font-mono">GET /api/public/domain-score/:domain</span>
                  <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="p-4 text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed">
                  {RESPONSE_SAMPLE}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 border-b bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { val: "< 200ms", label: "Yanıt süresi" },
              { val: "REST API", label: "JSON · HTTPS" },
              { val: "%99.9", label: "Uptime SLA" },
              { val: "0,05 TL", label: "Başlangıç fiyatı / çağrı" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/50 p-4 bg-card/50">
                <p className="text-xl font-black text-primary">{s.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Kullanım Senaryoları</Badge>
            <h2 className="text-3xl font-bold text-foreground">Hangi Platformlar Entegre Eder?</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Güvenlik skoru bir satın alma kararı, bir ortaklık kararı, bir kredi kararı — herhangi bir risk kararında değer katar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map(u => (
              <div key={u.title} className="border border-border/50 rounded-xl p-5 bg-card/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><u.icon className="h-4 w-4 text-primary" /></div>
                  <h3 className="font-semibold text-sm text-foreground">{u.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{u.desc}</p>
                <p className="text-xs text-primary/70 font-medium">{u.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="fiyatlar" className="py-20 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">API Fiyatlandırma</Badge>
            <h2 className="text-3xl font-bold text-foreground">Kullandığın Kadar Öde</h2>
            <p className="text-muted-foreground mt-3">Hacim arttıkça birim fiyat düşer. Öngörülebilir maliyet.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map(t => (
              <div key={t.name} className={`relative rounded-2xl border p-6 flex flex-col gap-4 ${t.highlight ? "border-primary/40 bg-primary/5 shadow-md" : "border-border/50 bg-card/30"}`}>
                {t.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-3">
                      <Zap className="h-3 w-3 mr-1" />{t.badge}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t.name}</p>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-3xl font-black text-primary">{t.price}</span>
                    <span className="text-sm text-muted-foreground mb-1">{t.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.monthly}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {t.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="sm" className={t.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" : "border border-primary text-primary hover:bg-primary/10 bg-transparent font-semibold"} variant={t.highlight ? "default" : "outline"}>
                  <a href="#basvuru">{t.cta} <ChevronRight className="h-3.5 w-3.5 ml-1" /></a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue potential */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Gelir Potansiyeli</h2>
            <div className="space-y-3">
              {[
                { platform: "1 E-ticaret sitesi", calls: "50.000 çağrı/ay", revenue: "2.500 TL/ay" },
                { platform: "1 İK platformu", calls: "200.000 çağrı/ay", revenue: "10.000 TL/ay" },
                { platform: "1 Banka", calls: "1.000.000 çağrı/ay", revenue: "30.000 TL/ay (toplu indirim)" },
                { platform: "10 Orta Ölçek Platform", calls: "5.000.000 çağrı/ay", revenue: "150.000+ TL/ay" },
              ].map(r => (
                <div key={r.platform} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 text-sm">
                  <span className="font-medium text-foreground">{r.platform}</span>
                  <span className="text-muted-foreground text-xs">{r.calls}</span>
                  <span className="font-bold text-primary">{r.revenue}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Tahmini hesaplama. Gerçek hacim ve indirimler sözleşmede belirlenir.</p>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="basvuru" className="py-20 bg-muted/10 border-t">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Code2 className="h-3.5 w-3.5 mr-1.5" />1 Gunde API Anahtari
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">API Erişimi Talep Et</h2>
            <p className="text-muted-foreground mt-3">Başvurunuzu aldıktan 1 iş günü içinde API anahtarınız iletilir.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Is E-postasi <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} required /></div>
            </div>
            <div className="space-y-2"><Label>Firma <span className="text-red-500">*</span></Label>
              <Input value={form.company} onChange={e => set("company")(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label>Kullanim Senaryosu</Label>
              <Select value={form.useCase} onValueChange={set("useCase")}>
                <SelectTrigger><SelectValue placeholder="Platformunuzu tanımlayın..." /></SelectTrigger>
                <SelectContent>{USE_CASE_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahmini aylik API cagri hacmi</Label>
              <Select value={form.estimatedVolume} onValueChange={set("estimatedVolume")}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>
                  {["< 1.000", "1.000–10.000", "10.000–100.000", "100.000–1.000.000", "1.000.000+"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Entegrasyon Detayi</Label>
              <Textarea value={form.message} onChange={e => set("message")(e.target.value)} placeholder="Platformunuzu, teknik altyapınızı ve entegrasyon kullanım senaryosunu kısaca anlatın." className="min-h-[80px]" /></div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
              {sending ? "Gonderiliyor..." : "API Erişimi Talep Et"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Sandbox erişimi ücretsiz. Ticari kullanım için faturalama başlar.</p>
          </form>
        </div>
      </section>
    </div>
  );
}
