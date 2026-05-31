import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield, AlertTriangle, CheckCircle, Clock, ChevronRight,
  Loader2, FileText, XCircle, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface RemediationTicket {
  id: number;
  ticketNumber: string;
  findingTitle: string;
  findingSeverity: string;
  affectedAsset: string;
  unifiedRiskScore: string;
  status: string;
  slaDeadline: string | null;
  slaBreached: boolean;
  dueDate: string | null;
  findingDescription: string | null;
  findingType: string | null;
  createdAt: string;
}

function riskColor(score: number): string {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

function riskBg(score: number): string {
  if (score >= 80) return "border-red-500/40 bg-red-900/10";
  if (score >= 60) return "border-orange-500/40 bg-orange-900/10";
  if (score >= 40) return "border-yellow-500/40 bg-yellow-900/10";
  return "border-green-500/40 bg-green-900/10";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Açık",
    in_progress: "Devam Ediyor",
    pending_verification: "Doğrulama Bekleniyor",
    verified_fixed: "Giderildi",
    accepted_risk: "Risk Kabul Edildi",
    false_positive: "Yanlış Tespit",
    wont_fix: "Düzeltilmeyecek",
  };
  return map[status] ?? status;
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    open: "bg-red-900/40 text-red-300 border-red-700",
    in_progress: "bg-blue-900/40 text-blue-300 border-blue-700",
    pending_verification: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    verified_fixed: "bg-green-900/40 text-green-300 border-green-700",
    accepted_risk: "bg-gray-700/40 text-gray-300 border-gray-600",
  };
  return variants[status] ?? "bg-gray-700/40 text-gray-300 border-gray-600";
}

function daysLeft(deadline: string | null): { days: number; overdue: boolean } | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  return { days: Math.abs(days), overdue: days < 0 };
}

