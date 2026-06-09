import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, Clock, CheckCircle, Users, ChevronDown, ChevronUp,
  Loader2, Shield, FileText, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface SurveySection {
  selectedProducts: string[];
  freeText?: string;
  completedAt: string;
}

interface DiscoveryRequest {
  id: number;
  token: string;
  email: string;
  contactName: string;
  companyName: string;
  phone: string | null;
  sector: string | null;
  status: string;
  ndaAcceptedAt: string | null;
  ndaIp: string | null;
  partnerSharingConsent: boolean;
  surveyAnswers: Record<string, SurveySection> | null;
  surveyCompletedAt: string | null;
  workshopScheduledAt: string | null;
  workshopCompletedAt: string | null;
  assignedPartner: string | null;
  techRegister: unknown[] | null;
  cmdbCreatedAt: string | null;
  riskRoadmap: string | null;
  adminNotes: string | null;
  prefillDomain: string | null;
  prefillData: unknown | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_nda: "NDA Bekleniyor",
  survey_in_progress: "Anket Devam Ediyor",
  survey_complete: "Anket Tamamlandı",
  workshop_scheduled: "Workshop Planlandı",
  workshop_complete: "Workshop Tamamlandı",
  cmdb_created: "CMDB Hazır",
};

const STATUS_COLORS: Record<string, string> = {
  pending_nda: "bg-yellow-100 text-yellow-800 border-yellow-300",
  survey_in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  survey_complete: "bg-green-100 text-green-800 border-green-300",
  workshop_scheduled: "bg-purple-100 text-purple-800 border-purple-300",
  workshop_complete: "bg-purple-200 text-purple-900 border-purple-400",
  cmdb_created: "bg-emerald-100 text-emerald-800 border-emerald-400",
};

