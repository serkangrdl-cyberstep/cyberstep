import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, CheckCircle2, Shield, TrendingUp, TrendingDown,
  DollarSign, FileText, AlertOctagon, ChevronDown, ChevronRight,
  BarChart2, Target, Clock, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

type Finding = {
  domain: string;
  severity: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  title: string;
  description: string;
  recommendation: string;
};

type DomainScore = {
  domain: string;
  score: number;
  maxScore: number;
  percent: number;
};

type WeeklyTask = { week: number; title: string; tasks: string[] };

interface FullAssessmentTabsProps {
  report: {
    totalScore: number;
    maxScore: number;
    scorePercent: number;
    riskLevel: string;
    redAlarmCount: number;
    redAlarmQuestions?: number[];
    aiAnalysis: string;
    recommendations?: string[];
    domainScores?: DomainScore[];
    maturityLevel?: string | null;
    findings?: Finding[];
    estimatedBreachCostMin?: number | null;
    estimatedBreachCostMax?: number | null;
    riskReductionPercent?: number | null;
    weeklyActionPlan?: WeeklyTask[];
    kvkkPenaltyMin?: number | null;
    kvkkPenaltyMax?: number | null;
    kvkkRiskLevel?: string | null;
    kvkkRiskArticles?: string[];
    kvkkRiskSummary?: string | null;
    sectorBenchmarkPercent?: number | null;
    sectorBenchmarkComment?: string | null;
    verbisRequired?: boolean | null;
    verbisRiskLevel?: string | null;
    verbisSteps?: string[];
    insuranceReadinessPercent?: number | null;
    insuranceGaps?: string[];
    assessmentId?: number;
  };
}

