import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BrandSummary {
  total_variants_tracked: number;
  suspicious_count: number;
  active_count: number;
  customers_monitored: number;
  last_run_at: string | null;
}

interface AlertRow {
  customer_domain: string;
  variant_domain: string;
  variant_type: string;
  is_suspicious: boolean;
  http_status: number | null;
  page_title: string | null;
  ip_address: string | null;
  first_detected: string;
  customer_name: string | null;
}

type FilterType = "all" | "suspicious" | "active" | "tld_swap";

const VARIANT_TYPE_TR: Record<string, string> = {
  tld_swap:       "TLD Degisimi",
  char_swap:      "Karakter Hatasi",
  char_double:    "Cift Karakter",
  char_omit:      "Eksik Karakter",
  hyphen_insert:  "Tire Ekleme",
  hyphen_remove:  "Tire Cikarma",
  prefix_suffix:  "Prefix/Suffix",
  homoglyph:      "Gorsel Benzer",
};

function statusBadge(row: AlertRow) {
  if (row.is_suspicious) {
    return (
      <span className="text-[11px] font-bold border rounded px-1.5 py-0.5 bg-red-900/40 text-red-400 border-red-800">
        Suphelı
      </span>
    );
  }
  if (row.http_status !== null) {
    return (
      <span className="text-[11px] font-bold border rounded px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border-amber-800">
        Aktif
      </span>
    );
  }
  return (
    <span className="text-[11px] border rounded px-1.5 py-0.5 bg-green-900/40 text-green-400 border-green-800">
      Pasif
    </span>
  );
}

export default function AdminBrandMonitor() {
  const [summary, setSummary]   = useState<BrandSummary | null>(null);
  const [alerts, setAlerts]     = useState<AlertRow[]>([]);
  const [filter, setFilter]     = useState<FilterType>("all");
  const [running, setRunning]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetch("/api/admin-panel/brand-monitor/summary").then(r => r.json()),
        fetch("/api/admin-panel/brand-monitor/alerts").then(r => r.json()),
      ]);
      setSummary(s as BrandSummary);
      setAlerts(Array.isArray(a) ? (a as AlertRow[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRunNow() {
    setRunning(true);
    try {
      await fetch("/api/admin-panel/brand-monitor/run-now", { method: "POST" });
      setToast("Tarama baslatildi — birkaç dakika sonra sonuclari yenileyin.");
      setTimeout(() => { void load(); setRunning(false); setToast(null); }, 8000);
    } catch {
      setRunning(false);
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === "suspicious") return a.is_suspicious;
    if (filter === "active")     return a.http_status !== null;
    if (filter === "tld_swap")   return a.variant_type === "tld_swap";
    return true;
  });

  const CARDS = [
    {
      label: "Takip Edilen",
      value: summary?.total_variants_tracked ?? 0,
      sub:   `${summary?.customers_monitored ?? 0} musteri izleniyor`,
      color: "text-[#00C8FF]",
    },
    {
      label: "Aktif Domain",
      value: summary?.active_count ?? 0,
      sub:   `${alerts.filter(a => a.variant_type === "tld_swap" && a.http_status !== null).length} aktif TLD swap`,
      color: "text-[#F5A623]",
    },
    {
      label: "Suphelı Domain",
      value: summary?.suspicious_count ?? 0,
      sub:   summary?.last_run_at
        ? `Son tespit: ${new Date(summary.last_run_at).toLocaleDateString("tr-TR")}`
        : "Henuz tarama yapilmadi",
      color: "text-red-400",
    },
  ];

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",       label: `Tumu (${alerts.length})` },
    { key: "suspicious",label: `Suphelı (${alerts.filter(a => a.is_suspicious).length})` },
    { key: "active",    label: `Aktif (${alerts.filter(a => a.http_status !== null).length})` },
    { key: "tld_swap",  label: `TLD Swap (${alerts.filter(a => a.variant_type === "tld_swap").length})` },
  ];

  return (
    <AdminLayout title="Marka Koruma">
      <div className="p-6 space-y-6" style={{ background: "#060D1A", minHeight: "100vh" }}>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#071828] border border-[#00C8FF]/30 text-[#00C8FF] text-sm px-4 py-3 rounded shadow-lg">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Marka Koruma</h1>
            <p className="text-slate-400 text-sm mt-1">
              Taklit ve typosquatting domain taramasi
              {summary?.last_run_at && (
                <span className="ml-2 text-slate-600">
                  — Son tarama: {new Date(summary.last_run_at).toLocaleString("tr-TR")}
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={() => void handleRunNow()}
            disabled={running}
            className="bg-[#00C8FF]/10 border border-[#00C8FF]/30 text-[#00C8FF] hover:bg-[#00C8FF]/20"
          >
            {running ? "Calistiriliyor..." : "Tarama Calistir"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              <div className="flex gap-2 flex-wrap">
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
              <div className="text-center py-12 text-slate-500">Kayit bulunamadi</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 pl-6">Musteri Domain</TableHead>
                    <TableHead className="text-slate-400">Sahte Domain</TableHead>
                    <TableHead className="text-slate-400">Tip</TableHead>
                    <TableHead className="text-slate-400 text-center">Durum</TableHead>
                    <TableHead className="text-slate-400 text-center">HTTP</TableHead>
                    <TableHead className="text-slate-400">Sayfa Basligi</TableHead>
                    <TableHead className="text-slate-400 pr-6">Ilk Tespit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row, i) => (
                    <TableRow key={`${row.variant_domain}-${i}`} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="pl-6 py-3">
                        <div className="font-mono text-sm text-slate-200">{row.customer_domain}</div>
                        {row.customer_name && (
                          <div className="text-[10px] text-slate-600 mt-0.5">{row.customer_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono text-sm text-slate-300">{row.variant_domain}</span>
                        {row.ip_address && (
                          <div className="text-[10px] text-slate-600 mt-0.5">{row.ip_address}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className="text-[10px] bg-slate-800 text-slate-400 border-slate-700">
                          {VARIANT_TYPE_TR[row.variant_type] ?? row.variant_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {statusBadge(row)}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {row.http_status !== null ? (
                          <span className={`text-[11px] font-mono font-bold ${row.http_status === 200 ? "text-red-400" : "text-slate-400"}`}>
                            {row.http_status}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 max-w-[180px]">
                        <span className="text-[11px] text-slate-500 truncate block" title={row.page_title ?? ""}>
                          {row.page_title ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 py-3">
                        <span className="text-[11px] text-slate-600">
                          {new Date(row.first_detected).toLocaleDateString("tr-TR")}
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
