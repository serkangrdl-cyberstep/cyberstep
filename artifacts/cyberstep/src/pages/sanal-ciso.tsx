import { useState } from "react";
import { Link } from "wouter";
import {
  Shield, CheckCircle2, ArrowRight, Users, FileText, Gavel,
  AlertTriangle, BarChart3, ChevronRight, Star, Phone, Mail,
  Building2, TrendingDown, UserCheck, Calendar, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

const DELIVERABLES = [
  {
    icon: FileText,
    title: "Aylık Yönetim Kurulu Sunumu",
    desc: "Her ay CEO ve yönetim kuruluna yönelik hazır siber güvenlik durum raporu. Teknik jargon yok, iş dili.",
  },
  {
    icon: BarChart3,
    title: "Yıllık Güvenlik Stratejisi",
    desc: "Şirketinize özel 12 aylık siber güvenlik yol haritası, bütçe planı ve öncelikli aksiyon listesi.",
  },
  {
    icon: Gavel,
    title: "Düzenleyici Yazışma Desteği",
    desc: "BDDK, SPK, BTK, KVKK Kurumu'na teknik içerikli yazışmalarda uzman kalem desteği.",
  },
  {
    icon: AlertTriangle,
    title: "Olay Müdahalesi Koordinasyonu",
    desc: "Siber saldırı anında 4 saat içinde yanıt, kriz masası kurulumu, iletişim yönetimi.",
  },
  {
    icon: Users,
    title: "Çalışan Farkındalık Programı",
    desc: "Yılda 2 kez phishing simülasyonu ve çalışan eğitimi. Zincirin en zayıf halkasını güçlendirin.",
  },
  {
    icon: Shield,
    title: "Sürekli Risk İzleme",
    desc: "CyberStep platformu üzerinden domain, sızıntı ve tehdit istihbaratı 7/24 otomatik izleme.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Keşif Görüşmesi",
    desc: "Partner CISO'nuz ile 90 dakikalık keşif görüşmesi. Mevcut durum, riskler ve hedefler belirlenir.",
    duration: "Hafta 1",
  },
  {
    n: "2",
    title: "Güvenlik Temeli",
    desc: "CyberStep tam değerlendirmesi + alan taraması + politika boşluk analizi. Öncelikli aksiyon planı çıkarılır.",
    duration: "Hafta 2–3",
  },
  {
    n: "3",
    title: "Aylık Ritim",
    desc: "Her ay: risk güncellemesi, yönetim kurulu raporu, düzenleyici takip, anlık olay desteği.",
    duration: "Sürekli",
  },
];

const TIERS = [
  {
    id: "baslangic",
    name: "Sanal CISO Başlangıç",
    price: "8.000",
    period: "/ay",
    desc: "1–50 çalışan. Temel vCISO hizmetleri.",
    highlight: false,
    features: [
      "Aylık yönetim kurulu raporu",
      "Yıllık güvenlik stratejisi",
      "Olay müdahalesi koordinasyonu",
      "Düzenleyici yazışma desteği",
      "CyberStep Pro platform erişimi",
      "Aylık 2 saat danışmanlık görüşmesi",
    ],
    cta: "Teklif Al",
  },
  {
    id: "kurumsal",
    name: "Sanal CISO Kurumsal",
    price: "15.000",
    period: "/ay",
    desc: "50–500 çalışan. Tam vCISO hizmetleri + sektörel uyum.",
    highlight: true,
    badge: "En Çok Tercih",
    features: [
      "Aylık yönetim kurulu raporu + sunu",
      "Yıllık güvenlik stratejisi + bütçe planı",
      "7/24 olay müdahalesi koordinasyonu",
      "Düzenleyici yazışma desteği (BDDK, SPK, BTK)",
      "Yılda 2× phishing simülasyonu + çalışan eğitimi",
      "KVKK DPA ve veri işleme süreç danışmanlığı",
      "CyberStep Pro platform erişimi (sınırsız)",
      "Aylık 4 saat danışmanlık görüşmesi",
    ],
    cta: "Teklif Al",
  },
];

const SECTORS = ["Finans / Bankacılık", "Sağlık", "Perakende / E-Ticaret", "Üretim / İmalat", "Bilişim / Teknoloji", "İnşaat / Gayrimenkul", "Lojistik / Taşımacılık", "Hukuk / Danışmanlık", "Eğitim", "Diğer"];
const EMP_COUNTS = ["1–10", "11–50", "51–200", "201–500", "500+"];

type FormState = {
  name: string; email: string; company: string; phone: string;
  sector: string; employeeCount: string; currentCiso: string; message: string; tier: string;
};

const EMPTY: FormState = {
  name: "", email: "", company: "", phone: "",
  sector: "", employeeCount: "", currentCiso: "", message: "", tier: "",
};

export default function SanalCiso() {
  usePageMeta({
    title: "Sanal CISO Hizmeti | CyberStep.io",
    description: "KOBİ'ler için aylık abonelikli Sanal CISO hizmeti. Yönetim kurulu raporu, güvenlik stratejisi, olay müdahalesi ve düzenleyici destek — sertifikalı partner CISO'lardan.",
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
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({
          title: "Talebiniz alındı",
          description: "Ekibimiz en geç 1 iş günü içinde sizi arayacak.",
        });
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
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30">
              Sanal CISO · vCISO as a Service
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
              CISO'nuz Artık Sizinle —<br />Kadro Maliyeti Olmadan
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              Türkiye'deki KOBİ'lerin yüzde 99'unun CISO'su yok.
              Bu pozisyon yıllık <strong className="text-white">2–4 milyon TL</strong> maaşla geliyor.
              CyberStep Sanal CISO aboneliğiyle sertifikalı bir uzmanı
              <strong className="text-white"> aylık 8.000 TL'den</strong> kiralayın.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
              >
                <a href="#basvuru">
                  Teklif Al <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                <a href="#hizmetler">Hizmetleri Gör</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cost comparison */}
      <section className="py-14 bg-background border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest mb-8">Maliyet Karşılaştırması</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Tam Zamanlı CISO</p>
              <p className="text-3xl font-black text-red-500 mb-1">2–4M TL</p>
              <p className="text-xs text-muted-foreground">yıllık brüt maaş</p>
              <p className="text-xs text-muted-foreground mt-1">+ prim + sosyal yardımlar</p>
            </div>
            <div className="flex justify-center">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Sanal CISO (CyberStep)</p>
              <p className="text-3xl font-black text-primary mb-1">96K–180K TL</p>
              <p className="text-xs text-muted-foreground">yıllık abonelik</p>
              <p className="text-xs text-primary font-semibold mt-1">%92 daha ekonomik</p>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section id="hizmetler" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Aboneliğe Dahil</Badge>
            <h2 className="text-3xl font-bold text-foreground">Her ay ne alırsınız?</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              CyberStep platformunun otomasyonu + sertifikalı partner CISO'nun uzmanlığı
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DELIVERABLES.map(d => (
              <div key={d.title} className="border border-border/50 rounded-xl p-5 bg-card/50 space-y-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <d.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{d.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How partner model works */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            Partner Modeli
          </Badge>
          <h2 className="text-2xl font-bold text-foreground mb-4">Kim sunar?</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Hizmeti CyberStep çalışanları değil, <strong className="text-foreground">CyberStep sertifikalı partner CISO'lar</strong> sunar.
            Bu uzmanlar en az 10 yıl sektör deneyimine sahip, CISSP / CISM / ISO 27001 LA sertifikalı
            Türkiye'nin lider siber güvenlik profesyonellerinden oluşur.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            CyberStep eşleştirme, platform altyapısı ve kalite güvencesini sağlar.
            Partner CISO operasyonel değeri üretir.
            İkisinin birleşimi pazarda bulunmayan bir fiyat-değer dengesi yaratır.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { label: "Sertifikalı Partner CISO", value: "15+" },
              { label: "Ortalama Deneyim", value: "12 Yıl" },
              { label: "Sektör Uzmanlığı", value: "8 Sektör" },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-background border p-4">
                <p className="text-2xl font-black text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Nasıl Başlanır?</h2>
          </div>
          <div className="space-y-4">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-5 p-5 border border-border/40 rounded-xl bg-card/30">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0">
                  {s.n}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{s.title}</p>
                    <span className="text-xs text-muted-foreground border border-border/50 rounded px-1.5 py-0.5 bg-muted/30">
                      <Calendar className="h-3 w-3 inline mr-1" />{s.duration}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-muted/20 border-y" id="fiyatlar">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Fiyatlandırma</Badge>
            <h2 className="text-3xl font-bold text-foreground">Şeffaf Abonelik Modeli</h2>
            <p className="text-muted-foreground mt-3">Gizli ücret yok. Her şey dahil. İptal anında.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {TIERS.map(tier => (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-8 flex flex-col gap-5 ${
                  tier.highlight
                    ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                    : "bg-card border-border/50"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                      <Star className="h-3 w-3 mr-1" />{tier.badge}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{tier.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-4xl font-black text-primary">{new Intl.NumberFormat("tr-TR").format(+tier.price)} TL</span>
                    <span className="text-sm text-muted-foreground mb-1">{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.desc}</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  className={tier.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    : "border-2 border-primary text-primary hover:bg-primary/10 bg-transparent font-semibold"
                  }
                  variant={tier.highlight ? "default" : "outline"}
                >
                  <a href="#basvuru">
                    {tier.cta} <ChevronRight className="h-4 w-4 ml-1" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            500+ çalışan için kurumsal teklif — <a href="mailto:info@cyberstep.io" className="text-primary hover:underline">info@cyberstep.io</a> adresine yazın.
          </p>
        </div>
      </section>

      {/* Lead form */}
      <section id="basvuru" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              1 Is Gununde Geri Doneriz
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Teklif Talep Et</h2>
            <p className="text-muted-foreground mt-3">
              Formu doldurun, sertifikalı bir partner CISO en geç 1 iş günü içinde sizi arasın.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-8 bg-card/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad <span className="text-red-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => set("name")(e.target.value)}
                  placeholder="Ahmet Yilmaz"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Is E-postasi <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => set("email")(e.target.value)}
                  placeholder="ahmet@sirket.com"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma Adi <span className="text-red-500">*</span></Label>
                <Input
                  value={form.company}
                  onChange={e => set("company")(e.target.value)}
                  placeholder="Sirket A.S."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={e => set("phone")(e.target.value)}
                  placeholder="+90 5XX XXX XX XX"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sektor</Label>
                <Select value={form.sector} onValueChange={set("sector")}>
                  <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Calisan Sayisi</Label>
                <Select value={form.employeeCount} onValueChange={set("employeeCount")}>
                  <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                  <SelectContent>
                    {EMP_COUNTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ilgilendiginiz Paket</Label>
              <Select value={form.tier} onValueChange={set("tier")}>
                <SelectTrigger><SelectValue placeholder="Secin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baslangic">Sanal CISO Baslangic — 8.000 TL/ay</SelectItem>
                  <SelectItem value="kurumsal">Sanal CISO Kurumsal — 15.000 TL/ay</SelectItem>
                  <SelectItem value="ozel">Ozel Kurumsal Teklif (500+ calisanli)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mevcut Durumunuz</Label>
              <Select value={form.currentCiso} onValueChange={set("currentCiso")}>
                <SelectTrigger><SelectValue placeholder="Siber guvenlik kaynaginiz nedir?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yok">Hicbir kaynak yok</SelectItem>
                  <SelectItem value="it">BT ekibi hallediyor</SelectItem>
                  <SelectItem value="dis">Dis danismanlik var</SelectItem>
                  <SelectItem value="ciso">Tam zamanli CISO var ama takviye istiyoruz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notunuz / Sorunuz</Label>
              <Textarea
                value={form.message}
                onChange={e => set("message")(e.target.value)}
                placeholder="Acil bir ihtiyacınız var mi, belirli bir konuda yardim mi istiyorsunuz?"
                className="min-h-[100px]"
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {sending ? "Gonderiliyor..." : "Teklif Talep Et"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Bilgileriniz gizli tutulur. Spam gonderilmez. KVKK uyumlu.
            </p>
          </form>

          {/* Alternative contact */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+902120000000"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4 text-primary" />
              +90 212 000 00 00
            </a>
            <a
              href="mailto:ciso@cyberstep.io"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4 text-primary" />
              ciso@cyberstep.io
            </a>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 bg-secondary text-secondary-foreground border-t">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Tam Degerlendirme ile Baslayın
          </h2>
          <p className="text-muted-foreground mb-6">
            Sanal CISO'ya gecmeden once mevcut güvenlik durumunuzu netlestirelim.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Link href="/assessment/start">Ucretsiz Mini Degerlendirme</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/fiyatlar">Tum Paketler</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
