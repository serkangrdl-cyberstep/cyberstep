import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useLocation } from "wouter";
import { Mic, Video, ArrowRight, AlertTriangle, CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { Link } from "wouter";

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-600 border-red-500 bg-red-50 dark:bg-red-900/20",
  high: "text-orange-500 border-orange-500 bg-orange-50 dark:bg-orange-900/20",
  medium: "text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
  low: "text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
};
const RISK_LABELS: Record<string, string> = {
  critical: "KRİTİK", high: "YÜKSEK", medium: "ORTA", low: "DÜŞÜK",
};

export default function DeepfakeAnaliziPage() {
  usePageMeta({ title: "Deepfake & Ses Klonu Tehdit Analizi", description: "Yöneticilerinizin sesi veya görüntüsü deepfake saldırısına açık mı? 10 dakikada öğrenin." });

  const params = useParams();
  const reportId = params["id"] ? Number(params["id"]) : null;
  const [, navigate] = useLocation();

  const [form, setForm] = useState({ companyName: "", domain: "", contactEmail: "", sector: "", consentAccepted: false });
  const [step, setStep] = useState<"landing" | "form">(reportId ? "form" : "landing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rid, setRid] = useState(reportId);
  const [reportData, setReportData] = useState<any>(null);
  const [polling, setPolling] = useState(!!reportId);

  useEffect(() => {
    if (!rid) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/deepfake/${rid}/report`);
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
      const r = await fetch("/api/deepfake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Hata"); return; }
      setRid(d.id);
      setPolling(true);
      navigate(`/deepfake-analizi/${d.id}`);
    } catch { setError("Bağlantı hatası"); }
    finally { setLoading(false); }
  }

  // Landing page
  if (step === "landing" && !reportId && !rid) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-b from-purple-950 via-purple-900 to-background pt-20 pb-16 px-4">
          <div className="container mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-purple-600/20 text-purple-300 border-purple-600/30">
              <Mic className="h-3.5 w-3.5 mr-1" /> Deepfake & Ses Klonu Analizi
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Yöneticinizin Sesi<br />
              <span className="text-purple-400">Kopyalanabilir mi?</span>
            </h1>
            <p className="text-purple-100/80 text-lg mb-3">
              Modern ses klonlama araçları <strong className="text-white">3 dakika ses</strong> ile çalışıyor.<br />
              CEO fraud saldırıları Türkiye'de yılda milyonlarca TL zarara neden oluyor.
            </p>
            <p className="text-purple-200/60 text-sm mb-8">Yöneticilerinizin YouTube, LinkedIn veya haber sitelerindeki dijital izini analiz ediyoruz.</p>
            <Button onClick={() => setStep("form")} size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8">
              Analizi Başlat <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-purple-300/50 text-xs mt-3">Fiyat: 1.490 TL · Süre: ~10 dakika</p>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">Raporda neler var?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Mic, title: "Ses Klonu Risk Skoru", desc: "Her yönetici için kamuya açık ses süresi ve risk seviyesi" },
              { icon: Video, title: "Deepfake Risk Analizi", desc: "Video ve fotoğraf maruziyeti değerlendirmesi" },
              { icon: AlertTriangle, title: "Saldırı Senaryosu", desc: "Gerçekçi CEO fraud saldırı senaryosu — Türkiye'den vakalar" },
              { icon: Shield, title: "Doğrulama Protokolü", desc: "Şirkette uygulanabilecek 5 adımlı ses doğrulama prosedürü" },
              { icon: CheckCircle2, title: "Hızlı Önlemler", desc: "Bu hafta uygulanabilecek somut adımlar" },
              { icon: Mic, title: "Çalışan Farkındalık Noktaları", desc: "Ekibinize anlatılması gereken 3-4 kritik konu" },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border-purple-500/20 bg-purple-950/10">
                <CardContent className="p-5">
                  <Icon className="h-7 w-7 text-purple-500 mb-3" />
                  <h3 className="font-semibold text-sm mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button onClick={() => setStep("form")} size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-10">
              Hemen Başla <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Form
  if (!rid) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-lg">
          <button onClick={() => setStep("landing")} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">← Geri</button>
          <Badge className="mb-4 bg-purple-600/20 text-purple-400 border-purple-600/30">Deepfake & Ses Klonu Analizi</Badge>
          <h1 className="text-2xl font-bold mb-2">Şirket Bilgileri</h1>
          <p className="text-muted-foreground text-sm mb-8">Yönetici profillerini bulmak için şirket adı ve domain gerekli.</p>
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
            </div>
            <div>
              <Label>E-posta (isteğe bağlı)</Label>
              <Input type="email" value={form.contactEmail}
                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
              <input type="checkbox" id="consent" checked={form.consentAccepted}
                onChange={e => setForm(p => ({ ...p, consentAccepted: e.target.checked }))} className="mt-0.5 h-4 w-4" />
              <label htmlFor="consent" className="text-sm text-muted-foreground">
                Bu şirketi temsil ettiğimi ve kamuya açık bilgilerin analiz edilmesini onayladığımı beyan ederim.
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? "Analiz Başlatılıyor..." : "Analizi Başlat"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Report polling
  if (!reportData || (polling && !reportData.report)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-purple-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">Deepfake tehdit analizi yapılıyor...</p>
        <p className="text-sm text-muted-foreground/60">Yönetici dijital izi analiz ediliyor (15-30 saniye)</p>
      </div>
    );
  }

  if (reportData.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Rapor oluşturulurken bir hata oluştu.</p>
          <Link href="/deepfake-analizi"><Button variant="outline">Tekrar Dene</Button></Link>
        </div>
      </div>
    );
  }

  const rep = reportData.report;
  const executives: any[] = Array.isArray(reportData.executivesAnalyzed) ? reportData.executivesAnalyzed : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Badge className="mb-3 bg-purple-600/20 text-purple-400 border-purple-500/30">Deepfake & Ses Klonu Tehdit Raporu</Badge>
        <h1 className="text-3xl font-bold mb-1">{reportData.companyName}</h1>
        <p className="text-muted-foreground text-sm mb-8">{reportData.domain} · Analiz #{reportData.id}</p>

        {/* Overall Risk */}
        <div className={`border rounded-xl p-6 mb-6 ${RISK_COLORS[reportData.overallVoiceCloneRisk ?? "medium"] ?? ""}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">Genel Risk Seviyesi</span>
            <span className="font-bold text-xl">{RISK_LABELS[reportData.overallVoiceCloneRisk ?? "medium"] ?? "ORTA"}</span>
          </div>
          <p className="text-sm">{rep?.threat_summary}</p>
        </div>

        {/* Executive Profiles */}
        {executives.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Mic className="h-4 w-4 text-purple-500" /> Yönetici Risk Profilleri
            </h2>
            <div className="space-y-3">
              {executives.map((exec: any, i: number) => (
                <Card key={i} className={`border-l-4 ${RISK_COLORS[exec.voiceCloneRisk ?? "low"]?.split(" ")[2] ?? ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{exec.name}</p>
                        <p className="text-xs text-muted-foreground">{exec.title}</p>
                      </div>
                      <div className="flex gap-1">
                        <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          Ses: {RISK_LABELS[exec.voiceCloneRisk] ?? exec.voiceCloneRisk}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Video: {RISK_LABELS[exec.deepfakeRisk] ?? exec.deepfakeRisk}
                        </Badge>
                      </div>
                    </div>
                    {exec.estimatedAudioMinutes > 0 && (
                      <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          Kamuya açık {exec.estimatedAudioMinutes}+ dakika ses kaydı bulundu.
                          Modern ses klonlama araçları 3 dakika ses ile çalışabiliyor.
                        </p>
                      </div>
                    )}
                    {exec.publicAudioSources?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {exec.publicAudioSources.map((src: string, j: number) => (
                          <p key={j} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mic className="h-3 w-3 text-purple-500" /> {src}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Voice Clone Scenario */}
        {rep?.voice_clone_scenario?.is_possible && (
          <Card className="mb-6 border-red-500/30 bg-red-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Ses Klonu Saldırı Senaryosu
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed mb-3">{rep.voice_clone_scenario.attack_narrative}</p>
              {rep.voice_clone_scenario.financial_risk_tl > 0 && (
                <p className="text-sm font-semibold text-red-500">
                  Potansiyel kayıp: {rep.voice_clone_scenario.financial_risk_tl.toLocaleString()} TL
                </p>
              )}
              {rep.voice_clone_scenario.real_turkey_cases && (
                <p className="text-xs text-muted-foreground mt-2 italic">{rep.voice_clone_scenario.real_turkey_cases}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Verification Protocol */}
        {rep?.verification_protocol?.steps?.length > 0 && (
          <Card className="mb-6 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                <Shield className="h-4 w-4" /> {rep.verification_protocol.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {rep.verification_protocol.steps.map((step: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        {rep?.quick_actions?.length > 0 && (
          <Card className="mb-8 border-emerald-500/20 bg-emerald-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Bu Hafta Yapabilecekleriniz
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {rep.quick_actions.map((a: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="border rounded-xl p-6 text-center">
          <p className="font-semibold mb-2">Sosyal mühendislik riskini tam görün</p>
          <p className="text-sm text-muted-foreground mb-4">Phishing simülasyonu ile çalışanlarınızın tepkisini de ölçün.</p>
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
