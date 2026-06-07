import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Loader2, Brain, AlertTriangle, CheckCircle, Shield, FileText, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RiskLevel = "KRITIK" | "YUKSEK" | "ORTA" | "DUSUK" | "IYI";

interface AiTool {
  id: number;
  toolName: string;
  provider: string | null;
  category: string | null;
  tier: string | null;
  riskLevel: string | null;
  riskSummary: string | null;
  recommendation: string | null;
  kvkkCompatible: boolean | null;
  dpaAvailable: boolean | null;
  dataRetentionDays: number | null;
  trainsOnUserData: boolean | null;
  lastReviewed: string | null;
}

interface ToolRiskCard {
  tool_name: string;
  main_risk: string;
  kvkk_implication: string;
  immediate_action: string;
}

interface PriorityAction {
  action: string;
  why: string;
  how: string;
  effort: string;
  timeframe: string;
}

interface ReportData {
  risk_headline: string;
  executive_summary: string;
  tool_risk_cards: ToolRiskCard[];
  data_exposure_summary: {
    level: string;
    exposed_data_types: string[];
    kvkk_articles: string[];
    estimated_fine_tl: number;
  };
  priority_actions: PriorityAction[];
  kvkk_compliance_gap: {
    compliant: boolean;
    gaps: string[];
    dpa_needed_for: string[];
  };
}

