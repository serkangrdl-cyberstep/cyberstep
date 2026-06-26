import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReputationSummary {
  total_checked: number;
  blacklisted_count: number;
  blacklist_critical_count: number;
  ssl_expiring_soon: number;
  ssl_critical: number;
  ssl_invalid: number;
  poor_mail_reputation: number;
  unchecked_count: number;
  last_run_at: string | null;
}

interface AlertRow {
  domain: string;
  blacklist_score: number | null;
  ssl_days_remaining: number | null;
  ssl_is_valid: boolean | null;
  ssl_issuer: string | null;
  mail_reputation_score: number | null;
  mail_spf_valid: boolean | null;
  mail_dmarc_valid: boolean | null;
  blacklist_hits: unknown;
  blacklist_checked_at: string | null;
}

type FilterType = "all" | "blacklist" | "ssl" | "mail";

function scoreBadge(score: number | null, criticalThreshold: number, warnThreshold: number) {
  if (score === null) return <span className="text-slate-600 text-xs">—</span>;
  const cls =
    score < criticalThreshold ? "bg-red-900/40 text-red-400 border-red-800" :
    score < warnThreshold     ? "bg-amber-900/40 text-amber-400 border-amber-800" :
                                "bg-green-900/40 text-green-400 border-green-800";
  return (
    <span className={`text-[11px] font-bold border rounded px-1.5 py-0.5 ${cls}`}>{score}</span>
  );
}

function sslBadge(isValid: boolean | null, daysRemaining: number | null) {
  if (isValid === null && daysRemaining === null)
    return <span className="text-slate-600 text-xs">—</span>;
  if (isValid === false)
    return <span className="text-[11px] font-bold border rounded px-1.5 py-0.5 bg-red-900/40 text-red-400 border-red-800">Gecersiz</span>;
  if (daysRemaining !== null && daysRemaining <= 7)
    return <span className="text-[11px] font-bold border rounded px-1.5 py-0.5 bg-red-900/40 text-red-400 border-red-800">{daysRemaining} gun</span>;
  if (daysRemaining !== null && daysRemaining <= 30)
    return <span className="text-[11px] font-bold border rounded px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border-amber-800">{daysRemaining} gun</span>;
  return <span className="text-[11px] border rounded px-1.5 py-0.5 bg-green-900/40 text-green-400 border-green-800">{daysRemaining ?? "OK"} gun</span>;
}

