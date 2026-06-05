import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight,
  ArrowLeft, History, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { useToast } from "@/hooks/use-toast";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/40",
  high:     "bg-orange-500/15 text-orange-400 border-orange-500/40",
  medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  low:      "bg-blue-500/15 text-blue-400 border-blue-500/40",
};

const RISK_LABELS: Record<string, string> = {
  critical: "Kritik",
  high:     "Yuksek",
  medium:   "Orta",
  low:      "Dusuk",
};

const STATUS_LABELS: Record<string, string> = {
  pending:  "Bekliyor",
  approved: "Onaylandi",
  rejected: "Reddedildi",
  expired:  "Suresi Doldu",
};

const ON_EXPIRE_LABELS: Record<string, string> = {
  auto_approve: "Otomatik onaylanir",
  auto_reject:  "Otomatik reddedilir",
  escalate:     "Telegram ile bildir",
};

interface Approval {
  id: number;
  actionType: string;
  title: string;
  description: string;
  riskLevel: string;
  payload: Record<string, unknown>;
  customerId?: number;
  expiresAt: string;
  onExpire: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  executed?: boolean;
  createdAt: string;
}

interface AuditEntry {
  id: number;
  action: string;
  performedBy: string;
  notes?: string;
  createdAt: string;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Süresi doldu";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)} gün`;
  if (h > 0) return `${h}s ${m}d`;
  return `${m} dakika`;
}

