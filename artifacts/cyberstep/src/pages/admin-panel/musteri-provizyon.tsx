import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle, ArrowLeft,
  Copy, Eye, EyeOff, Save, Shield, Wifi, Server, Cloud, Database,
  Globe, ExternalLink, Loader2, AlertTriangle, Settings,
} from "lucide-react";

type FieldType = "text" | "password" | "boolean" | "select" | "textarea" | "readonly" | "url-display";
interface FieldDef {
  key: string; label: string; type: FieldType;
  placeholder?: string; options?: string[];
  description?: string; autoGenerate?: boolean;
}

const SERVICE_FIELDS: Record<string, FieldDef[]> = {
  "fortinet-fabric": [
    { key: "webhookToken", label: "Webhook / Syslog Token", type: "readonly", autoGenerate: true, description: "Müşterinin FortiGate syslog yönlendirmesi için kullanılan token. Değiştirmeyin." },
    { key: "fortiManagerUrl", label: "FortiManager URL", type: "text", placeholder: "https://192.168.1.1" },
    { key: "fortiManagerPort", label: "Port", type: "text", placeholder: "443" },
    { key: "fortiManagerUsername", label: "Kullanıcı Adı", type: "text" },
    { key: "fortiManagerPassword", label: "Şifre", type: "password" },
    { key: "fortiManagerAdom", label: "ADOM", type: "text", placeholder: "root" },
    { key: "fortiManagerAddressGroup", label: "Adres Grubu", type: "text", placeholder: "CyberStep_Blocklist" },
    { key: "escalationEmail", label: "Eskalasyon E-posta", type: "text", placeholder: "soc@sirket.com" },
    { key: "autoBlockEnabled", label: "Otomatik IP Engelleme", type: "boolean" },
  ],
  "soc-operasyon": [
    { key: "tier", label: "SOC Seviyesi", type: "select", options: ["lite", "standard", "pro"] },
    { key: "assignedAnalyst", label: "Sorumlu Analist", type: "text" },
    { key: "escalationContacts", label: "Eskalasyon Kişileri (JSON)", type: "textarea", placeholder: '[{"name":"Ali Demir","email":"ali@co.com","phone":"05xx"}]' },
    { key: "slaBreach4hEmail", label: "SLA İhlal Bildirim E-postası", type: "text" },
  ],
  "noc": [
    { key: "snmpToken", label: "SNMP Trap Token", type: "readonly", autoGenerate: true, description: "Müşterinin SNMP trap endpoint'inde kullanılan token." },
    { key: "snmpVersion", label: "SNMP Sürümü", type: "select", options: ["v2c", "v3"] },
    { key: "alertEmail", label: "Uyarı E-posta", type: "text" },
    { key: "netflowEnabled", label: "NetFlow Aktif", type: "boolean" },
    { key: "baselineDays", label: "Baseline Süresi (gün)", type: "text", placeholder: "14" },
  ],
  "ms365": [
    { key: "riskAlertThreshold", label: "Risk Uyarı Eşiği", type: "select", options: ["low", "medium", "high"] },
    { key: "alertEmail", label: "Uyarı E-posta", type: "text" },
  ],
  "dns-izleme": [
    { key: "domains", label: "Takip Edilecek Domain'ler (her satıra bir tane)", type: "textarea", placeholder: "example.com\nexample.org" },
    { key: "notificationEmail", label: "Bildirim E-posta", type: "text" },
    { key: "changeAlertEnabled", label: "Değişiklik Uyarısı", type: "boolean" },
  ],
  "ct-log-izleme": [
    { key: "domains", label: "Takip Edilecek Domain'ler", type: "textarea", placeholder: "example.com" },
    { key: "alertEmail", label: "Uyarı E-posta", type: "text" },
  ],
  "kvkk-bildirim": [
    { key: "responsibleName", label: "Sorumlu Kişi Adı", type: "text" },
    { key: "responsibleEmail", label: "Sorumlu Kişi E-posta", type: "text" },
    { key: "responsiblePhone", label: "Sorumlu Kişi Telefon", type: "text" },
    { key: "dataCategories", label: "Veri Kategorileri", type: "textarea", placeholder: "Kimlik, İletişim, Finansal..." },
  ],
  "servicenow": [
    { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://dev12345.service-now.com" },
    { key: "username", label: "Kullanıcı Adı", type: "text" },
    { key: "apiToken", label: "API Token", type: "password" },
    { key: "defaultAssignmentGroup", label: "Varsayılan Assignment Group", type: "text", placeholder: "Security Operations" },
  ],
  "observability": [
    { key: "logSources", label: "Log Kaynakları", type: "textarea", placeholder: "nginx, postgresql, kubernetes..." },
    { key: "alertEmail", label: "Uyarı E-posta", type: "text" },
    { key: "dashboardUrl", label: "Dashboard URL", type: "text" },
  ],
};

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "fortinet-fabric": Shield, "soc-operasyon": Shield, "noc": Wifi,
  "ms365": Cloud, "dns-izleme": Globe, "ct-log-izleme": Globe,
  "kvkk-bildirim": Database, "servicenow": Server, "observability": Server,
};

