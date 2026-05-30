import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Building2, Globe,
} from "lucide-react";

const ANSWER_OPTIONS = [
  { value: "evet", label: "Evet", score: 10, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" },
  { value: "kismen", label: "Kısmen", score: 5, cls: "border-amber-500/40 bg-amber-500/10 text-amber-400 ring-amber-500/30" },
  { value: "hayir", label: "Hayır", score: 0, cls: "border-red-500/40 bg-red-500/10 text-red-400 ring-red-500/30" },
] as const;

type AnswerValue = "evet" | "kismen" | "hayir";

interface Question { id: number; text: string; weight: number }

interface QuestionnaireData {
  companyName: string;
  companySector: string;
  supplierDomain: string;
  supplierName: string | null;
  scanScore: number | null;
  expiresAt: string;
  questions: Question[];
  alreadyCompleted: boolean;
  existingResult: { selfScore: number; combinedScore: number | null; completedAt: string } | null;
}

interface SubmitResult {
  selfScore: number;
  combinedScore: number | null;
  riskLevel: string;
  aiRiskComment: string;
}

export default function TprmAnket() {
  const [, params] = useRoute("/tprm/anket/:token");
  const token = params?.token ?? "";

  const [data, setData] = useState<QuestionnaireData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/tprm/questionnaire/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d as QuestionnaireData);
      })
      .catch(e => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  function setAnswer(questionId: number, val: AnswerValue) {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const unanswered = data.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      setSubmitError(`Lütfen tüm soruları yanıtlayın (${unanswered.length} soru yanıtsız)`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/tprm/questionnaire/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierContactName: contactName,
          supplierContactEmail: contactEmail,
          answers: data.questions.map(q => ({ questionId: q.id, answer: answers[q.id] })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Gönderilemedi");
      setSubmitResult(result as SubmitResult);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = data?.questions.length ?? 0;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const riskColor = (level: string) =>
    level === "Düşük" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : level === "Orta" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Anket yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="font-bold text-lg mb-2">Anket Bulunamadı</h2>
            <p className="text-muted-foreground text-sm">
              {loadError ?? "Bu bağlantı geçersiz veya süresi dolmuş."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.alreadyCompleted && data.existingResult && !submitResult) {
    const level = data.existingResult.combinedScore !== null
      ? (data.existingResult.combinedScore >= 70 ? "Düşük" : data.existingResult.combinedScore >= 40 ? "Orta" : "Yüksek")
      : (data.existingResult.selfScore >= 70 ? "Düşük" : data.existingResult.selfScore >= 40 ? "Orta" : "Yüksek");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-bold text-xl mb-2">Anket Tamamlandı</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Bu anketi daha önce tamamladınız.{" "}
              {new Date(data.existingResult.completedAt).toLocaleDateString("tr-TR")} tarihinde gönderildi.
            </p>
            <div className="rounded-xl border bg-muted/30 p-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Bileşik Risk Skoru</p>
              <p className="text-4xl font-bold mb-2">{data.existingResult.combinedScore ?? data.existingResult.selfScore}/100</p>
              <Badge variant="outline" className={`text-xs ${riskColor(level)}`}>{level} Risk</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-bold text-xl mb-2">Anket Gönderildi</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {data.companyName} ekibine iletildi. Teşekkürler.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Öz-Değerlendirme</p>
                <p className="text-3xl font-bold">{submitResult.selfScore}/100</p>
              </div>
              {submitResult.combinedScore !== null && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Bileşik Skor</p>
                  <p className="text-3xl font-bold">{submitResult.combinedScore}/100</p>
                  <p className="text-xs text-muted-foreground mt-0.5">tarama + beyan</p>
                </div>
              )}
            </div>

            <Badge variant="outline" className={`text-sm px-3 py-1 ${riskColor(submitResult.riskLevel)}`}>
              {submitResult.riskLevel} Risk
            </Badge>

            {submitResult.aiRiskComment && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-4 text-left bg-muted/30 rounded-lg p-4">
                {submitResult.aiRiskComment}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">CyberStep.io</span>
          </div>
          <Badge variant="outline" className="mb-3 border-violet-500/40 text-violet-400 bg-violet-500/5">
            Tedarikçi Siber Güvenlik Anketi
          </Badge>
          <h1 className="text-2xl font-bold mb-2">Siber Güvenlik Öz-Değerlendirmesi</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{data.companyName} tarafından gönderildi</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
            <Globe className="h-4 w-4" />
            <span>{data.supplierDomain}</span>
          </div>
        </div>

        {/* Context */}
        <Card className="mb-6 border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{data.companyName}</strong> tedarik zinciri risk yönetimi (TPRM)
              çerçevesinde sizinle iş ortaklığını değerlendiriyor. Bu anket yaklaşık <strong>3 dakika</strong> sürer.
              Yanıtlarınız teknik domain tarama verileriyle birleştirilerek bileşik bir risk skoru oluşturulur.
            </p>
            {data.scanScore !== null && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Globe className="h-3.5 w-3.5 text-violet-400" />
                <span>Domain teknik tarama skoru: <strong>{data.scanScore}/100</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={submit}>
          {/* İletişim bilgileri */}
          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İletişim Bilgileriniz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ad Soyad *</Label>
                  <Input
                    required
                    placeholder="Ad Soyad"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kurumsal E-posta *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="ad@firmaniz.com"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* İlerleme */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>{answeredCount}/{totalQuestions} soru yanıtlandı</span>
            <span>%{progress}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          {/* Sorular */}
          <div className="space-y-4">
            {data.questions.map((q, i) => {
              const selected = answers[q.id];
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs text-muted-foreground">Soru {i + 1}</CardDescription>
                    <CardTitle className="text-sm font-medium leading-relaxed">{q.text}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2">
                      {ANSWER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswer(q.id, opt.value)}
                          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            selected === opt.value
                              ? `${opt.cls} ring-1`
                              : "border-border hover:border-primary/40 text-muted-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {submitError && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full mt-6 bg-violet-600 hover:bg-violet-700 text-white"
            disabled={submitting || !contactName || !contactEmail}
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gönderiliyor...</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" /> Anketi Gönder</>}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Yanıtlarınız yalnızca tedarikçi risk değerlendirmesi amacıyla kullanılır.
            Bağlantı geçerlilik tarihi: {new Date(data.expiresAt).toLocaleDateString("tr-TR")}
          </p>
        </form>
      </div>
    </div>
  );
}
