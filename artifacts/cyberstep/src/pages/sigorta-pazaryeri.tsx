import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle2, ArrowRight, Zap, BarChart3, FileText, TrendingUp, Clock, Star, ChevronRight, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const INSURERS = [
  { name: "Allianz", country: "Türkiye", tier: "Premium" },
  { name: "AXA", country: "Türkiye", tier: "Premium" },
  { name: "Zurich", country: "Türkiye", tier: "Premium" },
  { name: "Generali", country: "Türkiye", tier: "Standart" },
];

const HOW_CUSTOMER = [
  { n: "1", title: "CyberStep Değerlendirmesi", desc: "Tam Değerlendirme veya Domain Tarama ile güvenlik skorunuzu oluşturun." },
  { n: "2", title: "Sigorta Başvurusu", desc: "Tek tıkla CyberStep skorunuzu dilediğiniz sigortacılara başvuru belgesi olarak iletin." },
  { n: "3", title: "Anlık Teklifler", desc: "Sigortacılar puanınıza göre otomatik prim teklifi oluşturur. Karşılaştırın, seçin." },
];

const HOW_INSURER = [
  { n: "1", title: "Standart Risk Verisi", desc: "Manuel anket yerine CyberStep'in teknik ölçüm verisi. Saatler değil, saniyeler." },
  { n: "2", title: "Risk Bazlı Fiyatlama", desc: "Skoru düşük = prim artışı. Skoru yüksek = indirim. Gerçek riske dayalı aktüeryal model." },
  { n: "3", title: "Komisyon Geliri", desc: "Aracılık komisyonu CyberStep'e aittir. Sigortacı sadece kaliteli lead kazanır." },
];

const SECTORS_TR = ["Finans", "Sağlık", "Perakende", "Üretim", "Teknoloji", "İnşaat", "Lojistik", "Eğitim", "Diğer"];
const EMP_COUNTS = ["1–10", "11–50", "51–200", "201–500", "500+"];

type FormState = { name: string; email: string; company: string; phone: string; sector: string; employeeCount: string; formType: "customer" | "insurer"; message: string };
const EMPTY: FormState = { name: "", email: "", company: "", phone: "", sector: "", employeeCount: "", formType: "customer", message: "" };

