import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetchJson } from "@/lib/admin-fetch";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Mail, Clock, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceHealth {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  message?: string;
}

interface HealthResult {
  overall: "ok" | "degraded" | "down";
  services: ServiceHealth[];
  timestamp: string;
}

interface CronMetric {
  id: number;
  jobName: string;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: string;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}

interface EmailQueueStats {
  pending: number;
  sent24h: number;
  failed: number;
  recent: Array<{
    id: number;
    email: string;
    sequenceType: string;
    step: number;
    status: string;
    sendAt: string;
    sentAt: string | null;
  }>;
}

function statusBadge(s: string) {
  if (s === "ok" || s === "sent") return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">{s === "sent" ? "Gönderildi" : "Çalışıyor"}</Badge>;
  if (s === "degraded" || s === "failed") return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">{s === "failed" ? "Başarısız" : "Bozuk"}</Badge>;
  if (s === "down" || s === "error") return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">{s === "error" ? "Hata" : "Çöktü"}</Badge>;
  return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">{s}</Badge>;
}

function statusIcon(s: string) {
  if (s === "ok") return <CheckCircle className="h-5 w-5 text-emerald-400" />;
  if (s === "degraded") return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
  return <XCircle className="h-5 w-5 text-red-400" />;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.round(hrs / 24)} gün önce`;
}

function sequenceLabel(type: string): string {
  const map: Record<string, string> = {
    registration: "Kayıt",
    full_assessment_purchased: "Değerlendirme",
    soc_activated: "SOC Aktivasyon",
  };
  return map[type] ?? type;
}

export default function PlatformSaglik() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"health" | "crons" | "email">("health");

  const healthQ = useQuery<HealthResult>({
    queryKey: ["admin-platform-health"],
    queryFn: () => adminFetchJson("/api/admin/platform-health"),
    refetchInterval: 30_000,
  });

  const cronsQ = useQuery<CronMetric[]>({
    queryKey: ["admin-cron-metrics"],
    queryFn: () => adminFetchJson("/api/admin/platform-health/crons"),
    refetchInterval: 60_000,
  });

  const emailQ = useQuery<EmailQueueStats>({
    queryKey: ["admin-email-queue"],
    queryFn: () => adminFetchJson("/api/admin/platform-health/email-queue"),
    refetchInterval: 30_000,
  });

  const retryMut = useMutation({
    mutationFn: (id: number) => adminFetchJson(`/api/admin/platform-health/email-queue/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "E-posta kuyruğa alındı" });
      void qc.invalidateQueries({ queryKey: ["admin-email-queue"] });
    },
  });

  const health = healthQ.data;
  const crons = cronsQ.data ?? [];
  const emailStats = emailQ.data;

  const tabs = [
    { key: "health" as const, label: "Servis Sağlığı" },
    { key: "crons" as const, label: "Cron Joblar" },
    { key: "email" as const, label: "E-posta Kuyruğu" },
  ];

  return (
    <AdminLayout title="Platform Sağlığı" description="Servis durumu, cron iş metrikleri ve e-posta kuyruğu">
      <div className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-2 border-b border-slate-700 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Servis Sağlığı ── */}
        {activeTab === "health" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">
                  {health ? `Son kontrol: ${timeAgo(health.timestamp)}` : "Yükleniyor..."}
                </span>
                {health && (
                  <Badge className={
                    health.overall === "ok" ? "bg-emerald-600/20 text-emerald-400" :
                    health.overall === "degraded" ? "bg-yellow-600/20 text-yellow-400" :
                    "bg-red-600/20 text-red-400"
                  }>
                    {health.overall === "ok" ? "Tüm Sistemler Çalışıyor" :
                     health.overall === "degraded" ? "Kısmi Sorun" : "Ciddi Sorun"}
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["admin-platform-health"] })}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yenile
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(health?.services ?? []).map(svc => (
                <Card key={svc.name} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm text-slate-100">{svc.name}</div>
                        {svc.latencyMs !== undefined && (
                          <div className="text-xs text-slate-400 mt-0.5">{svc.latencyMs} ms</div>
                        )}
                        {svc.message && (
                          <div className="text-xs text-slate-400 mt-1">{svc.message}</div>
                        )}
                      </div>
                      {statusIcon(svc.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {healthQ.isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4 animate-pulse">
                    <div className="h-4 w-24 bg-slate-700 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Cron Joblar ── */}
        {activeTab === "crons" && (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cron Job Metrikleri</CardTitle>
                <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["admin-cron-metrics"] })}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yenile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">İş Adı</TableHead>
                    <TableHead className="text-slate-400">Son Çalışma</TableHead>
                    <TableHead className="text-slate-400">Süre</TableHead>
                    <TableHead className="text-slate-400">Durum</TableHead>
                    <TableHead className="text-slate-400 text-right">Toplam / Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        Henüz cron çalışmadı — heartbeat bağlantıları aktifleştirildikçe veriler görünecek
                      </TableCell>
                    </TableRow>
                  )}
                  {crons.map(c => (
                    <TableRow key={c.id} className="border-slate-700/50">
                      <TableCell className="text-sm font-mono text-slate-200">{c.jobName}</TableCell>
                      <TableCell className="text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {timeAgo(c.lastRunAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">
                        {c.lastDurationMs !== null ? `${c.lastDurationMs} ms` : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(c.lastStatus ?? "ok")}</TableCell>
                      <TableCell className="text-right text-sm text-slate-300">
                        {c.runCount} / <span className="text-red-400">{c.errorCount}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── E-posta Kuyruğu ── */}
        {activeTab === "email" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Bekleyen", value: emailStats?.pending ?? "—", color: "text-blue-400" },
                { label: "Son 24s Gönderilen", value: emailStats?.sent24h ?? "—", color: "text-emerald-400" },
                { label: "Başarısız", value: emailStats?.failed ?? "—", color: "text-red-400" },
              ].map(stat => (
                <Card key={stat.label} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4 text-center">
                    <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Son E-postalar
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["admin-email-queue"] })}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yenile
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">E-posta</TableHead>
                      <TableHead className="text-slate-400">Dizi</TableHead>
                      <TableHead className="text-slate-400">Adım</TableHead>
                      <TableHead className="text-slate-400">Gönderim</TableHead>
                      <TableHead className="text-slate-400">Durum</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(emailStats?.recent ?? []).map(row => (
                      <TableRow key={row.id} className="border-slate-700/50">
                        <TableCell className="text-sm text-slate-200">{row.email}</TableCell>
                        <TableCell className="text-sm text-slate-400">{sequenceLabel(row.sequenceType)}</TableCell>
                        <TableCell className="text-sm text-slate-400">{row.step}</TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {row.sentAt ? timeAgo(row.sentAt) : timeAgo(row.sendAt)}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell>
                          {row.status === "failed" && (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => retryMut.mutate(row.id)}
                              disabled={retryMut.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(emailStats?.recent ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                          Henüz e-posta gönderilmedi
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
