import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Trash2, AlertTriangle, Shield, ChevronDown, ChevronUp, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WatchedDomain {
  id: number;
  domain: string;
  is_active: boolean;
  created_at: string;
  last_checked_at: string | null;
}

interface SnapshotRow {
  a_records: unknown;
  mx_records: unknown;
  ns_records: unknown;
  txt_records: unknown;
  cname_records: unknown;
  checked_at: string;
}

interface DnsChangeEvent {
  id: number;
  domain: string;
  record_type: string;
  old_values: unknown;
  new_values: unknown;
  severity: string;
  soc_case_id: number | null;
  detected_at: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const SEV_LABELS: Record<string, string> = {
  critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük",
};

const REC_DESC: Record<string, string> = {
  NS: "Ad Sunucusu — Kritik: Alan adı kontrolü değişti",
  MX: "Mail Sunucusu — Kritik: E-posta yönlendirmesi değişti",
  A: "IP Adresi — Yüksek: Web sunucusu adresi değişti",
  CNAME: "Alias Kaydı — Yüksek: Alan adı yönlendirmesi değişti",
  TXT: "Metin Kaydı — Orta: SPF/DKIM veya doğrulama kaydı değişti",
};

const REC_FILTER_OPTIONS = ["Tümü", "A", "MX", "NS", "TXT", "CNAME"];

function formatValue(type: string, values: unknown): string {
  if (!values || (Array.isArray(values) && values.length === 0)) return "(boş)";
  if (type === "MX") {
    const mx = values as Array<{ priority: number; exchange: string }>;
    return mx.map(r => `${r.priority} ${r.exchange}`).join(", ");
  }
  if (type === "TXT") {
    const txt = values as string[][];
    return txt.map(r => r.join("")).join(" | ");
  }
  return (values as string[]).join(", ");
}

function fmtDate(s: string | null) {
  if (!s) return "Henüz kontrol edilmedi";
  return new Date(s).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function SnapshotSection({ domain }: { domain: string }) {
  const { data: snap, isLoading } = useQuery<SnapshotRow>({
    queryKey: ["portal-dns-snapshot", domain],
    queryFn: () =>
      fetch(`/api/portal/dns-monitor/snapshot/${encodeURIComponent(domain)}`)
        .then(r => r.ok ? r.json() : null),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground p-3">Snapshot yükleniyor...</p>;
  if (!snap) return <p className="text-xs text-muted-foreground p-3">Henüz snapshot alınmadı.</p>;

  const records: Array<{ type: string; values: unknown }> = [
    { type: "A", values: snap.a_records },
    { type: "MX", values: snap.mx_records },
    { type: "NS", values: snap.ns_records },
    { type: "TXT", values: snap.txt_records },
    { type: "CNAME", values: snap.cname_records },
  ];

  return (
    <div className="bg-muted/20 rounded-lg p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Güncel DNS — {fmtDate(snap.checked_at)}
      </p>
      {records.map(r => (
        <div key={r.type} className="flex gap-2 text-xs">
          <span className="font-bold font-mono bg-muted px-1.5 py-0.5 rounded shrink-0 w-10 text-center">{r.type}</span>
          <span className="font-mono text-muted-foreground break-all">{formatValue(r.type, r.values)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DnsIzleme() {
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [recFilter, setRecFilter] = useState("Tümü");

  const { data: domains = [], isLoading } = useQuery<WatchedDomain[]>({
    queryKey: ["portal-dns-domains"],
    queryFn: () => fetch("/api/portal/dns-monitor/domains").then(r => r.json()),
  });

  const { data: allChanges = [] } = useQuery<DnsChangeEvent[]>({
    queryKey: ["portal-dns-changes"],
    queryFn: () => fetch("/api/portal/dns-monitor/changes").then(r => r.json()),
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: (domain: string) =>
      fetch("/api/portal/dns-monitor/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      }).then(async r => {
        const body = await r.json() as { error?: string };
        if (!r.ok) throw new Error(body.error ?? "Hata");
        return body;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-dns-domains"] });
      qc.invalidateQueries({ queryKey: ["portal-dns-changes"] });
      setNewDomain("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/portal/dns-monitor/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-dns-domains"] }),
  });

  const handleAdd = () => {
    const trimmed = newDomain.trim();
    if (!trimmed) { setError("Domain adı boş olamaz"); return; }
    setError("");
    addMutation.mutate(trimmed);
  };

  const criticalCount = allChanges.filter(c => c.severity === "critical" || c.severity === "high").length;
  const filteredChanges = recFilter === "Tümü" ? allChanges : allChanges.filter(c => c.record_type === recFilter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">DNS Değişiklik İzleyici</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Domain DNS kayıtlarınızı (A, MX, NS, TXT, CNAME) gerçek zamanlı izleyin. Her 5 dakikada kontrol edilir.
        </p>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {criticalCount} kritik/yüksek DNS değişikliği tespit edildi
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              NS veya MX değişikliği yetkisiz domain transferi veya mail yönlendirmesine işaret edebilir.
            </p>
          </div>
        </div>
      )}

      {/* Domain Ekle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Domain Ekle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="ornekfirma.com.tr"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="font-mono text-sm"
            />
            <Button onClick={handleAdd} disabled={addMutation.isPending} size="sm">
              {addMutation.isPending ? "Ekleniyor..." : "Ekle"}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <p className="text-xs text-muted-foreground mt-2">En fazla 10 domain izlenebilir.</p>
        </CardContent>
      </Card>

      {/* İzlenen Domainler — her biri güncel snapshot + değişiklikler içeriyor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            İzlenen Domainler
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Yükleniyor...</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Henüz domain eklenmedi. Yukarıdan domain ekleyerek izlemeye başlayın.
            </p>
          ) : (
            <div className="divide-y">
              {domains.map(d => {
                const domainChanges = allChanges.filter(c => c.domain === d.domain);
                const isExpanded = expandedDomain === d.domain;

                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium truncate">{d.domain}</p>
                          <p className="text-xs text-muted-foreground">
                            Son kontrol: {fmtDate(d.last_checked_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={() => setExpandedDomain(isExpanded ? null : d.domain)}
                          className="flex items-center gap-1 text-xs text-primary font-medium"
                        >
                          {domainChanges.length > 0
                            ? <span className="text-orange-600">{domainChanges.length} değişiklik</span>
                            : "Detay"}
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        <Badge className={d.is_active ? "bg-green-100 text-green-700 border-green-200 border" : "bg-gray-100 text-gray-600 border"}>
                          {d.is_active ? "Aktif" : "Pasif"}
                        </Badge>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeMutation.mutate(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/20 px-4 pb-4 space-y-3">
                        {/* Güncel DNS snapshot */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <Server className="h-3 w-3" /> Güncel DNS Snapshot
                          </p>
                          <SnapshotSection domain={d.domain} />
                        </div>

                        {/* Değişiklik geçmişi */}
                        {domainChanges.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Değişiklik Geçmişi
                            </p>
                            <div className="space-y-2">
                              {domainChanges.map(c => (
                                <div key={c.id} className="bg-background rounded-lg border p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded font-mono">{c.record_type}</span>
                                    <Badge className={`text-xs border ${SEV_COLORS[c.severity] ?? ""}`}>
                                      {SEV_LABELS[c.severity] ?? c.severity}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground ml-auto">{fmtDate(c.detected_at)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">{REC_DESC[c.record_type]}</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Önceki</p>
                                      <p className="text-xs font-mono bg-red-50 text-red-700 p-2 rounded break-all">
                                        {formatValue(c.record_type, c.old_values) || "(boş)"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Yeni</p>
                                      <p className="text-xs font-mono bg-green-50 text-green-700 p-2 rounded break-all">
                                        {formatValue(c.record_type, c.new_values) || "(boş)"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tüm değişiklikler — kayıt türü filtreli */}
      {allChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Tüm Değişiklikler
              </CardTitle>
              <div className="flex gap-1 flex-wrap">
                {REC_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setRecFilter(opt)}
                    className={`text-xs px-2 py-1 rounded font-mono font-medium transition-colors ${
                      recFilter === opt
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredChanges.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded font-mono">{c.record_type}</span>
                    <Badge className={`text-xs border ${SEV_COLORS[c.severity] ?? ""}`}>
                      {SEV_LABELS[c.severity] ?? c.severity}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">{c.domain}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{fmtDate(c.detected_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-xs font-mono text-red-600 bg-red-50 px-2 py-1 rounded truncate">
                      {formatValue(c.record_type, c.old_values) || "(boş)"}
                    </p>
                    <p className="text-xs font-mono text-green-600 bg-green-50 px-2 py-1 rounded truncate">
                      {formatValue(c.record_type, c.new_values) || "(boş)"}
                    </p>
                  </div>
                </div>
              ))}
              {filteredChanges.length === 0 && (
                <p className="text-xs text-muted-foreground p-4">{recFilter} kaydı için değişiklik bulunamadı.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kayıt Türü Açıklamaları */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            DNS Kayıt Türleri ve Risk Seviyeleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(REC_DESC).map(([type, desc]) => (
              <div key={type} className="flex items-start gap-3 py-2 border-b last:border-0">
                <span className="font-bold text-xs bg-muted px-2 py-1 rounded font-mono shrink-0 mt-0.5">{type}</span>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
