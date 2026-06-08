import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, Copy,
  ExternalLink, Loader2, ArrowRight, Shield, Wifi, Cloud,
  Globe, Database, Server, Settings, BookOpen, AlertTriangle,
  X, FlaskConical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

type Side = "customer" | "admin";
interface Step { key: string; label: string; side: Side; status: string; }
interface ServiceEntry {
  subscription: { id: number; serviceSlug: string; serviceLabel?: string };
  catalog: { slug: string; label: string; description?: string } | null;
  onboardingSteps: Step[];
  doneCustomerSteps: number;
  totalCustomerSteps: number;
  allDone: boolean;
  activatedAt: string | null;
  generatedUrls: Array<{ label: string; url: string }>;
  pageLink: string;
}
interface KurulumData {
  services: ServiceEntry[];
  totalCustomerSteps: number;
  doneCustomerSteps: number;
  overallProgress: number;
}

const GUIDE_SLUGS = new Set([
  "microsoft-365",
  "cve-izleme-pro",
  "pentest-lite-tek",
  "pentest-lite-5domain",
  "pentest-lite-yillik",
  "servicenow",
  "phishing-simulation",
]);

interface GuideStep {
  stepNo: number;
  title: string;
  description: string;
  estimatedSeconds?: number;
  warning?: string;
  tip?: string;
}
interface GuideTrouble { problem: string; solution: string; }
interface GuideData {
  title: string;
  estimatedMinutes?: number;
  difficulty?: string;
  prerequisites?: string[];
  steps: GuideStep[];
  troubleshooting?: GuideTrouble[];
  salesNote?: string;
}

const VERIFIABLE_STEPS = new Set([
  "notification_email_verified",
  "domains_entered",
  "domains_added",
  "webhook_url_configured",
  "configure",
  "azure_ad_oauth_completed",
]);

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "fortinet-fabric": Shield, "soc-operasyon": Shield, "noc": Wifi,
  "ms365": Cloud, "microsoft-365": Cloud, "dns-izleme": Globe,
  "ct-log-izleme": Globe, "kvkk-bildirim": Database,
  "servicenow": Server, "servicenow-entegrasyon": Server, "observability": Server,
};

