import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor, Terminal, Download, RefreshCw, Shield, ShieldAlert,
  ShieldCheck, AlertTriangle, CheckCircle, Clock, Server,
  ChevronRight, Copy, Check, ClipboardList, Save, Brain,
  Zap, TrendingUp, Calendar, User, BarChart2, Sparkles,
  Network, Wifi, ListChecks,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InternalScanFinding {
  category: string;
  finding: string;
  severity: "critical" | "high" | "medium" | "low";
  points: number;
  recommendation: string;
}

interface InternalScan {
  id: number;
  scanType: string | null;
  scanVersion: string | null;
  hostname: string | null;
  internalScore: number | null;
  scoreBreakdown: Record<string, number> | null;
  rawData: { findings?: InternalScanFinding[]; [k: string]: unknown } | null;
  findingsCount: number | null;
  scannedAt: string | null;
  createdAt: string | null;
}

interface ActionItem {
  priority: number;
  title: string;
  description: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  timeline: string;
  responsible: string;
  category: string;
}

interface CostItem {
  action: string;
  estimated_cost_tl: string;
  cost_type: "one_time" | "monthly" | "annual";
  notes: string;
}

interface BenchmarkData {
  sector_average_score: number;
  company_score: number;
  percentile: number;
  common_gaps: string[];
}

interface AiSecurityReport {
  id: number;
  executiveSummary: string | null;
  criticalActions: ActionItem[] | null;
  mediumTermActions: ActionItem[] | null;
  longTermActions: ActionItem[] | null;
  costEstimates: CostItem[] | null;
  benchmarkData: BenchmarkData | null;
  generatedAt: string | null;
}

interface SurveyData {
  backupEnabled?: boolean | null;
  backupFrequency?: string | null;
  backupOffsite?: boolean | null;
  backupImmutable?: boolean | null;
  backupLastTestDate?: string | null;
  irPlanExists?: boolean | null;
  irPlanLastTest?: string | null;
  irTeamDefined?: boolean | null;
  securityTrainingEnabled?: boolean | null;
  trainingFrequency?: string | null;
  phishingSimulation?: boolean | null;
  cyberInsurance?: boolean | null;
  kvkkVerbisRegistered?: boolean | null;
  iso27001?: boolean | null;
  pciDss?: boolean | null;
  siemExists?: boolean | null;
  socExists?: boolean | null;
  socType?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}
function scoreBg(score: number): string {
  if (score >= 80) return "border-green-500/40 bg-green-900/10";
  if (score >= 60) return "border-yellow-500/40 bg-yellow-900/10";
  if (score >= 40) return "border-orange-500/40 bg-orange-900/10";
  return "border-red-500/40 bg-red-900/10";
}
function scoreLabel(score: number): string {
  if (score >= 80) return "İyi";
  if (score >= 60) return "Orta";
  if (score >= 40) return "Zayıf";
  return "Kritik";
}
function severityBadge(severity: string): string {
  const m: Record<string, string> = {
    critical: "bg-red-900/40 text-red-300 border-red-700",
    high: "bg-orange-900/40 text-orange-300 border-orange-700",
    medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    low: "bg-blue-900/40 text-blue-300 border-blue-700",
  };
  return m[severity] ?? "bg-gray-700/40 text-gray-300 border-gray-600";
}
function severityLabel(severity: string): string {
  const m: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
  return m[severity] ?? severity;
}
function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <ShieldAlert className="w-4 h-4 text-red-400" />;
  if (severity === "high") return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  if (severity === "medium") return <Clock className="w-4 h-4 text-yellow-400" />;
  return <CheckCircle className="w-4 h-4 text-blue-400" />;
}
function categoryLabel(cat: string): string {
  const m: Record<string, string> = {
    os: "İşletim Sistemi", security: "Güvenlik", users: "Kullanıcılar",
    network: "Ağ", services: "Servisler", identity: "Kimlik & AD",
    backup: "Yedekleme", ir_plan: "Olay Müdahale", training: "Eğitim",
    compliance: "Uyumluluk", monitoring: "İzleme", survey: "Anket",
  };
  return m[cat] ?? cat;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function useApiKey() {
  return useQuery<{ apiKey: string }>({
    queryKey: ["/api/internal-scan/api-key"],
    queryFn: async () => {
      const r = await fetch("/api/internal-scan/api-key");
      if (!r.ok) throw new Error("API anahtarı alınamadı");
      return r.json() as Promise<{ apiKey: string }>;
    },
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ description: "Kopyalandı" });
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="ml-2 text-gray-400 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DownloadButtons() {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:border-blue-500"
        onClick={() => { window.location.href = "/api/internal-scan/download-script?os=windows"; }}>
        <Monitor className="w-3.5 h-3.5 mr-1.5" /> Windows
      </Button>
      <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:border-orange-500"
        onClick={() => { window.location.href = "/api/internal-scan/download-script?os=linux"; }}>
        <Terminal className="w-3.5 h-3.5 mr-1.5" /> Linux
      </Button>
    </div>
  );
}

