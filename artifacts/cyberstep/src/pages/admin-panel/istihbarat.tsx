import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Globe, RefreshCw, CheckCircle, Clock,
  FileText, Send, Users, TrendingUp, AlertCircle, Eye,
} from "lucide-react";

interface MarketInfo {
  countryCode: string;
  countryNameLocal: string;
  isActive: boolean;
  minDomainsForReport: number;
  primaryRegulation: string;
  lastReport?: {
    reportMonth: number;
    reportYear: number;
    status: string;
    domainsAnalyzed: number;
    publishedAt: string | null;
  } | null;
}

interface Report {
  id: number;
  countryCode: string;
  reportMonth: number;
  reportYear: number;
  reportSlug: string;
  status: string;
  domainsAnalyzed: number | null;
  avgRiskScore: string | null;
  pctNoDmarc: string | null;
  pctNoWaf: string | null;
  pctOpenCriticalPort: string | null;
  worstSector: string | null;
  executiveSummary: string | null;
  linkedinPostShort: string | null;
  publishedAt: string | null;
  createdAt: string;
  totalLeadsCaptured: number;
}

interface ReportDetail extends Report {
  sectors: Array<{ sector: string; avgRiskScore: string; domainCount: number; sectorRank: number }>;
  leads: Array<{ id: number; name: string; email: string; company: string; downloadedAt: string }>;
  leadsCount: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  generating: { label: "Üretiliyor", color: "text-yellow-400 border-yellow-500/30", icon: RefreshCw },
  review: { label: "İncelemede", color: "text-blue-400 border-blue-500/30", icon: Eye },
  published: { label: "Yayınlandı", color: "text-green-400 border-green-500/30", icon: CheckCircle },
  archived: { label: "Arşivlendi", color: "text-slate-400 border-slate-500/30", icon: Clock },
  error: { label: "Hata", color: "text-red-400 border-red-500/30", icon: AlertCircle },
};

