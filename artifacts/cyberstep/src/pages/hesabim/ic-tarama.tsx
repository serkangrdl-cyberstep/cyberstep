import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor, Terminal, Download, RefreshCw, Shield, ShieldAlert,
  ShieldCheck, AlertTriangle, CheckCircle, Clock, Server,
  ChevronRight, Copy, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

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
  rawData: {
    findings?: InternalScanFinding[];
    [k: string]: unknown;
  } | null;
  findingsCount: number | null;
  scannedAt: string | null;
  createdAt: string | null;
}

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
    high:     "bg-orange-900/40 text-orange-300 border-orange-700",
    medium:   "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    low:      "bg-blue-900/40 text-blue-300 border-blue-700",
  };
  return m[severity] ?? "bg-gray-700/40 text-gray-300 border-gray-600";
}

function severityLabel(severity: string): string {
  const m: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
  return m[severity] ?? severity;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <ShieldAlert className="w-4 h-4 text-red-400" />;
  if (severity === "high")     return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  if (severity === "medium")   return <Clock className="w-4 h-4 text-yellow-400" />;
  return <CheckCircle className="w-4 h-4 text-blue-400" />;
}

function categoryLabel(cat: string): string {
  const m: Record<string, string> = {
    os: "İşletim Sistemi", security: "Güvenlik", users: "Kullanıcılar",
    network: "Ağ", services: "Servisler",
  };
  return m[cat] ?? cat;
}

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

      {/* API Key display */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">API Anahtarınız</div>
        <div className="flex items-center gap-2 font-mono text-sm text-green-400">
          <span className="truncate">{apiKey}</span>
          <CopyButton text={apiKey} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Script indirildiğinde bu anahtar otomatik olarak gömülür.
        </p>
      </div>

      {/* Method A - Windows */}
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
          <p className="text-sm text-gray-400 mb-4">
            Yönetici PowerShell'de çalıştırın. Defender, BitLocker, AD politikası tarar.
          </p>
          <div className="bg-gray-950 rounded p-3 font-mono text-xs text-gray-300 mb-4 overflow-x-auto">
            .\cyberstep-scan.ps1
          </div>
          <Button
            onClick={() => downloadScript("windows")}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            .ps1 İndir
          </Button>
        </div>

        {/* Method B - Linux */}
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
          <p className="text-sm text-gray-400 mb-4">
            sudo ile çalıştırın. AV/EDR, UFW, LUKS şifreleme, SSH konfigürasyonu tarar.
          </p>
          <div className="bg-gray-950 rounded p-3 font-mono text-xs text-gray-300 mb-4 overflow-x-auto">
            chmod +x cyberstep-scan.sh && sudo ./cyberstep-scan.sh
          </div>
          <Button
            onClick={() => downloadScript("linux")}
            className="w-full bg-orange-700 hover:bg-orange-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            .sh İndir
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
      {/* Score header */}
      <div className={`border rounded-lg p-6 ${scoreBg(score)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">İç Tarama Skoru</div>
            <div className={`text-5xl font-bold ${scoreColor(score)}`}>{score}<span className="text-2xl text-gray-500">/100</span></div>
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

        {/* Breakdown */}
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

      {/* Findings */}
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
                  <div className="mt-0.5">
                    <SeverityIcon severity={f.severity} />
                  </div>
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

      {/* Rescan */}
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

function DownloadButtons() {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-gray-600 text-gray-300 hover:border-blue-500"
        onClick={() => { window.location.href = "/api/internal-scan/download-script?os=windows"; }}
      >
        <Monitor className="w-3.5 h-3.5 mr-1.5" />
        Windows
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-gray-600 text-gray-300 hover:border-orange-500"
        onClick={() => { window.location.href = "/api/internal-scan/download-script?os=linux"; }}
      >
        <Terminal className="w-3.5 h-3.5 mr-1.5" />
        Linux
      </Button>
    </div>
  );
}

export default function IcTarama() {
  useRequireCustomer();
  const { toast } = useToast();
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">İç Tarama</h1>
              <p className="text-sm text-gray-400">Ağ içi güvenlik durumu değerlendirmesi</p>
            </div>
          </div>
          {scan && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300"
              onClick={() => setShowDownload(!showDownload)}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Script İndir
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : scan && !showDownload ? (
          <ScanResult scan={scan} />
        ) : (
          <DownloadSection />
        )}

        {/* History shortcut when scan exists */}
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
      </div>
    </div>
  );
}
