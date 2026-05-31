import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Cloud, Shield, ArrowLeft, Loader2, Plus, Trash2,
  CheckCircle, AlertTriangle, RefreshCw, Key,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface CloudConnection {
  id: number;
  provider: string;
  accountName: string;
  regions: string[];
  lastScannedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CloudFinding {
  id: number;
  provider: string;
  resourceType: string;
  resourceName: string;
  findingType: string;
  severity: string;
  title: string;
  description: string;
  remediationSteps: string;
  region: string | null;
  lastSeenAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-900/40 text-red-300 border-red-700",
  high: "bg-orange-900/40 text-orange-300 border-orange-700",
  medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  low: "bg-green-900/40 text-green-300 border-green-700",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

const AWS_REGIONS = [
  { value: "eu-central-1", label: "Avrupa (Frankfurt)" },
  { value: "eu-west-1", label: "Avrupa (İrlanda)" },
  { value: "eu-west-2", label: "Avrupa (Londra)" },
  { value: "us-east-1", label: "ABD (Kuzey Virginia)" },
  { value: "us-west-2", label: "ABD (Oregon)" },
];

export default function CloudGuvenlik() {
  useRequireCustomer();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["eu-central-1"]);

  const { data: connData, isLoading: connLoading } = useQuery({
    queryKey: ["cloud-connections"],
    queryFn: async () => {
      const r = await fetch("/api/portal/cloud/connections");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<{ connections: CloudConnection[] }>;
    },
  });

  const { data: findData, isLoading: findLoading } = useQuery({
    queryKey: ["cloud-findings"],
    queryFn: async () => {
      const r = await fetch("/api/portal/cloud/findings");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<{ findings: CloudFinding[] }>;
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/portal/cloud/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "aws",
          accessKeyId,
          secretAccessKey,
          accountName: accountName || "AWS Hesabım",
          regions: selectedRegions,
        }),
      });
      if (!r.ok) {
        const e = await r.json() as { error?: string };
        throw new Error(e.error ?? "Bağlantı kurulamadı");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Hesap bağlandı", description: "Gece taraması otomatik yapılacak." });
      qc.invalidateQueries({ queryKey: ["cloud-connections"] });
      setShowForm(false);
      setAccessKeyId("");
      setSecretAccessKey("");
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const deletConn = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/cloud/connections/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Silinemedi");
    },
    onSuccess: () => {
      toast({ title: "Bağlantı silindi" });
      qc.invalidateQueries({ queryKey: ["cloud-connections"] });
    },
  });

  const triggerScan = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/cloud/scan/${id}`, { method: "POST" });
      if (!r.ok) throw new Error("Tarama başlatılamadı");
      return r.json();
    },
    onSuccess: () => toast({ title: "Tarama başlatıldı", description: "Birkaç dakika içinde sonuçlar görünecek." }),
    onError: () => toast({ title: "Hata", description: "Tarama başlatılamadı.", variant: "destructive" }),
  });

  const toggleRegion = (r: string) => {
    setSelectedRegions(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const connections = connData?.connections ?? [];
  const findings = findData?.findings ?? [];
  const criticalCount = findings.filter(f => f.severity === "critical").length;

  return (
    <div className="min-h-screen bg-[#060D1A] text-[#E8EDF5] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/hesabim">
            <Button variant="ghost" size="sm" className="text-[#00C8FF]/70 hover:text-[#00C8FF]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hesabım
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Cloud className="w-7 h-7 text-[#00C8FF]" />
            <div>
              <h1 className="text-2xl font-bold">Bulut Güvenliği (CSPM)</h1>
              <p className="text-[#8899AA] text-sm">AWS hesabınızdaki güvenlik açıklarını otomatik tespit edin.</p>
            </div>
          </div>
          <Button
            className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="w-4 h-4 mr-2" /> AWS Bağla
          </Button>
        </div>

        {/* Bağlantı Formu */}
        {showForm && (
          <Card className="bg-[#0A1628] border-[#00C8FF]/30 mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-[#00C8FF]" /> AWS Hesabı Bağla
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded p-3 text-sm text-yellow-300">
                Yalnızca Read-Only erişim kullanın. AWS Console → IAM → Kullanıcı → SecurityAudit policy ekle.
                Hiçbir şeyi değiştirme, silme veya oluşturma yetkimiz yoktur.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[#8899AA] text-xs">Hesap Adı (isteğe bağlı)</Label>
                  <Input
                    placeholder="AWS Üretim"
                    className="bg-[#060D1A] border-[#1A2840] text-[#E8EDF5]"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                  />
                </div>
                <div />
                <div className="space-y-1">
                  <Label className="text-[#8899AA] text-xs">Access Key ID</Label>
                  <Input
                    placeholder="AKIA..."
                    className="bg-[#060D1A] border-[#1A2840] text-[#E8EDF5] font-mono text-sm"
                    value={accessKeyId}
                    onChange={e => setAccessKeyId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#8899AA] text-xs">Secret Access Key</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••••••"
                    className="bg-[#060D1A] border-[#1A2840] text-[#E8EDF5] font-mono text-sm"
                    value={secretAccessKey}
                    onChange={e => setSecretAccessKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#8899AA] text-xs">Taranacak Region'lar</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AWS_REGIONS.map(reg => (
                    <label key={reg.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedRegions.includes(reg.value)}
                        onCheckedChange={() => toggleRegion(reg.value)}
                        className="border-[#1A2840]"
                      />
                      <span className="text-sm text-[#8899AA]">{reg.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)}>İptal</Button>
                <Button
                  className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
                  disabled={connect.isPending || !accessKeyId || !secretAccessKey}
                  onClick={() => connect.mutate()}
                >
                  {connect.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Doğrulanıyor...</>
                  ) : "Bağlan ve Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bağlantılar */}
        {connections.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[#8899AA] uppercase tracking-wider mb-3">
              Bağlı Hesaplar
            </h2>
            <div className="space-y-2">
              {connections.map(conn => (
                <Card key={conn.id} className="bg-[#0A1628] border-[#1A2840]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{conn.accountName}</p>
                      <p className="text-xs text-[#8899AA]">
                        {conn.provider.toUpperCase()} · {(conn.regions as string[]).join(", ")}
                      </p>
                      {conn.lastScannedAt ? (
                        <p className="text-xs text-[#556677] mt-0.5">
                          Son tarama: {new Date(conn.lastScannedAt).toLocaleDateString("tr-TR")}
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-500/70 mt-0.5">Henüz taranmadı</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1A2840] text-[#8899AA] hover:text-white"
                        disabled={triggerScan.isPending}
                        onClick={() => triggerScan.mutate(conn.id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Tara
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400/70 hover:text-red-400"
                        onClick={() => deletConn.mutate(conn.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Bulgular */}
        {findLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#00C8FF]" />
          </div>
        ) : findings.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#8899AA] uppercase tracking-wider">
                Bulut Güvenlik Bulguları ({findings.length})
              </h2>
              {criticalCount > 0 && (
                <span className="text-xs text-red-400 font-semibold">{criticalCount} kritik</span>
              )}
            </div>
            <div className="space-y-3">
              {findings.map(f => (
                <Card key={f.id} className="bg-[#0A1628] border-[#1A2840]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-sm">{f.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.medium}`}>
                        {SEVERITY_LABELS[f.severity] ?? f.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[#8899AA]">{f.provider.toUpperCase()} · {f.resourceType} · {f.resourceName}</p>
                    {f.description && <p className="text-sm text-[#8899AA] mt-2">{f.description}</p>}
                    {f.remediationSteps && (
                      <div className="mt-2 bg-[#060D1A] rounded p-2">
                        <p className="text-xs text-[#00C8FF] font-semibold mb-1">Nasıl Düzeltilir:</p>
                        <p className="text-xs text-[#8899AA]">{f.remediationSteps}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : connections.length > 0 ? (
          <Card className="bg-[#0A1628] border-[#1A2840]">
            <CardContent className="py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-[#8899AA]">Henüz tarama yapılmadı veya bulgu yok.</p>
              <p className="text-xs text-[#556677] mt-1">Gece otomatik tarama yapılacak veya "Tara" butonuna tıklayın.</p>
            </CardContent>
          </Card>
        ) : !showForm ? (
          <Card className="bg-[#0A1628] border-[#1A2840]">
            <CardContent className="py-12 text-center">
              <Cloud className="w-12 h-12 text-[#00C8FF]/40 mx-auto mb-3" />
              <p className="font-medium mb-1">AWS hesabınızı bağlayın</p>
              <p className="text-sm text-[#8899AA] mb-4">
                Herkese açık S3 bucket'ları, güvensiz güvenlik grupları, MFA eksikliği ve daha fazlasını tespit edin.
              </p>
              <Button
                className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> AWS Hesabı Bağla
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