const MONTHS_TR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export default function IstihbaratPage() {
  const qc = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const marketsQ = useQuery<{ markets: MarketInfo[] }>({
    queryKey: ["intel-markets"],
    queryFn: () => adminFetchJson("/api/admin-panel/intelligence/markets"),
    staleTime: 30000,
  });

  const reportsQ = useQuery<Report[]>({
    queryKey: ["intel-reports"],
    queryFn: () => adminFetchJson("/api/admin-panel/intelligence/reports"),
    staleTime: 15000,
  });

  const reportDetailQ = useQuery<ReportDetail>({
    queryKey: ["intel-report-detail", selectedReportId],
    queryFn: () => adminFetchJson(`/api/admin-panel/intelligence/reports/${selectedReportId}`),
    enabled: !!selectedReportId,
  });

  const generateMut = useMutation({
    mutationFn: ({ countryCode, year, month }: { countryCode: string; year: number; month: number }) =>
      adminFetchJson("/api/admin-panel/intelligence/generate", { method: "POST", body: JSON.stringify({ countryCode, year, month }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel-reports"] });
      setGeneratingFor(null);
    },
  });

  const publishMut = useMutation({
    mutationFn: (id: number) =>
      adminFetchJson(`/api/admin-panel/intelligence/reports/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel-reports"] });
      qc.invalidateQueries({ queryKey: ["intel-report-detail", selectedReportId] });
    },
  });

  const markets = marketsQ.data?.markets || [];
  const reports = reportsQ.data || [];
  const detail = reportDetailQ.data;

  const now = new Date();

  return (
    <AdminLayout title="Sektör İstihbarat Raporu" description="Aylık Türkiye & bölge siber güvenlik endeksi">
      <div className="space-y-6">

        {/* Pazar Durumu */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {markets.map((market) => {
            const last = market.lastReport;
            return (
              <Card key={market.countryCode} className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-cyan-400" />
                      <div>
                        <div className="text-white font-semibold">{market.countryNameLocal} ({market.countryCode})</div>
                        <div className="text-xs text-slate-500">{market.primaryRegulation}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={market.isActive ? "text-green-400 border-green-500/30" : "text-slate-500 border-slate-600"}>
                      {market.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {last ? (
                    <div className="text-sm text-slate-400">
                      Son rapor: <span className="text-white">{MONTHS_TR[last.reportMonth]} {last.reportYear}</span>
                      {" · "}<span className={STATUS_MAP[last.status]?.color || "text-slate-400"}>{STATUS_MAP[last.status]?.label || last.status}</span>
                      {last.domainsAnalyzed && <span className="text-slate-500"> · {last.domainsAnalyzed.toLocaleString()} domain</span>}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Henüz rapor yok</div>
                  )}
                  {market.isActive && (
                    <Button
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 w-full"
                      disabled={generateMut.isPending && generatingFor === market.countryCode}
                      onClick={() => {
                        setGeneratingFor(market.countryCode);
                        generateMut.mutate({ countryCode: market.countryCode, year: now.getFullYear(), month: now.getMonth() + 1 });
                      }}
                    >
                      {generateMut.isPending && generatingFor === market.countryCode ? (
                        <><RefreshCw className="h-3 w-3 animate-spin mr-2" />Üretiliyor...</>
                      ) : (
                        <><BarChart3 className="h-3 w-3 mr-2" />{MONTHS_TR[now.getMonth() + 1]} {now.getFullYear()} Raporunu Üret</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Raporlar Listesi */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Tüm Raporlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportsQ.isLoading ? (
              <div className="text-slate-400 text-sm">Yükleniyor...</div>
            ) : reports.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">Henüz rapor yok. Yukarıdan bir rapor üretin.</div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const statusInfo = STATUS_MAP[r.status] || STATUS_MAP.review;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReportId(selectedReportId === r.id ? null : r.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedReportId === r.id ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"}`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-4 w-4 ${statusInfo.color.split(" ")[0]} ${r.status === "generating" ? "animate-spin" : ""}`} />
                        <div>
                          <div className="text-white font-medium">{MONTHS_TR[r.reportMonth]} {r.reportYear} — {r.countryCode}</div>
                          <div className="text-xs text-slate-500">{r.reportSlug} · {r.domainsAnalyzed?.toLocaleString() || "—"} domain</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.avgRiskScore && (
                          <span className="text-sm text-slate-400">Risk: <span className="text-white">{parseFloat(r.avgRiskScore).toFixed(0)}</span></span>
                        )}
                        <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rapor Detayı */}
        {detail && selectedReportId && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  {MONTHS_TR[detail.reportMonth]} {detail.reportYear} — {detail.countryCode} Detayı
                </CardTitle>
                <div className="flex gap-2">
                  {detail.status === "review" && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => publishMut.mutate(detail.id)} disabled={publishMut.isPending}>
                      <Send className="h-3 w-3 mr-1" />
                      {publishMut.isPending ? "Yayınlanıyor..." : "Yayınla"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* İstatistikler */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "DMARC Eksik", value: detail.pctNoDmarc ? `%${parseFloat(detail.pctNoDmarc).toFixed(1)}` : "—", color: "text-red-400" },
                  { label: "WAF Yok", value: detail.pctNoWaf ? `%${parseFloat(detail.pctNoWaf).toFixed(1)}` : "—", color: "text-orange-400" },
                  { label: "Kritik Port", value: detail.pctOpenCriticalPort ? `%${parseFloat(detail.pctOpenCriticalPort).toFixed(1)}` : "—", color: "text-red-500" },
                  { label: "Ortalama Risk", value: detail.avgRiskScore ? `${parseFloat(detail.avgRiskScore).toFixed(0)}/100` : "—", color: "text-yellow-400" },
                ].map((stat) => (
                  <div key={stat.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Özet */}
              {detail.executiveSummary && (
                <div>
                  <div className="text-sm font-medium text-slate-400 mb-2">Yönetici Özeti</div>
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {detail.executiveSummary}
                  </div>
                </div>
              )}

              {/* Sektör Tablosu */}
              {detail.sectors.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-400 mb-2">Sektör Risk Sıralaması</div>
                  <div className="space-y-2">
                    {detail.sectors.slice(0, 8).map((s) => (
                      <div key={s.sector} className="flex items-center gap-3">
                        <div className="w-4 text-slate-500 text-xs text-right">{s.sectorRank}</div>
                        <div className="text-sm text-slate-300 w-40 capitalize">{s.sector}</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-red-500"
                            style={{ width: `${Math.min(100, parseFloat(s.avgRiskScore || "0"))}%` }}
                          />
                        </div>
                        <div className="text-sm text-white w-12 text-right">{parseFloat(s.avgRiskScore || "0").toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LinkedIn Post */}
              {detail.linkedinPostShort && (
                <div>
                  <div className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    LinkedIn Paylaşımı
                  </div>
                  <div className="p-4 rounded-lg bg-blue-900/10 border border-blue-500/20 text-sm text-slate-300 whitespace-pre-wrap">
                    {detail.linkedinPostShort}
                  </div>
                </div>
              )}

              {/* Leadler */}
              {detail.leadsCount > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Rapor Leadleri ({detail.leadsCount})
                  </div>
                  <div className="space-y-2">
                    {detail.leads.slice(0, 10).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/50">
                        <div>
                          <div className="text-sm text-white">{lead.name} — {lead.company}</div>
                          <div className="text-xs text-slate-500">{lead.email}</div>
                        </div>
                        <div className="text-xs text-slate-500">{new Date(lead.downloadedAt).toLocaleDateString("tr-TR")}</div>
                      </div>
                    ))}
                    {detail.leadsCount > 10 && <div className="text-xs text-slate-600">+{detail.leadsCount - 10} daha</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
