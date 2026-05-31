import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Shield, ArrowRight, CheckCircle2, AlertTriangle, Scale, Globe, FileText } from "lucide-react";

const SECTORS = ["Finans", "Sağlık", "Perakende", "Bilişim/Yazılım", "İmalat", "Lojistik", "Eğitim", "Sigorta", "Diğer"];
const EMP_COUNTS = ["1-10", "11-50", "51-200", "201-500", "500+"];

export default function EuAiActPage() {
  usePageMeta({ title: "EU AI Act Uyum Skoru", description: "AB Yapay Zeka Yasası kapsamında şirketinizin uyum durumunu öğrenin. 20 soruda risk kategorinizi ve yükümlülüklerinizi belirleyin." });
  const [, navigate] = useLocation();

  const [step, setStep] = useState<"landing" | "form">("landing");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactEmail: "", sector: "", employeeCount: "" });
  const [error, setError] = useState("");

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) { setError("Şirket adı zorunlu"); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/eu-aiact/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Bir hata oluştu"); return; }
      navigate(`/eu-ai-act/sorular/${data.id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }

  if (step === "form") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-lg">
          <button onClick={() => setStep("landing")} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">
            ← Geri
          </button>
          <div className="mb-8">
            <Badge className="mb-4 bg-blue-600 text-white">AB AI Yasası Uyum Skoru</Badge>
            <h1 className="text-2xl font-bold mb-2">Şirket Bilgileri</h1>
            <p className="text-muted-foreground text-sm">Analizinizi kişiselleştirmek için birkaç bilgiye ihtiyacımız var.</p>
          </div>
          <form onSubmit={handleStart} className="space-y-5">
            <div>
              <Label htmlFor="cn">Şirket Adı *</Label>
              <Input id="cn" placeholder="Örn: Acme Teknoloji A.Ş." value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">E-posta (isteğe bağlı)</Label>
              <Input id="email" type="email" placeholder="rapor@sirket.com" value={form.contactEmail}
                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Sektör</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {SECTORS.map(s => (
                  <button key={s} type="button" onClick={() => setForm(p => ({ ...p, sector: s }))}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${form.sector === s ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-border hover:border-blue-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Çalışan Sayısı</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {EMP_COUNTS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, employeeCount: c }))}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${form.employeeCount === c ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-border hover:border-blue-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? "Başlatılıyor..." : "Değerlendirmeyi Başlat"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-950 via-blue-900 to-background pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-600/30">
            <Globe className="h-3.5 w-3.5 mr-1" /> AB Yapay Zeka Yasası
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            AB Yapay Zeka Yasası<br />
            <span className="text-blue-400">Uyum Skoru</span>
          </h1>
          <p className="text-blue-100/80 text-lg mb-3">
            1 Ağustos 2026'dan itibaren AB'ye ürün veya hizmet satan şirketler EU AI Act kapsamına giriyor.<br />
            <strong className="text-white">Cezalar: 35 milyon Euro'ya kadar.</strong>
          </p>
          <p className="text-blue-200/60 text-sm mb-8">20 soruda uyum durumunuzu öğrenin. 10 dakika. 1.990 TL.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => setStep("form")} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8">
              Uyum Skorumu Öğren <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="text-blue-300/50 text-xs mt-4">Fiyat: 1.990 TL — AB'ye ihracat yapmasanız da değerlendirin</p>
        </div>
      </div>

      {/* What you learn */}
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Raporunuzda neler var?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Scale, title: "Risk Kategorisi", desc: "Yasak | Yüksek Risk | Sınırlı | Minimum | Kapsam Dışı" },
            { icon: FileText, title: "Uygulanan Maddeler", desc: "Hangi AB AI Yasası maddeleri şirketinizi etkiliyor" },
            { icon: AlertTriangle, title: "Yasak Uygulama Kontrolü", desc: "Kullandığınız AI sistemleri yasaklı mı?" },
            { icon: CheckCircle2, title: "Öncelikli Uyum Adımları", desc: "Bu ay, bu çeyrekte, 2026 sonuna kadar ne yapmalısınız" },
            { icon: Shield, title: "KVKK Örtüşmesi", desc: "Zaten KVKK'ya uyuysanız neler sayılır" },
            { icon: Scale, title: "Maksimum Ceza Maruziyeti", desc: "Euro ve TL cinsinden maksimum ceza hesabı" },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="border-blue-500/20 bg-blue-950/10">
              <CardContent className="p-5">
                <Icon className="h-8 w-8 text-blue-500 mb-3" />
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 border border-blue-500/20 rounded-xl bg-blue-950/10 p-6">
          <p className="text-center text-sm text-muted-foreground mb-1">Konumlandırma</p>
          <p className="text-center text-xl font-semibold">
            AB uyum danışmanı bu analizi <span className="line-through text-muted-foreground">5.000-20.000 TL</span>'ye yapar.
          </p>
          <p className="text-center text-blue-400 font-bold text-2xl mt-1">CyberStep: 1.990 TL</p>
        </div>

        <div className="text-center mt-10">
          <Button onClick={() => setStep("form")} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10">
            Hemen Başla <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
