import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface RemTicket {
  id: number;
  ticketNumber: string;
  findingTitle: string;
  findingSeverity: string;
  affectedAsset: string | null;
  unifiedRiskScore: string;
  status: string;
  slaBreached: boolean;
  slaDeadline: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  createdAt: string;
  companyName: string | null;
  customerEmail: string;
}

interface Summary {
  total: number;
  slaBreached: number;
  pendingVerification: number;
  closedThisMonth: number;
}

function riskColor(score: number) {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

function riskBg(score: number) {
  if (score >= 80) return "border-l-4 border-l-red-500";
  if (score >= 60) return "border-l-4 border-l-orange-500";
  if (score >= 40) return "border-l-4 border-l-yellow-500";
  return "border-l-4 border-l-green-500";
}

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "Devam Ediyor",
  pending_verification: "Doğrulama Bekleniyor",
  verified_fixed: "Giderildi",
  accepted_risk: "Risk Kabul",
  false_positive: "Yanlış Tespit",
  wont_fix: "Düzeltilmeyecek",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-red-900/40 text-red-300 border-red-700",
  in_progress: "bg-blue-900/40 text-blue-300 border-blue-700",
  pending_verification: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  verified_fixed: "bg-green-900/40 text-green-300 border-green-700",
  accepted_risk: "bg-gray-700/40 text-gray-300 border-gray-600",
};

export default function AdminRemediation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-remediation", statusFilter],
    queryFn: async () => {
      const u = new URL("/api/admin/remediation", window.location.origin);
      if (statusFilter) u.searchParams.set("status", statusFilter);
      const r = await fetch(u.toString());
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<{ tickets: RemTicket[]; summary: Summary }>;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/admin/remediation/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Güncelleme başarısız");
    },
    onSuccess: () => {
      toast({ title: "Durum güncellendi" });
      qc.invalidateQueries({ queryKey: ["admin-remediation"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const summary = data?.summary;
  const tickets = data?.tickets ?? [];

  return (
    <AdminLayout title="Remediation Yönetimi">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Remediation Yönetimi</h1>
            <p className="text-gray-400 text-sm mt-1">Güvenlik açıklarının giderilme süreçlerini takip edin.</p>
          </div>
        </div>

        {/* Özet Metrikler */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-[#0A1628] border-[#1A2840]">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{summary.total}</p>
                <p className="text-sm text-gray-400">Toplam Ticket</p>
              </CardContent>
            </Card>
            <Card className={`border-[#1A2840] ${summary.slaBreached > 0 ? "bg-red-900/20" : "bg-[#0A1628]"}`}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold ${summary.slaBreached > 0 ? "text-red-400" : "text-white"}`}>
                  {summary.slaBreached}
                </p>
                <p className="text-sm text-gray-400">SLA Aşımı</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0A1628] border-[#1A2840]">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{summary.pendingVerification}</p>
                <p className="text-sm text-gray-400">Doğrulama Bekleyen</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0A1628] border-[#1A2840]">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{summary.closedThisMonth}</p>
                <p className="text-sm text-gray-400">Bu Ay Kapatılan</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtre */}
        <div className="flex items-center gap-3">
          <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48 bg-[#0A1628] border-[#1A2840] text-white">
              <SelectValue placeholder="Tüm Durumlar" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A1628] border-[#1A2840]">
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="open">Açık</SelectItem>
              <SelectItem value="in_progress">Devam Ediyor</SelectItem>
              <SelectItem value="pending_verification">Doğrulama Bekleyen</SelectItem>
              <SelectItem value="verified_fixed">Giderildi</SelectItem>
              <SelectItem value="accepted_risk">Risk Kabul</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tablo */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : tickets.length === 0 ? (
          <Card className="bg-[#0A1628] border-[#1A2840]">
            <CardContent className="py-12 text-center text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
              Bu filtrede ticket bulunamadı.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const score = Number(ticket.unifiedRiskScore) || 0;
              return (
                <Card key={ticket.id} className={`bg-[#0A1628] border-[#1A2840] ${riskBg(score)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-lg font-bold ${riskColor(score)}`}>{score}</span>
                          <span className="font-medium text-white truncate">{ticket.findingTitle}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BADGE[ticket.status] ?? "bg-gray-700/40 text-gray-300 border-gray-600"}`}>
                            {STATUS_LABELS[ticket.status] ?? ticket.status}
                          </span>
                          {ticket.slaBreached && (
                            <span className="text-xs px-2 py-0.5 rounded border bg-red-900/40 text-red-300 border-red-700">
                              SLA Aşıldı
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span>{ticket.companyName ?? ticket.customerEmail}</span>
                          {ticket.affectedAsset && <span>· {ticket.affectedAsset}</span>}
                          <span>· {ticket.ticketNumber}</span>
                          {ticket.slaDeadline && (
                            <span className={`flex items-center gap-1 ${ticket.slaBreached ? "text-red-400" : ""}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(ticket.slaDeadline).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Select
                          value={ticket.status}
                          onValueChange={status => updateStatus.mutate({ id: ticket.id, status })}
                        >
                          <SelectTrigger className="w-40 bg-[#060D1A] border-[#1A2840] text-white text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0A1628] border-[#1A2840]">
                            <SelectItem value="open">Açık</SelectItem>
                            <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                            <SelectItem value="pending_verification">Doğrulama Bekleyen</SelectItem>
                            <SelectItem value="verified_fixed">Giderildi</SelectItem>
                            <SelectItem value="accepted_risk">Risk Kabul</SelectItem>
                            <SelectItem value="false_positive">Yanlış Tespit</SelectItem>
                            <SelectItem value="wont_fix">Düzeltilmeyecek</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
