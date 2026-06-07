import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle2, ArrowRight, Zap, BarChart3, FileText, Database, Globe, TrendingUp, Lock, Building2, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const PRODUCTS = [
  {
    id: "A",
    icon: Newspaper,
    badge: "Ücretsiz · Otorite İnşası",
    title: "Türkiye Tehdit Raporu",
    subtitle: "Yıllık Kamuya Açık Rapor",
    desc: "CyberStep verilerinden derlenen Türkiye'nin yıllık siber tehdit haritası. Sektörel risk skorları, en yaygın açıklar, en çok hedef alınan endüstriler.",
    audience: "Medya · Politika yapıcılar · Akademi",
    value: "Medyada yer alır, otorite kurar, organik büyüme sağlar",
    features: [
      "Sektör bazında risk skor dağılımı",
      "Yıllık tehdit trendi analizi",
      "En yaygın CVE ve açık kategorileri",
      "SPF / DMARC / SSL uyum oranları",
      "KOBİ öneriler bölümü",
    ],
  },
  {
    id: "B",
    icon: Database,
    badge: "Lisans Modeli · B2B",
    title: "Tehdit İstihbaratı API",
    subtitle: "Küresel Siber Güvenlik Firmalarına",
    desc: "Kaspersky, Palo Alto, CrowdStrike gibi küresel firmalara Türkiye'ye özgü IoC (Indicator of Compromise) ve tehdit verisi. Türkiye datasını global feed'e entegre ederler.",
    audience: "Kaspersky · Palo Alto · CrowdStrike · ESET",
    value: "Yıllık lisans ücreti. Veri büyüdükçe değer artar.",
    features: [
      "Türkiye'ye özgü kötü amaçlı IP / domain listesi",
      "Sektörel saldırı örüntüleri",
      "CVE trend verisi (Türkiye odaklı)",
      "Real-time IoC feed (opsiyonel)",
      "STIX / TAXII formatında export",
    ],
  },
  {
    id: "C",
    icon: BarChart3,
    badge: "Aktüeryal Veri · Sigorta",
    title: "Sigorta Aktüeryal Veri",
    subtitle: "Sigorta Şirketlerine Risk Havuzu",
    desc: "Anonim, toplulaştırılmış CyberStep verisi. Allianz ve AXA Türkiye ofisi sektör bazında siber risk maliyetlerini ve olay sıklığını bilmek istiyor.",
    audience: "Allianz Türkiye · AXA Türkiye · Zurich · Generali",
    value: "Toplu veri satış lisansı. Prim fiyatlama modeli değeri.",
    features: [
      "Sektör x skor çapraz tablosu",
      "Olay tipi sıklık analizi",
      "Ortalama açık yaşam döngüsü",
      "Coğrafi risk yoğunluk haritası",
      "Anonim veri — KVKK uyumlu",
    ],
  },
];

const USE_CASES = [
  "Siber güvenlik firması — Türkiye IoC feed'i",
  "Sigorta şirketi — aktüeryal veri",
  "Araştırma kurumu / üniversite",
  "Devlet kurumu / USOM",
  "Medya / gazetecilik",
  "Danışmanlık firması",
  "Diğer",
];

type FormState = { name: string; email: string; company: string; phone: string; useCase: string; product: string; message: string };
const EMPTY: FormState = { name: "", email: "", company: "", phone: "", useCase: "", product: "", message: "" };

