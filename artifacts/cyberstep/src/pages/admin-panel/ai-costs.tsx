import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiCostData {
  month: { total: number; calls: number; cached: number; inputTokens: number; outputTokens: number };
  byModel: Array<{ model: string; total: number; calls: number }>;
  byCustomer: Array<{ customerId: number | null; total: number; calls: number }>;
  projectionUsd: number;
}

function usd(n: number | undefined) { return `$${Number(n ?? 0).toFixed(4)}`; }

export default function AdminAiCosts() {
  const { data } = useQuery<AiCostData>({
    queryKey: ["soc-ai-costs"],
    queryFn: () => fetch("/api/admin/soc/ai-costs", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const cacheRate = data && data.month.calls > 0 ? Math.round((data.month.cached / data.month.calls) * 100) : 0;

  const stat = (label: string, value: string, sub?: string) => (
    <Card className="bg-slate-800/40 border-slate-700">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="AI Maliyet Paneli" description="SOC triyaj ve analiz için tahmini yapay zeka kullanım maliyetleri (bu ay)">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stat("Bu Ay Toplam", usd(data?.month?.total))}
          {stat("Ay Sonu Tahmini", usd(data?.projectionUsd))}
          {stat("AI Çağrısı", String(data?.month?.calls ?? 0))}
          {stat("Önbellek Oranı", `%${cacheRate}`, `${data?.month?.cached ?? 0} önbellekten`)}
          {stat("Token (G/Ç)", `${data?.month?.inputTokens ?? 0} / ${data?.month?.outputTokens ?? 0}`)}
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-lg">Modele Göre</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!data?.byModel?.length ? (
              <p className="text-slate-400 text-sm py-8 text-center">Henüz kullanım yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left p-3">Model</th><th className="text-left p-3">Çağrı</th><th className="text-left p-3">Maliyet</th>
                  </tr></thead>
                  <tbody>
                    {data.byModel.map((m) => (
                      <tr key={m.model} className="border-b border-slate-800/60 text-slate-300">
                        <td className="p-3 font-mono text-xs">{m.model}</td>
                        <td className="p-3">{m.calls}</td>
                        <td className="p-3">{usd(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-lg">Müşteriye Göre (İlk 25)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!data?.byCustomer?.length ? (
              <p className="text-slate-400 text-sm py-8 text-center">Henüz kullanım yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left p-3">Müşteri</th><th className="text-left p-3">Çağrı</th><th className="text-left p-3">Maliyet</th>
                  </tr></thead>
                  <tbody>
                    {data.byCustomer.map((c) => (
                      <tr key={c.customerId ?? "global"} className="border-b border-slate-800/60 text-slate-300">
                        <td className="p-3">{c.customerId == null ? "Global / sistem" : `#${c.customerId}`}</td>
                        <td className="p-3">{c.calls}</td>
                        <td className="p-3">{usd(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          Maliyetler, AI istemcisi token sayısı döndürmediğinden karakter→token sezgisel dönüşümüyle tahmin edilmektedir; gerçek faturalandırmadan sapabilir.
        </p>
      </div>
    </AdminLayout>
  );
}
