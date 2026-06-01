import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, FileText, Loader2, ScrollText, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/admin-layout";

interface Summary {
  active: number;
  expiringIn24h: number;
  overdue: number;
  closedLast30d: number;
}

interface Notification {
  id: number;
  customerId: number;
  customerEmail: string | null;
  companyName: string | null;
  caseNumber: string;
  caseTitle: string;
  severity: string;
  requiresNotification: boolean;
  severityCategory: string | null;
  urgency: string | null;
  aiReasoning: string | null;
  status: string;
  btkReferenceNo: string | null;
  deadline72h: string;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Taslak",          cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  sent:     { label: "Gönderildi",      cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  tracking: { label: "Takip Ediliyor",  cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  closed:   { label: "Kapatıldı",       cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const SEV_LABELS: Record<string, string> = {
  critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük",
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

function Countdown({ deadline }: { deadline: string }) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return <span className="text-red-400 font-bold">Süre Doldu</span>;
  const h = Math.floor(ms / (3600 * 1000));
  const m = Math.floor((ms % (3600 * 1000)) / 60000);
  const cls = h < 24 ? "text-red-400 font-bold" : h < 48 ? "text-yellow-400 font-bold" : "text-emerald-400";
  return <span className={cls}>{h}s {m}d kaldı</span>;
}

export default function AdminKvkk() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: summary, isLoading: sLoading } = useQuery<Summary>({
    queryKey: ["admin-kvkk-summary"],
    queryFn: () => fetch("/api/admin-panel/kvkk/summary", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: notifData, isLoading: nLoading } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["admin-kvkk-notifications", statusFilter],
    queryFn: () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return fetch(`/api/admin-panel/kvkk/notifications${qs}`, { credentials: "include" }).then(r => r.json());
    },
    refetchInterval: 60000,
  });

  const notifications = notifData?.notifications ?? [];

  return (
    <AdminLayout title="KVKK Bildirimler" description="KVKK 12. Madde & BTK otomatik bildirim takibi">
      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400 text-xs">Aktif Bildirim</span>
            </div>
            <p className="text-2xl font-bold text-white">{sLoading ? "—" : summary?.active ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-slate-400 text-xs">24s İçinde Doluyor</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{sLoading ? "—" : summary?.expiringIn24h ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-slate-400 text-xs">Süresi Dolmuş</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{sLoading ? "—" : summary?.overdue ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-400 text-xs">Son 30 Gün Kapatılan</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{sLoading ? "—" : summary?.closedLast30d ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tüm Aktifler</SelectItem>
            <SelectItem value="draft">Taslak</SelectItem>
            <SelectItem value="sent">Gönderildi</SelectItem>
            <SelectItem value="tracking">Takip</SelectItem>
            <SelectItem value="closed">Kapatıldı</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-slate-500 text-sm">{notifications.length} kayıt</span>
      </div>

      {/* Bildirim listesi */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">KVKK Bildirim Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {nLoading ? (
            <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Bu kriterde bildirim bulunamadı.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const isExpanded = expandedId === n.id;
                const isExpiring = new Date(n.deadline72h).getTime() - Date.now() < 24 * 3600 * 1000;
                const isOverdue = new Date(n.deadline72h).getTime() < Date.now();
                return (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                      isOverdue && n.status === "draft"
                        ? "border-red-500/40 bg-red-500/5"
                        : isExpiring
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-slate-700 bg-slate-800/50"
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : n.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium text-sm">{n.caseNumber}</span>
                          <Badge className={`text-xs ${STATUS_LABELS[n.status]?.cls ?? ""}`}>
                            {STATUS_LABELS[n.status]?.label ?? n.status}
                          </Badge>
                          <Badge className="text-xs bg-slate-700/50 text-slate-300 border-slate-600">
                            {SEV_LABELS[n.severity] ?? n.severity}
                          </Badge>
                          {n.btkReferenceNo && (
                            <span className="text-xs text-emerald-400">BTK: {n.btkReferenceNo}</span>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs mt-1 truncate">{n.caseTitle}</p>
                        <p className="text-slate-500 text-xs">{n.companyName ?? n.customerEmail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          <Countdown deadline={n.deadline72h} />
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">{fmtDate(n.deadline72h)}</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                        {n.aiReasoning && (
                          <div className="bg-slate-900/60 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">AI Gerekçesi</p>
                            <p className="text-slate-300 text-xs leading-relaxed">{n.aiReasoning}</p>
                          </div>
                        )}
                        <div className="flex gap-3 text-xs text-slate-500">
                          <span>Kategori: <span className="text-slate-300">{n.severityCategory ?? "-"}</span></span>
                          <span>Aciliyet: <span className="text-slate-300">{n.urgency ?? "-"}</span></span>
                          {n.sentAt && <span>Gönderim: <span className="text-slate-300">{fmtDate(n.sentAt)}</span></span>}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-300 text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/hesabim/soc`, "_blank");
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Müşteri SOC Paneli
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
