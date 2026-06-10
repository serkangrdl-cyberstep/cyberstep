import { useQuery } from "@tanstack/react-query";
import { useRequireCustomer } from "@/hooks/use-customer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Shield, AlertTriangle, TrendingUp, TrendingDown, Globe,
  Lock, Flame, BarChart2, ChevronRight, Activity, CheckCircle2,
  XCircle, ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SecurityOverview {
  creditGrade: string;
  creditScore: number;
  domain: string | null;
  domainScore: number | null;
  lastScanAt: string | null;
  ransomwareScore: number;
  ransomwareBand: "Yüksek" | "Orta" | "Düşük";
  ransomwareFactors: string[];
  domainHijackScore: number | null;
  trend: Array<{ date: string; score: number; grade: string }>;
  sectorBenchmark: { sector: string; avgScore: number; percentile: number } | null;
  signals: {
    breachCount: number;
    criticalCveCount: number;
    orphanedAssets: number;
    openHighRiskPorts: string[];
    assessmentRisk: string | null;
  };
}

// ─── Grade Config ─────────────────────────────────────────────────────────────
const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "A+": { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", label: "Mükemmel" },
  "A":  { color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/40",   label: "Çok İyi" },
  "B+": { color: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/40",    label: "İyi" },
  "B":  { color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/40",  label: "Ortalama" },
  "C":  { color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/40",  label: "Zayıf" },
  "D":  { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/40",     label: "Riskli" },
  "F":  { color: "text-red-600",     bg: "bg-red-600/10",     border: "border-red-600/40",     label: "Kritik Risk" },
};

function gradeConfig(g: string) {
  return GRADE_CONFIG[g] ?? GRADE_CONFIG["C"]!;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

// ─── Credit Rating Badge ──────────────────────────────────────────────────────
function CreditRatingBig({ grade, score }: { grade: string; score: number }) {
  const cfg = gradeConfig(grade);
  return (
    <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 flex flex-col items-center justify-center text-center`}>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
        Siber Güvenlik Notu
      </p>
      <div className={`text-7xl font-black tracking-tight ${cfg.color} leading-none my-3`}>
        {grade}
      </div>
      <p className={`text-sm font-semibold ${cfg.color}`}>{gradeConfig(grade).label}</p>
      <p className="text-xs text-muted-foreground mt-1">{score}/100 kompozit skor</p>
    </div>
  );
}

// ─── Ransomware Score ─────────────────────────────────────────────────────────
function RansomwareCard({ score, band, factors }: { score: number; band: string; factors: string[] }) {
  const cfg =
    band === "Yüksek" ? { color: "text-red-500", bar: "bg-red-500", border: "border-red-500/30" } :
    band === "Orta"   ? { color: "text-orange-500", bar: "bg-orange-500", border: "border-orange-500/30" } :
                        { color: "text-green-500", bar: "bg-green-500", border: "border-green-500/30" };

  return (
    <Card className={`border ${cfg.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Fidye Yazılımı Maruziyet Skoru
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3 mb-3">
          <span className={`text-4xl font-black ${cfg.color}`}>{score}</span>
          <span className="text-muted-foreground text-sm pb-1">/100</span>
          <Badge className={`ml-auto border ${cfg.color} ${cfg.border} bg-transparent`}>
            {band} Risk
          </Badge>
        </div>
        <div className="w-full h-2 bg-muted rounded-full mb-4">
          <div className={`h-2 rounded-full ${cfg.bar} transition-all`} style={{ width: `${score}%` }} />
        </div>
        {factors.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Katkı faktörleri:</p>
            {factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Bilinen fidye yazılımı vektörü tespit edilmedi</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Domain Hijack Score ──────────────────────────────────────────────────────
function DomainHijackCard({ score }: { score: number | null }) {
  if (score === null) return null;
  const band = score >= 80 ? "Güçlü" : score >= 60 ? "Orta" : "Zayıf";
  const cfg =
    score >= 80 ? { color: "text-green-500", bar: "bg-green-500" } :
    score >= 60 ? { color: "text-yellow-500", bar: "bg-yellow-500" } :
                  { color: "text-red-500",    bar: "bg-red-500" };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          Domain Ele Geçirme Dayanıklılığı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3 mb-3">
          <span className={`text-4xl font-black ${cfg.color}`}>{score}</span>
          <span className="text-muted-foreground text-sm pb-1">/100</span>
          <Badge className="ml-auto" variant="outline">{band}</Badge>
        </div>
        <div className="w-full h-2 bg-muted rounded-full mb-4">
          <div className={`h-2 rounded-full ${cfg.bar} transition-all`} style={{ width: `${score}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          SPF, DKIM, DMARC, SSL ve kara liste durumuna göre hesaplanır.
          {score < 80 && " E-posta güvenlik kayıtlarınızı tamamlayarak bu skoru artırabilirsiniz."}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────
function TrendChart({ data }: { data: Array<{ date: string; score: number; grade: string }> }) {
  if (data.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Güvenlik Skoru Trendi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Trend grafiği için en az 2 tarama gerekli.{" "}
            <Link href="/domain-scan" className="text-primary hover:underline">Domain taraması yap →</Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const first = data[0]!.score;
  const last = data[data.length - 1]!.score;
  const delta = last - first;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Güvenlik Skoru Trendi
          </span>
          <span className={`text-xs font-semibold flex items-center gap-1 ${delta >= 0 ? "text-green-500" : "text-red-500"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta} puan
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtDate} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <ReferenceLine y={80} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, _: string, p: { payload: { grade: string } }) => [`${v} (${p.payload.grade})`, "Güvenlik Skoru"]}
                labelFormatter={fmtDate}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Son {data.length} tarama · En son: {fmtDate(data[data.length - 1]!.date)}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Sector Benchmark ─────────────────────────────────────────────────────────
function SectorBenchmarkCard({ benchmark, myScore }: {
  benchmark: { sector: string; avgScore: number; percentile: number };
  myScore: number | null;
}) {
  const score = myScore ?? 50;
  const diff = score - benchmark.avgScore;
  const isAbove = diff >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          Sektör Karşılaştırması
          <Badge variant="outline" className="text-xs ml-auto">{benchmark.sector}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold">{score}</p>
            <p className="text-xs text-muted-foreground">Sizin skorunuz</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${isAbove ? "text-green-500" : "text-red-500"}`}>
              {isAbove ? "+" : ""}{diff}
            </p>
            <p className="text-xs text-muted-foreground">fark</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{benchmark.avgScore}</p>
            <p className="text-xs text-muted-foreground">Sektör ortalaması</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs text-center text-muted-foreground">
          {isAbove
            ? `Sektörünüzdeki şirketlerin %${benchmark.percentile}'i sizin skorunuzun altında.`
            : `Sektör ortalamasının ${Math.abs(diff)} puan altındasınız. İyileştirme fırsatı var.`}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Signal Pills ─────────────────────────────────────────────────────────────
function SignalPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${
      ok ? "border-green-500/30 bg-green-500/5 text-green-600" : "border-red-500/30 bg-red-500/5 text-red-600"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GuvenlikDurumu() {
  useRequireCustomer();

  const { data, isLoading, error } = useQuery<SecurityOverview>({
    queryKey: ["security-overview"],
    queryFn: () =>
      fetch("/api/customer/security-overview", { credentials: "include" }).then(r => {
        if (!r.ok) throw new Error("Yüklenemedi");
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Activity className="h-8 w-8 text-primary animate-pulse mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Güvenlik durumu hesaplanıyor...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <p className="font-semibold mb-2">Henüz güvenlik verisi yok</p>
        <p className="text-sm text-muted-foreground mb-6">
          Güvenlik notunuzu görmek için önce bir domain taraması yapın.
        </p>
        <Link href="/domain-scan">
          <Button>
            Domain Taraması Yap <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const s = data.signals;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Güvenlik Durumu
          </h1>
          {data.domain && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.domain}
              {data.lastScanAt && ` · ${new Date(data.lastScanAt).toLocaleDateString("tr-TR")} tarihli tarama`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/domain-scan">
            <Button variant="outline" size="sm">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Yeni Tarama
            </Button>
          </Link>
          <Link href="/hesabim/bulgularim">
            <Button size="sm" variant="outline">
              Bulgularım <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Top row: Credit Rating + Trend */}
      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <CreditRatingBig grade={data.creditGrade} score={data.creditScore} />
        </div>
        <div className="md:col-span-2">
          <TrendChart data={data.trend} />
        </div>
      </div>

      {/* Signal Pills */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Anlık Durum
        </p>
        <div className="flex flex-wrap gap-2">
          <SignalPill ok={s.breachCount === 0} label={s.breachCount === 0 ? "Sızıntı Yok" : `${s.breachCount} Sızıntı`} />
          <SignalPill ok={s.criticalCveCount === 0} label={s.criticalCveCount === 0 ? "Kritik CVE Yok" : `${s.criticalCveCount} Kritik CVE`} />
          <SignalPill ok={s.orphanedAssets === 0} label={s.orphanedAssets === 0 ? "Gölge IT Yok" : `${s.orphanedAssets} Korumasız Varlık`} />
          <SignalPill ok={s.openHighRiskPorts.length === 0} label={s.openHighRiskPorts.length === 0 ? "Kritik Port Kapalı" : `Açık: ${s.openHighRiskPorts.join(", ")}`} />
          <SignalPill ok={s.assessmentRisk !== "Kritik" && s.assessmentRisk !== "Yüksek"} label={`Assessment: ${s.assessmentRisk ?? "Tamamlanmadı"}`} />
        </div>
      </div>

      {/* Ransomware + Domain Hijack */}
      <div className="grid md:grid-cols-2 gap-5">
        <RansomwareCard
          score={data.ransomwareScore}
          band={data.ransomwareBand}
          factors={data.ransomwareFactors}
        />
        <DomainHijackCard score={data.domainHijackScore} />
      </div>

      {/* Sector benchmark */}
      {data.sectorBenchmark && (
        <SectorBenchmarkCard benchmark={data.sectorBenchmark} myScore={data.domainScore} />
      )}

      {/* CTA — domain scan bağlantısı */}
      {!data.domain && (
        <div className="border-2 border-primary/30 bg-primary/5 rounded-xl p-6 text-center">
          <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="font-semibold mb-1">Domain taraması yaparak güvenlik notunuzu alın</p>
          <p className="text-sm text-muted-foreground mb-4">
            Tarama sonuçları bu sayfaya otomatik yansır.
          </p>
          <Link href="/domain-scan">
            <Button>
              Domain Taraması Başlat <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Navigation cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { href: "/domain-scan", icon: Globe, label: "Domain Taraması", desc: "Detaylı güvenlik analizi" },
          { href: "/hesabim/bulgularim", icon: AlertTriangle, label: "Bulgularım", desc: "Açık güvenlik görevleri" },
          { href: "/hesabim/tedarikci-portfoyu", icon: Shield, label: "Tedarikçi Riski", desc: "Vendor güvenlik skorları" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <div className="border rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
              <Icon className="h-4 w-4 text-primary mb-2" />
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
