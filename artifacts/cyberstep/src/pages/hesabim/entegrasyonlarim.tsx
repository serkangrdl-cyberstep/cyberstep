import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Trash2, Copy, CheckCircle, AlertTriangle, Plus, ExternalLink, Loader2, Building2, Shield, Clock, Unplug, Network, TicketCheck, Webhook, RefreshCw, Send, Smartphone, X, ChevronDown, BookOpen, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface Integration {
  id: number;
  provider: string;
  displayName: string;
  webhookToken: string;
  isActive: boolean;
  lastEventAt: string | null;
  eventCount: number;
  eventTypes: string[];
  createdAt: string;
}

interface ObsEvent {
  id: number;
  provider: string;
  eventType: string;
  severity: string;
  title: string;
  affectedService: string | null;
  processed: boolean;
  receivedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  datadog: "Datadog",
  azure_monitor: "Azure Monitor",
  cloudflare: "Cloudflare",
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function WebhookUrl({ token, provider }: { token: string; provider: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const origin = window.location.origin;
  const url = `${origin}/api/webhook/${provider}/${token}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: "Kopyalandı" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs bg-gray-900 text-emerald-400 px-3 py-2 rounded border border-gray-700 truncate">
        {url}
      </code>
      <Button size="sm" variant="outline" onClick={copy} className="border-gray-700 text-gray-400 hover:text-white shrink-0">
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function AddIntegrationCard({ provider, onAdd }: { provider: "datadog" | "azure_monitor" | "cloudflare"; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const isCloudflare = provider === "cloudflare";

  const addMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        provider,
        displayName: displayName || PROVIDER_LABELS[provider]!,
      };
      if (isCloudflare) body["apiKey"] = webhookSecret;
      const r = await fetch("/api/portal/integrations/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Entegrasyon oluşturuldu", description: "Webhook URL'nizi kopyalayıp kaydedin." });
      qc.invalidateQueries({ queryKey: ["obs-integrations"] });
      setOpen(false);
      setDisplayName("");
      setWebhookSecret("");
      onAdd();
    },
    onError: (err) => toast({ title: "Hata", description: String(err) || "Entegrasyon oluşturulamadı.", variant: "destructive" }),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="border-gray-700 text-gray-400 hover:text-white">
        <Plus className="h-3.5 w-3.5 mr-1" /> {PROVIDER_LABELS[provider]} Bağla
      </Button>
    );
  }

  return (
    <div className="border border-gray-700 rounded-lg p-4 space-y-3 bg-gray-900/50">
      <p className="text-sm font-medium text-white">{PROVIDER_LABELS[provider]} Entegrasyonu</p>
      <div>
        <Label className="text-gray-400 text-xs">Görünen Ad (opsiyonel)</Label>
        <Input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder={`${PROVIDER_LABELS[provider]} Entegrasyonu`}
          className="mt-1 bg-gray-900 border-gray-700 text-white"
        />
      </div>
      {isCloudflare && (
        <div>
          <Label className="text-gray-400 text-xs">Webhook Secret <span className="text-red-400">*</span></Label>
          <Input
            type="password"
            value={webhookSecret}
            onChange={e => setWebhookSecret(e.target.value)}
            placeholder="Cloudflare Notifications → Webhook → Secret"
            className="mt-1 bg-gray-900 border-gray-700 text-white font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            Cloudflare Dashboard → Notifications → Webhooks → Secret alanındaki degeri girin.
            Bu deger CF-Webhook-Token header dogrulamasi icin kullanilir.
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || (isCloudflare && !webhookSecret.trim())}
        >
          {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Oluştur
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="text-gray-400">
          Vazgec
        </Button>
      </div>
    </div>
  );
}

interface Ms365Integration {
  id: number;
  azureTenantId: string;
  status: string;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
}

interface Ms365SigninLog {
  id: number;
  userPrincipalName: string | null;
  ipAddress: string | null;
  location: { city?: string; countryOrRegion?: string } | null;
  riskLevel: string | null;
  eventTime: string | null;
  correlatedSocCaseId: number | null;
}

const MS365_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  disconnected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const RISK_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function Ms365Section() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ integrations: Ms365Integration[]; recentSignInCount: number }>({
    queryKey: ["ms365-status"],
    queryFn: () => fetch("/api/portal/ms365/status", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: logsData } = useQuery<{ logs: Ms365SigninLog[] }>({
    queryKey: ["ms365-signin-logs"],
    queryFn: () => fetch("/api/portal/ms365/signin-logs", { credentials: "include" }).then(r => r.json()),
    enabled: (data?.integrations?.length ?? 0) > 0,
    refetchInterval: 60000,
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/ms365/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      toast({ title: "Microsoft 365 baglanitisi kesildi" });
      qc.invalidateQueries({ queryKey: ["ms365-status"] });
      qc.invalidateQueries({ queryKey: ["ms365-signin-logs"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  function timeSince(iso: string | null) {
    if (!iso) return "Hic";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} dk once`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} saat once`;
    return `${Math.floor(h / 24)} gun once`;
  }

  const integrations = data?.integrations ?? [];
  const logs = logsData?.logs ?? [];
  const connected = integrations.length > 0;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            Microsoft 365 / Azure AD
          </CardTitle>
          {!connected && (
            <Button
              size="sm"
              onClick={() => { window.location.href = "/api/ms365/auth"; }}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Microsoft 365&apos;i Bagla
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
        ) : !connected ? (
          <div className="text-center py-8 border border-dashed border-gray-800 rounded-lg space-y-3">
            <Building2 className="h-10 w-10 text-gray-600 mx-auto" />
            <p className="text-gray-400 text-sm font-medium">Microsoft 365 bagli degil</p>
            <p className="text-gray-600 text-xs max-w-sm mx-auto">
              Azure AD giris loglarini, M365 Defender e-posta tehdit uyarilarini ve
              cross-korelasyonu etkinlestirmek icin baglanin.
            </p>
            <Button
              size="sm"
              onClick={() => { window.location.href = "/api/ms365/auth"; }}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 mt-2"
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Microsoft 365&apos;i Bagla
            </Button>
          </div>
        ) : (
          <>
            {integrations.map(integ => (
              <div key={integ.id} className="border border-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">Azure AD Tenant</p>
                      <Badge className={`text-[10px] border ${MS365_STATUS_COLORS[integ.status] ?? MS365_STATUS_COLORS["disconnected"]}`}>
                        {integ.status === "active" ? "Aktif" : integ.status === "error" ? "Hata" : "Bagli Degil"}
                      </Badge>
                    </div>
                    <code className="text-[11px] text-emerald-400 mt-0.5 block">{integ.azureTenantId}</code>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Son sync: {timeSince(integ.lastSyncAt)}
                      {data?.recentSignInCount ? ` · 24s giris: ${data.recentSignInCount}` : ""}
                    </p>
                    {integ.syncError && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {integ.syncError}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnectMutation.mutate(integ.id)}
                    disabled={disconnectMutation.isPending}
                    className="text-red-400 hover:text-red-300 h-7 shrink-0"
                    title="Baglantıyı kes"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {integ.status === "error" && (
                  <div className="border border-red-500/20 bg-red-500/5 rounded p-3">
                    <p className="text-xs text-red-400 font-medium mb-1">Yeniden Baglanma Gerekiyor</p>
                    <p className="text-[11px] text-red-400/80 mb-2">
                      Token yenileme basarisiz oldu. Microsoft 365 hesabinizi yeniden yetkilendirin.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => { window.location.href = "/api/ms365/auth"; }}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0 h-7 text-xs"
                    >
                      Yeniden Baglan
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Kapsam", value: "AuditLog + SecurityEvents" },
                    { label: "Tarama", value: "Her 15 dakika" },
                    { label: "24s Giris", value: String(data?.recentSignInCount ?? 0) },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-950/50 rounded p-2">
                      <p className="text-[11px] text-gray-500">{item.label}</p>
                      <p className="text-xs text-gray-300 font-medium mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Son riskli girisler */}
            {logs.length > 0 && (
              <div className="border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-red-400" />
                  Son Riskli Girisler
                </p>
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex items-center gap-2">
                    <Badge className={`text-[10px] shrink-0 border ${RISK_COLORS[log.riskLevel ?? "low"] ?? RISK_COLORS["low"]}`}>
                      {(log.riskLevel ?? "?").toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{log.userPrincipalName ?? "Bilinmiyor"}</p>
                      <p className="text-[10px] text-gray-600">
                        {log.ipAddress ?? "-"} · {log.location?.countryOrRegion ?? "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-gray-600">{timeSince(log.eventTime)}</span>
                      {log.correlatedSocCaseId && (
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-gray-800 rounded p-3 bg-gray-950/50 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">Neler izleniyor:</p>
              <p>· Azure AD riskli giris gunlukleri (impossible travel, parola spreyi, bilmedigim konum)</p>
              <p>· M365 Defender e-posta karantina uyarilari</p>
              <p>· Fortinet Fabric olaylariyla IP cross-korelasyonu — koordineli saldir tespiti</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ServiceNow Section ────────────────────────────────────────────────────────

interface SnConfig {
  id: number;
  instanceUrl: string;
  username: string;
  assignmentGroup: string | null;
  category: string | null;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastWebhookAt: string | null;
  webhookEventCount: number;
}

interface SnIncident {
  id: number;
  snNumber: string;
  snState: number;
  lastSyncedAt: string | null;
  caseNumber: string;
  caseTitle: string;
  caseStatus: string;
  severity: string;
}

const SN_STATES: Record<number, string> = {
  1: "Yeni", 2: "Devam Ediyor", 3: "Beklemede", 6: "Çözüldü", 7: "Kapatıldı",
};

function ServiceNowSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ instanceUrl: "", username: "", apiToken: "", assignmentGroup: "", category: "Software" });
  const [testing, setTesting] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedBR, setCopiedBR] = useState(false);

  const { data, isLoading } = useQuery<{ config: SnConfig | null }>({
    queryKey: ["sn-config"],
    queryFn: () => fetch("/api/integrations/servicenow", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: incData } = useQuery<{ incidents: SnIncident[] }>({
    queryKey: ["sn-incidents"],
    queryFn: () => fetch("/api/integrations/servicenow/incidents", { credentials: "include" }).then(r => r.json()),
    enabled: !!data?.config,
    refetchInterval: 60000,
  });

  const { data: webhookInfo } = useQuery<{ webhookUrl: string; hasSecret: boolean }>({
    queryKey: ["sn-webhook-info"],
    queryFn: () => fetch("/api/integrations/servicenow/webhook-info", { credentials: "include" }).then(r => r.json()),
    enabled: !!data?.config?.active,
  });

  const generateSecretMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/servicenow/webhook-secret", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ ok: boolean; secret: string }>;
    },
    onSuccess: (d) => {
      setNewSecret(d.secret);
      qc.invalidateQueries({ queryKey: ["sn-webhook-info"] });
      toast({ title: "Yeni webhook secret oluşturuldu", description: "Bu değeri hemen ServiceNow'a kopyalayın." });
    },
    onError: () => toast({ title: "Hata", description: "Secret oluşturulamadı", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/servicenow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ServiceNow bağlandı", description: "SOC vakaları artık ServiceNow'a aktarılacak." });
      qc.invalidateQueries({ queryKey: ["sn-config"] });
      setShowForm(false);
    },
    onError: (err) => toast({ title: "Bağlantı başarısız", description: String(err), variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/integrations/servicenow/${id}/toggle`, { method: "PATCH", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      toast({ title: "ServiceNow entegrasyonu devre dışı bırakıldı" });
      qc.invalidateQueries({ queryKey: ["sn-config"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  async function testConnection() {
    if (!form.instanceUrl || !form.username || !form.apiToken) {
      toast({ title: "Tüm alanlar zorunlu", variant: "destructive" }); return;
    }
    setTesting(true);
    try {
      const r = await fetch("/api/integrations/servicenow/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const d = await r.json() as { ok: boolean; message: string };
      if (d.ok) toast({ title: "Bağlantı başarılı" });
      else toast({ title: "Bağlantı başarısız", description: d.message, variant: "destructive" });
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  function timeSince(iso: string | null) {
    if (!iso) return "-";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} saat önce`;
    return `${Math.floor(h / 24)} gün önce`;
  }

  const cfg = data?.config;
  const incidents = incData?.incidents ?? [];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-violet-400" />
            ServiceNow ITSM
          </CardTitle>
          {cfg?.active && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300 h-7"
              onClick={() => disconnectMutation.mutate(cfg.id)}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="h-3.5 w-3.5 mr-1" /> Kes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
        ) : cfg?.active ? (
          <>
            <div className="border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">ServiceNow Bağlantısı</p>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Aktif</Badge>
                  </div>
                  <code className="text-[11px] text-violet-400 block mt-1">{cfg.instanceUrl}</code>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Son sync: {timeSince(cfg.lastSyncAt)}
                    {cfg.assignmentGroup ? ` · Grup: ${cfg.assignmentGroup}` : ""}
                  </p>
                  {cfg.lastSyncError && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {cfg.lastSyncError.slice(0, 80)}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Kategori", value: cfg.category ?? "Software" },
                  { label: "Sync", value: "Her 15 dakika" },
                  { label: "Incident", value: String(incidents.length) },
                ].map(item => (
                  <div key={item.label} className="bg-gray-950/50 rounded p-2">
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="text-xs text-gray-300 font-medium mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Webhook activity indicator */}
              <div className={`flex items-center gap-2 rounded p-2.5 text-xs ${cfg.lastWebhookAt ? "bg-emerald-950/30 border border-emerald-500/20" : "bg-gray-950/40 border border-gray-800"}`}>
                <Webhook className={`h-3.5 w-3.5 shrink-0 ${cfg.lastWebhookAt ? "text-emerald-400" : "text-gray-600"}`} />
                {cfg.lastWebhookAt ? (
                  <span className="text-gray-300">
                    Son webhook: <span className="text-emerald-400 font-medium">{timeSince(cfg.lastWebhookAt)}</span>
                    {cfg.webhookEventCount > 0 && (
                      <span className="text-gray-500 ml-1">· Toplam {cfg.webhookEventCount} olay</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">Henüz webhook olayı alınmadı</span>
                )}
              </div>
            </div>

            {incidents.length > 0 && (
              <div className="border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <TicketCheck className="h-3.5 w-3.5 text-violet-400" />
                  Son ServiceNow Incident&apos;lar
                </p>
                {incidents.slice(0, 5).map(inc => (
                  <div key={inc.id} className="flex items-center gap-2">
                    <code className="text-[10px] text-violet-400 font-mono shrink-0">{inc.snNumber}</code>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{inc.caseTitle}</p>
                      <p className="text-[10px] text-gray-600">{inc.caseNumber} · {SN_STATES[inc.snState] ?? inc.snState}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0">{timeSince(inc.lastSyncedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-gray-800 rounded p-3 bg-gray-950/50 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">Nasıl çalışır:</p>
              <p>· Yeni SOC vakası açıldığında ServiceNow&apos;da INC ticket oluşur</p>
              <p>· Vaka kapatıldığında INC otomatik "Resolved" olarak güncellenir</p>
              <p>· ServiceNow&apos;da elle kapatılan INC&apos;ler 15 dakikada bir SOC&apos;a yansır (polling)</p>
              <p>· <span className="text-violet-400 font-medium">Webhook</span> yapılandırıldığında tüm değişiklikler <span className="text-emerald-400">anında</span> yansır</p>
            </div>

            {/* ── Webhook Konfigürasyonu ─────────────────────────── */}
            <div className="border border-violet-500/20 rounded-lg p-4 bg-violet-950/10 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-violet-400" />
                  Webhook Konfigürasyonu
                  {webhookInfo?.hasSecret ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">HMAC Aktif</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">Secret Yok</Badge>
                  )}
                </p>
              </div>

              <p className="text-xs text-gray-400">
                ServiceNow Business Rule veya Outbound REST Message ile bu URL&apos;e POST atarak tüm değişiklikleri (durum, yorum, atama) anlık olarak CyberStep&apos;e yansıtın.
              </p>

              {/* Webhook URL */}
              {webhookInfo?.webhookUrl && (
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500 font-medium">Webhook URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-gray-900 text-emerald-400 px-3 py-2 rounded border border-gray-700 truncate font-mono">
                      {webhookInfo.webhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-700 text-gray-400 hover:text-white shrink-0 h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookInfo.webhookUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                    >
                      {copiedUrl ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Yeni secret göster */}
              {newSecret && (
                <div className="border border-amber-500/30 rounded p-3 bg-amber-950/20 space-y-2">
                  <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Bu secret yalnızca bir kez gösterilir — hemen kopyalayın
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-gray-900 text-amber-400 px-3 py-2 rounded border border-amber-500/30 truncate font-mono">
                      {newSecret}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:text-amber-300 shrink-0 h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(newSecret);
                        setCopiedSecret(true);
                        setTimeout(() => setCopiedSecret(false), 2000);
                      }}
                    >
                      {copiedSecret ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    ServiceNow Outbound REST Message &rarr; HTTP Header olarak <code className="text-violet-400">X-SN-Signature: sha256=&lt;HMAC-SHA256(secret, rawBody)&gt;</code> gönderin.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-500/30 text-violet-400 hover:text-violet-300 h-8"
                  onClick={() => generateSecretMutation.mutate()}
                  disabled={generateSecretMutation.isPending}
                >
                  {generateSecretMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  )}
                  {webhookInfo?.hasSecret ? "Secret Yenile" : "Secret Oluştur"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 text-gray-400 hover:text-white h-8"
                  onClick={() => setShowGuide(g => !g)}
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1" />
                  Kurulum Rehberi
                  {showGuide ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </div>

              {/* ── Kurulum Rehberi ──────────────────────────────────────── */}
              {showGuide && (
                <div className="border border-gray-700/50 rounded-lg p-4 space-y-5 bg-gray-950/60 text-xs">
                  <p className="text-sm font-medium text-white">ServiceNow Kurulum Rehberi</p>
                  <p className="text-gray-400 text-[11px]">
                    Aşağıdaki adımları tamamlayarak ServiceNow&apos;daki Incident değişikliklerini (durum, yorum, atama) CyberStep&apos;e anında iletin.
                  </p>

                  {/* Adım 1 */}
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-200 flex items-center gap-1.5">
                      <span className="bg-violet-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0">1</span>
                      Outbound REST Message Oluşturun
                    </p>
                    <ol className="space-y-1 text-gray-400 text-[11px] pl-6 list-decimal">
                      <li>ServiceNow&apos;da <span className="text-white">Navigator</span> &rarr; <span className="text-violet-400">System Web Services &gt; Outbound &gt; REST Message</span> açın &rarr; <strong className="text-white">New</strong></li>
                      <li><strong className="text-gray-200">Name:</strong> <code className="text-violet-400 bg-gray-900 px-1 rounded">CyberStep Webhook</code></li>
                      <li><strong className="text-gray-200">Endpoint:</strong> Yukarıdaki Webhook URL&apos;ni yapıştırın</li>
                      <li><strong className="text-gray-200">Authentication type:</strong> <code className="text-gray-300 bg-gray-900 px-1 rounded">No authentication</code> (HMAC header ile doğrulanır)</li>
                      <li><span className="text-gray-500">HTTP Methods &rarr; New &rarr; </span><strong className="text-gray-200">Method name:</strong> <code className="text-violet-400 bg-gray-900 px-1 rounded">notify</code>, <strong className="text-gray-200">HTTP method:</strong> POST &rarr; <strong className="text-white">Submit</strong></li>
                    </ol>
                  </div>

                  {/* Adım 2 */}
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-200 flex items-center gap-1.5">
                      <span className="bg-violet-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0">2</span>
                      Business Rule Oluşturun
                    </p>
                    <ol className="space-y-1 text-gray-400 text-[11px] pl-6 list-decimal">
                      <li><span className="text-gray-500">Navigator &rarr; </span><span className="text-violet-400">System Policy &gt; Business Rules</span> &rarr; <strong className="text-white">New</strong></li>
                      <li><strong className="text-gray-200">Table:</strong> <code className="text-gray-300 bg-gray-900 px-1 rounded">Incident [incident]</code> &nbsp;|&nbsp; <strong className="text-gray-200">Name:</strong> <code className="text-violet-400 bg-gray-900 px-1 rounded">CyberStep Webhook Sync</code></li>
                      <li><strong className="text-gray-200">When:</strong> after &nbsp;|&nbsp; <strong className="text-gray-200">Update:</strong> <span className="text-emerald-400">checked</span> &nbsp;|&nbsp; <strong className="text-gray-200">Insert:</strong> <span className="text-emerald-400">checked</span></li>
                      <li><strong className="text-gray-200">Advanced:</strong> <span className="text-emerald-400">checked</span></li>
                      <li><strong className="text-gray-200">Filter Conditions:</strong><br/>
                        <code className="text-[10px] bg-gray-900 px-1.5 py-0.5 rounded text-gray-300 block mt-1">State | changes &nbsp;OR&nbsp; Work notes | changes &nbsp;OR&nbsp; Assigned to | changes</code>
                      </li>
                      <li>Script sekmesine geçin ve aşağıdaki kodu yapıştırın &rarr; <strong className="text-white">Submit</strong></li>
                    </ol>

                    {/* BR Code Block */}
                    <div className="relative mt-2">
                      <pre className="text-[10px] leading-relaxed bg-gray-900 border border-gray-700 rounded-lg p-3 overflow-x-auto text-emerald-400 font-mono whitespace-pre">
{`(function executeRule(current, previous) {
  // ─── CyberStep Webhook Business Rule ─────────────────────────
  // Table  : Incident [incident]
  // When   : after — Update, Insert
  // Kosul  : State | degisir VEYA Work notes | degisir
  //           VEYA Assigned to | degisir
  // ─────────────────────────────────────────────────────────────

  var WEBHOOK_URL    = "${webhookInfo?.webhookUrl ?? "https://YOUR_DOMAIN/api/integrations/servicenow/webhook"}";
  var WEBHOOK_SECRET = "YOUR_HMAC_SECRET"; // Secret Olustur ile uretilen degeri girin

  var payload = JSON.stringify({
    event            : "incident.updated",
    sn_number        : current.number.toString(),
    sn_sys_id        : current.sys_id.toString(),
    sn_state         : parseInt(current.state.toString(), 10),
    short_description: current.short_description.toString(),
    comment          : current.work_notes.getJournalEntry(1),
    assigned_to      : current.assigned_to.getDisplayValue(),
    assignment_group : current.assignment_group.getDisplayValue(),
    updated_at       : current.sys_updated_on.toString()
  });

  // HMAC-SHA256 imzasi (ServiceNow Tokyo / Utah+ gerektirir)
  var sig = GlideDigest.HMACSHA256(WEBHOOK_SECRET, payload);

  var req = new sn_ws.RESTMessageV2();
  req.setEndpoint(WEBHOOK_URL);
  req.setHttpMethod("POST");
  req.setRequestHeader("Content-Type", "application/json");
  req.setRequestHeader("X-SN-Signature", "sha256=" + sig);
  req.setRequestBody(payload);

  try {
    var resp = req.execute();
    if (resp.getStatusCode() < 200 || resp.getStatusCode() >= 300) {
      gs.warn("[CyberStep] Webhook HTTP " + resp.getStatusCode()
              + ": " + resp.getBody());
    }
  } catch (e) {
    gs.error("[CyberStep] Webhook hata: " + e.message);
  }
})(current, previous);`}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 h-7 border-gray-600 text-gray-400 hover:text-white text-[10px]"
                        onClick={() => {
                          const code = `(function executeRule(current, previous) {\n  // ─── CyberStep Webhook Business Rule ─────────────────────────\n  // Table  : Incident [incident]\n  // When   : after — Update, Insert\n  // Kosul  : State | degisir VEYA Work notes | degisir\n  //           VEYA Assigned to | degisir\n  // ─────────────────────────────────────────────────────────────\n\n  var WEBHOOK_URL    = "${webhookInfo?.webhookUrl ?? "https://YOUR_DOMAIN/api/integrations/servicenow/webhook"}";\n  var WEBHOOK_SECRET = "YOUR_HMAC_SECRET"; // Secret Olustur ile uretilen degeri girin\n\n  var payload = JSON.stringify({\n    event            : "incident.updated",\n    sn_number        : current.number.toString(),\n    sn_sys_id        : current.sys_id.toString(),\n    sn_state         : parseInt(current.state.toString(), 10),\n    short_description: current.short_description.toString(),\n    comment          : current.work_notes.getJournalEntry(1),\n    assigned_to      : current.assigned_to.getDisplayValue(),\n    assignment_group : current.assignment_group.getDisplayValue(),\n    updated_at       : current.sys_updated_on.toString()\n  });\n\n  // HMAC-SHA256 imzasi (ServiceNow Tokyo / Utah+ gerektirir)\n  var sig = GlideDigest.HMACSHA256(WEBHOOK_SECRET, payload);\n\n  var req = new sn_ws.RESTMessageV2();\n  req.setEndpoint(WEBHOOK_URL);\n  req.setHttpMethod("POST");\n  req.setRequestHeader("Content-Type", "application/json");\n  req.setRequestHeader("X-SN-Signature", "sha256=" + sig);\n  req.setRequestBody(payload);\n\n  try {\n    var resp = req.execute();\n    if (resp.getStatusCode() < 200 || resp.getStatusCode() >= 300) {\n      gs.warn("[CyberStep] Webhook HTTP " + resp.getStatusCode()\n              + ": " + resp.getBody());\n    }\n  } catch (e) {\n    gs.error("[CyberStep] Webhook hata: " + e.message);\n  }\n})(current, previous);`;
                          navigator.clipboard.writeText(code);
                          setCopiedBR(true);
                          setTimeout(() => setCopiedBR(false), 2000);
                        }}
                      >
                        {copiedBR ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedBR ? "Kopyalandı" : "Kopyala"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-600">
                      Not: <code className="text-gray-500">GlideDigest.HMACSHA256</code> ServiceNow Tokyo (2022) ve sonrasında mevcuttur.
                      Daha eski sürümler için ServiceNow yöneticinizle iletişime geçin.
                    </p>
                  </div>

                  {/* Adım 3 */}
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-200 flex items-center gap-1.5">
                      <span className="bg-violet-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0">3</span>
                      Test Senaryosu
                    </p>
                    <ol className="space-y-1 text-gray-400 text-[11px] pl-6 list-decimal">
                      <li>CyberStep&apos;te bir SOC vakasının ServiceNow&apos;a aktarılmasını bekleyin (veya mevcut bir INC&apos;i bulun)</li>
                      <li>ServiceNow&apos;da o INC&apos;i açın &rarr; <strong className="text-gray-200">State</strong> alanını değiştirin (örn. <em>In Progress</em>) &rarr; <strong className="text-white">Save</strong></li>
                      <li>CyberStep &rarr; Bu sayfada <strong className="text-violet-400">Son ServiceNow Incident&apos;lar</strong> listesini yenileyin — güncellenme zamanının değiştiğini görmelisiniz</li>
                      <li>SOC panonuzda (<span className="text-violet-400">/hesabim/soc</span>) ilgili vakanın aktivite akışında ServiceNow&apos;dan gelen güncelleme notu görünür</li>
                    </ol>
                    <div className="border border-emerald-500/20 bg-emerald-950/20 rounded p-2.5 text-[10px] text-emerald-400 space-y-0.5">
                      <p className="font-medium">Beklenen davranış:</p>
                      <p>· INC state 2 (In Progress) &rarr; SOC aktivite logu: <em>"ServiceNow: Devam Ediyor"</em></p>
                      <p>· INC state 6 (Resolved) &rarr; SOC vakası <em>Kapalı</em> olarak işaretlenir</p>
                      <p>· Work notes eklenmesi &rarr; SOC aktivite loguna yorum eklenir</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {!showForm ? (
              <div className="text-center py-8 border border-dashed border-gray-800 rounded-lg space-y-3">
                <Network className="h-10 w-10 text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm font-medium">ServiceNow bağlı değil</p>
                <p className="text-gray-600 text-xs max-w-sm mx-auto">
                  SOC vakalarını ServiceNow ITSM&apos;inize otomatik olarak aktarın.
                  Her vaka için INC ticket oluşturulur ve çift yönlü senkronize edilir.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowForm(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0 mt-2"
                >
                  <Network className="h-3.5 w-3.5 mr-1" />
                  ServiceNow Bağla
                </Button>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-white">ServiceNow Bağlantı Ayarları</p>
                <div>
                  <Label className="text-gray-400 text-xs">Instance URL <span className="text-red-400">*</span></Label>
                  <Input
                    value={form.instanceUrl}
                    onChange={e => setForm(f => ({ ...f, instanceUrl: e.target.value }))}
                    placeholder="https://dev12345.service-now.com"
                    className="mt-1 bg-gray-900 border-gray-700 text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Kullanıcı Adı <span className="text-red-400">*</span></Label>
                  <Input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="admin"
                    className="mt-1 bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">API Token / Şifre <span className="text-red-400">*</span></Label>
                  <Input
                    type="password"
                    value={form.apiToken}
                    onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))}
                    placeholder="ServiceNow kullanıcı şifresi"
                    className="mt-1 bg-gray-900 border-gray-700 text-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-xs">Assignment Group (opsiyonel)</Label>
                    <Input
                      value={form.assignmentGroup}
                      onChange={e => setForm(f => ({ ...f, assignmentGroup: e.target.value }))}
                      placeholder="Service Desk"
                      className="mt-1 bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Kategori</Label>
                    <Input
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="Software"
                      className="mt-1 bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testConnection}
                    disabled={testing}
                    className="border-gray-700 text-gray-300 text-xs h-8"
                  >
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                    Bağlantıyı Test Et
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !form.instanceUrl || !form.username || !form.apiToken}
                    className="bg-violet-600 hover:bg-violet-700 text-white border-0 h-8"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Kaydet
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-gray-400 h-8">Vazgeç</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Webhook Section ──────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  { value: "soc.case.opened",   label: "SOC vakası açıldı" },
  { value: "soc.case.closed",   label: "SOC vakası kapatıldı" },
  { value: "soc.case.critical", label: "Kritik alarm" },
  { value: "soc.sla.breached",  label: "SLA ihlali" },
  { value: "scan.completed",    label: "Tarama tamamlandı" },
  { value: "report.ready",      label: "Rapor hazır" },
];

function WebhookSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", secret: "", events: ["soc.case.opened","soc.case.closed","soc.case.critical","soc.sla.breached"] as string[] });
  const [testing, setTesting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhook-configs"],
    queryFn: () => fetch("/api/integrations/webhook", { credentials: "include" }).then(r => r.json()) as Promise<{ webhooks: { id: number; name: string; url: string; events: string[]; active: boolean; createdAt: string }[] }>,
  });
  const { data: delivData } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => fetch("/api/integrations/webhook/deliveries", { credentials: "include" }).then(r => r.json()) as Promise<{ deliveries: { id: number; eventType: string; status: string; attempts: number; responseCode: number | null; deliveredAt: string | null; createdAt: string; webhookName: string; url: string }[] }>,
    enabled: showDeliveries,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/webhook", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, secret: form.secret || undefined, events: form.events }),
      });
      if (!r.ok) { const d = await r.json() as { error: string }; throw new Error(d.error); }
    },
    onSuccess: () => {
      toast({ title: "Webhook eklendi" });
      setShowAdd(false);
      setForm({ name: "", url: "", secret: "", events: ["soc.case.opened","soc.case.closed","soc.case.critical","soc.sla.breached"] });
      void qc.invalidateQueries({ queryKey: ["webhook-configs"] });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/integrations/webhook/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { toast({ title: "Webhook silindi" }); void qc.invalidateQueries({ queryKey: ["webhook-configs"] }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  async function handleTest(id: number) {
    setTesting(id);
    try {
      const r = await fetch(`/api/integrations/webhook/${id}/test`, { method: "POST", credentials: "include" });
      const d = await r.json() as { ok: boolean; message: string };
      toast({ title: d.ok ? "Test gönderildi" : "Test başarısız", description: d.message, variant: d.ok ? "default" : "destructive" });
      void qc.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setTesting(null); }
  }

  function toggleEvent(ev: string) {
    setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
  }

  const webhooks = data?.webhooks ?? [];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Webhook className="h-4 w-4 text-emerald-400" />
            Generic Webhook
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
        ) : (
          <>
            {webhooks.length === 0 && !showAdd && (
              <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                <Webhook className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">Webhook tanımlı değil</p>
                <p className="text-gray-500 text-xs mt-1">Zapier, Make, n8n veya kendi endpoint&apos;inize SOC alarmlarını iletin.</p>
              </div>
            )}
            {webhooks.map(wh => (
              <div key={wh.id} className="border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${wh.active ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <span className="text-sm font-medium text-white">{wh.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white"
                      onClick={() => handleTest(wh.id)} disabled={testing === wh.id}>
                      {testing === wh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:text-red-300"
                      onClick={() => deleteMutation.mutate(wh.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate">{wh.url}</p>
                <div className="flex flex-wrap gap-1">
                  {wh.events.map(ev => (
                    <Badge key={ev} variant="outline" className="text-xs border-gray-700 text-gray-400">{ev}</Badge>
                  ))}
                </div>
              </div>
            ))}

            {showAdd && (
              <div className="border border-gray-700 rounded-lg p-4 space-y-4">
                <p className="text-sm font-medium text-white">Yeni Webhook</p>
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs text-gray-400">Ad</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Zapier Webhook" className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">URL <span className="text-red-400">*</span></Label>
                    <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://hooks.zapier.com/..." className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Secret (HMAC imzası için, opsiyonel)</Label>
                    <Input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                      placeholder="gizli-anahtar" type="password" className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 mb-2 block">Olaylar</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map(ev => (
                        <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.events.includes(ev.value)}
                            onChange={() => toggleEvent(ev.value)} className="rounded" />
                          <span className="text-xs text-gray-300">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="text-gray-400 h-8">Vazgeç</Button>
                  <Button size="sm" onClick={() => addMutation.mutate()} disabled={!form.url || addMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 h-8">
                    {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
                  </Button>
                </div>
              </div>
            )}

            {webhooks.length > 0 && (
              <div>
                <button onClick={() => setShowDeliveries(!showDeliveries)}
                  className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDeliveries ? "rotate-180" : ""}`} />
                  Teslimat geçmişi
                </button>
                {showDeliveries && (
                  <div className="mt-3 space-y-1">
                    {(delivData?.deliveries ?? []).slice(0, 10).map(d => (
                      <div key={d.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-800">
                        <span className="text-gray-400">{d.eventType}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{d.webhookName}</span>
                          <Badge variant="outline" className={`text-xs ${d.status === "delivered" ? "border-emerald-700 text-emerald-400" : "border-red-700 text-red-400"}`}>
                            {d.status === "delivered" ? "OK" : "FAIL"}
                          </Badge>
                          {d.responseCode && <span className="text-gray-600">{d.responseCode}</span>}
                        </div>
                      </div>
                    ))}
                    {(delivData?.deliveries ?? []).length === 0 && <p className="text-xs text-gray-600 py-2">Henüz teslimat yok</p>}
                  </div>
                )}
              </div>
            )}

            <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">HMAC-SHA256 Doğrulama</p>
              <p>Her istekte <code className="text-emerald-400">X-CyberStep-Signature: sha256=...</code> başlığı gönderilir.</p>
              <p>Zapier, Make veya n8n ile direkt entegrasyon — 5.000+ uygulamaya bağlanın.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Telegram Section ─────────────────────────────────────────────────────────

function TelegramSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ botToken: "", chatId: "" });
  const [testing, setTesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["telegram-config"],
    queryFn: () => fetch("/api/integrations/telegram", { credentials: "include" }).then(r => r.json()) as Promise<{ config: { id: number; chatId: string; active: boolean; events: string[]; createdAt: string } | null }>,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/telegram", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: form.botToken, chatId: form.chatId }),
      });
      const d = await r.json() as { config?: object; botUsername?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Hata");
      return d;
    },
    onSuccess: (d) => {
      toast({ title: "Telegram bağlandı", description: d.botUsername ? `Bot: @${d.botUsername}` : undefined });
      setShowForm(false);
      setForm({ botToken: "", chatId: "" });
      void qc.invalidateQueries({ queryKey: ["telegram-config"] });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/telegram", { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { toast({ title: "Telegram bağlantısı kesildi" }); void qc.invalidateQueries({ queryKey: ["telegram-config"] }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  async function handleTest() {
    setTesting(true);
    try {
      const r = await fetch("/api/integrations/telegram/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json() as { ok: boolean; message: string };
      toast({ title: d.ok ? "Test mesajı gönderildi" : "Test başarısız", description: d.message, variant: d.ok ? "default" : "destructive" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setTesting(false); }
  }

  const cfg = data?.config;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-sky-400" />
            Telegram Bot
          </CardTitle>
          {cfg?.active && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7"
              onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              <Unplug className="h-3.5 w-3.5 mr-1" /> Kes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
        ) : cfg?.active ? (
          <>
            <div className="border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-white">Bağlı</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-500">Chat ID</span><p className="text-white font-mono mt-0.5">{cfg.chatId}</p></div>
                <div><span className="text-gray-500">Aktif Olaylar</span><p className="text-white mt-0.5">{cfg.events.length} olay</p></div>
              </div>
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 h-8 text-xs w-full"
                onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Test Mesajı Gönder
              </Button>
            </div>
          </>
        ) : (
          <>
            {!showForm ? (
              <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                <Send className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">Telegram bağlı değil</p>
                <p className="text-gray-500 text-xs mt-1">SOC alarmlarını anında Telegram&apos;a iletin.</p>
                <Button size="sm" onClick={() => setShowForm(true)} className="mt-3 bg-sky-600 hover:bg-sky-700 text-xs h-8">
                  Telegram Bağla
                </Button>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg p-4 space-y-4">
                <p className="text-sm font-medium text-white">Telegram Bot Ayarları</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-400">Bot Token <span className="text-red-400">*</span></Label>
                    <Input value={form.botToken} onChange={e => setForm(f => ({ ...f, botToken: e.target.value }))}
                      placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" type="password"
                      className="bg-gray-800 border-gray-700 text-white text-sm mt-1 font-mono" />
                    <p className="text-xs text-gray-500 mt-1">@BotFather&apos;dan alın: /newbot</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Chat ID <span className="text-red-400">*</span></Label>
                    <Input value={form.chatId} onChange={e => setForm(f => ({ ...f, chatId: e.target.value }))}
                      placeholder="-100123456789 veya @kanal_adi"
                      className="bg-gray-800 border-gray-700 text-white text-sm mt-1 font-mono" />
                    <p className="text-xs text-gray-500 mt-1">@userinfobot ile öğrenin veya kanal ID&apos;si girin</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-gray-400 h-8">Vazgeç</Button>
                  <Button size="sm" onClick={() => saveMutation.mutate()}
                    disabled={!form.botToken || !form.chatId || saveMutation.isPending}
                    className="bg-sky-600 hover:bg-sky-700 h-8">
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-300">Kritik alarm &rarr; anında cep telefonuna</p>
          <p>Türkiye&apos;de IT direktörlerinin tercih ettiği kanal. WhatsApp&apos;a bağımlılığı ortadan kaldırır.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── NetGSM SMS Section ───────────────────────────────────────────────────────

function NetgsmSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", header: "CYBERSTEP", phoneNumbers: "", events: ["soc.case.critical","soc.sla.breached"] as string[] });
  const [testing, setTesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["netgsm-config"],
    queryFn: () => fetch("/api/integrations/netgsm", { credentials: "include" }).then(r => r.json()) as Promise<{ config: { id: number; header: string; phoneNumbers: string[]; active: boolean; events: string[]; createdAt: string } | null }>,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const phones = form.phoneNumbers.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
      if (!phones.length) throw new Error("En az 1 telefon numarası girin");
      const r = await fetch("/api/integrations/netgsm", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password, header: form.header, phoneNumbers: phones, events: form.events }),
      });
      const d = await r.json() as { config?: object; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Hata");
      return d;
    },
    onSuccess: () => {
      toast({ title: "NetGSM bağlandı", description: "Kritik alarmlar SMS ile iletilecek." });
      setShowForm(false);
      setForm({ username: "", password: "", header: "CYBERSTEP", phoneNumbers: "", events: ["soc.case.critical","soc.sla.breached"] });
      void qc.invalidateQueries({ queryKey: ["netgsm-config"] });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/netgsm", { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { toast({ title: "NetGSM bağlantısı kesildi" }); void qc.invalidateQueries({ queryKey: ["netgsm-config"] }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  async function handleTest() {
    setTesting(true);
    try {
      const r = await fetch("/api/integrations/netgsm/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json() as { ok: boolean; message: string };
      toast({ title: d.ok ? "SMS gönderildi" : "Test başarısız", description: d.message, variant: d.ok ? "default" : "destructive" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setTesting(false); }
  }

  const cfg = data?.config;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-amber-400" />
            NetGSM SMS
          </CardTitle>
          {cfg?.active && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7"
              onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              <Unplug className="h-3.5 w-3.5 mr-1" /> Kes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
        ) : cfg?.active ? (
          <>
            <div className="border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-white">Bağlı</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-500">Başlık</span><p className="text-white font-mono mt-0.5">{cfg.header}</p></div>
                <div><span className="text-gray-500">Alıcı</span><p className="text-white mt-0.5">{cfg.phoneNumbers.length} numara</p></div>
              </div>
              <div className="text-xs text-gray-500">
                {cfg.phoneNumbers.slice(0, 3).map(p => <span key={p} className="mr-2 font-mono">{p}</span>)}
                {cfg.phoneNumbers.length > 3 && <span>+{cfg.phoneNumbers.length - 3} daha</span>}
              </div>
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 h-8 text-xs w-full"
                onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Smartphone className="h-3.5 w-3.5 mr-1" />}
                Test SMS Gönder
              </Button>
            </div>
          </>
        ) : (
          <>
            {!showForm ? (
              <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                <Smartphone className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">SMS bildirim bağlı değil</p>
                <p className="text-gray-500 text-xs mt-1">Kritik alarmları SMS ile anlık olarak alın.</p>
                <Button size="sm" onClick={() => setShowForm(true)} className="mt-3 bg-amber-600 hover:bg-amber-700 text-xs h-8">
                  NetGSM Bağla
                </Button>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg p-4 space-y-4">
                <p className="text-sm font-medium text-white">NetGSM Ayarları</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">NetGSM Kullanıcı Adı <span className="text-red-400">*</span></Label>
                      <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        placeholder="kullanici_adi" className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Şifre <span className="text-red-400">*</span></Label>
                      <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="netgsm_sifresi" type="password" className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">SMS Başlığı (maks. 11 karakter)</Label>
                    <Input value={form.header} onChange={e => setForm(f => ({ ...f, header: e.target.value.slice(0, 11) }))}
                      placeholder="CYBERSTEP" className="bg-gray-800 border-gray-700 text-white text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Telefon Numaraları <span className="text-red-400">*</span></Label>
                    <textarea value={form.phoneNumbers} onChange={e => setForm(f => ({ ...f, phoneNumbers: e.target.value }))}
                      placeholder={"5551234567\n5559876543"} rows={3}
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm mt-1 rounded-md p-2 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                    <p className="text-xs text-gray-500 mt-1">Her satıra bir numara (başında 0 olmadan)</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-gray-400 h-8">Vazgeç</Button>
                  <Button size="sm" onClick={() => saveMutation.mutate()}
                    disabled={!form.username || !form.password || !form.phoneNumbers || saveMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 h-8">
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-300">WhatsApp bağımlılığını ortadan kaldırın</p>
          <p>Türkiye&apos;nin lider SMS operatörü. Kurumsal ağlarda kısıtlanmaz. Günlük 1.000 SMS birkaç kuruş.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EntegrasyonlarimPage() {
  useRequireCustomer();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ms365_success")) {
      toast({ title: "Microsoft 365 baglantisi kuruldu", description: "Azure AD giris loglari artik izleniyor." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("ms365_error")) {
      const errMap: Record<string, string> = {
        oauth_denied: "Yetkilendirme reddedildi.",
        invalid_state: "Gecersiz oturum durumu. Lutfen tekrar deneyin.",
        token_exchange: "Token alinamadi. Lutfen tekrar deneyin.",
        server: "Sunucu hatasi olustu.",
      };
      toast({
        title: "Microsoft 365 baglantisi basarisiz",
        description: errMap[params.get("ms365_error") ?? ""] ?? "Bilinmeyen hata.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const { data: intData, isLoading } = useQuery<{ integrations: Integration[] }>({
    queryKey: ["obs-integrations"],
    queryFn: () => fetch("/api/portal/integrations/observability", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: evData } = useQuery<{ events: ObsEvent[] }>({
    queryKey: ["obs-events"],
    queryFn: () => fetch("/api/portal/integrations/observability/events", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/integrations/observability/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      toast({ title: "Entegrasyon silindi" });
      qc.invalidateQueries({ queryKey: ["obs-integrations"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/integrations/observability/${id}/test`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => toast({ title: "Test eventi gonderildi" }),
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/integrations/observability/${id}/toggle`, { method: "PATCH", credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json() as Promise<{ isActive: boolean }>;
    },
    onSuccess: (data) => {
      toast({ title: data.isActive ? "Entegrasyon aktiflestirildi" : "Entegrasyon durduruldu" });
      qc.invalidateQueries({ queryKey: ["obs-integrations"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const integrations = intData?.integrations ?? [];
  const events = evData?.events ?? [];

  const datadogList = integrations.filter(i => i.provider === "datadog");
  const azureList = integrations.filter(i => i.provider === "azure_monitor");
  const cloudflareList = integrations.filter(i => i.provider === "cloudflare");

  function timeSince(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} saat önce`;
    return `${Math.floor(h / 24)} gün önce`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Entegrasyonlarim</h1>
          <p className="text-gray-400 text-sm mt-1">
            Guvenlk araclari ve bulut servislerini CyberStep SOC'una yonlendirin.
          </p>
        </div>

        {/* ─── Microsoft 365 / Azure AD ─────────────────────── */}
        <Ms365Section />

        {/* ─── ServiceNow ITSM ─────────────────────────────── */}
        <ServiceNowSection />

        {/* ─── Generic Webhook ─────────────────────────────── */}
        <WebhookSection />

        {/* ─── Telegram Bot ────────────────────────────────── */}
        <TelegramSection />

        {/* ─── NetGSM SMS ──────────────────────────────────── */}
        <NetgsmSection />

        {/* ─── Datadog ─────────────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-400" /> Datadog
              </CardTitle>
              {!isLoading && <AddIntegrationCard provider="datadog" onAdd={() => qc.invalidateQueries({ queryKey: ["obs-integrations"] })} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
            ) : datadogList.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-800 rounded-lg">
                Henuz Datadog entegrasyonu yok.
              </div>
            ) : (
              datadogList.map(integ => (
                <div key={integ.id} className="border border-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{integ.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {integ.eventCount} event
                        {integ.lastEventAt ? ` · Son: ${timeSince(integ.lastEventAt)}` : " · Henuz event yok"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => testMutation.mutate(integ.id)} className="text-gray-400 text-xs h-7">
                        Test
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(integ.id)} className="text-red-400 hover:text-red-300 h-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Webhook URL:</p>
                    <WebhookUrl token={integ.webhookToken} provider="datadog" />
                  </div>
                  <div className="border border-gray-800 rounded p-3 bg-gray-950/50 text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-300">Datadog'da yapilacaklar:</p>
                    <p>1. Monitors → Edit Monitor → Notifications</p>
                    <p>2. "Notify your services" alanina @webhook-cyberstep ekleyin</p>
                    <p>3. Integrations → Webhooks → URL olarak yukardaki adresi girin</p>
                    <a href="https://docs.datadoghq.com/integrations/webhooks/" target="_blank" rel="noreferrer"
                       className="text-blue-400 hover:underline inline-flex items-center gap-1 mt-1">
                      Dokumantasyon <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ─── Azure Monitor ────────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-400" /> Azure Monitor
              </CardTitle>
              {!isLoading && <AddIntegrationCard provider="azure_monitor" onAdd={() => qc.invalidateQueries({ queryKey: ["obs-integrations"] })} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
            ) : azureList.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-800 rounded-lg">
                Henuz Azure Monitor entegrasyonu yok.
              </div>
            ) : (
              azureList.map(integ => (
                <div key={integ.id} className="border border-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{integ.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {integ.eventCount} event
                        {integ.lastEventAt ? ` · Son: ${timeSince(integ.lastEventAt)}` : " · Henuz event yok"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => testMutation.mutate(integ.id)} className="text-gray-400 text-xs h-7">
                        Test
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(integ.id)} className="text-red-400 hover:text-red-300 h-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Webhook URL:</p>
                    <WebhookUrl token={integ.webhookToken} provider="azure" />
                  </div>
                  <div className="border border-gray-800 rounded p-3 bg-gray-950/50 text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-300">Azure Portal'da yapilacaklar:</p>
                    <p>1. Monitor → Alerts → Action Groups → + Create</p>
                    <p>2. Action Type: Webhook → URL'yi girin</p>
                    <p>3. Alert Rules'ta bu Action Group'u seciniz</p>
                    <p className="text-yellow-500/80 mt-1">KVKK Notu: Azure Turkey North bolgesinde calisiyorsaniz verileriniz Turkiye'de kalir.</p>
                    <a href="https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups" target="_blank" rel="noreferrer"
                       className="text-blue-400 hover:underline inline-flex items-center gap-1 mt-1">
                      Dokumantasyon <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ─── Cloudflare ───────────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-400" /> Cloudflare
              </CardTitle>
              {!isLoading && <AddIntegrationCard provider="cloudflare" onAdd={() => qc.invalidateQueries({ queryKey: ["obs-integrations"] })} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
            ) : cloudflareList.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-800 rounded-lg">
                Henuz Cloudflare entegrasyonu yok.
              </div>
            ) : (
              cloudflareList.map(integ => {
                const last5 = events.filter(e => e.provider === "cloudflare").slice(0, 5);
                return (
                  <div key={integ.id} className="border border-gray-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{integ.displayName}</p>
                          <Badge className={integ.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]"}>
                            {integ.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {integ.eventCount} event
                          {integ.lastEventAt ? ` · Son: ${timeSince(integ.lastEventAt)}` : " · Henuz event yok"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleMutation.mutate(integ.id)}
                          disabled={toggleMutation.isPending}
                          className={`border-gray-700 text-xs h-7 ${integ.isActive ? "text-yellow-400 hover:text-yellow-300" : "text-emerald-400 hover:text-emerald-300"}`}
                        >
                          {integ.isActive ? "Durdur" : "Baslat"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => testMutation.mutate(integ.id)} className="text-gray-400 text-xs h-7">
                          Test
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(integ.id)} className="text-red-400 hover:text-red-300 h-7">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Webhook URL:</p>
                      <WebhookUrl token={integ.webhookToken} provider="cloudflare" />
                    </div>
                    {last5.length > 0 && (
                      <div className="border border-gray-800 rounded p-3 bg-gray-950/50 space-y-1.5">
                        <p className="text-xs font-medium text-gray-400 mb-2">Son 5 Cloudflare Olayi</p>
                        {last5.map(ev => (
                          <div key={ev.id} className="flex items-center gap-2">
                            <Badge className={`text-[10px] shrink-0 border ${SEV_COLORS[ev.severity ?? "info"] ?? SEV_COLORS["info"]}`}>
                              {(ev.severity ?? "info").toUpperCase()}
                            </Badge>
                            <p className="text-xs text-gray-300 truncate flex-1">{ev.title}</p>
                            <span className="text-[10px] text-gray-600 shrink-0">{timeSince(ev.receivedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border border-gray-800 rounded p-3 bg-gray-950/50 text-xs text-gray-400 space-y-1">
                      <p className="font-medium text-gray-300">Cloudflare'de yapilacaklar:</p>
                      <p>1. Cloudflare Dashboard → Notifications → Add Notification</p>
                      <p>2. Tip secin: WAF Alerts / DDoS / Bot Management</p>
                      <p>3. Delivery Method: Webhook → URL olarak yukardaki adresi girin</p>
                      <p>4. Desteklenen olay tipleri: WAF Block, DDoS, Bot Score, DNS Anomaly</p>
                      <a href="https://developers.cloudflare.com/notifications/get-started/" target="_blank" rel="noreferrer"
                         className="text-blue-400 hover:underline inline-flex items-center gap-1 mt-1">
                        Dokumantasyon <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* ─── Son Event'ler ────────────────────────────────── */}
        {events.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Son Gelen Eventler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events.slice(0, 20).map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <Badge className={`text-[10px] shrink-0 border ${SEV_COLORS[ev.severity ?? "info"] ?? SEV_COLORS["info"]}`}>
                      {ev.severity?.toUpperCase() ?? "INFO"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500">
                        {PROVIDER_LABELS[ev.provider] ?? ev.provider} · {ev.eventType}
                        {ev.affectedService ? ` · ${ev.affectedService}` : ""}
                        {" · "}{timeSince(ev.receivedAt)}
                      </p>
                    </div>
                    {ev.processed && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