interface Assessment {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  sector: string;
  employeeCount: string;
  status: string;
  percentage: number | null;
  riskLevel: string | null;
  area1Score: number | null;
  area2Score: number | null;
  area3Score: number | null;
  area4Score: number | null;
  rawScore: number | null;
  maxScore: number | null;
  reportJson: ReportData | null;
  policyDocument: string | null;
  declaredTools: AiTool[];
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; badge: string }> = {
  KRITIK: { label: "Kritik Risk",   color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/20",     border: "border-red-200 dark:border-red-900/50",   badge: "bg-red-100 text-red-700 border-red-200" },
  YUKSEK: { label: "Yüksek Risk",   color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-900/50", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  ORTA:   { label: "Orta Risk",     color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-900/50", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  DUSUK:  { label: "Düşük Risk",    color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/20",   border: "border-green-200 dark:border-green-900/50",   badge: "bg-green-100 text-green-700 border-green-200" },
  IYI:    { label: "İyi",           color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/50", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const EFFORT_LABELS: Record<string, string> = { kolay: "Kolay", orta: "Orta", zor: "Zor" };
const TIMEFRAME_LABELS: Record<string, string> = { bu_hafta: "Bu Hafta", bu_ay: "Bu Ay", "3_ay": "3 Ay İçinde" };
const AREA_LABELS = ["Araç Yönetimi", "Veri Maruz Kalma", "Konfigürasyon", "KVKK Uyum"];
const AREA_KEYS: (keyof Assessment)[] = ["area1Score", "area2Score", "area3Score", "area4Score"];
const AREA_MAX = [50, 110, 45, 50];

export default function AiAssessmentReport() {
  const { lang } = useLanguage();
  const [, params] = useRoute("/ai-guvenlik/:id/rapor");
  const id = Number(params?.id ?? 0);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [activeTab, setActiveTab] = useState("genel");

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/ai-assessment/${id}/report`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as Assessment;
      setAssessment(data);
      if (data.status === "report_ready" || data.status === "report_failed") setPolling(false);
    } catch {
      // ignore
    }
  };

  const handleRetry = async () => {
    setTimedOut(false);
    try {
      const res = await fetch(`/api/ai-assessment/${id}/regenerate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json() as Assessment;
        setAssessment(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchReport().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!assessment) return undefined;
    const generatingStatuses = ["completed", "in_progress", "generating_report"];
    if (generatingStatuses.includes(assessment.status)) {
      setPolling(true);
      const interval = setInterval(fetchReport, 2000);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setPolling(false);
        setTimedOut(true);
      }, 4.5 * 60 * 1000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
    return undefined;
  }, [assessment?.status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Değerlendirme bulunamadı.</p>
      </div>
    );
  }

  const isReady = assessment.status === "report_ready";
  const riskConf = RISK_CONFIG[assessment.riskLevel ?? "ORTA"] ?? RISK_CONFIG.ORTA;
  const report = assessment.reportJson as ReportData | null;

  // Hata / zaman aşımı ekranı
  const isFailed = assessment.status === "report_failed" || timedOut;
  if (isFailed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Rapor Oluşturulamadı
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Yapay zeka analizi sırasında bir sorun oluştu. Tekrar denemek için aşağıdaki butona tıklayın.
          </p>
          <Button onClick={handleRetry} className="bg-violet-600 hover:bg-violet-700 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  // Hazırlanıyor ekranı
  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-6">
            <Brain className="h-8 w-8 text-violet-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            AI Risk Raporu Hazırlanıyor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Yapay zeka güvenlik analiziniz oluşturuluyor. KVKK uyum haritası ve şirketinize özel kullanım politikası da hazırlanıyor.
            <br /><br />Bu işlem genellikle 1-2 dakika sürer.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analiz ediliyor...</span>
          </div>
        </div>
      </div>
    );
  }

  const pct = assessment.percentage ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <div className={`${riskConf.bg} border-b ${riskConf.border}`}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Brain className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">AI Güvenlik Değerlendirmesi</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{assessment.companyName}</h1>
          <p className="text-sm text-slate-500 mb-4">{assessment.sector} · {assessment.employeeCount} çalışan</p>

          {report?.risk_headline && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${riskConf.border} bg-white dark:bg-slate-900 mb-4`}>
              <AlertTriangle className={`h-5 w-5 ${riskConf.color} flex-shrink-0 mt-0.5`} />
              <p className={`font-medium ${riskConf.color}`}>{report.risk_headline}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <p className="text-xs text-slate-500 mb-1">Genel Risk Skoru</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${riskConf.color}`}>{pct}%</span>
                <Badge className={`border text-sm ${riskConf.badge}`}>{riskConf.label}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="genel">Genel Bakis</TabsTrigger>
            <TabsTrigger value="araclar">Araç Risk Skorkartı</TabsTrigger>
            <TabsTrigger value="veri">Veri Maruz Kalma</TabsTrigger>
            <TabsTrigger value="kvkk">KVKK Durumu</TabsTrigger>
            <TabsTrigger value="aksiyon">Aksiyon Planı</TabsTrigger>
            <TabsTrigger value="politika">Politika Belgesi</TabsTrigger>
          </TabsList>

          {/* Genel Bakış */}
          <TabsContent value="genel" className="space-y-6">
            {report?.executive_summary && (
              <Card>
                <CardHeader>
                  <CardTitle>Yönetici Özeti</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{report.executive_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Alan skorları */}
            <Card>
              <CardHeader>
                <CardTitle>Alan Bazlı Skorlar</CardTitle>
                <CardDescription>4 güvenlik alanında performansınız</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {AREA_LABELS.map((label, i) => {
                    const score = assessment[AREA_KEYS[i]] as number | null ?? 0;
                    const maxScore = AREA_MAX[i];
                    const pctArea = Math.round((score / maxScore) * 100);
                    const conf = pctArea >= 86 ? RISK_CONFIG.IYI : pctArea >= 71 ? RISK_CONFIG.DUSUK : pctArea >= 51 ? RISK_CONFIG.ORTA : pctArea >= 31 ? RISK_CONFIG.YUKSEK : RISK_CONFIG.KRITIK;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
                          <span className={conf.color}>{score}/{maxScore} puan ({pctArea}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pctArea >= 71 ? "bg-green-500" : pctArea >= 51 ? "bg-yellow-500" : pctArea >= 31 ? "bg-orange-500" : "bg-red-500"
                            }`}
                            style={{ width: `${pctArea}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Araç Risk Skorkartı */}
          <TabsContent value="araclar" className="space-y-4">
            {assessment.declaredTools.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-slate-500">
                  Beyan edilen AI aracı yok. Değerlendirme sırasında araç seçilmedi.
                </CardContent>
              </Card>
            ) : (
              <>
                {assessment.declaredTools.map(tool => {
                  const tRisk = RISK_CONFIG[tool.riskLevel ?? "ORTA"] ?? RISK_CONFIG.ORTA;
                  const aiCard = report?.tool_risk_cards?.find(c => c.tool_name.toLowerCase().includes(tool.toolName.toLowerCase().split(" ")[0]));
                  return (
                    <Card key={tool.id} className={`border ${tRisk.border}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{tool.toolName}</CardTitle>
                          <Badge className={`border text-xs ${tRisk.badge}`}>{tRisk.label}</Badge>
                        </div>
                        {tool.provider && <CardDescription>{tool.provider}</CardDescription>}
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {tool.riskSummary && (
                          <p className="text-slate-600 dark:text-slate-400">{tool.riskSummary}</p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                          <div>
                            <p className="text-xs text-slate-400">Veri Saklama</p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {tool.dataRetentionDays === 0 ? "Saklamaz" : tool.dataRetentionDays === null ? "Bilinmiyor" : `${tool.dataRetentionDays} gün`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Eğitim Verisi</p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {tool.trainsOnUserData === true ? "Kullanabilir" : tool.trainsOnUserData === false ? "Kullanmaz" : "Bilinmiyor"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">DPA</p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {tool.dpaAvailable === true ? "İmzalanabilir" : tool.dpaAvailable === false ? "Yok" : "?"}
                            </p>
                          </div>
                        </div>
                        {aiCard && (
                          <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-900/50">
                            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">Acil Aksiyon</p>
                            <p className="text-xs text-violet-600 dark:text-violet-400">{aiCard.immediate_action}</p>
                          </div>
                        )}
                        {tool.recommendation && (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 dark:text-slate-400">{tool.recommendation}</p>
                          </div>
                        )}
                        {tool.lastReviewed && (
                          <p className="text-xs text-slate-400">Son güncelleme: {tool.lastReviewed}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </TabsContent>

          {/* Veri Maruz Kalma */}
          <TabsContent value="veri" className="space-y-4">
            {report?.data_exposure_summary ? (
              <>
                <Card className={`border ${(RISK_CONFIG[report.data_exposure_summary.level] ?? RISK_CONFIG.ORTA).border}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Veri Maruz Kalma Seviyesi</CardTitle>
                      <Badge className={`border ${(RISK_CONFIG[report.data_exposure_summary.level] ?? RISK_CONFIG.ORTA).badge}`}>
                        {(RISK_CONFIG[report.data_exposure_summary.level] ?? RISK_CONFIG.ORTA).label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.data_exposure_summary.exposed_data_types.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Risk Altındaki Veri Türleri</p>
                        <div className="flex flex-wrap gap-2">
                          {report.data_exposure_summary.exposed_data_types.map((type, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{type}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.data_exposure_summary.kvkk_articles.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">İlgili KVKK Maddeleri</p>
                        <div className="flex flex-wrap gap-2">
                          {report.data_exposure_summary.kvkk_articles.map((art, i) => (
                            <Badge key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200">{art}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.data_exposure_summary.estimated_fine_tl > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">
                          Tahmini Ceza Riski: {report.data_exposure_summary.estimated_fine_tl.toLocaleString("tr-TR")} TL
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="p-6 text-center text-slate-500">Veri analizi hazırlanıyor...</CardContent></Card>
            )}
          </TabsContent>

          {/* KVKK Durumu */}
          <TabsContent value="kvkk" className="space-y-4">
            {report?.kvkk_compliance_gap ? (
              <>
                <Card className={`border ${report.kvkk_compliance_gap.compliant ? "border-green-200" : "border-red-200"}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>KVKK Uyum Durumu</CardTitle>
                      <Badge className={report.kvkk_compliance_gap.compliant ? "bg-green-100 text-green-700 border-green-200 border" : "bg-red-100 text-red-700 border-red-200 border"}>
                        {report.kvkk_compliance_gap.compliant ? "Uyumlu" : "Eksikler Var"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.kvkk_compliance_gap.gaps.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Tespit Edilen Eksikler</p>
                        <ul className="space-y-2">
                          {report.kvkk_compliance_gap.gaps.map((gap, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-700 dark:text-slate-300">{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.kvkk_compliance_gap.dpa_needed_for.length > 0 && (
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">DPA İmzalanması Gereken Araçlar</p>
                        <div className="flex flex-wrap gap-2">
                          {report.kvkk_compliance_gap.dpa_needed_for.map((tool, i) => (
                            <Badge key={i} className="text-xs bg-orange-100 text-orange-700 border-orange-200 border">{tool}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="p-6 text-center text-slate-500">KVKK analizi hazırlanıyor...</CardContent></Card>
            )}
          </TabsContent>

          {/* Aksiyon Planı */}
          <TabsContent value="aksiyon" className="space-y-4">
            {report?.priority_actions?.length ? (
              report.priority_actions.map((action, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </div>
                        <CardTitle className="text-base">{action.action}</CardTitle>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">{EFFORT_LABELS[action.effort] ?? action.effort}</Badge>
                        <Badge className="text-xs bg-violet-50 text-violet-700 border-violet-200 border">{TIMEFRAME_LABELS[action.timeframe] ?? action.timeframe}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="ml-10 space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Neden önemli: </span>
                      <span className="text-slate-600 dark:text-slate-400">{action.why}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Nasıl yapılır: </span>
                      <span className="text-slate-600 dark:text-slate-400">{action.how}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card><CardContent className="p-6 text-center text-slate-500">Aksiyon planı hazırlanıyor...</CardContent></Card>
            )}
          </TabsContent>

          {/* Politika Belgesi */}
          <TabsContent value="politika" className="space-y-4">
            {assessment.policyDocument ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Yapay Zeka Araçları Kabul Edilebilir Kullanım Politikası</CardTitle>
                      <CardDescription className="mt-1">{assessment.companyName} için hazırlandı · İmzalanmaya hazır</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([assessment.policyDocument ?? ""], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${assessment.companyName}_AI_Kullanim_Politikasi.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" /> İndir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                      {assessment.policyDocument}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Politika belgesi hazırlanıyor...</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <div className="mt-8 border-2 border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/20 rounded-xl p-6 text-center">
          <Shield className="h-8 w-8 text-violet-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Siber Güvenliğinizin Tamamını Değerlendirin</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            AI güvenliğinin yanı sıra şifreler, ağ, yedekleme, fiziksel güvenlik ve KVKK uyumunu da kapsayan tam değerlendirmeyi tamamlayın.
          </p>
          <Link href="/assessment/start">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white">
              Mini Değerlendirmeye Geç (Ücretsiz) <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
