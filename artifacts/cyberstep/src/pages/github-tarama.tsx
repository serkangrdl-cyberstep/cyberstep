import { useState } from "react";
import { Github, Key, Lock, Package, CheckCircle2, ArrowRight, AlertTriangle, Code2, Search, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const SCAN_TARGETS = [
  { icon: Github, title: "Public GitHub Repoları", items: ["Hardcoded API key, token, şifre (Gitleaks tabanlı)", "AWS/GCP/Azure credential sızıntısı", ".env dosyası commit geçmişinde", "Yüksek riskli commit'lerde secret örüntüsü"] },
  { icon: Package, title: "NPM / PyPI Paketleri", items: ["Bilinen güvenlik açıklı bağımlılık (npm audit / pip-audit)", "Typosquatting paketi tespiti", "Kötücül veya ele geçirilmiş paket uyarısı", "Lisans uyumsuzluğu bayrağı"] },
  { icon: Code2, title: "Docker Hub İmajları", items: ["Temel imajda bilinen CVE tespiti (Trivy)", "Root olarak çalışan servisler", "Gereksiz açık port ifşaatı", "Eski/unmaintained imaj uyarısı"] },
];

const FINDING_TYPES = [
  { severity: "Kritik", color: "text-red-500 bg-red-500/10 border-red-200", example: "AWS_SECRET_KEY commit geçmişinde bulundu", action: "Derhal rotate et" },
  { severity: "Yüksek", color: "text-orange-500 bg-orange-500/10 border-orange-200", example: "CVSS 8.5 — lodash prototip kirlenmesi", action: "1 hafta içinde güncelle" },
  { severity: "Orta", color: "text-yellow-500 bg-yellow-500/10 border-yellow-200", example: ".env.example'da gerçek değerler", action: "30 gün içinde temizle" },
  { severity: "Bilgi", color: "text-blue-400 bg-blue-500/10 border-blue-200", example: "Debug modu production'da aktif", action: "Gözetimde tut" },
];

const SECTORS = ["Yazılım firmaları", "Teknoloji startupları", "Fintech şirketleri", "E-ticaret altyapısı", "SaaS ürün şirketleri", "Oyun geliştiricileri"];

type FormState = { company: string; email: string; github: string; npmOrg: string };
const EMPTY: FormState = { company: "", email: "", github: "", npmOrg: "" };

export default function GithubTarama() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "GitHub ve Açık Kod Taraması | CyberStep.io",
    description: "Public repo, NPM paket ve Docker imajlarında exposed API key, hardcoded şifre ve açık bağımlılık taraması.",
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
        body: JSON.stringify({ ...form, leadType: "github-scan" }),
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/15 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">{lang === "en" ? "For Software Companies" : "Yazılım Firmaları İçin"}</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight max-w-2xl">
            {lang === "en" ? <>Is Your API Key Exposed<br />in a Public Repo? You Don't Know.</> : <>Public Repo'nuzda API Key<br />Açıkta mı? Bilmiyorsunuz.</>}
          </h1>
          <p className="text-white/80 text-base mb-6 max-w-xl leading-relaxed">
            Türkiye'deki 5.000+ yazılım firmasının büyük çoğunluğunun repo güvenliği sıfır.
            CyberStep, GitHub, NPM ve Docker Hub'ı Gitleaks ile tarar; exposed secret ve açık bağımlılıkları raporlar.
          </p>
          <div className="flex flex-wrap gap-3">
            {["Gitleaks tabanlı secret tarama", "npm audit + Trivy CVE", "Docker imaj analizi", "Sürekli izleme"].map(t => (
              <span key={t} className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-b bg-muted/10">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { val: "%23", label: "Yazılım firması reposunda en az 1 secret açıkta" },
              { val: "11 dk", label: "GitHub'a push'tan sonra botların keşfetme süresi" },
              { val: "4.2x", label: "Açık key ile ihlal maliyeti artışı" },
              { val: "5.000+", label: "Türkiye'de hedef yazılım şirketi" },
            ].map(s => (
              <div key={s.val} className="p-4">
                <div className="text-2xl font-black text-primary mb-1">{s.val}</div>
                <div className="text-xs text-muted-foreground leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scan targets */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Tarama Kapsamı</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SCAN_TARGETS.map(t => (
              <div key={t.title} className="rounded-xl border border-border/50 bg-card/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <t.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{t.title}</h3>
                </div>
                <ul className="space-y-2">
                  {t.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Search className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Finding severity */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-6">Bulgu Seviyeleri ve Önerilen Aksiyon</h2>
          <div className="space-y-3">
            {FINDING_TYPES.map(f => (
              <div key={f.severity} className={`flex items-center gap-5 rounded-xl border p-4 ${f.color}`}>
                <span className="font-bold text-sm w-16 shrink-0">{f.severity}</span>
                <span className="flex-1 text-sm text-foreground font-mono text-xs">{f.example}</span>
                <span className="text-xs font-semibold shrink-0">{f.action}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target sectors + form */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-4">Hangi Şirketler İçin?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {SECTORS.map(s => (
                  <span key={s} className="text-xs border border-primary/20 bg-primary/5 text-primary px-3 py-1.5 rounded-full font-medium">{s}</span>
                ))}
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">Mevcut Domain Taramasından Farkı</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Domain taraması web altyapısını dışarıdan inceler. GitHub Tarama modülü kaynak kodu, bağımlılıkları
                  ve container imajlarını içeriden analiz eder. Geliştirici hatalarından kaynaklanan riski yakalar.
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-amber-200/20 bg-amber-500/5 p-4 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Entegrasyon 2–3 günlük iş. GitHub OAuth ile yetkilendirme; CyberStep kod içeriğini saklamaz, yalnızca bulguları raporlar.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <h3 className="font-bold text-foreground text-base mb-1">Beta Erişim Talebinde Bulunun</h3>
              <p className="text-xs text-muted-foreground mb-5">İlk 50 yazılım firmasına ücretsiz pilot tarama. GitHub reponuzu bağlamak için ön kayıt yapın.</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">Beta ekibimiz 2 iş günü içinde iletişime geçecek.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Şirket adı" value={form.company} onChange={set("company")} required />
                  <Input placeholder="E-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="GitHub organizasyon adı (isteğe bağlı)" value={form.github} onChange={set("github")} />
                  <Input placeholder="NPM organizasyon adı (isteğe bağlı)" value={form.npmOrg} onChange={set("npmOrg")} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Beta Erişimi Talep Et <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Geliştirici plan: Aylık 790 TL &mdash; 5 repo + npm + Docker tarama</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
