import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle, SkipForward, RefreshCw,
  ExternalLink, ShieldAlert, Globe, Loader2, ChevronLeft,
} from "lucide-react";

interface CVERow {
  id: number;
  cveId: string;
  cvssScore: string | null;
  severity: string | null;
  title: string | null;
  status: string | null;
  trAffectedDomains: number | null;
  trCriticalDomains: number | null;
  trSectorsAffected: Record<string, number> | null;
  cisaKev: boolean | null;
  exploitPublic: boolean | null;
  patchAvailable: boolean | null;
  linkedinPost: string | null;
  xThread: Array<{ tweetNo: number; content: string }> | null;
  trAnalysis: string | null;
  pressNote: string | null;
  emailSubject: string | null;
  notificationsSent: number | null;
  detectedAt: string | null;
  domainMatchCount?: number;
  epssScore: string | null;
  epssPercentile: string | null;
}

interface Stats {
  total: number;
  analyzed: number;
  published: number;
  skipped: number;
  notificationsSent: number;
}

function severityColor(sev: string | null) {
  if (sev === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (sev === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    detected: "bg-slate-700 text-slate-300",
    scanning: "bg-blue-500/20 text-blue-400",
    analyzed: "bg-cyan-500/20 text-cyan-400",
    published: "bg-green-500/20 text-green-400",
    skipped: "bg-slate-600 text-slate-400",
  };
  return map[status ?? ""] ?? "bg-slate-700 text-slate-300";
}

function statusLabel(s: string | null) {
  const map: Record<string, string> = { detected: "Tespit", scanning: "Taranıyor", analyzed: "Analiz Hazır", published: "Yayında", skipped: "Atlandı" };
  return map[s ?? ""] ?? s ?? "—";
}

function CVEDetail({ cveId, onBack }: { cveId: string; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Partial<CVERow>>({});
  const [dirty, setDirty] = useState(false);

  const { data: cve, isLoading } = useQuery<CVERow>({
    queryKey: ["cve-detail", cveId],
    queryFn: () => adminFetchJson(`/api/admin-panel/cve/${cveId}`),
  });

  const saveMut = useMutation({
    mutationFn: (body: Partial<CVERow>) =>
      adminFetchJson(`/api/admin-panel/cve/${cveId}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cve-detail", cveId] }); setDirty(false); toast({ title: "Kaydedildi" }); },
  });

  const publishMut = useMutation({
    mutationFn: () => adminFetchJson(`/api/admin-panel/cve/${cveId}/publish`, { method: "POST" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cve-list"] }); queryClient.invalidateQueries({ queryKey: ["cve-detail", cveId] }); toast({ title: "Yayınlandı" }); },
  });

  const skipMut = useMutation({
    mutationFn: () => adminFetchJson(`/api/admin-panel/cve/${cveId}/skip`, { method: "POST", body: JSON.stringify({ reason: "Manuel olarak atlandı" }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cve-list"] }); onBack(); },
  });

  const field = (key: keyof CVERow) => String((edits as Record<string, unknown>)[key] ?? cve?.[key] ?? "");
  const setField = (key: keyof CVERow, val: string) => { setEdits(e => ({ ...e, [key]: val })); setDirty(true); };

  if (isLoading) return <div className="flex items-center justify-center h-40 text-slate-500"><Loader2 className="animate-spin mr-2" />Yükleniyor...</div>;
  if (!cve) return <div className="text-slate-500">CVE bulunamadı</div>;

  const xTweets = (edits.xThread ?? cve.xThread) as Array<{ tweetNo: number; content: string }> | null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white"><ChevronLeft className="h-4 w-4 mr-1" />Geri</Button>
        <h2 className="text-white font-bold text-lg">{cve.cveId}</h2>
        <Badge className={severityColor(cve.severity)}>CVSS {cve.cvssScore} {(cve.severity ?? "").toUpperCase()}</Badge>
        <Badge className={statusBadge(cve.status)}>{statusLabel(cve.status)}</Badge>
        {cve.epssScore != null && (
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            EPSS {(parseFloat(cve.epssScore) * 100).toFixed(1)}%
            {cve.epssPercentile != null && ` · P${Math.round(parseFloat(cve.epssPercentile) * 100)}`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "TR Etkilenen", val: cve.trAffectedDomains ?? 0, icon: Globe },
          { label: "Kritik Risk", val: cve.trCriticalDomains ?? 0, icon: ShieldAlert },
          { label: "Bildirim Gönderildi", val: cve.notificationsSent ?? 0, icon: CheckCircle },
          { label: "Domain Eşleşme", val: cve.domainMatchCount ?? 0, icon: AlertTriangle },
        ].map(({ label, val, icon: Icon }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Icon className="h-3 w-3" />{label}</div>
              <div className="text-white text-xl font-bold">{val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Türkçe Analiz</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={8} value={field("trAnalysis")} onChange={e => setField("trAnalysis", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 text-sm resize-none" />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2"><CardTitle className="text-white text-sm">LinkedIn Post</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={6} value={field("linkedinPost")} onChange={e => setField("linkedinPost", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 text-sm resize-none" />
          <div className="text-xs text-slate-500 mt-1">{field("linkedinPost").length} / 1200 karakter</div>
        </CardContent>
      </Card>

      {xTweets && xTweets.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-white text-sm">X/Twitter Thread ({xTweets.length} tweet)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {xTweets.map((t, i) => (
              <div key={i} className="bg-slate-800 rounded p-3">
                <div className="text-slate-500 text-xs mb-1">Tweet {t.tweetNo}</div>
                <p className="text-slate-200 text-sm">{t.content}</p>
                <div className="text-xs text-slate-600 mt-1">{t.content.length} / 280</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Basın Notu</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} value={field("pressNote")} onChange={e => setField("pressNote", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 text-sm resize-none" />
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        {dirty && (
          <Button onClick={() => saveMut.mutate(edits)} disabled={saveMut.isPending} className="bg-slate-700 hover:bg-slate-600 text-white">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Kaydet
          </Button>
        )}
        {cve.status === "analyzed" && (
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending} className="bg-green-700 hover:bg-green-600 text-white">
            {publishMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}Yayınla
          </Button>
        )}
        <Button variant="outline" onClick={() => skipMut.mutate()} disabled={skipMut.isPending} className="border-slate-700 text-slate-400 hover:text-white">
          <SkipForward className="h-4 w-4 mr-1" />Atla
        </Button>
        <a href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`} target="_blank" rel="noreferrer">
          <Button variant="outline" className="border-slate-700 text-slate-400 hover:text-white">
            <ExternalLink className="h-4 w-4 mr-1" />NVD
          </Button>
        </a>
      </div>
    </div>
  );
}

export default function AdminCVEPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCVE, setSelectedCVE] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState("");

  const { data: cves = [], isLoading, refetch } = useQuery<CVERow[]>({
    queryKey: ["cve-list"],
    queryFn: () => adminFetchJson("/api/admin-panel/cve"),
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["cve-stats"],
    queryFn: () => adminFetchJson("/api/admin-panel/cve/stats"),
  });

  const checkNowMut = useMutation({
    mutationFn: () => adminFetchJson("/api/admin-panel/cve/check-now", { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { toast({ title: "Feed kontrolü başlatıldı" }); setTimeout(() => refetch(), 5000); },
  });

  const rematchMut = useMutation({
    mutationFn: () => adminFetchJson("/api/admin-panel/cve/rematch-domains", { method: "POST" }),
    onSuccess: (d: { newMatches: number; cveCount: number }) => {
      toast({ title: `Re-match tamamlandı: ${d.newMatches} yeni eşleşme, ${d.cveCount} CVE işlendi` });
      setTimeout(() => refetch(), 3000);
    },
    onError: () => toast({ title: "Re-match başarısız", variant: "destructive" }),
  });

  const deleteDomainMut = useMutation({
    mutationFn: (domain: string) => adminFetchJson("/api/admin-panel/cve/domain-matches", {
      method: "DELETE",
      body: JSON.stringify({ domain }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (d: { deletedCount: number; domain: string }) => {
      toast({ title: `${d.domain} temizlendi — ${d.deletedCount} eşleşme silindi` });
      setDomainToDelete("");
      queryClient.invalidateQueries({ queryKey: ["cve-list"] });
      queryClient.invalidateQueries({ queryKey: ["cve-stats"] });
    },
    onError: () => toast({ title: "Silme başarısız", variant: "destructive" }),
  });

  if (selectedCVE) {
    return (
      <AdminLayout title="CVE Detay" description="İçerik düzenle ve yayınla">
        <CVEDetail cveId={selectedCVE} onBack={() => setSelectedCVE(null)} />
      </AdminLayout>
    );
  }

  const analyzed = cves.filter(c => c.status === "analyzed");
  const others = cves.filter(c => c.status !== "analyzed");

  return (
    <AdminLayout title="CVE Izleme" description="Kritik güvenlik açıklarının Türkiye etkisi">
      <div className="space-y-4">

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Toplam", val: stats.total },
              { label: "Analiz Hazır", val: stats.analyzed },
              { label: "Yayında", val: stats.published },
              { label: "Atlandı", val: stats.skipped },
              { label: "Bildirim", val: stats.notificationsSent },
            ].map(({ label, val }) => (
              <Card key={label} className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 pb-3">
                  <div className="text-slate-400 text-xs mb-1">{label}</div>
                  <div className="text-white text-xl font-bold">{val}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center">
          <p className="text-slate-400 text-sm">
            {analyzed.length > 0 ? <span className="text-cyan-400 font-medium">{analyzed.length} CVE onay bekliyor</span> : "Onay bekleyen CVE yok"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-700 text-slate-400 hover:text-white">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => rematchMut.mutate()} disabled={rematchMut.isPending} className="bg-slate-600 hover:bg-slate-500 text-white">
              {rematchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Domain Re-Match
            </Button>
            <Button size="sm" onClick={() => checkNowMut.mutate()} disabled={checkNowMut.isPending} className="bg-cyan-700 hover:bg-cyan-600 text-white">
              {checkNowMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Feed Kontrol Et
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              Domain Eşleşme Temizleme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-500 text-xs mb-3">
              Test veya hatalı eşleşen bir domain'i tüm CVE kayıtlarından silin. Production'daki yanlış eşleşmeleri düzeltmek için kullanın.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="örn: netsys.com.tr"
                value={domainToDelete}
                onChange={e => setDomainToDelete(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-200 text-sm h-8 flex-1"
                onKeyDown={e => { if (e.key === "Enter" && domainToDelete.length > 3) deleteDomainMut.mutate(domainToDelete); }}
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={domainToDelete.length < 3 || deleteDomainMut.isPending}
                onClick={() => deleteDomainMut.mutate(domainToDelete)}
                className="h-8"
              >
                {deleteDomainMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Sil
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && <div className="text-slate-500 text-center py-8"><Loader2 className="animate-spin inline mr-2" />Yükleniyor...</div>}

        {analyzed.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-cyan-400 text-xs font-medium uppercase tracking-wide">Onay Bekleyen</h3>
            {analyzed.map(cve => <CVECard key={cve.cveId} cve={cve} onSelect={setSelectedCVE} />)}
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wide mt-4">Diger CVE'ler</h3>
            {others.map(cve => <CVECard key={cve.cveId} cve={cve} onSelect={setSelectedCVE} />)}
          </div>
        )}

        {!isLoading && cves.length === 0 && (
          <div className="text-slate-500 text-center py-12">
            <ShieldAlert className="h-12 w-12 mx-auto mb-3 text-slate-700" />
            <p>Henüz CVE kaydı yok.</p>
            <p className="text-sm mt-1">Feed kontrolü her 2 saatte otomatik çalışır.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function CVECard({ cve, onSelect }: { cve: CVERow; onSelect: (id: string) => void }) {
  return (
    <Card
      className="bg-slate-900 border-slate-800 hover:border-slate-600 cursor-pointer transition-colors"
      onClick={() => onSelect(cve.cveId)}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-white font-mono font-medium">{cve.cveId}</span>
              <Badge className={severityColor(cve.severity)}>CVSS {cve.cvssScore}</Badge>
              <Badge className={statusBadge(cve.status)}>{statusLabel(cve.status)}</Badge>
              {cve.cisaKev && <Badge className="bg-red-600/20 text-red-300 border-red-600/30">KEV</Badge>}
              {cve.exploitPublic && <Badge className="bg-orange-600/20 text-orange-300 border-orange-600/30">Exploit</Badge>}
              {cve.patchAvailable && <Badge className="bg-green-600/20 text-green-300 border-green-600/30">Yama</Badge>}
              {cve.epssScore != null && (
                <Badge className="bg-purple-600/20 text-purple-300 border-purple-600/30">
                  EPSS {(parseFloat(cve.epssScore) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm truncate">{cve.title}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-white font-bold">{cve.trAffectedDomains ?? 0}</div>
            <div className="text-slate-500 text-xs">TR domain</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
