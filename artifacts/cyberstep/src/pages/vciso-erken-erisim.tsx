import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle2, ArrowRight, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

type FormState = {
  email: string;
  name: string;
  company: string;
  title: string;
  employeeCount: string;
  currentCiso: string;
};

const EMPTY: FormState = {
  email: "", name: "", company: "", title: "", employeeCount: "", currentCiso: "",
};

const EMP_OPTIONS = ["1–10", "11–50", "51–200", "201–500", "500+"];

export default function VcisoErkenErisim() {
  usePageMeta({
    title: "vCISO Erken Erişim | CyberStep.io",
    description: "Sanal CISO hizmetimiz 2027 yol haritasında. Erken erişim listesine katılın, program başladığında ilk haberdar edenler arasında olun.",
  });

  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.company) return;
    setSending(true);
    try {
      const res = await fetch("/api/public/vciso-early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          company: form.company,
          title: form.title,
          employeeCount: form.employeeCount,
          currentCiso: form.currentCiso === "evet",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        throw new Error();
      }
    } catch {
      toast({ title: "Hata", description: "Bir sorun oluştu, lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-6">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            2027 Yol Haritası
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">
            vCISO Erken Erişim Listesi
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Tam zamanlı Sanal CISO hizmetimiz 2027 yılında hayata geçiyor.
            Erken erişim listesine katılın, program açılınca ilk siz haberdar olun.
          </p>
        </div>
      </section>

      {/* Ne bekliyor? */}
      <section className="py-14 bg-background border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-bold text-center mb-8">vCISO Programında Ne Olacak?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Aylık 2 saat birebir CISO görüşmesi",
              "Risk önceliklendirme ve yol haritası",
              "7/24 CISO danışmanlığı (Slack/e-posta)",
              "Yönetim kurulu sunumuna katılım",
              "CISO Asistan Paketi dahil",
              "Ajans süreçleri desteği (ihale, denetim)",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 p-4 border border-border/40 rounded-xl bg-card/30">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            Fiyat ve kapsam 2026 yılında netleştirilecek. Erken erişim üyeleri öncelikli fiyatlandırmadan yararlanacak.
          </p>
        </div>
      </section>

      {/* Şimdi ne yapabilirsiniz? */}
      <section className="py-12 bg-muted/20 border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
            <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">Beklemek zorunda değilsiniz</p>
            <p className="text-sm text-muted-foreground mb-4">
              vCISO programı hazır olana kadar <strong className="text-foreground">CISO Asistan Paketi</strong> ile
              aylık board raporu, haftalık tehdit özeti ve uyum takibini hemen başlatabilirsiniz.
            </p>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/sanal-ciso">CISO Asistan Paketini Gör <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-xl">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">Listeye eklendíniz</h2>
              <p className="text-muted-foreground">
                2027 yılında program başladığında e-posta ile bildirim alacaksınız.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/">Ana Sayfaya Dön</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">Erken Erişim Listesine Katıl</h2>
                <p className="text-sm text-muted-foreground">
                  Program açıldığında öncelikli bildirim ve erken fiyat garantisi.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-8 bg-card/30">
                <div className="space-y-2">
                  <Label>E-posta <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => set("email")(e.target.value)}
                    placeholder="siz@sirket.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ad Soyad</Label>
                    <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="Ad Soyad" />
                  </div>
                  <div className="space-y-2">
                    <Label>Firma <span className="text-red-500">*</span></Label>
                    <Input value={form.company} onChange={e => set("company")(e.target.value)} placeholder="Sirket A.S." required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unvan</Label>
                    <Input value={form.title} onChange={e => set("title")(e.target.value)} placeholder="CTO, IT Direktoru..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Calisan Sayisi</Label>
                    <Select value={form.employeeCount} onValueChange={set("employeeCount")}>
                      <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                      <SelectContent>
                        {EMP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mevcut CISO / Güvenlik Sorumlunuz var mi?</Label>
                  <Select value={form.currentCiso} onValueChange={set("currentCiso")}>
                    <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evet">Evet, var</SelectItem>
                      <SelectItem value="hayir">Hayir, yok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {sending ? "Kaydediliyor..." : "Erken Erisim Listesine Katil"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Spam gönderilmez. KVKK uyumlu. Istediginizde listeden cikabilirsiniz.
                </p>
              </form>
              <div className="mt-6 text-center">
                <a href="mailto:info@cyberstep.io" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 text-primary" />
                  info@cyberstep.io
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
