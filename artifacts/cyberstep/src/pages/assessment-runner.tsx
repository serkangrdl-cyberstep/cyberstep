import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetAssessment, useSubmitAnswers, useCompleteAssessment } from "@workspace/api-client-react";
import { MINI_ASSESSMENT_SECTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AnswerType = "evet" | "kismen" | "bilmiyorum" | "hayir";

export default function AssessmentRunner() {
  const [, params] = useRoute("/assessment/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: assessment, isLoading } = useGetAssessment(id, { 
    query: { enabled: !!id } 
  });

  const submitAnswers = useSubmitAnswers();
  const completeAssessment = useCompleteAssessment();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerType>>({});

  const section = MINI_ASSESSMENT_SECTIONS[currentSectionIndex];
  
  const isLastSection = currentSectionIndex === MINI_ASSESSMENT_SECTIONS.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  const totalQuestions = useMemo(() => {
    return MINI_ASSESSMENT_SECTIONS.reduce((acc, sec) => acc + sec.questions.length, 0);
  }, []);

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  const handleAnswer = (questionId: number, answer: AnswerType) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (!isLastSection) {
      setCurrentSectionIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (!isFirstSection) {
      setCurrentSectionIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      toast({
        title: "Eksik Cevaplar",
        description: "Lütfen tüm soruları cevaplayınız.",
        variant: "destructive",
      });
      return;
    }

    try {
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionNumber: parseInt(qId, 10),
        answer: ans
      }));

      await submitAnswers.mutateAsync({
        id,
        data: { answers: formattedAnswers as any }
      });

      await completeAssessment.mutateAsync({ id });

      setLocation(`/assessment/${id}/report`);
    } catch (error) {
      toast({
        title: "Hata",
        description: "Sonuçlar kaydedilirken bir hata oluştu.",
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Siber Güvenlik Analizi: {assessment.companyName}</h1>
        <div className="flex items-center gap-4 mb-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground font-medium w-16 text-right">
            {answeredCount} / {totalQuestions}
          </span>
        </div>
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {section.id}
            </span>
            {section.title}
          </CardTitle>
          <CardDescription>Bu bölümdeki soruları şirketinizin mevcut durumuna en uygun şekilde yanıtlayın.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {section.questions.map((q, idx) => (
              <div key={q.id} className="p-6 transition-colors hover:bg-muted/10">
                <div className="mb-4">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-muted-foreground mt-0.5">{q.id}.</span>
                    <h3 className="text-lg font-medium leading-tight">
                      {q.text}
                    </h3>
                  </div>
                  {q.isCritical && (
                    <Badge variant="destructive" className="ml-6 mt-2">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Kritik
                    </Badge>
                  )}
                </div>
                
                <RadioGroup 
                  value={answers[q.id]} 
                  onValueChange={(val) => handleAnswer(q.id, val as AnswerType)}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-6"
                >
                  <div>
                    <RadioGroupItem value="evet" id={`q${q.id}-evet`} className="peer sr-only" />
                    <Label 
                      htmlFor={`q${q.id}-evet`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover px-3 py-3 hover:bg-green-50 hover:text-green-700 peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:bg-green-50 peer-data-[state=checked]:text-green-700 cursor-pointer transition-all"
                    >
                      Evet
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="kismen" id={`q${q.id}-kismen`} className="peer sr-only" />
                    <Label 
                      htmlFor={`q${q.id}-kismen`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover px-3 py-3 hover:bg-yellow-50 hover:text-yellow-700 peer-data-[state=checked]:border-yellow-500 peer-data-[state=checked]:bg-yellow-50 peer-data-[state=checked]:text-yellow-700 cursor-pointer transition-all"
                    >
                      Kısmen
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="hayir" id={`q${q.id}-hayir`} className="peer sr-only" />
                    <Label 
                      htmlFor={`q${q.id}-hayir`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover px-3 py-3 hover:bg-red-50 hover:text-red-700 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-50 peer-data-[state=checked]:text-red-700 cursor-pointer transition-all"
                    >
                      Hayır
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="bilmiyorum" id={`q${q.id}-bilmiyor`} className="peer sr-only" />
                    <Label 
                      htmlFor={`q${q.id}-bilmiyor`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover px-3 py-3 hover:bg-orange-50 hover:text-orange-700 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 peer-data-[state=checked]:text-orange-700 cursor-pointer transition-all"
                    >
                      Bilmiyorum
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between p-6 bg-muted/20 border-t">
          <Button 
            variant="outline" 
            onClick={handlePrev} 
            disabled={isFirstSection}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Önceki Bölüm
          </Button>
          
          {isLastSection ? (
            <Button 
              onClick={handleSubmit} 
              disabled={submitAnswers.isPending || completeAssessment.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {(submitAnswers.isPending || completeAssessment.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Tamamla ve Raporu Oluştur
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Sonraki Bölüm <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
