import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useLocation } from "wouter";
import { Eye, ArrowRight, AlertTriangle, Shield, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function AiRedTeamPage() {
  usePageMeta({ title: "AI Red Team Raporu", description: "Saldırganlar 30 dakikada şirketiniz hakkında ne öğrenir? CyberStep AI Red Team ile kamuya açık dijital izinizi analiz edin." });

  const params = useParams();
  const reportId = params["id"] ? Number(params["id"]) : null;
  const [, navigate] = useLocation();

  // Form state
  const [form, setForm] = useState({ companyName: "", domain: "", contactEmail: "", sector: "", consentAccepted: false });
  const [step, setStep] = useState<"landing" | "form" | "report">(reportId ? "report" : "landing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Report state
  const [rid, setRid] = useState(reportId);
  const [reportData, setReportData] = useState<any>(null);
  const [polling, setPolling] = useState(!!reportId);

  useEffect(() => {
    if (!rid) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/red-team/${rid}/report`);
        if (!r.ok) return;
        const d = await r.json();
        setReportData(d);
        if (d.status === "completed" || d.status === "error") {
          setPolling(false);
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [rid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.domain) { setError("Şirket adı ve domain zorunlu"); return; }
    if (!form.consentAccepted) { setError("Analiz için onay gerekli"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/red-team/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Hata"); return; }
      setRid(d.id);
      setPolling(true);
      navigate(`/ai-red-team/${d.id}`);
    } catch { setError("Bağlantı hatası"); }
    finally { setLoading(false); }
  }

  if (step === "landing" && !reportId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-background pt-20 pb-16 px-4">
          <div className="container mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-red-600/20 text-red-300 border-red-600/30">
              <Eye className="h-3.5 w-3.5 mr-1" /> AI Red Team
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              AI Red Team<br />
              <span className="text-red-400">Raporu</span>
            </h1>
            <p className="text-slate-300 text-lg mb-3">
              Bir saldırgan şirketinizi hedef almadan önce 30 dakikada <strong className="text-white">ne öğrenir?</strong>
            </p>
            <p className="text-slate-400 text-sm mb-8">Kamuya açık kaynaklardan AI ile toplanan istihbarat — teknoloji altyapısı, yönetici bilgileri, e-posta formatı, sızıntı geçmişi. 2.490 TL + KDV.</p>
            <Button onClick={() => setStep("form")} size="lg" className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8">
              Analizi Başlat <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-slate-500 text-xs mt-3">Fiyat: 2.490 TL + KDV · Phishing Simülasyonu ile birlikte: 3.490 TL + KDV</p>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">Raporda neler var?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Eye, title: "Maruziyet Skoru", desc: "0-100 arası dijital iz puanı" },
              { icon: AlertTriangle, title: "Saldırı Vektörleri", desc: "Kritik/Yüksek/Orta saldırı giriş noktaları" },
              { icon: Shield, title: "Saldırgan Profili", desc: "30 dakikada öğrenilebileceklerin senaryosu" },
              { icon: Eye, title: "Teknoloji İstihbaratı", desc: "Kullandığınız yazılım ve servisler" },
              { icon: CheckCircle2, title: "Hızlı Önlemler", desc: "Bu hafta kaldırılabilecek bilgiler" },
              { icon: ArrowRight, title: "Saldırı Senaryoları", desc: "Gerçekçi saldırı yolu analizleri" },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border-red-500/20 bg-red-950/10">
                <CardContent className="p-5">
                  <Icon className="h-7 w-7 text-red-500 mb-3" />
                  <h3 className="font-semibold text-sm mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button onClick={() => setStep("form")} size="lg" className="bg-red-600 hover:bg-red-700 text-white px-10">
              Hemen Başla <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "form" && !rid) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-lg">
          <button onClick={() => setStep("landing")} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">← Geri</button>
          <Badge className="mb-4 bg-red-600/20 text-red-400 border-red-600/30">AI Red Team Raporu</Badge>
          <h1 className="text-2xl font-bold mb-2">Şirket Bilgileri</h1>
          <p className="text-muted-foreground text-sm mb-8">OSINT analizi için şirket adı ve domain gerekli.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label>Şirket Adı *</Label>
              <Input placeholder="Acme Teknoloji A.Ş." value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Web Sitesi Domain *</Label>
              <Input placeholder="sirket.com" value={form.domain}
                onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Sadece kamuya açık bilgiler toplanır.</p>
            </div>
            <div>
              <Label>E-posta (isteğe bağlı)</Label>
              <Input type="email" value={form.contactEmail}
                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
              <input type="checkbox" id="consent" checked={form.consentAccepted}
                onChange={e => setForm(p => ({ ...p, consentAccepted: e.target.checked }))}
                className="mt-0.5 h-4 w-4" />
              <label htmlFor="consent" className="text-sm text-muted-foreground">
                Bu şirketi temsil ettiğimi ve kamuya açık bilgilerin analiz edilmesini onayladığımı beyan ederim.
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {loading ? "Analiz Başlatılıyor..." : "Analizi Başlat"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Report view
  if (!reportData || (polling && !reportData.report)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">AI Red Team analizi yapılıyor...</p>
        <p className="text-sm text-muted-foreground/60">Kamuya açık kaynaklardan veri toplanıyor (15-30 saniye)</p>
      </div>
    );
  }

  const rep = reportData.report;
  const attackVectors: any[] = Array.isArray(reportData.attackVectors) ? reportData.attackVectors : [];
  const severityColor: Record<string, string> = {
    critical: "border-red-500 bg-red-50 dark:bg-red-900/20",
    high: "border-orange-500 bg-orange-50 dark:bg-orange-900/20",
    medium: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
    low: "border-slate-400 bg-slate-50 dark:bg-slate-800/30",
  };
  const severityBadge: Record<string, "destructive" | "secondary" | "outline"> = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Badge className="mb-3 bg-red-600/20 text-red-400 border-red-500/30">AI Red Team Raporu</Badge>
        <h1 className="text-3xl font-bold mb-1">{reportData.companyName}</h1>
        <p className="text-muted-foreground text-sm mb-8">{reportData.domain} · Analiz #{reportData.id}</p>

        {/* Exposure Score */}
        {rep?.exposure_score !== undefined && (
          <div className="border rounded-xl p-6 mb-6 bg-red-950/10 border-red-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">Dijital Maruziyet Skoru</span>
              <span className={`text-3xl font-bold ${rep.exposure_score > 60 ? "text-red-500" : rep.exposure_score > 35 ? "text-orange-500" : "text-emerald-500"}`}>
                {rep.exposure_score}/100
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{rep.executive_summary}</p>
          </div>
        )}

        {/* Attacker Profile */}
        {rep?.attacker_profile && (
          <Card className="mb-6 border-red-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                <Eye className="h-4 w-4" /> Saldırgan 30 Dakikada Ne Öğrenir?
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed">{rep.attacker_profile}</p>
            </CardContent>
          </Card>
        )}

        {/* Attack Vectors */}
        {attackVectors.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Tespit Edilen Saldırı Vektörleri
            </h2>
            <div className="space-y-2">
              {attackVectors.map((v: any, i: number) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${severityColor[v.severity] ?? ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={severityBadge[v.severity] ?? "outline"} className="text-xs capitalize">{v.severity}</Badge>
                    <span className="font-semibold text-sm">{v.vector}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Kaynak: {v.source} · {v.example}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Wins */}
        {rep?.quick_wins?.length > 0 && (
          <Card className="mb-6 border-emerald-500/20 bg-emerald-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Bu Hafta Yapabilecekleriniz
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {rep.quick_wins.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="border rounded-xl p-6 text-center">
          <p className="font-semibold mb-2">Bu bilgiler zaten kamuya açık.</p>
          <p className="text-sm text-muted-foreground mb-4">Güvenlik açıklarını da görün — Tam Assessment ile teknik zafiyetleri de analiz edin.</p>
          <Link href="/assessment/start">
            <Button className="bg-primary text-primary-foreground">
              Ücretsiz Risk Değerlendirmesi <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