function ApprovalDetail({
  approvalId,
  onBack,
}: {
  approvalId: number;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data, isLoading } = useQuery<{ approval: Approval; auditLog: AuditEntry[] }>({
    queryKey: ["/api/admin-panel/approvals", approvalId],
    queryFn: () => adminFetchJson(`/api/admin-panel/approvals/${approvalId}`),
  });

  const approveMut = useMutation({
    mutationFn: () =>
      adminFetchJson(`/api/admin-panel/approvals/${approvalId}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast({ description: "Onaylandı ve aksiyon çalıştırıldı." });
      qc.invalidateQueries({ queryKey: ["/api/admin-panel/approvals"] }).catch(() => void 0);
      onBack();
    },
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: () =>
      adminFetchJson(`/api/admin-panel/approvals/${approvalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      }),
    onSuccess: () => {
      toast({ description: "Reddedildi." });
      qc.invalidateQueries({ queryKey: ["/api/admin-panel/approvals"] }).catch(() => void 0);
      onBack();
    },
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <div className="text-slate-400 text-sm p-8">Yükleniyor...</div>;
  }

  const { approval, auditLog } = data;
  const isPending = approval.status === "pending";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-slate-200">
        <ArrowLeft className="w-4 h-4 mr-1" /> Geri
      </Button>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base mb-2">{approval.title}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`border text-xs ${RISK_COLORS[approval.riskLevel] || RISK_COLORS["medium"]}`}>
                  {RISK_LABELS[approval.riskLevel] || approval.riskLevel}
                </Badge>
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                  {STATUS_LABELS[approval.status] || approval.status}
                </Badge>
                {approval.executed && (
                  <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/40 border">
                    Calistirildi
                  </Badge>
                )}
              </div>
            </div>
            {isPending && (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-200">{timeLeft(approval.expiresAt)}</div>
                <div className="text-xs text-slate-500">{ON_EXPIRE_LABELS[approval.onExpire] || approval.onExpire}</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {approval.description && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{approval.description}</p>
          )}

          {/* Payload detaylari */}
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Teknik Detaylar</summary>
            <pre className="mt-2 p-3 rounded bg-slate-800 text-xs text-slate-300 overflow-auto max-h-48">
              {JSON.stringify(approval.payload, null, 2)}
            </pre>
          </details>

          {/* Onay/red butonlari */}
          {isPending && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              {!showRejectForm ? (
                <div className="flex gap-3">
                  <Button
                    onClick={() => approveMut.mutate()}
                    disabled={approveMut.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Onayla
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectForm(true)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reddet
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Red sebebini yazın (zorunlu)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-sm"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => rejectMut.mutate()}
                      disabled={!rejectReason.trim() || rejectMut.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      Reddi Onayla
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRejectForm(false)}
                      className="text-slate-400"
                    >
                      Iptal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Red bilgisi */}
          {approval.status === "rejected" && approval.rejectionReason && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-400">
                <span className="font-semibold">Red sebebi:</span> {approval.rejectionReason}
              </p>
              {approval.approvedBy && (
                <p className="text-xs text-slate-500 mt-1">Reddeden: {approval.approvedBy}</p>
              )}
            </div>
          )}

          {/* Audit log */}
          {auditLog.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Log</h3>
              </div>
              <div className="space-y-1">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-800/50">
                    <span className="text-slate-500 flex-shrink-0">
                      {new Date(entry.createdAt).toLocaleString("tr-TR")}
                    </span>
                    <span className="text-slate-300 font-medium flex-shrink-0">{entry.action}</span>
                    <span className="text-slate-500">{entry.performedBy}</span>
                    {entry.notes && <span className="text-slate-400 truncate">{entry.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminApprovals() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");

  const { data, isLoading, refetch } = useQuery<{ approvals: Approval[]; count: number }>({
    queryKey: ["/api/admin-panel/approvals", statusFilter],
    queryFn: () => adminFetchJson(`/api/admin-panel/approvals?status=${statusFilter}`),
    refetchInterval: statusFilter === "pending" ? 30000 : false,
  });

  const pending = (data?.approvals || []).filter((a) => a.status === "pending");
  const completed = (data?.approvals || []).filter((a) => a.status !== "pending");

  if (selectedId !== null) {
    return (
      <AdminLayout title="Onay Kuyruğu" description="HITL onay detayı">
        <div className="p-6">
          <ApprovalDetail approvalId={selectedId} onBack={() => setSelectedId(null)} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Onay Kuyruğu" description="Riskli aksiyonlar insan onayıyla gerçekleşir">
      <div className="p-6 space-y-6">
        {/* Baslik */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Onay Kuyruğu</h1>
            <p className="text-sm text-slate-400 mt-0.5">Riskli aksiyonlar insan onayıyla gerçekleşir</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className="text-xs"
            >
              Bekleyenler {pending.length > 0 && `(${pending.length})`}
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="text-xs"
            >
              <History className="w-3.5 h-3.5 mr-1" />
              Tümü
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm">Yükleniyor...</p>
        ) : (
          <>
            {/* Bekleyenler */}
            {statusFilter === "pending" && pending.length === 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium">Bekleyen onay yok</p>
                  <p className="text-slate-500 text-sm mt-1">Tüm aksiyonlar işlendi</p>
                </CardContent>
              </Card>
            )}

            {pending.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Bekleyenler ({pending.length})
                </h2>
                <div className="space-y-2">
                  {pending.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-left"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        a.riskLevel === "critical" ? "bg-red-500 animate-pulse" :
                        a.riskLevel === "high" ? "bg-orange-500" :
                        a.riskLevel === "medium" ? "bg-yellow-500" : "bg-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{a.title}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{a.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`border text-xs ${RISK_COLORS[a.riskLevel] || RISK_COLORS["medium"]}`}>
                          {RISK_LABELS[a.riskLevel] || a.riskLevel}
                        </Badge>
                        <div className="text-right">
                          <div className="text-xs text-slate-300">{timeLeft(a.expiresAt)}</div>
                          <div className="text-xs text-slate-500">{ON_EXPIRE_LABELS[a.onExpire]?.split(" ")[0]}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tamamlananlar */}
            {completed.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tamamlananlar ({completed.length})
                </h2>
                <div className="space-y-1">
                  {completed.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 transition-colors text-left"
                    >
                      {a.status === "approved" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : a.status === "rejected" ? (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm text-slate-300 truncate">{a.title}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                      <span className="text-xs text-slate-600 flex-shrink-0">
                        {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
