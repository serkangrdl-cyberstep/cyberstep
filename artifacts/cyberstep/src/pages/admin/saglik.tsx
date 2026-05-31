import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, RefreshCw, Phone, Mail, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";

interface HealthOverview {
  healthy: number; atRisk: number; critical: number; churned: number; total: number;
}
interface AtRiskCustomer {
  customerId: number; healthScore: number; healthTier: string; churnProbability: string;
  churnRiskFactors: string[]; calculatedAt: string; lastLogin?: string;
  customer?: { fullName: string; email: string; subscriptionPlan?: string };
}
interface Intervention {
  id: number; customerId: number; interventionType: string; triggeredAt: string;
  healthScoreAtTrigger?: number; response?: string;
}

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  healthy:  { label: "Saglikli",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  at_risk:  { label: "Risk Altinda", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  critical: { label: "Kritik",     color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  churned:  { label: "Kayip Riski",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
};

const INTERVENTION_LABELS: Record<string, { label: string; icon: typeof Phone }> = {
  personal_call:      { label: "Kisisel Arama",    icon: Phone },
  whatsapp_nudge:     { label: "WhatsApp Nudge",   icon: MessageSquare },
  email_reengagement: { label: "E-posta Geri Kazan", icon: Mail },
  feature_highlight:  { label: "Ozellik Tanitim",  icon: Mail },
};

const RISK_FACTOR_LABELS: Record<string, string> = {
  "21_gun_giris_yok":      "21+ gun giris yok",
  "bulgular_kapatilmiyor": "Bulgular kapatilmiyor",
  "uyarilar_acilmiyor":    "Uyarilar acilmiyor",
  "risk_skoru_kotu_gidiyor": "Risk skoru kotu gidiyor",
};

function daysSince(dateStr?: string): string {
  if (!dateStr) return "Bilinmiyor";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
  if (days === 0) return "Bugun";
  if (days === 1) return "Dun";
  return `${days} gun once`;
}

export default function AdminSaglikPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "at-risk" | "interventions">("overview");

  const { data: overview } = useQuery<HealthOverview>({
    queryKey: ["admin-health-overview"],
    queryFn: () => adminFetchJson<HealthOverview>("/api/admin/health/overview"),
  });

  const { data: atRiskList = [] } = useQuery<AtRiskCustomer[]>({
    queryKey: ["admin-health-at-risk"],
    queryFn: () => adminFetchJson<AtRiskCustomer[]>("/api/admin/health/at-risk"),
    enabled: activeTab === "at-risk",
  });

  const { data: interventions = [] } = useQuery<Intervention[]>({
    queryKey: ["admin-health-interventions"],
    queryFn: () => adminFetchJson<Intervention[]>("/api/admin/health/interventions"),
    enabled: activeTab === "interventions",
  });

  const recalcMutation = useMutation({
    mutationFn: () => fetch("/api/admin/health/recalculate", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-health-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-health-at-risk"] });
      toast({ title: "Yeniden hesaplama basladi", description: "Tum musteri skorlari guncelleniyor" });
    },
  });

  return (
    <AdminLayout title="Musteri Saglik Skoru" description="Churn tahmini ve mudahale yonetimi">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending}
            variant="outline" className="border-slate-600 text-slate-300">
            <RefreshCw className={`h-4 w-4 mr-2 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
            Yeniden Hesapla
          </Button>
        </div>

        {/* Overview cards */}
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "healthy",  count: overview.healthy,  ...TIER_CONFIG["healthy"]! },
              { key: "at_risk",  count: overview.atRisk,   ...TIER_CONFIG["at_risk"]! },
              { key: "critical", count: overview.critical,  ...TIER_CONFIG["critical"]! },
              { key: "churned",  count: overview.churned,  ...TIER_CONFIG["churned"]! },
            ].map(s => (
              <Card key={s.key} className={`border ${s.bg}`}>
                <CardContent className="pt-4 pb-4">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Churn funnel summary */}
        {overview && overview.total > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <p className="text-sm text-white font-medium">Churn Riski Ozeti</p>
              </div>
              <div className="flex gap-2 items-center text-sm">
                <span className="text-slate-400">Toplam aktif musteri:</span>
                <span className="text-white font-semibold">{overview.total}</span>
                <span className="text-slate-600">|</span>
                <span className="text-red-400 font-semibold">{overview.critical + overview.churned}</span>
                <span className="text-slate-400">acil mudahale gerekiyor</span>
                <span className="text-slate-600">|</span>
                <span className="text-yellow-400 font-semibold">{overview.atRisk}</span>
                <span className="text-slate-400">izlemede</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
          {[
            { key: "overview" as const, label: "Genel" },
            { key: "at-risk" as const, label: `Risk Altindakiler (${overview ? overview.atRisk + overview.critical + overview.churned : "..."})` },
            { key: "interventions" as const, label: "Mudahaleler" },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === t.key ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-5">
              <p className="text-slate-400 text-sm">
                Saglik skoru hesaplamasi; giris sikligini (%%25), acik bulgu kapatmayi (%%30), domain tarama aktivitesini (%%20), uyari takibini (%%15) ve risk skoru trendini (%%10) degerlendirir.
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "70-100", desc: "Saglikli", color: "text-emerald-400" },
                  { label: "45-69", desc: "Risk Altinda", color: "text-yellow-400" },
                  { label: "20-44", desc: "Kritik", color: "text-orange-400" },
                  { label: "0-19", desc: "Kayip Riski", color: "text-red-400" },
                ].map(t => (
                  <div key={t.label} className="bg-slate-800 rounded-lg p-3 text-center border border-slate-700">
                    <p className={`text-lg font-bold ${t.color}`}>{t.label}</p>
                    <p className="text-xs text-slate-400">{t.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* At-risk tab */}
        {activeTab === "at-risk" && (
          <div className="space-y-3">
            {atRiskList.length === 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="pt-5">
                  <p className="text-slate-400 text-sm">Risk altinda musteri bulunamadi.</p>
                </CardContent>
              </Card>
            )}
            {atRiskList.map(c => {
              const tier = TIER_CONFIG[c.healthTier] ?? TIER_CONFIG["at_risk"]!;
              return (
                <Card key={c.customerId} className={`border ${tier.bg}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold text-sm ${tier.color}`}>{c.customer?.fullName ?? `Musteri #${c.customerId}`}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${tier.bg} ${tier.color}`}>{tier.label}</span>
                          {c.customer?.subscriptionPlan && (
                            <span className="text-xs text-slate-500">{c.customer.subscriptionPlan}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{c.customer?.email}</p>
                        <p className="text-xs text-slate-500 mt-1">Son giris: {daysSince(c.lastLogin)}</p>
                        {c.churnRiskFactors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.churnRiskFactors.map(f => (
                              <span key={f} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                {RISK_FACTOR_LABELS[f] ?? f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={`text-2xl font-bold ${tier.color}`}>{c.healthScore}</p>
                        <p className="text-xs text-slate-400">Saglik</p>
                        <p className="text-sm text-red-400 font-medium mt-1">%{Math.round(Number(c.churnProbability))}</p>
                        <p className="text-xs text-slate-500">Churn olas.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Interventions tab */}
        {activeTab === "interventions" && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-5">
              {interventions.length === 0 ? (
                <p className="text-slate-400 text-sm">Henuz mudahale tetiklenmedi.</p>
              ) : (
                <div className="space-y-3">
                  {interventions.map(inv => {
                    const cfg = INTERVENTION_LABELS[inv.interventionType];
                    const Icon = cfg?.icon ?? AlertTriangle;
                    return (
                      <div key={inv.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-300 text-sm">{cfg?.label ?? inv.interventionType}</p>
                          <p className="text-xs text-slate-500">
                            Musteri #{inv.customerId} — Skor: {inv.healthScoreAtTrigger ?? "?"} — {new Date(inv.triggeredAt).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${inv.response ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                          {inv.response ?? "Yanit yok"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
