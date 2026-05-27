import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, CheckCircle2, XCircle, Download, Search, AlertTriangle,
  BarChart3, Shield, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DomainScanStats {
  total: number;
  avgScore: number;
  passRates: {
    spf: number; dmarc: number; dkim: number; mx: number; ssl: number;
    cleanBlacklist: number; cleanHibp: number;
  };
  monthly: Array<{ month: string; scan_count: number; avg_score: number }>;
}

interface DomainScanRow {
  id: number;
  domain: string;
  email: string | null;
  overallScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  mxPass: boolean;
  sslPass: boolean;
  hibpBreachCount: number;
  blacklisted: boolean;
  shadowItServices: Array<{ name: string; risk: string }>;
  createdAt: string;
}

interface ScanList {
  total: number;
  page: number;
  rows: DomainScanRow[];
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  if (s >= 40) return "text-orange-400";
  return "text-red-400";
}

function PassBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}>%{pct}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminDomainTaramalar() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: stats } = useQuery<DomainScanStats>({
    queryKey: ["admin-domain-stats"],
    queryFn: () => fetch("/api/admin-panel/domain-scans/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: list, isLoading } = useQuery<ScanList>({
    queryKey: ["admin-domain-scans", q, page],
    queryFn: () => fetch(`/api/admin-panel/domain-scans?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include" }).then(r => r.json()),
  });

  async function downloadPDF(id: number, domain: string) {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/domain-scan/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF indirilemedi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Domain_${domain}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  const monthlyData = (stats?.monthly ?? []).map(m => ({
    month: m.month.slice(5),
    Tarama: m.scan_count,
    "Ort. Skor": m.avg_score,
  }));

  const totalPages = Math.ceil((list?.total ?? 0) / 50);

  return (
    <AdminLayout title="Alan Adı Taramaları" description="Tüm domain güvenlik taramalarını yönetin">
      <div className="space-y-6 max-w-6xl">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Toplam Tarama</p>
                <p className="text-3xl font-bold text-white">{stats?.total ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Ortalama Güvenlik Skoru</p>
                <p className={`text-3xl font-bold ${scoreColor(stats?.avgScore ?? 0)}`}>{stats?.avgScore ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-6 w-6 text-sky-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">SSL Geçiş Oranı</p>
                <p className={`text-3xl font-bold ${scoreColor(stats?.passRates.ssl ?? 0)}`}>%{stats?.passRates.ssl ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Check Pass Rates + Monthly Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Kontrol Geçiş Oranları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats ? <>
                <PassBar label="SPF" pct={stats.passRates.spf} />
                <PassBar label="DMARC" pct={stats.passRates.dmarc} />
                <PassBar label="DKIM" pct={stats.passRates.dkim} />
                <PassBar label="MX" pct={stats.passRates.mx} />
                <PassBar label="SSL/TLS" pct={stats.passRates.ssl} />
                <PassBar label="Kara Liste Temiz" pct={stats.passRates.cleanBlacklist} />
                <PassBar label="HIBP Temiz" pct={stats.passRates.cleanHibp} />
              </> : <p className="text-slate-500 text-sm">Yükleniyor...</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Aylık Tarama Aktivitesi</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#10b981" }}
                    />
                    <Bar dataKey="Tarama" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-500 text-sm pt-8 text-center">Henüz yeterli veri yok</p>}
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Domain veya e-posta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setQ(search); setPage(1); } }}
              className="pl-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setQ(search); setPage(1); }}>
            Ara
          </Button>
        </div>

        {/* Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Domain</th>
                  <th className="px-4 py-3 text-left">E-posta</th>
                  <th className="px-4 py-3 text-center">Skor</th>
                  <th className="px-4 py-3 text-center">Kontroller</th>
                  <th className="px-4 py-3 text-center">HIBP</th>
                  <th className="px-4 py-3 text-center">Kara Liste</th>
                  <th className="px-4 py-3 text-center">Gölge BT</th>
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-center">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Yükleniyor...
                  </td></tr>
                )}
                {!isLoading && (list?.rows ?? []).length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Tarama bulunamadı</td></tr>
                )}
                {(list?.rows ?? []).map(scan => {
                  const checks = [scan.spfPass, scan.dmarcPass, scan.dkimPass, scan.mxPass, scan.sslPass];
                  const passCount = checks.filter(Boolean).length;
                  const highRisk = (scan.shadowItServices ?? []).filter(s => s.risk === "Yüksek").length;
                  return (
                    <tr key={scan.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-white font-medium text-xs">{scan.domain}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{scan.email ?? <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-bold ${scoreColor(scan.overallScore)}`}>{scan.overallScore}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {[
                            { label: "S", pass: scan.spfPass },
                            { label: "D", pass: scan.dmarcPass },
                            { label: "K", pass: scan.dkimPass },
                            { label: "M", pass: scan.mxPass },
                            { label: "L", pass: scan.sslPass },
                          ].map(c => (
                            <span key={c.label} className={`text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold ${c.pass ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scan.hibpBreachCount > 0
                          ? <span className="text-red-400 text-xs font-medium flex items-center justify-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{scan.hibpBreachCount}</span>
                          : <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scan.blacklisted
                          ? <XCircle className="h-4 w-4 text-red-400 inline" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {highRisk > 0
                          ? <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">{highRisk} yüksek</Badge>
                          : <span className="text-slate-600 text-xs">{(scan.shadowItServices ?? []).length} servis</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(scan.createdAt).toLocaleDateString("tr-TR")}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 border-slate-600 text-slate-300 hover:bg-slate-700"
                          onClick={() => downloadPDF(scan.id, scan.domain)}
                          disabled={downloadingId === scan.id}
                        >
                          {downloadingId === scan.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
              <span className="text-slate-500 text-xs">{list?.total ?? 0} tarama, sayfa {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
