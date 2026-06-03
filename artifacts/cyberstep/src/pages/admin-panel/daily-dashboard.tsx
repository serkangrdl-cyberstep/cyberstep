import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, Users, AlertTriangle, CreditCard, Mail,
  Share2, RefreshCw, Shield, Activity, Newspaper,
  Clock, CheckCircle, Play,
} from "lucide-react";

interface ActionItem {
  priority: number;
  icon: string;
  description: string;
  url: string;
  estimatedMinutes: number;
}

interface DailySummary {
  id: number;
  summaryDate: string;
  activeSubscriptions: number;
  mrrTrl: string;
  newCustomersToday: number;
  renewalsDue30Days: number;
  overduePayments: number;
  momMrrChange: string;
  domainsScannedLastNight: number;
  leadsQualified: number;
  emailsReadyToSend: number;
  emailsSentYesterday: number;
  highChurnRiskCount: number;
  mediumChurnRiskCount: number;
  cveAlertsLast24h: number;
  iocProcessedLast24h: number;
  socialPostsPendingApproval: number;
  socialPostsPublishedYesterday: number;
  newsletterSubscribers: number;
  actionItems: ActionItem[];
  generatedAt: string;
}

// Aksiyon icon eşleştirmesi
const ACTION_ICONS: Record<string, React.ElementType> = {
  mail: Mail,
  "alert-triangle": AlertTriangle,
  "credit-card": CreditCard,
  "share-2": Share2,
  "refresh-cw": RefreshCw,
};