function getBaseUrl() {
  const domain = (window as unknown as Record<string, unknown>)["REPLIT_DOMAINS"];
  if (typeof domain === "string") return `https://${domain.split(",")[0]?.trim()}`;
  return window.location.origin;
}

function generateReadonlyValue(serviceSlug: string, fieldKey: string, config: Record<string, string>): string {
  if (config[fieldKey]) return config[fieldKey];
  if (fieldKey === "webhookToken") return "(kaydet ile otomatik oluşturulur)";
  if (fieldKey === "snmpToken") return "(kaydet ile otomatik oluşturulur)";
  return "";
}

function GeneratedUrl({ label, url }: { label: string; url: string }) {
  const { toast } = useToast();
  return (
    <div className="mt-2 p-3 bg-slate-900 rounded border border-slate-700">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="text-xs text-emerald-400 flex-1 truncate">{url}</code>
        <button onClick={() => { navigator.clipboard.writeText(url); toast({ title: "Kopyalandı" }); }}
          className="text-slate-500 hover:text-white shrink-0">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface OnboardingStep { key: string; label: string; status: string; side?: string; }
interface ServiceData {
  slug: string; label: string; subscriptionId: number | null;
  config: Record<string, string>; onboardingSteps: OnboardingStep[];
}
interface ProvizyonData {
  customer: { id: number; email: string; fullName: string | null; companyName: string | null; phone: string | null };
  services: ServiceData[];
  integrations: Array<{ id: number; type: string; name: string; config: Record<string, string>; active: boolean; lastSyncAt: string | null; lastSyncStatus: string | null }>;
  ms365: { id: number; azureTenantId: string; status: string; lastSyncAt: string | null; syncError: string | null } | null;
}

function ServiceCard({ service, customerId, onSaved }: {
  service: ServiceData; customerId: number; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>(service.config);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  const fields = SERVICE_FIELDS[service.slug] ?? [];
  const Icon = SERVICE_ICONS[service.slug] ?? Settings;
  const doneSteps = service.onboardingSteps.filter(s => s.status === "done").length;
  const totalSteps = service.onboardingSteps.length;

  const save = useMutation({
    mutationFn: () => fetch(`/api/admin-panel/customers/${customerId}/service-config`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceSlug: service.slug, config: cfg }),
    }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.ok) {
        if (data.config) setCfg(data.config);
        toast({ title: `${service.label} yapılandırması kaydedildi` });
        onSaved();
      } else toast({ title: "Kayıt hatası", variant: "destructive" });
    },
    onError: () => toast({ title: "Kayıt hatası", variant: "destructive" }),
  });

  const baseUrl = getBaseUrl();
  const token = cfg["webhookToken"] ?? cfg["snmpToken"] ?? "";

  return (
    <Card className="bg-slate-800 border-slate-700">
      <button className="w-full" onClick={() => setOpen(p => !p)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-sky-400 shrink-0" />
            <div className="flex-1 text-left">
              <CardTitle className="text-white text-sm">{service.label}</CardTitle>
              {totalSteps > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Onboarding: {doneSteps}/{totalSteps} adım tamamlandı
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {fields.length > 0 ? (
                Object.keys(service.config).filter(k => SERVICE_FIELDS[service.slug]?.find(f => f.key === k && f.type !== "readonly")).length > 0 ? (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Yapılandırıldı</Badge>
                ) : (
                  <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">Yapılandırılmamış</Badge>
                )
              ) : null}
              {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-5 border-t border-slate-700">

          {/* Generated URLs */}
          {service.slug === "fortinet-fabric" && cfg["webhookToken"] && cfg["webhookToken"].length > 10 && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Müşteriye Verilecek URL'ler</p>
              <GeneratedUrl label="Syslog-over-HTTPS endpoint" url={`${baseUrl}/api/fabric/ingest/${cfg["webhookToken"]}`} />
              <GeneratedUrl label="Webhook endpoint" url={`${baseUrl}/api/fabric/webhook/${cfg["webhookToken"]}`} />
            </div>
          )}
          {service.slug === "noc" && cfg["snmpToken"] && cfg["snmpToken"].length > 10 && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Müşteriye Verilecek Bilgiler</p>
              <GeneratedUrl label="SNMP Trap Endpoint" url={`snmptrap.cyberstep.io:1162`} />
              <GeneratedUrl label="Community String / Token" url={cfg["snmpToken"]} />
            </div>
          )}

          {/* Config fields */}
          {fields.length > 0 && (
            <div className="pt-2 space-y-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Teknik Yapılandırma</p>
              {fields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">{f.label}</Label>
                  {f.description && <p className="text-[10px] text-slate-500">{f.description}</p>}

                  {f.type === "readonly" && (
                    <div className="flex items-center gap-2">
                      <Input readOnly value={generateReadonlyValue(service.slug, f.key, cfg)}
                        className="bg-slate-900 border-slate-600 text-slate-400 text-xs font-mono" />
                      {cfg[f.key] && (
                        <button onClick={() => { navigator.clipboard.writeText(cfg[f.key]!); toast({ title: "Kopyalandı" }); }}
                          className="text-slate-500 hover:text-white">
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {f.type === "text" && (
                    <Input value={cfg[f.key] ?? ""}
                      onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="bg-slate-900 border-slate-600 text-white text-sm" />
                  )}

                  {f.type === "password" && (
                    <div className="flex gap-2">
                      <Input type={showPwd[f.key] ? "text" : "password"}
                        value={cfg[f.key] ?? ""}
                        onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder="••••••••"
                        className="bg-slate-900 border-slate-600 text-white text-sm flex-1" />
                      <button onClick={() => setShowPwd(p => ({ ...p, [f.key]: !p[f.key] }))}
                        className="text-slate-500 hover:text-white px-2">
                        {showPwd[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  )}

                  {f.type === "textarea" && (
                    <Textarea value={cfg[f.key] ?? ""}
                      onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                      className="bg-slate-900 border-slate-600 text-white text-sm" />
                  )}

                  {f.type === "boolean" && (
                    <div className="flex items-center gap-2">
                      <Switch checked={cfg[f.key] === "true"}
                        onCheckedChange={v => setCfg(p => ({ ...p, [f.key]: String(v) }))} />
                      <span className="text-sm text-slate-400">{cfg[f.key] === "true" ? "Aktif" : "Pasif"}</span>
                    </div>
                  )}

                  {f.type === "select" && (
                    <Select value={cfg[f.key] ?? ""} onValueChange={v => setCfg(p => ({ ...p, [f.key]: v }))}>
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white text-sm">
                        <SelectValue placeholder="Seçin..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {f.options?.map(opt => (
                          <SelectItem key={opt} value={opt} className="text-white hover:bg-slate-800">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}

              <Button size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                disabled={save.isPending}
                onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Kaydet
              </Button>
            </div>
          )}

          {/* Onboarding steps */}
          {service.onboardingSteps.length > 0 && (
            <div className="border-t border-slate-700 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Onboarding Adımları</p>
              {service.onboardingSteps.map(step => (
                <div key={step.key} className="flex items-center gap-2 text-sm">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                  <span className={step.status === "done" ? "text-slate-400 line-through" : "text-slate-200"}>
                    {step.label}
                  </span>
                  {step.side && (
                    <Badge className={`text-[9px] ml-auto ${step.side === "customer" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}`}>
                      {step.side === "customer" ? "Müşteri" : "Admin"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MS365 OAuth status */}
          {service.slug === "ms365" && (
            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">OAuth Durumu</p>
              <p className="text-xs text-slate-400">
                Müşteri kendi hesabından <code className="text-sky-400">/hesabim/entegrasyonlarim</code> sayfasına giderek Microsoft 365 OAuth akışını başlatmalıdır.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function MusteriProvizyon() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const customerId = Number(id);

  const { data, isLoading, error } = useQuery<ProvizyonData>({
    queryKey: ["admin-musteri-provizyon", customerId],
    queryFn: () => fetch(`/api/admin-panel/customers/${customerId}/provizyon`, { credentials: "include" }).then(r => r.json()),
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <AdminLayout title="Teknik Provizyon" description="Müşteri entegrasyon yapılandırması">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </AdminLayout>
    );
  }

  if (error || (data as unknown as Record<string, unknown>)?.["error"]) {
    return (
      <AdminLayout title="Teknik Provizyon" description="Müşteri entegrasyon yapılandırması">
        <div className="flex items-center gap-2 text-red-400 p-4">
          <AlertTriangle className="h-5 w-5" />
          <span>Müşteri bulunamadı veya erişim hatası.</span>
        </div>
      </AdminLayout>
    );
  }

  const customer = data?.customer;
  const services = data?.services ?? [];
  const ms365 = data?.ms365;

  const totalConfigured = services.filter(s =>
    (SERVICE_FIELDS[s.slug] ?? []).filter(f => f.type !== "readonly").some(f => s.config[f.key]?.trim())
  ).length;

  return (
    <AdminLayout
      title={`Teknik Provizyon — ${customer?.companyName ?? customer?.email ?? ""}`}
      description="Müşteriye özel tüm entegrasyon yapılandırmaları"
    >
      <div className="space-y-6 max-w-4xl">

        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white"
            onClick={() => navigate(`/panel/musteriler/${customerId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Müşteri Profili
          </Button>
          <div className="text-slate-500">|</div>
          <button className="text-slate-400 hover:text-white text-sm"
            onClick={() => navigate(`/panel/musteriler/${customerId}/onboarding`)}>
            Onboarding Wizard <ExternalLink className="h-3 w-3 inline ml-1" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">Aktif Servis</p>
              <p className="text-2xl font-bold text-white mt-1">{services.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">Yapılandırılan</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{totalConfigured}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">MS365 OAuth</p>
              <p className={`text-2xl font-bold mt-1 ${ms365 ? "text-emerald-400" : "text-slate-500"}`}>
                {ms365 ? "Bağlı" : "Yok"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* MS365 special status card */}
        {ms365 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-start gap-3">
              <Cloud className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Microsoft 365 — OAuth Bağlantısı</p>
                <p className="text-xs text-slate-400 mt-0.5">Tenant: {ms365.azureTenantId}</p>
                {ms365.lastSyncAt && <p className="text-xs text-slate-500 mt-0.5">Son senkronizasyon: {new Date(ms365.lastSyncAt).toLocaleString("tr-TR")}</p>}
                {ms365.syncError && <p className="text-xs text-red-400 mt-1">{ms365.syncError}</p>}
              </div>
              <Badge className={ms365.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-red-500/15 text-red-400 border-red-500/30 text-[10px]"}>
                {ms365.status === "active" ? "Aktif" : "Pasif"}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* No active services */}
        {services.length === 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <Settings className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Bu müşterinin henüz aktif servisi yok.</p>
              <p className="text-slate-500 text-xs mt-1">Servis aktivasyonu için Müşteri Servisleri panelini kullanın.</p>
            </CardContent>
          </Card>
        )}

        {/* Service cards */}
        {services.map(service => (
          <ServiceCard
            key={service.slug}
            service={service}
            customerId={customerId}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-musteri-provizyon", customerId] })}
          />
        ))}
      </div>
    </AdminLayout>
  );
}
