import { useState, useRef } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, RotateCcw } from "lucide-react";

interface ScanResult {
  id: number;
  verdict: string;
  confidence: number;
  aiGenerationProbability: number;
  manipulationProbability: number;
  metadataAnomalies: string[];
  riskFactors: string[];
  analysisSummary: string;
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  authentic: { label: "Gerçek Görünüyor", color: "text-emerald-600", icon: CheckCircle2, bg: "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700" },
  suspicious: { label: "Şüpheli", color: "text-yellow-600", icon: AlertTriangle, bg: "bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700" },
  likely_ai: { label: "Muhtemelen AI Üretimi", color: "text-orange-600", icon: AlertTriangle, bg: "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700" },
  manipulated: { label: "Manipüle Edilmiş", color: "text-red-600", icon: XCircle, bg: "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700" },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export default function SahteDokulmanPage() {
  usePageMeta({ title: "AI Sahte Doküman Tespiti", description: "Fatura, sözleşme veya kimlik belgesi gerçek mi? AI ile üretilmiş veya manipüle edilmiş mi? Saniyeler içinde öğrenin." });

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function getFileType(f: File): string {
    if (f.type === "application/pdf") return "pdf";
    if (f.type === "image/jpeg" || f.type === "image/jpg") return "jpg";
    if (f.type === "image/png") return "png";
    return "image";
  }

  async function scanFile(f: File) {
    setFile(f);
    setError("");
    setResult(null);

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Desteklenmeyen dosya türü. PDF, JPG veya PNG yükleyin.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("Dosya 10MB'dan büyük olamaz.");
      return;
    }

    setScanning(true);
    try {
      const arrayBuffer = await f.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const r = await fetch("/api/document-scan/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f.name,
          fileType: getFileType(f),
          fileBase64: base64,
        }),
      });

      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Tarama başarısız"); return; }
      setResult(data);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setScanning(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) scanFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) scanFile(f);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const verdictCfg = result ? (VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG["suspicious"]) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-b from-amber-950 via-amber-900 to-background pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <Badge className="mb-4 bg-amber-600/20 text-amber-300 border-amber-600/30">
            <FileText className="h-3.5 w-3.5 mr-1" /> AI Doküman Tespiti
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Fatura, Sözleşme, Kimlik<br />
            <span className="text-amber-400">Gerçek mi, Sahte mi?</span>
          </h1>
          <p className="text-amber-100/80 text-base mb-2">
            Yapay zeka ile üretilmiş veya manipüle edilmiş belgeleri saniyeler içinde tespit edin.
          </p>
          <p className="text-amber-200/50 text-sm">Muhasebe firması ayda 200 fatura tarıyorsa: 9.800 TL gelir. Maliyet: Hive API ~100 USD/ay.</p>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-12">
        {!result ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !scanning && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragOver ? "border-amber-500 bg-amber-50/10" : scanning ? "border-muted cursor-not-allowed" : "border-border hover:border-amber-400 hover:bg-muted/20"
              }`}
            >
              <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileInput} className="hidden" />
              {scanning ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                  <p className="text-muted-foreground font-medium">Taranıyor: {file?.name}</p>
                  <p className="text-sm text-muted-foreground/60">Metadata ve içerik analizi yapılıyor...</p>
                  <Progress value={65} className="w-48 h-1.5" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-12 w-12 text-amber-500/60" />
                  <div>
                    <p className="font-semibold text-lg">Dosyayı buraya sürükleyin</p>
                    <p className="text-muted-foreground text-sm">veya tıklayarak seçin</p>
                  </div>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG — Maksimum 10MB</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Pricing */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <Card className="border-amber-500/20 bg-amber-950/10">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">49 TL</p>
                  <p className="text-sm text-muted-foreground">Tek tarama</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/30 bg-amber-950/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">490 TL/ay</p>
                  <p className="text-sm text-muted-foreground">100 tarama / ay</p>
                </CardContent>
              </Card>
            </div>

            {/* What it checks */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Neler kontrol ediliyor?</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "AI üretimi olasılık yüzdesi",
                  "Metadata anomali tespiti",
                  "Manipülasyon belirtileri",
                  "Font tutarsızlıkları",
                  "Tarih anomalileri",
                  "Dosya format tutarlılığı",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Result */}
            <div className={`border rounded-xl p-6 mb-6 ${verdictCfg?.bg ?? ""}`}>
              <div className="flex items-center gap-3 mb-3">
                {verdictCfg && <verdictCfg.icon className={`h-8 w-8 ${verdictCfg.color}`} />}
                <div>
                  <p className={`text-xl font-bold ${verdictCfg?.color ?? ""}`}>{verdictCfg?.label}</p>
                  <p className="text-sm text-muted-foreground">Güven skoru: %{result.confidence}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{result.analysisSummary}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">AI Üretim Olasılığı</p>
                  <p className={`text-2xl font-bold ${result.aiGenerationProbability > 50 ? "text-red-500" : result.aiGenerationProbability > 25 ? "text-orange-500" : "text-emerald-500"}`}>
                    %{result.aiGenerationProbability}
                  </p>
                  <Progress value={result.aiGenerationProbability} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Manipülasyon Olasılığı</p>
                  <p className={`text-2xl font-bold ${result.manipulationProbability > 50 ? "text-red-500" : result.manipulationProbability > 25 ? "text-orange-500" : "text-emerald-500"}`}>
                    %{result.manipulationProbability}
                  </p>
                  <Progress value={result.manipulationProbability} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Risk Factors */}
            {result.riskFactors.length > 0 && (
              <Card className="mb-6 border-orange-500/30 bg-orange-950/10">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Risk Faktörleri
                  </h3>
                  <ul className="space-y-1">
                    {result.riskFactors.map((f, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Metadata Anomalies */}
            {result.metadataAnomalies.length > 0 && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2">Metadata Anomalileri</h3>
                  <ul className="space-y-1">
                    {result.metadataAnomalies.map((a, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={reset} variant="outline" className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" /> Yeni Tarama
              </Button>
              <Button onClick={() => inputRef.current?.click()} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                Başka Belge Tara <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
