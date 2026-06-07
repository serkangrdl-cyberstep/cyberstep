import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParams } from "wouter";
import { Shield, AlertTriangle, CheckCircle2, Clock, ArrowRight, Scale } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

interface Report {
  risk_category: string;
  executive_summary: string;
  applicable_articles: Array<{ article: string; title: string; applies: boolean; explanation: string }>;
  obligations: Array<{ obligation: string; deadline: string; effort: string; description: string; penalty: string }>;
  prohibited_alert: string | null;
  kvkk_overlap: string;
  priority_actions: Array<{ action: string; timeframe: string; why: string }>;
  penalty_exposure: { max_fine_eur: number; max_fine_tl_approx: number; basis: string };
}

interface AssessmentData {
  id: number;
  status: string;
  companyName: string;
  percentage: number;
  riskCategory: string;
  report: Report | null;
}

const RISK_COLORS: Record<string, string> = {
  unacceptable: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
  high_risk: "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
  limited_risk: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
  minimal_risk: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  not_applicable: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
};

const RISK_LABELS: Record<string, string> = {
  unacceptable: "Yasak Uygulama Tespit Edildi",
  high_risk: "Yüksek Riskli Sistem",
  limited_risk: "Sınırlı Risk",
  minimal_risk: "Minimum Risk",
  not_applicable: "Kapsam Dışı",
};

const EFFORT_LABEL: Record<string, string> = { kolay: "Kolay", orta: "Orta", zor: "Zor" };
const EFFORT_COLOR: Record<string, string> = {
  kolay: "bg-emerald-100 text-emerald-700",
  orta: "bg-yellow-100 text-yellow-700",
  zor: "bg-red-100 text-red-700",
};

export default function EuAiActRaporPage() {
  const { lang } = useLanguage();
  usePageMeta({ title: "EU AI Act Uyum Raporu" });
  const params = useParams();
  const id = Number(params["id"]);

  const [data, setData] = useState<AssessmentData | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/eu-aiact/${id}/report`);
        if (!r.ok) return;
        const d: AssessmentData = await r.json();
        setData(d);
        if (d.status === "completed" || d.status === "error") {
          setPolling(false);
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  if (!data || (polling && !data.report)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">AB AI Yasası Uyum Raporu hazırlanıyor...</p>
        <p className="text-sm text-muted-foreground/60">Bu işlem 15-30 saniye sürebilir</p>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Rapor oluşturulurken bir hata oluştu.</p>
          <Link href="/eu-ai-act"><Button variant="outline">Tekrar Dene</Button></Link>
        </div>
      </div>
    );
  }

  const r = data.report!;
  const riskClass = RISK_COLORS[data.riskCategory] ?? RISK_COLORS["minimal_risk"];
  const riskLabel = RISK_LABELS[data.riskCategory] ?? data.riskCategory;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Badge className="mb-3 bg-blue-600/20 text-blue-400 border-blue-500/30">{lang === "en" ? "EU AI Act Compliance Report" : "EU AI Act Uyum Raporu"}</Badge>
          <h1 className="text-3xl font-bold mb-1">{data.companyName}</h1>
          <p className="text-muted-foreground text-sm">Değerlendirme #{data.id}</p>
        </div>

        {/* Risk Category */}
        <div className={`border rounded-xl p-6 mb-6 ${riskClass}`}>
          {r.prohibited_alert && (
            <div className="flex items-start gap-2 mb-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{r.prohibited_alert}</p>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-lg">{riskLabel}</span>
            <span className="text-2xl font-bold">%{data.percentage}</span>
          </div>
          <p className="text-sm leading-relaxed">{r.executive_summary}</p>
        </div>

        {/* Penalty Exposure */}
        {r.penalty_exposure?.max_fine_eur > 0 && (
          <Card className="mb-6 border-orange-500/30 bg-orange-950/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold">Maksimum Ceza Maruziyeti</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Avrupa'da</p>
                  <p className="font-bold text-orange-500">€{r.penalty_exposure.max_fine_eur.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">TL karşılığı</p>
                  <p className="font-bold text-orange-500">{r.penalty_exposure.max_fine_tl_approx.toLocaleString()} TL</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{r.penalty_exposure.basis}</p>
            </CardContent>
          </Card>
        )}

        {/* Priority Actions */}
        {r.priority_actions?.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                Öncelikli Uyum Adımları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {r.priority_actions.map((a, i) => (
                <div key={i} className="flex gap-3 p-3 bg-muted/40 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.action}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {a.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.why}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Obligations */}
        {r.obligations?.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Yükümlülükleriniz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {r.obligations.map((o, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{o.obligation}</p>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">{o.deadline}</Badge>
                      <Badge className={`text-xs ${EFFORT_COLOR[o.effort] ?? ""}`}>{EFFORT_LABEL[o.effort] ?? o.effort}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{o.description}</p>
                  {o.penalty && <p className="text-xs text-orange-500 mt-1">Ceza: {o.penalty}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Applicable Articles */}
        {r.applicable_articles?.filter(a => a.applies).length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uygulanan AB AI Yasası Maddeleri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {r.applicable_articles.filter(a => a.applies).map((a, i) => (
                <div key={i} className="flex gap-3 p-2.5 bg-muted/40 rounded-lg">
                  <Badge variant="outline" className="text-xs shrink-0">{a.article}</Badge>
                  <div>
                    <p className="font-medium text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.explanation}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KVKK Overlap */}
        {r.kvkk_overlap && (
          <Card className="mb-8 border-emerald-500/30 bg-emerald-950/10">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-1 text-emerald-400">KVKK ile Örtüşme</h3>
              <p className="text-sm text-muted-foreground">{r.kvkk_overlap}</p>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="border rounded-xl p-6 text-center">
          <h3 className="font-semibold mb-2">Bir sonraki adım</h3>
          <p className="text-muted-foreground text-sm mb-4">Tam güvenlik durumunuzu da görün — siber riskler ve AB AI Yasası birlikte değerlendirin.</p>
          <Link href="/assessment/start">
            <Button className="bg-primary text-primary-foreground">
              Ücretsiz Siber Risk Değerlendirmesi <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
