import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Shield, AlertTriangle, Zap, CheckCircle2, XCircle,
  Loader2, ChevronRight, RotateCcw, Target, Lock, Activity,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface DomainScan {
  id: number;
  domain: string;
  overallScore: number | null;
  createdAt: string;
  findings: Record<string, unknown> | null;
  cveSummary: Array<{ id: string; description: string; cvss: number }> | null;
  httpHeaders: Record<string, unknown> | null;
  orphanedAssets: Array<{ host: string; risk: string }> | null;
}

interface Finding {
  type: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
}

interface SimResult {
  id: number;
  domain: string;
  status: "queued" | "analyzing" | "completed" | "failed";
  reportJson: {
    summary: string;
    overallExploitability: "Yüksek" | "Orta" | "Düşük";
    scenarios: Array<{
      findingTitle: string;
      exploitable: boolean;
      probability: "Yüksek" | "Orta" | "Düşük";
      attackChain: string;
      impact: string;
      mitigation: string;
      priority: number;
    }>;
    attackNarrative: string;
    topRemediation: string[];
  } | null;
  errorMessage: string | null;
  createdAt: string;
}

function extractFindings(scan: DomainScan): Finding[] {
  const out: Finding[] = [];

  // CVE bulgular
  if (Array.isArray(scan.cveSummary)) {
    for (const cve of scan.cveSummary.slice(0, 5)) {
      out.push({
        type: "CVE",
        title: `${cve.id} — CVSS ${cve.cvss}`,
        severity: cve.cvss >= 9 ? "critical" : cve.cvss >= 7 ? "high" : "medium",
        detail: cve.description?.slice(0, 200) ?? cve.id,
      });
    }
  }

  // Orphaned assets
  if (Array.isArray(scan.orphanedAssets)) {
    const high = scan.orphanedAssets.filter(a => a.risk === "high").slice(0, 3);
    for (const a of high) {
      out.push({
        type: "Shadow IT",
        title: `WAF Korumasız Host: ${a.host}`,
        severity: "high",
        detail: `ASN üzerinde tespit edilen, WAF veya CDN koruması olmayan açık host: ${a.host}`,
      });
    }
  }

  // HTTP headers
  const h = scan.httpHeaders as Record<string, boolean> | null;
  if (h) {
    const missingHeaders: string[] = [];
    if (h["x-frame-options"] === false) missingHeaders.push("X-Frame-Options");
    if (h["content-security-policy"] === false) missingHeaders.push("Content-Security-Policy");
    if (h["x-content-type-options"] === false) missingHeaders.push("X-Content-Type-Options");
    if (missingHeaders.length >= 2) {
      out.push({
        type: "HTTP Başlıklar",
        title: `Eksik güvenlik başlıkları: ${missingHeaders.join(", ")}`,
        severity: "medium",
        detail: `Aşağıdaki kritik HTTP güvenlik başlıkları eksik: ${missingHeaders.join(", ")}. Bu açıklar XSS ve clickjacking saldırılarına zemin hazırlar.`,
      });
    }
  }

  // Genel findings
  const f = scan.findings as Record<string, { pass: boolean; detail?: string }> | null;
  if (f) {
    if (f["spf"]?.pass === false) {
      out.push({ type: "E-posta Güvenliği", title: "SPF kaydı eksik/hatalı", severity: "high", detail: "SPF eksikliği e-posta sahteciliğine (spoofing) izin verir." });
    }
    if (f["dmarc"]?.pass === false) {
      out.push({ type: "E-posta Güvenliği", title: "DMARC politikası yok", severity: "high", detail: "DMARC olmadan phishing e-postaları şirket adına gönderilebilir." });
    }
    if (f["ssl"]?.pass === false) {
      out.push({ type: "SSL/TLS", title: "SSL sertifikası sorunu", severity: "medium", detail: "Geçersiz veya süresi dolmuş SSL sertifikası MITM saldırılarına zemin hazırlar." });
    }
  }

  return out.slice(0, 12);
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük",
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-500/30",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  low: "bg-green-500/10 text-green-600 border-green-500/30",
};
const PROB_COLOR: Record<string, string> = {
  "Yüksek": "text-red-500", "Orta": "text-yellow-500", "Düşük": "text-green-500",
};

