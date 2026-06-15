import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor, Search, X, ChevronDown, ChevronUp,
  Shield, Brain, ClipboardList, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewCustomer {
  customer_id: number;
  email: string;
  company_name: string | null;
  sector: string | null;
  scan_id: number | null;
  hostname: string | null;
  internal_score: number | null;
  scan_type: string | null;
  scanned_at: string | null;
  findings_count: number | null;
  external_score: number | null;
  letter_grade: string | null;
  ai_report_id: number | null;
  ai_report_date: string | null;
  survey_id: number | null;
  backup_enabled: boolean | null;
  ir_plan_exists: boolean | null;
  kvkk_verbis_registered: boolean | null;
  cyber_insurance: boolean | null;
}

interface OverviewStats {
  total_customers: number;
  scanned: number;
  not_scanned: number;
  avg_internal_score: number;
  ai_report_generated: number;
  survey_completed: number;
}

interface OverviewData {
  customers: OverviewCustomer[];
  stats: OverviewStats;
}

interface DetailScan {
  id: number;
  hostname: string | null;
  internalScore: number | null;
  scanType: string | null;
  scannedAt: string | null;
}

interface DetailAiReport {
  id: number;
  executiveSummary: string | null;
  criticalActions: Array<{ title: string }> | null;
  generatedAt: string | null;
}

interface DetailSurvey {
  id: number;
  backupEnabled: boolean | null;
  irPlanExists: boolean | null;
  kvkkVerbisRegistered: boolean | null;
  cyberInsurance: boolean | null;
}

interface DetailData {
  scans: DetailScan[];
  aiReport: DetailAiReport | null;
  survey: DetailSurvey | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score == null) return "bg-slate-800";
  if (score >= 70) return "bg-emerald-950/50 border-emerald-800/50";
  if (score >= 50) return "bg-amber-950/50 border-amber-800/50";
  return "bg-red-950/50 border-red-800/50";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Customer Detail Panel ─────────────────────────────────────────────────────

