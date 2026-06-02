import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, Shield, AlertTriangle, Server, Globe,
  Search, RefreshCw, TrendingUp, Mail, Wifi,
} from "lucide-react";

interface TechStats {
  uniqueDomains: number;
  totalEntries: number;
  cloudflareWaf: number;
  microsoft365: number;
  fortinet: number;
  criticalOpenPorts: number;
  byCategory: Array<{ category: string; vendor: string; cnt: number }>;
}

interface SegmentData {
  fortinetDomains: { count: number; domains: string[] };
  criticalPortDomains: { count: number; domains: string[] };
  enterpriseDomains: { count: number; domains: string[] };
}

interface DomainResult {
  domain: string;
  stackCount: number;
  maturity: {
    maturityScore: number;
    maturityLevel: string;
    companySegment: string;
    recommendedService: string;
    recommendationReason: string;
  };
  stack: Array<{
    category: string;
    vendor: string;
    product: string;
    version?: string;
    confidence: number;
    detectedVia?: string;
    securityRisk?: string;
    securityNote?: string;
    salesSignal?: string;
  }>;
}

const RISK_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-400 border-green-500/30",
};

const MATURITY_COLOR: Record<string, string> = {
  low: "text-red-400",
  medium: "text-yellow-400",
  high: "text-green-400",
  enterprise: "text-cyan-400",
};

const CATEGORY_ICONS: Record<string, string> = {
  waf: "🛡️", cdn: "☁️", mail: "📧", mail_security: "🔒", cms: "📝",
  ecommerce: "🛒", webserver: "🖥️", hosting: "🏠", ssl_ca: "🔐",
  analytics: "📊", crm: "👥", support: "💬", payment: "💳",
  firewall: "🔥", open_port: "⚠️", missing_header: "❌", dns_provider: "🌐",
};