export default function BasLite() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "BAS Lite — Attack Simulation | CyberStep.io" : "BAS Lite — Saldırı Simülasyonu | CyberStep.io",
    description: lang === "en"
      ? "Validate whether your security findings are actually exploitable. AI-powered Breach & Attack Simulation for SMEs."
      : "Güvenlik bulgularınızın gerçekten sömürülebilir olup olmadığını doğrulayın. KOBİ'ler için yapay zeka destekli Breach & Attack Simulation.",
  });

  const [selectedScan, setSelectedScan] = useState<DomainScan | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [simId, setSimId] = useState<number | null>(null);

  const qClient = useQueryClient();

  const { data: scans = [], isLoading: scansLoading } = useQuery<DomainScan[]>({
    queryKey: ["bas-domains"],
    queryFn: () => fetch("/api/bas-lite/domains/recent", { credentials: "include" }).then(r => r.json()),
  });

  const findings: Finding[] = selectedScan ? extractFindings(selectedScan) : [];

  const { data: simResult, isLoading: simLoading } = useQuery<SimResult>({
    queryKey: ["bas-sim", simId],
    queryFn: () =>
      fetch(`/api/bas-lite/${simId}`, { credentials: "include" }).then(r => r.json()),
    enabled: simId !== null,
    refetchInterval: (data) => {
      const d = data.state.data;
      if (!d || d.status === "queued" || d.status === "analyzing") return 2500;
      return false;
    },
  });

  const analyze = useMutation({
    mutationFn: async () => {
      const chosen = findings.filter((_, i) => selectedFindings.has(i));
      const res = await fetch("/api/bas-lite/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: selectedScan?.domain,
          findings: chosen,
        }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? "Analiz başlatılamadı");
      }
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (d) => {
      setSimId(d.id);
      void qClient.invalidateQueries({ queryKey: ["bas-sim", d.id] });
    },
  });

  const isAnalyzing = simResult?.status === "queued" || simResult?.status === "analyzing";
  const isDone = simResult?.status === "completed";
  const isFailed = simResult?.status === "failed";

  function reset() {
    setSimId(null);
    setSelectedScan(null);
    setSelectedFindings(new Set());
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
      {/* Hero */}
      <section className="py-12 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl text-center">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">CTEM Dogrulama</Badge>
          <h1 className="text-3xl font-bold text-white mb-3">
            {lang === "en" ? "BAS Lite — Attack Simulation" : "BAS Lite — Saldırı Simülasyonu"}
          </h1>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            {lang === "en"
              ? "Select your domain's security findings and our AI validates which ones are actually exploitable — and shows the attack chain."
              : "Domain taramanızdaki bulguları seçin, yapay zekamız hangilerinin gerçekten sömürülebilir olduğunu doğrulasın ve saldırı zincirini göstersin."}
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">

        {/* Giriş Kontrolü */}
        {!selectedScan && !simId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {lang === "en" ? "Select a domain scan" : "Domain taraması seçin"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scansLoading ? (
                <p className="text-sm text-muted-foreground">Taramalar yükleniyor...</p>
              ) : scans.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    {lang === "en"
                      ? "No domain scans found. Run a domain scan first."
                      : "Domain taraması bulunamadı. Önce bir domain taraması yapın."}
                  </p>
                  <Link href="/domain-scan">
                    <Button variant="outline" size="sm">
                      {lang === "en" ? "Go to Domain Scan" : "Domain Taramasına Git"}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {scans.map(scan => (
                    <button
                      key={scan.id}
                      onClick={() => { setSelectedScan(scan); setSelectedFindings(new Set()); }}
                      className="w-full text-left flex items-center justify-between p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{scan.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {scan.overallScore !== null && (
                          <span className={`text-sm font-bold ${
                            scan.overallScore >= 70 ? "text-green-500" :
                            scan.overallScore >= 40 ? "text-yellow-500" : "text-red-500"
                          }`}>{scan.overallScore}/100</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bulgu Seçimi */}
        {selectedScan && !simId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">{selectedScan.domain}</h2>
                <p className="text-xs text-muted-foreground">
                  {lang === "en" ? "Select findings to simulate" : "Simüle edilecek bulguları seçin"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedScan(null)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {lang === "en" ? "Change domain" : "Değiştir"}
              </Button>
            </div>

            {findings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {lang === "en"
                      ? "No significant findings detected in this scan."
                      : "Bu taramada önemli bulgu tespit edilmedi."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {findings.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedFindings(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      }}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        selectedFindings.has(i)
                          ? "border-primary/60 bg-primary/5"
                          : "hover:border-muted-foreground/30"
                      }`}
                    >
                      <Checkbox
                        checked={selectedFindings.has(i)}
                        onChange={() => {}}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium">{f.title}</span>
                          <Badge className={`text-xs border ${SEVERITY_COLOR[f.severity]}`}>
                            {SEVERITY_LABEL[f.severity]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{f.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedFindings.size} / {findings.length} bulgu seçildi
                  </p>
                  <Button
                    onClick={() => analyze.mutate()}
                    disabled={selectedFindings.size === 0 || analyze.isPending}
                    size="sm"
                  >
                    {analyze.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Başlatılıyor...</>
                    ) : (
                      <><Target className="h-3.5 w-3.5 mr-1.5" />BAS Analizi Başlat</>
                    )}
                  </Button>
                </div>
                {analyze.isError && (
                  <p className="text-sm text-red-500 text-right">
                    {(analyze.error as Error).message}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Analiz Devam Ediyor */}
        {simId && (isAnalyzing || simLoading) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium mb-1">
                {lang === "en" ? "Analyzing attack surface..." : "Saldırı yüzeyi analiz ediliyor..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === "en"
                  ? "Claude AI is evaluating exploit probability and building attack chains."
                  : "Claude AI sömürülebilirlik olasılığını değerlendiriyor ve saldırı zincirleri oluşturuyor."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Başarısız */}
        {isFailed && (
          <Card className="border-red-500/30">
            <CardContent className="py-8 text-center">
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
              <p className="font-medium mb-1">Analiz başarısız</p>
              <p className="text-sm text-muted-foreground mb-4">{simResult?.errorMessage ?? "Bilinmeyen hata"}</p>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Tekrar Dene
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sonuç */}
        {isDone && simResult?.reportJson && (
          <div className="space-y-5">
            {/* Genel Özet */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    BAS Analiz Sonucu — {simResult.domain}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Genel Sömürülebilirlik:</span>
                    <Badge className={
                      simResult.reportJson.overallExploitability === "Yüksek" ? "bg-red-500/10 text-red-600 border-red-500/30 border" :
                      simResult.reportJson.overallExploitability === "Orta" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 border" :
                      "bg-green-500/10 text-green-600 border-green-500/30 border"
                    }>
                      {simResult.reportJson.overallExploitability}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{simResult.reportJson.summary}</p>
              </CardContent>
            </Card>

            {/* Senaryolar */}
            <div className="space-y-3">
              {simResult.reportJson.scenarios
                .sort((a, b) => a.priority - b.priority)
                .map((s, i) => (
                  <Card key={i} className={s.exploitable ? "border-orange-500/30" : "border-green-500/20"}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        {s.exploitable ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium">{s.findingTitle}</p>
                            <Badge variant="outline" className="text-xs">#{s.priority}</Badge>
                            <span className={`text-xs font-medium ${PROB_COLOR[s.probability]}`}>
                              {s.exploitable ? `Sömürülebilir — ${s.probability} olasılık` : "Sömürülemiyor"}
                            </span>
                          </div>
                          {s.exploitable && (
                            <div className="space-y-2 mt-2">
                              <div className="bg-muted/40 rounded-lg p-3">
                                <p className="text-xs font-medium mb-1 text-muted-foreground">Saldırı Zinciri</p>
                                <p className="text-xs">{s.attackChain}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Etki</p>
                                  <p className="text-xs">{s.impact}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Düzeltme</p>
                                  <p className="text-xs">{s.mitigation}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* Saldırı Senaryosu */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Kombinlenmiş Saldırı Senaryosu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {simResult.reportJson.attackNarrative}
                </p>
              </CardContent>
            </Card>

            {/* Top 3 Aksiyon */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Öncelikli Aksiyonlar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {simResult.reportJson.topRemediation.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Yeni Analiz
              </Button>
              <Link href="/domain-scan">
                <Button size="sm">
                  <Shield className="h-3.5 w-3.5 mr-1.5" />Domain Taramasına Git
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* CTA — Login gerekli */}
        {scans.length === 0 && !scansLoading && !selectedScan && !simId && (
          <div className="border-2 border-primary/30 bg-primary/5 p-5 rounded-xl text-center">
            <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
            <p className="font-semibold mb-1">
              {lang === "en" ? "Start with a free domain scan" : "Ücretsiz domain taramasıyla başlayın"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === "en"
                ? "BAS Lite works on top of your domain scan results. Run one first."
                : "BAS Lite, domain tarama sonuçlarınız üzerinde çalışır. Önce bir tarama yapın."}
            </p>
            <Link href="/domain-scan">
              <Button>
                {lang === "en" ? "Run Domain Scan" : "Domain Taraması Yap"}
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Globe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
