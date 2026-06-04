import { useState } from "react";
import { Search, FileText, TrendingDown, CheckCircle2, ArrowRight, DollarSign, Clock, AlertTriangle, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";

const REPORT_SECTIONS = [
  { no: "01", title: "Dış Saldırı Yüzeyi Analizi", detail: "Hedef şirketin domain, IP ve alt domain altyapısı — açık portlar, eski TLS, hatalı DNS yapılandırması" },
  { no: "02", title: "Veri Sızıntısı Taraması", detail: "HIBP + dark web kaynakları — hedef şirkete ait e-posta ve kimlik bilgisi sızıntısı tarama" },
  { no: "03", title: "Tehdit İstihbaratı Kontrolü", detail: "VirusTotal, Shodan, AbuseIPDB, USOM kara liste — hedef altyapısının itibar analizi" },
  { no: "04", title: "KVKK / Regülasyon Riski", detail: "Kişisel veri işleme uygulaması, gizlilik politikası analizi, BDDK/KVKK yükümlülük değerlendirmesi" },
  { no: "05", title: "Siber Olay Geçmişi", detail: "Hedef şirketle ilişkili geçmiş ihlaller, bilinen güvenlik açıkları, CVE eşleşmeleri" },
  { no: "06", title: "Finansal Risk Nicelikleştirme", detail: "Tespit edilen risklerin olası ihlal maliyeti olarak parasal ifadesi — satın alma fiyatına yansıtılabilir" },
];

const WHO_NEEDS = [
  "Yatırım bankaları ve M&A danışmanlık firmaları",
  "Özel sermaye (PE) ve girişim sermayesi (VC) fonları",
  "Stratejik satın alma yapan holding şirketleri",
  "Halka açık şirketin özel şirket satın aldığı işlemler",
  "Birleşme sürecindeki eşit büyüklükteki şirketler",
];

const TIMELINE = [
  { day: "Gün 1", action: "Sipariş ve hedef domain bilgisi alınır, NDA imzalanır" },
  { day: "Gün 2–3", action: "Otomatik tarama motoru çalışır: dış yüzey, sızıntı, kara liste" },
  { day: "Gün 4", action: "AI destekli bulgu analizi, risk nicelikleştirme ve Türkçe rapor yazımı" },
  { day: "Gün 5", action: "Rapor teslimi (PDF + yönetici özeti) ve sözlü brifing (isteğe bağlı)" },
];

type FormState = { company: string; email: string; phone: string; targetDomain: string; deadline: string };
const EMPTY: FormState = { company: "", email: "", phone: "", targetDomain: "", deadline: "" };

export default function MaDueDiligence() {
  usePageMeta({
    title: "M&A Siber Due Diligence | CyberStep.io",
    description: "Satın alma öncesi siber güvenlik değerlendirmesi — dış saldırı yüzeyi, veri sızıntısı, finansal risk nicelikleştirme.",
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company || !form.email) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, leadType: "ma-due-diligence" }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">M&A Siber Due Diligence</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight max-w-2xl">
            Satın Aldığınız Şirketin<br />Siber Riskini Fiyata Yansıtın
          </h1>
          <p className="text-white/80 text-base mb-6 max-w-xl leading-relaxed">
            Türkiye'de yılda 400+ şirket el değiştiriyor. Alıcı firma satın aldığı şirketin siber riskini bilmiyor.
            CyberStep'in Satın Alma Öncesi Siber Değerlendirme Raporu 5 iş günü içinde hazır.
          </p>
          <div className="flex flex-wrap gap-5 mt-4">
            {[
              { val: "5 iş günü", label: "Teslim süresi" },
              { val: "15.000–35.000 TL", label: "Tek seferlik ücret" },
              { val: "400+", label: "Türkiye'de yıllık M&A işlemi" },
            ].map(s => (
              <div key={s.val} className="text-center">
                <div className="text-xl font-black text-primary">{s.val}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report sections */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Rapor Kapsamı</h2>
          <div className="space-y-3">
            {REPORT_SECTIONS.map(s => (
              <div key={s.no} className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-5">
                <span className="text-2xl font-black text-primary/30 w-10 shrink-0">{s.no}</span>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Süreç Zaman Çizelgesi</h2>
          </div>
          <div className="relative pl-8">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border/50" />
            <div className="space-y-5">
              {TIMELINE.map((t, i) => (
                <div key={t.day} className="relative">
                  <div className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center text-[10px] font-black
                    ${i === 0 ? "bg-primary border-primary text-white" : "bg-muted border-border text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                    <span className="text-xs font-bold text-primary block mb-1">{t.day}</span>
                    <p className="text-sm text-muted-foreground">{t.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who needs + form */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-5">Kimler İçin?</h2>
              <ul className="space-y-2.5 mb-6">
                {WHO_NEEDS.map(w => (
                  <li key={w} className="flex items-start gap-2.5 text-sm">
                    <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{w}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-amber-200/20 bg-amber-500/5 p-4 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Hedef şirketin bilgisi veya onayı aranmaz — yalnızca kamuya açık veriler kullanılır.
                  İstisna: TPRM modülü ile hedef şirket ankete dahil edilebilir.
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-sm text-foreground">Finansal Risk Nicelikleştirme</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tespit edilen riskler için Ponemon Institute metodolojisi referans alınarak olası ihlal maliyeti hesaplanır.
                  Satın alma müzakerelerinde indirim gerekçesi veya warranty maddesi olarak kullanılabilir.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <FileText className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-bold text-foreground text-base mb-1">Due Diligence Raporu Talep Edin</h3>
              <p className="text-xs text-muted-foreground mb-5">Hedef şirketin domain adresi ve işlem tarihinizi belirtin. Gizlilik sözleşmesi imzalanır.</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">M&A ekibimiz 4 saat içinde iletişime geçecek.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Kurum / firma adınız" value={form.company} onChange={set("company")} required />
                  <Input placeholder="Kurumsal e-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="Telefon" value={form.phone} onChange={set("phone")} />
                  <Input placeholder="Hedef şirket domain (sirket.com.tr)" value={form.targetDomain} onChange={set("targetDomain")} />
                  <Input placeholder="İşlem hedef tarihi (isteğe bağlı)" value={form.deadline} onChange={set("deadline")} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Rapor Sipariş Et <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">15.000 TL (temel) &mdash; 35.000 TL (dark web + finansal model dahil)</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
