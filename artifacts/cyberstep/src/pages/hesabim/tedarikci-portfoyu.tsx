import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Trash2, RefreshCw, Globe, Shield, AlertTriangle,
  CheckCircle2, Clock, Loader2, ClipboardList, Copy, CheckCheck,
  TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, ExternalLink,
  Upload, Download, FileText,
} from "lucide-react";
import { parseVendorCsv, VENDOR_CSV_TEMPLATE, type VendorCsvRow } from "@/lib/vendor-csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface Vendor {
  id: number;
  customerEmail: string;
  supplierDomain: string;
  supplierName: string | null;
  lastScanScore: number | null;
  prevScanScore: number | null;
  lastScanAt: string | null;
  questionnaireStatus: string;
  questionnaireToken: string | null;
  combinedScore: number | null;
  riskLevel: string | null;
  criticality?: "kritik" | "onemli" | "standart";
  lastScanData: StoredScanData | null;
  sector: string | null;
  sectorMedian: number | null;
  sectorSampleSize: number | null;
  sectorPercentile: number | null;
  overallMedian: number | null;
  crosssellSentAt: string | null;
  alertSentAt: string | null;
  monitoringActive: boolean;
  addedAt: string;
}

interface ScoreV2Category { key: string; label: string; maxPoints: number; points: number; measured: boolean }
interface ScoreV2Finding { category: string; severity: "critical" | "high" | "medium" | "low"; title: string; deduction: number }
interface StoredScanData {
  scoreVersion?: string;
  score?: {
    score: number;
    grade: string;
    coverage: number;
    categories: ScoreV2Category[];
    findings: ScoreV2Finding[];
    caps: string[];
    insufficientData?: boolean;
  };
}

const SEVERITY_STYLE: Record<ScoreV2Finding["severity"], string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};
const SEVERITY_LABEL: Record<ScoreV2Finding["severity"], string> = {
  critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük",
};

