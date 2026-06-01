import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Shield, CheckCircle, Clock, XCircle, Package, ExternalLink,
  ArrowRight, AlertCircle, RefreshCw, ShoppingCart, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface CustomerServiceSub {
  id: number;
  serviceSlug: string;
  serviceLabel: string;
  status: string;
  billingCycle: string;
  amountPaid: string;
  startedAt: string;
  expiresAt: string | null;
  contactName: string;
  companyName: string;
  email: string;
}

interface CatalogService {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  serviceType: string | null;
  priceTl: string | null;
  priceTlAnnual: string | null;
  monthlyPriceTl: string;
  category: string;
  icon: string;
  isSelfService: boolean | null;
  isActive: boolean;
}

interface CustomerIntegration {
  provider: string;
  displayName: string;
  isActive: boolean;
  lastEventAt: string | null;
  eventCount: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  active: { label: "Aktif", variant: "default", icon: CheckCircle },
  pending: { label: "Beklemede", variant: "secondary", icon: Clock },
  expired: { label: "Süresi Doldu", variant: "outline", icon: XCircle },
  cancelled: { label: "İptal Edildi", variant: "destructive", icon: XCircle },
  suspended: { label: "Askıya Alındı", variant: "destructive", icon: AlertCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  assessment: "Değerlendirme",
  ai_service: "AI Servis",
  monitoring: "İzleme",
  soc: "SOC",
  consulting: "Danışmanlık",
  bundle: "Paket",
};

const INTEGRATION_LINKS: Record<string, string> = {
  fortinet: "/hesabim/fortinet-entegrasyonu",
  datadog: "/hesabim/entegrasyonlarim",
  azure: "/hesabim/entegrasyonlarim",
  slack: "/hesabim/entegrasyonlarim",
  telegram: "/hesabim/entegrasyonlarim",
};

const AVAILABLE_INTEGRATIONS = [
  { key: "fortinet", label: "FortiGate / Fortinet", path: "/hesabim/fortinet-entegrasyonu" },
  { key: "datadog", label: "Datadog", path: "/hesabim/entegrasyonlarim" },
  { key: "azure", label: "Azure Monitor", path: "/hesabim/entegrasyonlarim" },
  { key: "slack", label: "Slack", path: "/hesabim/entegrasyonlarim" },
  { key: "telegram", label: "Telegram", path: "/hesabim/entegrasyonlarim" },
];

export default function ServislerimPage() {
  const { data: customer, isLoading: authLoading } = useRequireCustomer();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<CustomerServiceSub[]>({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/customer/service-subscriptions");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customer,
  });

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<CatalogService[]>({
    queryKey: ["service-catalog-public"],
    queryFn: async () => {
      const res = await fetch("/api/public/service-catalog");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: integrations = [], isLoading: intLoading } = useQuery<CustomerIntegration[]>({
    queryKey: ["my-integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/list");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customer,
  });

  const cancelMutation = useMutation({
    mutationFn: async (subId: number) => {
      const res = await fetch(`/api/customer/service-subscriptions/${subId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("İptal başarısız");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
      toast({ title: "Servis iptal edildi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const activeSubs = subscriptions.filter(s => s.status === "active");
  const inactiveSubs = subscriptions.filter(s => s.status !== "active");

  const ownedSlugs = new Set(subscriptions.map(s => s.serviceSlug));
  const availableServices = catalog.filter(
    s => s.isActive && s.isSelfService && !ownedSlugs.has(s.slug) && Number(s.priceTl ?? s.monthlyPriceTl) > 0
  ).slice(0, 6);

  const connectedKeys = new Set(integrations.map(i => i.provider?.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Başlık */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-sky-400" />
            Servislerim
          </h1>
          <p className="text-slate-400 mt-1">Aktif servislerinizi, entegrasyonlarınızı ve kullanılabilir servisleri yönetin.</p>
        </div>

        {/* Aktif Servisler */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Aktif Servislerim
          </h2>

          {subsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
            </div>
          ) : activeSubs.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Henüz aktif bir servisiniz yok.</p>
                <Button
                  variant="outline"
                  className="mt-4 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                  onClick={() => navigate("/fiyatlandirma")}
                >
                  Servislere Göz At
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeSubs.map(sub => {
                const statusInfo = STATUS_MAP[sub.status] ?? STATUS_MAP["active"];
                const StatusIcon = statusInfo.icon;
                const expiresDate = sub.expiresAt ? new Date(sub.expiresAt) : null;

                return (
                  <Card key={sub.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{sub.serviceLabel}</span>
                            <Badge variant={statusInfo.variant} className="text-xs gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-400">
                              {sub.billingCycle === "annual" ? "Yıllık" : "Aylık"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>Baslangic: {new Date(sub.startedAt).toLocaleDateString("tr-TR")}</span>
                            {expiresDate && (
                              <span>Bitis: {expiresDate.toLocaleDateString("tr-TR")}</span>
                            )}
                            <span className="font-medium text-slate-300">
                              {Number(sub.amountPaid).toLocaleString("tr-TR")} TL
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sub.serviceSlug.includes("soc") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-sky-400 hover:text-sky-300 text-xs gap-1"
                              onClick={() => navigate("/hesabim/soc")}
                            >
                              <ExternalLink className="w-3 h-3" />
                              SOC
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-400 hover:text-rose-300 text-xs"
                            onClick={() => cancelMutation.mutate(sub.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Entegrasyonlarım */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" />
            Entegrasyonlarım
          </h2>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-4">
              <div className="divide-y divide-slate-800">
                {AVAILABLE_INTEGRATIONS.map(integ => {
                  const connected = connectedKeys.has(integ.key);
                  const live = integrations.find(i => i.provider?.toLowerCase() === integ.key);

                  return (
                    <div key={integ.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-slate-600"}`} />
                        <div>
                          <span className="text-sm font-medium text-slate-200">{integ.label}</span>
                          {connected && live?.lastEventAt && (
                            <p className="text-xs text-slate-500">
                              Son event: {new Date(live.lastEventAt).toLocaleString("tr-TR")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connected ? (
                          <Badge variant="outline" className="text-green-400 border-green-800 text-xs">Bagla</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-700 hover:border-sky-600 hover:text-sky-400 gap-1"
                            onClick={() => navigate(integ.path)}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Kur
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Kullanılabilir Servisler */}
        {availableServices.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              Kullanilabilir Servisler
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableServices.map(svc => {
                const price = svc.priceTl ? Number(svc.priceTl) : Number(svc.monthlyPriceTl);
                const isAnnual = svc.serviceType === "annual";
                const catLabel = CATEGORY_LABELS[svc.category] ?? svc.category;

                return (
                  <Card
                    key={svc.id}
                    className="bg-slate-900 border-slate-800 hover:border-sky-800/50 transition-all group cursor-pointer"
                    onClick={() => navigate(`/satin-al/${svc.slug}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">{catLabel}</Badge>
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-1 leading-snug">{svc.label}</h3>
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{svc.shortDescription}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sky-400 text-sm">
                            {price.toLocaleString("tr-TR")} TL
                          </span>
                          <span className="text-xs text-slate-500 ml-1">
                            {svc.serviceType === "one_time" ? "tek seferlik" :
                             svc.serviceType === "usage" ? "/kullanim" :
                             isAnnual ? "/yil" : "/ay"}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs bg-sky-600 hover:bg-sky-500 gap-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/satin-al/${svc.slug}`); }}
                        >
                          Satin Al
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="mt-3 text-center">
              <Button
                variant="ghost"
                className="text-slate-400 hover:text-sky-400 text-sm"
                onClick={() => navigate("/fiyatlandirma")}
              >
                Tum servisleri gor <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </section>
        )}

        {/* Geçmiş Servisler */}
        {inactiveSubs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-500 mb-4">Gecmis Servisler</h2>
            <div className="space-y-2">
              {inactiveSubs.map(sub => {
                const statusInfo = STATUS_MAP[sub.status] ?? STATUS_MAP["expired"];
                const StatusIcon = statusInfo.icon;
                return (
                  <Card key={sub.id} className="bg-slate-900/50 border-slate-800/50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{sub.serviceLabel}</span>
                          <Badge variant={statusInfo.variant} className="text-xs gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        {sub.status === "expired" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-700"
                            onClick={() => navigate(`/satin-al/${sub.serviceSlug}`)}
                          >
                            Yenile
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
