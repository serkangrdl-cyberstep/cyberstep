import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Zap, BarChart2, Settings, Play, RefreshCw, CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

type Tab = "overview" | "triggers" | "tools" | "settings";

interface Stats {
  triggersThisMonth: number;
  triggersSent: number;
  competitorChecks: number;
  benchmarkDownloads: number;
}

interface TriggerRow {
  id: number;
  triggerType: string;
  domain: string;
  companyName: string | null;
  emailTo: string | null;
  emailSubject: string | null;
  status: string;
  createdAt: string;
  triggerData: Record<string, unknown> | null;
}

interface CompetitorCheckRow {
  id: number;
  ownDomain: string;
  competitorDomain: string;
  ownScore: number | null;
  competitorScore: number | null;
  visitorEmail: string | null;
  visitorCompany: string | null;
  createdAt: string;
}

interface BenchmarkRow {
  id: number;
  sector: string;
  visitorName: string | null;
  visitorEmail: string;
  visitorCompany: string | null;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  ssl_expiry:      "SSL Bitiş",
  new_cve:         "Yeni CVE",
  sector_breach:   "Sektör Saldırısı",
  kvk_penalty:     "KVK Ceza",
  score_drop:      "Skor Düşüşü",
  port_change:     "Port Değişikliği",
  supplier_chain:  "Tedarikçi Zinciri",
  ekap_tender:     "EKAP İhale",
  new_company:     "Yeni Şirket",
  benchmark_dl:    "Benchmark İndirme",
  competitor_check: "Rakip Karş.",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent:        { label: "Gönderildi", variant: "default" },
  converted:   { label: "Dönüştü", variant: "default" },
  pending:     { label: "Bekliyor", variant: "secondary" },
  suppressed:  { label: "Bastırıldı", variant: "outline" },
  failed:      { label: "Başarısız", variant: "destructive" },
};

const TRIGGER_TYPES = ["ssl_expiry", "new_cve", "sector_breach", "kvk_penalty", "score_drop", "port_change", "ekap_tender"];

