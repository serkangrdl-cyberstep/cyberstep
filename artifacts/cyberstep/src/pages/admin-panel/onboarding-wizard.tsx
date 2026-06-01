import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, SkipForward, Clock, ChevronDown, ChevronRight,
  User, ArrowLeft, Loader2, Circle, MinusCircle,
} from "lucide-react";

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "skipped";
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
  id: number | null;
}

interface OnboardingService {
  slug: string;
  label: string;
  subscriptionId: number | null;
  steps: OnboardingStep[];
  totalSteps: number;
  doneCount: number;
  allDone: boolean;
}

interface CustomerOnboarding {
  customer: {
    id: number;
    email: string;
    fullName: string | null;
    companyName: string | null;
  };
  services: OnboardingService[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: "Bekliyor",    color: "text-slate-400",  icon: Circle },
  in_progress: { label: "Devam Ediyor", color: "text-yellow-400", icon: Loader2 },
  done:        { label: "Tamamlandı",  color: "text-emerald-400", icon: CheckCircle2 },
  skipped:     { label: "Atlandı",     color: "text-slate-500",  icon: MinusCircle },
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }

function StepRow({
  step,
  serviceSlug,
  customerId,
  onUpdate,
}: {
  step: OnboardingStep;
  serviceSlug: string;
  customerId: string;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState(step.notes ?? "");
  const { toast } = useToast();

  const update = useMutation({
    mutationFn: (vars: { status: string; notes?: string }) =>
      fetch(`/api/admin-panel/onboarding/${customerId}/step`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSlug, stepKey: step.key, ...vars }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: "destructive" }); return; }
      onUpdate();
      toast({ title: "Adım güncellendi" });
    },
  });

  const cfg = STATUS_CONFIG[step.status] ?? STATUS_CONFIG["pending"]!;
  const Icon = cfg.icon;
  const isDone = step.status === "done" || step.status === "skipped";

  return (
    <div className={`border rounded-lg transition-colors ${isDone ? "border-slate-700/50 bg-slate-900/30" : "border-slate-700 bg-slate-900/60"}`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(p => !p)}
      >
        <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? "text-slate-400" : "text-white"}`}>{step.label}</p>
          {isDone && step.completedBy && (
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtDate(step.completedAt)} — {step.completedBy}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={`text-xs border-slate-700 ${cfg.color} shrink-0`}
        >
          {cfg.label}
        </Badge>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
          <p className="text-slate-400 text-sm">{step.description}</p>

          <div className="space-y-1.5">
            <label className="text-slate-500 text-xs">Not (opsiyonel)</label>
            <Textarea
              className="bg-slate-800 border-slate-700 text-white text-sm"
              rows={2}
              placeholder="Yapılan işlemler, sorunlar, özel notlar..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {step.status !== "in_progress" && step.status !== "done" && (
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 h-8"
                onClick={() => update.mutate({ status: "in_progress", notes: noteText })}
                disabled={update.isPending}
              >
                <Clock className="h-3 w-3 mr-1" />
                Devam Ediyor
              </Button>
            )}
            {step.status !== "done" && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 h-8"
                onClick={() => update.mutate({ status: "done", notes: noteText })}
                disabled={update.isPending}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Tamamlandı
              </Button>
            )}
            {step.status !== "skipped" && step.status !== "done" && (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700 h-8"
                onClick={() => update.mutate({ status: "skipped", notes: noteText })}
                disabled={update.isPending}
              >
                <SkipForward className="h-3 w-3 mr-1" />
                Atla
              </Button>
            )}
            {(step.status === "done" || step.status === "skipped") && (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700 h-8"
                onClick={() => update.mutate({ status: "pending", notes: noteText })}
                disabled={update.isPending}
              >
                Geri Al
              </Button>
            )}
            {noteText !== (step.notes ?? "") && (
              <Button
                size="sm"
                variant="outline"
                className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 h-8"
                onClick={() => update.mutate({ status: step.status, notes: noteText })}
                disabled={update.isPending}
              >
                Notu Kaydet
              </Button>
            )}
          </div>

          {step.notes && noteText === step.notes && (
            <p className="text-slate-500 text-xs bg-slate-800 rounded px-3 py-2">
              Not: {step.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingWizard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<CustomerOnboarding>({
    queryKey: ["/api/admin-panel/onboarding", id],
    queryFn: () => fetch(`/api/admin-panel/onboarding/${id}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  const toggleService = (slug: string) =>
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  if (isLoading) return (
    <AdminLayout title="Onboarding Wizard">
      <div className="text-slate-400 text-center py-20">Yükleniyor...</div>
    </AdminLayout>
  );

  if (!data || (data as any).error) return (
    <AdminLayout title="Onboarding Wizard">
      <div className="text-red-400 text-center py-20">Müşteri bulunamadı</div>
    </AdminLayout>
  );

  const { customer, services } = data;
  const hasServices = services.length > 0;
  const totalAll = services.reduce((a, s) => a + s.totalSteps, 0);
  const doneAll = services.reduce((a, s) => a + s.doneCount, 0);

  return (
    <AdminLayout
      title={`Onboarding: ${customer.companyName ?? customer.fullName ?? customer.email}`}
      description="Servis aktivasyon checklist'i"
    >
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700 text-slate-300 h-8"
          onClick={() => navigate(`/panel/musteriler/${id}`)}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Müşteri 360
        </Button>
        <div className="flex items-center gap-2 text-slate-400">
          <User className="h-4 w-4" />
          <span className="text-sm">{customer.email}</span>
        </div>
      </div>

      {/* Overall progress */}
      {totalAll > 0 && (
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardContent className="p-5 flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-slate-400 text-xs">Genel İlerleme</p>
              <p className="text-white text-2xl font-bold mt-0.5">
                {doneAll} / {totalAll}
              </p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalAll > 0 ? (doneAll / totalAll) * 100 : 0}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">
                {totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0}% tamamlandı
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-xs">{services.filter(s => s.allDone).length} / {services.length} servis hazır</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasServices && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-10 text-center">
            <p className="text-slate-500">Bu müşteriye ait aktif servis bulunamadı.</p>
            <p className="text-slate-600 text-sm mt-2">Servis aktivasyonu yapıldıktan sonra onboarding adımları burada görünür.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {services.map(svc => {
          const isOpen = expandedServices.has(svc.slug);
          const pct = svc.totalSteps > 0 ? Math.round((svc.doneCount / svc.totalSteps) * 100) : 0;

          return (
            <Card key={svc.slug} className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-0">
                <button
                  className="w-full flex items-center justify-between gap-3 text-left"
                  onClick={() => toggleService(svc.slug)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {svc.allDone
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      : <Circle className="h-5 w-5 text-slate-600 shrink-0" />
                    }
                    <div className="min-w-0">
                      <CardTitle className="text-white text-sm">{svc.label}</CardTitle>
                      <p className="text-slate-500 text-xs mt-0.5 font-mono">{svc.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-medium text-white">{svc.doneCount}/{svc.totalSteps}</span>
                      <span className="text-xs text-slate-500 ml-1">adım</span>
                    </div>
                    <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${svc.allDone ? "bg-emerald-500" : "bg-cyan-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {svc.allDone
                      ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">Hazır</Badge>
                      : <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">Devam Ediyor</Badge>
                    }
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-slate-500" />
                      : <ChevronRight className="h-4 w-4 text-slate-500" />
                    }
                  </div>
                </button>
              </CardHeader>
              {isOpen && (
                <CardContent className="pt-4 space-y-2">
                  {svc.steps.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">Bu servis için onboarding adımı tanımlanmamış.</p>
                  )}
                  {svc.steps.map(step => (
                    <StepRow
                      key={step.key}
                      step={step}
                      serviceSlug={svc.slug}
                      customerId={id}
                      onUpdate={() => qc.invalidateQueries({ queryKey: ["/api/admin-panel/onboarding", id] })}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}
