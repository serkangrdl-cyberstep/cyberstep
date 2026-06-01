import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight, ArrowLeft, CheckCircle, Wifi, Server, Settings, Activity, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { useRequireCustomer } from "@/hooks/use-customer";

const BASE = import.meta.env.BASE_URL;

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());
}

const STEPS = [
  {
    id: 1,
    title: "Token'lariniz Hazir",
    icon: Shield,
    desc: "SNMP trap ve NetFlow endpoint'leriniz otomatik olusturuldu.",
  },
  {
    id: 2,
    title: "FortiGate SNMP Trap",
    icon: Wifi,
    desc: "FortiGate'i CyberStep'e SNMP trap gondermek icin yapilandirun.",
  },
  {
    id: 3,
    title: "FortiGate REST API",
    icon: Settings,
    desc: "Metrik toplama icin salt okunur API token tanimlayun.",
  },
  {
    id: 4,
    title: "Cihaz Listesi",
    icon: Server,
    desc: "Izlenecek network cihazlarinizi ekleyin.",
  },
  {
    id: 5,
    title: "Servis Listesi",
    icon: Activity,
    desc: "HTTP uptime izlenecek servislerinizi ekleyin.",
  },
  {
    id: 6,
    title: "Baseline Basladi",
    icon: CheckCircle,
    desc: "14 gunluk baseline ogrenme sureci basladi!",
  },
];

type Device = { ip: string; name: string; type: string; critical: boolean };
type Svc = { url: string; name: string; critical: boolean };