export default function SigortaPazaryeri() {
  usePageMeta({
    title: "Siber Sigorta Pazaryeri | CyberStep.io",
    description: "CyberStep güvenlik skoru ile anlık siber sigorta teklifleri. Allianz, AXA, Zurich Türkiye'den tek tıkla poliçe karşılaştırması.",
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
        body: JSON.stringify({ ...form, leadType: "insurance", useCase: form.formType, role: form.formType }),
      });
      if (res.ok) {
        toast({ title: "Başvurunuz alındı", description: form.formType === "customer" ? "En kısa sürede size teklif ulaştıracağız." : "Ortaklık ekibimiz sizi arayacak." });
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">Siber Sigorta Pazaryeri — Yakında</Badge>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Siber Sigorta Teklifiniz<br />CyberStep Skorunuzda Gizli
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Türkiye'de siber sigorta pazarı yıllık %40 büyüyor.
            CyberStep skoru sigorta başvuru belgesi olarak kullanılıyor.
            Tek tıkla <strong className="text-white">Allianz, AXA ve Zurich</strong> Türkiye'den anlık prim teklifi alın.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg px-4 py-2 text-sm mb-6">
            <Clock className="h-4 w-4" />
            Erken Erişim Listesine Katılın — Açılışta öncelik sizin
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-8">
              <a href="#basvuru">Erken Erişim <ArrowRight className="h-4 w-4 ml-2" /></a>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <a href="#sigortaci">Sigortacılar İçin</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Market size */}
      <section className="py-12 border-b bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-center">
            {[
              { val: "%40+", label: "Yıllık Pazar Büyümesi", sub: "Türkiye siber sigorta pazarı" },
              { val: "4+ Saat", label: "Manuel Başvuru Süresi", sub: "Geleneksel sigorta başvurusu" },
              { val: "< 30 sn", label: "CyberStep ile", sub: "Skora dayalı anlık teklif" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/50 p-6 bg-card/50">
                <p className="text-3xl font-black text-primary mb-1">{s.val}</p>
                <p className="font-semibold text-sm text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — dual view */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Nasıl Çalışır?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">KOBİ için</h3>
              </div>
              <div className="space-y-4">
                {HOW_CUSTOMER.map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">{s.n}</div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card/30 p-6" id="sigortaci">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Sigortacı için</h3>
              </div>
              <div className="space-y-4">
                {HOW_INSURER.map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border">{s.n}</div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Score → premium visual */}
      <section className="py-16 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">Skor Prim'i Belirler</h2>
          <div className="space-y-3">
            {[
              { range: "80–100", grade: "A", risk: "Düşük Risk", premium: "Baz primin %70'i", color: "text-green-500", bg: "bg-green-500/10 border-green-200" },
              { range: "60–79",  grade: "B", risk: "Orta Risk",  premium: "Baz prim",          color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-200" },
              { range: "40–59",  grade: "C", risk: "Yüksek Risk",premium: "Baz primin %140'ı", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-200" },
              { range: "0–39",   grade: "F", risk: "Kritik Risk", premium: "Sigortacı kararına bağlı", color: "text-red-500", bg: "bg-red-500/10 border-red-200" },
            ].map(r => (
              <div key={r.grade} className={`flex items-center gap-4 rounded-xl border p-4 ${r.bg}`}>
                <div className={`text-2xl font-black ${r.color} w-8`}>{r.grade}</div>
                <div className="flex-1">
                  <span className={`text-xs font-bold ${r.color}`}>{r.range} Puan · {r.risk}</span>
                </div>
                <div className="text-sm font-semibold text-foreground text-right">{r.premium}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            Prim çarpanları gösterim amaçlıdır. Nihai teklif sigortacı kararına bağlıdır.
          </p>
        </div>
      </section>

      {/* Partner insurers */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Hedef Ortaklıklar</h2>
          <p className="text-muted-foreground text-sm mb-8">Müzakereler devam etmektedir. Ortaklık görüşmeleri için bize ulaşın.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INSURERS.map(i => (
              <div key={i.name} className="rounded-xl border border-border/50 bg-card p-4 text-center">
                <p className="font-bold text-foreground">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.country}</p>
                <span className="mt-1 inline-block text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">{i.tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead form — tabs */}
      <section id="basvuru" className="py-20 bg-muted/10 border-t">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground">Erken Erişim Listesi</h2>
            <p className="text-muted-foreground mt-3">KOBİ veya Sigortacı — hangi taraftasınız?</p>
          </div>
          <Tabs defaultValue="customer" onValueChange={v => setForm(f => ({ ...f, formType: v as "customer" | "insurer" }))}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="customer" className="flex-1">KOBİ / Sigorta Almak İstiyorum</TabsTrigger>
              <TabsTrigger value="insurer" className="flex-1">Sigortacı / İş Ortağı</TabsTrigger>
            </TabsList>
            <TabsContent value="customer">
              <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Ad Soyad <span className="text-red-500">*</span></Label>
                    <Input value={form.name} onChange={e => set("name")(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Is E-postasi <span className="text-red-500">*</span></Label>
                    <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} required /></div>
                </div>
                <div className="space-y-2"><Label>Firma Adi <span className="text-red-500">*</span></Label>
                  <Input value={form.company} onChange={e => set("company")(e.target.value)} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Sektor</Label>
                    <Select value={form.sector} onValueChange={set("sector")}>
                      <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                      <SelectContent>{SECTORS_TR.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Calisan Sayisi</Label>
                    <Select value={form.employeeCount} onValueChange={set("employeeCount")}>
                      <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                      <SelectContent>{EMP_COUNTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
                  {sending ? "Gonderiliyor..." : "Erken Erişim Listesine Katıl"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="insurer">
              <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Ad Soyad <span className="text-red-500">*</span></Label>
                    <Input value={form.name} onChange={e => set("name")(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Kurumsal E-posta <span className="text-red-500">*</span></Label>
                    <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} required /></div>
                </div>
                <div className="space-y-2"><Label>Sigorta Sirketi / Kurum <span className="text-red-500">*</span></Label>
                  <Input value={form.company} onChange={e => set("company")(e.target.value)} placeholder="Allianz Türkiye, AXA vb." required /></div>
                <div className="space-y-2"><Label>Mesajiniz</Label>
                  <Textarea value={form.message} onChange={e => set("message")(e.target.value)} placeholder="Hangi konuda is birliği yapmak istiyorsunuz?" className="min-h-[80px]" /></div>
                <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
                  {sending ? "Gonderiliyor..." : "Ortaklık Başvurusu"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
