import { useState } from "react";
import { Zap, Bell, Shield, CheckCircle2, ArrowRight, Clock, AlertTriangle, Globe, MessageCircle, Mail, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";

const THREAT_EXAMPLES = [
  { cve: "CVE-2021-44228", name: "Log4Shell", affected: "Java uygulamaları, Apache, VMware", cvss: "10.0", impact: "Uzaktan kod çalıştırma" },
  { cve: "CVE-2023-34362", name: "MOVEit", affected: "Dosya transfer sistemleri", cvss: "9.8", impact: "SQL injection → veri sızıntısı" },
  { cve: "CVE-2023-4966", name: "Citrix Bleed", affected: "NetScaler / Citrix ADC", cvss: "9.4", impact: "Oturum token çalma" },
  { cve: "CVE-2024-3400", name: "PAN-OS RCE", affected: "Palo Alto güvenlik duvarları", cvss: "10.0", impact: "Root erişimi" },
];

const HOW_IT_WORKS = [
  { step: "1", title: "CISA KEV İzleme", detail: "CISA'nın Bilinen İstismar Edilen Güvenlik Açıkları listesi saatlik kontrol edilir. Yeni eklenen her CVE anında işleme alınır.", icon: Globe },
  { step: "2", title: "Stack Eşleştirme", detail: "Shodan ve domain tarama verilerinizle CVE'nin etkilediği teknoloji karşılaştırılır. Yalnızca sizi ilgilendiren açıklar bildirilir.", icon: Shield },
  { step: "3", title: "Anlık Bildirim", detail: "Eşleşme tespit edildiği an WhatsApp ve e-posta ile uyarı iletilir. Açık özeti, etki analizi ve hızlı çözüm adımları eklenir.", icon: Bell },
];

const FEATURES = [
  "Saatlik CISA KEV + NVD senkronizasyonu",
  "CVSS 9.0+ CVE'lerde öncelikli alarm",
  "Müşteri stack'iyle otomatik eşleştirme (Shodan verisi)",
  "WhatsApp Business API + e-posta bildirimi",
  "EPSS > %30 olan CVE'lerde ek uyarı",
  "Türkçe etki analizi + hızlı çözüm adımları",
  "Yanlış alarm filtresi: stack'inizde olmayan CVE sessiz kalır",
  "Aylık tehdit özet raporu",
];

type FormState = { company: string; email: string; domain: string; stack: string };
const EMPTY: FormState = { company: "", email: "", domain: "", stack: "" };

export default function ZeroDayUyari() {
  usePageMeta({
    title: "Zero-Day Anlık Uyarı Servisi | CyberStep.io",
    description: "CISA KEV izleme, stack eşleştirme ve WhatsApp+e-posta ile anlık zero-day uyarı servisi.",
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
        body: JSON.stringify({ ...form, leadType: "zero-day" }),
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-red-500/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-10">
            <div className="flex-1">
              <Badge className="bg-red-500/20 text-red-300 border-red-500/30 mb-4">Zero-Day Uyarı Servisi</Badge>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
                Zero-Day Patladığında<br />Siz Zaten Haberdarsınız
              </h1>
              <p className="text-muted-foreground text-base mb-6 max-w-lg leading-relaxed">
                Log4Shell, MOVEit, Citrix Bleed — dünya 48 saat içinde hacklenenlere ve haberdarlara bölünüyor.
                CyberStep, CISA KEV'i saatlik izler, stack'inizle eşleşen her CVE'yi anında WhatsApp ve e-posta ile bildirir.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-400"><Clock className="h-4 w-4" />Saatlik tarama</span>
                <span className="flex items-center gap-1.5 text-green-400"><MessageCircle className="h-4 w-4" />WhatsApp bildirimi</span>
                <span className="flex items-center gap-1.5 text-green-400"><Zap className="h-4 w-4" />Anlık alarm</span>
              </div>
            </div>
            {/* Live KEV widget mockup */}
            <div className="lg:w-80 w-full rounded-2xl border border-red-500/30 bg-background/80 backdrop-blur-sm p-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wide">CISA KEV — Son 24 Saat</span>
                <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Canlı</span>
              </div>
              <div className="space-y-2">
                {["CVE-2024-47575 — FortiManager RCE", "CVE-2024-43491 — Windows Update", "CVE-2024-38812 — VMware vCenter"].map((item, i) => (
                  <div key={i} className={`text-[11px] font-mono px-2 py-1.5 rounded flex items-center gap-2 ${i === 0 ? "bg-red-500/15 text-red-300 border border-red-500/20" : "bg-muted/30 text-muted-foreground"}`}>
                    {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
                Stack'inizde eşleşme: <span className="text-red-400 font-bold">1 CVE tespit edildi</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Threat examples */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-2">Bu Açıkları Zamanında Öğrenseydiniz Ne Olurdu?</h2>
          <p className="text-sm text-muted-foreground mb-6">Her biri binlerce şirketi etkileyen gerçek zero-day açıkları. Erken uyarı almanın farkı:</p>
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/30">
                <tr>
                  {["CVE", "İsim", "Etkilenen Teknoloji", "CVSS", "Saldırı Türü"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {THREAT_EXAMPLES.map(t => (
                  <tr key={t.cve} className="bg-card/20 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{t.cve}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.affected}</td>
                    <td className="px-4 py-3">
                      <span className="font-black text-red-500">{t.cvss}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-8 text-center">Nasıl Çalışır?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(h => (
              <div key={h.step} className="rounded-xl border border-border/50 bg-card/30 p-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <h.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-xs font-bold text-primary mb-1">Adım {h.step}</div>
                <h3 className="font-bold text-foreground mb-2">{h.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{h.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Servis Kapsamı</h2>
              <ul className="space-y-2.5">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-1">Bu özellik neden önemli?</p>
                    <p className="text-xs text-muted-foreground">CISA KEV'e eklenen CVE'lerin medyan istismar süresi 7 gündür. Siz 1 saat içinde haberdar olursunuz.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lead form */}
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <h3 className="font-bold text-foreground text-base mb-1">Erken Erişim Listesine Katılın</h3>
              <p className="text-xs text-muted-foreground mb-5">Kurumsal plan abonelerine öncelikli etkinleştirme. Bilgilendirme için formu doldurun.</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">Servis aktif olduğunda size haber vereceğiz.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Şirket adı" value={form.company} onChange={set("company")} required />
                  <Input placeholder="E-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="Domain (sirket.com.tr)" value={form.domain} onChange={set("domain")} />
                  <Input placeholder="Kullandığınız teknolojiler (isteğe bağlı)" value={form.stack} onChange={set("stack")} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Erken Erişim Listesine Ekle <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Kurumsal plan: Aylık 1.490 TL &mdash; Zero-Day Uyarı dahil</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
