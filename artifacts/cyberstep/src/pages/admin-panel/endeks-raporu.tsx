import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  RefreshCw, TrendingUp, Shield, AlertTriangle, Globe,
  CheckCircle, Loader2, Play, Eye, FileText, Trash2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  period: { start: string; end: string };
  summary: {
    total: number; qualifying: number; avg_score: string;
    min_score: number; max_score: number;
    critical_count: number; high_count: number; medium_count: number; low_count: number;
  };
  scoreDistribution: Record<string, number>;
  dailyTrend: Array<{ scan_date: string; count: number; avg_score: string }>;
  emailSecurity: { dmarc_missing_pct: string; dmarc_none_pct: string; dmarc_reject_pct: string; spf_missing_pct: string; dkim_missing_pct: string };
  portRisk: { mysql_pct: string; ftp_pct: string; rdp_pct: string };
  sectorBreakdown: Array<{ sector: string; count: number; avg_score: string }>;
}

interface IndexReport {
  id: number;
  reportMonth: string;
  periodStart: string;
  periodEnd: string;
  totalDomainsScanned: number;
  qualifyingDomains: number;
  avgSecurityScore: string;
  status: string;
  executiveSummary: string | null;
  keyFindings: Array<{ finding: string; data: string; severity: string; cyberstep_note: string }> | null;
  globalContext: string | null;
  sectorStats: Array<{ sector: string; count: number; avgScore: number; pct: number }> | null;
  generatedAt: string;
  publishedAt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toMonthStr(date: Date): string {
  return date.toISOString().split("T")[0]!.slice(0, 7);
}
function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]!;
}
function firstOfMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]!;
}
function lastOfMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]!;
}
function numPct(s: string | null | undefined): string {
  const n = parseFloat(s ?? "0");
  return isNaN(n) ? "0.0" : n.toFixed(1);
}
function riskColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}
function severityColor(s: string) {
  return s === "critical" ? "bg-red-100 text-red-700 border-red-200"
    : s === "high" ? "bg-orange-100 text-orange-700 border-orange-200"
    : "bg-yellow-100 text-yellow-700 border-yellow-200";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminEndeksRaporu() {
  const qc = useQueryClient();
  const now = new Date();

  const [startDate, setStartDate] = useState(firstOfMonth(now));
  const [endDate,   setEndDate]   = useState(toDateStr(now));
  const [reportMonth, setReportMonth] = useState(toMonthStr(now));
  const [previewMonth, setPreviewMonth] = useState<string | null>(null);

  // ─── Dashboard query ────────────────────────────────────────────────────
  const { data: dash, isFetching: dashLoading, refetch: refreshDash } = useQuery<DashboardData>({
    queryKey: ["index-dashboard", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/admin-panel/index/dashboard?start=${startDate}&end=${endDate}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
  });

  // ─── Reports list ───────────────────────────────────────────────────────
  const { data: reports = [] } = useQuery<IndexReport[]>({
    queryKey: ["index-reports"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/index/reports");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  // ─── Preview single report ──────────────────────────────────────────────
  const { data: previewData } = useQuery<IndexReport>({
    queryKey: ["index-report-detail", previewMonth],
    queryFn: async () => {
      const r = await fetch(`/api/admin-panel/index/${previewMonth}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!previewMonth,
  });

  // ─── Generate mutation ──────────────────────────────────────────────────
  const generateMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin-panel/index/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startDate, end: endDate, reportMonth }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["index-reports"] }); setPreviewMonth(reportMonth); },
  });

  // ─── Publish mutation ───────────────────────────────────────────────────
  const publishMut = useMutation({
    mutationFn: async (month: string) => {
      const r = await fetch(`/api/admin-panel/index/${month}/publish`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["index-reports"] }),
  });

  // ─── Delete mutation ────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (month: string) => {
      const r = await fetch(`/api/admin-panel/index/${month}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["index-reports"] }); if (previewMonth) setPreviewMonth(null); },
  });

  // Quick selectors
  const setThisMonth  = () => { setStartDate(firstOfMonth(now)); setEndDate(toDateStr(now)); };
  const setLastMonth  = () => {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setStartDate(firstOfMonth(lm)); setEndDate(lastOfMonth(lm));
    setReportMonth(toMonthStr(lm));
  };
  const setLast30Days = () => { setStartDate(toDateStr(new Date(now.getTime() - 30 * 86400_000))); setEndDate(toDateStr(now)); };
  const setLast7Days  = () => { setStartDate(toDateStr(new Date(now.getTime() - 7 * 86400_000))); setEndDate(toDateStr(now)); };

  const distroData = dash?.scoreDistribution
    ? Object.entries(dash.scoreDistribution).map(([range, count]) => ({ range, count }))
    : [];
  const trendData = (dash?.dailyTrend ?? []).map(d => ({ date: d.scan_date?.slice(5), count: d.count, avg: parseFloat(d.avg_score ?? "0") }));

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Türkiye Siber Güvenlik Endeksi">
      <div className="p-6 space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Türkiye Siber Güvenlik Endeksi</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Domain tarama verilerinden aylık ulusal güvenlik raporu</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshDash()} disabled={dashLoading}>
            {dashLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Yenile
          </Button>
        </div>

        {/* Tarih seçici */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Başlangıç</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Bitiş</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 h-8 text-sm" />
              </div>
              <Button size="sm" onClick={() => refreshDash()}>Uygula</Button>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex gap-2">
                {[
                  { label: "Bu Ay",      fn: setThisMonth  },
                  { label: "Geçen Ay",   fn: setLastMonth  },
                  { label: "Son 30 Gün", fn: setLast30Days },
                  { label: "Son 7 Gün",  fn: setLast7Days  },
                ].map(({ label, fn }) => (
                  <Button key={label} size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { fn(); setTimeout(() => refreshDash(), 100); }}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Özet KPI'lar */}
        {dash && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Toplam Domain",   value: dash.summary.total?.toLocaleString("tr") ?? "-", icon: Globe, color: "text-blue-600" },
                { label: "Ortalama Skor",   value: `${numPct(dash.summary.avg_score)}/100`,            icon: TrendingUp, color: riskColor(parseFloat(dash.summary.avg_score ?? "0")) },
                { label: "DMARC Eksik",     value: `%${numPct(dash.emailSecurity?.dmarc_missing_pct)}`, icon: AlertTriangle, color: "text-red-600" },
                { label: "MySQL Açık",      value: `%${numPct(dash.portRisk?.mysql_pct)}`,              icon: Shield, color: "text-orange-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Skor dağılımı + Günlük trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Skor Dağılımı</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={distroData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v, "Domain"]} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Günlük Tarama Trendi</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip />
                      <Line yAxisId="left"  type="monotone" dataKey="count" stroke="#3b82f6" dot={false} name="Tarama" />
                      <Line yAxisId="right" type="monotone" dataKey="avg"   stroke="#f59e0b" dot={false} name="Ort. Skor" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* E-posta + Port istatistikleri */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">E-posta Guvenligi</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "DMARC Kaydi Yok",  value: dash.emailSecurity?.dmarc_missing_pct, color: "bg-red-500" },
                    { label: "DMARC p=none",      value: dash.emailSecurity?.dmarc_none_pct,    color: "bg-orange-400" },
                    { label: "DMARC p=reject",    value: dash.emailSecurity?.dmarc_reject_pct,  color: "bg-green-500" },
                    { label: "SPF Kaydi Yok",     value: dash.emailSecurity?.spf_missing_pct,   color: "bg-red-400" },
                    { label: "DKIM Bulunamadi",   value: dash.emailSecurity?.dkim_missing_pct,  color: "bg-yellow-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground w-36 shrink-0">{label}</div>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, parseFloat(value ?? "0"))}%` }} />
                      </div>
                      <div className="text-xs font-mono w-10 text-right">%{numPct(value)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Acik Port Riskleri + Sektor</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {[
                      { label: "MySQL 3306", value: dash.portRisk?.mysql_pct },
                      { label: "FTP 21",     value: dash.portRisk?.ftp_pct   },
                      { label: "RDP 3389",   value: dash.portRisk?.rdp_pct   },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground w-20 shrink-0">{label}</div>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.min(100, parseFloat(value ?? "0") * 5)}%` }} />
                        </div>
                        <div className="text-xs font-mono w-10 text-right">%{numPct(value)}</div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-1">
                    {(dash.sectorBreakdown ?? []).slice(0, 5).map((s) => (
                      <div key={s.sector} className="flex justify-between text-xs">
                        <span className="capitalize">{s.sector}</span>
                        <span className="font-mono">{s.count} domain · {numPct(s.avg_score)}/100</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {dashLoading && !dash && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Veriler yükleniyor...
          </div>
        )}

        <Separator />

        {/* Rapor üretimi */}
        <Card>
          <CardHeader><CardTitle className="text-base">Rapor Üretimi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Rapor Ayı (YYYY-MM)</Label>
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={() => generateMut.mutate()}
                disabled={generateMut.isPending}
              >
                {generateMut.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Olusturuluyor...</>
                  : <><Play className="h-3.5 w-3.5 mr-1.5" />Rapor Olustur</>}
              </Button>
            </div>
            {generateMut.isError && (
              <p className="text-sm text-red-600">{(generateMut.error as Error).message}</p>
            )}
            {generateMut.isSuccess && (
              <p className="text-sm text-green-600">Rapor taslak olarak olusturuldu. Asagidan onizleyin ve yayinlayin.</p>
            )}
          </CardContent>
        </Card>

        {/* Rapor önizleme */}
        {previewMonth && previewData && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{previewData.reportMonth} — Onizleme</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className={previewData.status === "published" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}>
                    {previewData.status === "published" ? "Yayinda" : "Taslak"}
                  </Badge>
                  {previewData.status !== "published" && (
                    <Button size="sm" onClick={() => publishMut.mutate(previewData.reportMonth)} disabled={publishMut.isPending}>
                      {publishMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                      Yayinla
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Silinsin mi?")) deleteMut.mutate(previewData.reportMonth); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {previewData.totalDomainsScanned} domain · {previewData.periodStart} — {previewData.periodEnd} · Ort. {numPct(previewData.avgSecurityScore)}/100
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {previewData.executiveSummary && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Yonetici Ozeti</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{previewData.executiveSummary}</p>
                </div>
              )}

              {previewData.keyFindings && previewData.keyFindings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Ana Bulgular</h3>
                  <div className="space-y-2">
                    {previewData.keyFindings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/20">
                        <Badge variant="outline" className={`shrink-0 text-xs ${severityColor(f.severity)}`}>{f.severity}</Badge>
                        <div>
                          <p className="text-sm font-medium">{f.finding}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{f.data}</p>
                          {f.cyberstep_note && <p className="text-xs text-primary mt-1">{f.cyberstep_note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.sectorStats && previewData.sectorStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Sektor Dagilimi</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 font-medium text-muted-foreground">Sektor</th>
                          <th className="text-right py-1.5 font-medium text-muted-foreground">Domain</th>
                          <th className="text-right py-1.5 font-medium text-muted-foreground">Ort. Skor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.sectorStats.map(s => (
                          <tr key={s.sector} className="border-b last:border-0">
                            <td className="py-1.5 capitalize">{s.sector}</td>
                            <td className="py-1.5 text-right font-mono">{s.count}</td>
                            <td className={`py-1.5 text-right font-mono font-bold ${riskColor(s.avgScore)}`}>{s.avgScore}/100</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewData.globalContext && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Kuresel Baglam</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{previewData.globalContext}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Önceki raporlar listesi */}
        <Card>
          <CardHeader><CardTitle className="text-base">Onceki Raporlar</CardTitle></CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Henuz rapor olusturulmamis.</p>
            ) : (
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.reportMonth}</span>
                        <Badge variant="outline" className={`text-xs ${r.status === "published" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                          {r.status === "published" ? "Yayinda" : "Taslak"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.totalDomainsScanned} domain · Ort. {numPct(r.avgSecurityScore)}/100 · {r.periodStart} — {r.periodEnd}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPreviewMonth(r.reportMonth)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Onizle
                      </Button>
                      {r.status !== "published" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => publishMut.mutate(r.reportMonth)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Yayinla
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
