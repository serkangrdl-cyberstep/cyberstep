import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Cve { cveId: string; service: string; description: string; cvss: number; wafMitigated: boolean; kev: boolean; kevRansomware: boolean; kevSource: "cisa" | "vulncheck" | null; epss: number | null; epssPercentile: number | null }
interface ClientLibCve { library: string; version: string; cveId: string; title: string; cvss: number; kev: boolean; range: string; source: string }
interface Port { port: number; protocol: string; service: string; product: string; version: string; risk: "high" | "medium" | "low"; note: string }
interface Finding { category: string; severity: "critical" | "high" | "medium" | "low"; title: string; deduction: number }
interface Findings {
  domain: string;
  scannedAt: string | null;
  score: { value: number; grade: string; risk: string; coverage: number; caps: string[]; insufficientData: boolean };
  findings: Finding[];
  cves: Cve[];
  ports: Port[];
  clientLibCves: ClientLibCve[];
  clientLibsDetected: { library: string; version: string }[];
  clientLibsChecked: boolean;
  other: { sslLabsGrade: string | null; sslLabsPending?: boolean; danglingCnames: string[]; hudsonRock: { users?: number; employees?: number } | null; mozillaObservatory: { grade?: string; score?: number } | null };
  unchecked: string[];
}

const SEV: Record<string, string> = {
  critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-600",
};
const SEV_LABEL: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
const PORT_LABEL: Record<string, string> = { high: "Yüksek risk", medium: "Dikkat", low: "Normal" };

export function VendorFindingsDialog({ vendorId, vendorName, onClose }: { vendorId: number | null; vendorName: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<Findings>({
    queryKey: ["tprm-vendor-findings", vendorId],
    enabled: vendorId !== null,
    queryFn: async () => {
      const r = await fetch(`/api/tprm/vendors/${vendorId}/findings`, { credentials: "include" });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Bulgular yüklenemedi");
      return r.json() as Promise<Findings>;
    },
  });

  return (
    <Dialog open={vendorId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{vendorName} — Bulgular</DialogTitle></DialogHeader>
        {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
        {data && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {data.domain}{data.scannedAt ? ` · Tarama: ${new Date(data.scannedAt).toLocaleString("tr-TR")}` : ""} · Ölçüm kapsamı %{data.score.coverage}
            </p>
            {data.other.hudsonRock && ((data.other.hudsonRock.employees ?? 0) > 0 || (data.other.hudsonRock.users ?? 0) > 0) && (
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                <strong>Çalınmış kimlik bilgisi (infostealer):</strong> {data.other.hudsonRock.employees ?? 0} çalışan, {data.other.hudsonRock.users ?? 0} kullanıcı hesabı kaydı bulundu. Fidye ve veri sızıntısı saldırılarında en sık kullanılan ilk erişim yollarından biridir; tedarikçiden parola/MFA sıfırlaması isteyin.
              </div>
            )}
            {data.other.sslLabsPending && (
              <div className="rounded-md border border-sky-300 bg-sky-50 p-2 text-xs text-sky-800">
                SSL Labs analizi sürüyor; sonuç bir sonraki taramada eklenecek.
              </div>
            )}
            {(() => {
              const list = data.other.sslLabsPending ? data.unchecked.filter((u) => !/ssl\s*labs/i.test(u)) : data.unchecked;
              return list.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  Bu taramada ölçülemeyen kaynaklar: {list.join(", ")}. Ölçülemeyen kaynak “temiz” sayılmaz. Kısa süre sonra otomatik yeniden denenir.
                </div>
              ) : null;
            })()}
            <Tabs defaultValue="cve">
              <TabsList>
                <TabsTrigger value="cve">CVE ({data.cves.length})</TabsTrigger>
                <TabsTrigger value="ports">Açık portlar ({data.ports.length})</TabsTrigger>
                <TabsTrigger value="other">Diğer bulgular ({data.findings.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="cve" className="space-y-2">
                {data.clientLibCves.map((c) => (
                  <div key={`lib-${c.cveId}-${c.library}`} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{c.cveId}</span>
                      <Badge variant="outline">CVSS {c.cvss.toFixed(1)}</Badge>
                      {c.kev && <Badge className="bg-red-600 text-white">Aktif istismar (KEV)</Badge>}
                      <Badge variant="outline">Sürüm doğrulandı</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Kanıt: sayfada {c.library === "jquery" ? "jQuery" : c.library} {c.version} ({c.source}); etkilenen aralık {c.range}</p>
                    <p className="mt-1">{c.title}</p>
                  </div>
                ))}
                {data.cves.length === 0 && data.clientLibCves.length === 0 && <p className="text-muted-foreground py-3">Doğrulanmış sürüm eşleşmesi olan CVE bulunmadı.</p>}
                {data.cves.map((c) => (
                  <div key={`${c.cveId}-${c.service}`} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{c.cveId}</span>
                      <Badge variant="outline">CVSS {c.cvss.toFixed(1)}</Badge>
                      {c.kev && <Badge className="bg-red-600 text-white">Aktif istismar (KEV{c.kevSource === "vulncheck" ? ", VulnCheck" : ""})</Badge>}
                      {c.kevRansomware && <Badge className="bg-red-800 text-white">Fidye yazılımı</Badge>}
                      {c.epss !== null && <Badge variant="outline">EPSS %{(c.epss * 100).toFixed(1)}</Badge>}
                      {c.wafMitigated && <Badge variant="outline">WAF ile hafifletilmiş</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Kanıt: {c.service}</p>
                    <p className="mt-1">{c.description}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="ports" className="space-y-2">
                {data.ports.length === 0 && <p className="text-muted-foreground py-3">Açık port verisi bulunmadı (kaynak ölçülemediyse yukarıda belirtilir).</p>}
                {data.ports.map((p) => (
                  <div key={`${p.port}-${p.protocol}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                    <span className="font-mono font-semibold w-16">{p.port}/{p.protocol}</span>
                    <span>{[p.service, p.product, p.version].filter(Boolean).join(" · ")}</span>
                    <Badge className={`ml-auto ${p.risk === "high" ? SEV.high : p.risk === "medium" ? SEV.medium : SEV.low}`}>{PORT_LABEL[p.risk]}</Badge>
                    {p.note && <span className="w-full text-xs text-muted-foreground">{p.note}</span>}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="other" className="space-y-2">
                {data.score.caps.length > 0 && (
                  <div className="rounded-md border p-2 text-xs"><b>Uygulanan skor tavanları:</b> {data.score.caps.join("; ")}</div>
                )}
                {data.findings.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                    <Badge className={SEV[f.severity]}>{SEV_LABEL[f.severity]}</Badge>
                    <span>{f.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">−{f.deduction}</span>
                  </div>
                ))}
                <div className="rounded-md border p-2 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Bilgi amaçlı (skora girmez)</p>
                  {data.other.sslLabsGrade && <p>SSL Labs notu: {data.other.sslLabsGrade}</p>}
                  {data.other.mozillaObservatory?.grade && <p>Mozilla Observatory: {data.other.mozillaObservatory.grade} ({data.other.mozillaObservatory.score})</p>}
                  {data.other.hudsonRock && <p>Hudson Rock: {data.other.hudsonRock.employees ?? 0} çalışan, {data.other.hudsonRock.users ?? 0} kullanıcı hesabı sızıntı kaydı</p>}
                  {data.other.danglingCnames.length > 0 && <p>Askıda CNAME: {data.other.danglingCnames.join(", ")}</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
