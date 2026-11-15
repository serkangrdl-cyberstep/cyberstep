import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PlanOption { id: string; label: string; usdMonthly: number | null; commercialUse: boolean; note: string | null }
interface ProviderRow {
  id: string; name: string; planEnv: string; keyEnvs: string[];
  configured: boolean; usable: boolean; reason: "not_configured" | "license_restricted" | null;
  plan: string; planLabel: string; usdMonthly: number | null; commercialUse: boolean; note: string | null;
  plans: PlanOption[];
}
interface ProviderPlansResponse {
  commercialMode: boolean;
  providers: ProviderRow[];
  fixedUsdMonthly: number;
  hasQuote: boolean;
  licenseWarnings: string[];
  quotas: Record<string, { used: number; limit: number; remaining: number }>;
  ai30d: Array<{ model: string; costUsd: number; calls: number }>;
  ai30dTotalUsd: number;
  monitoredVendors: number;
  paidCustomers: number;
}

const usd = (x: number | null) => (x == null ? "teklif" : `$${x.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`);

/**
 * Ücretli sağlayıcı paketleri ve ticari mod. Paket seçimi ve COMMERCIAL_MODE,
 * API anahtarlarıyla aynı uç noktadan (settings/apikeys) kaydedilir ve hemen geçerli olur.
 */
export function ProviderPlansCard() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ProviderPlansResponse>({
    queryKey: ["admin-provider-plans"],
    queryFn: () => fetch("/api/admin-panel/provider-plans", { credentials: "include" }).then((r) => r.json()),
  });

  const save = useMutation({
    mutationFn: ({ envKey, value }: { envKey: string; value: string }) =>
      fetch("/api/admin-panel/settings/apikeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ envKey, value }),
      }).then((r) => { if (!r.ok) throw new Error("kaydedilemedi"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-plans"] });
      qc.invalidateQueries({ queryKey: ["admin-apikeys"] });
      toast({ title: "Kaydedildi", description: "Yeni ayar bir sonraki taramadan itibaren geçerli." });
    },
    onError: () => toast({ title: "Hata", description: "Ayar kaydedilemedi.", variant: "destructive" }),
  });

  if (isLoading || !data || !Array.isArray(data.providers)) {
    return <Card className="bg-slate-800 border-slate-700"><CardContent className="p-4 text-sm text-slate-400">Paket bilgileri yükleniyor…</CardContent></Card>;
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-semibold">Ücretli paketler ve ticari mod</h2>
            <p className="text-slate-400 text-xs mt-1">
              Paket seçimi günlük kotaları ve lisans kurallarını belirler. Ticari mod açıkken ücretsiz lisansı ticari kullanıma izin vermeyen kaynaklar (VirusTotal Public, Safe Browsing) taramada kullanılmaz.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={data.commercialMode}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ envKey: "COMMERCIAL_MODE", value: e.target.checked ? "true" : "" })}
            />
            Ticari mod (ücretli müşteri var)
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg border border-slate-700 p-3">
            <p className="text-xl font-bold text-white tabular-nums">{usd(data.fixedUsdMonthly)}{data.hasQuote ? " +" : ""}</p>
            <p className="text-slate-400 text-xs">Sabit veri maliyeti / ay</p>
          </div>
          <div className="rounded-lg border border-slate-700 p-3">
            <p className="text-xl font-bold text-white tabular-nums">{usd(data.ai30dTotalUsd)}</p>
            <p className="text-slate-400 text-xs">AI, son 30 gün</p>
          </div>
          <div className="rounded-lg border border-slate-700 p-3">
            <p className="text-xl font-bold text-white tabular-nums">{data.monitoredVendors.toLocaleString("tr-TR")}</p>
            <p className="text-slate-400 text-xs">İzlenen tedarikçi</p>
          </div>
          <div className="rounded-lg border border-slate-700 p-3">
            <p className="text-xl font-bold text-white tabular-nums">{data.paidCustomers.toLocaleString("tr-TR")}</p>
            <p className="text-slate-400 text-xs">Ücretli TPRM müşterisi</p>
          </div>
        </div>

        {data.licenseWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 space-y-1">
            {data.licenseWarnings.map((w) => <p key={w}>{w}</p>)}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-slate-400 text-xs text-left border-b border-slate-700">
                <th className="py-2 pr-2 font-medium">Sağlayıcı</th>
                <th className="py-2 pr-2 font-medium">Paket</th>
                <th className="py-2 pr-2 font-medium">Durum</th>
                <th className="py-2 pr-2 font-medium">Bugünkü kota</th>
                <th className="py-2 font-medium text-right">USD/ay</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => {
                const q = data.quotas?.[p.id];
                return (
                  <tr key={p.id} className="border-b border-slate-700/60 align-top">
                    <td className="py-2 pr-2">
                      <p className="text-slate-100 font-medium">{p.name}</p>
                      <p className="text-slate-500 text-xs">{p.keyEnvs.join(" + ")}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        aria-label={`${p.name} paketi`}
                        className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-slate-100 text-sm"
                        value={p.plan}
                        disabled={save.isPending || p.plans.length < 2}
                        onChange={(e) => save.mutate({ envKey: p.planEnv, value: e.target.value })}
                      >
                        {p.plans.map((o) => (
                          <option key={o.id} value={o.id}>{o.label} · {usd(o.usdMonthly)}</option>
                        ))}
                      </select>
                      {p.note && <p className="text-slate-500 text-xs mt-1">{p.note}</p>}
                    </td>
                    <td className="py-2 pr-2">
                      {p.usable ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-600/40">Aktif</Badge>
                      ) : p.reason === "license_restricted" ? (
                        <Badge className="bg-amber-500/15 text-amber-300 border border-amber-600/40">Lisans kısıtlı</Badge>
                      ) : (
                        <Badge className="bg-slate-700 text-slate-300 border border-slate-600">Key yok</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-slate-300 tabular-nums">{q ? `${q.used.toLocaleString("tr-TR")} / ${q.limit.toLocaleString("tr-TR")}` : "—"}</td>
                    <td className="py-2 text-right text-slate-100 tabular-nums">{p.configured ? usd(p.usdMonthly) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.ai30d.length > 0 && (
          <div className="text-xs text-slate-400">
            <p className="mb-1">AI harcaması, son 30 gün (ai_cost_log):</p>
            <div className="flex flex-wrap gap-2">
              {data.ai30d.slice(0, 6).map((m) => (
                <span key={m.model} className="rounded-md border border-slate-700 px-2 py-1 tabular-nums">{m.model}: {usd(m.costUsd)} · {m.calls.toLocaleString("tr-TR")} çağrı</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