function CustomerDetail({
  customerId,
  onClose,
}: {
  customerId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<DetailData>({
    queryKey: ["admin-ic-tarama-detail", customerId],
    queryFn: () =>
      fetch(`/api/admin-panel/internal-scans/customer/${customerId}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  return (
    <div className="bg-slate-900 border border-cyan-700/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-220px)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Müşteri Detayı</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="text-slate-400 text-sm py-4 text-center">Yükleniyor...</div>
      )}

      {data && (
        <>
          {/* Tarama Geçmişi */}
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
              Tarama Geçmişi
            </div>
            {data.scans.length === 0 ? (
              <div className="text-sm text-slate-500">Henüz iç tarama yapılmamış</div>
            ) : (
              <div className="space-y-2">
                {data.scans.map((scan) => (
                  <div
                    key={scan.id}
                    className={`border rounded-lg p-3 flex items-center justify-between ${scoreBg(scan.internalScore)}`}
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {scan.hostname ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {scan.scanType ?? "—"} · {fmtDate(scan.scannedAt)}
                      </div>
                    </div>
                    <div className={`text-2xl font-black ${scoreColor(scan.internalScore)}`}>
                      {scan.internalScore ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Raporu */}
          {data.aiReport && (
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                AI Güvenlik Raporu
              </div>
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-2">
                  {fmtDate(data.aiReport.generatedAt)}
                </div>
                {data.aiReport.executiveSummary && (
                  <div className="text-xs text-slate-300 leading-relaxed mb-3">
                    {data.aiReport.executiveSummary.slice(0, 300)}
                    {data.aiReport.executiveSummary.length > 300 ? "..." : ""}
                  </div>
                )}
                {data.aiReport.criticalActions?.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400 mb-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    {a.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anket */}
          {data.survey && (
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                Anket Durumu
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Yedekleme", val: data.survey.backupEnabled },
                  { label: "IR Planı", val: data.survey.irPlanExists },
                  { label: "VERBİS", val: data.survey.kvkkVerbisRegistered },
                  { label: "Siber Sigorta", val: data.survey.cyberInsurance },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center text-xs"
                  >
                    <span className="text-slate-400">{item.label}</span>
                    <span
                      className={
                        item.val === true
                          ? "text-emerald-400"
                          : item.val === false
                          ? "text-red-400"
                          : "text-slate-500"
                      }
                    >
                      {item.val === true ? "Var" : item.val === false ? "Yok" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data.aiReport && !data.survey && data.scans.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">
              Bu müşteri için veri yok
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterType = "all" | "scanned" | "not_scanned";

export default function AdminIcTaramaAdmin() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["admin-ic-tarama-overview"],
    queryFn: () =>
      fetch("/api/admin-panel/internal-scans/overview", {
        credentials: "include",
      }).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const stats = data?.stats;

  const filtered = (data?.customers ?? [])
    .filter((c) => {
      if (filter === "scanned") return c.scan_id != null;
      if (filter === "not_scanned") return c.scan_id == null;
      return true;
    })
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.email?.toLowerCase().includes(q) ||
        (c.company_name ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = a.internal_score ?? -1;
      const bv = b.internal_score ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });

  const kpis = [
    { label: "Toplam Müşteri", value: stats?.total_customers ?? 0, color: "text-cyan-400" },
    { label: "Tarama Yapıldı", value: stats?.scanned ?? 0, color: "text-emerald-400" },
    { label: "Tarama Yok", value: stats?.not_scanned ?? 0, color: "text-red-400" },
    { label: "Ort. İç Skor", value: stats?.avg_internal_score ?? 0, color: "text-amber-400" },
    { label: "AI Rapor Üretildi", value: stats?.ai_report_generated ?? 0, color: "text-violet-400" },
  ];

  return (
    <AdminLayout title="İç Tarama Yönetimi" description="Tüm müşterilerin iç tarama durumu ve AI rapor özeti">
      <div className="space-y-6">

        {/* KPI Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtre + Arama */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <Input
              className="pl-8 w-56 bg-slate-900 border-slate-700 text-white text-sm"
              placeholder="Müşteri ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(["all", "scanned", "not_scanned"] as FilterType[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className={
                filter === f
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white border-0"
                  : "border-slate-700 text-slate-400 hover:text-white"
              }
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Tümü" : f === "scanned" ? "Tarandı" : "Taranmadı"}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-400 hover:text-white ml-auto"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            Skor{" "}
            {sortDir === "desc" ? (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            )}
          </Button>
        </div>

        {/* İki sütun: liste + detay */}
        <div className={`grid gap-5 ${selectedId ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>

          {/* Müşteri Listesi */}
          <Card className="bg-slate-900 border-slate-700 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-950 border-b border-slate-700">
              <div className="grid grid-cols-[1fr_70px_70px_50px_50px_60px] text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                <span>Müşteri</span>
                <span className="text-center">Dış</span>
                <span className="text-center">İç</span>
                <span className="text-center">AI</span>
                <span className="text-center">Anket</span>
                <span className="text-center">Detay</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <div className="text-slate-400 text-sm py-8 text-center">
                  Yükleniyor...
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="text-slate-500 text-sm py-8 text-center">
                  Kayıt bulunamadı
                </div>
              )}
              {filtered.map((c) => (
                <div
                  key={c.customer_id}
                  className={`grid grid-cols-[1fr_70px_70px_50px_50px_60px] items-center px-4 py-3 border-b border-slate-800 text-sm transition-colors
                    ${selectedId === c.customer_id ? "bg-cyan-950/30" : "hover:bg-slate-800/40"}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">
                      {c.company_name ?? c.email}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {c.hostname ?? "—"} · {c.sector ?? "—"}
                    </div>
                  </div>
                  {/* Dış skor */}
                  <div className={`text-center font-bold text-sm ${scoreColor(c.external_score)}`}>
                    {c.external_score ?? "—"}
                  </div>
                  {/* İç skor */}
                  <div className={`text-center font-bold text-sm ${scoreColor(c.internal_score)}`}>
                    {c.internal_score ?? "—"}
                  </div>
                  {/* AI rapor */}
                  <div className="text-center">
                    {c.ai_report_id ? (
                      <Brain className="w-4 h-4 text-violet-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </div>
                  {/* Anket */}
                  <div className="text-center">
                    {c.survey_id ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </div>
                  {/* Detay */}
                  <div className="text-center">
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-[11px] bg-cyan-700 hover:bg-cyan-600 text-white"
                      onClick={() =>
                        setSelectedId(
                          selectedId === c.customer_id ? null : c.customer_id,
                        )
                      }
                    >
                      {selectedId === c.customer_id ? "Kapat" : "Gör"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sağ: Detay Paneli */}
          {selectedId != null && (
            <CustomerDetail
              customerId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>

        {/* Açıklama */}
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3 text-sm text-slate-400">
              <Shield className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-white font-medium">İç Tarama Scripti: </span>
                Müşteriler <code className="text-cyan-400">/hesabim/ic-tarama</code> sayfasından Windows (.ps1) veya Linux (.sh) script'i indirip çalıştırır. Sonuçlar otomatik platforma gönderilir ve bu ekranda görünür.
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