function fmtTL(val: string | number): string {
  return new Intl.NumberFormat("tr-TR").format(Number(val));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Metrik kartı ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, sub, highlight, warn,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${
      warn ? "border-red-800 bg-red-950/20" :
      highlight ? "border-primary/40 bg-primary/5" :
      "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${warn ? "text-red-400" : "text-primary"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${warn ? "text-red-400" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Aksiyon satırı ───────────────────────────────────────────────────────────

function ActionRow({ item, index }: { item: ActionItem; index: number }) {
  const Icon = ACTION_ICONS[item.icon] ?? CheckCircle;
  const priorityColor =
    item.priority <= 2 ? "bg-red-500/20 text-red-400 border-red-500/30" :
    item.priority === 3 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
    "bg-primary/20 text-primary border-primary/30";

  return (
    <a
      href={item.url}
      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors group"
    >
      <span className="text-muted-foreground text-sm font-mono w-4 flex-shrink-0">{index + 1}</span>
      <Icon className={`h-4 w-4 flex-shrink-0 ${
        item.priority <= 2 ? "text-red-400" :
        item.priority === 3 ? "text-amber-400" : "text-primary"
      }`} />
      <span className="flex-1 text-sm text-foreground group-hover:text-primary transition-colors">
        {item.description}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Badge variant="outline" className={`text-[10px] border ${priorityColor}`}>
          P{item.priority}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {item.estimatedMinutes} dk
        </span>
      </div>
    </a>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function DailyDashboard() {
  const { data: summary, isLoading, refetch } = useQuery<DailySummary>({
    queryKey: ["admin-daily-summary"],
    queryFn: () => fetch("/api/admin/dashboard/summary").then(r => {
      if (!r.ok) throw new Error("summary_not_found");
      return r.json();
    }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => fetch("/api/admin/dashboard/generate", { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => refetch(), 3000),
  });

  const momChange = Number(summary?.momMrrChange ?? 0);
  const totalActionMins = summary?.actionItems.reduce((s, a) => s + a.estimatedMinutes, 0) ?? 0;

  return (
    <AdminLayout
      title="Günlük Yönetici Özeti"
      description="Tüm operasyonu tek bakışta — gelir, pipeline, platform, içerik, sağlık"
    >
      <div className="space-y-6 max-w-6xl">

        {/* Üst bar: tarih + üret butonu */}
        <div className="flex items-center justify-between">
          <div>
            {summary ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{fmtDate(summary.summaryDate)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {fmtTime(summary.generatedAt)} üretildi
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Henüz özet yok</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            <Play className="h-3.5 w-3.5" />
            {generateMutation.isPending ? "Oluşturuluyor..." : "Şimdi Üret"}
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
        )}

        {!isLoading && !summary && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              Henüz günlük özet oluşturulmamış. Her sabah 08:00'de otomatik oluşturulur.
            </p>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              İlk Özeti Üret
            </Button>
          </div>
        )}

        {summary && (
          <>
            {/* Bugünün aksiyon listesi */}
            {summary.actionItems.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-0.5 h-4 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">
                    Bugünün Aksiyonları
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    ~ {totalActionMins} dakika
                  </span>
                </div>
                <div className="space-y-2">
                  {summary.actionItems.map((item, i) => (
                    <ActionRow key={i} item={item} index={i} />
                  ))}
                </div>
              </section>
            )}

            <Separator />

            {/* Gelir metrikleri */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-0.5 h-4 bg-primary rounded-full" />
                <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Gelir</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  icon={TrendingUp}
                  label="MRR"
                  value={`${fmtTL(summary.mrrTrl)} TL`}
                  sub={`${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% geçen ay`}
                  highlight
                />
                <MetricCard
                  icon={Users}
                  label="Aktif Abonelik"
                  value={summary.activeSubscriptions}
                />
                <MetricCard
                  icon={Users}
                  label="Bugün Yeni"
                  value={summary.newCustomersToday}
                  highlight={summary.newCustomersToday > 0}
                />
                <MetricCard
                  icon={RefreshCw}
                  label="30 Gün Yenileme"
                  value={summary.renewalsDue30Days}
                  sub="yakında yenilenecek"
                />
                <MetricCard
                  icon={CreditCard}
                  label="Askıda Ödeme"
                  value={summary.overduePayments}
                  warn={summary.overduePayments > 0}
                />
                <MetricCard
                  icon={Newspaper}
                  label="Bülten Abone"
                  value={summary.newsletterSubscribers}
                />
              </div>
            </section>

            <Separator />

            {/* Pipeline & Sağlık */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Lead pipeline */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-0.5 h-4 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Lead Pipeline</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={Activity}
                    label="Gece Taranan"
                    value={summary.domainsScannedLastNight}
                    sub="domain"
                  />
                  <MetricCard
                    icon={CheckCircle}
                    label="Nitelendirilen"
                    value={summary.leadsQualified}
                    sub="lead"
                    highlight={summary.leadsQualified > 0}
                  />
                  <MetricCard
                    icon={Mail}
                    label="Gönderilmeye Hazır"
                    value={summary.emailsReadyToSend}
                    highlight={summary.emailsReadyToSend > 0}
                  />
                  <MetricCard
                    icon={Mail}
                    label="Dün Gönderilen"
                    value={summary.emailsSentYesterday}
                  />
                </div>
              </section>

              {/* Müşteri sağlığı */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-0.5 h-4 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Müşteri Sağlığı</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={AlertTriangle}
                    label="Kritik Risk"
                    value={summary.highChurnRiskCount}
                    warn={summary.highChurnRiskCount > 0}
                    sub="müdahale gerekiyor"
                  />
                  <MetricCard
                    icon={AlertTriangle}
                    label="Orta Risk"
                    value={summary.mediumChurnRiskCount}
                    warn={summary.mediumChurnRiskCount > 2}
                    sub="izlemede"
                  />
                </div>
                {(summary.highChurnRiskCount > 0 || summary.mediumChurnRiskCount > 0) && (
                  <div className="mt-3">
                    <a
                      href="/panel/saglik"
                      className="text-xs text-primary hover:underline"
                    >
                      Sağlık paneline git →
                    </a>
                  </div>
                )}
              </section>
            </div>

            <Separator />

            {/* Platform & İçerik */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Platform olayları */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-0.5 h-4 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Platform (Son 24 Saat)</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={Shield}
                    label="CVE Uyarısı"
                    value={summary.cveAlertsLast24h}
                    warn={summary.cveAlertsLast24h > 0}
                  />
                  <MetricCard
                    icon={Activity}
                    label="IOC İşlenen"
                    value={summary.iocProcessedLast24h}
                  />
                </div>
              </section>

              {/* İçerik */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-0.5 h-4 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">İçerik</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={Share2}
                    label="Onay Bekleyen Post"
                    value={summary.socialPostsPendingApproval}
                    highlight={summary.socialPostsPendingApproval > 0}
                  />
                  <MetricCard
                    icon={Share2}
                    label="Dün Yayınlanan"
                    value={summary.socialPostsPublishedYesterday}
                  />
                </div>
              </section>
            </div>

            {/* Üretim zamanı */}
            <div className="text-center text-xs text-muted-foreground pt-2">
              Sonraki otomatik üretim: her sabah 08:00 (Istanbul)
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
