import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle2, ChevronRight, ArrowRight, Building2, Zap, Users, TrendingUp, Code2, BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

const ERP_PARTNERS = [
  { name: "Logo", users: "80.000+", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { name: "Mikro", users: "60.000+", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  { name: "Netsis", users: "35.000+", color: "bg-green-500/10 text-green-600 border-green-200" },
  { name: "Luca", users: "25.000+", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
];

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "ERP'ye API Entegrasyonu",
    desc: "Muhasebe yazılımı açılışında tek bir API çağrısı ile kullanıcının şirketi için CyberStep skoru sorgulanır.",
  },
  {
    n: "2",
    title: "Widget Ekranda Belirir",
    desc: "Ana ekranın köşesinde küçük bir güvenlik skoru göstergesi görünür. Kullanıcıya tanıdık, doğal arayüz.",
  },
  {
    n: "3",
    title: "Tıklama = Dönüşüm",
    desc: "Kullanıcı widget'a tıklayınca CyberStep'e yönlendirilir, değerlendirme başlatır. Siz komisyon alırsınız.",
  },
];

const WIDGET_SCORES = [
  { score: 72, grade: "B", risk: "Orta", color: "text-yellow-500", border: "border-yellow-400" },
  { score: 45, grade: "C", risk: "Zayıf", color: "text-orange-500", border: "border-orange-400" },
  { score: 88, grade: "A", risk: "İyi", color: "text-green-500", border: "border-green-400" },
];

const BENEFITS_ERP = [
  "Mevcut müşteri tabanına sıfır pazarlama maliyetiyle ulaş",
  "Her poliçe/rapor satışından %15 komisyon",
  "Yıllık API erişim lisansı geliri",
  "Müşteri memnuniyetinde artış — ekstra değer sunulur",
  "CyberStep entegrasyon sertifikası ve ortak marka kullanımı",
];

type FormState = { name: string; email: string; company: string; phone: string; role: string; erpSoftware: string; message: string };
const EMPTY: FormState = { name: "", email: "", company: "", phone: "", role: "", erpSoftware: "", message: "" };

export default function ErpEntegrasyonu() {
  usePageMeta({
    title: "ERP Gömülü Güvenlik | CyberStep.io",
    description: "Muhasebe ve ERP yazılımlarına CyberStep güvenlik skoru widget entegrasyonu. Logo, Mikro, Netsis, Luca kullanıcılarına ulaşın.",
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
        body: JSON.stringify({ ...form, leadType: "erp", useCase: form.erpSoftware }),
      });
      if (res.ok) {
        toast({ title: "Başvurunuz alındı", description: "Entegrasyon ekibimiz en geç 2 iş günü içinde sizi arayacak." });
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">ERP Ortaklık Programı</Badge>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
            200.000 KOBİ'ye<br />muhasebe ekranından ulaşın
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Logo, Mikro, Netsis veya Luca yazılımınıza tek bir API entegrasyonuyla
            CyberStep güvenlik widget'ı ekleyin. Müşteri her gün gördüğü ekranda
            kendi siber güvenlik skorunu görür. Tıklayınca siz komisyon alırsınız.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-8">
              <a href="#basvuru">Ortaklık Başvurusu <ArrowRight className="h-4 w-4 ml-2" /></a>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <a href="#widget-demo">Widget'ı Gör</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ERP logos */}
      <section className="py-10 border-b bg-muted/20">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-center text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-6">Hedef ERP Ekosistemi</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ERP_PARTNERS.map(p => (
              <div key={p.name} className={`rounded-xl border p-4 text-center ${p.color}`}>
                <p className="font-bold text-lg">{p.name}</p>
                <p className="text-xs opacity-70">{p.users} kullanıcı</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">Toplam erişim: <strong className="text-foreground">200.000+ KOBİ</strong></p>
        </div>
      </section>

      {/* Widget demo */}
      <section id="widget-demo" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Widget Demo</Badge>
            <h2 className="text-3xl font-bold text-foreground">Muhasebe ekranında nasıl görünür?</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Kullanıcı her gün açtığı muhasebe programında siber güvenlik skorunu görür. Tanıdık, doğal, rahatsız etmeyen.
            </p>
          </div>

          {/* Mock ERP screen */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden max-w-3xl mx-auto">
            {/* Mock ERP header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-slate-400 font-mono">Logo Tiger — Ana Ekran</span>
            </div>
            {/* Mock ERP body */}
            <div className="grid grid-cols-4 h-64">
              <div className="col-span-1 bg-slate-100 dark:bg-slate-900 border-r border-border/50 p-3">
                <div className="space-y-2">
                  {["Faturalar", "Cari Hesaplar", "Banka", "Stok", "Raporlar"].map(m => (
                    <div key={m} className="h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center px-2">
                      <span className="text-xs text-muted-foreground">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-3 p-4 relative">
                <div className="space-y-2 mb-4">
                  <div className="h-4 rounded bg-muted/60 w-3/4" />
                  <div className="h-4 rounded bg-muted/40 w-1/2" />
                  <div className="h-4 rounded bg-muted/40 w-2/3" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted/40" />)}
                </div>
                <div className="h-4 rounded bg-muted/40 w-full" />

                {/* CyberStep Widget */}
                <div className="absolute bottom-3 right-3 w-44 rounded-xl border-2 border-primary/40 bg-card shadow-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary">CyberStep</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full border-2 border-green-400 flex flex-col items-center justify-center">
                      <span className="text-sm font-black text-green-500">88</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">A — İyi</span>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Son: 28 May 2026</p>
                    </div>
                  </div>
                  <button className="mt-2 w-full text-[9px] font-semibold text-primary border border-primary/30 rounded py-1 hover:bg-primary/5">
                    Detaylı Rapor →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">Nasıl Çalışır?</h2>
          <div className="space-y-4">
            {HOW_IT_WORKS.map(s => (
              <div key={s.n} className="flex gap-4 p-5 border border-border/40 rounded-xl bg-card/30">
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black shrink-0">{s.n}</div>
                <div>
                  <p className="font-semibold text-foreground mb-1">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">ERP Firması İçin Faydalar</Badge>
              <h2 className="text-2xl font-bold text-foreground mb-6">Sıfır maliyetli ek gelir kanalı</h2>
              <ul className="space-y-3">
                {BENEFITS_ERP.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: "Mevcut kullanıcıya ulaş", val: "200K+" },
                { icon: TrendingUp, label: "Komisyon oranı", val: "%15" },
                { icon: Code2, label: "Entegrasyon süresi", val: "1 Gün" },
                { icon: BarChart3, label: "Ek iş yükü", val: "Sıfır" },
              ].map(i => (
                <div key={i.label} className="rounded-xl border border-border/50 bg-card p-4 text-center">
                  <i.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-black text-primary">{i.val}</p>
                  <p className="text-xs text-muted-foreground mt-1">{i.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Technical spec */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Teknik Gereksinimler</h2>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-border/50">
              {[
                { label: "Entegrasyon türü", val: "REST API · JSON · HTTPS" },
                { label: "Tek çağrı yanıt süresi", val: "< 200ms" },
                { label: "Endpoint", val: "GET /api/public/domain-score/:domain" },
                { label: "Auth", val: "Partner API anahtarı (header)" },
                { label: "Widget", val: "Hazır React / iframe bileşeni sağlanır" },
                { label: "Destek", val: "Dedicated integration Slack kanalı" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="basvuru" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Zap className="h-3.5 w-3.5 mr-1.5" />2 Is Gununde Teknik Brifing
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Ortaklık Başvurusu</h2>
            <p className="text-muted-foreground mt-3">Teknik entegrasyon ekibimiz 2 iş günü içinde sizi arayacak.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-7 bg-card/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="Ahmet Yilmaz" required />
              </div>
              <div className="space-y-2">
                <Label>Is E-postasi <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} placeholder="ahmet@logo.com.tr" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma Adi <span className="text-red-500">*</span></Label>
                <Input value={form.company} onChange={e => set("company")(e.target.value)} placeholder="Logo Yazilim A.S." required />
              </div>
              <div className="space-y-2">
                <Label>Gorefiniz</Label>
                <Select value={form.role} onValueChange={set("role")}>
                  <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                  <SelectContent>
                    {["CEO / Genel Mudur", "CTO / Teknik Mudur", "Is Gelistirme", "Urun Muduru", "Diger"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ERP / Muhasebe Yaziliminiz</Label>
              <Select value={form.erpSoftware} onValueChange={set("erpSoftware")}>
                <SelectTrigger><SelectValue placeholder="Hangi yazilimi gelistiriyorsunuz?" /></SelectTrigger>
                <SelectContent>
                  {["Logo Tiger / Unity", "Mikro", "Netsis", "Luca", "Uyumsoft", "Diğer / Kendimiz geliştiriyoruz"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mevcut aktif kullanici sayiniz</Label>
              <Select value={form.message} onValueChange={set("message")}>
                <SelectTrigger><SelectValue placeholder="Kullanici tabaniniz?" /></SelectTrigger>
                <SelectContent>
                  {["1.000–5.000", "5.000–20.000", "20.000–100.000", "100.000+"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 font-semibold">
              {sending ? "Gonderiliyor..." : "Ortaklık Başvurusu Yap"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
