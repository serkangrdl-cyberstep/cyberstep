import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

interface Summary {
  total_incidents: number;
  critical_count: number;
  high_count: number;
  new_unread_count: number;
  customers_affected: number;
  last_scan_at: string | null;
  hibp_configured: boolean;
  dehashed_configured: boolean;
}

interface Incident {
  id: number;
  customer_id: number;
  customer_name: string | null;
  customer_email: string;
  customer_domain: string;
  breach_source: string;
  breach_date: string | null;
  affected_email_count: number;
  data_types: string[] | null;
  severity: "critical" | "high" | "medium" | "low";
  is_new: boolean;
  source_api: string;
  first_detected: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: "KRİTİK",
  high:     "YÜKSEK",
  medium:   "ORTA",
  low:      "DÜŞÜK",
};
const SEVERITY_CLS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border border-red-500/30",
  high:     "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  medium:   "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  low:      "bg-green-500/15 text-green-400 border border-green-500/30",
};

const DATA_TYPE_TR: Record<string, string> = {
  "passwords":        "Şifre",
  "password":         "Şifre",
  "password_hash":    "Şifre Hash",
  "email addresses":  "E-posta",
  "emails":           "E-posta",
  "email":            "E-posta",
  "phone numbers":    "Telefon",
  "phone":            "Telefon",
  "physical addresses": "Adres",
  "address":          "Adres",
  "credit cards":     "Kredi Kartı",
  "names":            "İsim",
  "usernames":        "Kullanıcı Adı",
};

function trDataType(dt: string): string {
  return DATA_TYPE_TR[dt.toLowerCase()] ?? dt;
}

type Filter = "all" | "critical" | "high" | "new";

