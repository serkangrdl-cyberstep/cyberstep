import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetAssessment, useSubmitAnswers, useCompleteAssessment } from "@workspace/api-client-react";
import { MINI_ASSESSMENT_SECTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

type AnswerType = "evet" | "kismen" | "bilmiyorum" | "hayir";

export default function AssessmentRunner() {
  const [, params] = useRoute("/assessment/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { lang } = useLanguage();

  const ANSWER_OPTIONS: { value: AnswerType; label: string; sublabel: string; activeClass: string; hoverClass: string }[] = [
    { value: "evet",       label: lang === "en" ? "Yes"      : "Evet",       sublabel: lang === "en" ? "Fully implemented"    : "Tam anlamıyla uygulanıyor",  activeClass: "border-green-500 bg-green-50 text-green-700",   hoverClass: "hover:bg-green-50 hover:text-green-700 hover:border-green-300" },
    { value: "kismen",     label: lang === "en" ? "Partially": "Kısmen",     sublabel: lang === "en" ? "Partially implemented" : "Kısmen uygulanıyor",         activeClass: "border-yellow-500 bg-yellow-50 text-yellow-700", hoverClass: "hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300" },
    { value: "hayir",      label: lang === "en" ? "No"       : "Hayır",      sublabel: lang === "en" ? "Not implemented yet"  : "Henüz uygulanmıyor",         activeClass: "border-red-500 bg-red-50 text-red-700",          hoverClass: "hover:bg-red-50 hover:text-red-700 hover:border-red-300" },
    { value: "bilmiyorum", label: lang === "en" ? "Don't know": "Bilmiyorum",sublabel: lang === "en" ? "No information on this": "Bu konuda bilgim yok",       activeClass: "border-orange-500 bg-orange-50 text-orange-700", hoverClass: "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300" },
  ];

  const { data: assessment, isLoading } = useGetAssessment(id, {
    query: { queryKey: ["assessment", id], enabled: !!id }
  });

  const submitAnswers = useSubmitAnswers();
  const completeAssessment = useCompleteAssessment();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerType>>({});
  const [animating, setAnimating] = useState(false);

  const section = MINI_ASSESSMENT_SECTIONS[currentSectionIndex];
  const isLastSection = currentSectionIndex === MINI_ASSESSMENT_SECTIONS.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  const totalQuestions = useMemo(() =>
    MINI_ASSESSMENT_SECTIONS.reduce((acc, sec) => acc + sec.questions.length, 0),
  []);

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  const sectionAnsweredCount = section.questions.filter(q => answers[q.id] !== undefined).length;
  const sectionComplete = sectionAnsweredCount === section.questions.length;

  const remainingQuestions = totalQuestions - answeredCount;
  const estimatedMinutes = Math.ceil(remainingQuestions * 0.2);

  const handleAnswer = (questionId: number, answer: AnswerType) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const switchSection = (dir: "next" | "prev") => {
    setAnimating(true);
    setTimeout(() => {
      if (dir === "next") setCurrentSectionIndex(prev => prev + 1);
      else setCurrentSectionIndex(prev => prev - 1);
      setAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  };

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      toast({
        title: lang === "en" ? "Missing Answers" : "Eksik Cevaplar",
        description: lang === "en" ? "Please answer all questions." : "Lütfen tüm soruları cevaplayınız.",
        variant: "destructive",
      });
      return;
    }

    try {
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionNumber: parseInt(qId, 10),
        answer: ans,
      }));

      await submitAnswers.mutateAsync({ id, data: { answers: formattedAnswers as any } });
      await completeAssessment.mutateAsync({ id });
      setLocation(`/assessment/${id}/report`);
    } catch {
      toast({
        title: lang === "en" ? "Error" : "Hata",
        description: lang === "en" ? "An error occurred while saving results." : "Sonuçlar kaydedilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-4">
          {lang === "en" ? "Cybersecurity Analysis" : "Siber Güvenlik Analizi"}: {assessment.companyName}
        </h1>

        <div className="flex flex-wrap gap-2 mb-4">
          {MINI_ASSESSMENT_SECTIONS.map((sec, idx) => {
            const secAnswered = sec.questions.filter(q => answers[q.id] !== undefined).length;
            const secDone = secAnswered === sec.questions.length;
            const isCurrent = idx === currentSectionIndex;
            return (
              <button
                key={sec.id}
                onClick={() => setCurrentSectionIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary"
                    : secDone
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {secDone && !isCurrent && <CheckCircle2 className="h-3 w-3" />}
                <span>{sec.id}. {sec.title}</span>
                <span className={`ml-1 ${isCurrent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {secAnswered}/{sec.questions.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-1">
          <Progress value={progress} className="h-3 flex-1" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {answeredCount} / {totalQuestions}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% {lang === "en" ? "completed" : "tamamlandı"}</span>
          {remainingQuestions > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lang === "en"
                ? `Approx. ~${estimatedMinutes} min remaining`
                : `Tahminen ~${estimatedMinutes} dakika kaldı`}
            </span>
          )}
        </div>
      </div>

      <div className={`transition-opacity duration-200 ${animating ? "opacity-0" : "opacity-100"}`}>
        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {section.id}
              </span>
              {section.title}
              {sectionComplete && (
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {lang === "en" ? "Completed" : "Tamamlandı"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {lang === "en"
                ? "Answer the questions in this section to best reflect your company's current situation."
                : "Bu bölümdeki soruları şirketinizin mevcut durumuna en uygun şekilde yanıtlayın."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y">
              {section.questions.map((q) => {
                const answered = answers[q.id];
                return (
                  <div
                    key={q.id}
                    className={`p-6 transition-colors ${answered ? "bg-muted/5" : "hover:bg-muted/10"}`}
                  >
                    <div className="mb-4">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-muted-foreground mt-0.5 shrink-0">{q.id}.</span>
                        <div className="flex-1">
                          <div className="flex items-start gap-2 flex-wrap">
                            <h3 className="text-base font-medium leading-snug flex-1">{q.text}</h3>
                            {q.weight === 3 && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium shrink-0 mt-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                {lang === "en" ? "Critical control" : "Kritik kontrol"}
                              </span>
                            )}
                          </div>
                          {q.helpText && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-2 border-gray-300">
                              <p className="text-sm text-gray-600 leading-relaxed">
                                {q.helpText}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-6">
                      {ANSWER_OPTIONS.map((opt) => {
                        const isSelected = answered === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleAnswer(q.id, opt.value)}
                            className={`flex flex-col items-center justify-center rounded-lg border-2 px-3 py-3 text-sm font-medium transition-all cursor-pointer gap-0.5 ${
                              isSelected ? opt.activeClass : `border-muted bg-popover text-foreground ${opt.hoverClass}`
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mb-0.5" />}
                            <span>{opt.label}</span>
                            <span className="text-xs font-normal opacity-60 hidden md:block">{opt.sublabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {answered === "bilmiyorum" && (
                      <p className="text-xs text-amber-600 mt-2 ml-6">
                        {lang === "en"
                          ? '"Don\'t know" has the same effect as "No" in the security assessment.'
                          : '"Bilmiyorum" yanıtı, güvenlik değerlendirmesinde "Hayır" ile aynı etkiye sahiptir.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between p-6 bg-muted/20 border-t">
            <Button variant="outline" onClick={() => switchSection("prev")} disabled={isFirstSection}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {lang === "en" ? "Previous Section" : "Önceki Bölüm"}
            </Button>

            {isLastSection ? (
              <Button
                onClick={handleSubmit}
                disabled={submitAnswers.isPending || completeAssessment.isPending || answeredCount < totalQuestions}
                className="bg-primary hover:bg-primary/90"
              >
                {(submitAnswers.isPending || completeAssessment.isPending) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {lang === "en" ? "Complete & Submit" : "Tamamla ve Gönder"}
                {answeredCount < totalQuestions && (
                  <span className="ml-2 text-xs opacity-70">({totalQuestions - answeredCount} {lang === "en" ? "missing" : "eksik"})</span>
                )}
              </Button>
            ) : (
              <Button onClick={() => switchSection("next")}>
                {lang === "en" ? "Next Section" : "Sonraki Bölüm"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