export default function Bulgularim() {
  useRequireCustomer();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [fixDesc, setFixDesc] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptReason, setAcceptReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-tickets"],
    queryFn: async () => {
      const r = await fetch("/api/portal/tickets");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<{ tickets: RemediationTicket[] }>;
    },
  });

  const markFixed = useMutation({
    mutationFn: async ({ id, fixDescription }: { id: number; fixDescription: string }) => {
      const r = await fetch(`/api/portal/tickets/${id}/fixed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixDescription }),
      });
      if (!r.ok) throw new Error("Hata");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Doğrulama taraması planlandı", description: "4 saat içinde otomatik kontrol yapılacak." });
      qc.invalidateQueries({ queryKey: ["portal-tickets"] });
      setFixingId(null);
      setFixDesc("");
    },
    onError: () => toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" }),
  });

  const acceptRisk = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const r = await fetch(`/api/portal/tickets/${id}/accept-risk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error("Hata");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Risk kabul edildi", description: "Ticket kapatıldı." });
      qc.invalidateQueries({ queryKey: ["portal-tickets"] });
      setAcceptingId(null);
      setAcceptReason("");
    },
    onError: () => toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" }),
  });

  const tickets = data?.tickets ?? [];
  const openTickets = tickets.filter(t => !["verified_fixed", "accepted_risk", "false_positive", "wont_fix"].includes(t.status));
  const closedTickets = tickets.filter(t => ["verified_fixed", "accepted_risk", "false_positive", "wont_fix"].includes(t.status));

  return (
    <div className="min-h-screen bg-[#060D1A] text-[#E8EDF5] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/hesabim">
            <Button variant="ghost" size="sm" className="text-[#00C8FF]/70 hover:text-[#00C8FF]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hesabım
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-7 h-7 text-[#00C8FF]" />
          <div>
            <h1 className="text-2xl font-bold">Bulgularım</h1>
            <p className="text-[#8899AA] text-sm">Tespit edilen güvenlik açıklarını takip edin ve kapatın.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C8FF]" />
          </div>
        ) : tickets.length === 0 ? (
          <Card className="bg-[#0A1628] border-[#1A2840]">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-semibold">Açık bulgu yok</p>
              <p className="text-[#8899AA] text-sm mt-1">Tüm tespitler giderildi veya henüz tarama yapılmadı.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Açık Bulgular */}
            {openTickets.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#8899AA] uppercase tracking-wider mb-3">
                  Kapatılması Gereken Açıklar ({openTickets.length})
                </h2>
                <div className="space-y-3">
                  {openTickets.map((ticket) => {
                    const score = Number(ticket.unifiedRiskScore) || 0;
                    const dl = daysLeft(ticket.slaDeadline);
                    return (
                      <div key={ticket.id} className={`rounded-lg border p-4 ${riskBg(score)}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xl font-bold ${riskColor(score)}`}>[{score}]</span>
                              <span className="font-semibold truncate">{ticket.findingTitle}</span>
                              <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(ticket.status)}`}>
                                {statusLabel(ticket.status)}
                              </span>
                            </div>
                            {ticket.affectedAsset && (
                              <p className="text-sm text-[#8899AA]">Etkilenen: {ticket.affectedAsset}</p>
                            )}
                            {ticket.findingDescription && (
                              <p className="text-sm text-[#8899AA] mt-1 line-clamp-2">{ticket.findingDescription}</p>
                            )}
                            {dl && (
                              <div className={`flex items-center gap-1 mt-2 text-xs ${dl.overdue || ticket.slaBreached ? "text-red-400" : "text-[#8899AA]"}`}>
                                <Clock className="w-3 h-3" />
                                {dl.overdue || ticket.slaBreached
                                  ? `SLA aşıldı (${dl.days} gün geçti)`
                                  : `Vade: ${dl.days} gün kaldı`}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-[#556677] shrink-0">{ticket.ticketNumber}</span>
                        </div>

                        {ticket.status === "pending_verification" ? (
                          <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Doğrulama taraması bekleniyor...
                          </div>
                        ) : ticket.status === "open" || ticket.status === "in_progress" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
                              onClick={() => setFixingId(ticket.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Düzelttim
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#1A2840] text-[#8899AA] hover:text-white"
                              onClick={() => setAcceptingId(ticket.id)}
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Risk Kabul Et
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Kapalı Bulgular */}
            {closedTickets.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#8899AA] uppercase tracking-wider mb-3">
                  Kapatılan Bulgular ({closedTickets.length})
                </h2>
                <div className="space-y-2">
                  {closedTickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border border-[#1A2840] bg-[#0A1628]/50 p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{ticket.findingTitle}</p>
                        {ticket.affectedAsset && (
                          <p className="text-xs text-[#8899AA]">{ticket.affectedAsset}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(ticket.status)}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Düzelttim Dialog */}
      <Dialog open={fixingId !== null} onOpenChange={open => { if (!open) setFixingId(null); }}>
        <DialogContent className="bg-[#0A1628] border-[#1A2840] text-[#E8EDF5]">
          <DialogHeader>
            <DialogTitle>Düzeltme Bildirimi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#8899AA]">
              Ne yaptığınızı kısaca yazın (isteğe bağlı). 4 saat içinde otomatik doğrulama taraması yapılacak.
            </p>
            <Textarea
              placeholder="Örnek: DNS kayıtlarına DMARC politikası ekledim."
              className="bg-[#060D1A] border-[#1A2840] text-[#E8EDF5] min-h-[80px]"
              value={fixDesc}
              onChange={e => setFixDesc(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setFixingId(null)}>İptal</Button>
              <Button
                className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
                disabled={markFixed.isPending}
                onClick={() => {
                  if (fixingId) markFixed.mutate({ id: fixingId, fixDescription: fixDesc });
                }}
              >
                {markFixed.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gönder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Kabul Dialog */}
      <Dialog open={acceptingId !== null} onOpenChange={open => { if (!open) setAcceptingId(null); }}>
        <DialogContent className="bg-[#0A1628] border-[#1A2840] text-[#E8EDF5]">
          <DialogHeader>
            <DialogTitle>Risk Kabul</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#8899AA]">
              Bu güvenlik açığını kabul ediyorsunuz. Neden? (isteğe bağlı)
            </p>
            <Textarea
              placeholder="Örnek: Etkilenen sistem izole ağda, dışarıdan erişim yok."
              className="bg-[#060D1A] border-[#1A2840] text-[#E8EDF5] min-h-[80px]"
              value={acceptReason}
              onChange={e => setAcceptReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAcceptingId(null)}>İptal</Button>
              <Button
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-900/20"
                disabled={acceptRisk.isPending}
                onClick={() => {
                  if (acceptingId) acceptRisk.mutate({ id: acceptingId, reason: acceptReason });
                }}
              >
                {acceptRisk.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Risk Kabul Et"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