export default function AdminReputationMonitor() {
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetch("/api/admin-panel/reputation/summary").then(r => r.json()),
        fetch("/api/admin-panel/reputation/alerts").then(r => r.json()),
      ]);
      setSummary(s);
      setAlerts(Array.isArray(a) ? a : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRunNow() {
    setRunning(true);
    try {
      await fetch("/api/admin-panel/reputation/run-now", { method: "POST" });
      setTimeout(() => { void load(); setRunning(false); }, 3000);
    } catch {
      setRunning(false);
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === "blacklist") return (a.blacklist_score ?? 100) < 100;
    if (filter === "ssl")       return a.ssl_is_valid === false || (a.ssl_days_remaining ?? 999) <= 30;
    if (filter === "mail")      return (a.mail_reputation_score ?? 100) < 50;
    return true;
  });

  const CARDS = [
    {
      label: "Kontrol Edildi",
      value: summary?.total_checked ?? 0,
      sub: `${summary?.unchecked_count ?? 0} bekliyor`,
      color: "text-[#00C8FF]",
    },
    {
      label: "Kara Liste Sorunu",
      value: summary?.blacklist_critical_count ?? 0,
      sub: `${summary?.blacklisted_count ?? 0} total listede`,
      color: "text-red-400",
    },
    {
      label: "SSL Kritik",
      value: summary?.ssl_critical ?? 0,
      sub: `${summary?.ssl_expiring_soon ?? 0} yaklasan`,
      color: "text-amber-400",
    },
    {
      label: "Zayif Mail",
      value: summary?.poor_mail_reputation ?? 0,
      sub: "SPF/DMARC/DKIM/MX < 50",
      color: "text-orange-400",
    },
  ];

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",       label: `Tumu (${alerts.length})` },
    { key: "blacklist", label: `Kara Liste (${alerts.filter(a => (a.blacklist_score ?? 100) < 100).length})` },
    { key: "ssl",       label: `SSL (${alerts.filter(a => a.ssl_is_valid === false || (a.ssl_days_remaining ?? 999) <= 30).length})` },
    { key: "mail",      label: `Mail (${alerts.filter(a => (a.mail_reputation_score ?? 100) < 50).length})` },
  ];

  return (
    <AdminLayout title="Reputation Monitor">
      <div className="p-6 space-y-6" style={{ background: "#060D1A", minHeight: "100vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Reputation Monitor</h1>
            <p className="text-slate-400 text-sm mt-1">
              Kara liste, SSL sertifika ve mail reputation izleme
              {summary?.last_run_at && (
                <span className="ml-2 text-slate-600">
                  — Son calistirma: {new Date(summary.last_run_at).toLocaleString("tr-TR")}
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={handleRunNow}
            disabled={running}
            className="bg-[#00C8FF]/10 border border-[#00C8FF]/30 text-[#00C8FF] hover:bg-[#00C8FF]/20"
          >
            {running ? "Calistiriliyor..." : "Manuel Kontrol"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map(card => (
            <Card key={card.label} style={{ background: "#071828", border: "1px solid #0f2940" }}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-slate-400 font-normal uppercase tracking-wide">{card.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-bold ${card.color}`}>
                  {loading ? "..." : card.value}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{card.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts Table */}
        <Card style={{ background: "#071828", border: "1px solid #0f2940" }}>
          <CardHeader className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Uyari Listesi</CardTitle>
              <div className="flex gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      filter === f.key
                        ? "bg-[#00C8FF]/10 border-[#00C8FF]/40 text-[#00C8FF]"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Yukleniyor...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Sorun tespit edilmedi</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 pl-6">Domain</TableHead>
                    <TableHead className="text-slate-400 text-center">Kara Liste</TableHead>
                    <TableHead className="text-slate-400 text-center">SSL</TableHead>
                    <TableHead className="text-slate-400 text-center">Mail</TableHead>
                    <TableHead className="text-slate-400">SSL Saglayici</TableHead>
                    <TableHead className="text-slate-400 pr-6">Son Kontrol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.domain} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="pl-6 py-3">
                        <span className="font-mono text-sm text-slate-200">{row.domain}</span>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          {(row.blacklist_score ?? 100) < 50 && (
                            <Badge className="text-[9px] py-0 px-1 bg-red-900/40 text-red-400 border-red-800">Kritik</Badge>
                          )}
                          {row.ssl_is_valid === false && (
                            <Badge className="text-[9px] py-0 px-1 bg-red-900/40 text-red-400 border-red-800">SSL Gecersiz</Badge>
                          )}
                          {(row.ssl_days_remaining ?? 999) <= 7 && row.ssl_is_valid !== false && (
                            <Badge className="text-[9px] py-0 px-1 bg-red-900/40 text-red-400 border-red-800">SSL Kritik</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {scoreBadge(row.blacklist_score, 50, 100)}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {sslBadge(row.ssl_is_valid, row.ssl_days_remaining)}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {scoreBadge(row.mail_reputation_score, 50, 75)}
                        {row.mail_reputation_score !== null && (
                          <div className="text-[9px] text-slate-600 mt-0.5">
                            {[row.mail_spf_valid && "SPF", row.mail_dmarc_valid && "DMARC"].filter(Boolean).join(" ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-[11px] text-slate-500">{row.ssl_issuer ?? "—"}</span>
                      </TableCell>
                      <TableCell className="pr-6 py-3">
                        <span className="text-[11px] text-slate-600">
                          {row.blacklist_checked_at
                            ? new Date(row.blacklist_checked_at).toLocaleDateString("tr-TR")
                            : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
