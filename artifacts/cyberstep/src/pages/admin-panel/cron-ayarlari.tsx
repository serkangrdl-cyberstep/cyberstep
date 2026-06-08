import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Play, CheckCircle, XCircle, AlertCircle, Loader2,
  RefreshCw, ChevronDown, ChevronUp, History, BarChart2, ShieldCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CronState {
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "running" | "never";
  lastRunDurationMs: number | null;
  lastError: string | null;
  lastProcessedCount: number | null;
  isRunning: boolean;
}

interface DbStats {
  totalRuns: number;
  okRuns: number;
  errorRuns: number;
  avgDurationMs: number | null;
  lastRunAt?: string | null;
  lastStatus?: string | null;
}

interface CronJob {
  name: string;
  label: string;
  description?: string;
  scheduleLabel: string;
  scheduleExpr: string;
  category: string;
  requiresApiKey?: string | null;
  apiKeyPresent?: boolean | null;
  enabled?: boolean;
  limit?: number;
  state: CronState;
  dbStats: DbStats | null;
  nextRunAt: string | null;
  triggerable: boolean;
}

interface CronRun {
  id: number;
  job_name: string;
  schedule_expr: string | null;
  started_at: string;
  ended_at: string | null;
  status: "running" | "ok" | "error" | "skipped";
  processed_count: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

interface CronStatusResponse {
  jobs: CronJob[];
}

interface AllJobsResponse {
  jobs: CronJob[];
}

interface HistoryResponse {
  runs: CronRun[];
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}dk`;
}

function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Az önce";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `${m} dakika sonra`;
  if (h < 24) return `${h}s ${m}dk sonra`;
  return `${Math.floor(h / 24)}g sonra · ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: CronState }) {
  if (state.isRunning || state.lastRunStatus === "running") {
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Çalışıyor</Badge>;
  }
  if (state.lastRunStatus === "never") {
    return <Badge variant="outline" className="border-slate-700 text-slate-500">Hiç çalışmadı</Badge>;
  }
  if (state.lastRunStatus === "ok") {
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Başarılı</Badge>;
  }
  if (state.lastRunStatus === "error") {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Hatalı</Badge>;
  }
  return <Badge variant="outline" className="border-slate-700 text-slate-400">Bilinmiyor</Badge>;
}

function RunStatusDot({ status }: { status: string }) {
  if (status === "ok") return <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1" />;
  if (status === "error") return <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1" />;
  if (status === "running") return <span className="inline-block h-2 w-2 rounded-full bg-blue-400 mr-1 animate-pulse" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-slate-600 mr-1" />;
}

