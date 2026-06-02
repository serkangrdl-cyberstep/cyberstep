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
import { Clock, Play, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface CronState {
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "running" | "never";
  lastRunDurationMs: number | null;
  lastError: string | null;
  isRunning: boolean;
}

interface CronJob {
  name: string;
  label: string;
  description: string;
  scheduleLabel: string;
  requiresApiKey: string | null;
  apiKeyPresent: boolean | null;
  enabled: boolean;
  limit: number;
  state: CronState;
}

interface CronStatusResponse {
  jobs: CronJob[];
}

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
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Hatalı</Badge>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}dk`;
}

export default function CronAyarlariPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localLimits, setLocalLimits] = useState<Record<string, number>>({});
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery<CronStatusResponse>({
    queryKey: ["cron-status"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/status"),
    refetchInterval: 5000,
  });

  const settingsMut = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      adminFetchJson("/api/admin-panel/cron/settings", { method: "PUT", body: JSON.stringify(updates), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cron-status"] }); },
  });

  const handleToggle = (job: CronJob, val: boolean) => {
    settingsMut.mutate({ [`cron.${job.name}.enabled`]: val ? "true" : "false" });
  };

  const handleLimitSave = (job: CronJob) => {
    const val = localLimits[job.name];
    if (!val || val < 1) return;
    settingsMut.mutate({ [`cron.${job.name}.limit`]: String(val) });
    toast({ title: "Kayıt limitı güncellendi" });
  };

  const handleTrigger = async (job: CronJob) => {
    setTriggering((prev) => ({ ...prev, [job.name]: true }));
    try {
      await adminFetchJson(`/api/admin-panel/cron/trigger/${job.name}`, { method: "POST" });
      toast({ title: `${job.label} başlatıldı`, description: "Arka planda çalışıyor." });
      setTimeout(() => refetch(), 1000);
    } catch {
      toast({ title: "Başlatılamadı", variant: "destructive" });
    } finally {
      setTriggering((prev) => ({ ...prev, [job.name]: false }));
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Cron Ayarları" description="Pasif tarama ve lead generation zamanlaması">
        <div className="flex items-center justify-center h-40 text-slate-500">Yükleniyor...</div>
      </AdminLayout>
    );
  }

  const jobs = data?.jobs ?? [];

  return (
    <AdminLayout title="Cron Ayarları" description="Pasif tarama ve lead generation zamanlaması">
      <div className="space-y-4">

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Ayarlar anında kaydedilir. Aktif/pasif değişikliği bir sonraki çalışmada geçerli olur.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-700 text-slate-400 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" />Yenile
          </Button>
        </div>

        {jobs.map((job) => {
          const limitVal = localLimits[job.name] ?? job.limit;
          const isTrigDisabled = job.state.isRunning || triggering[job.name] || false;
          return (
            <Card key={job.name} className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-white text-base">{job.label}</CardTitle>
                      <StatusBadge state={job.state} />
                      {job.requiresApiKey && !job.apiKeyPresent && (
                        <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                          <AlertCircle className="h-3 w-3 mr-1" />{job.requiresApiKey} eksik
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{job.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor={`toggle-${job.name}`} className="text-slate-400 text-sm cursor-pointer">
                      {job.enabled ? "Aktif" : "Pasif"}
                    </Label>
                    <Switch
                      id={`toggle-${job.name}`}
                      checked={job.enabled}
                      onCheckedChange={(val) => handleToggle(job, val)}
                      disabled={settingsMut.isPending}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>Zamanlama: <span className="text-slate-300">{job.scheduleLabel}</span></span>
                    </div>
                    {job.state.lastRunAt && (
                      <div className="text-xs text-slate-500">
                        Son çalışma: <span className="text-slate-300">{formatDate(job.state.lastRunAt)}</span>
                        {job.state.lastRunDurationMs !== null && (
                          <span className="text-slate-600 ml-1">({formatDuration(job.state.lastRunDurationMs)})</span>
                        )}
                      </div>
                    )}
                    {job.state.lastError && (
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
                        onChange={(e) => setLocalLimits((prev) => ({ ...prev, [job.name]: parseInt(e.target.value) || job.limit }))}
                        className="bg-slate-800 border-slate-700 text-white h-8 w-24 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-700 text-slate-300 hover:text-white h-8"
                        onClick={() => handleLimitSave(job)}
                        disabled={limitVal === job.limit || settingsMut.isPending}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                      onClick={() => handleTrigger(job)}
                      disabled={isTrigDisabled}
                    >
                      {isTrigDisabled ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Çalışıyor</>
                      ) : (
                        <><Play className="h-4 w-4 mr-1" />Manuel Tetikle</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

      </div>
    </AdminLayout>
  );
}
