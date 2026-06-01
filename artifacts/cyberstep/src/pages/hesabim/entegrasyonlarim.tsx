import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Trash2, Copy, CheckCircle, AlertTriangle, Plus, ExternalLink, Loader2 } from "lucide-react";
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

function AddIntegrationCard({ provider, onAdd }: { provider: "datadog" | "azure_monitor"; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/portal/integrations/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, displayName: displayName || PROVIDER_LABELS[provider] }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Entegrasyon oluşturuldu", description: "Webhook URL'nizi kopyalayıp kaydedin." });
      qc.invalidateQueries({ queryKey: ["obs-integrations"] });
      setOpen(false);
      setDisplayName("");
      onAdd();
    },
    onError: () => toast({ title: "Hata", description: "Entegrasyon oluşturulamadı.", variant: "destructive" }),
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
      <p className="text-sm font-medium text-white">{PROVIDER_LABELS[provider]} Entegrasyon Adı</p>
      <div>
        <Label className="text-gray-400 text-xs">Görünen Ad (opsiyonel)</Label>
        <Input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder={`${PROVIDER_LABELS[provider]} Entegrasyonu`}
          className="mt-1 bg-gray-900 border-gray-700 text-white"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
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

export default function EntegrasyonlarimPage() {
  useRequireCustomer();
  const { toast } = useToast();
  const qc = useQueryClient();

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

  const integrations = intData?.integrations ?? [];
  const events = evData?.events ?? [];

  const datadogList = integrations.filter(i => i.provider === "datadog");
  const azureList = integrations.filter(i => i.provider === "azure_monitor");

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
          <h1 className="text-2xl font-bold text-white">Observability Entegrasyonlar</h1>
          <p className="text-gray-400 text-sm mt-1">
            Datadog ve Azure Monitor alertlarini CyberStep SOC'una yonlendirin.
          </p>
        </div>

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
