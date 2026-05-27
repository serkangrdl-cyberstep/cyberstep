import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetAssessment, useSubmitAnswers, useCompleteAssessment } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { FULL_ASSESSMENT_SECTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, HelpCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AnswerType = "evet" | "kismen" | "bilmiyorum" | "hayir";

const ANSWER_OPTIONS: { value: AnswerType; label: string; activeClass: string; hoverClass: string }[] = [
  { value: "evet",       label: "Evet",       activeClass: "border-green-500 bg-green-50 text-green-700",   hoverClass: "hover:bg-green-50 hover:text-green-700 hover:border-green-300" },
  { value: "kismen",     label: "Kısmen",     activeClass: "border-yellow-500 bg-yellow-50 text-yellow-700", hoverClass: "hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300" },
  { value: "hayir",      label: "Hayır",      activeClass: "border-red-500 bg-red-50 text-red-700",         hoverClass: "hover:bg-red-50 hover:text-red-700 hover:border-red-300" },
  { value: "bilmiyorum", label: "Bilmiyorum", activeClass: "border-orange-500 bg-orange-50 text-orange-700", hoverClass: "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300" },
];

export default function FullAssessmentRunner() {
  const [, params] = useRoute("/assessment/full/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: assessment, isLoading } = useGetAssessment(id, {
    query: { queryKey: ["assessment", id], enabled: !!id }
  });

  const { data: paymentStatus, isLoading: paymentLoading } = useQuery<{ paid: boolean; status: string | null }>({
    queryKey: ["payment-status", id],
    queryFn: () => fetch(`/api/payments/status/${id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!paymentLoading && paymentStatus && !paymentStatus.paid) {
      setLocation(`/payment/${id}`);
    }
  }, [paymentLoading, paymentStatus, id, setLocation]);

  const submitAnswers = useSubmitAnswers();
  const completeAssessment = useCompleteAssessment();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerType>>({});
  const [animating, setAnimating] = useState(false);

  const section = FULL_ASSESSMENT_SECTIONS[currentSectionIndex];
  const isLastSection = currentSectionIndex === FULL_ASSESSMENT_SECTIONS.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  const totalQuestions = useMemo(() =>
    FULL_ASSESSMENT_SECTIONS.reduce((acc, sec) => acc + sec.questions.length, 0),
  []);

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;
  const sectionComplete = section.questions.every(q => answers[q.id] !== undefined);
  const remainingQuestions = totalQuestions - answeredCount;
  const estimatedMinutes = Math.ceil(remainingQuestions * 0.22);

  const handleAnswer = (questionId: number, answer: AnswerType) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const switchSection = (targetIndex: number) => {
    if (targetIndex === currentSectionIndex) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentSectionIndex(targetIndex);
      setAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 180);
  };

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      toast({ title: "Eksik Cevaplar", description: "Lütfen tüm soruları cevaplayınız.", variant: "destructive" });
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
      toast({ title: "Hata", description: "Sonuçlar kaydedilirken bir hata oluştu.", variant: "destructive" });
    }
  };

  if (isLoading || paymentLoading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!assessment || !paymentStatus?.paid) return null;

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Tam Değerlendirme</Badge>
            <span className="text-lg font-bold">{assessment.companyName}</span>
          </div>

          {/* Domain tabs — scrollable on mobile */}
          <div className="flex flex-wrap gap-2 mb-4">
            {FULL_ASSESSMENT_SECTIONS.map((sec, idx) => {
              const secAnswered = sec.questions.filter(q => answers[q.id] !== undefined).length;
              const secDone = secAnswered === sec.questions.length;
              const isCurrent = idx === currentSectionIndex;
              return (
                <button
                  key={sec.id}
                  onClick={() => switchSection(idx)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground border-primary"
                      : secDone
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {secDone && !isCurrent && <CheckCircle2 className="h-3 w-3" />}
                  <span>{sec.id}. {sec.title}</span>
                  <span className="opacity-60 ml-0.5">({secAnswered}/{sec.questions.length})</span>
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
            <span>{Math.round(progress)}% tamamlandı</span>
            {remainingQuestions > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Tahminen ~{estimatedMinutes} dakika kaldı
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
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Tamamlandı
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Bu bölümdeki soruları şirketinizin mevcut durumuna en uygun şekilde yanıtlayın.
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
                      <div className="mb-4 flex items-start gap-2">
                        <span className="font-semibold text-muted-foreground mt-0.5 shrink-0">{q.id}.</span>
                        <div className="flex-1">
                          <h3 className="text-base font-medium leading-snug">{q.text}</h3>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {q.isCritical && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Kritik
                              </Badge>
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
                              className={`flex items-center justify-center rounded-lg border-2 px-3 py-3 text-sm font-medium transition-all cursor-pointer ${
                                isSelected ? opt.activeClass : `border-muted bg-popover text-foreground ${opt.hoverClass}`
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="flex justify-between p-6 bg-muted/20 border-t">
              <Button variant="outline" onClick={() => switchSection(currentSectionIndex - 1)} disabled={isFirstSection}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Önceki Bölüm
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
                  Tamamla ve Gönder
                  {answeredCount < totalQuestions && (
                    <span className="ml-2 text-xs opacity-70">({totalQuestions - answeredCount} eksik)</span>
                  )}
                </Button>
              ) : (
                <Button onClick={() => switchSection(currentSectionIndex + 1)}>
                  Sonraki Bölüm <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