export default function GrowthEngine() {
  const [tab, setTab] = useState<Tab>("overview");
  const [typeFilter, setTypeFilter] = useState("");
  const [testDomain, setTestDomain] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testType, setTestType] = useState("ssl_expiry");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["growth-engine-stats"],
    queryFn: () => fetch("/api/growth-engine/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: triggers } = useQuery<{ rows: TriggerRow[]; total: number }>({
    queryKey: ["growth-triggers", typeFilter],
    queryFn: () => fetch(`/api/growth-engine/triggers?${typeFilter ? `type=${typeFilter}&` : ""}limit=100`, { credentials: "include" }).then(r => r.json()),
    enabled: tab === "triggers",
  });

  const { data: competitorChecks } = useQuery<CompetitorCheckRow[]>({
    queryKey: ["competitor-checks"],
    queryFn: () => fetch("/api/growth-engine/competitor-checks", { credentials: "include" }).then(r => r.json()),
    enabled: tab === "tools",
  });

  const { data: benchmarkDownloads } = useQuery<BenchmarkRow[]>({
    queryKey: ["benchmark-downloads"],
    queryFn: () => fetch("/api/growth-engine/benchmark-downloads", { credentials: "include" }).then(r => r.json()),
    enabled: tab === "tools",
  });

  const { data: settings } = useQuery<Array<{ triggerType: string; isActive: boolean; suppressDays: number; maxDailyLimit: number }>>({
    queryKey: ["growth-settings"],
    queryFn: () => fetch("/api/growth-engine/settings", { credentials: "include" }).then(r => r.json()),
    enabled: tab === "settings",
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/growth-engine/trigger-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ triggerType: testType, domain: testDomain, email: testEmail }),
      });
      return r.json();
    },
    onSuccess: (data: { ok: boolean; message: string }) => {
      toast({ title: data.message });
      qc.invalidateQueries({ queryKey: ["growth-triggers"] });
    },
    onError: () => toast({ title: "Test başarısız", variant: "destructive" }),
  });

  const cronMutation = useMutation({
    mutationFn: async (cronType: string) => {
      const r = await fetch(`/api/growth-engine/run-cron/${cronType}`, {
        method: "POST",
        credentials: "include",
      });
      return r.json();
    },
    onSuccess: () => toast({ title: "Cron arka planda başlatıldı" }),
  });

  const settingMutation = useMutation({
    mutationFn: async ({ triggerType, updates }: { triggerType: string; updates: { isActive?: boolean; suppressDays?: number } }) => {
      const r = await fetch(`/api/growth-engine/settings/${triggerType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-settings"] }),
  });

  const openRate = stats?.triggersSent && stats.triggersThisMonth
    ? Math.round((stats.triggersSent / stats.triggersThisMonth) * 100)
    : 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
              Büyüme Motoru
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Proaktif satış otomasyonu ve trigger sistemi</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {([
            { key: "overview", label: "Genel Bakış", icon: BarChart2 },
            { key: "triggers", label: "Tetikleyiciler", icon: Zap },
            { key: "tools", label: "Araçlar", icon: TrendingUp },
            { key: "settings", label: "Ayarlar", icon: Settings },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-emerald-600 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Bu Ay Trigger", value: stats?.triggersThisMonth ?? 0, icon: Zap, color: "text-blue-600" },
                { label: "Gönderilen E-posta", value: stats?.triggersSent ?? 0, icon: Mail, color: "text-emerald-600" },
                { label: "Rakip Karşılaştırma", value: stats?.competitorChecks ?? 0, icon: TrendingUp, color: "text-violet-600" },
                { label: "Benchmark İndirme", value: stats?.benchmarkDownloads ?? 0, icon: BarChart2, color: "text-amber-600" },
              ].map(item => (
                <div key={item.label} className="bg-card border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">Son 30 gün</div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Manuel Cron Çalıştır</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "ssl_expiry", label: "SSL Bitiş Taraması" },
                  { key: "cve_alert", label: "CVE Uyarısı Taraması" },
                  { key: "port_change", label: "Port Değişiklik Taraması" },
                ].map(cron => (
                  <Button
                    key={cron.key}
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => cronMutation.mutate(cron.key)}
                    disabled={cronMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${cronMutation.isPending ? "animate-spin" : ""}`} />
                    {cron.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test Trigger */}
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Test Trigger Gönder</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Trigger Türü</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={testType}
                    onChange={e => setTestType(e.target.value)}
                  >
                    {TRIGGER_TYPES.map(t => (
                      <option key={t} value={t}>{TRIGGER_LABELS[t] ?? t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Domain</Label>
                  <Input value={testDomain} onChange={e => setTestDomain(e.target.value)} placeholder="sirket.com.tr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-posta (opsiyonel)</Label>
                  <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@sirket.com" />
                </div>
              </div>
              <Button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testDomain}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                <Play className="h-4 w-4 mr-2" />
                Test Trigger Gönder
              </Button>
            </div>
          </div>
        )}

        {/* ── TRIGGERS ── */}
        {tab === "triggers" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={typeFilter === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("")}
              >
                Tümü
              </Button>
              {TRIGGER_TYPES.map(t => (
                <Button
                  key={t}
                  variant={typeFilter === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(t)}
                >
                  {TRIGGER_LABELS[t] ?? t}
                </Button>
              ))}
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Domain</th>
                    <th className="px-4 py-3 text-left font-semibold">Tür</th>
                    <th className="px-4 py-3 text-left font-semibold">E-posta</th>
                    <th className="px-4 py-3 text-left font-semibold">Durum</th>
                    <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {triggers?.rows.map(row => {
                    const statusInfo = STATUS_BADGE[row.status ?? "pending"] ?? { label: row.status, variant: "outline" as const };
                    return (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{row.domain}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                            {TRIGGER_LABELS[row.triggerType] ?? row.triggerType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{row.emailTo ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(row.createdAt).toLocaleDateString("tr-TR")}
                        </td>
                      </tr>
                    );
                  })}
                  {(!triggers?.rows.length) && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Kayıt bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
              {triggers && <div className="px-4 py-3 border-t text-xs text-muted-foreground">Toplam: {triggers.total} kayıt</div>}
            </div>
          </div>
        )}

        {/* ── TOOLS ── */}
        {tab === "tools" && (
          <div className="space-y-6">
            {/* Competitor Checks */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                Rakip Karşılaştırma Kullanımları ({competitorChecks?.length ?? 0})
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Kendi Domain</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Rakip</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Skor Farkı</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">E-posta</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {competitorChecks?.map(row => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2">{row.ownDomain}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{row.competitorDomain}</td>
                      <td className="px-4 py-2">
                        {row.ownScore != null && row.competitorScore != null ? (
                          <span className={row.ownScore >= row.competitorScore ? "text-emerald-600" : "text-amber-600"}>
                            {row.ownScore > row.competitorScore ? "+" : ""}{row.ownScore - row.competitorScore}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{row.visitorEmail ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                  {!competitorChecks?.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">Henüz kullanım yok</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Benchmark Downloads */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-amber-600" />
                Benchmark Rapor İndirmeleri ({benchmarkDownloads?.length ?? 0})
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-xs">E-posta</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Şirket</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Sektör</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {benchmarkDownloads?.map(row => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2">{row.visitorEmail}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{row.visitorCompany ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">{row.sector}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                  {!benchmarkDownloads?.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">Henüz indirme yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div className="space-y-4">
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">Trigger Ayarları</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Trigger Türü</th>
                    <th className="px-4 py-3 text-center font-semibold">Aktif</th>
                    <th className="px-4 py-3 text-left font-semibold">Baskılama (gün)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {TRIGGER_TYPES.map(type => {
                    const setting = settings?.find(s => s.triggerType === type);
                    return (
                      <tr key={type}>
                        <td className="px-4 py-3 font-medium">{TRIGGER_LABELS[type] ?? type}</td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={setting?.isActive ?? true}
                            onCheckedChange={val => settingMutation.mutate({ triggerType: type, updates: { isActive: val } })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            className="w-24"
                            defaultValue={setting?.suppressDays ?? 30}
                            onBlur={e => settingMutation.mutate({ triggerType: type, updates: { suppressDays: parseInt(e.target.value) } })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Baskılama süresi:</strong> Aynı domain'e aynı trigger türünde tekrar e-posta gönderilene kadar bekleme süresi (gün).</p>
              <p><strong className="text-foreground">Cron zamanlaması:</strong> SSL (günlük 01:00) · CVE (günlük 02:00) · Port (Pazar 04:00) · EKAP (günlük 03:00)</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
