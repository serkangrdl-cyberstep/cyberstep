import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Circle, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface OnboardingProgress {
  id: number;
  customerId: number;
  domainAdded: boolean;
  firstScanCompleted: boolean;
  firstReportViewed: boolean;
  emailNotificationsEnabled: boolean;
  profileCompleted: boolean;
  firstFindingAcknowledged: boolean;
  whatsappConnected: boolean;
  completionPct: number;
  completedAt: string | null;
}

const STEPS = [
  { key: "domainAdded",                label: "Domain eklendi",               href: "/raporlarim" },
  { key: "firstScanCompleted",         label: "İlk tarama yapıldı",           href: "/raporlarim" },
  { key: "firstReportViewed",          label: "Rapor görüntülendi",           href: "/raporlarim" },
  { key: "emailNotificationsEnabled",  label: "E-posta bildirimi açıldı",     href: "/entegrasyonlarim" },
  { key: "profileCompleted",           label: "Profil tamamlandı",            href: "/hesabim" },
  { key: "firstFindingAcknowledged",   label: "İlk bulgu incelendi",          href: "/raporlarim" },
  { key: "whatsappConnected",          label: "WhatsApp bağlandı",            href: "/entegrasyonlarim" },
];

const NEXT_STEP_LABELS: Record<string, string> = {
  domainAdded:               "Domain ekleyin",
  firstScanCompleted:        "İlk taramanızı başlatın",
  firstReportViewed:         "Raporunuzu görüntüleyin",
  emailNotificationsEnabled: "E-posta bildirimlerini açın",
  profileCompleted:          "Profilinizi tamamlayın",
  firstFindingAcknowledged:  "Bir bulgu inceleyin",
  whatsappConnected:         "WhatsApp'ı bağlayın",
};

export function OnboardingWidget() {
  const [dismissed, setDismissed] = useState(false);
  const qc = useQueryClient();

  const { data: progress, isLoading } = useQuery<OnboardingProgress>({
    queryKey: ["onboarding-progress"],
    queryFn: () => fetch("/api/portal/onboarding", { credentials: "include" }).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  const completeMutation = useMutation({
    mutationFn: (step: string) =>
      fetch("/api/portal/onboarding/step", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-progress"] }),
  });

  if (isLoading || !progress || dismissed) return null;
  if (progress.completionPct === 100) return null;

  const nextStep = STEPS.find(s => !progress[s.key as keyof OnboardingProgress]);
  const doneCount = STEPS.filter(s => progress[s.key as keyof OnboardingProgress]).length;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-white text-sm">Kurulumunuzu Tamamlayın</p>
            <p className="text-xs text-slate-400">{doneCount}/{STEPS.length} adım tamamlandı</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-primary font-bold text-sm">%{progress.completionPct}</span>
          <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress.completionPct}%` }}
        />
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STEPS.map(step => {
          const done = !!progress[step.key as keyof OnboardingProgress];
          return (
            <div key={step.key} className="flex items-center gap-2">
              {done
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                : <Circle className="h-4 w-4 text-slate-600 shrink-0" />
              }
              <span className={`text-xs ${done ? "text-slate-400 line-through" : "text-slate-300"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next step CTA */}
      {nextStep && (
        <Link
          href={nextStep.href}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 transition-colors border border-primary/20"
        >
          <span className="text-sm font-medium text-primary">
            Sonraki Adım: {NEXT_STEP_LABELS[nextStep.key]}
          </span>
          <ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      )}
    </div>
  );
}
