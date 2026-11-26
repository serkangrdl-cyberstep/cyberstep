import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { STAGES, stageOf, SOURCE_LABELS } from "@/lib/pipeline-stages";

interface Prospect {
  id: number;
  companyName: string;
  domain: string;
  sector: string | null;
  contactName: string | null;
  assignedTo: string | null;
  source: string | null;
  supplierCount: number | null;
  status: string;
  lastActivityAt: string;
}

export default function EnterprisePipelinePage() {
  const qc = useQueryClient();
  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["enterprise-prospects"],
    queryFn: () => fetch("/api/enterprise/prospects", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/enterprise/prospects/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise-prospects"] }),
  });

  const grouped: Record<string, Prospect[]> = {};
  for (const s of STAGES) grouped[s.id] = [];
  for (const p of prospects) grouped[stageOf(p.status)]!.push(p);

  return (
    <AdminLayout title="Satış Hattı (TPRM)" description="Aday → arama → pilot → teklif → sözleşme">
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {STAGES.map(col => (
          <div key={col.id} className={`flex-shrink-0 w-64 rounded-lg ${col.bg} border ${col.border} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium text-sm">{col.label}</span>
              <span className="text-slate-400 text-xs bg-slate-800/60 rounded px-2 py-0.5">{grouped[col.id]!.length}</span>
            </div>
            <div className="space-y-2">
              {grouped[col.id]!.map(p => (
                <Card key={p.id} className="bg-slate-800/80 border-slate-700/50">
                  <CardContent className="p-3">
                    <div className="font-medium text-white text-sm leading-tight">{p.companyName}</div>
                    {p.domain && <div className="text-emerald-400 text-xs mt-0.5">{p.domain}</div>}
                    {p.contactName && <div className="text-slate-400 text-xs mt-1">{p.contactName}</div>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.source && <Badge className="text-xs bg-slate-700 text-slate-300 border-0">{SOURCE_LABELS[p.source] ?? p.source}</Badge>}
                      {p.supplierCount ? <Badge className="text-xs bg-slate-700 text-slate-300 border-0">{p.supplierCount} tedarikçi</Badge> : null}
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-slate-500 text-xs">{format(new Date(p.lastActivityAt), "d MMM", { locale: tr })}</span>
                      <select
                        value={stageOf(p.status)}
                        onChange={e => move.mutate({ id: p.id, status: e.target.value })}
                        className="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-1 py-0.5"
                        aria-label="Aşama"
                      >
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {grouped[col.id]!.length === 0 && <div className="text-slate-500 text-xs text-center py-4">Boş</div>}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
