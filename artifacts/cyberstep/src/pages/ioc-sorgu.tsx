import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Shield, AlertTriangle, CheckCircle, Clock, History,
  Zap, Globe, Hash, Link, ChevronDown, ChevronUp, CreditCard, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

const THREAT_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/40",
  high:     "bg-orange-500/15 text-orange-400 border-orange-500/40",
  medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  low:      "bg-blue-500/15 text-blue-400 border-blue-500/40",
  clean:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  unknown:  "bg-slate-500/15 text-slate-400 border-slate-500/40",
};

const THREAT_LABELS: Record<string, string> = {
  critical: "Kritik",
  high:     "Yuksek",
  medium:   "Orta",
  low:      "Dusuk",
  clean:    "Temiz",
  unknown:  "Bilinmiyor",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  ip:     Globe,
  domain: Globe,
  hash:   Hash,
  url:    Link,
  email:  Globe,
};

interface QueryResult {
  queryId: number;
  queryType: string;
  queryValue: string;
  status: string;
  cached?: boolean;
  threatLevel?: string;
  threatScore?: number;
  summary?: string;
  indicators?: Array<{ source: string; finding: string; severity: string }>;
  recommendations?: Array<{ priority: string; action: string; explanation: string }>;
  sources?: Record<string, boolean>;
  processingTimeMs?: number;
  createdAt?: string;
}

interface Credits {
  monthly_included: number;
  purchased: number;
  used: number;
  remaining: number;
  reset_date?: string;
  packs?: Array<{ credits: number; price_tl: number; label: string }>;
}

