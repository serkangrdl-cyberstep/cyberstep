import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, FileText, Globe, TrendingUp, TrendingDown, Minus,
  Download, ExternalLink, LogOut, CheckCircle2, XCircle, AlertTriangle,
  BarChart3, Clock, Building2, ChevronRight,
} from "lucide-react";
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

        {/* Trend */}
        {completedAssessments.length >= 2 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <BarChart3 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-white font-medium text-sm">Son Değerlendirme Karşılaştırması</p>
                <p className="text-slate-400 text-xs mt-0.5">En son iki sonucunuz arasındaki fark</p>
              </div>
              <ScoreDelta assessments={assessments} />
              <div className="text-right">
                <p className="text-white text-sm font-medium">En İyi: <span className={scoreColor(bestScore)}>%{bestScore}</span></p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="assessments">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="assessments" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <FileText className="h-4 w-4 mr-2" /> Değerlendirmeler ({assessments.length})
            </TabsTrigger>
            <TabsTrigger value="domains" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <Globe className="h-4 w-4 mr-2" /> Alan Adı Taramaları ({domainScans.length})
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
                        <p className="text-slate-500 text-xs mt-2 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(scan.createdAt).toLocaleDateString("tr-TR")}</span>
                          {scan.hibpBreachCount > 0 && <span className="text-red-400">{scan.hibpBreachCount} sızıntı</span>}
                          {scan.blacklisted && <span className="text-red-400">Kara listede</span>}
                          {highRiskShadow > 0 && <span className="text-orange-400">{highRiskShadow} yüksek riskli servis</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className={`text-3xl font-bold ${domainColor}`}>{scan.overallScore}</p>
                          <p className="text-slate-500 text-xs">{passCount}/5 kontrol</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => downloadDomainPDF(scan.id, scan.domain)}
                          disabled={downloadingDomainId === scan.id}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          {downloadingDomainId === scan.id ? "İndiriliyor..." : "PDF"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
