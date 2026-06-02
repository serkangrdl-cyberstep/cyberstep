import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, ChevronDown, ChevronUp, Check, Clock,
  Loader2, RotateCcw, Users,
} from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface EnrichedStep {
  key: string;
  label: string;
  side: "customer" | "admin";
  status: string;
  completedBy: string | null;
  completedAt: string | null;
}

interface CustomerServiceRow {
  subscription: {
    id: number;
    serviceSlug: string;
    serviceLabel: string;
    status: string;
    billingCycle: string;
    expiresAt: string | null;
    email: string;
    companyName: string;
    contactName: string;
    customerId: number | null;
  };
  customer: {
    id: number;
    email: string;
    companyName: string | null;
    contactName: string | null;
  };
  steps: EnrichedStep[];
  progress: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-700",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function StepRow({
  step, customerId, serviceSlug, onToggle, isPending,
}: {
  step: EnrichedStep;
  customerId: number;
  serviceSlug: string;
  onToggle: (customerId: number, serviceSlug: string, stepKey: string, action: "done" | "pending") => void;
  isPending: boolean;
}) {
  const isDone = step.status === "done";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
      <button
        disabled={isPending}
        onClick={() => onToggle(customerId, serviceSlug, step.key, isDone ? "pending" : "done")}
        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
          isDone
            ? "bg-emerald-500/30 border-emerald-500/60 hover:bg-red-500/20 hover:border-red-500/50"
            : "border-slate-600 hover:border-sky-500/60 hover:bg-sky-500/10"
        }`}
        title={isDone ? "Tamamlandi isaretini kaldir" : "Tamamlandi olarak isaretl"}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
        ) : isDone ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : null}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isDone ? "text-slate-400 line-through" : "text-slate-200"}`}>
          {step.label}
        </span>
        {isDone && step.completedBy && (
          <span className="ml-2 text-xs text-slate-600">
            ({step.completedBy === "admin" ? "Admin" : "Musteri"} tarafindan)
          </span>
        )}
      </div>

      <Badge variant="outline" className={`text-[10px] shrink-0 ${step.side === "admin" ? "border-sky-700 text-sky-400" : "border-slate-700 text-slate-500"}`}>
        {step.side === "admin" ? "Admin" : "Musteri"}
      </Badge>
    </div>
  );
}

function SubscriptionCard({ row }: { row: CustomerServiceRow }) {
  const [expanded, setExpanded] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ customerId, serviceSlug, stepKey, action }: {
      customerId: number; serviceSlug: string; stepKey: string; action: "done" | "pending";
    }) => {
      const res = await fetch("/api/admin/customer-service-subscriptions/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, serviceSlug, stepKey, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Hata olustu");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.action === "done" ? "Adim tamamlandi" : "Adim geri alindi",
        description: `${vars.stepKey} adimi guncellendi.`,
      });
      setPendingKey(null);
      queryClient.invalidateQueries({ queryKey: ["admin-customer-services"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
      setPendingKey(null);
    },
  });

  function handleToggle(customerId: number, serviceSlug: string, stepKey: string, action: "done" | "pending") {
    setPendingKey(stepKey);
    toggleMutation.mutate({ customerId, serviceSlug, stepKey, action });
  }

  const sub = row.subscription;
  const cust = row.customer;
  const displayName = cust.companyName || cust.email || sub.email;
  const statusColor = STATUS_COLORS[sub.status] ?? STATUS_COLORS["pending"];
  const customerId = sub.customerId ?? cust.id;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="py-0">
        <button className="w-full py-4 flex items-center gap-4 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">{displayName}</span>
              <span className="text-xs text-slate-500">{cust.email || sub.email}</span>
              <Badge className={`text-[10px] border ${statusColor}`}>{sub.status}</Badge>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {sub.serviceLabel}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={row.progress} className="h-1.5 bg-slate-800 flex-1 max-w-[180px]" />
              <span className={`text-xs font-medium ${row.progress === 100 ? "text-emerald-400" : "text-slate-400"}`}>
                {row.progress}%
              </span>
              <span className="text-xs text-slate-600">
                {row.steps.filter(s => s.status === "done").length}/{row.steps.length} adim
              </span>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
        </button>

        {expanded && (
          <div className="border-t border-slate-800 pb-3 pt-2 px-1">
            <p className="text-xs text-slate-500 mb-2">
              Abone ID: {sub.id} &bull; Baslangic: {sub.billingCycle === "annual" ? "Yillik" : "Aylik"}
              {sub.expiresAt && ` · Bitis: ${new Date(sub.expiresAt).toLocaleDateString("tr-TR")}`}
            </p>
            {row.steps.map(step => (
              <StepRow
                key={step.key}
                step={step}
                customerId={customerId}
                serviceSlug={sub.serviceSlug}
                onToggle={handleToggle}
                isPending={pendingKey === step.key && toggleMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MusteriServisleriPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery<CustomerServiceRow[]>({
    queryKey: ["admin-customer-services"],
    queryFn: async () => {
      const res = await fetch("/api/admin/customer-service-subscriptions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filtered = rows.filter(row => {
    const name = (row.customer.companyName ?? row.customer.email ?? row.subscription.email ?? "").toLowerCase();
    const email = (row.customer.email ?? row.subscription.email ?? "").toLowerCase();
    const service = row.subscription.serviceLabel.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q || name.includes(q) || email.includes(q) || service.includes(q);
    const matchStatus = statusFilter === "all" || row.subscription.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalActive = rows.filter(r => r.subscription.status === "active").length;
  const totalComplete = rows.filter(r => r.progress === 100).length;
  const totalPending = rows.filter(r => r.progress < 100 && r.subscription.status === "active").length;

  return (
    <AdminLayout title="Musteri Servisleri & Onboarding">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-400" /> Musteri Servisleri & Onboarding
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Aktif servis abonelikleri ve onboarding adim durumu
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Aktif Abonelik", value: totalActive, icon: Package, color: "text-emerald-400" },
            { label: "Onboarding Tamamlandi", value: totalComplete, icon: Check, color: "text-sky-400" },
            { label: "Bekleyen Adim Var", value: totalPending, icon: Clock, color: "text-yellow-400" },
          ].map(stat => (
            <Card key={stat.label} className="bg-slate-900 border-slate-800">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Sirket, e-posta veya servis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white max-w-xs"
          />
          {["all", "active", "expired", "cancelled"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className={statusFilter === s ? "bg-sky-600 hover:bg-sky-500" : "border-slate-700 text-slate-400 hover:bg-slate-800"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tumu" : s === "active" ? "Aktif" : s === "expired" ? "Suresi Dolmus" : "Iptal Edilmis"}
            </Button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Yukleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {search || statusFilter !== "all" ? "Arama kriterleriyle eslesen abonelik yok." : "Henuz hicbir servis aboneligi yok."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{filtered.length} abonelik gosteriliyor</p>
            {filtered.map(row => (
              <SubscriptionCard key={`${row.subscription.id}`} row={row} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