export default function AdminDataLeakage() {
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter]       = useState<Filter>("all");
  const [loading, setLoading]     = useState(true);
  const [scanning, setScanning]   = useState(false);
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [toast, setToast]         = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const data = await fetch("/api/admin-panel/data-leakage/summary").then(r => r.json()) as Summary;
    setSummary(data);
  }, []);

  const loadIncidents = useCallback(async (f: Filter) => {
    setLoading(true);
    let url = "/api/admin-panel/data-leakage/incidents";
    const params: string[] = [];
    if (f === "critical") params.push("severity=critical");
    if (f === "high")     params.push("severity=high");
    if (f === "new")      params.push("is_new=true");
    if (params.length)    url += "?" + params.join("&");
    try {
      const data = await fetch(url).then(r => r.json()) as Incident[];
      setIncidents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadIncidents(filter); }, [loadIncidents, filter]);

  async function handleRunNow() {
    setScanning(true);
    try {
      await fetch("/api/admin-panel/data-leakage/run-now", { method: "POST" });
      setToast("Tarama başlatıldı. Birkaç dakika sürebilir.");
      setTimeout(() => {
        void loadSummary();
        void loadIncidents(filter);
        setScanning(false);
        setToast(null);
      }, 20000);
    } catch { setScanning(false); }
  }

  async function handleMarkRead() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await fetch("/api/admin-panel/data-leakage/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_ids: ids }),
    });
    setSelected(new Set());
    void loadSummary();
    void loadIncidents(filter);
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const KPIS = [
    {
      label: "Toplam Sızıntı",
      value: summary?.total_incidents ?? "—",
      sub:   `${summary?.customers_affected ?? 0} müşteri etkilendi`,
      color: "text-[#00C8FF]",
    },
    {
      label: "Kritik & Yüksek",
      value: ((summary?.critical_count ?? 0) + (summary?.high_count ?? 0)),
      sub:   (summary?.critical_count ?? 0) > 0 ? "Acil aksiyon gerekli" : "Stabil",
      color: (summary?.critical_count ?? 0) > 0 ? "text-red-400" : "text-amber-400",
    },
    {
      label: "Okunmamış",
      value: summary?.new_unread_count ?? "—",
      sub:   "Yeni tespit",
      color: "text-[#F5A623]",
    },
    {
      label: "API Durumu",
      value: (summary?.hibp_configured && summary?.dehashed_configured)
        ? "Tam Aktif"
        : summary?.hibp_configured
          ? "Kısmi Aktif"
          : "Pasif",
      sub: summary
        ? `HIBP: ${summary.hibp_configured ? "Aktif" : "Eksik"} · DeHashed: ${summary.dehashed_configured ? "Aktif" : "Eksik"}`
        : "...",
      color: summary?.hibp_configured ? "text-green-400" : "text-red-400",
    },
  ];

  const showApiWarning = summary && !summary.hibp_configured;
  const showDehashedWarning = summary && summary.hibp_configured && !summary.dehashed_configured;

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: "all",      label: "Tümü" },
    { key: "critical", label: "Kritik" },
    { key: "high",     label: "Yüksek" },
    { key: "new",      label: "Okunmamış" },
  ];

  return (
    <AdminLayout title="Data Leakage">
      <div className="p-6 space-y-5" style={{ background: "#060D1A", minHeight: "100vh" }}>

        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#0E1A2E] border border-[#00C8FF]/30 text-[#00C8FF] text-sm px-4 py-3 rounded shadow-lg max-w-sm">
            {toast}
          </div>
        )}

        {/* API uyarı banner */}
        {showApiWarning && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm px-4 py-3 rounded flex items-start gap-2">
            <span className="font-bold shrink-0">UYARI</span>
            <span>
              HIBP API anahtarı eksik. Veri sızıntısı taraması sınırlı çalışıyor.
              Ayarlar sayfasından <strong>HIBP_API_KEY</strong> ekleyin.
            </span>
          </div>
        )}
        {showDehashedWarning && (
          <div className="bg-slate-700/30 border border-slate-600/30 text-slate-400 text-sm px-4 py-3 rounded">
            DeHashed entegrasyonu pasif. <strong>DEHASHED_API_KEY</strong> ve{" "}
            <strong>DEHASHED_EMAIL</strong> eklenirse derin sorgulama aktif olur.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Veri Sizintisi Izleme</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Domain bazlı credential breach tespiti (HIBP + DeHashed)
              {summary?.last_scan_at && (
                <span className="ml-2 text-slate-600">
                  Son tarama: {new Date(summary.last_scan_at).toLocaleString("tr-TR")}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button
                onClick={() => void handleMarkRead()}
                className="bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 text-sm"
              >
                {selected.size} Kaydı Okundu Isaretle
              </Button>
            )}
            <Button
              onClick={() => void handleRunNow()}
              disabled={scanning}
              className="bg-[#00C8FF]/10 border border-[#00C8FF]/30 text-[#00C8FF] hover:bg-[#00C8FF]/20 text-sm"
            >
              {scanning ? "Taranıyor..." : "Tarama Baslat"}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map(kpi => (
            <Card key={kpi.label} style={{ background: "#0E1A2E", border: "1px solid #1a3050" }}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-[11px] text-slate-400 font-normal uppercase tracking-wide">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{kpi.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Incidents Tablosu */}
        <Card style={{ background: "#0E1A2E", border: "1px solid #1a3050" }}>
          <CardHeader className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Sızıntı Kayıtları</CardTitle>
              <div className="flex gap-1">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => { setFilter(f.key); setSelected(new Set()); }}
                    className={`text-xs px-3 py-1 rounded transition-colors ${
                      filter === f.key
                        ? "bg-[#00C8FF]/20 text-[#00C8FF] border border-[#00C8FF]/40"
                        : "text-slate-400 border border-slate-700 hover:border-slate-600"
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
              <div className="text-center py-10 text-slate-500">Yukleniyor...</div>
            ) : incidents.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                {filter === "all"
                  ? "Henüz sızıntı kaydı yok. Tarama başlatmak için butona tıklayın."
                  : "Bu filtrede kayıt bulunamadı."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-8 pl-4" />
                    <TableHead className="text-slate-400 pl-2">Musteri</TableHead>
                    <TableHead className="text-slate-400">Sızıntı Kaynağı</TableHead>
                    <TableHead className="text-slate-400">Tarih</TableHead>
                    <TableHead className="text-slate-400 text-center">Etkilenen</TableHead>
                    <TableHead className="text-slate-400">Veri Turleri</TableHead>
                    <TableHead className="text-slate-400 text-center">Risk</TableHead>
                    <TableHead className="text-slate-400 text-center pr-6">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map(inc => (
                    <TableRow
                      key={inc.id}
                      className={`border-slate-800 hover:bg-slate-800/30 ${
                        selected.has(inc.id) ? "bg-slate-800/50" : ""
                      }`}
                    >
                      <TableCell className="pl-4 w-8">
                        <input
                          type="checkbox"
                          checked={selected.has(inc.id)}
                          onChange={() => toggleSelect(inc.id)}
                          className="accent-[#00C8FF] w-3.5 h-3.5"
                        />
                      </TableCell>
                      <TableCell className="pl-2 py-3">
                        <div className="text-sm font-medium text-slate-200">
                          {inc.customer_name ?? inc.customer_email}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{inc.customer_domain}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm text-slate-300">{inc.breach_source}</span>
                        <div className="text-[10px] text-slate-600">{inc.source_api}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-slate-400">
                          {inc.breach_date
                            ? new Date(inc.breach_date).toLocaleDateString("tr-TR")
                            : "Bilinmiyor"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className="text-sm font-bold text-slate-300">
                          {inc.affected_email_count.toLocaleString("tr-TR")}
                        </span>
                        <div className="text-[10px] text-slate-600">hesap</div>
                      </TableCell>
                      <TableCell className="py-3 max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {(inc.data_types ?? []).slice(0, 4).map(dt => (
                            <span
                              key={dt}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400"
                            >
                              {trDataType(dt)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${SEVERITY_CLS[inc.severity] ?? ""}`}>
                          {SEVERITY_LABEL[inc.severity] ?? inc.severity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center pr-6 py-3">
                        {inc.is_new ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#00C8FF]/15 text-[#00C8FF] border border-[#00C8FF]/30">
                            YENİ
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded bg-slate-700/40 text-slate-500 border border-slate-700">
                            Goruldu
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* KVKK Notu */}
        <p className="text-[11px] text-slate-700 italic px-1">
          * Kişisel veriler KVKK kapsamında korunmaktadır. Tam e-posta listesi talep için destek@cyberstep.io
        </p>
      </div>
    </AdminLayout>
  );
}
