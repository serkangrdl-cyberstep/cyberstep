import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Shield, BarChart2, Brain, FileText } from "lucide-react";

const STEPS = [
  { icon: Shield,    label: "Cevaplar doğrulandı",           detail: "20 soruya verilen yanıtlar işlendi",           delay: 0 },
  { icon: BarChart2, label: "Risk skoru hesaplanıyor",        detail: "Ağırlıklı puanlama modeli çalıştırılıyor",      delay: 1800 },
  { icon: Brain,     label: "Yapay zeka analizi yapılıyor",   detail: "Yapay zeka güvenlik zafiyetlerini analiz ediyor",      delay: 4000 },
  { icon: FileText,  label: "Rapor hazırlanıyor",             detail: "Uzman değerlendirmesi kuyruğa alındı",         delay: 7000 },
];

export function ReportLoading() {
  const [activeStep, setActiveStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const timers = STEPS.map((step, idx) =>
      setTimeout(() => setActiveStep(idx), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const currentStep = STEPS[activeStep];

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center space-y-10">
        {/* Central spinner */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping scale-125" />
            <div className="relative h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <currentStep.icon className="h-10 w-10 text-primary animate-pulse" />
            </div>
          </div>
        </div>

        {/* Current step text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {currentStep.label}{dots}
          </h2>
          <p className="text-muted-foreground text-sm">{currentStep.detail}</p>
        </div>

        {/* Step list */}
        <div className="space-y-3 text-left">
          {STEPS.map((step, idx) => {
            const isDone    = idx < activeStep;
            const isActive  = idx === activeStep;
            const isPending = idx > activeStep;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-500 ${
                  isActive  ? "bg-primary/5 border-primary/30 shadow-sm" :
                  isDone    ? "bg-green-50/60 border-green-200/60" :
                  "bg-muted/30 border-transparent opacity-40"
                }`}
              >
                <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  isDone   ? "bg-green-100 text-green-600" :
                  isActive ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isPending ? "text-muted-foreground" : ""}`}>
                    {step.label}
                  </p>
                  {(isDone || isActive) && (
                    <p className="text-xs text-muted-foreground truncate">{step.detail}</p>
                  )}
                </div>
                {isDone && (
                  <span className="text-xs text-green-600 font-medium shrink-0">Tamamlandı</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Bu işlem otomatik ilerler, sayfayı kapatmayın.
        </p>
      </div>
    </div>
  );
}
