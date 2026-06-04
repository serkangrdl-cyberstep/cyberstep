import { useState } from "react";
import { Link } from "wouter";
import {
  Shield, CheckCircle2, ArrowRight, FileText,
  BarChart3, BookOpen, Mail, TrendingDown,
  ChevronRight, Zap, XCircle, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

const WHAT_IT_IS = [
  "CISO'nuzun rutin işlerini otomatikleştirir",
  "Board raporunu hazırlar, siz sunarsınız",
  "Politika taslakları üretir, siz onaylarsınız",
  "Uyum durumunu takip eder, siz kararı verirsiniz",
  "Tehditleri özetler, siz aksiyon alırsınız",
];

const WHAT_IT_IS_NOT = [
  "Sanal CISO değil",
  "Danışmanlık değil",
  "Telefona çıkan biri değil",
];

const FEATURES = [
  {
    icon: FileText,
    title: "Aylık Yönetim Kurulu Raporu",
    desc: "Her ayın 25'inde otomatik üretilir. Genel risk skoru, 7545 ve KVKK uyumu, finansal risk tahmini — CEO anlayacak dilde, tek sayfa A4. E-posta ve portaldan PDF olarak teslim.",
    tag: "Her ay 25'inde",
  },
  {
    icon: AlertCircle,
    title: "Haftalık Tehdit Özeti",
    desc: "Her Cuma 08:00'de kişiselleştirilmiş tehdit özeti. Türkiye'yi etkileyen CVE'ler, şirketinizin tech stack'ini etkileyen açıklar, USOM uyarıları ve bu hafta yapılması gereken 1 şey.",
    tag: "Her Cuma 08:00",
  },
  {
    icon: BarChart3,
    title: "7545 ve KVKK Uyum Skoru",
    desc: "Aylık otomatik hesaplanan uyum skoru. Siber Güvenlik Sorumlusu atama, yıllık denetim, olay müdahale planı, VERBİS kaydı, teknik tedbirler — her madde CyberStep verisiyle otomatik değerlenir.",
    tag: "Aylık",
  },
  {
    icon: BookOpen,
    title: "Güvenlik Politikası Kütüphanesi",
    desc: "Şirketinize özgü 7 politika şablonu: Bilgi Güvenliği, Şifre Yönetimi, Uzaktan Çalışma, BYOD, Veri Sınıflandırma, Olay Müdahale, Tedarikçi Değerlendirme. Türkçe, Word formatında, 7545 ve KVKK uyumlu.",
    tag: "Hemen kullanıma hazır",
  },
];

const WHO_NEEDS = [
  {
    title: "CISO'su olan ama zamanı kısıtlı şirketler",
    desc: "CISO her ay board raporu hazırlamaktan bıkmış, bunu otomatikleştirmek istiyor.",
  },
  {
    title: "CISO'su olmayan ama olması gereken şirketler",
    desc: "7545 kapsamında Siber Güvenlik Sorumlusu atamak zorunda, ama tam zamanlı bütçesi yok. Bu paket minimum uyum sağlar.",
  },
  {
    title: "IT direktörü CISO rolü de üstlenen şirketler",
    desc: "Raporlama yükünü hafifletir, uyum takibini otomatikleştirir.",
  },
];

const SECTORS = ["Finans / Bankacılık", "Sağlık", "Perakende / E-Ticaret", "Üretim / İmalat", "Bilişim / Teknoloji", "İnşaat / Gayrimenkul", "Lojistik / Taşımacılık", "Hukuk / Danışmanlık", "Eğitim", "Diğer"];
const EMP_COUNTS = ["1–10", "11–50", "51–200", "201–500", "500+"];

type FormState = {
  name: string; email: string; company: string; phone: string;
  sector: string; employeeCount: string; hasCiso: string;
};

const EMPTY: FormState = {
  name: "", email: "", company: "", phone: "",
  sector: "", employeeCount: "", hasCiso: "",
};

export default function CisoAsistan() {
  usePageMeta({
    title: "CISO Asistan Paketi | CyberStep.io",
    description: "CISO'nuzun rutin raporlama yükünü otomatikleştirin. Aylık yönetim kurulu raporu, 7545 ve KVKK uyum skoru, haftalık tehdit özeti, 7 politika şablonu — 2.500 TL/ay.",
  });

  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) return;
    setSending(true);
    try {
      const res = await fetch("/api/public/ciso-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tier: "ciso-asistan" }),
      });
      if (res.ok) {
        toast({ title: "Talebiniz alındı", description: "Ekibimiz en geç 1 iş günü içinde sizinle iletişime geçecek." });
        setForm(EMPTY);
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/25 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="flex flex-col items-center text-center gap-6">
            <Badge className="bg-primary/20 text-primary border-primary/40">
              CISO Asistan Paketi
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
              CISO'nuz strateji düşünsün,<br />rutin raporlamayı biz yapalım
            </h1>
            <p className="text-white/80 text-lg max-w-2xl leading-relaxed">
              Aylık yönetim kurulu raporu, haftalık tehdit özeti, 7545 ve KVKK uyum skoru, 7 politika şablonu.
              Tam otomatik. <strong className="text-white">2.500 TL/ay + KDV.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8">
                <a href="#basvuru">Hemen Başla <ArrowRight className="h-4 w-4 ml-2" /></a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                <a href="#kapsam">Paketi Gör</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Ne / Ne Değil */}
      <section className="py-14 bg-background border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 p-6">
              <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-4">Ne</p>
              <ul className="space-y-2.5">
                {WHAT_IT_IS.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 p-6">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Ne Değil</p>
              <ul className="space-y-2.5">
                {WHAT_IT_IS_NOT.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-red-200/50 dark:border-red-800/30">
                <p className="text-xs text-muted-foreground">
                  Tam zamanlı vCISO hizmetimiz 2027 yol haritasında.{" "}
                  <Link href="/vciso-erken-erisim" className="text-primary hover:underline">Erken erişim listesine katılın</Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Paket kapsamı */}
      <section id="kapsam" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Pakete Dahil</Badge>
            <h2 className="text-3xl font-bold text-foreground">Her ay otomatik ne alırsınız?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="border border-border/50 rounded-xl p-6 bg-card/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{f.tag}</span>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-5 text-center">
            <p className="text-sm font-medium text-foreground">
              <span className="text-amber-600 dark:text-amber-400 font-bold">Yakında (2027 Q2):</span>{" "}
              Aylık 1 saatlik CISO briefing görüşmesi — partner CISO programı kurulduktan sonra dahil edilecek.
            </p>
          </div>
        </div>
      </section>

      {/* Kimler için */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground">Kimler için?</h2>
          </div>
          <div className="space-y-4">
            {WHO_NEEDS.map((w, i) => (
              <div key={i} className="flex gap-4 p-5 border border-border/40 rounded-xl bg-background">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0">{i + 1}</div>
                <div>
                  <p className="font-semibold text-sm text-foreground mb-1">{w.title}</p>
                  <p className="text-sm text-muted-foreground">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fiyat */}
      <section className="py-20 bg-background" id="fiyat">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Fiyatlandırma</Badge>
            <h2 className="text-3xl font-bold text-foreground">Tek plan, net fiyat</h2>
          </div>
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 max-w-md mx-auto">
            <p className="text-sm font-medium text-muted-foreground mb-1">CISO Asistan Paketi</p>
            <div className="flex items-end gap-1 mb-3">
              <span className="text-5xl font-black text-primary">2.500 TL</span>
              <span className="text-sm text-muted-foreground mb-1.5">/ay + KDV</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {[
                "Aylık yönetim kurulu raporu (PDF)",
                "Haftalık kişiselleştirilmiş tehdit özeti",
                "7545 + KVKK uyum skoru",
                "7 güvenlik politikası şablonu (Word)",
                "Portal erişimi",
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-primary/20 mb-4">
              <p className="text-xs text-muted-foreground">Dahil değil: danışmanlık görüşmeleri, olay müdahale, SOC/NOC</p>
            </div>
            <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <a href="#basvuru">Hemen Başla <ChevronRight className="h-4 w-4 ml-1" /></a>
            </Button>
          </div>
          <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-5 max-w-md mx-auto">
            <p className="text-xs font-semibold text-foreground mb-2">Kombinasyon indirimi</p>
            <p className="text-sm text-muted-foreground">
              SOC Standart + CISO Asistan birlikte alındığında <strong className="text-foreground">%20 indirim</strong> uygulanır.
              <br />
              <span className="text-muted-foreground/70">9.990 + 2.500 TL → 9.992 TL/ay</span>
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            İptal istediğinizde anında. Gizli ücret yok. KVKK uyumlu.
          </p>
        </div>
      </section>

      {/* Başvuru formu */}
      <section id="basvuru" className="py-20 bg-muted/20 border-t">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              1 Is Günunde Geri Doneriz
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Hemen Başlayın</h2>
            <p className="text-muted-foreground mt-3">
              Formu doldurun, ekibimiz paketi aktive etmek için sizinle iletişime geçsin.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-8 bg-card/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="Ahmet Yilmaz" required />
              </div>
              <div className="space-y-2">
                <Label>Is E-postasi <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} placeholder="ahmet@sirket.com" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma Adi <span className="text-red-500">*</span></Label>
                <Input value={form.company} onChange={e => set("company")(e.target.value)} placeholder="Sirket A.S." required />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={e => set("phone")(e.target.value)} placeholder="+90 5XX XXX XX XX" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sektor</Label>
                <Select value={form.sector} onValueChange={set("sector")}>
                  <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                  <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Calisan Sayisi</Label>
                <Select value={form.employeeCount} onValueChange={set("employeeCount")}>
                  <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                  <SelectContent>{EMP_COUNTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mevcut Durumunuz</Label>
              <Select value={form.hasCiso} onValueChange={set("hasCiso")}>
                <SelectTrigger><SelectValue placeholder="Siber güvenlik kaynaginiz nedir?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yok">Hicbir kaynak yok</SelectItem>
                  <SelectItem value="it">BT ekibi hallediyor</SelectItem>
                  <SelectItem value="dis">Dis danismanlik var</SelectItem>
                  <SelectItem value="ciso">Tam zamanli CISO var, raporlamayı otomatikleştirmek istiyoruz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {sending ? "Gönderiliyor..." : "Basvuruyu Gönder"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Bilgileriniz gizli tutulur. Spam gönderilmez. KVKK uyumlu.
            </p>
          </form>
          <div className="mt-6 text-center">
            <a href="mailto:info@cyberstep.io" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-4 w-4 text-primary" />
              info@cyberstep.io
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-secondary text-secondary-foreground border-t">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Önce mevcut durumunuzu görelim</h2>
          <p className="text-white/80 mb-6">
            CISO Asistan paketini aktive etmeden önce ücretsiz domain taraması ile güvenlik durumunuzu netleştirelim.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Link href="/domain-tarama">Ücretsiz Domain Taraması <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/fiyatlar">Tüm Servisler <TrendingDown className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