function DownloadSection() {
  const { data: keyData } = useApiKey();
  const apiKey = keyData?.apiKey ?? "...";

  const downloadScript = (os: "windows" | "linux") => {
    window.location.href = `/api/internal-scan/download-script?os=${os}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">İç Tarama Scripti İndir</h2>
        <p className="text-sm text-gray-400">
          Script'i sunucunuzda veya iş istasyonunuzda çalıştırın. Sonuçlar otomatik platforma gönderilir.
        </p>
      </div>

      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">API Anahtarınız</div>
        <div className="flex items-center gap-2 font-mono text-sm text-green-400">
          <span className="truncate">{apiKey}</span>
          <CopyButton text={apiKey} />
        </div>
        <p className="text-xs text-gray-500 mt-2">Script indirildiğinde bu anahtar otomatik olarak gömülür.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-gray-700 rounded-lg p-5 bg-gray-900/30 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="font-medium text-white">Windows</div>
              <div className="text-xs text-gray-400">PowerShell Script (.ps1)</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            Yönetici PowerShell'de çalıştırın. Defender, BitLocker, AD kimlik analizi tarar.
          </p>
          <div className="text-xs text-gray-500 mb-3 space-y-1">
            <div className="font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" /> Gereksinimler
            </div>
            <div>Windows 10+ / Windows Server 2016+</div>
            <div>PowerShell 5.1 veya üstü</div>
            <div>Yönetici (Administrator) yetkisi</div>
          </div>
          <div className="text-xs text-gray-500 mb-3 space-y-1">
            <div className="font-medium text-gray-400 mb-1.5">Nasıl Çalıştırılır</div>
            <div>1. Scripti masaüstüne indirin</div>
            <div>2. PowerShell'i yönetici olarak açın</div>
            <div>3. <span className="font-mono bg-gray-800 px-1 rounded">.\cyberstep-scan.ps1</span> yazıp Enter'a basın</div>
          </div>
          <div className="bg-gray-950 rounded p-3 font-mono text-xs text-gray-300 mb-4 overflow-x-auto">
            .\cyberstep-scan.ps1
          </div>
          <Button onClick={() => downloadScript("windows")} className="w-full bg-blue-700 hover:bg-blue-600 text-white">
            <Download className="w-4 h-4 mr-2" /> .ps1 İndir
          </Button>
        </div>

        <div className="border border-gray-700 rounded-lg p-5 bg-gray-900/30 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-orange-900/40 border border-orange-700/40 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="font-medium text-white">Linux</div>
              <div className="text-xs text-gray-400">Bash Script (.sh)</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            sudo ile çalıştırın. AV/EDR, UFW, LUKS, SSH, sudo/kimlik analizi tarar.
          </p>
          <div className="text-xs text-gray-500 mb-3 space-y-1">
            <div className="font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" /> Gereksinimler
            </div>
            <div>Ubuntu 20.04+ / Debian 11+ / RHEL 8+</div>
            <div>Bash 4.0 veya üstü</div>
            <div>sudo yetkisi</div>
          </div>
          <div className="text-xs text-gray-500 mb-3 space-y-1">
            <div className="font-medium text-gray-400 mb-1.5">Nasıl Çalıştırılır</div>
            <div>1. Scripti sunucuya indirin</div>
            <div>2. <span className="font-mono bg-gray-800 px-1 rounded">chmod +x cyberstep-scan.sh</span></div>
            <div>3. <span className="font-mono bg-gray-800 px-1 rounded">sudo ./cyberstep-scan.sh</span></div>
          </div>
          <div className="bg-gray-950 rounded p-3 font-mono text-xs text-gray-300 mb-4 overflow-x-auto">
            chmod +x cyberstep-scan.sh && sudo ./cyberstep-scan.sh
          </div>
          <Button onClick={() => downloadScript("linux")} className="w-full bg-orange-700 hover:bg-orange-600 text-white">
            <Download className="w-4 h-4 mr-2" /> .sh İndir
          </Button>
        </div>
      </div>

      <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-900/20 text-sm text-gray-400 space-y-1">
        <div className="flex items-center gap-2 text-gray-300 font-medium mb-2">
          <Shield className="w-4 h-4 text-green-400" />
          Gizlilik Garantisi
        </div>
        <p>Script'ler yalnızca okuma yapar — sisteminizde hiçbir değişiklik yapmaz.</p>
        <p>Toplanan veriler şifreli olarak iletilir ve yalnızca sizin hesabınızda görüntülenir.</p>
      </div>
    </div>
  );
}

function ScanResult({ scan }: { scan: InternalScan }) {
  const score = scan.internalScore ?? 0;
  const rawFindings = (scan.rawData?.["findings"] as InternalScanFinding[] | undefined) ?? [];
  const findings: InternalScanFinding[] = rawFindings;

  return (
    <div className="space-y-6">
      <div className={`border rounded-lg p-6 ${scoreBg(score)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">İç Tarama Skoru</div>
            <div className={`text-5xl font-bold ${scoreColor(score)}`}>
              {score}<span className="text-2xl text-gray-500">/100</span>
            </div>
            <div className={`text-sm font-medium mt-1 ${scoreColor(score)}`}>{scoreLabel(score)}</div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Server className="w-4 h-4" />
              <span>{scan.hostname ?? "Bilinmiyor"}</span>
            </div>
            <div className="text-xs text-gray-500">
              {scan.scanType === "internal_script_windows" ? "Windows" : "Linux"} · v{scan.scanVersion}
            </div>
            <div className="text-xs text-gray-500">
              {scan.scannedAt ? new Date(scan.scannedAt).toLocaleDateString("tr-TR", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              }) : ""}
            </div>
          </div>
        </div>

        {scan.scoreBreakdown && (
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(scan.scoreBreakdown).map(([key, val]) => (
              <div key={key} className="text-xs bg-gray-900/40 rounded px-3 py-1.5 border border-gray-700/50">
                <span className="text-gray-400">{categoryLabel(key)}: </span>
                <span className={`font-medium ${scoreColor(val)}`}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {findings.length > 0 ? (
        <div>
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Bulgular ({findings.length})
          </h3>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <div key={i} className="border border-gray-700/60 rounded-lg p-4 bg-gray-900/20">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5"><SeverityIcon severity={f.severity} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{f.finding}</span>
                      <Badge className={`text-xs border px-1.5 py-0 ${severityBadge(f.severity)}`}>
                        {severityLabel(f.severity)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {categoryLabel(f.category)} · -{f.points} puan
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{f.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-green-500/30 rounded-lg p-6 bg-green-900/10 text-center">
          <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <div className="text-green-300 font-medium">Kritik bulgu tespit edilmedi</div>
          <p className="text-sm text-gray-400 mt-1">Sistem güvenlik temellerini karşılıyor.</p>
        </div>
      )}

      <div className="border border-gray-700/50 rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Yeniden Tara</div>
          <p className="text-xs text-gray-400 mt-0.5">Güncel durumu öğrenmek için scripti tekrar çalıştırın.</p>
        </div>
        <DownloadButtons />
      </div>
    </div>
  );
}

// ── Survey Form ───────────────────────────────────────────────────────────────

type TriState = true | false | null;

function TriToggle({
  label, value, onChange,
}: { label: string; value: TriState; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex gap-1.5">
        <button
          onClick={() => onChange(true)}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            value === true
              ? "bg-green-800/60 border-green-600 text-green-300"
              : "border-gray-700 text-gray-500 hover:border-gray-500"
          }`}
        >
          Evet
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            value === false
              ? "bg-red-800/60 border-red-700 text-red-300"
              : "border-gray-700 text-gray-500 hover:border-gray-500"
          }`}
        >
          Hayır
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary/50"
      >
        <option value="">Seçin</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function DateField({
  label, value, onChange,
}: { label: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary/50"
      />
    </div>
  );
}

function SurveySection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useQuery<SurveyData | null>({
    queryKey: ["/api/internal-scan/survey"],
    queryFn: async () => {
      const r = await fetch("/api/internal-scan/survey");
      if (!r.ok) throw new Error("Anket yüklenemedi");
      return r.json() as Promise<SurveyData | null>;
    },
  });

  const [form, setForm] = useState<SurveyData>({});
  const [initialized, setInitialized] = useState(false);

  if (!initialized && !isLoading && existing !== undefined) {
    setForm(existing ?? {});
    setInitialized(true);
  }

  const set = (key: keyof SurveyData, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/internal-scan/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Kayıt başarısız");
      return r.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/internal-scan/survey"] });
      toast({ description: "Anket kaydedildi — güvenlik skorunuz güncellendi" });
    },
    onError: () => {
      toast({ variant: "destructive", description: "Kayıt sırasında hata oluştu" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Güvenlik Anketi</h2>
        <p className="text-sm text-gray-400">
          Script'in göremediği kontrolleri doldurun. Bu veriler skora dahil edilir.
        </p>
      </div>

      {/* 1. Yedekleme */}
      <Card className="bg-gray-900/50 border-gray-700/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">Yedekleme Politikası</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TriToggle label="Düzenli yedekleme yapılıyor mu?" value={form.backupEnabled ?? null}
            onChange={(v) => set("backupEnabled", v)} />
          {form.backupEnabled && (
            <>
              <SelectField label="Yedekleme sıklığı" value={form.backupFrequency}
                options={[
                  { value: "daily", label: "Günlük" },
                  { value: "weekly", label: "Haftalık" },
                  { value: "monthly", label: "Aylık" },
                ]}
                onChange={(v) => set("backupFrequency", v)} />
              <TriToggle label="Off-site / bulut yedek var mı?" value={form.backupOffsite ?? null}
                onChange={(v) => set("backupOffsite", v)} />
              <TriToggle label="Değiştirilemez (immutable) yedek var mı?" value={form.backupImmutable ?? null}
                onChange={(v) => set("backupImmutable", v)} />
              <DateField label="Son test restore tarihi" value={form.backupLastTestDate}
                onChange={(v) => set("backupLastTestDate", v)} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Olay Müdahale */}
      <Card className="bg-gray-900/50 border-gray-700/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">Olay Müdahale</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TriToggle label="Yazılı IR planı var mı?" value={form.irPlanExists ?? null}
            onChange={(v) => set("irPlanExists", v)} />
          {form.irPlanExists && (
            <>
              <DateField label="Son tatbikat tarihi" value={form.irPlanLastTest}
                onChange={(v) => set("irPlanLastTest", v)} />
              <TriToggle label="Sorumlular tanımlı mı?" value={form.irTeamDefined ?? null}
                onChange={(v) => set("irTeamDefined", v)} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Güvenlik Eğitimi */}
      <Card className="bg-gray-900/50 border-gray-700/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">Güvenlik Eğitimi</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TriToggle label="Güvenlik farkındalık eğitimi veriliyor mu?" value={form.securityTrainingEnabled ?? null}
            onChange={(v) => set("securityTrainingEnabled", v)} />
          {form.securityTrainingEnabled && (
            <>
              <SelectField label="Eğitim sıklığı" value={form.trainingFrequency}
                options={[
                  { value: "annual", label: "Yıllık" },
                  { value: "quarterly", label: "Üç ayda bir" },
                  { value: "continuous", label: "Sürekli" },
                ]}
                onChange={(v) => set("trainingFrequency", v)} />
              <TriToggle label="Phishing simülasyonu yapılıyor mu?" value={form.phishingSimulation ?? null}
                onChange={(v) => set("phishingSimulation", v)} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. Uyumluluk */}
      <Card className="bg-gray-900/50 border-gray-700/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">Uyumluluk</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TriToggle label="Siber sigorta var mı?" value={form.cyberInsurance ?? null}
            onChange={(v) => set("cyberInsurance", v)} />
          <TriToggle label="KVKK VERBİS kaydı var mı?" value={form.kvkkVerbisRegistered ?? null}
            onChange={(v) => set("kvkkVerbisRegistered", v)} />
          <TriToggle label="ISO 27001 sertifikası var mı?" value={form.iso27001 ?? null}
            onChange={(v) => set("iso27001", v)} />
          <TriToggle label="PCI-DSS kapsamında mısınız?" value={form.pciDss ?? null}
            onChange={(v) => set("pciDss", v)} />
        </CardContent>
      </Card>

      {/* 5. İzleme */}
      <Card className="bg-gray-900/50 border-gray-700/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">İzleme & SOC</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TriToggle label="SIEM / merkezi log toplama var mı?" value={form.siemExists ?? null}
            onChange={(v) => set("siemExists", v)} />
          <TriToggle label="SOC hizmeti alıyor musunuz?" value={form.socExists ?? null}
            onChange={(v) => set("socExists", v)} />
          {form.socExists && (
            <SelectField label="SOC tipi" value={form.socType}
              options={[
                { value: "internal", label: "İç (kendi ekibiniz)" },
                { value: "external", label: "Dış (MSSP)" },
                { value: "hybrid", label: "Hibrit" },
              ]}
              onChange={(v) => set("socType", v)} />
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {saveMutation.isPending ? (
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Anketi Kaydet
      </Button>
    </div>
  );
}

// ── AI Report Section ─────────────────────────────────────────────────────────

function effortLabel(e: string) {
  const m: Record<string, string> = { low: "Düşük Efor", medium: "Orta Efor", high: "Yüksek Efor" };
  return m[e] ?? e;
}
function impactLabel(e: string) {
  const m: Record<string, string> = { low: "Düşük Etki", medium: "Orta Etki", high: "Yüksek Etki" };
  return m[e] ?? e;
}
function costTypeLabel(t: string) {
  const m: Record<string, string> = { one_time: "Tek seferlik", monthly: "Aylık", annual: "Yıllık" };
  return m[t] ?? t;
}

function ActionCard({ item, accent }: { item: ActionItem; accent: string }) {
  return (
    <div className={`border ${accent} rounded-lg p-4 bg-gray-900/30`}>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-xs text-gray-400 font-bold shrink-0 mt-0.5">
          {item.priority}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{item.title}</span>
            <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">{effortLabel(item.effort)}</span>
            <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">{impactLabel(item.impact)}</span>
          </div>
          <p className="text-sm text-gray-400 mb-2">{item.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.timeline}</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.responsible}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiReportSection({ hasScan }: { hasScan: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery<AiSecurityReport | null>({
    queryKey: ["/api/internal-scan/latest-report"],
    queryFn: async () => {
      const r = await fetch("/api/internal-scan/latest-report");
      if (!r.ok) return null;
      return r.json() as Promise<AiSecurityReport | null>;
    },
    refetchInterval: (query) => {
      // Rapor yoksa her 8 saniyede bir yenile (arka planda üretilmiş olabilir)
      return query.state.data ? false : 8000;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/internal-scan/generate-report", { method: "POST" });
      if (!r.ok) throw new Error("Rapor tetiklenemedi");
      return r.json();
    },
    onSuccess: () => {
      toast({ description: "Rapor oluşturuluyor, lütfen bekleyin..." });
      // 8 saniyelik aralıklarla yenile
      const iv = setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ["/api/internal-scan/latest-report"] });
      }, 8000);
      setTimeout(() => clearInterval(iv), 120_000);
    },
    onError: () => {
      toast({ variant: "destructive", description: "Rapor oluşturulamadı. Tekrar deneyin." });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
      </div>
    );
  }

  if (!hasScan) {
    return (
      <div className="border border-gray-700/50 rounded-lg p-8 text-center">
        <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <div className="text-base font-semibold text-white mb-1">Önce İç Tarama Yapın</div>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          AI raporu için önce script ile bir iç tarama tamamlanmalıdır.
          "Tarama Sonuçları" sekmesinden scripti indirip çalıştırın.
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="border border-primary/20 rounded-lg p-8 bg-primary/5 text-center">
        <Sparkles className="w-12 h-12 text-primary/60 mx-auto mb-3" />
        <div className="text-base font-semibold text-white mb-1">AI Güvenlik Raporu</div>
        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-5">
          Dış tarama, iç tarama ve anket verileriniz birleştirilerek kişiselleştirilmiş
          bir aksiyon planı oluşturulur.
        </p>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {generateMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Brain className="w-4 h-4 mr-2" />
          )}
          Rapor Oluştur
        </Button>
        {generateMutation.isPending && (
          <p className="text-xs text-gray-500 mt-3">Bu işlem 30-60 saniye sürebilir.</p>
        )}
      </div>
    );
  }

  const criticalActions = report.criticalActions ?? [];
  const mediumActions = report.mediumTermActions ?? [];
  const longActions = report.longTermActions ?? [];
  const costEstimates = report.costEstimates ?? [];
  const benchmark = report.benchmarkData;

  return (
    <div className="space-y-6">
      {/* Başlık ve tarih */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Güvenlik Raporu
          </h2>
          {report.generatedAt && (
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(report.generatedAt).toLocaleDateString("tr-TR", {
                day: "numeric", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-600 text-gray-300"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      {/* Yönetici Özeti */}
      {report.executiveSummary && (
        <Card className="bg-gray-900/50 border-gray-700/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Yönetici Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {report.executiveSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Benchmark */}
      {benchmark && (
        <Card className="bg-gray-900/50 border-gray-700/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Sektör Kıyaslaması
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-950/60 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{benchmark.company_score}</div>
                <div className="text-xs text-gray-400 mt-0.5">Şirket Skoru</div>
              </div>
              <div className="bg-gray-950/60 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-400">{benchmark.sector_average_score}</div>
                <div className="text-xs text-gray-400 mt-0.5">Sektör Ort.</div>
              </div>
              <div className="bg-gray-950/60 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${benchmark.percentile >= 50 ? "text-green-400" : "text-orange-400"}`}>
                  %{benchmark.percentile}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Dilim</div>
              </div>
            </div>
            {benchmark.common_gaps.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Sektörde En Sık Eksiklikler</div>
                <ul className="space-y-1">
                  {benchmark.common_gaps.map((gap, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Kritik Aksiyonlar */}
      {criticalActions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Kritik Aksiyonlar — Bu Hafta
          </h3>
          <div className="space-y-3">
            {criticalActions.map((item) => (
              <ActionCard key={item.priority} item={item} accent="border-red-800/50 hover:border-red-700/60" />
            ))}
          </div>
        </div>
      )}

      {/* Orta Vade */}
      {mediumActions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Orta Vadeli Aksiyonlar — 30-60 Gün
          </h3>
          <div className="space-y-3">
            {mediumActions.map((item) => (
              <ActionCard key={item.priority} item={item} accent="border-yellow-800/40 hover:border-yellow-700/50" />
            ))}
          </div>
        </div>
      )}

      {/* Uzun Vade */}
      {longActions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Uzun Vadeli Aksiyonlar — 6-12 Ay
          </h3>
          <div className="space-y-3">
            {longActions.map((item) => (
              <ActionCard key={item.priority} item={item} accent="border-blue-800/40 hover:border-blue-700/50" />
            ))}
          </div>
        </div>
      )}

      {/* Maliyet Tahminleri */}
      {costEstimates.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-700/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Tahmini Maliyetler</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-gray-800/60">
              {costEstimates.map((c, i) => (
                <div key={i} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{c.action}</div>
                    {c.notes && <div className="text-xs text-gray-500 mt-0.5">{c.notes}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium text-green-400">{c.estimated_cost_tl}</div>
                    <div className="text-xs text-gray-500">{costTypeLabel(c.cost_type)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Fortinet Fabric Tab ───────────────────────────────────────────────────────

interface FabricStatus {
  status: string;
  fgConfigured: boolean;
  fgHost: string | null;
  fgFirmwareVersion: string | null;
  fgFirmwareEol: string | null;
  fgFirmwareOutdated: boolean | null;
  fgPolicyAnalysis: { total: number; allow: number; deny: number; unused: number } | null;
  fgVpnData: { tunnels: Array<{ name: string; status: string; remoteIp: string }>; total: number } | null;
  fgSyncedAt: string | null;
  lastEventAt: string | null;
  eventsReceived: number;
}

function FortinetFabricTab() {
  const { data: fabric, isLoading } = useQuery<FabricStatus | null>({
    queryKey: ["/portal/fabric/status"],
    queryFn: async () => {
      const r = await fetch("/portal/fabric/status");
      if (!r.ok) return null;
      return r.json() as Promise<FabricStatus>;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
      </div>
    );
  }

  if (!fabric?.fgConfigured) {
    return (
      <div className="border border-gray-700/50 rounded-lg p-8 text-center">
        <Network className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <div className="text-base font-semibold text-white mb-1">
          Fortinet Entegrasyonu Yapılandırılmamış
        </div>
        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-4">
          FortiGate API erişimini yapılandırmak için Fortinet Fabric sayfasını ziyaret edin.
        </p>
        <a
          href="/hesabim/fortinet"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Fortinet Fabric sayfasına git
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  const isActive =
    fabric.status === "active" || (fabric.eventsReceived ?? 0) > 0;
  const policies = fabric.fgPolicyAnalysis;
  const vpn = fabric.fgVpnData;

  return (
    <div className="space-y-4">
      {/* Bağlantı Durumu */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isActive ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm font-medium text-white">
              FortiGate Bağlantısı
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              isActive
                ? "border-green-600 text-green-400"
                : "border-yellow-600 text-yellow-400"
            }`}
          >
            {isActive ? "Aktif" : "Beklemede"}
          </Badge>
        </div>
        {fabric.fgHost && (
          <p className="text-xs text-gray-500 font-mono">{fabric.fgHost}</p>
        )}
        {fabric.fgSyncedAt && (
          <p className="text-xs text-gray-600 mt-1">
            Son senkronizasyon:{" "}
            {new Date(fabric.fgSyncedAt).toLocaleString("tr-TR")}
          </p>
        )}
      </div>

      {/* Firmware */}
      {fabric.fgFirmwareVersion && (
        <div
          className={`border rounded-lg p-4 ${
            fabric.fgFirmwareOutdated
              ? "border-red-700/50 bg-red-950/20"
              : "border-gray-700 bg-gray-900/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">Firmware</span>
            {fabric.fgFirmwareOutdated && (
              <Badge
                variant="outline"
                className="text-xs border-red-600 text-red-400"
              >
                EOL — Güncelleme Gerekli
              </Badge>
            )}
          </div>
          <p className="text-sm font-mono text-gray-300">
            {fabric.fgFirmwareVersion}
          </p>
          {fabric.fgFirmwareEol && (
            <p className="text-xs text-gray-500 mt-1">
              EOL:{" "}
              {new Date(fabric.fgFirmwareEol).toLocaleDateString("tr-TR")}
            </p>
          )}
        </div>
      )}

      {/* Politika Analizi */}
      {policies && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
          <div className="text-sm font-medium text-white mb-3">
            Politika Analizi
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(
              [
                { label: "Toplam", value: policies.total, color: "text-gray-300" },
                { label: "İzin Ver", value: policies.allow, color: "text-green-400" },
                { label: "Reddet", value: policies.deny, color: "text-red-400" },
                { label: "Kullanılmayan", value: policies.unused, color: "text-yellow-400" },
              ] as const
            ).map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VPN Tünelleri */}
      {vpn && vpn.total > 0 && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-gray-400" />
              VPN Tünelleri
            </span>
            <span className="text-xs text-gray-400">
              {vpn.tunnels.filter((t) => t.status === "up").length} /{" "}
              {vpn.total} aktif
            </span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {vpn.tunnels.slice(0, 5).map((tunnel, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-mono text-gray-300">{tunnel.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{tunnel.remoteIp}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      tunnel.status === "up"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-red-900/40 text-red-400"
                    }`}
                  >
                    {tunnel.status === "up" ? "Aktif" : "Kapalı"}
                  </span>
                </div>
              </div>
            ))}
            {vpn.tunnels.length > 5 && (
              <p className="text-xs text-gray-600">
                +{vpn.tunnels.length - 5} tünel daha
              </p>
            )}
          </div>
        </div>
      )}

      {/* Fortinet sayfasına bağlantı */}
      <a
        href="/hesabim/fortinet"
        className="flex items-center justify-between border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors group"
      >
        <span className="text-sm text-gray-400 group-hover:text-gray-300">
          Fortinet Fabric ayarlarını ve olay akışını görüntüle
        </span>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
      </a>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IcTarama() {
  useRequireCustomer();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"scan" | "survey" | "ai-report" | "fortinet">("scan");
  const [showDownload, setShowDownload] = useState(false);

  const { data: scan, isLoading } = useQuery<InternalScan | null>({
    queryKey: ["/api/internal-scan/latest"],
    queryFn: async () => {
      const r = await fetch("/api/internal-scan/latest");
      if (!r.ok) {
        toast({ variant: "destructive", description: "Tarama bilgisi yüklenemedi" });
        return null;
      }
      return r.json() as Promise<InternalScan | null>;
    },
  });

  const hasScan = !isLoading && !!scan;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">İç Tarama</h1>
              <p className="text-sm text-gray-400">Ağ içi güvenlik durumu değerlendirmesi</p>
            </div>
          </div>
          {hasScan && activeTab === "scan" && (
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300"
              onClick={() => setShowDownload(!showDownload)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Script İndir
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900/60 rounded-lg p-1 border border-gray-800">
          <button
            onClick={() => { setActiveTab("scan"); setShowDownload(false); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "scan"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Server className="w-4 h-4" />
            Tarama Sonuçları
          </button>
          <button
            onClick={() => setActiveTab("survey")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "survey"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Güvenlik Anketi
          </button>
          <button
            onClick={() => setActiveTab("ai-report")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "ai-report"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Brain className="w-4 h-4" />
            AI Raporu
          </button>
          <button
            onClick={() => setActiveTab("fortinet")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "fortinet"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Network className="w-4 h-4" />
            Fortinet
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "scan" ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
              </div>
            ) : scan && !showDownload ? (
              <ScanResult scan={scan} />
            ) : (
              <DownloadSection />
            )}

            {scan && !showDownload && (
              <button
                className="mt-4 w-full text-left border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors flex items-center justify-between group"
                onClick={() => setShowDownload(true)}
              >
                <span className="text-sm text-gray-400 group-hover:text-gray-300">
                  Script'i tekrar indir veya farklı bir sunucu tara
                </span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
              </button>
            )}
          </>
        ) : activeTab === "survey" ? (
          <SurveySection />
        ) : activeTab === "ai-report" ? (
          <AiReportSection hasScan={hasScan} />
        ) : (
          <FortinetFabricTab />
        )}
      </div>
    </div>
  );
}
