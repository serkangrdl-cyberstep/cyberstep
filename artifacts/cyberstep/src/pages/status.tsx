import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, AlertOctagon, XCircle, Clock } from "lucide-react";

interface ServiceHealth {
  id: number;
  serviceName: string;
  displayName: string;
  currentStatus: string;
  uptime30d: string;
  lastCheckedAt: string;
}

interface Incident {
  id: number;
  title: string;
  description: string;
  severity: string;
  affectedServices: string[];
  status: string;
  startedAt: string;
  resolvedAt: string | null;
}

interface StatusData {
  services: ServiceHealth[];
  activeIncidents: Incident[];
  recentIncidents: Incident[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle; bg: string }> = {
  operational:    { label: "Çalışıyor",        color: "text-emerald-400", icon: CheckCircle,  bg: "bg-emerald-500" },
  degraded:       { label: "Yavaşlamış",       color: "text-yellow-400",  icon: AlertTriangle, bg: "bg-yellow-500" },
  partial_outage: { label: "Kısmi Kesinti",    color: "text-orange-400",  icon: AlertOctagon,  bg: "bg-orange-500" },
  major_outage:   { label: "Büyük Kesinti",    color: "text-red-400",     icon: XCircle,       bg: "bg-red-500" },
};

const SEVERITY_COLOR: Record<string, string> = {
  minor:    "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  major:    "text-orange-400 border-orange-400/30 bg-orange-400/5",
  critical: "text-red-400 border-red-400/30 bg-red-400/5",
};

const INCIDENT_STATUS: Record<string, string> = {
  investigating: "İnceleniyor",
  identified:    "Tespit Edildi",
  monitoring:    "İzleniyor",
  resolved:      "Çözüldü",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function StatusPage() {
  const { data, isLoading } = useQuery<StatusData>({
    queryKey: ["public-status"],
    queryFn: () => fetch("/api/public/status").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const allOperational = data?.services.every(s => s.currentStatus === "operational") && data.activeIncidents.length === 0;

  return (
    <div className="min-h-screen bg-secondary text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="container mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-white">CyberStep</span>
              <span className="text-slate-400 ml-1 text-sm">Sistem Durumu</span>
            </div>
          </div>
          <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">Ana Sayfa</a>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        {/* Overall status banner */}
        {!isLoading && (
          <div className={`rounded-2xl p-6 border ${allOperational ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <div className="flex items-center gap-3">
              {allOperational
                ? <CheckCircle className="h-8 w-8 text-emerald-400" />
                : <AlertOctagon className="h-8 w-8 text-red-400" />
              }
              <div>
                <p className={`text-xl font-bold ${allOperational ? "text-emerald-400" : "text-red-400"}`}>
                  {allOperational ? "Tüm Sistemler Çalışıyor" : "Aktif Kesinti Var"}
                </p>
                <p className="text-slate-400 text-sm">Son güncelleme: {new Date().toLocaleTimeString("tr-TR")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Active incidents */}
        {data && data.activeIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Aktif Olaylar</h2>
            {data.activeIncidents.map(inc => (
              <div key={inc.id} className={`rounded-xl border p-4 ${SEVERITY_COLOR[inc.severity] ?? SEVERITY_COLOR["minor"]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{inc.title}</p>
                    {inc.description && <p className="text-sm text-slate-300 mt-1">{inc.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span><Clock className="h-3 w-3 inline mr-1" />{formatDate(inc.startedAt)}</span>
                      <span>Durum: {INCIDENT_STATUS[inc.status] ?? inc.status}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full border font-medium shrink-0" style={{ borderColor: "currentColor" }}>
                    {inc.severity === "minor" ? "Küçük" : inc.severity === "major" ? "Büyük" : "Kritik"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Services */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Servis Durumu</h2>
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/50 overflow-hidden">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-40" />
                    <div className="h-4 bg-slate-700 rounded w-24" />
                  </div>
                ))
              : data?.services.map(svc => {
                  const cfg = STATUS_CONFIG[svc.currentStatus] ?? STATUS_CONFIG["operational"]!;
                  const Icon = cfg.icon;
                  return (
                    <div key={svc.id} className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                        <span className="font-medium">{svc.displayName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400 hidden sm:block">
                          {parseFloat(svc.uptime30d).toFixed(2)}% uptime
                        </span>
                        <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Recent incidents history */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Olay Geçmişi</h2>
          {!data || data.recentIncidents.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-5 py-8 text-center text-slate-400">
              Son 30 günde olay kaydı bulunmuyor.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/50 overflow-hidden">
              {data.recentIncidents.map(inc => (
                <div key={inc.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full inline-block ${inc.resolvedAt ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="font-medium text-sm">{inc.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(inc.startedAt)}</p>
                    </div>
                    <span className={`text-xs shrink-0 ${inc.resolvedAt ? "text-emerald-400" : "text-yellow-400"}`}>
                      {inc.resolvedAt ? "Çözüldü" : INCIDENT_STATUS[inc.status] ?? inc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          CyberStep.io — Sistem durumu sayfası. Sorularınız için <a href="/iletisim" className="text-primary hover:underline">iletişime geçin</a>.
        </p>
      </div>
    </div>
  );
}
