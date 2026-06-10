import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  Shield, AlertTriangle, TrendingUp, Globe, Activity,
  ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface CustomerExposure {
  customerId: number;
  companyName: string | null;
  email: string;
  exposureScore: number | null;
  riskBand: string;
  domain: string | null;
  domainScore: number | null;
  assessmentRisk: string | null;
  cveCount: number;
  hibpBreaches: number;
  orphanedAssetCount: number;
  lastDomainScan: string | null;
  lastAssessment: string | null;
}

interface ExposureResponse {
  customers: CustomerExposure[];
  total: number;
}

function ScoreGauge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">—</span>;
  const color =
    score >= 80 ? "text-green-500" :
    score >= 55 ? "text-yellow-500" :
    score >= 30 ? "text-orange-500" : "text-red-500";
  return (
    <span className={`text-lg font-bold ${color}`}>{score}</span>
  );
}

function RiskBadge({ band }: { band: string }) {
  const cls =
    band === "Düşük Risk" ? "bg-green-500/10 text-green-600 border-green-500/30" :
    band === "Orta Risk" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
    band === "Yüksek Risk" ? "bg-orange-500/10 text-orange-600 border-orange-500/30" :
    band === "Kritik Risk" ? "bg-red-500/10 text-red-600 border-red-500/30" :
    "bg-muted text-muted-foreground border-border";
  return <Badge className={`text-xs border ${cls}`}>{band}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ExposureScorePage() {
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isLoading, error } = useQuery<ExposureResponse>({
    queryKey: ["admin-exposure-score"],
    queryFn: () => adminFetchJson("/api/admin-panel/exposure-score"),
    staleTime: 3 * 60 * 1000,
  });

  const customers = data?.customers ?? [];

  const filtered = customers
    .filter(c =>
      !search ||
      (c.companyName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.domain ?? "").toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const sa = a.exposureScore ?? -1;
      const sb = b.exposureScore ?? -1;
      return sortAsc ? sb - sa : sa - sb;
    });

  const bands = customers.reduce<Record<string, number>>((acc, c) => {
    acc[c.riskBand] = (acc[c.riskBand] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AdminLayout title="CTEM Maruziyet Skoru">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CTEM Maruziyet Skoru</h1>
            <p className="text-sm text-muted-foreground">
              Müşteri başına birleşik tehdit maruziyet puanı — domain tarama, değerlendirme, CVE ve dark web verisinden hesaplanır
            </p>
          </div>
        </div>

        {/* Özet Kartlar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Kritik Risk", band: "Kritik Risk", icon: AlertTriangle, color: "text-red-500" },
            { label: "Yüksek Risk", band: "Yüksek Risk", icon: Shield, color: "text-orange-500" },
            { label: "Orta Risk", band: "Orta Risk", icon: TrendingUp, color: "text-yellow-500" },
            { label: "Düşük Risk", band: "Düşük Risk", icon: Globe, color: "text-green-500" },
          ].map(({ label, band, icon: Icon, color }) => (
            <Card key={band}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{bands[band] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tablo */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">Müşteri Maruziyet Listesi</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Şirket, e-posta, domain..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground text-sm">Yükleniyor...</p>
            ) : error ? (
              <p className="text-center py-12 text-red-500 text-sm">Yüklenemedi</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">Kayıt bulunamadı</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Şirket / E-posta</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Domain</th>
                      <th
                        className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                        onClick={() => setSortAsc(s => !s)}
                      >
                        <span className="flex items-center gap-1">
                          CTEM Skoru
                          {sortAsc
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />}
                        </span>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Domain Skor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assessment</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">CVE</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">HIBP</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gölge IT</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Son Tarama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.customerId} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.companyName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {c.domain ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreGauge score={c.exposureScore} />
                          <span className="text-muted-foreground text-xs">/100</span>
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge band={c.riskBand} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.domainScore !== null ? (
                            <span className={
                              c.domainScore >= 70 ? "text-green-600" :
                              c.domainScore >= 40 ? "text-yellow-600" : "text-red-600"
                            }>
                              {c.domainScore}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.assessmentRisk ? (
                            <Badge variant="outline" className="text-xs">{c.assessmentRisk}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={c.cveCount > 0 ? "text-orange-500 font-medium" : "text-muted-foreground"}>
                            {c.cveCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={c.hibpBreaches > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {c.hibpBreaches > 0 ? c.hibpBreaches : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={c.orphanedAssetCount > 0 ? "text-yellow-500 font-medium" : "text-muted-foreground"}>
                            {c.orphanedAssetCount > 0 ? c.orphanedAssetCount : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(c.lastDomainScan)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && (
              <p className="text-xs text-muted-foreground text-right px-4 py-2 border-t">
                {filtered.length} müşteri · {data?.total ?? 0} toplam
              </p>
            )}
          </CardContent>
        </Card>

        {/* Açıklama */}
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skor Hesabı</p>
            <div className="grid sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Domain Tarama</span> — 40 puan üzerinden. Yüksek domain skoru = yüksek CTEM skoru.</div>
              <div><span className="font-medium text-foreground">Assessment Riski</span> — 30 puan. Kritik risk = 3 puan, Düşük risk = 28 puan.</div>
              <div><span className="font-medium text-foreground">CVE Etkisi</span> — 20 puan. 0 CVE = tam puan; 10+ CVE = 2 puan.</div>
              <div><span className="font-medium text-foreground">Dark Web</span> — 10 puan. İhlal yoksa tam puan; 6+ ihlal = 2 puan.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
