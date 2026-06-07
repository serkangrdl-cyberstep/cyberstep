import { useState } from "react";
import { Server, Lock, Shield, CheckCircle2, ArrowRight, WifiOff, Package, Building2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const SECTORS = [
  { icon: Shield, name: "Savunma Sanayii", detail: "SSB ve MSB tedarikçileri, ITAR/EAR uyumluluğu gerektirenler" },
  { icon: Building2, name: "Bankacılık ve Finans", detail: "BDDK düzenlemesine tabi kurumlar, SWIFT ortamları" },
  { icon: "🏥", name: "Sağlık", detail: "Sağlık Bakanlığı veri lokalizasyon gereksinimi olan hastaneler" },
  { icon: "⚡", name: "Enerji ve Kritik Altyapı", detail: "EPDK kapsamındaki üretim ve dağıtım şirketleri" },
];

const DOCKER_SERVICES = [
  { service: "cyberstep-web", desc: "React frontend — Nginx ile servis edilir" },
  { service: "cyberstep-api", desc: "Express 5 API sunucusu" },
  { service: "cyberstep-db", desc: "PostgreSQL 16 — yerel veri saklama" },
  { service: "cyberstep-scanner", desc: "Domain tarama motoru — offline CVE DB" },
  { service: "cyberstep-ai", desc: "Lokal LLM (Ollama) veya air-gapped endpoint" },
];

const INCLUSIONS = [
  "Docker Compose ile tek komut kurulum",
  "Kapalı ağ (air-gapped) desteği — internet bağlantısı gerekmez",
  "Yerel CVE veritabanı — NVD snapshot, haftalık güncelleme paketi",
  "Yerel LLM entegrasyonu (Ollama / vLLM) — veri dışarı çıkmaz",
  "Sabit IP / özel domain kurulum desteği",
  "LDAP / Active Directory entegrasyonu",
  "Yıllık lisans + 12 ay öncelikli destek",
  "Versiyon güncelleme paketleri USB/DVD ile teslim (opsiyonel)",
];

const PRICING = [
  { tier: "Kurumsal", price: "150.000 TL / yıl", users: "50 kullanıcıya kadar", domains: "100 domain", support: "8x5 e-posta desteği" },
  { tier: "Büyük Kurumsal", price: "350.000 TL / yıl", users: "Sınırsız kullanıcı", domains: "Sınırsız domain", support: "7x24 telefon + SLA" },
];

type FormState = { company: string; email: string; phone: string; sector: string };
const EMPTY: FormState = { company: "", email: "", phone: "", sector: "" };

export default function OnPremise() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "On-Premise Kurulum | CyberStep.io",
    description: "Savunma, bankacılık ve sağlık sektörü için hava boşluklu (air-gapped) on-premise CyberStep kurulumu.",
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
        body: JSON.stringify({ ...form, leadType: "on-premise" }),
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-500/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 mb-4">On-Premise / Air-Gapped</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight max-w-2xl">
            {lang === "en" ? <>If You Can't Send Data to the Cloud,<br />CyberStep Comes to You</> : <>Buluta Veri Gönderemiyorsanız,<br />CyberStep Sizi Bulur</>}
          </h1>
          <p className="text-white/80 text-base mb-6 max-w-xl leading-relaxed">
            Savunma sanayii, bankacılık ve sağlık sektörü bulut SaaS'a veri gönderemez.
            CyberStep'i kendi altyapınızda çalıştırın — Docker Compose ile tek komut, tam özellikli, internet gerektirmez.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Air-gapped çalışma", icon: WifiOff },
              { label: "Docker Compose", icon: Package },
              { label: "Lokal LLM desteği", icon: Server },
              { label: "LDAP entegrasyonu", icon: Lock },
            ].map(t => (
              <span key={t.label} className="flex items-center gap-1.5 text-xs bg-white/10 text-white px-3 py-1.5 rounded-full font-medium">
                <t.icon className="h-3 w-3" />{t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Target sectors */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Hangi Sektörler İçin?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECTORS.map(s => (
              <div key={s.name} className="rounded-xl border border-border/50 bg-card/30 p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-lg">
                  {typeof s.icon === "string" ? s.icon : <s.icon className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Docker stack */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Docker Compose Stack</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Tek bir <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">docker compose up -d</code> komutu ile tüm sistem ayağa kalkar.</p>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 font-mono text-xs mb-6 overflow-x-auto">
            <p className="text-zinc-400 mb-2"># Kurulum — internet bağlantısı gerektirmez</p>
            <p><span className="text-green-400">$</span> <span className="text-white">tar -xzf cyberstep-v2.tar.gz</span></p>
            <p><span className="text-green-400">$</span> <span className="text-white">cd cyberstep && cp .env.example .env</span></p>
            <p><span className="text-green-400">$</span> <span className="text-white">docker compose up -d</span></p>
            <p className="text-zinc-400 mt-2"># Servisler: web :80 | api :5000 | db :5432</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-2 bg-muted/30 border-b border-border/30 px-5 py-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Servis</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Açıklama</span>
            </div>
            {DOCKER_SERVICES.map(s => (
              <div key={s.service} className="grid grid-cols-2 px-5 py-3 border-b border-border/20 last:border-0">
                <span className="font-mono text-xs text-primary">{s.service}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inclusions + pricing + form */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-5">Paket İçeriği</h2>
              <ul className="space-y-2.5 mb-8">
                {INCLUSIONS.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <h3 className="font-bold text-foreground mb-4 text-sm">Lisans Seçenekleri</h3>
              <div className="space-y-3">
                {PRICING.map(p => (
                  <div key={p.tier} className="rounded-xl border border-border/50 bg-card/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground text-sm">{p.tier}</span>
                      <span className="font-black text-primary text-sm">{p.price}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{p.users} · {p.domains}</p>
                      <p>{p.support}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <FileText className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-bold text-foreground text-base mb-1">Teklif Talep Edin</h3>
              <p className="text-xs text-muted-foreground mb-5">Kurumunuza özel teknik gereksinimler, kurulum planı ve fiyat teklifi için formu doldurun.</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">Kurumsal satış ekibimiz 1 iş günü içinde arayacak.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Kurum adı" value={form.company} onChange={set("company")} required />
                  <Input placeholder="Kurumsal e-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="Telefon numarası" value={form.phone} onChange={set("phone")} />
                  <Input placeholder="Sektör (savunma, bankacılık, sağlık...)" value={form.sector} onChange={set("sector")} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Teklif Talep Et <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">NDA ve gizlilik sözleşmesi ilk görüşmede imzalanır</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