export default function NocKurulum() {
  const { isLoading: authLoading } = useRequireCustomer();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [ftHost, setFtHost] = useState("");
  const [ftToken, setFtToken] = useState("");
  const [apiTestResult, setApiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [devices, setDevices] = useState<Device[]>([{ ip: "", name: "", type: "server", critical: false }]);
  const [services, setServices] = useState<Svc[]>([{ url: "", name: "", critical: false }]);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["noc-integration"],
    queryFn: () => apiFetch("/portal/noc/integration"),
  });

  const stepMut = useMutation({
    mutationFn: (payload: { step: number; data?: Record<string, unknown> }) =>
      apiFetch("/portal/noc/setup/step", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["noc-integration"] }),
  });

  const snmpTestMut = useMutation({
    mutationFn: () => apiFetch("/portal/noc/test/snmp", { method: "POST" }),
  });

  if (authLoading || isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const integ = integration ?? {};

  const goNext = async (extraData?: Record<string, unknown>) => {
    await stepMut.mutateAsync({ step: currentStep, data: extraData });
    if (currentStep < 6) setCurrentStep((s) => s + 1);
    else navigate("/hesabim/noc");
  };

  const testApi = async () => {
    setApiTesting(true);
    try {
      const result = await apiFetch("/portal/noc/test/api", {
        method: "POST",
        body: JSON.stringify({ host: ftHost, token: ftToken }),
      });
      setApiTestResult(result as { ok: boolean; message: string });
    } finally {
      setApiTesting(false);
    }
  };

  const addDevice = () => setDevices((d) => [...d, { ip: "", name: "", type: "server", critical: false }]);
  const updateDevice = (i: number, field: keyof Device, value: string | boolean) =>
    setDevices((d) => d.map((dev, idx) => idx === i ? { ...dev, [field]: value } : dev));
  const removeDevice = (i: number) => setDevices((d) => d.filter((_, idx) => idx !== i));

  const addService = () => setServices((s) => [...s, { url: "", name: "", critical: false }]);
  const updateService = (i: number, field: keyof Svc, value: string | boolean) =>
    setServices((s) => s.map((svc, idx) => idx === i ? { ...svc, [field]: value } : svc));
  const removeService = (i: number) => setServices((s) => s.filter((_, idx) => idx !== i));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NOC Kurulum Sihirbazi</h1>
        <p className="text-sm text-muted-foreground">
          Pasif izleme modeli — CyberStep higbir zaman ahiniza mudahale etmez.
        </p>
      </div>

      {/* Step progress */}
      <div className="flex gap-1">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`flex-1 h-2 rounded-full transition-colors ${
              s.id < currentStep ? "bg-green-500" : s.id === currentStep ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {(() => {
              const StepIcon = STEPS[currentStep - 1].icon;
              return <StepIcon className="h-6 w-6 text-primary" />;
            })()}
            <div>
              <CardTitle className="text-lg">
                Adim {currentStep}/{STEPS.length}: {STEPS[currentStep - 1].title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].desc}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Step 1: Tokens */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm font-medium">SNMP Trap Endpoint</div>
                  <code className="text-xs block mt-1 break-all">/api/noc/snmp-trap/{integ.snmpToken ?? "..."}</code>
                </div>
                <div>
                  <div className="text-sm font-medium">SNMP Community (Token)</div>
                  <code className="text-xs block mt-1 break-all">{integ.snmpToken ?? "..."}</code>
                </div>
                <div>
                  <div className="text-sm font-medium">NetFlow Endpoint</div>
                  <code className="text-xs block mt-1 break-all">/api/noc/netflow/{integ.netflowToken ?? "..."}</code>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => snmpTestMut.mutate()} variant="outline" disabled={snmpTestMut.isPending}>
                  {snmpTestMut.isPending ? "Test ediliyor..." : "Test Olayi Olustur"}
                </Button>
                {snmpTestMut.isSuccess && (
                  <Badge variant="default" className="text-xs self-center">Test basarili</Badge>
                )}
              </div>
              <Button onClick={() => goNext()} className="w-full">
                Devam <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: SNMP Trap config instructions */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 text-sm font-mono space-y-2">
                <div className="font-sans font-medium mb-2">FortiGate CLI veya GUI:</div>
                <div>System → SNMP → v1/v2c → + Create New</div>
                <div className="ml-2 space-y-1 text-xs">
                  <div>Name: <strong>CyberStep-NOC</strong></div>
                  <div>Status: <strong>Enable</strong></div>
                  <div>Trap Server: <strong>snmptrap.cyberstep.io</strong></div>
                  <div>Port: <strong>1162</strong></div>
                  <div>Community: <strong className="break-all">{integ.snmpToken ?? "..."}</strong></div>
                </div>
                <div className="font-sans mt-3">Trap Events (hepsini secin):</div>
                <div className="ml-2 text-xs grid grid-cols-2 gap-1">
                  {["Link up/down", "CPU high", "Memory high", "HA events", "VPN events", "System events"].map((e) => (
                    <div key={e} className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" /> {e}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <Button onClick={() => goNext()} className="flex-1">
                  Yapilandi, Devam Et <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: FortiGate REST API */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium">Salt okunur API token olusturma:</div>
                <div className="text-xs">System → Administrators → + Create New → REST API Admin</div>
                <div className="text-xs">Profile: <strong>cyberstep_noc_readonly</strong></div>
                <div className="text-xs">Izinler: System Status (Read), Log &amp; Report (Read), Network (Read)</div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ft-host">FortiGate IP / Hostname</Label>
                  <Input id="ft-host" value={ftHost} onChange={(e) => setFtHost(e.target.value)} placeholder="192.168.1.1" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ft-token">API Token</Label>
                  <Input id="ft-token" value={ftToken} onChange={(e) => setFtToken(e.target.value)} placeholder="xxxxxxxxxxxxx" className="mt-1" type="password" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testApi} disabled={!ftHost || !ftToken || apiTesting}>
                  {apiTesting ? "Test ediliyor..." : "Baglantıyı Test Et"}
                </Button>
                {apiTestResult && (
                  <Badge variant={apiTestResult.ok ? "default" : "destructive"} className="self-center text-xs">
                    {apiTestResult.message}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <Button
                  onClick={() => goNext(ftHost ? { host: ftHost, token: ftToken } : undefined)}
                  className="flex-1"
                  disabled={stepMut.isPending}
                >
                  {ftHost ? "Kaydet ve Devam" : "Bu adimi atla"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Devices */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {devices.map((d, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input value={d.name} onChange={(e) => updateDevice(i, "name", e.target.value)} placeholder="Cihaz adi (orn. Core-Switch)" className="flex-1" />
                      <Input value={d.ip} onChange={(e) => updateDevice(i, "ip", e.target.value)} placeholder="IP adresi" className="w-36" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <select
                        value={d.type}
                        onChange={(e) => updateDevice(i, "type", e.target.value)}
                        className="text-sm border rounded px-2 py-1 bg-background"
                      >
                        {["server", "switch", "router", "fortigate", "ap", "wan_link"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input type="checkbox" checked={d.critical} onChange={(e) => updateDevice(i, "critical", e.target.checked)} />
                        Kritik
                      </label>
                      {devices.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeDevice(i)} className="ml-auto text-destructive h-7">Sil</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addDevice}>+ Cihaz Ekle</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <Button
                  onClick={() => goNext({ devices: devices.filter((d) => d.ip && d.name) })}
                  className="flex-1"
                  disabled={stepMut.isPending}
                >
                  Kaydet ve Devam <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Services */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input value={s.name} onChange={(e) => updateService(i, "name", e.target.value)} placeholder="Servis adi" className="flex-1" />
                      <Input value={s.url} onChange={(e) => updateService(i, "url", e.target.value)} placeholder="https://..." className="flex-1" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input type="checkbox" checked={s.critical} onChange={(e) => updateService(i, "critical", e.target.checked)} />
                        Kritik
                      </label>
                      {services.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeService(i)} className="ml-auto text-destructive h-7">Sil</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addService}>+ Servis Ekle</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <Button
                  onClick={() => goNext({ services: services.filter((s) => s.url && s.name) })}
                  className="flex-1"
                  disabled={stepMut.isPending}
                >
                  Kaydet ve Devam <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Done */}
          {currentStep === 6 && (
            <div className="text-center space-y-4 py-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Baseline Ogrenme Basladi!</h3>
              <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted rounded-lg p-4">
                <div>• Ilk 14 gun: Sadece kritik olaylar (cihaz down, link kopması)</div>
                <div>• 14. gun: Baseline tamamlandi bildirimi alacaksiniz</div>
                <div>• 15. gun: Tam anomali tespiti aktif olacak</div>
              </div>
              <Button onClick={() => goNext()} className="w-full">
                NOC Dashboard'a Git <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
