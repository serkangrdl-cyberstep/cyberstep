import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, ChevronDown, ChevronUp, Check, Clock,
  Loader2, Users, Eye, EyeOff, Settings, X, ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const SECRET_FIELD_PATTERNS = ["password", "token", "key", "secret", "credential"];
function isSecretField(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_FIELD_PATTERNS.some((p) => lower.includes(p));
}

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
  configMigrationStatus: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-700",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

// ─── Config Modal ─────────────────────────────────────────────────────────────

interface ConfigModalProps {
  customerId: number;
  serviceSlug: string;
  serviceLabel: string;
  companyName: string;
  onClose: () => void;
}

function ConfigModal({ customerId, serviceSlug, serviceLabel, companyName, onClose }: ConfigModalProps) {
  const { toast } = useToast();
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [decryptedConfig, setDecryptedConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/customer-service-config/${customerId}/${serviceSlug}/decrypt`,
        { method: "POST", credentials: "include" }
      );
      if (res.status === 404) {
        toast({ title: "Yapılandırma bulunamadı", description: "Bu müşteri için kayıtlı yapılandırma yok.", variant: "destructive" });
        onClose();
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Sunucu hatası");
      }
      const data = await res.json() as { config: Record<string, unknown> };
      setDecryptedConfig(data.config);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast({ title: "Hata", description: msg, variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => { void loadConfig(); }, []);

  function toggleReveal(key: string) {
    setRevealedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const entries = decryptedConfig ? Object.entries(decryptedConfig) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-400" />
              Servis Yapılandırması
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {companyName} &bull; {serviceLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Yapılandırma yükleniyor...</span>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Kayıtlı yapılandırma alanı yok.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                Bu veriler sunucuda denetim kaydına yazılmıştır. Gizli alanları yalnızca gerektiğinde görüntüleyin.
              </p>
              {entries.map(([key, value]) => {
                const secret = isSecretField(key);
                const revealed = revealedFields.has(key);
                const displayVal = secret && !revealed ? "••••••••••••" : String(value ?? "");
                return (
                  <div key={key} className="bg-slate-800 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 font-mono mb-1 flex items-center gap-1.5">
                          {key}
                          {secret && (
                            <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-400 py-0 px-1">
                              gizli
                            </Badge>
                          )}
                        </p>
                        <p className={`text-sm font-mono break-all ${secret && !revealed ? "text-slate-600 tracking-widest" : "text-slate-200"}`}>
                          {displayVal}
                        </p>
                      </div>
                      {secret && (
                        <button
                          onClick={() => toggleReveal(key)}
                          className="shrink-0 text-slate-500 hover:text-sky-400 transition-colors"
                          title={revealed ? "Gizle" : "Göster"}
                        >
                          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-400 hover:bg-slate-800" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

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

// ─── Subscription Card ────────────────────────────────────────────────────────

function SubscriptionCard({ row }: { row: CustomerServiceRow }) {
  const [expanded, setExpanded] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
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
  const hasDecryptError = row.configMigrationStatus === "decrypt_error";

  return (
    <>
      {showConfigModal && (
        <ConfigModal
          customerId={customerId}
          serviceSlug={sub.serviceSlug}
          serviceLabel={sub.serviceLabel}
          companyName={displayName}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      <Card className={`bg-slate-900 ${hasDecryptError ? "border-red-700/60" : "border-slate-800"}`}>
        <CardContent className="py-0">
          <div className="py-4 flex items-center gap-4">
            <button className="flex-1 flex items-center gap-4 text-left min-w-0" onClick={() => setExpanded(!expanded)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{displayName}</span>
                  <span className="text-xs text-slate-500">{cust.email || sub.email}</span>
                  <Badge className={`text-[10px] border ${statusColor}`}>{sub.status}</Badge>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    {sub.serviceLabel}
                  </Badge>
                  {hasDecryptError && (
                    <Badge className="text-[10px] border bg-red-500/15 text-red-400 border-red-600/50 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Sifre cozme hatasi
                    </Badge>
                  )}
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

            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-slate-700 text-slate-400 hover:border-sky-600 hover:text-sky-400 hover:bg-sky-500/10 gap-1.5 text-xs"
              onClick={() => setShowConfigModal(true)}
              title="Servis yapılandırmasını görüntüle"
            >
              <Settings className="w-3.5 h-3.5" />
              Yapılandırma
            </Button>
          </div>

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
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
