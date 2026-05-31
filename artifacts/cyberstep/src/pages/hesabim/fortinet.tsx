import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, Loader2, CheckCircle2, AlertTriangle, Copy, Server,
  Activity, Ban, Network, PlayCircle, RefreshCw, ChevronRight, Lock, ShieldOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface Integration {
  id: number;
  name: string;
  setupStep: number;
  status: "pending" | "connected" | "error" | "disabled";
  demoMode: boolean;
  webhookToken: string;
  syslogToken: string;
  autoBlockEnabled: boolean;
  fmConfigured: boolean;
  fmUrl: string | null;
  fmUsername: string | null;
  fmAdom: string | null;
  fmBlockGroup: string | null;
  fmStatus: "unconfigured" | "ok" | "error";
  fmLastError: string | null;
  alertEmail: string | null;
  fabricDevices: Array<{ name: string; type: string; serial?: string; ip?: string; version?: string }>;
  eventsReceived: number;
  correlationsCount: number;
  blocksCount: number;
  lastEventAt: string | null;
}

interface Correlation {
  id: number;
  title: string;
  narrative: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  killChainStage: string | null;
  mitreTactics: Array<{ id: string; name: string }>;
  recommendedAction: string | null;
  suspectIps: string[];
  autoBlocked: boolean;
  alertSent: boolean;
  createdAt: string;
}

interface FabricEventRow {
  id: number;
  eventType: string;
  severity: string;
  action: string | null;
  srcIp: string | null;
  dstIp: string | null;
  attackName: string | null;
  deviceName: string | null;
  createdAt: string;
}

