import { useState } from "react";
import { ArrowRight, Code2, Globe, ShoppingCart, Users, Building2, Truck, Shield, CheckCircle2, ChevronRight, Copy, Check, Zap, AlertTriangle, Webhook, Key, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

// ─── Endpoint definitions ─────────────────────────────────────────────────────
const ENDPOINTS = [
  {
    method: "GET",
    path: "/v1/score/{domain}",
    badge: "Freemium",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-200",
    title: "Anlık Skor",
    desc: "Hızlı skor + risk seviyesi + son tarama tarihi. Widget'lar ve canlı ekranlar için optimize edilmiş en hızlı endpoint.",
    useCase: "ERP widget'ı için: Kullanıcı muhasebe yazılımını açtığında şirket domain'ini sorgulayın. Skor 60'ın altındaysa sarı uyarı, 40'ın altındaysa kırmızı banner gösterin.",
    response: `{
  "domain": "sirket.com.tr",
  "status": "scanned",
  "score": 72,
  "grade": "B",
  "risk": "medium",
  "lastScanAt": "2026-05-30T08:00:00Z",
  "summary": {
    "spf": true,
    "dmarc": false,
    "ssl": true,
    "blacklisted": false
  }
}`,
    tiers: ["freemium", "standard", "enterprise"],
  },
  {
    method: "GET",
    path: "/v1/score/{domain}/full",
    badge: "Standart+",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    title: "Tam Bulgular",
    desc: "Tam tarama sonuçları: kategori kırılımı, ihlaller, CVE listesi, açık portlar ve öneri listesi.",
    useCase: "Sigorta teklif motoru için: Başvuru formunda domain girildiğinde /full çağrısı yapın. Dönen risk alanlarını aktüeryal modelinize besleyin, prim otomatik hesaplansın.",
    response: `{
  "domain": "sirket.com.tr",
  "score": 72, "grade": "B",
  "email": { "spf": {"pass": true}, "dmarc": {"pass": false}, "dkim": {"pass": true} },
  "ssl": { "pass": true, "daysUntilExpiry": 142, "labsGrade": "A" },
  "reputation": { "blacklisted": false, "virusTotalMalicious": 0 },
  "breaches": { "count": 1, "items": [...] },
  "vulnerabilities": { "cves": [...], "openPorts": [...] },
  "recommendations": [
    "DMARC kaydı eksik: _dmarc bölgenize v=DMARC1 ekleyin."
  ]
}`,
    tiers: ["standard", "enterprise"],
  },
  {
    method: "GET",
    path: "/v1/score/{domain}/certificate",
    badge: "Standart+",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    title: "Sertifika Durumu",
    desc: "Rozet token'ı, doğrulama URL'si ve ihale/tedarikçi uygunluk değerlendirmesi.",
    useCase: "Tedarik yönetimi için: Tedarikçi ekleme ekranında certificate endpoint'ini çağırın. 'useCase.supplier: false' döndüyse tedarikçiyi uyarı bayraklı gösterin.",
    response: `{
  "domain": "sirket.com.tr",
  "score": 72, "grade": "B",
  "badgeToken": "tok_abc123",
  "verificationUrl": "https://cyberstep.io/rozet/tok_abc123",
  "useCase": {
    "tender": true,
    "insurance": true,
    "supplier": true,
    "summary": "Tedarikçi onayı için yeterli."
  }
}`,
    tiers: ["standard", "enterprise"],
  },
  {
    method: "POST",
    path: "/v1/scan/trigger",
    badge: "Standart+",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    title: "Anlık Tarama Tetikle",
    desc: "Senkron yanıt beklemek yerine async model: endpoint'i tetikle, tarama bitince sonuç webhook'a düşer.",
    useCase: "Fintech entegrasyonu için: Yeni müşteri kaydında domain'i trigger'a gönderin. Tarama tamamlandığında webhook'unuza gelen sonuca göre onboarding akışını yönlendirin.",
    request: `POST /api/v1/scan/trigger
{
  "domain": "musteri.com.tr",
  "webhookUrl": "https://sizin-platform.com/hooks/cyberstep",
  "priority": "high"
}`,
    response: `// Anlık yanıt (202 Accepted):
{ "accepted": true, "scanId": "scan_1748599200_x7k2m1",
  "estimatedCompletionMs": 30000 }

// ~30sn sonra webhook'unuza POST:
{ "event": "scan.complete", "scanId": "scan_...",
  "domain": "musteri.com.tr",
  "result": { "score": 65, "grade": "B", ... } }`,
    tiers: ["standard", "enterprise"],
  },
  {
    method: "GET",
    path: "/v1/benchmark/{sector}",
    badge: "Standart+",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    title: "Sektör Benchmark",
    desc: "Sektör ortalaması, medyan, percentil dağılımı ve grade dağılımı. Sigorta aktüeryal modelleri için kritik.",
    useCase: "Aktüeryal model için: Başvurucu sektörünü /benchmark/{sector}'a gönderin. Dönen medyan skora göre başvurucunun sektör içindeki konumunu belirleyin ve prim çarpanını ayarlayın.",
    response: `{
  "sector": "finans",
  "sectorLabel": "Finans",
  "sampleSize": 847,
  "scores": { "mean": 61.4, "median": 63, "p25": 48, "p75": 76, "p90": 84 },
  "gradeDistributionPct": { "A": 12.1, "B": 34.7, "C": 31.2, "D": 14.8, "F": 7.2 },
  "insight": "Finans sektörü orta risk bölgesinde..."
}`,
    tiers: ["standard", "enterprise"],
  },
];

const TIERS = [
  {
    name: "Freemium",
    price: "0 TL",
    unit: "/ ay",
    quota: "Günlük 10 çağrı",
    features: [
      "GET /v1/score/{domain} endpoint'i",
      "JSON yanıt · HTTPS",
      "Sandbox test ortamı",
      "E-posta destek",
    ],
    notIncluded: ["/full, /certificate, /benchmark", "Webhook desteği", "SLA garantisi"],
    cta: "Ücretsiz Başla",
    highlight: false,
  },
  {
    name: "Standart",
    price: "490 TL",
    unit: "/ ay",
    quota: "Aylık 1.000 çağrı",
    badge: "En Popüler",
    features: [
      "Tüm 5 endpoint",
      "Webhook desteği",
      "Domain başına saatlik rate limit",
      "Aylık kullanım raporu",
      "SLA %99.9",
      "Telefon destek",
    ],
    extra: "1.000 ek çağrı = 150 TL",
    notIncluded: [],
    cta: "Standart Başla",
    highlight: true,
  },
  {
    name: "Kurumsal",
    price: "Görüşme",
    unit: "",
    quota: "Sınırsız çağrı",
    features: [
      "Tüm Standart özellikler",
      "Özel SLA · %99.99",
      "White-label seçeneği",
      "Özel endpoint geliştirme",
      "Tehdit istihbaratı feed (opsiyonel)",
      "Dedicated müşteri temsilcisi",
    ],
    notIncluded: [],
    cta: "Teklif Al",
    highlight: false,
  },
];

const USE_CASES = [
  { icon: ShoppingCart, title: "E-Ticaret / Pazaryeri", example: "Trendyol, HepsiBurada", desc: "Satıcı güvenlik skoru profilde gösterilir." },
  { icon: Users, title: "İK Platformu", example: "LinkedIn, Kariyer.net", desc: "Kurumsal işveren değerlendirmesinde kullanılır." },
  { icon: Building2, title: "Bankacılık / Fintech", example: "KOBİ kredi platformları", desc: "Kredi başvurusunda otomatik risk değerlendirmesi." },
  { icon: Truck, title: "Lojistik / Tedarik", example: "Tedarik yönetim yazılımları", desc: "Tedarikçi ekleme onayında kullanılır." },
  { icon: Shield, title: "Siber Güvenlik Yazılımı", example: "SIEM, GRC platformları", desc: "Türkiye domain skoru mevcut platforma eklenir." },
  { icon: Globe, title: "Sigorta / Aktüeryal", example: "Sigorta şirketleri", desc: "Prim fiyatlaması için sektör benchmark verisi." },
];

const ABUSE_CONTROLS = [
  { icon: Key, title: "Domain başına rate limit", desc: "Aynı domain için saatte 1 sorgu. Toplu rakip taraması engellenir." },
  { icon: BarChart3, title: "Anomali uyarısı", desc: "Bir API key'den 100+ farklı domain sorgulandığında admin panelinde uyarı." },
  { icon: AlertTriangle, title: "ToS kısıtlaması", desc: "Rakip istihbaratı ve toplu veri toplama kullanım şartlarına aykırı." },
];

type FormState = { name: string; email: string; company: string; useCase: string; estimatedVolume: string; message: string };
const EMPTY: FormState = { name: "", email: "", company: "", useCase: "", estimatedVolume: "", message: "" };
const USE_CASE_OPTIONS = ["E-ticaret / Pazaryeri", "İK / İşe Alım", "Bankacılık / Fintech", "Lojistik / Tedarik Zinciri", "Sigorta / Aktüeryal", "Siber Güvenlik Yazılımı", "Diğer"];

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-slate-800/50">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-slate-400 hover:text-white transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-4 text-xs text-emerald-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

export default function SkorApi() {
  usePageMeta({
    title: "Skor API v1 | CyberStep.io",
    description: "CyberStep domain güvenlik skoru API'si. 5 endpoint, 3 katman fiyatlandırma, webhook desteği. Freemium günlük 10 çağrı ücretsiz.",
  });

  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

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
        toast({ title: "Başvurunuz alındı", description: "API erişim ekibimiz 1 iş günü içinde API anahtarınızı iletecek." });
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
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="flex flex-col md:flex-row items-start gap-12">
            <div className="flex-1">
              <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">
                <Code2 className="h-3.5 w-3.5 mr-1.5" />CyberStep Skor API — v1
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
                5 Endpoint.<br />3 Katman.<br />Webhook Dahil.
              </h1>
              <p className="text-white/80 text-base leading-relaxed mb-6 max-w-md">
                Türkiye'nin kredi notu benzeri domain güvenlik skoru API'si.
                Freemium'dan Kurumsal'a sıfır entegrasyon maliyetiyle başlayın.
              </p>
              <div className="flex items-center gap-4 text-sm text-white/60 mb-8">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" />&lt;200ms yanıt</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" />REST · JSON</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" />%99.9 SLA</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-8">
                  <a href="#basvuru">API Anahtarı Al <ArrowRight className="h-4 w-4 ml-2" /></a>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <a href="#endpoints">Dokümantasyon</a>
                </Button>
              </div>
            </div>
            <div className="md:w-80 w-full shrink-0">
              <CodeBlock lang="bash" code={`# API anahtarını header'a ekleyin
curl -H "Authorization: Bearer csk_your_key" \\
  https://cyberstep.io/api/v1/score/sirket.com.tr`} />
              <div className="mt-3">
                <CodeBlock lang="json" code={`{
  "domain": "sirket.com.tr",
  "score": 72,
  "grade": "B",
  "risk": "medium",
  "lastScanAt": "2026-05-30T08:00:00Z"
}`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-8 border-b bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { val: "5", label: "Endpoint" },
              { val: "< 200ms", label: "P99 Yanıt Süresi" },
              { val: "%99.9", label: "SLA (Standart+)" },
              { val: "/v1/", label: "Versiyonlu API" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/50 p-4 bg-card/50">
                <p className="text-xl font-black text-primary">{s.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Endpoint Docs */}
      <section id="endpoints" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Endpoint Referansı</Badge>
            <h2 className="text-3xl font-bold text-foreground">5 Endpoint, Farklı İhtiyaçlar</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Her senaryoya özel endpoint. Dokümantasyon = satış aracı.</p>
          </div>

          <div className="space-y-6">
            {ENDPOINTS.map((ep, i) => (
              <div key={ep.path} className={`rounded-2xl border p-6 ${i === 0 ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/10" : "border-border/50 bg-card/30"}`}>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`text-xs font-black px-2 py-0.5 rounded font-mono ${ep.method === "GET" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"}`}>
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono text-foreground font-bold">/api{ep.path}</code>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ep.badgeColor}`}>{ep.badge}</span>
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{ep.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{ep.desc}</p>
                    <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs">
                      <span className="font-bold text-primary block mb-1">Gerçek Kullanim Senaryosu</span>
                      <span className="text-muted-foreground">{ep.useCase}</span>
                    </div>
                  </div>
                  <div className="lg:w-72 shrink-0 space-y-2">
                    {ep.request && <CodeBlock lang="request" code={ep.request} />}
                    <CodeBlock lang="response" code={ep.response} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="fiyatlar" className="py-20 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Fiyatlandırma</Badge>
            <h2 className="text-3xl font-bold text-foreground">3 Katman · Şeffaf Fiyat</h2>
            <p className="text-muted-foreground mt-3">Freemium ile başla, büyüdükçe yükselt. İptal her zaman mümkün.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map(t => (
              <div key={t.name} className={`relative rounded-2xl border p-6 flex flex-col gap-4 ${t.highlight ? "border-primary/40 bg-primary/5 shadow-lg" : "border-border/50 bg-card/30"}`}>
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
                    {t.unit && <span className="text-sm text-muted-foreground mb-1">{t.unit}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{t.quota}</p>
                  {t.extra && <p className="text-xs text-orange-500 mt-1">{t.extra}</p>}
                </div>
                <div className="flex-1 space-y-2">
                  {t.features.map(f => (
                    <div key={f} className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {t.notIncluded.map(f => (
                    <div key={f} className="flex items-start gap-1.5 text-xs opacity-40">
                      <span className="h-3.5 w-3.5 shrink-0 mt-0.5 flex items-center justify-center text-muted-foreground">—</span>
                      <span className="line-through">{f}</span>
                    </div>
                  ))}
                </div>
                <Button asChild size="sm" variant={t.highlight ? "default" : "outline"}
                  className={t.highlight ? "bg-primary text-primary-foreground font-semibold" : "border-primary text-primary hover:bg-primary/10 bg-transparent font-semibold"}>
                  <a href="#basvuru">{t.cta} <ChevronRight className="h-3.5 w-3.5 ml-1" /></a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Webhook architecture */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
                <Webhook className="h-3.5 w-3.5 mr-1.5" />Async Webhook Modeli
              </Badge>
              <h2 className="text-2xl font-bold text-foreground mb-4">Bekleme Yok, Callback Var</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Tarama 15–45 saniye sürer. Senkron beklemek yerine <code className="bg-muted px-1 py-0.5 rounded text-xs">/v1/scan/trigger</code>'a gönderin,
                anında 202 alın. Tarama bitince CyberStep sizin webhook URL'nize POST atar.
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "POST /v1/scan/trigger → 202 Accepted + scanId" },
                  { step: "2", text: "CyberStep arka planda taramayı çalıştırır" },
                  { step: "3", text: "Tamamlanınca webhook URL'nize scan.complete event'i gönderilir" },
                  { step: "4", text: "Event'i işleyin, müşteriye sonucu gösterin" },
                ].map(s => (
                  <div key={s.step} className="flex gap-3 items-start">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{s.step}</div>
                    <span className="text-sm text-muted-foreground">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <CodeBlock lang="webhook payload" code={`// CyberStep → Sizin sunucunuz
POST https://sizin-platform.com/hooks/cyberstep
X-CyberStep-Event: scan.complete
X-CyberStep-Scan-Id: scan_1748599200_x7k2m1

{
  "event": "scan.complete",
  "scanId": "scan_1748599200_x7k2m1",
  "domain": "musteri.com.tr",
  "timestamp": "2026-05-30T08:32:14Z",
  "result": {
    "score": 65,
    "grade": "B",
    "risk": "medium",
    ...
  }
}`} />
          </div>
        </div>
      </section>

      {/* Abuse prevention */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4 border-orange-300 text-orange-600 bg-orange-500/5">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Kötüye Kullanim Korumalari
            </Badge>
            <h2 className="text-2xl font-bold text-foreground">Veri Gizliliği ve Fair Use</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ABUSE_CONTROLS.map(c => (
              <div key={c.title} className="rounded-xl border border-border/50 bg-card/30 p-5">
                <c.icon className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold text-sm text-foreground mb-1.5">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Kim Kullanıyor?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map(u => (
              <div key={u.title} className="border border-border/50 rounded-xl p-4 bg-card/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <u.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{u.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{u.desc}</p>
                <p className="text-xs text-primary/70 font-medium">{u.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Postman note */}
      <section className="py-10 bg-muted/10 border-t border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="h-14 w-14 rounded-xl bg-orange-500/10 border border-orange-200 flex items-center justify-center shrink-0">
              <Code2 className="h-7 w-7 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground mb-1">Postman Koleksiyonu</p>
              <p className="text-sm text-muted-foreground">
                API anahtarınızla birlikte hazır Postman koleksiyonu iletilir.
                İmport edin, API key'i girin — 5 dakikada entegrasyonu test etmeye başlayın.
                Tüm endpoint'ler örnek istek ve beklenen yanıtlarla önceden doldurulmuş gelir.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20">
              <a href="#basvuru">Erken Erişim <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></a>
            </Button>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="basvuru" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Key className="h-3.5 w-3.5 mr-1.5" />1 Is Gununde API Anahtari
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">API Erişimi Talep Et</h2>
            <p className="text-muted-foreground mt-3">Freemium ile başlayın — kredi kartı gerekmez.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Is E-postasi <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Firma <span className="text-red-500">*</span></Label>
              <Input value={form.company} onChange={e => set("company")(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Kullanim Senaryosu</Label>
              <Select value={form.useCase} onValueChange={set("useCase")}>
                <SelectTrigger><SelectValue placeholder="Platformunuzu tanımlayın..." /></SelectTrigger>
                <SelectContent>{USE_CASE_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahmini Aylik Cagri Hacmi</Label>
              <Select value={form.estimatedVolume} onValueChange={set("estimatedVolume")}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>
                  {["< 1.000 (Freemium)", "1.000–10.000 (Standart)", "10.000–100.000 (Standart+)", "100.000+ (Kurumsal)"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entegrasyon Detayi</Label>
              <Textarea value={form.message} onChange={e => set("message")(e.target.value)} placeholder="Platform, teknik altyapı ve kullanım senaryosunu kısaca anlatın." className="min-h-[80px]" />
            </div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
              {sending ? "Gonderiliyor..." : "API Erişimi Talep Et"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Freemium plan için kredi kartı gerekmez. Standart plan 14 gün ücretsiz.</p>
          </form>
        </div>
      </section>
    </div>
  );
}
