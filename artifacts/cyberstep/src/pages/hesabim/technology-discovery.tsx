import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Database, Clock, CheckCircle, Lock, Users, ArrowRight, Plus, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequireCustomer } from "@/hooks/use-customer";

interface DiscoveryRequest {
  id: number;
  token: string;
  companyName: string;
  status: string;
  ndaAcceptedAt: string | null;
  surveyCompletedAt: string | null;
  workshopScheduledAt: string | null;
  cmdbCreatedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_nda: "NDA Bekleniyor",
  survey_in_progress: "Anket Devam Ediyor",
  survey_complete: "Anket Tamamlandı",
  workshop_scheduled: "Workshop Planlandı",
  workshop_complete: "Workshop Tamamlandı",
  cmdb_created: "Teknoloji Kaydı Hazır",
};

const STATUS_COLORS: Record<string, string> = {
  pending_nda: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
  survey_in_progress: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
  survey_complete: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
  workshop_scheduled: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300",
  workshop_complete: "bg-purple-200 text-purple-900 border-purple-400",
  cmdb_created: "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const STATUS_STEPS = [
  { key: "nda", label: "NDA İmzalandı", field: "ndaAcceptedAt" },
  { key: "survey", label: "Anket Tamamlandı", field: "surveyCompletedAt" },
  { key: "workshop", label: "Workshop Yapıldı", field: "workshopScheduledAt" },
  { key: "cmdb", label: "Teknoloji Kaydı Hazır", field: "cmdbCreatedAt" },
];

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function RequestCard({ req }: { req: DiscoveryRequest }) {
  const statusLabel = STATUS_LABELS[req.status] ?? req.status;
  const statusColor = STATUS_COLORS[req.status] ?? "";

  const steps = STATUS_STEPS.map(s => ({
    ...s,
    date: fmt(req[s.field as keyof DiscoveryRequest] as string | null),
    done: !!req[s.field as keyof DiscoveryRequest],
  }));

  const canContinue = req.status === "pending_nda" || req.status === "survey_in_progress";

  return (
    <Card className="p-5 border">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold">{req.companyName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Başlangıç: {fmt(req.createdAt)}</p>
        </div>
        <Badge className={`text-xs border ${statusColor}`}>{statusLabel}</Badge>
      </div>

      <div className="flex items-center gap-1 mb-4">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`flex items-center gap-1 flex-1 min-w-0 ${i > 0 ? "ml-1" : ""}`}>
              {i > 0 && <div className={`h-px flex-1 ${step.done ? "bg-green-400" : "bg-muted"}`} />}
              <div title={step.label} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${step.done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground border"}`}>
                {step.done ? "✓" : i + 1}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs text-muted-foreground">
        {steps.map(step => (
          <div key={step.key} className="flex items-center gap-1.5">
            {step.done
              ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
              : <Clock className="h-3 w-3 shrink-0" />}
            <span>{step.label}{step.date ? `: ${step.date}` : ""}</span>
          </div>
        ))}
      </div>

      {canContinue && (
        <Link href={`/technology-discovery`}>
          <Button size="sm" variant="outline" className="w-full text-xs">
            Kaldığın Yerden Devam Et <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      )}
    </Card>
  );
}

export default function TechDiscoveryPortal() {
  useRequireCustomer();

  const { data: requests = [], isLoading } = useQuery<DiscoveryRequest[]>({
    queryKey: ["tech-discovery-my"],
    queryFn: () => fetch("/api/tech-discovery/my").then(r => r.json()),
  });

  const reqs = Array.isArray(requests) ? requests : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Technology Discovery</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Teknoloji envanteri çalışmalarınız</p>
        </div>
        <Link href="/technology-discovery">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Yeni Başlat
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reqs.length === 0 ? (
        <Card className="p-8 text-center border">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Henüz başlatılmadı</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ortamınızın teknoloji envanterini çıkarmak için Technology Discovery servisini başlatın.
          </p>
          <Link href="/technology-discovery">
            <Button>
              Hemen Başlat <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {reqs.map(req => <RequestCard key={req.id} req={req} />)}
        </div>
      )}

      <Card className="p-4 border bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Gizlilik Güvencesi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paylaştığınız teknoloji bilgileri NDA kapsamında şifreli olarak saklanır ve yalnızca hizmet sunumu amacıyla kullanılır.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