export default function IocSorgu() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [activeQueryId, setActiveQueryId] = useState<number | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: credits, refetch: refetchCredits } = useQuery<Credits>({
    queryKey: ["/api/portal/ioc/credits"],
    queryFn: async () => {
      const r = await fetch("/api/portal/ioc/credits");
      if (!r.ok) throw new Error("Kredi bilgisi alınamadı");
      return r.json() as Promise<Credits>;
    },
  });

  const { data: history, refetch: refetchHistory } = useQuery<{ queries: QueryResult[] }>({
    queryKey: ["/api/portal/ioc/history"],
    queryFn: async () => {
      const r = await fetch("/api/portal/ioc/history");
      if (!r.ok) throw new Error("Geçmiş alınamadı");
      return r.json() as Promise<{ queries: QueryResult[] }>;
    },
  });

  const { data: queryResult, refetch: refetchQuery } = useQuery<QueryResult>({
    queryKey: ["/api/portal/ioc/query", activeQueryId],
    queryFn: async () => {
      if (!activeQueryId) throw new Error("No query ID");
      const r = await fetch(`/api/portal/ioc/query/${activeQueryId}`);
      if (!r.ok) throw new Error("Sonuç alınamadı");
      return r.json() as Promise<QueryResult>;
    },
    enabled: !!activeQueryId,
  });

  // Polling — query tamamlanana kadar
  useEffect(() => {
    if (!activeQueryId) return;
    if (queryResult?.status === "completed" || queryResult?.status === "error") {
      if (pollRef.current) clearInterval(pollRef.current);
      refetchCredits().catch(() => void 0);
      refetchHistory().catch(() => void 0);
      return;
    }
    pollRef.current = setInterval(() => {
      refetchQuery().catch(() => void 0);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeQueryId, queryResult?.status, refetchQuery, refetchCredits, refetchHistory]);

  const queryMutation = useMutation({
    mutationFn: async (value: string) => {
      const r = await fetch("/api/portal/ioc/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await r.json() as { error?: string; queryId?: number; cached?: boolean; status?: string; remaining?: number; threatLevel?: string; threatScore?: number; summary?: string; indicators?: unknown; recommendations?: unknown; sources?: unknown };
      if (!r.ok) throw new Error(data.error || "Sorgu başlatılamadı");
      return data;
    },
    onSuccess: (data) => {
      if (data.cached) {
        setActiveQueryId(data.queryId ?? null);
        return;
      }
      setActiveQueryId(data.queryId ?? null);
      toast({ description: "Sorgu başlatıldı. Sonuç bekleniyor..." });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setActiveQueryId(null);
    if (pollRef.current) clearInterval(pollRef.current);
    queryMutation.mutate(inputValue.trim());
  };

  const loadHistoryQuery = (q: QueryResult) => {
    setActiveQueryId(q.queryId);
  };

  const priorityLabel: Record<string, string> = {
    immediate: "Hemen",
    soon:      "Yakında",
    monitor:   "Izle",
  };

  const priorityColor: Record<string, string> = {
    immediate: "text-red-400",
    soon:      "text-orange-400",
    monitor:   "text-blue-400",
  };

  const isLoading = queryMutation.isPending || (activeQueryId !== null && queryResult?.status === "processing");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Baslik */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{lang === "en" ? "Threat Intelligence Center" : "Tehdit Sorgulama Merkezi"}</h1>
          </div>
          <p className="text-slate-400 text-sm">
            IP, domain, dosya hash veya URL sorgulayın. Shodan, VirusTotal, AbuseIPDB ve daha fazlası paralel analiz eder.
          </p>
        </div>

        {/* Arama kutusu */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="185.143.x.x   phishing.com   d41d8cd9...   https://..."
                className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 h-11"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={isLoading || !inputValue.trim()} className="h-11 px-6">
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Sorgula"}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Desteklenen tipler: IPv4, IPv6, domain, MD5/SHA1/SHA256 hash, URL, e-posta
          </p>
        </form>

        {/* Kredi durumu */}
        {credits && (
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-slate-900 border border-slate-800">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">
              Kalan Krediniz:{" "}
              <span className={credits.remaining <= 2 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {credits.remaining}
              </span>
              <span className="text-slate-500"> / {credits.monthly_included + credits.purchased}</span>
            </span>
            {credits.remaining <= 2 && (
              <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                Kredi azalıyor
              </Badge>
            )}
          </div>
        )}

        {/* Sonuc */}
        {activeQueryId && queryResult && (
          <Card className="mb-8 bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {queryResult.queryType && (() => {
                      const Icon = TYPE_ICONS[queryResult.queryType] || Globe;
                      return <Icon className="w-4 h-4 text-slate-400" />;
                    })()}
                    <code className="text-sm font-mono text-slate-200">{queryResult.queryValue}</code>
                    {queryResult.cached && (
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Önbellekten</Badge>
                    )}
                  </div>
                  {queryResult.threatLevel && (
                    <Badge className={`text-xs border ${THREAT_COLORS[queryResult.threatLevel] || THREAT_COLORS["unknown"]}`}>
                      {queryResult.threatScore !== undefined ? `${queryResult.threatScore}/100 — ` : ""}
                      {THREAT_LABELS[queryResult.threatLevel] || queryResult.threatLevel}
                    </Badge>
                  )}
                </div>
                {queryResult.status === "processing" && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Analiz ediliyor...
                  </div>
                )}
                {queryResult.processingTimeMs && (
                  <span className="text-xs text-slate-500">{(queryResult.processingTimeMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            </CardHeader>

            {queryResult.status === "completed" && (
              <CardContent className="space-y-4">
                {/* AI Ozet */}
                {queryResult.summary && (
                  <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
                    <p className="text-sm text-slate-200 leading-relaxed">{queryResult.summary}</p>
                  </div>
                )}

                {/* Gostergeler */}
                {queryResult.indicators && queryResult.indicators.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Gostergeler</h3>
                    <div className="space-y-2">
                      {queryResult.indicators.map((ind, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded bg-slate-800/40">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            ind.severity === "critical" ? "bg-red-500" :
                            ind.severity === "high" ? "bg-orange-500" :
                            ind.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"
                          }`} />
                          <div>
                            <span className="text-xs font-medium text-slate-300">{ind.source}</span>
                            <p className="text-xs text-slate-400 mt-0.5">{ind.finding}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Oneriler */}
                {queryResult.recommendations && queryResult.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Onerilen Aksiyonlar</h3>
                    <div className="space-y-2">
                      {queryResult.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded bg-slate-800/40 border border-slate-700/50">
                          <Zap className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${priorityColor[rec.priority] || "text-slate-400"}`} />
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-200">{rec.action}</span>
                              <span className={`text-xs ${priorityColor[rec.priority] || "text-slate-500"}`}>
                                {priorityLabel[rec.priority] || rec.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{rec.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kaynak detaylari */}
                {queryResult.sources && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sorgulanan Kaynaklar</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(queryResult.sources).map(([src, active]) => (
                        active ? (
                          <Badge key={src} variant="outline" className="text-xs border-slate-600 text-slate-300">
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                            {src}
                          </Badge>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}

            {queryResult.status === "error" && (
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Sorgu tamamlanamadı. Lutfen tekrar deneyin.
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Gecmis */}
        {history && history.queries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-300">Son Sorgular</h2>
            </div>
            <div className="space-y-2">
              {history.queries.slice(0, 10).map((q) => (
                <button
                  key={q.queryId}
                  onClick={() => loadHistoryQuery(q)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-left"
                >
                  {q.threatLevel ? (
                    <Badge className={`text-xs border flex-shrink-0 ${THREAT_COLORS[q.threatLevel] || THREAT_COLORS["unknown"]}`}>
                      {THREAT_LABELS[q.threatLevel] || q.threatLevel}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 flex-shrink-0">
                      <Clock className="w-3 h-3 mr-1" />
                      {q.status === "processing" ? "Isleniyor" : q.status}
                    </Badge>
                  )}
                  <code className="text-xs font-mono text-slate-300 flex-1 truncate">{q.queryValue}</code>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {q.cached ? "Önbellekten" : "1 Kredi"}
                  </span>
                  <span className="text-xs text-slate-600 flex-shrink-0">
                    {q.createdAt ? new Date(q.createdAt).toLocaleDateString("tr-TR") : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
