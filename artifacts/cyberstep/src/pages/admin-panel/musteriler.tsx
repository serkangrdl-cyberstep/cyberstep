import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CheckCircle2, ShieldCheck, TrendingUp,
  Search, ChevronDown, CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  email: string;
  fullName: string;
  companyName: string | null;
  totpEnabled: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  assessmentCount: number;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  trial: number;
  totpEnabled: number;
}

const STATUS_LABELS: Record<string, string> = {
  active:   "Aktif",
  inactive: "Pasif",
  trial:    "Deneme",
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-slate-700 text-slate-400 border-slate-600",
  trial:    "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const PLANS = ["free", "starter", "pro", "enterprise"];
const STATUSES = ["active", "inactive", "trial"];

function EditRow({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [plan, setPlan] = useState(customer.subscriptionPlan ?? "");
  const [status, setStatus] = useState(customer.subscriptionStatus);

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin-panel/customers/${customer.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionPlan: plan || null, subscriptionStatus: status }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer-stats"] });
      toast({ title: "Kaydedildi", description: "Müşteri aboneliği güncellendi." });
      onClose();
    },
    onError: () => toast({ title: "Hata", description: "Kaydetme başarısız.", variant: "destructive" }),
  });

  return (
    <div className="mt-3 pt-3 border-t border-slate-700 flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Plan</label>
        <select
          value={plan}
          onChange={e => setPlan(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Ücretsiz</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Durum</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" onClick={onClose}>
        Vazgeç
      </Button>
    </div>
  );
}

export default function AdminMusteriler() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin-customer-stats"],
    queryFn: () => fetch("/api/admin-panel/customers/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["admin-customers"],
    queryFn: () => fetch("/api/admin-panel/customers", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = customers.filter(c =>
    !search ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (c.companyName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Müşteri Yönetimi" description="Kayıtlı müşteriler ve abonelik yönetimi">
      <div className="space-y-6 max-w-6xl">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Toplam Müşteri", value: stats?.total ?? 0, Icon: Users, color: "text-white" },
            { label: "Aktif Abonelik", value: stats?.active ?? 0, Icon: CreditCard, color: "text-emerald-400" },
            { label: "Deneme Süresi", value: stats?.trial ?? 0, Icon: TrendingUp, color: "text-amber-400" },
            { label: "2FA Aktif", value: stats?.totpEnabled ?? 0, Icon: ShieldCheck, color: "text-sky-400" },
          ].map(({ label, value, Icon, color }) => (
            <Card key={label} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color} shrink-0`} />
                <div>
                  <p className="text-slate-400 text-xs">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="İsim, e-posta veya şirket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Müşteri</th>
                  <th className="px-4 py-3 text-left">E-posta</th>
                  <th className="px-4 py-3 text-center">2FA</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Durum</th>
                  <th className="px-4 py-3 text-center">Değer.</th>
                  <th className="px-4 py-3 text-left">Kayıt Tarihi</th>
                  <th className="px-4 py-3 text-center">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Müşteri bulunamadı</td></tr>
                )}
                {filtered.map(c => (
                  <>
                    <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{c.fullName}</p>
                        {c.companyName && <p className="text-slate-500 text-xs">{c.companyName}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{c.email}</td>
                      <td className="px-4 py-3 text-center">
                        {c.totpEnabled
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                          : <span className="text-slate-600 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-xs">{c.subscriptionPlan ?? "Ücretsiz"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[c.subscriptionStatus] ?? STATUS_COLORS.inactive}`}>
                          {STATUS_LABELS[c.subscriptionStatus] ?? c.subscriptionStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">{c.assessmentCount}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString("tr-TR")}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <a href={`/panel/musteriler/${c.id}`}>
                            <Button size="sm" variant="outline" className="border-cyan-600/40 text-cyan-300 hover:bg-cyan-500/10 h-7 px-2 text-xs">
                              360
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700 h-7 px-2 text-xs"
                            onClick={() => setEditing(editing === c.id ? null : c.id)}
                          >
                            <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${editing === c.id ? "rotate-180" : ""}`} />
                            Plan
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {editing === c.id && (
                      <tr key={`${c.id}-edit`} className="bg-slate-900/50">
                        <td colSpan={8} className="px-6 pb-4">
                          <EditRow customer={c} onClose={() => setEditing(null)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
