import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, TrendingUp, TrendingDown, Minus, BarChart2, ChevronRight, Info,
  AlertTriangle, CheckCircle2, Loader2, Zap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

// ── Percentile hesabı (normal dağılım yaklaşımı) ──────────────────────────
function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
function normalCDF(x: number, mean: number, std: number) {
  return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
}
function calcPercentile(userScore: number, avgScore: number, topScore: number): number {
  const stdDev = Math.max(1, (topScore - avgScore) / 1.28);
  return Math.max(1, Math.min(99, Math.round(normalCDF(userScore, avgScore, stdDev) * 100)));
}

interface BenchmarkAI {
  baslik: string;
  ana_mesaj: string;
  geri_biraktan_2_faktor: { faktor: string; aciklama: string }[];
  onenin_anlami: string;
  aciliyetSeviyesi: string;
}

const SECTORS = [
  "Finans / Sigorta",
  "Sağlık",
  "Teknoloji / Yazılım",
  "E-ticaret / Perakende",
  "Üretim / Sanayi",
  "Eğitim",
  "Hizmet Sektörü",
  "İnşaat / Gayrimenkul",
  "Diğer",
];

const EMPLOYEE_BANDS = ["1–9", "10–49", "50–249", "250+"];

interface BenchmarkData {
  avgScore: number;
  topScore: number;
  mfaRate: number;
  backupRate: number;
  patchRate: number;
  incidentRate: number;
  avgIncidentCost: string;
  topRisks: string[];
}

const BENCHMARK_DB: Record<string, BenchmarkData> = {
  "Finans / Sigorta": { avgScore: 72, topScore: 91, mfaRate: 84, backupRate: 91, patchRate: 79, incidentRate: 31, avgIncidentCost: "1.2M TL", topRisks: ["İçeriden tehdit", "Kimlik avı", "API güvenlik açıkları"] },
  "Sağlık": { avgScore: 61, topScore: 85, mfaRate: 64, backupRate: 82, patchRate: 61, incidentRate: 42, avgIncidentCost: "2.1M TL", topRisks: ["Fidye yazılımı", "Tıbbi cihaz güvenliği", "KVKK uyumsuzluğu"] },
  "Teknoloji / Yazılım": { avgScore: 68, topScore: 90, mfaRate: 79, backupRate: 87, patchRate: 74, incidentRate: 28, avgIncidentCost: "780K TL", topRisks: ["Kaynak kodu sızdırma", "Tedarik zinciri saldırısı", "Bulut yanlış yapılandırması"] },
  "E-ticaret / Perakende": { avgScore: 55, topScore: 82, mfaRate: 59, backupRate: 76, patchRate: 63, incidentRate: 37, avgIncidentCost: "950K TL", topRisks: ["Ödeme verisi hırsızlığı", "Web uygulama saldırıları", "Bot saldırıları"] },
  "Üretim / Sanayi": { avgScore: 52, topScore: 79, mfaRate: 48, backupRate: 71, patchRate: 55, incidentRate: 33, avgIncidentCost: "1.5M TL", topRisks: ["OT/SCADA güvenliği", "Fidye yazılımı", "Tedarik zinciri"] },
  "Eğitim": { avgScore: 48, topScore: 74, mfaRate: 43, backupRate: 68, patchRate: 51, incidentRate: 44, avgIncidentCost: "420K TL", topRisks: ["Kimlik avı", "Öğrenci verisi ihlali", "Zayıf parola politikası"] },
  "Hizmet Sektörü": { avgScore: 57, topScore: 80, mfaRate: 55, backupRate: 73, patchRate: 60, incidentRate: 29, avgIncidentCost: "650K TL", topRisks: ["Müşteri verisi ihlali", "Kimlik avı", "Yetkisiz erişim"] },
  "İnşaat / Gayrimenkul": { avgScore: 44, topScore: 71, mfaRate: 38, backupRate: 62, patchRate: 48, incidentRate: 22, avgIncidentCost: "580K TL", topRisks: ["BEC dolandırıcılığı", "Zayıf e-posta güvenliği", "Tedarikçi riskleri"] },
  "Diğer": { avgScore: 51, topScore: 77, mfaRate: 49, backupRate: 69, patchRate: 56, incidentRate: 26, avgIncidentCost: "700K TL", topRisks: ["Kimlik avı", "Fidye yazılımı", "Zayıf erişim kontrolü"] },
};

