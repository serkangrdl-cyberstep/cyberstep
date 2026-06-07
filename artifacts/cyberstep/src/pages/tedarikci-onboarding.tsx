import { useState } from "react";
import { Link2, ClipboardList, CheckCircle2, ArrowRight, Users, AlertTriangle, ThumbsUp, ThumbsDown, Minus, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const PROCESS_STEPS = [
  { step: "1", title: "Tedarikçi Bilgisi Girin", detail: "Ana müşteri portalından tedarikçinin adı ve domain adresini girin. CyberStep davet e-postasını otomatik gönderir.", badge: "Otomatik" },
  { step: "2", title: "Domain Taraması", detail: "Tedarikçinin web altyapısı anında taranır. SPF, DMARC, SSL, kara liste ve sızıntı kontrolü gerçekleştirilir.", badge: "Otomatik" },
  { step: "3", title: "TPRM Anketi", detail: "Tedarikçiye kişiselleştirilmiş güvenlik anketi gönderilir. Tedarikçi kendi iş bilgisayarından yanıtlar — hesap gerekmez.", badge: "Tedarikçi dolduruyor" },
  { step: "4", title: "Birleşik Rapor", detail: "Tarama + anket sonuçları birleştirilir. AI güvenlik skoru hesaplar ve 'Onayla / Şartlı / Reddet' tavsiyesi üretir.", badge: "AI" },
];

const VERDICTS = [
  { type: "Onayla", icon: ThumbsUp, color: "text-green-500 border-green-200 bg-green-50/30 dark:bg-green-950/10", desc: "Skor 70+, kritik sorun yok. Tedarikçi sisteme alınabilir." },
  { type: "Sartli Onayla", icon: Minus, color: "text-yellow-500 border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/10", desc: "Skor 50–70, eksikler var. Düzeltme planı sunması şartıyla onaylanabilir." },
  { type: "Reddet", icon: ThumbsDown, color: "text-red-500 border-red-200 bg-red-50/30 dark:bg-red-950/10", desc: "Skor <50 veya kritik açık. Güvenlik sağlayana kadar onaylanmamalı." },
];

const BENEFITS = [
  "Her yeni tedarikçi için standart güvenlik sürecini otomatikleştirir",
  "Müşteri büyüyünce tedarikçi ağı otomatik lead kaynağı olur",
  "KVKK Madde 12 veri işleyen güvenliği yükümlülüğü için kanıt üretir",
  "Tedarikçi izni olmadan dış tarama başlatılabilir",
  "Birleşik rapor ihale dosyasına eklenebilir",
  "Mevcut TPRM anket altyapısıyla entegre — sıfır ek kurulum",
];

type FormState = { company: string; email: string; supplierCount: string; sector: string };
const EMPTY: FormState = { company: "", email: "", supplierCount: "", sector: "" };

export default function TedarikciOnboarding() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Tedarikçi Onboarding Servisi | CyberStep.io",
    description: "Yeni tedarikçi kabul sürecinde otomatik siber güvenlik değerlendirmesi — domain tarama + TPRM anketi + AI tavsiye.",
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
        body: JSON.stringify({ ...form, leadType: "vendor-onboarding" }),
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">{lang === "en" ? "Supplier Onboarding" : "Tedarikçi Onboarding"}</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight max-w-2xl">
            {lang === "en" ? <>Automatically Assess Your<br />New Supplier's Security</> : <>Yeni Tedarikçinizin Güvenliğini<br />Otomatik Değerlendirin</>}
          </h1>
          <p className="text-white/80 text-base mb-6 max-w-xl leading-relaxed">
            Büyük şirketler yeni tedarikçi alırken siber güvenlik sorusu sormuyor.
            CyberStep domain taraması + TPRM anketi + AI tavsiyesini birleştirerek 48 saat içinde
            "Onayla / Şartlı / Reddet" kararını verir.
          </p>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 w-fit">
            <Users className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-white">Büyük müşteriyi kazanınca onun 50 tedarikçisi otomatik lead oluyor</span>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Nasıl Çalışır?</h2>
          <div className="space-y-4">
            {PROCESS_STEPS.map(s => (
              <div key={s.step} className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-5">
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0">{s.step}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm">{s.title}</h3>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s.badge}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verdicts */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">AI Karar Çıktısı</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VERDICTS.map(v => (
              <div key={v.type} className={`rounded-xl border p-5 ${v.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <v.icon className="h-5 w-5" />
                  <span className="font-bold text-sm">{v.type}</span>
                </div>
                <p className="text-xs text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Karar nihai değildir — sorumlu kişi onayıyla hayata geçer. CyberStep, kararı destekleyen kanıtları ve gerekçeyi raporlar.
          </p>
        </div>
      </section>

      {/* Benefits + form */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-5">Neden CyberStep Tedarikçi Onboarding?</h2>
              <ul className="space-y-2.5 mb-6">
                {BENEFITS.map(b => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">Mevcut TPRM Altyapısıyla Çalışır</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">CyberStep'in TPRM Anket modülünü kullanıyorsanız Tedarikçi Onboarding sıfır kurulumla aktif edilir.</p>
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href="/tedarik-zinciri">TPRM Anketi Hakkında <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <ClipboardList className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-bold text-foreground text-base mb-1">Demo Talep Edin</h3>
              <p className="text-xs text-muted-foreground mb-5">Kendi tedarikçinizle canlı demo yapabiliriz. Kaç tedarikçiniz var?</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">Ekibimiz 1 iş günü içinde demo randevusu ayarlayacak.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Şirket adı" value={form.company} onChange={set("company")} required />
                  <Input placeholder="E-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="Yaklaşık tedarikçi sayısı" value={form.supplierCount} onChange={set("supplierCount")} />
                  <Input placeholder="Sektör" value={form.sector} onChange={set("sector")} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Demo Talep Et <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Tedarikçi başına 150–400 TL &mdash; hacme göre indirimli fiyat</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