export default function TehditIstihbarati() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Threat Intelligence Data Products | CyberStep.io" : "Tehdit İstihbaratı Veri Ürünleri | CyberStep.io",
    description: lang === "en" ? "CyberStep Turkey cyber threat data: annual threat report, IoC feed API for global firms, and actuarial data for insurers." : "CyberStep Türkiye siber tehdit verisi: yıllık tehdit raporu, küresel firmalar için IoC feed API ve sigorta şirketlerine aktüeryal veri.",
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
        body: JSON.stringify({ ...form, leadType: "threat-intel" }),
      });
      if (res.ok) {
        toast({ title: "Başvurunuz alındı", description: "Veri ortaklık ekibimiz en geç 3 iş günü içinde sizi arayacak." });
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">{lang === "en" ? "Threat Intelligence · Data Products" : "Tehdit İstihbaratı · Veri Ürünleri"}</Badge>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
            {lang === "en" ? <>Turkey's Largest<br />Cybersecurity Data Pool</> : <>Türkiye'nin En Büyük<br />Siber Güvenlik Veri Havuzu</>}
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            {lang === "en"
              ? "As CyberStep grows, it will have Turkey's most comprehensive cyber risk database. This data is a product in its own right — three models, three customer groups."
              : "CyberStep büyüdükçe Türkiye'nin en kapsamlı siber risk veritabanına sahip olacak. Bu veri başlı başına bir ürün — üç farklı model, üç farklı müşteri grubu."}
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-8">
            <a href="#urunler">{lang === "en" ? "Explore Products" : "Ürünleri İncele"} <ArrowRight className="h-4 w-4 ml-2" /></a>
          </Button>
        </div>
      </section>

      {/* Data asset intro */}
      <section className="py-12 border-b bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-center">
            {[
              { val: "Sektörel", label: "Türkiye'ye özgü veri", sub: "Logo, Finans, Sağlık, Perakende dahil" },
              { val: "Gerçek Zamanlı", label: "Alan tarama verisi", sub: "SPF, DMARC, SSL, CVE, Kara liste" },
              { val: "KVKK Uyumlu", label: "Anonim toplulaştırılmış", sub: "Bireysel şirket verisi paylaşılmaz" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/50 p-5 bg-card/50 text-center">
                <p className="text-lg font-black text-primary mb-1">{s.val}</p>
                <p className="font-semibold text-sm text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="urunler" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">3 Ürün · 3 Müşteri Grubu</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Aynı veri havuzu, farklı paketleme ve fiyatlandırma modelleriyle birden fazla gelir akışı.</p>
          </div>
          <div className="space-y-6">
            {PRODUCTS.map((p, idx) => (
              <div key={p.id} className={`rounded-2xl border p-7 ${idx === 0 ? "border-primary/25 bg-primary/5" : "border-border/50 bg-card/30"}`}>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <p.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded mr-2">Ürün {p.id}</span>
                        <span className="text-xs text-muted-foreground">{p.badge}</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-1">{p.title}</h3>
                    <p className="text-sm text-primary font-medium mb-3">{p.subtitle}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">Hedef kitle:</span>
                      {p.audience.split(" · ").map(a => (
                        <span key={a} className="text-xs bg-muted px-2 py-0.5 rounded text-foreground">{a}</span>
                      ))}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">{p.value}</p>
                  </div>
                  <div className="md:w-56 shrink-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">İçerik</p>
                    <ul className="space-y-1.5">
                      {p.features.map(f => (
                        <li key={f} className="flex items-start gap-1.5 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue model */}
      <section className="py-16 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Gelir Modeli</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { prod: "Ürün A", model: "Ücretsiz / Sponsorlu", color: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20", note: "Marka bilinirliği, lead magnet" },
              { prod: "Ürün B", model: "Yıllık API Lisansı", color: "border-primary/20 bg-primary/5", note: "Küresel firma ile çok yıllı sözleşme" },
              { prod: "Ürün C", model: "Toplu Veri Satışı", color: "border-green-200 bg-green-50/50 dark:bg-green-950/20", note: "Sigorta şirketine yıllık güncelleme" },
            ].map(r => (
              <div key={r.prod} className={`rounded-xl border p-5 ${r.color}`}>
                <p className="text-xs font-bold text-primary mb-1">{r.prod}</p>
                <p className="font-bold text-foreground text-sm">{r.model}</p>
                <p className="text-xs text-muted-foreground mt-2">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="basvuru" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Database className="h-3.5 w-3.5 mr-1.5" />Veri Ortakligi
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">İlgi Bildirin</h2>
            <p className="text-muted-foreground mt-3">Hangi ürün grubunda iş birliği yapmak istediğinizi belirtin.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Kurumsal E-posta <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} required /></div>
            </div>
            <div className="space-y-2"><Label>Kurum / Firma <span className="text-red-500">*</span></Label>
              <Input value={form.company} onChange={e => set("company")(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label>Kullanim amaci</Label>
              <Select value={form.useCase} onValueChange={set("useCase")}>
                <SelectTrigger><SelectValue placeholder="Sizi en iyi tanımlayan..." /></SelectTrigger>
                <SelectContent>{USE_CASES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>İlgilendiginiz Urun</Label>
              <Select value={form.product} onValueChange={set("product")}>
                <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Ürün A — Türkiye Tehdit Raporu</SelectItem>
                  <SelectItem value="B">Ürün B — Tehdit İstihbaratı API</SelectItem>
                  <SelectItem value="C">Ürün C — Sigorta Aktüeryal Veri</SelectItem>
                  <SelectItem value="all">Tümü / Görüşmek istiyorum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Mesajiniz</Label>
              <Textarea value={form.message} onChange={e => set("message")(e.target.value)} placeholder="Ne tür bir ortaklık aklınızda?" className="min-h-[80px]" /></div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
              {sending ? "Gonderiliyor..." : "İlgi Bildirimi Gönder"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
