import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Phone, Mail, Calendar, Clock, CheckCircle, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MeetingRequest {
  request: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    status: string | null;
    requestedAt: string;
    contactedAt: string | null;
    scheduledAt: string | null;
  };
  prospect: {
    id: number;
    domain: string;
    companyName: string;
    sector: string | null;
  } | null;
  reportScore: number | null;
  reportLevel: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  contacted: "Arandı",
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  contacted: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  completed: "bg-green-500/20 text-green-400 border-green-500/40",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/40",
};

export default function IsrMeetingRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<MeetingRequest[]>({
    queryKey: ["isr-meeting-requests", statusFilter],
    queryFn: () =>
      fetch(`/api/enterprise/isr/meeting-requests?status=${statusFilter}`, {
        credentials: "include",
      }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/enterprise/isr/meeting-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["isr-meeting-requests"] });
      toast({ title: "Durum güncellendi" });
    },
  });

  const requests = Array.isArray(data) ? data : [];

  return (
    <AdminLayout title="Görüşme Talepleri">
      <div style={{ background: "#060D1A", minHeight: "100vh", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#E8EDF5", margin: 0 }}>Görüşme Talepleri</h1>
          <p style={{ fontSize: 13, color: "#8896A8", marginTop: 4 }}>
            Teaser sayfasından gelen "Uzmanla Görüş" talepleri
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["all", "pending", "contacted", "scheduled", "completed"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 16px", borderRadius: 20, border: "1px solid",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: statusFilter === s ? "#00C8FF" : "transparent",
                color: statusFilter === s ? "#060D1A" : "#8896A8",
                borderColor: statusFilter === s ? "#00C8FF" : "#1A3050",
              }}
            >
              {s === "all" ? "Tümü" : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", color: "#8896A8", padding: 40 }}>Yükleniyor...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8896A8", padding: 40, background: "#0A1828", borderRadius: 12, border: "1px solid #1A3050" }}>
            Bu kategoride görüşme talebi yok
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map(({ request, prospect, reportScore, reportLevel }) => (
              <div
                key={request.id}
                style={{ background: "#0A1828", border: "1px solid #1A3050", borderRadius: 12, overflow: "hidden" }}
              >
                {/* Header */}
                <div style={{ background: "#060D1A", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1A3050" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EDF5" }}>
                        {prospect?.domain ?? "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8896A8", marginTop: 2 }}>
                        {prospect?.companyName ?? ""}{prospect?.sector ? ` · ${prospect.sector}` : ""}
                      </div>
                    </div>
                    {reportScore !== null && (
                      <div style={{
                        background: reportScore >= 70 ? "#2ECC7122" : reportScore >= 40 ? "#F5A62322" : "#E03A3A22",
                        border: `1px solid ${reportScore >= 70 ? "#2ECC7144" : reportScore >= 40 ? "#F5A62344" : "#E03A3A44"}`,
                        borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                        color: reportScore >= 70 ? "#2ECC71" : reportScore >= 40 ? "#F5A623" : "#E03A3A",
                      }}>
                        {reportScore}/100
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, border: "1px solid",
                      ...(STATUS_COLORS[request.status ?? "pending"]
                        ? Object.fromEntries(
                            STATUS_COLORS[request.status ?? "pending"]!
                              .split(" ")
                              .map(c => c.startsWith("bg-") ? ["background", c.replace("bg-", "").replace("/20", "")] :
                                        c.startsWith("text-") ? ["color", c.replace("text-", "")] :
                                        c.startsWith("border-") ? ["borderColor", c.replace("border-", "").replace("/40", "")] : ["x", c])
                          )
                        : { background: "#1A3050", color: "#8896A8", borderColor: "#1A3050" }),
                    }}>
                      {STATUS_LABELS[request.status ?? "pending"] ?? request.status}
                    </span>
                    <span style={{ fontSize: 11, color: "#4A6080" }}>
                      <Clock style={{ display: "inline", width: 12, height: 12, verticalAlign: "middle" }} />{" "}
                      {format(new Date(request.requestedAt), "d MMM HH:mm", { locale: tr })}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#E8EDF5" }}>
                    <span style={{ color: "#8896A8", fontSize: 11 }}>İsim:</span>
                    {request.name || <span style={{ color: "#4A6080" }}>—</span>}
                  </div>
                  {request.email && (
                    <a href={`mailto:${request.email}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#00C8FF", textDecoration: "none" }}>
                      <Mail style={{ width: 13, height: 13 }} /> {request.email}
                    </a>
                  )}
                  {request.phone && (
                    <a href={`tel:${request.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2ECC71", textDecoration: "none" }}>
                      <Phone style={{ width: 13, height: 13 }} /> {request.phone}
                    </a>
                  )}
                </div>

                {request.message && (
                  <div style={{ padding: "0 16px 12px", fontSize: 12, color: "#8896A8", fontStyle: "italic" }}>
                    "{request.message}"
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid #1A3050", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {request.status === "pending" && (
                    <button
                      onClick={() => updateMutation.mutate({ id: request.id, status: "contacted" })}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #00C8FF44", background: "#00C8FF18", color: "#00C8FF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <Phone style={{ width: 12, height: 12 }} /> Arandı
                    </button>
                  )}
                  {(request.status === "pending" || request.status === "contacted") && (
                    <button
                      onClick={() => updateMutation.mutate({ id: request.id, status: "scheduled" })}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #9B59B644", background: "#9B59B618", color: "#9B59B6", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <CalendarCheck style={{ width: 12, height: 12 }} /> Planlandı
                    </button>
                  )}
                  {request.status !== "completed" && request.status !== "cancelled" && (
                    <button
                      onClick={() => updateMutation.mutate({ id: request.id, status: "completed" })}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #2ECC7144", background: "#2ECC7118", color: "#2ECC71", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <CheckCircle style={{ width: 12, height: 12 }} /> Tamamlandı
                    </button>
                  )}
                  {prospect && (
                    <a
                      href={`/panel/enterprise/prospects/${prospect.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#8896A8", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}
                    >
                      Prospect →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
