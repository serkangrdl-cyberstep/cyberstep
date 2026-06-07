import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation, useParams } from "wouter";
import { Info, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface Question {
  id: number;
  number: number;
  domain: string;
  areaLabel: string;
  text: string;
  helpText: string | null;
  weight: number;
  isRedAlarm: boolean;
}

const ANSWER_OPTIONS = [
  { value: "evet", label: "Evet", color: "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" },
  { value: "kısmen", label: "Kısmen", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" },
  { value: "hayır", label: "Hayır", color: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" },
  { value: "bilmiyorum", label: "Bilmiyorum", color: "border-slate-400 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400" },
];

export default function EuAiActSorularPage() {
  const { lang } = useLanguage();
  usePageMeta({ title: "EU AI Act Değerlendirme" });
  const params = useParams();
  const id = Number(params["id"]);
  const [, navigate] = useLocation();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/eu-aiact/questions")
      .then(r => r.json())
      .then(d => setQuestions(d.questions ?? []))
      .catch(() => setLoadError("Sorular yüklenemedi"));
  }, []);

  const q = questions[current];
  const progress = questions.length > 0 ? ((current) / questions.length) * 100 : 0;
  const answered = answers[q?.id ?? 0];

  async function handleNext() {
    if (!answered) return;
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setShowHelp(false);
      return;
    }
    // Submit
    setSubmitting(true);
    const answerList = questions.map(q => ({
      questionId: q.id,
      domain: q.domain,
      questionText: q.text,
      answer: answers[q.id] ?? "bilmiyorum",
    }));
    try {
      const r = await fetch(`/api/eu-aiact/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerList }),
      });
      if (!r.ok) throw new Error();
      navigate(`/eu-ai-act/rapor/${id}`);
    } catch {
      setSubmitting(false);
    }
  }

  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive">{loadError}</p>
    </div>
  );
  if (!questions.length) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Sorular yükleniyor...</p>
    </div>
  );

  const domainLabel = q.areaLabel || q.domain;
  const isLast = current === questions.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">AB AI Yasası Uyum Skoru</Badge>
            <span className="text-xs text-muted-foreground">{current + 1} / {questions.length}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Domain label */}
      <div className="bg-blue-950/20 border-b border-blue-500/10">
        <div className="container mx-auto px-4 py-2 max-w-2xl">
          <span className="text-xs font-medium text-blue-400">{domainLabel}</span>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-start gap-2">
            <p className="text-lg font-semibold leading-relaxed flex-1">{q.text}</p>
            {q.isRedAlarm && (
              <Badge variant="destructive" className="shrink-0 text-xs">Kritik</Badge>
            )}
          </div>
          {q.helpText && (
            <div className="mt-3">
              <button onClick={() => setShowHelp(v => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Info className="h-3.5 w-3.5" />
                {showHelp ? "Açıklamayı gizle" : "Açıklama göster"}
              </button>
              {showHelp && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground border border-border/50">
                  {q.helpText}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ANSWER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
              className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                answered === opt.value ? opt.color : "border-border hover:border-blue-400 bg-background"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleNext}
            disabled={!answered || submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          >
            {submitting ? "Gönderiliyor..." : isLast ? "Raporu Oluştur" : "Devam Et"}
            {!submitting && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
