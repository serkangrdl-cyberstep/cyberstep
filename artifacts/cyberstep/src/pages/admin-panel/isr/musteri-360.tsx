import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building2, Mail, Phone, TrendingUp, Users,
  CalendarCheck, StickyNote, Activity, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:                  { label: "Yeni",             color: "bg-blue-100 text-blue-700" },
  rfq_sent:             { label: "RFQ Gönderildi",   color: "bg-yellow-100 text-yellow-700" },
  quoted:               { label: "Teklif Hazır",     color: "bg-purple-100 text-purple-700" },
  revision_requested:   { label: "Revizyon",         color: "bg-orange-100 text-orange-700" },
  approved:             { label: "Onaylandı",         color: "bg-emerald-100 text-emerald-700" },
  sent:                 { label: "Gönderildi",        color: "bg-green-100 text-green-700" },
  won:                  { label: "Kazanildi",         color: "bg-green-200 text-green-800" },
  lost:                 { label: "Kaybedildi",        color: "bg-red-100 text-red-700" },
  cancelled:            { label: "Iptal",             color: "bg-slate-100 text-slate-600" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-100 text-slate-500",
  normal: "bg-blue-50 text-blue-600",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük", normal: "Normal", high: "Yüksek", urgent: "Acil",
};

const ACTIVITY_TYPE_ICONS: Record<string, React.ReactNode> = {
  note:    <StickyNote className="h-3.5 w-3.5 text-slate-400" />,
  call:    <Phone className="h-3.5 w-3.5 text-blue-400" />,
  meeting: <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" />,
  email:   <Mail className="h-3.5 w-3.5 text-orange-400" />,
};

interface Customer360 {
  customer: {
    id: number;
    companyName: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    sector?: string | null;
    notes?: string | null;
    aiProfile?: string | null;
    createdAt: string;
  };
  deals: Array<{
    id: number;
    status: string;
    priority: string;
    vendorName?: string | null;
    productKeywords?: string | null;
    aiSummary?: string | null;
    createdAt: string;
  }>;
  activities: Array<{
    id: number;
    type: string;
    title: string;
    description?: string | null;
    isCompleted: boolean;
    createdAt: string;
    dealId?: number | null;
  }>;
  stats: {
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number;
    totalActivities: number;
  };
}

export default function AdminIsrMusteri360() {
  const { id } = useParams<{ id: string }>();
  const customerId = parseInt(id);
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<Customer360>({
    queryKey: ["isr-customer-360", customerId],
    queryFn: () =>
      fetch(`/api/admin-panel/isr/customers/${customerId}/360`, { credentials: "include" })
        .then(r => r.json()),
    enabled: !isNaN(customerId),
  });

  if (isLoading) {
    return (
      <AdminLayout title="Musteri 360">
        <div className="text-center py-16 text-slate-400 text-sm">Yukleniyor...</div>
      </AdminLayout>
    );
  }

  const { customer, deals, activities, stats } = data ?? {
    customer: null, deals: [], activities: [], stats: null,
  };

  if (!customer) {
    return (
      <AdminLayout title="Musteri 360">
        <div className="text-center py-16 text-slate-400 text-sm">Musteri bulunamadi.</div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: "Toplam Deal",    value: stats?.totalDeals ?? 0,   color: "text-blue-700",    bg: "bg-blue-50" },
    { label: "Açık",           value: stats?.openDeals ?? 0,    color: "text-yellow-700",  bg: "bg-yellow-50" },
    { label: "Kazanıldı",      value: stats?.wonDeals ?? 0,     color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Kaybedildi",     value: stats?.lostDeals ?? 0,    color: "text-red-700",     bg: "bg-red-50" },
    { label: "Kazanma Oranı",  value: `%${stats?.winRate ?? 0}`, color: "text-violet-700",  bg: "bg-violet-50" },
    { label: "Aktivite",       value: stats?.totalActivities ?? 0, color: "text-slate-700", bg: "bg-slate-100" },
  ];

  return (
    <AdminLayout title={customer.companyName}>
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate("/panel/isr/musteriler")}
            className="text-slate-500 hover:text-slate-700 -mt-1"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Musteri Rehberi
          </Button>
        </div>

        {/* Customer info card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{customer.companyName}</h1>
                  {customer.sector && (
                    <Badge variant="outline" className="text-xs">{customer.sector}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                  {customer.contactName && (
                    <span className="text-sm text-slate-600 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> {customer.contactName}
                    </span>
                  )}
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <span className="text-sm text-slate-600 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {customer.phone}
                    </span>
                  )}
                  <span className="text-sm text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Müşteri since {format(new Date(customer.createdAt), "MMMM yyyy", { locale: tr })}
                  </span>
                </div>
                {customer.aiProfile && (
                  <p className="text-sm text-slate-500 italic mt-2 border-l-2 border-emerald-300 pl-3">
                    {customer.aiProfile}
                  </p>
                )}
                {customer.notes && (
                  <p className="text-sm text-slate-500 mt-1.5">{customer.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {statCards.map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Deals section */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Deal Geçmişi
              <span className="font-normal text-slate-400">({deals.length})</span>
            </h2>

            {deals.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-slate-400 text-sm">
                  Bu müşteriyle ilişkili deal yok.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => {
                  const sl = STATUS_LABELS[deal.status] ?? { label: deal.status, color: "bg-slate-100 text-slate-600" };
                  return (
                    <Card
                      key={deal.id}
                      className="hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => navigate(`/panel/isr/deal/${deal.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge className={`text-xs border-0 ${sl.color}`}>{sl.label}</Badge>
                              <Badge className={`text-xs border-0 ${PRIORITY_COLORS[deal.priority] ?? ""}`}>
                                {PRIORITY_LABELS[deal.priority] ?? deal.priority}
                              </Badge>
                              {deal.vendorName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {deal.vendorName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {deal.aiSummary ?? deal.productKeywords ?? "—"}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {format(new Date(deal.createdAt), "d MMMM yyyy", { locale: tr })}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
              Aktiviteler
              <span className="font-normal text-slate-400">({activities.length})</span>
            </h2>

            {activities.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-slate-400 text-sm">
                  Henüz aktivite yok.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-4">
                  {activities.map(a => (
                    <div key={a.id} className={`flex gap-2.5 ${a.isCompleted ? "opacity-60" : ""}`}>
                      <div className="mt-0.5 shrink-0">
                        {ACTIVITY_TYPE_ICONS[a.type] ?? <StickyNote className="h-3.5 w-3.5 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium text-slate-800 ${a.isCompleted ? "line-through" : ""}`}>
                          {a.title}
                        </div>
                        {a.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          {format(new Date(a.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                          {a.dealId && (
                            <button
                              onClick={() => navigate(`/panel/isr/deal/${a.dealId}`)}
                              className="text-blue-500 hover:underline"
                            >
                              Deal #{a.dealId}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