function ScoreBreakdown({ data }: { data: StoredScanData | null }) {
  const s = data?.score;
  if (!s || s.insufficientData) return null;
  const unmeasured = s.categories.filter(c => !c.measured);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {s.categories.map(c => {
          const pct = c.measured && c.maxPoints > 0 ? Math.round((c.points / c.maxPoints) * 100) : null;
          const color = pct === null ? "bg-muted" : pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={c.key} className="rounded-md bg-muted/30 p-2">
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              {pct === null ? (
                <p className="text-xs text-muted-foreground mt-1">Ölçülmedi</p>
              ) : (
                <>
                  <p className="text-sm font-semibold tabular-nums">{c.points}/{c.maxPoints}</p>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {s.caps.length > 0 && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {s.caps.join(" · ")}
        </div>
      )}

      {s.findings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Öne çıkan bulgular</p>
          {s.findings.slice(0, 6).map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${SEVERITY_STYLE[f.severity]}`}>
                {SEVERITY_LABEL[f.severity]}
              </Badge>
              <span>{f.title}</span>
            </div>
          ))}
        </div>
      )}

      {unmeasured.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Kapsama %{s.coverage}. Skora dahil edilmeyen (ölçülmemiş) kategoriler: {unmeasured.map(c => c.label).join(", ")}.
          Yeniden tarama ile tamamlanabilir.
        </p>
      )}
    </div>
  );
}

interface BulkResult {
  overLimit?: number;
  limit?: number | null;
  added: number;
  instantScored: number;
  queuedForScan: number;
  skippedExisting: number;
  duplicatesInFile: number;
  invalid: Array<{ row: number; value: string; reason: string }>;
}

const BULK_MAX_ROWS = 500;

function SectorLine({ v }: { v: Vendor }) {
  if (!v.sector && v.overallMedian === null) return null;
  const parts: string[] = [];
  if (v.sector) parts.push(`Sektör: ${v.sector}`);
  if (v.sectorMedian !== null) parts.push(`sektör medyanı ${v.sectorMedian}`);
  else if (v.overallMedian !== null) parts.push(`Türkiye medyanı ${v.overallMedian}`);
  let tone = "text-muted-foreground";
  if (v.sectorPercentile !== null) {
    parts.push(v.sectorPercentile >= 50
      ? `sektörünün %${v.sectorPercentile}'inden iyi`
      : `sektörünün %${100 - v.sectorPercentile}'inden zayıf`);
    if (v.sectorPercentile < 25) tone = "text-red-400";
  }
  return <span className={`text-[10px] ${tone}`}>{parts.join(" · ")}</span>;
}

const SECTORS = [
  "Üretim / İmalat", "Perakende / E-ticaret", "Lojistik / Taşımacılık",
  "Finans / Muhasebe", "Sağlık / Klinik", "Yazılım / BT Hizmetleri",
  "İnşaat / Gayrimenkul", "Hukuk / Danışmanlık", "Gıda / Restoran",
  "Diğer",
];

const CRITICALITY_LABEL: Record<string, string> = { kritik: "Kritik tedarikçi", onemli: "Önemli", standart: "Standart" };
const CRITICALITY_BADGE: Record<string, string> = {
  kritik: "border-red-500/40 text-red-400 bg-red-500/10",
  onemli: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  standart: "border-border text-muted-foreground",
};

function riskColors(level: string | null) {
  if (level === "Düşük")  return { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500" };
  if (level === "Orta")   return { badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",   bar: "bg-amber-500" };
  if (level === "Yüksek") return { badge: "bg-orange-500/20 text-orange-400 border-orange-500/30", bar: "bg-orange-500" };
  return { badge: "bg-red-500/20 text-red-400 border-red-500/30", bar: "bg-red-500" };
}

function ScoreBar({ score, grade, insufficient }: { score: number | null; grade?: string; insufficient?: boolean }) {
  if (insufficient) return <span className="text-xs text-amber-400">Domaine ulaşılamadı — alan adını kontrol edin</span>;
  if (score === null) return <span className="text-xs text-muted-foreground">Taranıyor...</span>;
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 70 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums">{score}/100</span>
      {grade && <span className="text-xs font-bold text-muted-foreground">{grade}</span>}
    </div>
  );
}

function TrendIcon({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null || prev === null) return null;
  const diff = current - prev;
  if (diff > 5)  return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (diff < -5) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function TedarikciPortfoyu() {
  const customerQuery = useRequireCustomer();
  const customer = customerQuery.data;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<VendorCsvRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");
  const [newCriticality, setNewCriticality] = useState<"kritik" | "onemli" | "standart">("standart");

  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySector, setCompanySector] = useState("");

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const email = customer?.email ?? "";

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["tprm-vendors", email],
    queryFn: async () => {
      const r = await fetch("/api/tprm/vendors", { credentials: "include" });
      if (!r.ok) throw new Error("Tedarikçi listesi yüklenemedi");
      return r.json();
    },
    enabled: !!email,
    refetchInterval: 15000,
  });

  const { data: planInfo } = useQuery<{ plan: string | null; limit: number | null; used: number }>({
    queryKey: ["tprm-plan", email, vendors.length],
    queryFn: () => fetch("/api/tprm/plan", { credentials: "include" }).then(r => r.json()),
    enabled: !!email,
  });
  const atLimit = planInfo?.limit != null && planInfo.used >= planInfo.limit;

  const addMutation = useMutation({
    mutationFn: async () => {
      const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "");
      const res = await fetch("/api/tprm/vendors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierDomain: domain, supplierName: newName.trim() || null, criticality: newCriticality }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
      return res.json() as Promise<Vendor & { instantScore?: boolean; scanPending?: boolean }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      setAddOpen(false);
      setNewDomain("");
      setNewName("");
      setNewCriticality("standart");
      toast({
        title: "Tedarikçi eklendi",
        description: data?.instantScore
          ? (data.scanPending ? "Mevcut veriden skor gösterildi; güncel tarama arka planda sürüyor." : "Skor CyberStep veritabanından anında hesaplandı.")
          : "Arka planda tarama başlatıldı.",
      });
    },
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tprm/vendors/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: bulkRows }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
      return res.json() as Promise<BulkResult>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      setBulkResult(data);
    },
    onError: (e) => toast({ title: "Yükleme başarısız", description: (e as Error).message, variant: "destructive" }),
  });

  function resetBulk() {
    setBulkRows([]);
    setBulkFileName(null);
    setBulkResult(null);
  }

  async function onBulkFile(file: File | undefined) {
    if (!file) return;
    setBulkResult(null);
    setBulkFileName(file.name);
    const text = await file.text();
    setBulkRows(parseVendorCsv(text));
  }

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + VENDOR_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tedarikci-sablonu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const criticalityMutation = useMutation({
    mutationFn: async ({ id, criticality }: { id: number; criticality: string }) => {
      const res = await fetch(`/api/tprm/vendors/${id}/criticality`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criticality }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tprm-vendors", email] }),
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/tprm/vendors/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tprm-vendors", email] }),
  });

  const rescanMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/tprm/vendors/${id}/rescan`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      toast({ title: "Yeniden tarama başlatıldı", description: "Sonuç birkaç dakika içinde güncellenir." });
    },
  });

  const questionnaireMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVendor) throw new Error("Tedarikçi seçilmedi");
      const res = await fetch(`/api/tprm/vendors/${selectedVendor.id}/send-questionnaire`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companySector }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
      return res.json() as Promise<{ token: string; link: string; expiresAt: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      setQuestionnaireOpen(false);
      copyToClipboard(data.link, data.token);
      toast({ title: "Anket linki oluşturuldu", description: "Bağlantı panoya kopyalandı." });
    },
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });

  function copyToClipboard(link: string, token: string) {
    const url = window.location.origin + (link.startsWith("http") ? link.replace(window.location.origin, "") : link);
    navigator.clipboard.writeText(url.startsWith("http") ? url : window.location.origin + link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  function openQuestionnaire(vendor: Vendor) {
    setSelectedVendor(vendor);
    setCompanyName("");
    setCompanySector("");
    setQuestionnaireOpen(true);
  }

  const stats = {
    total: vendors.length,
    high: vendors.filter(v => v.riskLevel === "Yüksek" || v.riskLevel === "Kritik").length,
    mid: vendors.filter(v => v.riskLevel === "Orta").length,
    low: vendors.filter(v => v.riskLevel === "Düşük").length,
    pending: vendors.filter(v => v.lastScanScore === null && !v.lastScanData?.score?.insufficientData).length,
  };

  const criticalAtRisk = vendors.filter(
    v => v.criticality === "kritik" && (v.riskLevel === "Yüksek" || v.riskLevel === "Kritik"),
  );

  if (!customer) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tedarikçi Portföyü</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tedarikçilerinizin siber güvenlik skorlarını sürekli izleyin
          </p>
          {planInfo && planInfo.limit != null && (
            <p className={`text-xs mt-1 ${atLimit ? "text-amber-400" : "text-muted-foreground"}`}>
              {planInfo.used} / {planInfo.limit} tedarikçi kullanılıyor
              {" · "}
              <a href="/fiyatlar" className="text-primary hover:underline">{atLimit ? "Paketi yükselt" : "Paketler"}</a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {vendors.length > 0 && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href="/api/tprm/vendors/report.pdf">
                <FileText className="h-4 w-4" />
                PDF Rapor
              </a>
            </Button>
          )}
          <Button onClick={() => { resetBulk(); setBulkOpen(true); }} size="sm" variant="outline" className="gap-1.5">
            <Upload className="h-4 w-4" />
            CSV Yükle
          </Button>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Tedarikçi Ekle
          </Button>
        </div>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Toplam</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-400 mb-1">Yüksek Risk</p>
            <p className="text-2xl font-bold text-red-400">{stats.high}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-amber-400 mb-1">Orta Risk</p>
            <p className="text-2xl font-bold text-amber-400">{stats.mid}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-400 mb-1">Düşük Risk</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tedarikçi listesi */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vendors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">Henüz tedarikçi eklenmedi</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Tedarikçilerinizi ekleyin — CyberStep domain taraması yaparak siber güvenlik skorlarını otomatik hesaplar.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              İlk Tedarikçiyi Ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {criticalAtRisk.length > 0 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              <strong>{criticalAtRisk.length} kritik tedarikçi</strong> yüksek veya kritik risk seviyesinde:{" "}
              {criticalAtRisk.slice(0, 4).map(v => v.supplierDomain).join(", ")}
              {criticalAtRisk.length > 4 ? " ve diğerleri" : ""}. Önce bunlara bakın.
            </div>
          )}
          {vendors.map(v => {
            const rc = riskColors(v.riskLevel);
            const isExp = expanded === v.id;
            const isRescanning = rescanMutation.isPending && rescanMutation.variables === v.id;

            return (
              <Card key={v.id} className="transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Domain & isim */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{v.supplierDomain}</span>
                        {v.supplierName && (
                          <span className="text-xs text-muted-foreground truncate">{v.supplierName}</span>
                        )}
                        {v.riskLevel && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rc.badge}`}>
                            {v.riskLevel} Risk
                          </Badge>
                        )}
                        <select
                          aria-label="Tedarikçi kritikliği"
                          title="Bu tedarikçinin bir siber olayı sizin operasyonunuzu ne kadar etkiler?"
                          value={v.criticality ?? "standart"}
                          onChange={e => criticalityMutation.mutate({ id: v.id, criticality: e.target.value })}
                          className={`text-[10px] rounded border px-1.5 py-0 bg-transparent cursor-pointer ${CRITICALITY_BADGE[v.criticality ?? "standart"]}`}
                        >
                          {Object.entries(CRITICALITY_LABEL).map(([k, l]) => <option key={k} value={k} className="bg-background text-foreground">{l}</option>)}
                        </select>
                      </div>
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <ScoreBar score={v.lastScanScore} grade={v.lastScanData?.score?.grade} insufficient={!!v.lastScanData?.score?.insufficientData} />
                        <TrendIcon current={v.lastScanScore} prev={v.prevScanScore} />
                        {v.lastScanAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Son tarama: {new Date(v.lastScanAt).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                        <SectorLine v={v} />
                      </div>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Yeniden tara"
                        onClick={() => rescanMutation.mutate(v.id)}
                        disabled={isRescanning}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Tedarikçiyi sil"
                        onClick={() => deleteMutation.mutate(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setExpanded(isExp ? null : v.id)}
                      >
                        {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Detay paneli */}
                  {isExp && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <ScoreBreakdown data={v.lastScanData} />

                      {/* Anket durumu */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Öz-Değerlendirme Anketi</span>
                          {v.questionnaireStatus === "completed" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Tamamlandı
                            </Badge>
                          )}
                          {v.questionnaireStatus === "pending" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                              <Clock className="h-3 w-3 mr-1" /> Bekliyor
                            </Badge>
                          )}
                          {v.questionnaireStatus === "none" && (
                            <Badge variant="outline" className="text-[10px]">Gönderilmedi</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {v.questionnaireToken && (
                            <Button
                              variant="outline" size="sm" className="h-7 text-xs gap-1"
                              onClick={() => {
                                const link = `/tprm/anket/${v.questionnaireToken}`;
                                copyToClipboard(link, v.questionnaireToken!);
                              }}
                            >
                              {copiedToken === v.questionnaireToken
                                ? <><CheckCheck className="h-3 w-3" /> Kopyalandı</>
                                : <><Copy className="h-3 w-3" /> Linki Kopyala</>}
                            </Button>
                          )}
                          <Button
                            variant="outline" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => openQuestionnaire(v)}
                          >
                            <ClipboardList className="h-3 w-3" />
                            {v.questionnaireStatus === "none" ? "Anket Gönder" : "Yeni Anket"}
                          </Button>
                        </div>
                      </div>

                      {/* Bileşik skor */}
                      {v.combinedScore !== null && (
                        <div className="rounded-lg bg-muted/30 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Bileşik Skor (Tarama + Anket)</p>
                            <p className="text-2xl font-bold mt-0.5">{v.combinedScore}/100</p>
                          </div>
                          <Shield className={`h-8 w-8 ${v.combinedScore >= 70 ? "text-emerald-400" : v.combinedScore >= 40 ? "text-amber-400" : "text-red-400"}`} />
                        </div>
                      )}

                      {/* Uyarı bildirimleri */}
                      {v.alertSentAt && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Skor düşüşü uyarısı gönderildi — {new Date(v.alertSentAt).toLocaleDateString("tr-TR")}
                        </div>
                      )}

                      {/* Tedarikçi URL */}
                      <a
                        href={`https://${v.supplierDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {v.supplierDomain} sitesini aç
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CSV Toplu Yükleme Dialogu */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) resetBulk(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV ile Toplu Tedarikçi Yükle</DialogTitle>
          </DialogHeader>

          {!bulkResult ? (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                Yalnızca siber olay yaşarsa sizi etkileyecek kritik tedarikçileri yükleyin; ara sıra alım yapılan firmaları listeye almayın.
              </p>
              <p className="text-xs text-muted-foreground">
                Excel'den "CSV (noktalı virgülle ayrılmış)" olarak kaydedin. Bir kolon alan adı (domain) olmalı;
                firma adı kolonu opsiyonel. Tek seferde en fazla {BULK_MAX_ROWS} tedarikçi.
              </p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={downloadTemplate}>
                <Download className="h-3 w-3" /> Örnek şablonu indir
              </Button>
              <Input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e => onBulkFile(e.target.files?.[0])} />
              {bulkFileName && (
                <div className="rounded-md bg-muted/30 p-3 text-xs space-y-1">
                  <p><strong>{bulkFileName}</strong>: {bulkRows.length} satır bulundu</p>
                  {bulkRows.slice(0, 5).map((r, i) => (
                    <p key={i} className="text-muted-foreground truncate">{r.domain}{r.name ? ` — ${r.name}` : ""}{r.criticality !== "standart" ? ` [${r.criticality === "kritik" ? "Kritik" : "Önemli"}]` : ""}</p>
                  ))}
                  {bulkRows.length > 5 && <p className="text-muted-foreground">… ve {bulkRows.length - 5} satır daha</p>}
                  {bulkRows.length > BULK_MAX_ROWS && (
                    <p className="text-red-400">En fazla {BULK_MAX_ROWS} satır yüklenebilir; dosyayı bölün.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-2 text-sm">
              <p><strong>{bulkResult.added}</strong> tedarikçi eklendi.</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>{bulkResult.instantScored} tanesi CyberStep veritabanından anında skorlandı</li>
                <li>{bulkResult.queuedForScan} tanesi için tarama kuyruğa alındı (sonuçlar dakikalar içinde gelir)</li>
                {bulkResult.skippedExisting > 0 && <li>{bulkResult.skippedExisting} tanesi portföyde zaten vardı</li>}
                {bulkResult.duplicatesInFile > 0 && <li>{bulkResult.duplicatesInFile} tekrar eden satır atlandı</li>}
                {(bulkResult.overLimit ?? 0) > 0 && (
                  <li className="text-amber-400">
                    {bulkResult.overLimit} tedarikçi paket limitiniz ({bulkResult.limit}) nedeniyle eklenmedi —{" "}
                    <a href="/fiyatlar" className="underline">paketi yükseltin</a>
                  </li>
                )}
              </ul>
              {bulkResult.invalid.length > 0 && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2 text-xs">
                  <p className="text-red-400 mb-1">{bulkResult.invalid.length} satır geçersiz:</p>
                  {bulkResult.invalid.slice(0, 8).map(r => (
                    <p key={r.row} className="text-muted-foreground truncate">Satır {r.row}: {r.value || "(boş)"}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!bulkResult ? (
              <>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Vazgeç</Button>
                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkRows.length === 0 || bulkRows.length > BULK_MAX_ROWS || bulkMutation.isPending}
                >
                  {bulkMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Yükleniyor...</>
                    : `${bulkRows.length} Tedarikçiyi Yükle`}
                </Button>
              </>
            ) : (
              <Button onClick={() => setBulkOpen(false)}>Tamam</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tedarikçi Ekle Dialogu */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tedarikçi Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
              Siber olay yaşarsa işinizi, verinizi veya müşterilerinizi etkileyecek firmaları ekleyin (API/veri sağlayıcı, yan sanayi, bulut ve yazılım hizmeti, veri işleyen). Birkaç kez alım yaptığınız firmalar için skor anlamlı olmaz.
            </p>
            <div className="space-y-1.5">
              <Label>Domain Adresi *</Label>
              <Input
                placeholder="ornek.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">https:// olmadan yazın. Tarama otomatik başlar.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tedarikçi Adı (opsiyonel)</Label>
              <Input
                placeholder="ABC Yazılım A.S."
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kritiklik</Label>
              <select
                value={newCriticality}
                onChange={e => setNewCriticality(e.target.value as "kritik" | "onemli" | "standart")}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="standart">Standart: aksarsa işimiz etkilenmez</option>
                <option value="onemli">Önemli: aksarsa süreçlerimiz yavaşlar</option>
                <option value="kritik">Kritik: aksarsa operasyonumuz durur</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Vazgeç</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newDomain.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Ekleniyor...</> : "Ekle ve Tara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anket Linki Oluştur Dialogu */}
      <Dialog open={questionnaireOpen} onOpenChange={setQuestionnaireOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Anket Linki Oluştur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{selectedVendor?.supplierDomain}</strong> için tedarikçiye gönderilecek öz-değerlendirme linki.
          </p>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Şirket Adınız *</Label>
              <Input
                placeholder="Kendi şirket adınız"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sektörünüz *</Label>
              <Select value={companySector} onValueChange={setCompanySector}>
                <SelectTrigger>
                  <SelectValue placeholder="Sektör seçin" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionnaireOpen(false)}>Vazgeç</Button>
            <Button
              onClick={() => questionnaireMutation.mutate()}
              disabled={!companyName.trim() || !companySector || questionnaireMutation.isPending}
            >
              {questionnaireMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Oluşturuluyor...</>
                : <><ClipboardList className="h-4 w-4 mr-1.5" />Linki Oluştur</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
