import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, FileText, Globe, TrendingUp, TrendingDown, Minus,
  Download, ExternalLink, LogOut, CheckCircle2, XCircle, AlertTriangle,
  BarChart3, Clock, Building2, ChevronRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireCustomer } from "@/hooks/use-customer";

interface CustomerAssessment {
  id: number;
  companyName: string;
  sector: string;
  employeeCount: string;
  assessmentType: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  riskLevel: string | null;
  scorePercent: number | null;
  totalScore: number | null;
  maxScore: number | null;
  redAlarmCount: number | null;
  reportId: number | null;
}

interface CustomerDomainScan {
  id: number;
  domain: string;
  overallScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  mxPass: boolean;
  sslPass: boolean;
  hibpBreachCount: number;
  blacklisted: boolean;
  shadowItServices: Array<{ name: string; category: string; risk: string }>;
  urlhausListed: boolean;
  usomListed: boolean;
  httpHeadersScore: number;
  ctSubdomainCount: number;
  virusTotalReputation: number | null;
  virusTotalMalicious: number;
  abuseIpdbScore: number | null;
  abuseIpdbTotalReports: number;
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  shodanVulnCount: number;
  createdAt: string;
}

const RISK_COLORS: Record<string, string> = {
  "Kritik": "bg-red-500/20 text-red-400 border-red-500/30",
  "Yüksek": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Orta":   "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Düşük":  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function scoreColor(pct: number | null) {
  if (pct === null) return "text-slate-400";
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 40) return "text-amber-400";
  return "text-red-400";
}

function ScoreDelta({ assessments }: { assessments: CustomerAssessment[] }) {
  const completed = assessments.filter(a => a.scorePercent !== null);
  if (completed.length < 2) return null;
  const latest = completed[0].scorePercent!;
  const previous = completed[1].scorePercent!;
  const diff = latest - previous;
  if (diff === 0) return <span className="flex items-center gap-1 text-slate-400 text-sm"><Minus className="h-4 w-4" />Değişim yok</span>;
  if (diff > 0) return <span className="flex items-center gap-1 text-emerald-400 text-sm"><TrendingUp className="h-4 w-4" />+{diff} puan iyileşme</span>;
  return <span className="flex items-center gap-1 text-red-400 text-sm"><TrendingDown className="h-4 w-4" />{diff} puan gerileme</span>;
}