function ScoreDiff({ userScore, benchmark }: { userScore: number; benchmark: number }) {
  const diff = userScore - benchmark;
  if (diff > 5) return <span className="flex items-center gap-1 text-emerald-500 font-semibold"><TrendingUp className="h-4 w-4" />+{diff} puan üstünde</span>;
  if (diff < -5) return <span className="flex items-center gap-1 text-red-500 font-semibold"><TrendingDown className="h-4 w-4" />{diff} puan geride</span>;
  return <span className="flex items-center gap-1 text-amber-500 font-semibold"><Minus className="h-4 w-4" />Ortalamadasınız</span>;
}

export default function SektorelKiyaslama() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Sektörel Siber Güvenlik Kıyaslama | CyberStep.io",
    description: "Şirketinizin siber güvenlik puanını sektör ortalamasıyla karşılaştırın. Ücretsiz benchmark raporu.",
    noIndex: false,
  });

  const [sector, setSector] = useState("");
  const [employees, setEmployees] = useState("");
  const [userScore, setUserScore] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<BenchmarkAI | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const benchmark = sector ? BENCHMARK_DB[sector] : null;
  const score = parseInt(userScore, 10);
  const validScore = !isNaN(score) && score >= 0 && score <= 100;
  const percentile = (benchmark && validScore) ? calcPercentile(score, benchmark.avgScore, benchmark.topScore) : null;

  async function fetchAI(s: string, e: string, sc: number, b: typeof benchmark) {
    if (!b) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/benchmark-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: s, employees: e, userScore: sc,
          avgScore: b.avgScore, topScore: b.topScore,
          percentile: calcPercentile(sc, b.avgScore, b.topScore),
        }),
      });
      if (res.ok) setAiAnalysis(await res.json());
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sector && validScore) {
      setSubmitted(true);
      setAiAnalysis(null);
      fetchAI(sector, employees, score, benchmark);
    }
  }

  const chartData = benchmark
    ? [
        { name: "Sizin Puanınız", value: validScore ? score : 0, color: "#10b981" },
        { name: "Sektör Ort.", value: benchmark.avgScore, color: "#6366f1" },
        { name: "Sektör Lideri", value: benchmark.topScore, color: "#f59e0b" },
      ]
    : [];

  const metricsData = benchmark
    ? [
        { label: "MFA Kullanımı", sektör: benchmark.mfaRate, desc: "MFA kullanan şirket oranı" },
        { label: "Düzenli Yedekleme", sektör: benchmark.backupRate, desc: "Günlük yedekleme yapan şirket oranı" },
        { label: "Yama Yönetimi", sektör: benchmark.patchRate, desc: "Zamanında yama uygulayan şirket oranı" },
      ]
    : [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{lang === "en" ? "Sector Benchmarking" : "Sektörel Kıyaslama"}</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{lang === "en" ? "Compare with Sector Average" : "Sektör Ortalamasıyla Karşılaştır"}</h1>
        <p className="text-muted-foreground max-w-xl">
          Siber güvenlik puanınızı sektörünüzdeki şirketlerin ortalamasıyla kıyaslayın, nerede durduğunuzu görün.
        </p>
      </div>

      {!submitted ? (
        <Card className="shadow-sm mb-8">
          <CardHeader>
            <CardTitle>Bilgilerinizi Girin</CardTitle>
            <CardDescription>CyberStep değerlendirmenizden aldığınız skoru veya tahmini puanınızı girin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Sektörünüz</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SECTORS.map((s) => (
                    <button key={s} type="button" onClick={() => setSector(s)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${sector === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Çalışan Sayısı</label>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYEE_BANDS.map((b) => (
                    <button key={b} type="button" onClick={() => setEmployees(b)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${employees === b ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Siber Güvenlik Puanınız (0–100)</label>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={100} value={userScore}
                    onChange={(e) => setUserScore(e.target.value)}
                    placeholder="Örn: 62"
                    className="w-32 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  />
                  <span className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />CyberStep değerlendirmenizden veya kendi tahmininizden kullanın
                  </span>
                </div>
              </div>

              <Button type="submit" disabled={!sector || !validScore} className="w-full sm:w-auto">
                Kıyaslamayı Göster <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : benchmark && (
        <div className="space-y-6">
          {/* AI Kişisel Analiz */}
          {(aiLoading || aiAnalysis) && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                {aiLoading ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Gemini sektörel pozisyonunuzu analiz ediyor...
                  </div>
                ) : aiAnalysis && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-base mb-1">{aiAnalysis.baslik}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.ana_mesaj}</p>
                      </div>
                    </div>
                    {aiAnalysis.geri_biraktan_2_faktor.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Sizi Geride Bırakan 2 Faktör</p>
                        <div className="space-y-2">
                          {aiAnalysis.geri_biraktan_2_faktor.map((f, i) => (
                            <div key={i} className="rounded-lg bg-background/60 px-3 py-2">
                              <p className="text-sm font-medium text-red-400">{f.faktor}</p>
                              <p className="text-xs text-muted-foreground">{f.aciklama}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <p className="text-xs text-emerald-400">{aiAnalysis.onenin_anlami}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Yüzdelik dilim */}
          {percentile !== null && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Sektörünüzdeki Konumunuz</p>
                    <p className="font-bold text-lg">
                      {percentile < 50
                        ? <>Şirketlerin <span className="text-red-400">%{100 - percentile}'i</span> sizi geçiyor</>
                        : <>Şirketlerin <span className="text-emerald-400">%{percentile}'inin</span> üstündesiniz</>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sector} sektörü · {employees || "tüm büyüklükler"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-4xl font-black ${percentile >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                      %{percentile}
                    </p>
                    <p className="text-xs text-muted-foreground">yüzdelik dilim</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Score comparison chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Puan Karşılaştırması — {sector}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <ScoreDiff userScore={score} benchmark={benchmark.avgScore} />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} puan`, ""]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Sektör Ortalaması — Temel Metrikler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metricsData.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground">%{m.sektör}</span>
                  </div>
                  <Progress value={m.sektör} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Incident stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground mb-1">Sektörde yıllık olay oranı</p>
                <p className="text-3xl font-bold">%{benchmark.incidentRate}</p>
                <p className="text-xs text-muted-foreground mt-1">Şirketlerin bu oranı bir yıl içinde en az bir olay yaşıyor</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground mb-1">Ortalama olay maliyeti</p>
                <p className="text-3xl font-bold">{benchmark.avgIncidentCost}</p>
                <p className="text-xs text-muted-foreground mt-1">Doğrudan ve dolaylı maliyet (kesinti, itibar, hukuk)</p>
              </CardContent>
            </Card>
          </div>

          {/* Top risks */}
          <Card className="shadow-sm border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> {sector} — En Yaygın Tehditler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {benchmark.topRisks.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-amber-500 w-5 text-center">{i + 1}.</span>{r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          {score < benchmark.avgScore && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="pt-5 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1">Puanınızı sektör ortalamasına çıkarın</p>
                  <p className="text-xs text-muted-foreground">Detaylı değerlendirme ile hangi alanlarda iyileştirme gerektiğini görün.</p>
                </div>
                <Link href="/assessment/start">
                  <Button size="sm"><Shield className="mr-2 h-4 w-4" /> Detaylı Değerlendirme</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" onClick={() => { setSubmitted(false); setUserScore(""); }}>
            Tekrar Karşılaştır
          </Button>
        </div>
      )}

      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Sektör ortalamasını geçmek yetmez — gerçek boşlukları görün.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              20 soruluk AI destekli değerlendirmeyle hangi alanlarda geride olduğunuzu somut olarak öğrenin.
            </p>
          </div>
          <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
            Ücretsiz Değerlendirme →
          </a>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Benchmark verileri Türkiye KOBİ siber güvenlik anketleri ve sektör raporlarına dayanmaktadır. Değerler yıllık güncellenmektedir. Gerçek sektör rakamları farklılık gösterebilir.
      </p>
    </div>
  );
}
