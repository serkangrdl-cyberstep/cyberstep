import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldOff, Download, AlertTriangle, CheckCircle, XCircle, SkipForward } from "lucide-react";

interface Stats {
  period: string;
  total: number;
  byAction: Record<string, number>;
  totalIocEntries: number;
  settings: Record<string, string>;
}

interface LogRow {
  id: number;
  customerId: number | null;
  iocValue: string;
  iocType: string | null;
  action: string;
  confidenceScore: number | null;
  sources: string[] | null;
  skipReason: string | null;
  performedBy: string | null;
  createdAt: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  reported: "Raporlandı",
  block_queued: "Blok Kuyruğu",
  block_sent: "Blok Gönderildi",
  block_confirmed: "Blok Onaylandı",
  skipped_whitelist: "Whitelist (Atlandı)",
  skipped_confidence: "Düşük Güven (Atlandı)",
  skipped_disabled: "Devre Dışı (Atlandı)",
  reverted: "Geri Alındı",
  expired: "Süresi Doldu",
};

function actionBadge(action: string) {
  if (action === "reported") return <Badge className="bg-blue-100 text-blue-800 border-0">{ACTION_LABELS[action] ?? action}</Badge>;
  if (action === "block_queued" || action === "block_sent") return <Badge className="bg-orange-100 text-orange-800 border-0">{ACTION_LABELS[action] ?? action}</Badge>;
  if (action === "block_confirmed") return <Badge className="bg-red-100 text-red-800 border-0">{ACTION_LABELS[action] ?? action}</Badge>;
  if (action.startsWith("skipped_")) return <Badge className="bg-gray-100 text-gray-600 border-0">{ACTION_LABELS[action] ?? action}</Badge>;
  return <Badge variant="outline">{ACTION_LABELS[action] ?? action}</Badge>;
}

export default function IocKontroller() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [killReason, setKillReason] = useState("");
  const [killBusy, setKillBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        fetch("/api/admin-panel/ioc/stats").then(r => r.json()),
        fetch("/api/admin-panel/ioc/log?limit=20").then(r => r.json()),
      ]);
      setStats(s);
      setLog(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateSetting(key: string, value: string) {
    setSaving(key);
    try {
      await fetch(`/api/admin-panel/ioc/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function toggleKillSwitch(activate: boolean) {
    setKillBusy(true);
    try {
      const url = activate ? "/api/admin-panel/kill-switch/activate" : "/api/admin-panel/kill-switch/deactivate";
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: killReason || "admin isteği" }),
      });
      setKillReason("");
      await load();
    } finally {
      setKillBusy(false);
    }
  }

  const settings = stats?.settings ?? {};
  const killActive = settings["kill_switch_active"] === "true";
  const autoBlock = settings["auto_block_enabled"] === "true";
  const by = stats?.byAction ?? {};

  return (
    <AdminLayout
      title="IOC Güven Kontrolleri"
      description="IOC confidence scoring, whitelist yönetimi, kill switch ve aksiyon log"
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Toplam İşlenen (24s)", value: stats?.total ?? 0, icon: <Shield className="h-4 w-4" /> },
            { label: "Raporlanan", value: by["reported"] ?? 0, icon: <CheckCircle className="h-4 w-4 text-blue-600" /> },
            { label: "Whitelist (Atlandı)", value: by["skipped_whitelist"] ?? 0, icon: <SkipForward className="h-4 w-4 text-gray-500" /> },
            { label: "Düşük Güven (Atlandı)", value: by["skipped_confidence"] ?? 0, icon: <XCircle className="h-4 w-4 text-gray-400" /> },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{s.icon}{s.label}</div>
                <div className="text-2xl font-bold">{loading ? "..." : s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Kill Switch */}
          <Card className={killActive ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {killActive
                  ? <ShieldOff className="h-5 w-5 text-destructive" />
                  : <Shield className="h-5 w-5 text-green-600" />}
                Kill Switch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-lg p-3 text-sm font-medium ${killActive ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-800"}`}>
                Durum: {killActive ? "AKTIF — Tüm otomatik aksiyonlar durduruldu" : "Normal — Sistem çalışıyor"}
              </div>
              <div className="space-y-2">
                <Label htmlFor="kill-reason">Neden (opsiyonel)</Label>
                <Input
                  id="kill-reason"
                  value={killReason}
                  onChange={e => setKillReason(e.target.value)}
                  placeholder="Acil durum sebebi..."
                />
              </div>
              {killActive ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toggleKillSwitch(false)}
                  disabled={killBusy}
                >
                  Sistemi Yeniden Aktif Et
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => toggleKillSwitch(true)}
                  disabled={killBusy}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Acil Durdur
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Tüm otomatik aksiyonları ve blok kuyruğunu anında durdurur.</p>
            </CardContent>
          </Card>

          {/* Genel Ayarlar */}
          <Card>
            <CardHeader>
              <CardTitle>Genel Ayarlar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Otomatik Blok</div>
                  <div className="text-xs text-muted-foreground">FortiGate otomatik blok (varsayılan: kapalı)</div>
                </div>
                <Switch
                  checked={autoBlock}
                  onCheckedChange={v => updateSetting("auto_block_enabled", v ? "true" : "false")}
                  disabled={saving === "auto_block_enabled" || loading}
                />
              </div>

              {[
                { key: "min_confidence_for_block", label: "Min Confidence (Blok)", desc: "Otomatik blok için minimum güven skoru (0-100)" },
                { key: "min_sources_for_block", label: "Min Kaynak Sayısı (Blok)", desc: "Blok için minimum doğrulayan kaynak" },
                { key: "ioc_report_confidence_threshold", label: "Min Confidence (Raporlama)", desc: "Müşteriye bildirim için minimum skor" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-sm">{label}</Label>
                  <div className="text-xs text-muted-foreground mb-1">{desc}</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={key.includes("sources") ? 10 : 100}
                      defaultValue={settings[key] ?? ""}
                      key={settings[key]}
                      className="w-24"
                      onBlur={e => {
                        if (e.target.value !== settings[key]) {
                          void updateSetting(key, e.target.value);
                        }
                      }}
                    />
                    {saving === key && <span className="text-xs text-muted-foreground self-center">Kaydediliyor...</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Action Log */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Son Aksiyon Logu</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Yenile</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/api/admin-panel/ioc/log/export", "_blank")}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Yükleniyor...</div>
            ) : log.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Henüz aksiyon kaydı yok.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaman</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>IOC</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Aksiyon</TableHead>
                      <TableHead>Skor</TableHead>
                      <TableHead>Neden</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {log.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString("tr-TR") : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{row.customerId ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[180px] truncate">{row.iocValue}</TableCell>
                        <TableCell className="text-xs uppercase">{row.iocType ?? "-"}</TableCell>
                        <TableCell>{actionBadge(row.action)}</TableCell>
                        <TableCell className="text-xs">{row.confidenceScore ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{row.skipReason ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