const SEVERITY_COLORS: Record<Finding["severity"], { bg: string; text: string; border: string; dot: string }> = {
  Kritik: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-900", dot: "bg-red-500" },
  Yüksek: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-900", dot: "bg-orange-500" },
  Orta:   { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-900", dot: "bg-yellow-500" },
  Düşük:  { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-900", dot: "bg-blue-500" },
};

const RISK_COLORS: Record<string, string> = {
  Kritik: "#ef4444",
  Yüksek: "#f97316",
  Orta:   "#eab308",
  Düşük:  "#22c55e",
};

const MATURITY_LEVELS = [
  { label: "Başlangıç",    level: 1, color: "bg-red-500" },
  { label: "Gelişmekte",   level: 2, color: "bg-orange-500" },
  { label: "Tanımlanmış",  level: 3, color: "bg-yellow-500" },
  { label: "Yönetilen",    level: 4, color: "bg-blue-500" },
  { label: "Optimize",     level: 5, color: "bg-green-500" },
];

function fmtMoney(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function getBarColor(percent: number) {
  if (percent >= 70) return "#22c55e";
  if (percent >= 40) return "#eab308";
  return "#ef4444";
}

function getRiskBg(level: string) {
  if (level === "Düşük") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (level === "Orta") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (level === "Yüksek") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

function getMaturityNumber(level: string | null | undefined): number {
  if (!level) return 1;
  const match = level.match(/Seviye (\d)/);
  return match ? parseInt(match[1], 10) : 1;
}

export function FullAssessmentTabs({ report }: FullAssessmentTabsProps) {
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  const toggleFinding = (i: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleWeek = (w: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(w) ? next.delete(w) : next.add(w);
      return next;
    });
  };

  const domainScores = report.domainScores ?? [];
  const findings = report.findings ?? [];
  const maturityNum = getMaturityNumber(report.maturityLevel);

  // Radar chart data from domain scores
  const radarData = domainScores.slice(0, 10).map(d => ({
    subject: d.domain.split(" ").slice(0, 2).join(" "),
    value: d.percent,
    fullMark: 100,
  }));

  const criticalCount = findings.filter(f => f.severity === "Kritik").length;
  const highCount = findings.filter(f => f.severity === "Yüksek").length;

  return (
    <div className="mb-6">
      <Tabs defaultValue="genel">
        <TabsList className="w-full grid grid-cols-5 h-auto mb-6 bg-muted/60">
          <TabsTrigger value="genel" className="text-xs sm:text-sm py-2.5 flex flex-col sm:flex-row items-center gap-1">
            <BarChart2 className="h-4 w-4 shrink-0" />
            <span>Genel Bakış</span>
          </TabsTrigger>
          <TabsTrigger value="alan" className="text-xs sm:text-sm py-2.5 flex flex-col sm:flex-row items-center gap-1">
            <Shield className="h-4 w-4 shrink-0" />
            <span>Alan Analizi</span>
          </TabsTrigger>
          <TabsTrigger value="bulgular" className="text-xs sm:text-sm py-2.5 flex flex-col sm:flex-row items-center gap-1 relative">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Bulgular</span>
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {criticalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finansal" className="text-xs sm:text-sm py-2.5 flex flex-col sm:flex-row items-center gap-1">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span>Finansal Risk</span>
          </TabsTrigger>
          <TabsTrigger value="aksiyon" className="text-xs sm:text-sm py-2.5 flex flex-col sm:flex-row items-center gap-1">
            <Target className="h-4 w-4 shrink-0" />
            <span>Aksiyon Planı</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Genel Bakış ── */}
        <TabsContent value="genel" className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Siber Sağlık Skoru</p>
                <p className="text-3xl font-bold">{report.scorePercent}%</p>
                <Badge className={`mt-1 text-xs ${getRiskBg(report.riskLevel)}`}>{report.riskLevel}</Badge>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Acil Müdahale</p>
                <p className="text-3xl font-bold text-red-600">{report.redAlarmCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Kırmızı alarm</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Kritik Bulgu</p>
                <p className="text-3xl font-bold text-orange-600">{criticalCount + highCount}</p>
                <p className="text-xs text-muted-foreground mt-1">{criticalCount} kritik, {highCount} yüksek</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Risk Azaltma</p>
                <p className="text-3xl font-bold text-green-600">
                  {report.riskReductionPercent ? `%${report.riskReductionPercent}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Önerileri uygularsan</p>
              </CardContent>
            </Card>
          </div>

          {/* Olgunluk Seviyesi */}
          {report.maturityLevel && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Siber Güvenlik Olgunluk Seviyesi
                </p>
                <div className="flex gap-2 mb-3">
                  {MATURITY_LEVELS.map(m => (
                    <div
                      key={m.level}
                      className={`flex-1 h-3 rounded-full transition-all ${m.level <= maturityNum ? m.color : "bg-muted"}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${MATURITY_LEVELS[maturityNum - 1]?.color ?? "bg-gray-500"}`}>
                    {maturityNum}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{report.maturityLevel}</p>
                    <p className="text-xs text-muted-foreground">ISO 27001 / NIST CSF çerçevesine göre</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analizi */}
          {report.aiAnalysis && report.aiAnalysis !== "AI analizi yüklenemedi." && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Yönetici Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {report.aiAnalysis.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3 last:mb-0">
                    {para}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Öneriler */}
          {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Öncelikli Öneriler
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground">{rec}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Mini Radar */}
          {radarData.length >= 5 && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Alan Bazlı Risk Profili
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Skor" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: Alan Analizi ── */}
        <TabsContent value="alan" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">10 Alan Puan Tablosu</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={domainScores.map(d => ({ name: d.domain.split(" ").slice(0, 3).join(" "), percent: d.percent, full: d.domain }))}
                  layout="vertical"
                  margin={{ top: 5, right: 40, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `%${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`%${v}`, "Puan"]}
                    labelFormatter={(_, items) => (items[0]?.payload as any)?.full ?? ""}
                  />
                  <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                    {domainScores.map((d, i) => (
                      <Cell key={i} fill={getBarColor(d.percent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {domainScores.map((d) => (
              <Card key={d.domain} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium leading-tight">{d.domain}</p>
                    <span className={`text-sm font-bold ${d.percent >= 70 ? "text-green-600" : d.percent >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                      %{d.percent}
                    </span>
                  </div>
                  <Progress
                    value={d.percent}
                    className={`h-2 ${d.percent >= 70 ? "[&>div]:bg-green-500" : d.percent >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {d.score} / {d.maxScore} puan
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab 3: Bulgular ── */}
        <TabsContent value="bulgular" className="space-y-3">
          {findings.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                Bulgular rapor hazırlanırken oluşturulacak.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {(["Kritik", "Yüksek", "Orta", "Düşük"] as const).map(sev => {
                  const count = findings.filter(f => f.severity === sev).length;
                  const colors = SEVERITY_COLORS[sev];
                  return (
                    <div key={sev} className={`rounded-lg border p-3 text-center ${colors.bg} ${colors.border}`}>
                      <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                      <p className={`text-xs font-medium ${colors.text}`}>{sev}</p>
                    </div>
                  );
                })}
              </div>

              {(["Kritik", "Yüksek", "Orta", "Düşük"] as const).map(sev => {
                const group = findings.filter(f => f.severity === sev);
                if (group.length === 0) return null;
                const colors = SEVERITY_COLORS[sev];
                return (
                  <div key={sev}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${colors.text}`}>
                      {sev} ({group.length})
                    </h3>
                    <div className="space-y-2">
                      {group.map((finding, idx) => {
                        const globalIdx = findings.indexOf(finding);
                        const isExpanded = expandedFindings.has(globalIdx);
                        return (
                          <Card key={idx} className={`shadow-sm border ${colors.border} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => toggleFinding(globalIdx)}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold leading-tight">{finding.title}</p>
                                      <p className={`text-xs mt-0.5 ${colors.text}`}>{finding.domain}</p>
                                    </div>
                                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                  </div>
                                  {isExpanded && (
                                    <div className="mt-3 space-y-2 border-t pt-3">
                                      <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>
                                      <div className={`flex items-start gap-2 rounded-lg p-3 ${colors.bg}`}>
                                        <ArrowRight className={`h-4 w-4 shrink-0 mt-0.5 ${colors.text}`} />
                                        <p className={`text-xs font-medium ${colors.text}`}>{finding.recommendation}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* ── Tab 4: Finansal Risk ── */}
        <TabsContent value="finansal" className="space-y-4">
          {/* İhlal Maliyet Tahmini */}
          {(report.estimatedBreachCostMin || report.estimatedBreachCostMax) && (
            <Card className="shadow-sm border-destructive/20 bg-destructive/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold">Tahmini İhlal Maliyeti</p>
                </div>
                <p className="text-3xl font-bold text-destructive mb-1">
                  {fmtMoney(report.estimatedBreachCostMin)} – {fmtMoney(report.estimatedBreachCostMax)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fidye, üretim kaybı, KVKK cezası ve itibar kaybı dahil. Türkiye KOBİ gerçeklerine göre hesaplandı.
                </p>
                {report.riskReductionPercent && (
                  <div className="mt-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">
                      Öneriler tam uygulanırsa risk %{report.riskReductionPercent} azalır
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sektör Kıyası */}
          {report.sectorBenchmarkPercent != null && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Sektör Kıyası
                </p>
                <div className="flex items-end gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">%{report.sectorBenchmarkPercent}</p>
                    <p className="text-xs text-muted-foreground">Sektör yüzdelik dilimi</p>
                  </div>
                  <div className="flex-1">
                    <Progress value={report.sectorBenchmarkPercent} className="h-3" />
                  </div>
                </div>
                {report.sectorBenchmarkComment && (
                  <p className="text-sm text-muted-foreground">{report.sectorBenchmarkComment}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* KVKK */}
          {report.kvkkRiskLevel && (
            <Card className="shadow-sm border-orange-200 dark:border-orange-900">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-semibold">KVKK Uyumluluk Riski</p>
                  </div>
                  <Badge className={getRiskBg(report.kvkkRiskLevel)}>{report.kvkkRiskLevel}</Badge>
                </div>
                {report.kvkkRiskSummary && (
                  <p className="text-sm text-muted-foreground mb-3">{report.kvkkRiskSummary}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Tahmini Ceza Aralığı</p>
                    <p className="text-base font-bold text-orange-700 dark:text-orange-400">
                      {fmtMoney(report.kvkkPenaltyMin)} – {fmtMoney(report.kvkkPenaltyMax)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Riskli Maddeler</p>
                    <div className="flex flex-wrap gap-1">
                      {(report.kvkkRiskArticles ?? []).map(a => (
                        <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* VERBİS */}
          {report.verbisRequired !== undefined && report.verbisRequired !== null && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold">VERBİS Kayıt Durumu</p>
                  </div>
                  <Badge className={report.verbisRiskLevel ? getRiskBg(report.verbisRiskLevel) : ""}>
                    {report.verbisRequired ? "Kayıt Zorunlu" : "Kayıt Gerekmeyebilir"}
                  </Badge>
                </div>
                {report.verbisSteps && report.verbisSteps.length > 0 && (
                  <ol className="space-y-1.5">
                    {report.verbisSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}

          {/* Siber Sigorta Hazırlığı */}
          {report.insuranceReadinessPercent != null && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Siber Sigorta Hazırlığı</p>
                  </div>
                  <span className={`text-xl font-bold ${report.insuranceReadinessPercent >= 60 ? "text-green-600" : report.insuranceReadinessPercent >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                    %{report.insuranceReadinessPercent}
                  </span>
                </div>
                <Progress value={report.insuranceReadinessPercent} className="h-2 mb-3" />
                {report.insuranceGaps && report.insuranceGaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sigorta kapsamını zorlaştıran eksikler:</p>
                    <ul className="space-y-1.5">
                      {report.insuranceGaps.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 5: Aksiyon Planı ── */}
        <TabsContent value="aksiyon" className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">8 haftalık kademeli iyileştirme planı</p>
          </div>
          {(report.weeklyActionPlan ?? []).map((week) => {
            const isExpanded = expandedWeeks.has(week.week);
            return (
              <Card key={week.week} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => toggleWeek(week.week)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      week.week <= 2 ? "bg-red-500" : week.week <= 4 ? "bg-orange-500" : week.week <= 6 ? "bg-yellow-500" : "bg-green-500"
                    }`}>
                      {week.week}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{week.title}</p>
                      <p className="text-xs text-muted-foreground">{week.tasks.length} görev</p>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                  {isExpanded && (
                    <ul className="mt-3 space-y-2 border-t pt-3 ml-11">
                      {week.tasks.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(report.weeklyActionPlan ?? []).length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                Aksiyon planı rapor hazırlanırken oluşturulacak.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
