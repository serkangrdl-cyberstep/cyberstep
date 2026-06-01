import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Trash2, Copy, CheckCircle, AlertTriangle, Plus, ExternalLink, Loader2, Building2, Shield, Clock, Unplug } from "lucide-react";
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