export default function TechIntelligencePage() {
  const [searchDomain, setSearchDomain] = useState("");
  const [viewDomain, setViewDomain] = useState("");

  const statsQ = useQuery<TechStats>({
    queryKey: ["tech-stack-stats"],
    queryFn: () => adminFetchJson("/api/admin-panel/tech-stack/stats"),
    staleTime: 60000,
  });

  const segmentsQ = useQuery<SegmentData>({
    queryKey: ["tech-stack-segments"],
    queryFn: () => adminFetchJson("/api/admin-panel/tech-stack/segments"),
    staleTime: 60000,
  });

  const domainQ = useQuery<DomainResult>({
    queryKey: ["tech-stack-domain", viewDomain],
    queryFn: () => adminFetchJson(`/api/admin-panel/tech-stack/${encodeURIComponent(viewDomain)}`),
    enabled: !!viewDomain,
  });

  const fingerprintMut = useMutation({
    mutationFn: (domain: string) =>
      adminFetchJson("/api/admin-panel/tech-stack/fingerprint", { method: "POST", body: JSON.stringify({ domain }), headers: { "Content-Type": "application/json" } }),
    onSuccess: (data: DomainResult) => {
      setViewDomain(data.domain);
    },
  });

  const stats = statsQ.data;
  const segments = segmentsQ.data;
  const domainData = domainQ.data;

  const handleFingerprint = () => {
    if (!searchDomain.trim()) return;
    fingerprintMut.mutate(searchDomain.trim());
  };

  return (
    <AdminLayout title="Tech Intelligence" description="Müşteri teknoloji stack tespiti ve güvenlik olgunluk analizi">
      <div className="space-y-6">

        {/* Genel Bakış */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Globe, label: "Analiz edilen domain", value: stats?.uniqueDomains ?? "—", color: "text-cyan-400" },
            { icon: Shield, label: "Cloudflare WAF", value: stats?.cloudflareWaf ?? "—", color: "text-cyan-400" },
            { icon: Mail, label: "Microsoft 365", value: stats?.microsoft365 ?? "—", color: "text-blue-400" },
            { icon: Cpu, label: "FortiGate tespit", value: stats?.fortinet ?? "—", color: "text-orange-400" },
            { icon: AlertTriangle, label: "Kritik port açık", value: stats?.criticalOpenPorts ?? "—", color: "text-red-400" },
            { icon: Server, label: "Toplam kayıt", value: stats?.totalEntries ?? "—", color: "text-slate-400" },
          ].map((item) => (
            <Card key={item.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <item.icon className={`h-5 w-5 ${item.color} mb-2`} />
                <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-slate-500 mt-1">{item.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Domain Tarama */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-cyan-400" />
              Domain Fingerprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="ornek.com.tr"
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFingerprint()}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button onClick={handleFingerprint} disabled={fingerprintMut.isPending} className="bg-cyan-600 hover:bg-cyan-700">
                {fingerprintMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {fingerprintMut.isPending ? "Taranıyor..." : "Tara"}
              </Button>
            </div>
            {fingerprintMut.isError && (
              <p className="text-red-400 text-sm mt-2">Tarama başarısız. Domain erişilebilir olduğunu kontrol edin.</p>
            )}
          </CardContent>
        </Card>

        {/* Domain Detayı */}
        {domainData && (
          <div className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">{domainData.domain}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${MATURITY_COLOR[domainData.maturity?.maturityLevel] || "text-slate-400"}`}>
                      {domainData.maturity?.maturityScore ?? "—"}<span className="text-slate-500 text-lg">/100</span>
                    </span>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
                      {domainData.maturity?.companySegment || "—"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {domainData.maturity && (
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                    <div className="text-sm font-medium text-cyan-400 mb-1">Otomatik Servis Önerisi</div>
                    <div className="text-white font-semibold">{domainData.maturity.recommendedService}</div>
                    <div className="text-slate-400 text-sm">{domainData.maturity.recommendationReason}</div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domainData.stack
                    .sort((a, b) => b.confidence - a.confidence)
                    .map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <span className="text-xl">{CATEGORY_ICONS[item.category] || "🔧"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm truncate">{item.product}</span>
                            {item.version && <span className="text-slate-500 text-xs">{item.version}</span>}
                            <span className="text-slate-600 text-xs">%{item.confidence}</span>
                          </div>
                          <div className="text-slate-500 text-xs capitalize">{item.category} · {item.detectedVia ?? item.vendor}</div>
                          {item.securityNote && (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded border inline-block ${RISK_COLOR[item.securityRisk || "low"]}`}>
                              {item.securityNote}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Satışa Hazır Segmentler */}
        {segments && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "FortiGate Tespit", data: segments.fortinetDomains, color: "text-orange-400", border: "border-orange-500/20", desc: "SOC+NOC Fabric entegrasyonu hedef" },
              { title: "Kritik Port Açık", data: segments.criticalPortDomains, color: "text-red-400", border: "border-red-500/20", desc: "Acil risk — teaser gönder" },
              { title: "Enterprise Segment", data: segments.enterpriseDomains, color: "text-purple-400", border: "border-purple-500/20", desc: "Manuel outreach — kurumsal teklif" },
            ].map((seg) => (
              <Card key={seg.title} className={`bg-slate-900 border-slate-800`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${seg.color}`}>{seg.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${seg.color}`}>{seg.data.count}</div>
                  <div className="text-xs text-slate-500 mb-3">{seg.desc}</div>
                  {seg.data.domains.slice(0, 5).map((d) => (
                    <button
                      key={d}
                      onClick={() => { setViewDomain(d); setSearchDomain(d); }}
                      className="block text-xs text-slate-400 hover:text-cyan-400 truncate w-full text-left py-0.5"
                    >
                      {d}
                    </button>
                  ))}
                  {seg.data.domains.length > 5 && (
                    <div className="text-xs text-slate-600 mt-1">+{seg.data.domains.length - 5} daha</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Kategori Dağılımı */}
        {stats?.byCategory && stats.byCategory.length > 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Teknoloji Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.byCategory.slice(0, 16).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/50">
                    <div>
                      <div className="text-xs text-slate-500 capitalize">{item.category}</div>
                      <div className="text-sm text-white">{item.vendor}</div>
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">{Number(item.cnt)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
