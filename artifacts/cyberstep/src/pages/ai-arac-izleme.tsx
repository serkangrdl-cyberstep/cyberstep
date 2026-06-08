import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useServicePrices, formatPrice } from "@/hooks/use-service-prices";
import { Bell, ChevronRight, Eye, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/contexts/language-context";

interface MonSub { id: number; status: string; monitoredToolIds: number[]; nextBillingDate: string | null; alertOnCritical: boolean; alertOnImportant: boolean; }
interface AITool { id: number; toolName: string; provider: string; category: string; riskLevel: string; riskSummary: string; trainsOnUserData: boolean; kvkkCompatible: boolean; dataRetentionDays: number | null; }
interface Alert { id: number; title: string; summary: string; severity: string; createdAt: string; }
interface DashData { subscription: MonSub; tools: (AITool & { hasChange: boolean; latestSnapshot: { isChanged: boolean; changeSummary: string; changeSeverity: string; } | null })[]; recentAlerts: Alert[]; changesThisWeek: number; criticalCount: number; }

function useCustomer() {
  return useQuery({ queryKey: ["me"], queryFn: () => fetch("/api/customers/me").then(r => r.ok ? r.json() : null), retry: false, staleTime: 60_000 });
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  important: "bg-amber-100 text-amber-700 border-amber-200",
  minor: "bg-blue-100 text-blue-700 border-blue-200",
};
const SEVERITY_LABEL: Record<string, string> = { critical: "Kritik", important: "Onemli", minor: "Bilgi" };
const RISK_STYLE: Record<string, string> = {
  KRITIK: "bg-red-100 text-red-700",
  YUKSEK: "bg-orange-100 text-orange-700",
  ORTA: "bg-amber-100 text-amber-700",
  DUSUK: "bg-green-100 text-green-700",
  IYI: "bg-emerald-100 text-emerald-700",
};

function LandingView() {
  const { lang } = useLanguage();
  const { data: prices } = useServicePrices();
  const p = prices?.["ai-arac-izleme"];
  const priceLabel = p
    ? `${formatPrice(p.amount, p.unit, "Ücretsiz", lang)} ${lang === "en" ? "+ VAT" : "+ KDV"}`
    : lang === "en" ? "490 TL / mo + VAT" : "490 TL / ay + KDV";
  const steps = lang === "en"
    ? [
        { step: "1", title: "Select Your Tools", desc: "Choose the tools your employees use — ChatGPT, Gemini, Copilot and more." },
        { step: "2", title: "Weekly Scan", desc: "CyberStep checks the policy pages of 20+ AI tools every Sunday." },
        { step: "3", title: "Instant Alert", desc: "When a change is detected you receive an email alert and decide on action." },
      ]
    : [
        { step: "1", title: "Araçlarınızı Seçin", desc: "ChatGPT, Gemini, Copilot gibi çalışanlarınızın kullandığı araçları seçin." },
        { step: "2", title: "Haftalık Tarama", desc: "CyberStep her Pazar 20+ AI aracının politika sayfasını kontrol eder." },
        { step: "3", title: "Anında Bildirim", desc: "Değişiklik tespit edildiğinde e-posta ile uyarı alır, aksiyon kararı verirsiniz." },
      ];
  return (
    <>
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">{priceLabel}</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">{lang === "en" ? "AI Tool Monitoring" : "AI Araç İzleme"}</h1>
          <p className="text-xl text-white/80 mb-2">
            {lang === "en"
              ? "ChatGPT, Gemini, Copilot... Privacy policies keep changing."
              : "ChatGPT, Gemini, Copilot... Gizlilik politikaları sürekli değişiyor."}
          </p>
          <p className="text-lg text-primary font-semibold mb-8">
            {lang === "en"
              ? "CyberStep notifies you before you find out on your own."
              : "Değişikliği siz öğrenmeden önce CyberStep size bildiriyor."}
          </p>
          <Link href="/kayit" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors">
            {lang === "en" ? "Start Monitoring" : "İzlemeyi Başlat"} <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-10">{lang === "en" ? "How It Works" : "Nasıl Çalışır?"}</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {steps.map(s => (
              <div key={s.step} className="text-center p-6 rounded-xl border bg-card">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-3">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 text-center">
            <p className="text-3xl font-bold text-primary mb-1">
              490 TL / {lang === "en" ? "mo" : "ay"}{" "}
              <span className="text-sm font-normal text-muted-foreground">{lang === "en" ? "+ VAT" : "+ KDV"}</span>
            </p>
            <p className="text-muted-foreground mb-6">
              {lang === "en" ? "For all AI tools your team uses" : "Tüm kullandığınız AI araçları için"}
            </p>
            <Link href="/kayit" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              {lang === "en" ? "Get Started" : "Hemen Başla"} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function AddToolsModal({ allTools, currentIds, onSave, onClose }: {
  allTools: AITool[]; currentIds: number[]; onSave: (ids: number[]) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(currentIds));
  const toggle = (id: number) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl border max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">İzlenecek Araçları Seç</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allTools.map(t => (
            <label key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected.has(t.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="rounded" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{t.toolName}</p>
                <p className="text-xs text-muted-foreground">{t.provider}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${RISK_STYLE[t.riskLevel] ?? "bg-muted text-muted-foreground"}`}>{t.riskLevel}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Vazgec</button>
          <button onClick={() => { onSave([...selected]); onClose(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            {selected.size} Araç Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ customerId }: { customerId: number }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [showAddTools, setShowAddTools] = useState(false);

  const { data: dash, isLoading } = useQuery<DashData | null>({
    queryKey: ["ai-monitoring-dash", customerId],
    queryFn: () => fetch("/api/ai-monitoring/dashboard").then(r => r.json()),
    refetchInterval: 60_000,
  });
  const { data: allTools = [] } = useQuery<AITool[]>({ queryKey: ["ai-tools-all"], queryFn: () => fetch("/api/ai-tools").then(r => r.json()) });

  const subscribeMutation = useMutation({
    mutationFn: () => fetch("/api/ai-monitoring/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolIds: [] }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-monitoring-dash"] }),
  });
  const updateToolsMutation = useMutation({
    mutationFn: (ids: number[]) => fetch("/api/ai-monitoring/subscription", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolIds: ids }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-monitoring-dash"] }),
  });

  if (isLoading) return <div className="text-center py-16 text-muted-foreground">Yukluyor...</div>;

  if (!dash?.subscription) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Eye className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI Araç İzleme</h2>
        <p className="text-muted-foreground mb-8">Haftalık otomatik kontrol ile AI araçlarındaki politika değişikliklerinden anında haberdar olun.</p>
        <button onClick={() => subscribeMutation.mutate()} disabled={subscribeMutation.isPending}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {subscribeMutation.isPending ? (lang === "en" ? "Starting..." : "Başlatılıyor...") : lang === "en" ? "Start Monitoring — 490 TL/mo + VAT" : "İzlemeyi Başlat — 490 TL/ay + KDV"}
        </button>
      </div>
    );
  }

  const { subscription, tools, recentAlerts, changesThisWeek, criticalCount } = dash;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{lang === "en" ? "AI Tool Monitoring Dashboard" : "AI Araç İzleme Paneli"}</h1>
          <p className="text-sm text-muted-foreground">Abonelik aktif · {subscription.nextBillingDate ? `Sonraki fatura: ${new Date(subscription.nextBillingDate).toLocaleDateString("tr-TR")}` : ""}</p>
        </div>
        <button onClick={() => setShowAddTools(true)}
          className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary/10 transition-colors">
          <Plus className="h-4 w-4" /> Araç Ekle
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Bu Hafta Değişiklik", value: changesThisWeek, icon: Bell },
          { label: "Kritik Uyari", value: criticalCount, icon: AlertTriangle },
          { label: "İzlenen Araç", value: tools.length, icon: Eye },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.label.includes("Kritik") && criticalCount > 0 ? "text-red-500" : "text-primary"}`} />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent alerts */}
      {recentAlerts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Bu Hafta Uyarilar</h2>
          <div className="space-y-2">
            {recentAlerts.map(a => (
              <div key={a.id} className={`rounded-lg border p-4 ${SEVERITY_STYLE[a.severity] ?? "bg-muted"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{a.title}</span>
                      <span className="text-xs font-medium">{SEVERITY_LABEL[a.severity] ?? a.severity}</span>
                    </div>
                    <p className="text-sm">{a.summary}</p>
                    <p className="text-xs mt-1 opacity-70">{new Date(a.createdAt).toLocaleDateString("tr-TR")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool list */}
      <div>
        <h2 className="font-semibold mb-3">İzlenen Araçlar ({tools.length})</h2>
        <div className="rounded-xl border overflow-hidden">
          {tools.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-3">Henüz araç eklenmedi.</p>
              <button onClick={() => setShowAddTools(true)} className="text-primary underline text-sm">Araç ekle</button>
            </div>
          ) : tools.map((t, i) => (
            <div key={t.id} className={`flex items-center gap-4 p-4 ${i > 0 ? "border-t" : ""} ${t.hasChange ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
              {t.hasChange ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.toolName}</span>
                  {t.hasChange && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Degisti</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.provider}</p>
                {t.latestSnapshot?.changeSummary && <p className="text-xs text-muted-foreground mt-0.5">{t.latestSnapshot.changeSummary}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${RISK_STYLE[t.riskLevel] ?? "bg-muted text-muted-foreground"}`}>{t.riskLevel}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upsell to AI Policy */}
      <div className="mt-8 p-5 rounded-xl border-2 border-primary/30 bg-primary/5">
        <p className="font-semibold mb-1">Araç değişikliklerinde politikanız otomatik güncellensin mi?</p>
        <p className="text-sm text-muted-foreground mb-3">AI Politika Otogüncelleme servisiyle her büyük değişiklikte KVKK politikanız otomatik yeniden üretilir.</p>
        <Link href="/ai-politika" className="inline-flex items-center gap-1.5 text-primary text-sm font-medium hover:underline">
          {lang === "en" ? "AI Policy Service — 990 TL/yr + VAT" : "AI Politika Servisi — 990 TL/yıl + KDV"} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {showAddTools && (
        <AddToolsModal
          allTools={allTools}
          currentIds={subscription.monitoredToolIds ?? []}
          onSave={ids => updateToolsMutation.mutate(ids)}
          onClose={() => setShowAddTools(false)}
        />
      )}
    </div>
  );
}

export default function AiAracIzleme() {
  const { lang } = useLanguage();
  usePageMeta({ title: "AI Araç İzleme | CyberStep.io", description: "ChatGPT, Gemini, Copilot gizlilik politikası değişikliklerini haftalık takip edin. KVKK uyum bildirimleri." });
  const { data: customer, isLoading } = useCustomer();
  if (isLoading) return null;
  if (!customer?.id) return <LandingView />;
  return <DashboardView customerId={customer.id} />;
}
