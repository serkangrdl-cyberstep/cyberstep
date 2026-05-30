import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, Plus, Trash2, TestTube2, CheckCircle2, XCircle,
  Settings2, ChevronRight, Zap, AlertTriangle, RefreshCw, Clock,
  ExternalLink, Info, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRequireCustomer } from "@/hooks/use-customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationType = "jira" | "forti_manager" | "qradar" | "forti_siem" | "crowdstrike" | "trend_micro";

interface Integration {
  id: number;
  type: IntegrationType;
  name: string;
  config: Record<string, string>;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "error" | null;
  lastSyncError: string | null;
  createdAt: string;
}

interface IntegrationEvent {
  id: number;
  eventType: string;
  status: "success" | "error" | "pending";
  summary: string | null;
  itemsPushed: number;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Integration metadata ─────────────────────────────────────────────────────

const INTEGRATION_META: Record<IntegrationType, {
  label: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; required?: boolean; hint?: string }>;
}> = {
  jira: {
    label: "Jira",
    description: "Kritik bulgular için otomatik Jira ticket oluştur",
    category: "Ticket Yönetimi",
    color: "text-blue-400",
    icon: "J",
    fields: [
      { key: "url", label: "Jira URL", placeholder: "https://company.atlassian.net", required: true },
      { key: "email", label: "E-posta", placeholder: "admin@company.com", required: true },
      { key: "apiToken", label: "API Token", placeholder: "ATATT3x...", secret: true, required: true, hint: "Jira hesap ayarlarından API token alın" },
      { key: "projectKey", label: "Proje Anahtarı", placeholder: "SEC", required: true },
      { key: "issueType", label: "Issue Türü", placeholder: "Bug" },
    ],
  },
  forti_manager: {
    label: "FortiManager",
    description: "Tehdit istihbaratından IP'leri güvenlik duvarı engel listesine aktar",
    category: "Güvenlik Duvarı",
    color: "text-red-400",
    icon: "FM",
    fields: [
      { key: "url", label: "FortiManager URL", placeholder: "https://fortimanager.company.com", required: true },
      { key: "username", label: "Kullanıcı Adı", placeholder: "admin", required: true },
      { key: "password", label: "Parola", placeholder: "••••••••", secret: true, required: true },
      { key: "adom", label: "ADOM", placeholder: "root", required: true, hint: "Administrative Domain adı" },
      { key: "addrGroupName", label: "Adres Grubu", placeholder: "CyberStep-Blocklist" },
    ],
  },
  qradar: {
    label: "IBM QRadar",
    description: "Tarama bulgularını SIEM'e olay olarak gönder",
    category: "SIEM",
    color: "text-purple-400",
    icon: "QR",
    fields: [
      { key: "url", label: "QRadar URL", placeholder: "https://qradar.company.com", required: true },
      { key: "apiToken", label: "API Token", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: true, required: true },
      { key: "logSourceId", label: "Log Source ID", placeholder: "123", hint: "Opsiyonel — belirli bir log kaynağına yönlendir" },
    ],
  },
  forti_siem: {
    label: "FortiSIEM",
    description: "Güvenlik olaylarını FortiSIEM'e otomatik aktar",
    category: "SIEM",
    color: "text-orange-400",
    icon: "FS",
    fields: [
      { key: "url", label: "FortiSIEM URL", placeholder: "https://fortisiem.company.com", required: true },
      { key: "username", label: "Kullanıcı Adı", placeholder: "admin", required: true },
      { key: "password", label: "Parola", placeholder: "••••••••", secret: true, required: true },
      { key: "organization", label: "Organizasyon", placeholder: "Super", required: true },
    ],
  },
  crowdstrike: {
    label: "CrowdStrike Falcon",
    description: "IOC'leri CrowdStrike platformuna otomatik yükle",
    category: "EDR",
    color: "text-red-500",
    icon: "CS",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true, required: true },
      { key: "baseUrl", label: "Base URL", placeholder: "https://api.crowdstrike.com", hint: "Varsayılan: https://api.crowdstrike.com" },
    ],
  },
  trend_micro: {
    label: "Trend Micro Vision One",
    description: "Şüpheli nesneleri Vision One engel listesine aktar",
    category: "EDR",
    color: "text-red-400",
    icon: "TM",
    fields: [
      { key: "apiToken", label: "API Token", placeholder: "eyJhbGciOi...", secret: true, required: true },
      { key: "region", label: "Bölge", placeholder: "eu", hint: "eu / us / ap / au / in / sg / jp" },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerIntegrations() {
  const { data: customer } = useRequireCustomer();
  const qc = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [selectedType, setSelectedType] = useState<IntegrationType | "">("");
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [integName, setIntegName] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eventsId, setEventsId] = useState<number | null>(null);

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["customer-integrations"],
    queryFn: () => fetch("/api/integrations", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
  });

  const { data: events = [] } = useQuery<IntegrationEvent[]>({
    queryKey: ["integration-events", eventsId],
    queryFn: () => fetch(`/api/integrations/${eventsId}/events`, { credentials: "include" }).then(r => r.json()),
    enabled: !!eventsId,
  });

  const createMutation = useMutation({
    mutationFn: (body: { type: IntegrationType; name: string; config: Record<string, string> }) =>
      fetch("/api/integrations", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-integrations"] }); resetForm(); setShowNew(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<{ name: string; config: Record<string, string>; active: boolean }> }) =>
      fetch(`/api/integrations/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-integrations"] }); setEditingId(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/integrations/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-integrations"] }); setDeleteId(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      fetch(`/api/integrations/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-integrations"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/integrations/${id}/test`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data) => { setTestResult(data); qc.invalidateQueries({ queryKey: ["customer-integrations"] }); },
  });

  async function testConfig() {
    if (!selectedType) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/integrations/test-config", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, config: configFields }),
      });
      setTestResult(await r.json());
    } finally { setTesting(false); }
  }

  function resetForm() {
    setSelectedType("");
    setConfigFields({});
    setIntegName("");
    setTestResult(null);
    setShowSecrets({});
  }

  function openEdit(integ: Integration) {
    setEditingId(integ.id);
    setSelectedType(integ.type);
    setIntegName(integ.name);
    setConfigFields(integ.config);
    setTestResult(null);
  }

  function submitForm() {
    if (!selectedType) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: { name: integName || INTEGRATION_META[selectedType].label, config: configFields } });
    } else {
      createMutation.mutate({ type: selectedType, name: integName || INTEGRATION_META[selectedType].label, config: configFields });
    }
  }

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  if (!customer) return null;

  const meta = selectedType ? INTEGRATION_META[selectedType] : null;
  const isEditing = !!editingId;

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
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
              <Link href="/entegrasyonlarim" className="text-white text-sm font-medium">Entegrasyonlar</Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Entegrasyonlarım</h1>
            <p className="text-slate-400 mt-1">Güvenlik araçlarınızı CyberStep ile otomatik olarak senkronize edin</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { resetForm(); setShowNew(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Entegrasyon Ekle
          </Button>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300">
            Entegrasyonlar sayesinde domain tarama bulguları otomatik olarak Jira ticket'larına, SIEM olaylarına ve güvenlik duvarı engel listelerine dönuştürülür.
          </p>
        </div>

        {/* Integration Cards */}
        {isLoading ? (
          <div className="text-center text-slate-500 py-16">Yükleniyor...</div>
        ) : integrations.length === 0 ? (
          <EmptyState onAdd={() => { resetForm(); setShowNew(true); }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map(integ => (
              <IntegrationCard
                key={integ.id}
                integration={integ}
                onEdit={() => openEdit(integ)}
                onDelete={() => setDeleteId(integ.id)}
                onTest={() => testMutation.mutate(integ.id)}
                onToggle={() => toggleMutation.mutate({ id: integ.id, active: !integ.active })}
                onViewEvents={() => setEventsId(integ.id)}
                isTesting={testMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Category Grid for new integrations */}
        {integrations.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Eklenebilir Entegrasyonlar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.entries(INTEGRATION_META) as [IntegrationType, typeof INTEGRATION_META[IntegrationType]][])
                .filter(([type]) => !integrations.some(i => i.type === type))
                .map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => { resetForm(); setSelectedType(type); setShowNew(true); }}
                    className="text-left border border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50 rounded-lg p-4 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {meta.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{meta.label}</p>
                        <p className="text-xs text-slate-500">{meta.category}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">{meta.description}</p>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showNew || isEditing} onOpenChange={(v) => { if (!v) { setShowNew(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Entegrasyonu Düzenle" : "Entegrasyon Ekle"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {isEditing ? "Mevcut entegrasyonun ayarlarını güncelleyin." : "Bağlamak istediğiniz güvenlik aracını seçin."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type selector (only when adding) */}
            {!isEditing && (
              <div className="space-y-2">
                <Label className="text-slate-300">Entegrasyon Türü</Label>
                <Select value={selectedType} onValueChange={(v) => { setSelectedType(v as IntegrationType); setConfigFields({}); setTestResult(null); }}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seçin..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {(Object.entries(INTEGRATION_META) as [IntegrationType, typeof INTEGRATION_META[IntegrationType]][]).map(([type, m]) => (
                      <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-slate-700 px-1 rounded">{m.icon}</span>
                          {m.label}
                          <span className="text-xs text-slate-500">— {m.category}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Integration Name */}
            {meta && (
              <div className="space-y-2">
                <Label className="text-slate-300">Entegrasyon Adı</Label>
                <Input
                  value={integName}
                  onChange={e => setIntegName(e.target.value)}
                  placeholder={meta.label}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            )}

            {/* Config Fields */}
            {meta && meta.fields.map(field => (
              <div key={field.key} className="space-y-1">
                <Label className="text-slate-300 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-400">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                    value={configFields[field.key] ?? ""}
                    onChange={e => setConfigFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="bg-slate-800 border-slate-600 text-white pr-10"
                  />
                  {field.secret && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                {field.hint && <p className="text-xs text-slate-500">{field.hint}</p>}
              </div>
            ))}

            {/* Test Result */}
            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${testResult.ok ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {testResult.message}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setShowNew(false); setEditingId(null); resetForm(); }}>
              Vazgeç
            </Button>
            {meta && (
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={testConfig} disabled={testing}>
                {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube2 className="h-4 w-4 mr-2" />}
                Bağlantı Test Et
              </Button>
            )}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={submitForm}
              disabled={!selectedType || createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Entegrasyonu Sil</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Bu entegrasyon ve tüm olay geçmişi kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800">Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Events Dialog */}
      <Dialog open={!!eventsId} onOpenChange={v => !v && setEventsId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Olay Geçmişi</DialogTitle>
            <DialogDescription className="text-slate-400">Son 50 entegrasyon olayı</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {events.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Henüz olay yok</p>
            ) : events.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-slate-800/50 border border-slate-700/50">
                {ev.status === "success"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">{eventTypeLabel(ev.eventType)}</span>
                    <span className="text-xs text-slate-500">{formatRelativeTime(ev.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{ev.summary ?? ev.errorMessage ?? "—"}</p>
                  {ev.itemsPushed > 0 && <p className="text-xs text-slate-500 mt-0.5">{ev.itemsPushed} öğe aktarıldı</p>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({
  integration, onEdit, onDelete, onTest, onToggle, onViewEvents, isTesting,
}: {
  integration: Integration;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
  onViewEvents: () => void;
  isTesting: boolean;
}) {
  const meta = INTEGRATION_META[integration.type];
  return (
    <Card className={`bg-slate-900 border-slate-700 transition-all ${!integration.active ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              {meta.icon}
            </div>
            <div>
              <CardTitle className="text-sm text-white">{integration.name}</CardTitle>
              <CardDescription className="text-xs text-slate-500">{meta.category}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={integration.lastSyncStatus} active={integration.active} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-400">{meta.description}</p>

        {integration.lastSyncAt && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            Son sync: {formatRelativeTime(integration.lastSyncAt)}
            {integration.lastSyncError && <span className="text-red-400 ml-1 truncate">— {integration.lastSyncError}</span>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800" onClick={onTest} disabled={isTesting}>
            <TestTube2 className="h-3 w-3 mr-1" /> Test
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800" onClick={onViewEvents}>
            <ExternalLink className="h-3 w-3 mr-1" /> Olaylar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800" onClick={onEdit}>
            <Settings2 className="h-3 w-3 mr-1" /> Ayarlar
          </Button>
          <Button size="sm" variant="outline" className={`h-7 text-xs border-slate-700 hover:bg-slate-800 ${integration.active ? "text-yellow-400" : "text-emerald-400"}`} onClick={onToggle}>
            <Zap className="h-3 w-3 mr-1" /> {integration.active ? "Devre Dışı" : "Etkinleştir"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-red-900/50 text-red-400 hover:bg-red-500/10" onClick={onDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Sil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border border-dashed border-slate-700 rounded-xl p-12 text-center">
      <div className="flex justify-center mb-4">
        <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center">
          <Zap className="h-7 w-7 text-slate-500" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Henüz entegrasyon yok</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
        Jira, FortiManager, QRadar, CrowdStrike ve diğer güvenlik araçlarınızı bağlayarak bulguları otomatik olarak aktarın.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {(Object.entries(INTEGRATION_META) as [IntegrationType, typeof INTEGRATION_META[IntegrationType]][]).map(([type, m]) => (
          <span key={type} className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">{m.label}</span>
        ))}
      </div>
      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" /> Entegrasyon Ekle
      </Button>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, active }: { status: "success" | "error" | null; active: boolean }) {
  if (!active) return <Badge variant="outline" className="border-slate-600 text-slate-500 text-xs">Pasif</Badge>;
  if (status === "success") return <Badge variant="outline" className="border-emerald-700 text-emerald-400 text-xs">Aktif</Badge>;
  if (status === "error") return <Badge variant="outline" className="border-red-700 text-red-400 text-xs">Hata</Badge>;
  return <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">Bekleniyor</Badge>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    connection_test: "Bağlantı Testi",
    findings: "Bulgular Aktarıldı",
    blocklist: "Engel Listesi Guncellendi",
  };
  return labels[type] ?? type;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}
