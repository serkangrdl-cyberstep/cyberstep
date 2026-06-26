import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportRow {
  id: number;
  customer_id: number;
  customer_name: string | null;
  customer_email: string;
  report_month: string;
  risk_score_current: number | null;
  risk_score_previous: number | null;
  risk_score_change: number | null;
  critical_cve_count: number;
  brand_suspicious_count: number;
  ssl_expiring_count: number;
  generated_at: string;
  pdf_path: string | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function riskLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 80) return "Düşük";
  if (score >= 60) return "Orta";
  if (score >= 40) return "Yüksek";
  return "Kritik";
}

function ChangeChip({ change }: { change: number | null }) {
  if (change === null) return <span className="text-slate-600 text-xs">—</span>;
  const sign = change > 0 ? "+" : "";
  const cls  = change > 0
    ? "text-red-400"
    : change < 0
      ? "text-green-400"
      : "text-slate-500";
  return <span className={`text-xs font-bold ${cls}`}>{sign}{change}</span>;
}

function trMonth(iso: string): string {
  const [y, m] = iso.split("-");
  const names = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                 "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${names[parseInt(m ?? "1", 10)] ?? m} ${y}`;
}

export default function AdminExecutiveDashboard() {
  const [reports, setReports]   = useState<ReportRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [toast, setToast]       = useState<string | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/admin-panel/executive-reports/list").then(r => r.json()) as ReportRow[];
      setReports(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleGenerateAll() {
    setRunning(true);
    try {
      await fetch("/api/admin-panel/executive-reports/generate-now", { method: "POST" });
      setToast("Tüm müşteriler için rapor üretimi başlatıldı. Birkaç dakika sürebilir.");
      setTimeout(() => { void load(); setRunning(false); setToast(null); }, 15000);
    } catch {
      setRunning(false);
    }
  }

  async function handleGenerateOne(customerId: number) {
    setGenerating(customerId);
    try {
      await fetch("/api/admin-panel/executive-reports/generate-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      setToast(`Müşteri ${customerId} için rapor başlatıldı.`);
      setTimeout(() => { void load(); setGenerating(null); setToast(null); }, 10000);
    } catch {
      setGenerating(null);
    }
  }

  // KPI aggregations
  const totalReports   = reports.length;
  const uniqueCustomers = new Set(reports.map(r => r.customer_id)).size;
  const avgScore = reports.length > 0
    ? Math.round(reports.filter(r => r.risk_score_current !== null)
        .reduce((s, r) => s + (r.risk_score_current ?? 0), 0) /
        reports.filter(r => r.risk_score_current !== null).length)
    : null;
  const totalCriticalCve   = reports.reduce((s, r) => s + (r.critical_cve_count ?? 0), 0);
  const totalBrandThreats  = reports.reduce((s, r) => s + (r.brand_suspicious_count ?? 0), 0);

  const KPIS = [
    {
      label: "İzlenen Müşteri",
      value: loading ? "..." : uniqueCustomers,
      sub: `${totalReports} rapor üretildi`,
      color: "text-[#00C8FF]",
    },
    {
      label: "Ortalama Risk Skoru",
      value: loading ? "..." : (avgScore !== null ? `${avgScore}/100` : "—"),
      sub: avgScore !== null ? riskLabel(avgScore) : "Veri yok",
      color: scoreColor(avgScore),
    },
    {
      label: "Toplam Kritik CVE",
      value: loading ? "..." : totalCriticalCve,
      sub: "Tüm müşterilerde",
      color: "text-red-400",
    },
    {
      label: "Marka Tehdidi",
      value: loading ? "..." : totalBrandThreats,
      sub: "Şüpheli taklit domain",
      color: "text-[#F5A623]",
    },
  ];

  // Recent 10 reports for bottom list
  const recent = [...reports].slice(0, 10);

  return (
    <AdminLayout title="Executive Dashboard">
      <div className="p-6 space-y-6" style={{ background: "#060D1A", minHeight: "100vh" }}>

        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#0E1A2E] border border-[#00C8FF]/30 text-[#00C8FF] text-sm px-4 py-3 rounded shadow-lg max-w-sm">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Aylık CISO raporu — müşteri bazlı risk özeti</p>
          </div>
          <Button
            onClick={() => void handleGenerateAll()}
            disabled={running}
            className="bg-[#00C8FF]/10 border border-[#00C8FF]/30 text-[#00C8FF] hover:bg-[#00C8FF]/20"
          >
            {running ? "Uretiliyor..." : "Tum Musteriler Icin Rapor Uret"}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map(kpi => (
            <Card key={kpi.label} style={{ background: "#0E1A2E", border: "1px solid #1a3050" }}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-slate-400 font-normal uppercase tracking-wide">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{kpi.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Müşteri Risk Tablosu */}
        <Card style={{ background: "#0E1A2E", border: "1px solid #1a3050" }}>
          <CardHeader className="px-6 pt-5 pb-3">
            <CardTitle className="text-base text-white">Musteri Risk Tablosu</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Yukleniyor...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Henuz rapor uretilmedi</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 pl-6">Musteri</TableHead>
                    <TableHead className="text-slate-400">Donem</TableHead>
                    <TableHead className="text-slate-400 text-center w-40">Risk Skoru</TableHead>
                    <TableHead className="text-slate-400 text-center">CVE</TableHead>
                    <TableHead className="text-slate-400 text-center">Marka</TableHead>
                    <TableHead className="text-slate-400 text-center">SSL</TableHead>
                    <TableHead className="text-slate-400">Son Rapor</TableHead>
                    <TableHead className="text-slate-400 pr-6">Islemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map(r => (
                    <TableRow key={r.id} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="pl-6 py-3">
                        <div className="font-medium text-sm text-slate-200">{r.customer_name ?? r.customer_email}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{r.customer_email}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-slate-400">{trMonth(r.report_month)}</span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {r.risk_score_current !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-bold ${scoreColor(r.risk_score_current)}`}>
                              {r.risk_score_current}/100
                            </span>
                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBarColor(r.risk_score_current)}`}
                                style={{ width: `${r.risk_score_current}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className={`text-sm font-bold ${(r.critical_cve_count ?? 0) > 0 ? "text-red-400" : "text-slate-500"}`}>
                          {r.critical_cve_count ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className={`text-sm font-bold ${(r.brand_suspicious_count ?? 0) > 0 ? "text-amber-400" : "text-slate-500"}`}>
                          {r.brand_suspicious_count ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className={`text-sm font-bold ${(r.ssl_expiring_count ?? 0) > 0 ? "text-amber-400" : "text-slate-500"}`}>
                          {r.ssl_expiring_count ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-[11px] text-slate-600">
                          {new Date(r.generated_at).toLocaleDateString("tr-TR")}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 py-3">
                        <div className="flex gap-2">
                          {r.pdf_path && (
                            <a
                              href={`/api/admin-panel/executive-reports/${r.id}/download`}
                              className="text-xs px-2 py-1 rounded border border-[#00C8FF]/30 text-[#00C8FF] hover:bg-[#00C8FF]/10 transition-colors"
                            >
                              Indir
                            </a>
                          )}
                          <button
                            onClick={() => void handleGenerateOne(r.customer_id)}
                            disabled={generating === r.customer_id}
                            className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400 hover:border-slate-600 transition-colors disabled:opacity-50"
                          >
                            {generating === r.customer_id ? "..." : "Uret"}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Son Raporlar */}
        <Card style={{ background: "#0E1A2E", border: "1px solid #1a3050" }}>
          <CardHeader className="px-6 pt-5 pb-3">
            <CardTitle className="text-base text-white">Son Uretilen Raporlar</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recent.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">Henuz rapor yok</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 pl-6">Musteri</TableHead>
                    <TableHead className="text-slate-400">Donem</TableHead>
                    <TableHead className="text-slate-400 text-center">Skor</TableHead>
                    <TableHead className="text-slate-400 text-center">Degisim</TableHead>
                    <TableHead className="text-slate-400">Tarih</TableHead>
                    <TableHead className="text-slate-400 pr-6">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map(r => (
                    <TableRow key={`recent-${r.id}`} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="pl-6 py-2.5">
                        <span className="text-sm text-slate-200">{r.customer_name ?? r.customer_email}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-xs text-slate-400">{trMonth(r.report_month)}</span>
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <span className={`text-sm font-bold ${scoreColor(r.risk_score_current)}`}>
                          {r.risk_score_current ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <ChangeChip change={r.risk_score_change} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[11px] text-slate-600">
                          {new Date(r.generated_at).toLocaleDateString("tr-TR")}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 py-2.5">
                        {r.pdf_path ? (
                          <a
                            href={`/api/admin-panel/executive-reports/${r.id}/download`}
                            className="text-xs text-[#00C8FF] hover:underline"
                          >
                            PDF
                          </a>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
