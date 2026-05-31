import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Send, FileText, Clock, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Prospect {
  id: number;
  companyName: string;
  domain: string;
  sector: string | null;
  contactName: string | null;
  assignedTo: string | null;
  status: string;
  lastActivityAt: string;
}

const COLUMNS = [
  { id: "new",         label: "Yeni",          bg: "bg-blue-900/30",    border: "border-blue-700/50" },
  { id: "scanned",     label: "Tarandı",       bg: "bg-purple-900/30",  border: "border-purple-700/50" },
  { id: "teaser_sent", label: "Teaser Gönderildi", bg: "bg-indigo-900/30", border: "border-indigo-700/50" },
  { id: "interested",  label: "İlgilendi",     bg: "bg-orange-900/30",  border: "border-orange-700/50" },
  { id: "won",         label: "Kazanıldı",     bg: "bg-green-900/30",   border: "border-green-700/50" },
  { id: "lost",        label: "Kaybedildi",    bg: "bg-red-900/30",     border: "border-red-700/50" },
];

export default function EnterprisePipelinePage() {
  const [, navigate] = useLocation();

  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["enterprise-prospects"],
    queryFn: () => fetch("/api/enterprise/prospects", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = prospects.filter(p => p.status === col.id);
    return acc;
  }, {} as Record<string, Prospect[]>);

  return (
    <AdminLayout title="Enterprise Pipeline" description="Kanban görünümü ile satış akışı">
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {COLUMNS.map(col => (
          <div key={col.id} className={`flex-shrink-0 w-64 rounded-lg ${col.bg} border ${col.border} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium text-sm">{col.label}</span>
              <span className="text-slate-400 text-xs bg-slate-800/60 rounded px-2 py-0.5">
                {grouped[col.id]?.length ?? 0}
              </span>
            </div>
            <div className="space-y-2">
              {(grouped[col.id] ?? []).map(p => (
                <Card key={p.id} className="bg-slate-800/80 border-slate-700/50 cursor-pointer hover:bg-slate-750 transition-colors"
                  onClick={() => navigate(`/panel/enterprise/prospects/${p.id}`)}>
                  <CardContent className="p-3">
                    <div className="font-medium text-white text-sm leading-tight">{p.companyName}</div>
                    <div className="text-emerald-400 text-xs mt-0.5">{p.domain}</div>
                    {p.contactName && (
                      <div className="text-slate-400 text-xs mt-1">{p.contactName}</div>
                    )}
                    {p.sector && (
                      <Badge className="mt-2 text-xs bg-slate-700 text-slate-300 border-0">{p.sector}</Badge>
                    )}
                    <div className="text-slate-500 text-xs mt-2">
                      {format(new Date(p.lastActivityAt), "d MMM", { locale: tr })}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(grouped[col.id] ?? []).length === 0 && (
                <div className="text-slate-500 text-xs text-center py-4">Boş</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