const SECTION_LABELS: Record<string, string> = {
  identity_email: "Kimlik & E-posta",
  firewall: "Güvenlik Duvarı",
  endpoint: "Uç Nokta / EDR",
  server: "Sunucu Altyapısı",
  backup: "Yedekleme",
  erp: "ERP / Muhasebe",
  saas: "Kritik SaaS",
  ot_scada: "OT / SCADA",
  ai_usage: "AI Kullanımı",
  compliance: "Uyumluluk",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function RequestRow({ req, onRefresh }: { req: DiscoveryRequest; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assignedPartner: req.assignedPartner ?? "",
    workshopScheduledAt: req.workshopScheduledAt ? req.workshopScheduledAt.slice(0, 16) : "",
    adminNotes: req.adminNotes ?? "",
  });
  const [cmdbNotes, setCmdbNotes] = useState(req.riskRoadmap ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/tech-discovery/${req.id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignForm),
      });
      if (!r.ok) throw new Error("İstek başarısız");
    },
    onSuccess: () => { toast({ title: "Güncellendi" }); qc.invalidateQueries({ queryKey: ["admin-tech-discovery"] }); onRefresh(); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const cmdbMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/tech-discovery/${req.id}/cmdb`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskRoadmap: cmdbNotes, workshopNotes: assignForm.adminNotes }),
      });
      if (!r.ok) throw new Error("İstek başarısız");
    },
    onSuccess: () => { toast({ title: "CMDB oluşturuldu" }); qc.invalidateQueries({ queryKey: ["admin-tech-discovery"] }); onRefresh(); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const surveyAnswers = req.surveyAnswers ?? {};
  const completedSections = Object.keys(surveyAnswers).length;

  return (
    <Card className="border overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{req.companyName}</p>
              <Badge className={`text-xs border ${STATUS_COLORS[req.status] ?? ""}`}>
                {STATUS_LABELS[req.status] ?? req.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {req.contactName} · {req.email}
              {req.sector && ` · ${req.sector}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{completedSections}/10 bölüm</span>
          <span className="hidden sm:inline">{fmt(req.createdAt)}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-6">
          {/* NDA bilgisi */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">NDA Durumu</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">İmza tarihi: </span>{fmt(req.ndaAcceptedAt)}</div>
              <div><span className="text-muted-foreground">IP: </span><span className="font-mono">{req.ndaIp ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Partner onayı: </span>{req.partnerSharingConsent ? <span className="text-green-600">Verildi</span> : <span className="text-muted-foreground">Verilmedi</span>}</div>
              {req.prefillDomain && <div><span className="text-muted-foreground">Domain: </span><span className="font-mono">{req.prefillDomain}</span></div>}
            </div>
          </div>

          {/* Survey cevapları */}
          {completedSections > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Anket Cevapları ({completedSections}/10)</p>
              <div className="grid md:grid-cols-2 gap-2">
                {Object.entries(surveyAnswers).map(([key, val]) => (
                  <div key={key} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-medium mb-1">{SECTION_LABELS[key] ?? key}</p>
                    <p className="text-xs text-muted-foreground">
                      {val.selectedProducts.length > 0 ? val.selectedProducts.join(", ") : "—"}
                    </p>
                    {val.freeText && <p className="text-xs text-muted-foreground mt-1 italic">"{val.freeText}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workshop & Partner atama */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Workshop Planla / Partner Ata
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Partner firma</Label>
                <Input
                  value={assignForm.assignedPartner}
                  onChange={e => setAssignForm(f => ({ ...f, assignedPartner: e.target.value }))}
                  placeholder="Partner A Güvenlik A.Ş."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Workshop tarihi/saati</Label>
                <Input
                  type="datetime-local"
                  value={assignForm.workshopScheduledAt}
                  onChange={e => setAssignForm(f => ({ ...f, workshopScheduledAt: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Admin notu</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                rows={2}
                value={assignForm.adminNotes}
                onChange={e => setAssignForm(f => ({ ...f, adminNotes: e.target.value }))}
                placeholder="İç not..."
              />
            </div>
            <Button size="sm" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Kaydet
            </Button>
          </div>

          {/* CMDB oluştur */}
          {req.status === "workshop_scheduled" || req.status === "workshop_complete" || req.status === "survey_complete" ? (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" /> Workshop Sonrası — CMDB / Yol Haritası
              </p>
              <div className="space-y-1">
                <Label className="text-xs">12 Aylık Güvenlik Yol Haritası (workshop sonrası)</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  rows={5}
                  value={cmdbNotes}
                  onChange={e => setCmdbNotes(e.target.value)}
                  placeholder="1. [Kritik] FortiGate firmware güncellemesi — Q1&#10;2. [Yüksek] EDR kapsam genişletme — Q1&#10;3. ..."
                />
              </div>
              <Button size="sm" onClick={() => cmdbMutation.mutate()} disabled={cmdbMutation.isPending}>
                {cmdbMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                CMDB Oluştur ve Tamamla
              </Button>
            </div>
          ) : null}

          {req.riskRoadmap && (
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">Yol Haritası</p>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{req.riskRoadmap}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminTechDiscovery() {
  const { data: requests = [], isLoading, refetch } = useQuery<DiscoveryRequest[]>({
    queryKey: ["admin-tech-discovery"],
    queryFn: () => fetch("/api/admin/tech-discovery").then(r => r.json()),
  });

  const reqs = Array.isArray(requests) ? requests : [];

  const counts = {
    total: reqs.length,
    pendingNda: reqs.filter(r => r.status === "pending_nda").length,
    surveyComplete: reqs.filter(r => r.status === "survey_complete").length,
    workshopScheduled: reqs.filter(r => r.status === "workshop_scheduled").length,
    cmdbCreated: reqs.filter(r => r.status === "cmdb_created").length,
  };

  return (
    <AdminLayout title="Technology Discovery">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Technology Discovery</h1>
          <p className="text-sm text-muted-foreground mt-1">NDA + Anket + Workshop + CMDB yönetimi</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Toplam", value: counts.total, icon: <Database className="h-4 w-4" />, color: "text-foreground" },
            { label: "Anket Hazır", value: counts.surveyComplete, icon: <CheckCircle className="h-4 w-4" />, color: "text-green-600" },
            { label: "Workshop Planlandı", value: counts.workshopScheduled, icon: <Calendar className="h-4 w-4" />, color: "text-purple-600" },
            { label: "CMDB Hazır", value: counts.cmdbCreated, icon: <Shield className="h-4 w-4" />, color: "text-emerald-600" },
          ].map(stat => (
            <Card key={stat.label} className="p-4 border">
              <div className={`flex items-center gap-2 mb-1 ${stat.color}`}>{stat.icon}<span className="text-xs font-medium">{stat.label}</span></div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reqs.length === 0 ? (
          <Card className="p-8 text-center border">
            <p className="text-muted-foreground text-sm">Henüz Technology Discovery talebi yok.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reqs.map(req => <RequestRow key={req.id} req={req} onRefresh={refetch} />)}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