interface BlockAction {
  id: number;
  ip: string;
  reason: string | null;
  status: "pending" | "success" | "error" | "verified" | "removed";
  message: string | null;
  createdAt: string;
}

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: "Kritik", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "Yüksek", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  medium: { label: "Orta", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  low: { label: "Düşük", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  info: { label: "Bilgi", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

export default function FortinetEntegrasyonu() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customer } = useRequireCustomer();
  const base = window.location.origin;

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  const { data: integration, isLoading } = useQuery<Integration>({
    queryKey: ["fabric-status"],
    queryFn: () => fetch("/api/portal/fabric/status", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
  });

  const { data: correlations = [] } = useQuery<Correlation[]>({
    queryKey: ["fabric-correlations"],
    queryFn: () => fetch("/api/portal/fabric/correlations", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && integration?.setupStep === 5,
    refetchInterval: 15000,
  });

  const { data: events = [] } = useQuery<FabricEventRow[]>({
    queryKey: ["fabric-events"],
    queryFn: () => fetch("/api/portal/fabric/events?limit=30", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && integration?.setupStep === 5,
    refetchInterval: 15000,
  });

  const { data: blocks = [] } = useQuery<BlockAction[]>({
    queryKey: ["fabric-blocks"],
    queryFn: () => fetch("/api/portal/fabric/blocks", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && integration?.setupStep === 5,
    refetchInterval: 20000,
  });

  const setup = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/portal/fabric/setup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fabric-status"] }),
  });

  const demo = useMutation({
    mutationFn: () => fetch("/api/portal/fabric/demo", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Demo verisi oluşturuldu", description: "Örnek saldırı senaryosu analiz edildi." });
      qc.invalidateQueries({ queryKey: ["fabric-status"] });
      qc.invalidateQueries({ queryKey: ["fabric-correlations"] });
      qc.invalidateQueries({ queryKey: ["fabric-events"] });
    },
    onError: () => toast({ title: "Hata", description: "Demo oluşturulamadı.", variant: "destructive" }),
  });

  const correlate = useMutation({
    mutationFn: () => fetch("/api/portal/fabric/correlate", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (d: { created: boolean; message?: string }) => {
      toast({ title: d.created ? "Yeni korelasyon oluşturuldu" : "Yeni olay yok", description: d.message });
      qc.invalidateQueries({ queryKey: ["fabric-correlations"] });
      qc.invalidateQueries({ queryKey: ["fabric-events"] });
      qc.invalidateQueries({ queryKey: ["fabric-status"] });
    },
  });

  if (!customer) return null;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} kopyalandı` }));
  };

  const step = integration?.setupStep ?? 1;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-500" />
              <span className="font-bold text-lg text-white">CyberStep.io</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/hesabim" className="text-slate-400 hover:text-white text-sm transition-colors">Hesabım</Link>
              <Link href="/raporlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Raporlarım</Link>
              <Link href="/entegrasyonlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Entegrasyonlar</Link>
              <Link href="/hesabim/fortinet-entegrasyonu" className="text-white text-sm font-medium">Fortinet</Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => logout.mutate()}>
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="h-6 w-6 text-emerald-400" /> Fortinet Security Fabric
          </h1>
          <p className="text-slate-400 mt-1">
            FortiGate ve FortiAnalyzer olaylarınızı CyberStep'e bağlayın; yapay zeka tehditleri ilişkilendirsin, gerektiğinde otomatik engellesin.
          </p>
        </div>

        {isLoading || !integration ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...</div>
        ) : step === 5 ? (
          <Dashboard
            integration={integration}
            correlations={correlations}
            events={events}
            blocks={blocks}
            onDemo={() => demo.mutate()}
            demoLoading={demo.isPending}
            onCorrelate={() => correlate.mutate()}
            correlateLoading={correlate.isPending}
          />
        ) : (
          <Wizard
            integration={integration}
            base={base}
            step={step}
            onCopy={copy}
            onSetup={(b) => setup.mutate(b)}
            setupLoading={setup.isPending}
            onDemo={() => demo.mutate()}
            demoLoading={demo.isPending}
          />
        )}
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

const STEPS = ["Genel Bakış", "Olay Akışı", "Bildirimler", "Otomatik Engelleme", "Tamamlandı"];

function Wizard(props: {
  integration: Integration; base: string; step: number;
  onCopy: (t: string, l: string) => void;
  onSetup: (b: Record<string, unknown>) => void; setupLoading: boolean;
  onDemo: () => void; demoLoading: boolean;
}) {
  const { integration, base, step, onCopy, onSetup, setupLoading, onDemo, demoLoading } = props;
  const webhookUrl = `${base}/api/fabric/webhook/${integration.webhookToken}`;
  const syslogUrl = `${base}/api/fabric/syslog/${integration.syslogToken}`;
  const [alertEmail, setAlertEmail] = useState(integration.alertEmail ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : done ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-800 text-slate-500"}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="w-4 text-center">{n}</span>}
                {label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-700" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Nasıl Çalışır?</CardTitle>
            <CardDescription>Kurulum tamamen güvenli ve dışa açık port gerektirmez.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300 text-sm">
            <div className="grid sm:grid-cols-3 gap-4">
              <InfoBox icon={<Server className="h-5 w-5 text-emerald-400" />} title="1. Olayları Gönderin" desc="FortiGate/FortiAnalyzer cihazınız olayları güvenli HTTPS bağlantısıyla bize iletir. Açık port gerekmez." />
              <InfoBox icon={<Activity className="h-5 w-5 text-emerald-400" />} title="2. AI İlişkilendirir" desc="Yapay zeka, dağınık olayları anlamlı saldırı senaryolarına dönüştürür ve sade Türkçe açıklar." />
              <InfoBox icon={<Ban className="h-5 w-5 text-emerald-400" />} title="3. Otomatik Engelleme" desc="İsterseniz FortiManager üzerinden şüpheli IP'leri otomatik engelleyebiliriz (opsiyonel)." />
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-blue-200 text-xs flex gap-2">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              Tüm trafik sadece HTTPS üzerinden alınır. Ham syslog (UDP/TCP) kabul edilmez; bu daha güvenlidir.
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" className="text-slate-400" onClick={onDemo} disabled={demoLoading}>
                {demoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                Demo verisiyle dene
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onSetup({ setupStep: 2 })} disabled={setupLoading}>
                Devam Et <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Olay Akışını Bağlayın</CardTitle>
            <CardDescription>Aşağıdaki adresi FortiGate veya FortiAnalyzer'ınızda webhook/HTTPS log forwarder olarak tanımlayın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <TokenField label="Webhook / HTTPS URL" value={webhookUrl} onCopy={() => onCopy(webhookUrl, "Webhook adresi")} />
            <TokenField label="Syslog-over-HTTPS URL" value={syslogUrl} onCopy={() => onCopy(syslogUrl, "Syslog adresi")} />
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-slate-300 text-xs space-y-2">
              <p className="font-medium text-slate-200">FortiGate kısa kurulum:</p>
              <p>Log &amp; Report &gt; Log Settings &gt; bir HTTPS/webhook hedefi ekleyin ve yukarıdaki adresi girin. Format olarak JSON, CEF veya FortiLog (key=value) desteklenir.</p>
              <p className="text-amber-300/80">Not: Replit IP adresleri sabit değildir; FortiManager kullanacaksanız "Trusted Hosts" ayarını buna göre yapın.</p>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" className="text-slate-400" onClick={() => onSetup({ setupStep: 1 })}>Geri</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="border-slate-700" onClick={onDemo} disabled={demoLoading}>
                  {demoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />} Demo
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onSetup({ setupStep: 3 })} disabled={setupLoading}>Devam Et</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Bildirim E-postası</CardTitle>
            <CardDescription>Kritik ve yüksek önemli tehditler tespit edildiğinde bu adrese e-posta gönderilir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Uyarı E-posta Adresi</Label>
              <Input value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="guvenlik@sirketiniz.com"
                className="bg-slate-800 border-slate-700 text-white mt-1" />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" className="text-slate-400" onClick={() => onSetup({ setupStep: 2 })}>Geri</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onSetup({ setupStep: 4, alertEmail })} disabled={setupLoading}>Devam Et</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <FortiManagerStep integration={integration} onBack={() => onSetup({ setupStep: 3 })} onFinish={() => onSetup({ setupStep: 5 })} finishLoading={setupLoading} />
      )}
    </div>
  );
}

function FortiManagerStep(props: { integration: Integration; onBack: () => void; onFinish: () => void; finishLoading: boolean }) {
  const { integration, onBack, onFinish, finishLoading } = props;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(integration.autoBlockEnabled);
  const [form, setForm] = useState({
    fmUrl: integration.fmUrl ?? "", fmUsername: integration.fmUsername ?? "", fmPassword: "",
    fmAdom: integration.fmAdom ?? "root", fmBlockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
  });

  const save = useMutation({
    mutationFn: () => fetch("/api/portal/fabric/fortimanager", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    }).then(r => r.json()),
    onSuccess: (d: { ok: boolean; message: string }) => {
      toast({ title: d.ok ? "FortiManager bağlandı" : "Bağlantı başarısız", description: d.message, variant: d.ok ? "default" : "destructive" });
      qc.invalidateQueries({ queryKey: ["fabric-status"] });
    },
    onError: () => toast({ title: "Hata", description: "Kaydedilemedi.", variant: "destructive" }),
  });

  const toggleAuto = (v: boolean) => {
    setEnabled(v);
    fetch("/api/portal/fabric/setup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoBlockEnabled: v }) })
      .then(() => qc.invalidateQueries({ queryKey: ["fabric-status"] }));
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white">Otomatik Engelleme (Opsiyonel)</CardTitle>
        <CardDescription>FortiManager bağlarsanız, AI yüksek güvenli tehditlerde şüpheli IP'leri otomatik engelleyebilir. Bu adım zorunlu değildir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <div>
            <p className="text-white text-sm font-medium">Otomatik engellemeyi etkinleştir</p>
            <p className="text-slate-400 text-xs">Yalnızca yüksek güven skorlu korelasyonlarda devreye girer.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleAuto} />
        </div>

        {enabled && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-slate-300">FortiManager URL</Label><Input value={form.fmUrl} onChange={(e) => setForm({ ...form, fmUrl: e.target.value })} placeholder="https://fmg.sirket.com" className="bg-slate-800 border-slate-700 text-white mt-1" /></div>
              <div><Label className="text-slate-300">Kullanıcı Adı</Label><Input value={form.fmUsername} onChange={(e) => setForm({ ...form, fmUsername: e.target.value })} className="bg-slate-800 border-slate-700 text-white mt-1" /></div>
              <div><Label className="text-slate-300">Parola</Label><Input type="password" value={form.fmPassword} onChange={(e) => setForm({ ...form, fmPassword: e.target.value })} placeholder="••••••••" className="bg-slate-800 border-slate-700 text-white mt-1" /></div>
              <div><Label className="text-slate-300">ADOM</Label><Input value={form.fmAdom} onChange={(e) => setForm({ ...form, fmAdom: e.target.value })} className="bg-slate-800 border-slate-700 text-white mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-slate-300">Engelleme Grubu (Address Group)</Label><Input value={form.fmBlockGroup} onChange={(e) => setForm({ ...form, fmBlockGroup: e.target.value })} className="bg-slate-800 border-slate-700 text-white mt-1" /></div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-amber-200 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Parolanız AES-256 ile şifrelenerek saklanır. Replit egress IP'leri sabit olmadığından FortiManager Trusted Hosts ayarını geniş tutmanız gerekebilir.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-slate-700" onClick={() => save.mutate()} disabled={save.isPending || !form.fmUrl || !form.fmUsername || !form.fmPassword}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Bağlantıyı Test Et ve Kaydet
              </Button>
              {integration.fmStatus === "ok" && <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Bağlı</span>}
              {integration.fmStatus === "error" && <span className="text-red-400 text-xs">{integration.fmLastError}</span>}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" className="text-slate-400" onClick={onBack}>Geri</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={onFinish} disabled={finishLoading}>
            {finishLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Kurulumu Tamamla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function Dashboard(props: {
  integration: Integration; correlations: Correlation[]; events: FabricEventRow[]; blocks: BlockAction[];
  onDemo: () => void; demoLoading: boolean; onCorrelate: () => void; correlateLoading: boolean;
}) {
  const { integration, correlations, events, blocks, onDemo, demoLoading, onCorrelate, correlateLoading } = props;
  const qc = useQueryClient();
  const { toast } = useToast();

  const unblock = useMutation({
    mutationFn: (ip: string) =>
      fetch("/api/portal/fabric/unblock", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip }) }).then(r => r.json()),
    onSuccess: (d: { ok: boolean; message?: string }) => {
      toast({ title: d.ok ? "Engelleme kaldırıldı" : "Engelleme kaldırılamadı", description: d.message, variant: d.ok ? undefined : "destructive" });
      qc.invalidateQueries({ queryKey: ["fabric-blocks"] });
      qc.invalidateQueries({ queryKey: ["fabric-status"] });
    },
    onError: () => toast({ title: "Engelleme kaldırılamadı", variant: "destructive" }),
  });

  const reconfigure = () => {
    fetch("/api/portal/fabric/setup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupStep: 1 }) })
      .then(() => { qc.invalidateQueries({ queryKey: ["fabric-status"] }); toast({ title: "Kurulum sihirbazı açıldı" }); });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={integration.status} />
          {integration.demoMode && <Badge variant="outline" className="border-blue-500/40 text-blue-300">Demo Modu</Badge>}
          {integration.lastEventAt && <span className="text-slate-500 text-xs">Son olay: {fmtDate(integration.lastEventAt)}</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-700" onClick={onDemo} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />} Demo Üret
          </Button>
          <Button size="sm" variant="outline" className="border-slate-700" onClick={onCorrelate} disabled={correlateLoading}>
            {correlateLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Şimdi Analiz Et
          </Button>
          <Button size="sm" variant="ghost" className="text-slate-400" onClick={reconfigure}>Ayarlar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Alınan Olay" value={integration.eventsReceived} />
        <StatCard icon={<Shield className="h-4 w-4" />} label="Korelasyon" value={integration.correlationsCount} />
        <StatCard icon={<Ban className="h-4 w-4" />} label="Engellenen IP" value={integration.blocksCount} />
        <StatCard icon={<Server className="h-4 w-4" />} label="Fabric Cihaz" value={integration.fabricDevices.length} />
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-lg">Tehdit Senaryoları</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {correlations.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">Henüz korelasyon yok. Olaylar geldikçe AI senaryolar oluşturacak.</p>
          ) : correlations.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={SEV[c.severity]?.cls}>{SEV[c.severity]?.label}</Badge>
                    {c.killChainStage && <span className="text-slate-400 text-xs">{c.killChainStage}</span>}
                    <span className="text-slate-500 text-xs">Güven %{c.confidence}</span>
                    {c.autoBlocked && <Badge variant="outline" className="border-red-500/40 text-red-300">Otomatik Engellendi</Badge>}
                  </div>
                  <h3 className="text-white font-medium mt-2">{c.title}</h3>
                  <p className="text-slate-300 text-sm mt-1 leading-relaxed">{c.narrative}</p>
                  {c.recommendedAction && (
                    <p className="text-emerald-300 text-xs mt-2"><span className="font-medium">Önerilen aksiyon:</span> {c.recommendedAction}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {c.mitreTactics.map((t) => <Badge key={t.id} variant="secondary" className="bg-slate-700 text-slate-200 text-[10px]">{t.id} {t.name}</Badge>)}
                  </div>
                  {c.suspectIps.length > 0 && <p className="text-slate-500 text-xs mt-2">Şüpheli IP: {c.suspectIps.join(", ")}</p>}
                </div>
                <span className="text-slate-600 text-xs whitespace-nowrap">{fmtDate(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-lg">Son Olaylar</CardTitle></CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">Henüz olay alınmadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left p-3">Önem</th><th className="text-left p-3">Tür</th><th className="text-left p-3">Saldırı</th>
                  <th className="text-left p-3">Kaynak</th><th className="text-left p-3">Hedef</th><th className="text-left p-3">Cihaz</th><th className="text-left p-3">Zaman</th>
                </tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-slate-800/60 text-slate-300">
                      <td className="p-3"><Badge variant="outline" className={SEV[e.severity]?.cls}>{SEV[e.severity]?.label ?? e.severity}</Badge></td>
                      <td className="p-3">{e.eventType}</td>
                      <td className="p-3">{e.attackName ?? "-"}</td>
                      <td className="p-3 font-mono text-xs">{e.srcIp ?? "-"}</td>
                      <td className="p-3 font-mono text-xs">{e.dstIp ?? "-"}</td>
                      <td className="p-3">{e.deviceName ?? "-"}</td>
                      <td className="p-3 text-xs text-slate-500">{fmtDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-lg">Engelleme Geçmişi</CardTitle></CardHeader>
        <CardContent className="p-0">
          {blocks.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">Henüz engellenen IP yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left p-3">IP</th><th className="text-left p-3">Neden</th>
                  <th className="text-left p-3">Durum</th><th className="text-left p-3">Zaman</th>
                  <th className="text-right p-3">İşlem</th>
                </tr></thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.id} className="border-b border-slate-800/60 text-slate-300">
                      <td className="p-3 font-mono text-xs">{b.ip}</td>
                      <td className="p-3">{b.reason ?? "-"}</td>
                      <td className="p-3"><Badge variant="outline" className={BLOCK_STATUS[b.status]?.cls}>{BLOCK_STATUS[b.status]?.label ?? b.status}</Badge></td>
                      <td className="p-3 text-xs text-slate-500">{fmtDate(b.createdAt)}</td>
                      <td className="p-3 text-right">
                        {b.status !== "removed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:text-emerald-300 h-7 text-xs"
                            onClick={() => unblock.mutate(b.ip)}
                            disabled={unblock.isPending && unblock.variables === b.ip}
                          >
                            {unblock.isPending && unblock.variables === b.ip
                              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              : <ShieldOff className="h-3 w-3 mr-1" />}
                            Engellemeyi kaldır
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-lg">Keşfedilen Fabric Cihazları</CardTitle></CardHeader>
        <CardContent>
          {integration.fabricDevices.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">Henüz cihaz keşfedilmedi. FortiManager bağlıysa gece taramasında listelenir.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {integration.fabricDevices.map((d, i) => (
                <div key={`${d.name}-${i}`} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-emerald-400" />
                    <span className="text-white font-medium text-sm">{d.name}</span>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 text-[10px]">{d.type}</Badge>
                  </div>
                  <div className="text-slate-500 text-xs mt-2 space-y-0.5">
                    {d.ip && <p>IP: <span className="font-mono">{d.ip}</span></p>}
                    {d.serial && <p>Seri: <span className="font-mono">{d.serial}</span></p>}
                    {d.version && <p>Sürüm: {d.version}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const BLOCK_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Bekliyor", cls: "border-yellow-500/40 text-yellow-300" },
  success: { label: "Engellendi", cls: "border-emerald-500/40 text-emerald-300" },
  verified: { label: "Doğrulandı", cls: "border-emerald-500/40 text-emerald-300" },
  error: { label: "Hata", cls: "border-red-500/40 text-red-300" },
  removed: { label: "Kaldırıldı", cls: "border-slate-500/40 text-slate-400" },
};

// ─── Small components ───────────────────────────────────────────────────────

function InfoBox(props: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
      <div className="mb-2">{props.icon}</div>
      <p className="text-white font-medium text-sm">{props.title}</p>
      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{props.desc}</p>
    </div>
  );
}

function TokenField(props: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <Label className="text-slate-300">{props.label}</Label>
      <div className="flex gap-2 mt-1">
        <Input readOnly value={props.value} className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-xs" />
        <Button variant="outline" size="icon" className="border-slate-700 shrink-0" onClick={props.onCopy}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function StatCard(props: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs">{props.icon} {props.label}</div>
        <p className="text-2xl font-bold text-white mt-1">{props.value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Integration["status"] }) {
  const map: Record<Integration["status"], { label: string; cls: string }> = {
    connected: { label: "Bağlı", cls: "border-emerald-500/40 text-emerald-300" },
    pending: { label: "Bekliyor", cls: "border-yellow-500/40 text-yellow-300" },
    error: { label: "Hata", cls: "border-red-500/40 text-red-300" },
    disabled: { label: "Devre Dışı", cls: "border-slate-600 text-slate-400" },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}