function CategoryBadge({ cat }: { cat: string }) {
  const MAP: Record<string, string> = {
    "lead-gen": "bg-purple-500/15 text-purple-400 border-purple-500/20",
    "security": "bg-red-500/15 text-red-400 border-red-500/20",
    "integrations": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    "billing": "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    "assessment": "bg-green-500/15 text-green-400 border-green-500/20",
    "other": "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };
  const cls = MAP[cat] ?? MAP["other"];
  return <Badge variant="outline" className={`${cls} text-xs`}>{cat}</Badge>;
}

// ─── History row for a single job ─────────────────────────────────────────────

function JobHistoryPanel({ jobName }: { jobName: string }) {
  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["cron-history", jobName],
    queryFn: () => adminFetchJson(`/api/admin-panel/cron/history?job=${encodeURIComponent(jobName)}&limit=10`),
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="text-xs text-slate-500 py-2">Yükleniyor...</div>;
  if (!data?.runs?.length) return <div className="text-xs text-slate-600 py-2">Henüz çalışma kaydı yok.</div>;

  return (
    <div className="mt-3 border border-slate-800 rounded-md overflow-hidden">
      <div className="text-xs font-medium text-slate-500 px-3 py-2 bg-slate-800/60 flex items-center gap-1">
        <History className="h-3 w-3" /> Son Çalışmalar
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-600 border-b border-slate-800">
            <th className="text-left px-3 py-1.5">Zaman</th>
            <th className="text-left px-3 py-1.5">Durum</th>
            <th className="text-right px-3 py-1.5">Kayıt</th>
            <th className="text-right px-3 py-1.5">Süre</th>
            <th className="text-left px-3 py-1.5">Hata</th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((run) => (
            <tr key={run.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-1.5 text-slate-400">{formatDate(run.started_at)}</td>
              <td className="px-3 py-1.5">
                <span className="flex items-center">
                  <RunStatusDot status={run.status} />
                  <span className={
                    run.status === "ok" ? "text-green-400" :
                    run.status === "error" ? "text-red-400" :
                    run.status === "skipped" ? "text-slate-500" :
                    "text-blue-400"
                  }>{run.status}</span>
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-slate-300">
                {run.processed_count != null ? run.processed_count : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-slate-500">
                {formatDuration(run.duration_ms)}
              </td>
              <td className="px-3 py-1.5 text-red-400 max-w-[200px] truncate" title={run.error_message ?? ""}>
                {run.error_message ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Configurable job card (CRON_DEFS — with enable/limit/trigger) ─────────────

function ConfigurableJobCard({
  job,
  localLimits,
  setLocalLimits,
  triggering,
  onToggle,
  onLimitSave,
  onTrigger,
  settingsPending,
}: {
  job: CronJob;
  localLimits: Record<string, number>;
  setLocalLimits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggering: Record<string, boolean>;
  onToggle: (job: CronJob, val: boolean) => void;
  onLimitSave: (job: CronJob) => void;
  onTrigger: (job: CronJob) => void;
  settingsPending: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const limitVal = localLimits[job.name] ?? (job.limit ?? 100);
  const isTrigDisabled = job.state.isRunning || triggering[job.name] || false;
  const stats = job.dbStats;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-white text-base">{job.label}</CardTitle>
              <StatusBadge state={job.state} />
              <CategoryBadge cat={job.category} />
              {job.requiresApiKey && !job.apiKeyPresent && (
                <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  <AlertCircle className="h-3 w-3 mr-1" />{job.requiresApiKey} eksik
                </Badge>
              )}
            </div>
            {job.description && <p className="text-slate-400 text-sm mt-1">{job.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor={`toggle-${job.name}`} className="text-slate-400 text-sm cursor-pointer">
              {job.enabled ? "Aktif" : "Pasif"}
            </Label>
            <Switch
              id={`toggle-${job.name}`}
              checked={job.enabled ?? true}
              onCheckedChange={(val) => onToggle(job, val)}
              disabled={settingsPending}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Clock className="h-3 w-3" />
              <span>Zamanlama: <span className="text-slate-300">{job.scheduleLabel}</span></span>
            </div>
            {job.nextRunAt && (
              <div className="text-xs text-slate-500">
                Sonraki: <span className="text-cyan-400">{formatNextRun(job.nextRunAt)}</span>
              </div>
            )}
            {job.state.lastRunAt && (
              <div className="text-xs text-slate-500">
                Son çalışma: <span className="text-slate-300">{formatDate(job.state.lastRunAt)}</span>
                {job.state.lastRunDurationMs != null && (
                  <span className="text-slate-600 ml-1">({formatDuration(job.state.lastRunDurationMs)})</span>
                )}
                {job.state.lastProcessedCount != null && (
                  <span className="text-emerald-500 ml-1">· {job.state.lastProcessedCount} kayıt</span>
                )}
              </div>
            )}
            {job.state.lastRunStatus === "error" && job.state.lastError && (
              <div className="text-xs text-red-400 truncate" title={job.state.lastError}>
                Hata: {job.state.lastError}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Kayıt limiti (tek çalışmada)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={1000}
                value={limitVal}
                onChange={(e) => setLocalLimits((prev) => ({ ...prev, [job.name]: parseInt(e.target.value) || (job.limit ?? 100) }))}
                className="bg-slate-800 border-slate-700 text-white h-8 w-24 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:text-white h-8"
                onClick={() => onLimitSave(job)}
                disabled={limitVal === (job.limit ?? 100) || settingsPending}
              >
                Kaydet
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-400 h-8"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="h-4 w-4 mr-1" />
              {showHistory ? "Gizle" : "Geçmiş"}
              {showHistory ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white h-8"
              onClick={() => onTrigger(job)}
              disabled={isTrigDisabled}
            >
              {isTrigDisabled ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Çalışıyor</>
              ) : (
                <><Play className="h-4 w-4 mr-1" />Tetikle</>
              )}
            </Button>
          </div>
        </div>

        {stats && (
          <div className="flex gap-4 text-xs border-t border-slate-800 pt-2">
            <span className="text-slate-500">Toplam: <span className="text-slate-300">{stats.totalRuns}</span></span>
            <span className="text-slate-500">Başarılı: <span className="text-green-400">{stats.okRuns}</span></span>
            <span className="text-slate-500">Hatalı: <span className={stats.errorRuns > 0 ? "text-red-400" : "text-slate-300"}>{stats.errorRuns}</span></span>
            {stats.avgDurationMs != null && (
              <span className="text-slate-500">Ort. süre: <span className="text-slate-300">{formatDuration(stats.avgDurationMs)}</span></span>
            )}
          </div>
        )}

        {showHistory && <JobHistoryPanel jobName={job.name} />}
      </CardContent>
    </Card>
  );
}

// ─── Read-only night job card (ALL_NIGHT_JOBS) ────────────────────────────────

function NightJobCard({ job, triggering, onTrigger }: {
  job: CronJob;
  triggering: Record<string, boolean>;
  onTrigger: (job: CronJob) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const stats = job.dbStats;

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${
      job.state.lastRunStatus === "error"
        ? "border-red-800/60 bg-red-950/20"
        : job.state.lastRunStatus === "ok"
        ? "border-green-800/40 bg-slate-900"
        : "border-slate-800 bg-slate-900"
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white">{job.label}</span>
          <StatusBadge state={job.state} />
          <CategoryBadge cat={job.category} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.triggerable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-slate-400 hover:text-white"
              onClick={() => onTrigger(job)}
              disabled={job.state.isRunning || triggering[job.name]}
            >
              {triggering[job.name] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-slate-500 hover:text-white"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><Clock className="h-3 w-3 inline mr-1" />{job.scheduleLabel}</span>
        {job.nextRunAt && (
          <span>Sonraki: <span className="text-cyan-400">{formatNextRun(job.nextRunAt)}</span></span>
        )}
        {job.state.lastRunAt && (
          <span>Son: <span className="text-slate-300">{formatDate(job.state.lastRunAt)}</span>
            {job.state.lastRunDurationMs != null && <span className="text-slate-600"> ({formatDuration(job.state.lastRunDurationMs)})</span>}
          </span>
        )}
        {job.state.lastProcessedCount != null && (
          <span>Kayıt: <span className="text-emerald-400">{job.state.lastProcessedCount}</span></span>
        )}
      </div>

      {job.state.lastError && (
        <div className="text-xs text-red-400 truncate" title={job.state.lastError}>
          Hata: {job.state.lastError}
        </div>
      )}

      {stats && (
        <div className="flex gap-3 text-xs text-slate-600 border-t border-slate-800 pt-2">
          <span>Toplam: <span className="text-slate-400">{stats.totalRuns}</span></span>
          <span>Başarılı: <span className="text-green-500">{stats.okRuns}</span></span>
          {stats.errorRuns > 0 && <span>Hatalı: <span className="text-red-400">{stats.errorRuns}</span></span>}
        </div>
      )}

      {showHistory && <JobHistoryPanel jobName={job.name} />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "configured" | "all-jobs" | "history" | "health";

export default function CronAyarlariPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localLimits, setLocalLimits] = useState<Record<string, number>>({});
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("configured");

  const { data, isLoading, refetch } = useQuery<CronStatusResponse>({
    queryKey: ["cron-status"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/status"),
    refetchInterval: 5000,
  });

  const { data: allJobsData } = useQuery<AllJobsResponse>({
    queryKey: ["cron-all-jobs"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/all-jobs"),
    refetchInterval: 10000,
    enabled: tab === "all-jobs",
  });

  const { data: historyData } = useQuery<HistoryResponse>({
    queryKey: ["cron-history-all"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/history?limit=50"),
    refetchInterval: 15000,
    enabled: tab === "history",
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<{
    healthy: boolean;
    checked_at: string;
    summary: { total_jobs: number; successful: number; failed: number; missing: number; slow: number };
    alerts: Array<{ job_name: string; label: string; issue: "not_run" | "failed" | "slow"; last_run: string | null; details: string }>;
    job_details: Array<{ name: string; label: string; last_run: string | null; last_status: string | null; last_error: string | null; avg_duration_ms: number | null; total_runs: number; ok_runs: number; error_runs: number }>;
  }>({
    queryKey: ["cron-health"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/health"),
    refetchInterval: 60000,
    enabled: tab === "health",
  });

  const settingsMut = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      adminFetchJson("/api/admin-panel/cron/settings", {
        method: "PUT",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cron-status"] }); },
  });

  const handleToggle = (job: CronJob, val: boolean) => {
    settingsMut.mutate({ [`cron.${job.name}.enabled`]: val ? "true" : "false" });
  };

  const handleLimitSave = (job: CronJob) => {
    const val = localLimits[job.name];
    if (!val || val < 1) return;
    settingsMut.mutate({ [`cron.${job.name}.limit`]: String(val) });
    toast({ title: "Kayıt limiti güncellendi" });
  };

  const handleTrigger = async (job: CronJob) => {
    setTriggering((prev) => ({ ...prev, [job.name]: true }));
    try {
      await adminFetchJson(`/api/admin-panel/cron/trigger/${job.name}`, { method: "POST" });
      toast({ title: `${job.label} başlatıldı`, description: "Arka planda çalışıyor." });
      setTimeout(() => { refetch(); queryClient.invalidateQueries({ queryKey: ["cron-all-jobs"] }); }, 1500);
    } catch {
      toast({ title: "Başlatılamadı", variant: "destructive" });
    } finally {
      setTriggering((prev) => ({ ...prev, [job.name]: false }));
    }
  };

  const jobs = data?.jobs ?? [];
  const allJobs = allJobsData?.jobs ?? [];
  const historyRuns = historyData?.runs ?? [];

  // Health summary counts
  const errorJobs = allJobs.filter((j) => j.state.lastRunStatus === "error");
  const neverJobs = allJobs.filter((j) => j.state.lastRunStatus === "never");

  const TAB_CLASSES = "px-4 py-2 text-sm rounded-md font-medium transition-colors";
  const ACTIVE = "bg-slate-700 text-white";
  const INACTIVE = "text-slate-400 hover:text-white";

  return (
    <AdminLayout
      title="Cron Sağlık Paneli"
      description="Gece job'larının çalışma durumu, geçmiş ve hata takibi"
    >
      <div className="space-y-5">

        {/* Status Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500">Toplam Job</div>
            <div className="text-2xl font-bold text-white mt-1">{allJobs.length || "—"}</div>
          </div>
          <div className={`rounded-lg p-3 border ${errorJobs.length > 0 ? "bg-red-950/30 border-red-800/50" : "bg-slate-900 border-slate-800"}`}>
            <div className="text-xs text-slate-500">Son Çalışma Hatalı</div>
            <div className={`text-2xl font-bold mt-1 ${errorJobs.length > 0 ? "text-red-400" : "text-green-400"}`}>{allJobs.length ? errorJobs.length : "—"}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500">Hiç Çalışmamış</div>
            <div className={`text-2xl font-bold mt-1 ${neverJobs.length > 0 ? "text-yellow-400" : "text-slate-300"}`}>{allJobs.length ? neverJobs.length : "—"}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500">Şu An Çalışan</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {allJobs.filter((j) => j.state.isRunning).length || "0"}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-slate-800/60 p-1 rounded-lg">
            <button className={`${TAB_CLASSES} ${tab === "configured" ? ACTIVE : INACTIVE}`} onClick={() => setTab("configured")}>
              Yapılandırılmış ({jobs.length})
            </button>
            <button className={`${TAB_CLASSES} ${tab === "all-jobs" ? ACTIVE : INACTIVE}`} onClick={() => setTab("all-jobs")}>
              <BarChart2 className="h-3.5 w-3.5 inline mr-1" />
              Tüm Job'lar
            </button>
            <button className={`${TAB_CLASSES} ${tab === "history" ? ACTIVE : INACTIVE}`} onClick={() => setTab("history")}>
              <History className="h-3.5 w-3.5 inline mr-1" />
              Geçmiş
            </button>
            <button className={`${TAB_CLASSES} ${tab === "health" ? ACTIVE : INACTIVE} relative`} onClick={() => setTab("health")}>
              <ShieldCheck className="h-3.5 w-3.5 inline mr-1" />
              Sağlık
              {healthData && !healthData.healthy && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["cron-all-jobs"] });
            if (tab === "health") refetchHealth();
          }} className="border-slate-700 text-slate-400 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" />Yenile
          </Button>
        </div>

        {/* Tab: Configured (with enable/limit/trigger) */}
        {tab === "configured" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Ayarlar anında kaydedilir. Aktif/pasif değişikliği bir sonraki çalışmada geçerli olur.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-500">Yükleniyor...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center text-slate-500 py-12">Job bulunamadı.</div>
            ) : (
              jobs.map((job) => (
                <ConfigurableJobCard
                  key={job.name}
                  job={job}
                  localLimits={localLimits}
                  setLocalLimits={setLocalLimits}
                  triggering={triggering}
                  onToggle={handleToggle}
                  onLimitSave={handleLimitSave}
                  onTrigger={handleTrigger}
                  settingsPending={settingsMut.isPending}
                />
              ))
            )}
          </div>
        )}

        {/* Tab: All Jobs (read-only health board) */}
        {tab === "all-jobs" && (
          <div className="space-y-3">
            {errorJobs.length > 0 && (
              <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 text-sm text-red-300">
                <XCircle className="h-4 w-4 shrink-0" />
                {errorJobs.length} job son çalışmasında hata aldı: {errorJobs.map((j) => j.label).join(", ")}
              </div>
            )}
            {allJobs.length === 0 ? (
              <div className="text-center text-slate-500 py-12">Henüz çalışma verisi yok. Job'lar ilk kez çalıştıktan sonra burada görünür.</div>
            ) : (
              <div className="grid gap-3">
                {allJobs.map((job) => (
                  <NightJobCard
                    key={job.name}
                    job={job}
                    triggering={triggering}
                    onTrigger={handleTrigger}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Full history log */}
        {tab === "history" && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-400 flex items-center gap-2">
              <History className="h-3 w-3" /> Son 50 çalışma kaydı
            </div>
            {historyRuns.length === 0 ? (
              <div className="text-center text-slate-500 py-10 text-sm">Henüz kayıt yok.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-800">
                    <th className="text-left px-4 py-2">Job</th>
                    <th className="text-left px-4 py-2">Zaman</th>
                    <th className="text-left px-4 py-2">Durum</th>
                    <th className="text-right px-4 py-2">Kayıt</th>
                    <th className="text-right px-4 py-2">Süre</th>
                    <th className="text-left px-4 py-2">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRuns.map((run) => (
                    <tr key={run.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                      <td className="px-4 py-2 font-mono text-slate-300">{run.job_name}</td>
                      <td className="px-4 py-2 text-slate-400">{formatDate(run.started_at)}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center">
                          <RunStatusDot status={run.status} />
                          <span className={
                            run.status === "ok" ? "text-green-400" :
                            run.status === "error" ? "text-red-400" :
                            run.status === "skipped" ? "text-slate-500" :
                            "text-blue-400"
                          }>{run.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">{run.processed_count ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{formatDuration(run.duration_ms)}</td>
                      <td className="px-4 py-2 text-red-400 max-w-[200px] truncate" title={run.error_message ?? ""}>{run.error_message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Cron Sağlık Monitörü */}
        {tab === "health" && (
          <div className="space-y-4">
            {healthLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mr-2" />Sağlık durumu kontrol ediliyor...</div>
            ) : !healthData ? (
              <div className="text-center text-slate-500 py-12">Veri alınamadı.</div>
            ) : (
              <>
                {/* Genel durum */}
                <div className={`flex items-center gap-3 rounded-lg border px-5 py-4 ${healthData.healthy ? "border-green-700/40 bg-green-950/20" : "border-red-700/40 bg-red-950/20"}`}>
                  {healthData.healthy
                    ? <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                    : <XCircle className="h-6 w-6 text-red-400 shrink-0" />}
                  <div>
                    <div className={`font-semibold text-base ${healthData.healthy ? "text-green-300" : "text-red-300"}`}>
                      {healthData.healthy ? "Tüm job'lar normal çalışıyor" : `${healthData.alerts.length} job sorunlu`}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Kontrol: {formatDate(healthData.checked_at)} · 60 saniyede otomatik yenilenir
                    </div>
                  </div>
                  <div className="ml-auto flex gap-5 text-sm text-right">
                    <div><div className="text-slate-500 text-xs">Toplam</div><div className="font-bold text-white">{healthData.summary.total_jobs}</div></div>
                    <div><div className="text-slate-500 text-xs">Basarili</div><div className="font-bold text-green-400">{healthData.summary.successful}</div></div>
                    <div><div className="text-slate-500 text-xs">Hatali</div><div className={`font-bold ${healthData.summary.failed > 0 ? "text-red-400" : "text-slate-400"}`}>{healthData.summary.failed}</div></div>
                    <div><div className="text-slate-500 text-xs">Eksik</div><div className={`font-bold ${healthData.summary.missing > 0 ? "text-yellow-400" : "text-slate-400"}`}>{healthData.summary.missing}</div></div>
                    {healthData.summary.slow > 0 && (
                      <div><div className="text-slate-500 text-xs">Yavas</div><div className="font-bold text-orange-400">{healthData.summary.slow}</div></div>
                    )}
                  </div>
                </div>

                {/* Alert'ler */}
                {healthData.alerts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uyarilar</div>
                    {healthData.alerts.map((alert) => (
                      <div key={alert.job_name} className={`rounded-lg border px-4 py-3 text-sm ${
                        alert.issue === "failed" ? "border-red-800/50 bg-red-950/20" :
                        alert.issue === "not_run" ? "border-yellow-800/40 bg-yellow-950/10" :
                        "border-orange-800/40 bg-orange-950/10"
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {alert.issue === "failed" && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                          {alert.issue === "not_run" && <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />}
                          {alert.issue === "slow" && <Clock className="h-4 w-4 text-orange-400 shrink-0" />}
                          <span className="font-medium text-white">{alert.label}</span>
                          <span className="text-slate-500 font-mono text-xs">({alert.job_name})</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            alert.issue === "failed" ? "bg-red-900/50 text-red-300" :
                            alert.issue === "not_run" ? "bg-yellow-900/50 text-yellow-300" :
                            "bg-orange-900/50 text-orange-300"
                          }`}>
                            {alert.issue === "failed" ? "HATA" : alert.issue === "not_run" ? "EKSIK" : "YAVAS"}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-400 text-xs">{alert.details}</div>
                        {alert.last_run && (
                          <div className="mt-0.5 text-slate-600 text-xs">Son: {formatDate(alert.last_run)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tüm job detayları */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tüm Beklenen Job'lar</div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-600 border-b border-slate-800 bg-slate-800/40">
                          <th className="text-left px-4 py-2">Job</th>
                          <th className="text-left px-4 py-2">Son Çalışma</th>
                          <th className="text-left px-4 py-2">Durum</th>
                          <th className="text-right px-4 py-2">Ort. Süre</th>
                          <th className="text-right px-4 py-2">Toplam</th>
                          <th className="text-right px-4 py-2">Hatalı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthData.job_details.map((j) => (
                          <tr key={j.name} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                            <td className="px-4 py-2">
                              <div className="text-slate-300">{j.label}</div>
                              <div className="font-mono text-slate-600">{j.name}</div>
                            </td>
                            <td className="px-4 py-2 text-slate-400">{j.last_run ? formatDate(j.last_run) : <span className="text-yellow-600">Hiç çalışmadı</span>}</td>
                            <td className="px-4 py-2">
                              {!j.last_status ? (
                                <span className="text-slate-600">—</span>
                              ) : j.last_status === "ok" ? (
                                <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-3 w-3" />ok</span>
                              ) : j.last_status === "error" ? (
                                <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3 w-3" />hata</span>
                              ) : (
                                <span className="text-slate-500">{j.last_status}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">{j.avg_duration_ms != null ? formatDuration(j.avg_duration_ms) : "—"}</td>
                            <td className="px-4 py-2 text-right text-slate-400">{j.total_runs}</td>
                            <td className="px-4 py-2 text-right">{j.error_runs > 0 ? <span className="text-red-400">{j.error_runs}</span> : <span className="text-slate-600">0</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