export default function CustomerReports() {
  const { data: customer } = useRequireCustomer();
  const qc = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingDomainId, setDownloadingDomainId] = useState<number | null>(null);

  const { data: assessments = [], isLoading: loadingA } = useQuery<CustomerAssessment[]>({
    queryKey: ["customer-assessments"],
    queryFn: () => fetch("/api/customer/assessments", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
  });

  const { data: domainScans = [], isLoading: loadingD } = useQuery<CustomerDomainScan[]>({
    queryKey: ["customer-domain-scans"],
    queryFn: () => fetch("/api/customer/domain-scans", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  async function downloadAssessmentPDF(id: number) {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/assessments/${id}/report/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF indirilemedi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Rapor_${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadDomainPDF(id: number, domain: string) {
    setDownloadingDomainId(id);
    try {
      const res = await fetch(`/api/domain-scan/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF indirilemedi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Domain_${domain}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingDomainId(null);
    }
  }

  if (!customer) return null;

  const completedAssessments = assessments.filter(a => a.scorePercent !== null);
  const avgScore = completedAssessments.length
    ? Math.round(completedAssessments.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / completedAssessments.length)
    : null;
  const bestScore = completedAssessments.length
    ? Math.max(...completedAssessments.map(a => a.scorePercent ?? 0))
    : null;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-500" />
              <span className="font-bold text-lg text-white">CyberStep.io</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/hesabim" className="text-slate-400 hover:text-white text-sm transition-colors">Hesabım</Link>
              <Link href="/raporlarim" className="text-white text-sm font-medium">Raporlarım</Link>
              <Link href="/entegrasyonlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Entegrasyonlar</Link>
              <Link href="/pentest-lite" className="text-slate-400 hover:text-white text-sm transition-colors">Saldırı Yüzeyi</Link>
              <Link href="/hesabim/yonetim-raporu" className="text-slate-400 hover:text-white text-sm transition-colors">YK Raporu</Link>
              <Link href="/hesabim/davet" className="text-slate-400 hover:text-white text-sm transition-colors">Davet</Link>
            </nav>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Raporlarım</h1>
            <p className="text-slate-400 mt-1">Değerlendirmeleriniz ve alan adı taramalarınızın geçmişi</p>
          </div>
          <Link href="/assessment/start">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Yeni Değerlendirme <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-500 text-xs mb-1">Toplam Değerlendirme</p>
              <p className="text-2xl font-bold text-white">{assessments.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-500 text-xs mb-1">Tamamlanan</p>
              <p className="text-2xl font-bold text-emerald-400">{completedAssessments.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-500 text-xs mb-1">Ortalama Skor</p>
              <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore !== null ? `%${avgScore}` : "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-500 text-xs mb-1">Alan Adı Taraması</p>
              <p className="text-2xl font-bold text-white">{domainScans.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* İyileşme Grafiği — 2+ tamamlanmış değerlendirme varsa göster */}
        {completedAssessments.length >= 2 && (() => {
          const chartData = [...completedAssessments]
            .reverse()
            .map((a, i) => ({
              idx: i + 1,
              date: new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
              skor: a.scorePercent ?? 0,
              type: a.assessmentType === "full" ? "Tam" : "Mini",
            }));
          const firstScore = chartData[0].skor;
          const lastScore = chartData[chartData.length - 1].skor;
          const delta = lastScore - firstScore;

          return (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-white text-sm">Siber Güvenlik Skor Geçmişi</CardTitle>
                    <p className="text-slate-400 text-xs mt-0.5">{completedAssessments.length} tamamlanmış değerlendirme</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {delta > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4" /> +{delta.toFixed(0)} puan iyileşme
                      </span>
                    )}
                    {delta < 0 && (
                      <span className="flex items-center gap-1 text-red-400 text-sm font-semibold">
                        <TrendingDown className="h-4 w-4" /> {delta.toFixed(0)} puan
                      </span>
                    )}
                    {delta === 0 && (
                      <span className="flex items-center gap-1 text-slate-400 text-sm">
                        <Minus className="h-4 w-4" /> Değişim yok
                      </span>
                    )}
                    <span className="text-slate-500 text-xs">En İyi: <span className={scoreColor(bestScore)}>%{bestScore}</span></span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[200px] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `%${v}`} />
                    <ReferenceLine y={70} stroke="hsl(142 71% 45%)" strokeDasharray="4 2" strokeOpacity={0.4} />
                    <ReferenceLine y={40} stroke="hsl(35 92% 60%)" strokeDasharray="4 2" strokeOpacity={0.4} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v: number, _: string, props: any) => [`%${v} — ${props.payload?.type}`, "Skor"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="skor"
                      stroke="hsl(142 71% 45%)"
                      strokeWidth={2.5}
                      fill="url(#scoreGradient)"
                      dot={{ fill: "hsl(142 71% 45%)", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "hsl(142 71% 45%)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 justify-center mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-6 h-0 border border-dashed border-emerald-500/50 inline-block" /> %70 hedef
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-6 h-0 border border-dashed border-amber-400/50 inline-block" /> %40 orta sınır
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <Tabs defaultValue="assessments">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="assessments" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <FileText className="h-4 w-4 mr-2" /> Değerlendirmeler ({assessments.length})
            </TabsTrigger>
            <TabsTrigger value="domains" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <Globe className="h-4 w-4 mr-2" /> Alan Adı Taramaları ({domainScans.length})
            </TabsTrigger>
            <TabsTrigger value="annual" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <BarChart3 className="h-4 w-4 mr-2" /> Yıllık Raporlar
            </TabsTrigger>
          </TabsList>

          {/* Assessments Tab */}
          <TabsContent value="assessments" className="mt-4 space-y-3">
            {loadingA && (
              <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
            )}
            {!loadingA && assessments.length === 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400">Henüz değerlendirme bulunmuyor.</p>
                  <Link href="/assessment/start">
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">İlk Değerlendirmeyi Başlat</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            {assessments.map((a) => (
              <Card key={a.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{a.companyName}</p>
                        <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-xs capitalize">
                          {a.assessmentType === "mini" ? "Mini (20 Soru)" : "Tam (55 Soru)"}
                        </Badge>
                        {a.riskLevel && (
                          <Badge className={`text-xs ${RISK_COLORS[a.riskLevel] ?? "bg-slate-700 text-slate-400"}`}>
                            {a.riskLevel} Risk
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{a.sector}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(a.createdAt).toLocaleDateString("tr-TR")}</span>
                      </p>
                      {a.redAlarmCount !== null && a.redAlarmCount > 0 && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> {a.redAlarmCount} kırmızı alarm
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {a.scorePercent !== null ? (
                        <div className="text-center">
                          <p className={`text-3xl font-bold ${scoreColor(a.scorePercent)}`}>%{a.scorePercent}</p>
                          <p className="text-slate-500 text-xs">{a.totalScore}/{a.maxScore} puan</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-slate-500 text-sm">
                            {a.status === "in_progress" ? "Devam ediyor" : "Rapor bekleniyor"}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {a.reportId && (
                          <Link href={`/assessment/${a.id}/report`}>
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 w-full">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Raporu Gör
                            </Button>
                          </Link>
                        )}
                        {a.reportId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 w-full"
                            onClick={() => downloadAssessmentPDF(a.id)}
                            disabled={downloadingId === a.id}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            {downloadingId === a.id ? "İndiriliyor..." : "PDF"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Domain Scans Tab */}
          <TabsContent value="domains" className="mt-4 space-y-3">
            {loadingD && (
              <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
            )}
            {!loadingD && domainScans.length === 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-12 text-center">
                  <Globe className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400">Henüz alan adı taraması bulunmuyor.</p>
                  <Link href="/domain-tarama">
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">Alan Adı Taramayı Başlat</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            {domainScans.map((scan) => {
              const checks = [scan.spfPass, scan.dmarcPass, scan.dkimPass, scan.mxPass, scan.sslPass];
              const passCount = checks.filter(Boolean).length;
              const domainColor = scan.overallScore >= 80 ? "text-emerald-400" : scan.overallScore >= 60 ? "text-amber-400" : scan.overallScore >= 40 ? "text-orange-400" : "text-red-400";
              const highRiskShadow = (scan.shadowItServices ?? []).filter((s) => s.risk === "Yüksek").length;
              return (
                <Card key={scan.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold font-mono">{scan.domain}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {[
                            { label: "SPF", pass: scan.spfPass },
                            { label: "DMARC", pass: scan.dmarcPass },
                            { label: "DKIM", pass: scan.dkimPass },
                            { label: "MX", pass: scan.mxPass },
                            { label: "SSL", pass: scan.sslPass },
                          ].map(c => (
                            <span key={c.label} className={`flex items-center gap-1 text-xs ${c.pass ? "text-emerald-400" : "text-red-400"}`}>
                              {c.pass ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {c.label}
                            </span>
                          ))}
                        </div>
                        <p className="text-slate-500 text-xs mt-2 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(scan.createdAt).toLocaleDateString("tr-TR")}</span>
                          {scan.hibpBreachCount > 0 && <span className="text-red-400">{scan.hibpBreachCount} sızıntı</span>}
                          {scan.blacklisted && <span className="text-red-400">Kara listede</span>}
                          {scan.urlhausListed && <span className="text-red-400">URLhaus</span>}
                          {scan.usomListed && <span className="text-red-400">USOM listesinde</span>}
                          {highRiskShadow > 0 && <span className="text-orange-400">{highRiskShadow} yüksek riskli servis</span>}
                          {scan.ctSubdomainCount > 0 && <span className="text-slate-400">{scan.ctSubdomainCount} alt alan</span>}
                          {scan.httpHeadersScore > 0 && <span className="text-slate-400">Baslik skoru: {scan.httpHeadersScore}/100</span>}
                          {(scan as any).kepConfigured && <span className="text-blue-400">KEP yapılandırılmış</span>}
                          {(scan as any).kepConfigured === false && <span className="text-slate-500">KEP yok</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className="text-center">
                          <p className={`text-3xl font-bold ${domainColor}`}>{scan.overallScore}</p>
                          <p className="text-slate-500 text-xs">{passCount}/5 kontrol</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-7 px-3 text-xs"
                            onClick={() => downloadDomainPDF(scan.id, scan.domain)}
                            disabled={downloadingDomainId === scan.id}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {downloadingDomainId === scan.id ? "..." : "PDF"}
                          </Button>
                          {(scan as any).badgeToken && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-7 px-3 text-xs"
                              onClick={() => {
                                const url = `${window.location.origin}/domain-tarama?id=${scan.id}`;
                                window.open(url, "_blank");
                              }}
                            >
                              Rozet
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Annual Reports Tab */}
          <AnnualReportsTab />
        </Tabs>
      </div>
    </div>
  );
}

interface AnnualReportRow {
  id: number;
  domain: string;
  company_name: string | null;
  year: number;
  year_end_score: number;
  year_end_grade: string | null;
  score_delta: number | null;
  total_scans: number;
  pdf_url: string | null;
  created_at: string;
}

function AnnualReportsTab() {
  const { data: customer } = useRequireCustomer();
  const { data: reports = [], isLoading } = useQuery<AnnualReportRow[]>({
    queryKey: ["customer-annual-reports"],
    queryFn: () => fetch("/api/customer/annual-reports", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
  });

  const gradeColor = (g: string | null) => {
    if (g === "A") return "text-emerald-400";
    if (g === "B") return "text-lime-400";
    if (g === "C") return "text-amber-400";
    if (g === "D") return "text-orange-400";
    return "text-red-400";
  };

  return (
    <TabsContent value="annual" className="mt-4 space-y-3">
      {isLoading && <div className="text-center py-12 text-slate-500">Yükleniyor...</div>}
      {!isLoading && reports.length === 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">Henüz yıllık rapor bulunmuyor.</p>
            <p className="text-slate-500 text-sm mt-2">
              Yıllık güvenlik raporları her yıl 1 Ocak'ta otomatik olarak oluşturulur.
            </p>
          </CardContent>
        </Card>
      )}
      {reports.map((r) => (
        <Card key={r.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold">{r.domain}</p>
                  <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-xs">
                    {r.year} Yılı
                  </Badge>
                  {r.year_end_grade && (
                    <Badge className={`text-xs bg-slate-800 border-slate-600 ${gradeColor(r.year_end_grade)}`}>
                      {r.year_end_grade} Notu
                    </Badge>
                  )}
                </div>
                <p className="text-slate-400 text-sm mt-1 flex items-center gap-3">
                  <span>{r.total_scans} tarama</span>
                  {r.score_delta !== null && (
                    <span className={r.score_delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {r.score_delta >= 0 ? `+${r.score_delta}` : r.score_delta} puan değişim
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-3xl font-bold ${gradeColor(r.year_end_grade)}`}>{r.year_end_score}</p>
                  <p className="text-slate-500 text-xs">/ 100 puan</p>
                </div>
                {r.pdf_url && (
                  <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                      <Download className="h-3.5 w-3.5 mr-1" /> PNG İndir
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </TabsContent>
  );
}
