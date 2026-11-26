import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface DemoReport {
  id: number;
  reportType: string;
  demoDomain: string | null;
  demoCompany: string | null;
  demoSector: string | null;
  pdfUrl: string | null;
  displayScore: number | null;
  isActive: boolean;
  downloadCount: number;
  leadCaptures: number;
  generatedAt: string;
}

interface DemoLead {
  id: number;
  reportType: string | null;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string;
}

const REPORT_LABELS: Record<string, string> = {
  easm: "EASM",
  email_security: "E-posta Guvenlik",
  board_report: "Yonetim Kurulu",
  cve_alert: "CVE Alarm",
  tprm: "Tedarikci Risk",
  threat_intel: "Tehdit Istihbarati",
};


async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function DemoRaporlar() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"reports" | "leads">("reports");
  const [msg, setMsg] = useState("");
  const [refreshingAll, setRefreshingAll] = useState(false);

  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ["digest-demo-reports"],
    queryFn: () => adminFetch("/api/admin/demo-reports"),
  });

  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ["digest-demo-leads"],
    queryFn: () => adminFetch("/api/admin/demo-leads"),
  });

  const reports: DemoReport[] = (reportsData as { reports?: DemoReport[] })?.reports ?? [];
  const leads: DemoLead[] = (leadsData as { leads?: DemoLead[] })?.leads ?? [];
  const leadsTotal: number = (leadsData as { total?: number })?.total ?? 0;
  const leadsWithCompany: number = (leadsData as { withCompany?: number })?.withCompany ?? 0;

  const toggleMut = useMutation({
    mutationFn: (type: string) => adminFetch(`/api/admin/demo-reports/${type}/toggle`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-demo-reports"] }); setMsg("Guncellendi."); },
    onError: () => setMsg("Hata olustu."),
  });

  const refreshOneMut = useMutation({
    mutationFn: (type: string) => adminFetch(`/api/admin/demo-reports/${type}/refresh`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-demo-reports"] }); setMsg("Rapor yenileniyor..."); },
    onError: () => setMsg("Hata olustu."),
  });

  const refreshAll = async () => {
    setRefreshingAll(true);
    try {
      await adminFetch("/api/admin/demo-reports/refresh", { method: "POST" });
      qc.invalidateQueries({ queryKey: ["digest-demo-reports"] });
      setMsg("Tum raporlar yenileniyor...");
    } catch {
      setMsg("Hata olustu.");
    } finally { setRefreshingAll(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Demo Raporlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Potansiyel musterilere gosterilen demo raporlar ve lead kayitlari.
          </p>
        </div>
        <button onClick={refreshAll} disabled={refreshingAll}
          className="text-xs px-3 py-2 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
          {refreshingAll ? "Yenileniyor..." : "Tümünü Yenile"}
        </button>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {msg} <button onClick={() => setMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      <div className="flex gap-2">
        {(["reports", "leads"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}>
            {t === "reports" ? `Demo Raporlar (${reports.length})` : `Lead Kayitlari (${leadsTotal})`}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <div className="space-y-3">
          {loadingReports ? (
            <p className="text-sm text-muted-foreground">Yukleniyor...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rapor yok.</p>
          ) : (
            reports.map(r => (
              <div key={r.id} className="border border-border rounded-xl bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {r.isActive ? "Aktif" : "Pasif"}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{REPORT_LABELS[r.reportType] ?? r.reportType}</span>
                    </div>
                    {r.demoCompany && <p className="font-semibold text-foreground text-sm">{r.demoCompany}</p>}
                    {r.demoDomain && <p className="text-xs text-muted-foreground">{r.demoDomain}</p>}
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Indirme: {r.downloadCount}</span>
                      <span>Lead: {r.leadCaptures}</span>
                      {r.displayScore !== null && <span>Skor: {r.displayScore}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(r.generatedAt), "d MMM yyyy HH:mm", { locale: tr })}
                    </p>
                  </div>
                  {r.pdfUrl && (
                    <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                      PDF
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => toggleMut.mutate(r.reportType)} disabled={toggleMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
                    {r.isActive ? "Pasife Al" : "Aktive Et"}
                  </button>
                  <button onClick={() => refreshOneMut.mutate(r.reportType)} disabled={refreshOneMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
                    Yenile
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "leads" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded-xl bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Toplam Lead</p>
              <p className="text-2xl font-bold text-foreground">{leadsTotal}</p>
            </div>
            <div className="border border-border rounded-xl bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Sirket Bildirdi</p>
              <p className="text-2xl font-bold text-foreground">{leadsWithCompany}</p>
            </div>
          </div>
          {loadingLeads ? (
            <p className="text-sm text-muted-foreground">Yukleniyor...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lead yok.</p>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => (
                <div key={lead.id} className="border border-border rounded-xl bg-card px-4 py-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground text-sm">{lead.name ?? "(Isimsiz)"}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                    {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                    {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{REPORT_LABELS[lead.reportType ?? ""] ?? (lead.reportType ?? "")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(lead.createdAt), "d MMM yyyy", { locale: tr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