function CopyField({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  const isUrl = value.startsWith("http");
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <code className="text-xs text-slate-800 dark:text-slate-200 break-all">{value}</code>
      </div>
      <div className="flex gap-1 shrink-0">
        {isUrl && (
          <button onClick={() => window.open(value, "_blank")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Kopyalandı" }); }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ServiceCard({ entry }: { entry: ServiceEntry }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);
  const slug = entry.subscription.serviceSlug;
  const hasGuide = GUIDE_SLUGS.has(slug);

  const verifyMutation = useMutation({
    mutationFn: async ({ stepKey }: { stepKey: string }) => {
      const res = await fetch("/api/customer/onboarding/verify-step", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSlug: slug, stepKey }),
      });
      return res.json() as Promise<{ verified: boolean; message: string; error?: string }>;
    },
    onMutate: ({ stepKey }) => setVerifyingKey(stepKey),
    onSettled: () => setVerifyingKey(null),
    onSuccess: (data) => {
      if (data.verified) {
        toast({ title: "Adım doğrulandı", description: data.message });
        qc.invalidateQueries({ queryKey: ["/api/customer/kurulum-durumu"] });
        qc.invalidateQueries({ queryKey: ["kurulum-durumu"] });
      } else {
        toast({ title: "Doğrulanamadı", description: data.message, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Hata", description: "Doğrulama başarısız", variant: "destructive" }),
  });

  const { data: guideData, isLoading: guideLoading } = useQuery<GuideData>({
    queryKey: [`/api/portal/integrations/${slug}/guide`],
    queryFn: () => fetch(`/api/portal/integrations/${slug}/guide`, { credentials: "include" }).then(r => {
      if (!r.ok) throw new Error("Guide yüklenemedi");
      return r.json();
    }),
    enabled: showGuide && hasGuide,
    staleTime: Infinity,
  });

  const label = entry.catalog?.label ?? entry.subscription.serviceLabel ?? slug;
  const Icon = SERVICE_ICONS[slug] ?? Settings;
  const customerSteps = entry.onboardingSteps.filter(s => s.side === "customer");
  const adminSteps = entry.onboardingSteps.filter(s => s.side === "admin");
  const done = entry.doneCustomerSteps;
  const total = entry.totalCustomerSteps;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const customerAllDone = done === total && total > 0;
  const fullyActive = entry.allDone;

  return (
    <Card className={`border transition-colors ${fullyActive ? "border-emerald-300 dark:border-emerald-700/60" : customerAllDone ? "border-emerald-200 dark:border-emerald-800/40" : "border-slate-200 dark:border-slate-700"}`}>
      <button className="w-full text-left" onClick={() => setOpen(p => !p)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${fullyActive ? "bg-emerald-100 dark:bg-emerald-900/40" : customerAllDone ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-100 dark:bg-slate-800"}`}>
              <Icon className={`h-5 w-5 ${fullyActive || customerAllDone ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base text-slate-900 dark:text-white">{label}</CardTitle>
              {total > 0 && !fullyActive && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Progress value={pct} className="h-1.5 flex-1 max-w-[120px]" />
                  <span className="text-xs text-slate-500">{done}/{total} adım</span>
                </div>
              )}
              {fullyActive && entry.activatedAt && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  {new Date(entry.activatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde aktive edildi
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {fullyActive ? (
                <Badge className="bg-emerald-500 text-white border-0 text-xs font-semibold">Aktif</Badge>
              ) : customerAllDone ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">Tamamlandı</Badge>
              ) : pct > 0 ? (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">Devam Ediyor</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 text-xs">Bekliyor</Badge>
              )}
              {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 border-t border-slate-100 dark:border-slate-800 space-y-5">

          {/* Generated URLs */}
          {(entry.generatedUrls ?? []).length > 0 && (
            <div className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sisteminize Ekleyeceginiz Bilgiler</p>
              {(entry.generatedUrls ?? []).map(u => (
                <CopyField key={u.label} label={u.label} value={u.url} />
              ))}
            </div>
          )}

          {/* Inline guide accordion */}
          {hasGuide && !fullyActive && (
            <div className="pt-2">
              <button
                onClick={() => setShowGuide(p => !p)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Adım Adım Kurulum Rehberi
                {showGuide ? <X className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
              </button>

              {showGuide && (
                <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {guideLoading ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  ) : guideData ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Guide header */}
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{guideData.title}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {guideData.estimatedMinutes && (
                            <span className="text-xs text-slate-500">Tahmini süre: {guideData.estimatedMinutes} dakika</span>
                          )}
                          {guideData.difficulty && (
                            <span className="text-xs text-slate-500">{guideData.difficulty}</span>
                          )}
                        </div>
                        {(guideData.prerequisites ?? []).length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Gereksinimler:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {guideData.prerequisites!.map((p, i) => (
                                <li key={i} className="text-xs text-slate-600 dark:text-slate-400">{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Steps */}
                      {guideData.steps.map(step => (
                        <div key={step.stepNo} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {step.stepNo}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{step.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
                              {step.warning && (
                                <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                  <p className="text-xs text-amber-700 dark:text-amber-400">{step.warning}</p>
                                </div>
                              )}
                              {step.tip && (
                                <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 border border-blue-200 dark:border-blue-800">
                                  <BookOpen className="h-3 w-3 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                  <p className="text-xs text-blue-700 dark:text-blue-400">{step.tip}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Troubleshooting */}
                      {(guideData.troubleshooting ?? []).length > 0 && (
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Sorun Giderme</p>
                          <div className="space-y-2">
                            {guideData.troubleshooting!.map((t, i) => (
                              <div key={i}>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.problem}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.solution}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sales note */}
                      {guideData.salesNote && (
                        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900/30">
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">{guideData.salesNote}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-slate-500">Rehber yüklenemedi. Lütfen tekrar deneyin.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customer steps */}
          {customerSteps.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapmanız Gerekenler</p>
              {customerSteps.map(step => (
                <div key={step.key} className="flex items-center gap-2">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${step.status === "done" ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"}`}>
                    {step.label}
                  </span>
                  {step.status !== "done" && VERIFIABLE_STEPS.has(step.key) && (
                    <button
                      onClick={() => verifyMutation.mutate({ stepKey: step.key })}
                      disabled={verifyingKey === step.key}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded transition-colors disabled:opacity-50 shrink-0"
                    >
                      {verifyingKey === step.key
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <FlaskConical className="h-2.5 w-2.5" />}
                      Test Et
                    </button>
                  )}
                </div>
              ))}
              <Button size="sm" variant={fullyActive ? "default" : "outline"} className={`mt-2 h-8 text-xs ${fullyActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => navigate(entry.pageLink)}>
                {fullyActive ? "Servise Git" : "Ayar Sayfasına Git"} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Admin steps */}
          {adminSteps.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CyberStep Ekibinin Yapacakları</p>
              {adminSteps.map(step => (
                <div key={step.key} className="flex items-center gap-2">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={`text-sm ${step.status === "done" ? "text-slate-400 line-through" : "text-slate-500"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function KurulumMerkezi() {
  useRequireCustomer();
  const { data, isLoading } = useQuery<KurulumData>({
    queryKey: ["/api/customer/kurulum-durumu"],
    queryFn: () => fetch("/api/customer/kurulum-durumu", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const services = data?.services ?? [];
  const pct = data?.overallProgress ?? 0;
  const done = data?.doneCustomerSteps ?? 0;
  const total = data?.totalCustomerSteps ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kurulum Merkezi</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Aktif servislerinizin kurulum adımlarini takip edin.
          </p>
        </div>

        {/* Overall progress */}
        {total > 0 && (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Genel Kurulum Durumu</p>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">{done} / {total} müşteri adımı tamamlandı</p>
            </CardContent>
          </Card>
        )}

        {/* No services */}
        {services.length === 0 && (
          <Card className="border-dashed border-slate-200 dark:border-slate-700">
            <CardContent className="p-10 text-center">
              <Settings className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">Henüz aktif servis yok</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                Servis abonelikleriniz aktifleştirildikten sonra kurulum adımları burada görünür.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Service cards */}
        {services.map(entry => (
          <ServiceCard key={entry.subscription.id} entry={entry} />
        ))}

        {/* All done banner */}
        {services.length > 0 && pct === 100 && (
          <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10">
            <CardContent className="p-5 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">Tüm kurulum adımları tamamlandı</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Sistemleriniz aktif olarak izleniyor. Sorularınız için destek ekibimize ulaşın.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
