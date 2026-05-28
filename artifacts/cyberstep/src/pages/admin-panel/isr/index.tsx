import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, TrendingUp, Clock, Plus, RefreshCw,
  Mail, Building2, AlertCircle, ChevronRight, AlertTriangle, Users,
  LayoutGrid, List,
} from "lucide-react";
import { useState, useRef } from "react";
import { NewDealModal } from "./new-deal-modal";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:                  { label: "Yeni",              color: "bg-blue-100 text-blue-700" },
  rfq_sent:             { label: "RFQ Gönderildi",    color: "bg-yellow-100 text-yellow-700" },
  quoted:               { label: "Teklif Hazır",      color: "bg-purple-100 text-purple-700" },
  revision_requested:   { label: "Revizyon Talebi",   color: "bg-orange-100 text-orange-700 font-semibold" },
  approved:             { label: "Onaylandı",         color: "bg-emerald-100 text-emerald-700" },
  sent:                 { label: "Gönderildi",        color: "bg-green-100 text-green-700" },
  won:                  { label: "Kazanildi",         color: "bg-green-200 text-green-800" },
  lost:                 { label: "Kaybedildi",        color: "bg-red-100 text-red-700" },
  cancelled:            { label: "Iptal",             color: "bg-slate-100 text-slate-600" },
};

const KANBAN_COLUMNS = [
  { id: "new",                label: "Yeni",            headerBg: "bg-blue-100",    headerText: "text-blue-800",    border: "border-blue-200" },
  { id: "rfq_sent",           label: "RFQ Gönderildi",  headerBg: "bg-yellow-100",  headerText: "text-yellow-800",  border: "border-yellow-200" },
  { id: "quoted",             label: "Teklif Hazır",    headerBg: "bg-purple-100",  headerText: "text-purple-800",  border: "border-purple-200" },
  { id: "revision_requested", label: "Revizyon",        headerBg: "bg-orange-100",  headerText: "text-orange-800",  border: "border-orange-200" },
  { id: "approved",           label: "Onaylandı",       headerBg: "bg-emerald-100", headerText: "text-emerald-800", border: "border-emerald-200" },
  { id: "won",                label: "Kazanıldı",       headerBg: "bg-green-200",   headerText: "text-green-900",   border: "border-green-300" },
  { id: "lost",               label: "Kaybedildi",      headerBg: "bg-red-100",     headerText: "text-red-800",     border: "border-red-200" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-100 text-slate-500",
  normal: "bg-blue-50 text-blue-600",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük", normal: "Normal", high: "Yüksek", urgent: "Acil",
};

interface Deal {
  id: number;
  customerName: string | null;
  customerEmail: string;
  customerCompany: string | null;
  vendorName: string | null;
  productKeywords: string | null;
  originalSubject: string | null;
  aiSummary: string | null;
  status: string;
  priority: string;
  quoteCount: number;
  rfqCount: number;
  createdAt: string;
}

interface Stats {
  totalDeals: number;
  openDeals: number;
  pendingApproval: number;
  totalRfqs: number;
  activeVendors: number;
  revisionRequests: number;
}

export default function AdminIsrDashboard() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inboxMsg, setInboxMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onCooldown, setOnCooldown] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["isr-stats"],
    queryFn: () => fetch("/api/admin-panel/isr/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: dealsData, refetch } = useQuery<{ deals: Deal[]; total: number }>({
    queryKey: ["isr-deals"],
    queryFn: () => fetch("/api/admin-panel/isr/deals?limit=100", { credentials: "include" }).then(r => r.json()),
  });

  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin-panel/isr/inbox/check", { method: "POST", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Bilinmeyen hata");
      return data;
    },
    onSuccess: (data) => {
      setInboxMsg({ ok: true, text: data.message ?? "Kontrol tamamlandı" });
      setOnCooldown(true);
      cooldownRef.current = setTimeout(() => { setOnCooldown(false); setInboxMsg(null); }, 30_000);
      setTimeout(() => refetch(), 2000);
    },
    onError: (err: Error) => {
      setInboxMsg({ ok: false, text: err.message });
      setOnCooldown(true);
      cooldownRef.current = setTimeout(() => { setOnCooldown(false); setInboxMsg(null); }, 15_000);
    },
  });

  const deals = (dealsData?.deals ?? []).filter((d) => {
    const matchSearch = !search ||
      d.customerEmail.includes(search) ||
      (d.customerName?.toLowerCase().includes(search.toLowerCase())) ||
      (d.customerCompany?.toLowerCase().includes(search.toLowerCase())) ||
      (d.vendorName?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statCards = [
    { label: "Toplam Deal", value: stats?.totalDeals ?? 0, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Açık Deal", value: stats?.openDeals ?? 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Onay Bekleyen", value: stats?.pendingApproval ?? 0, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Revizyon Talebi", value: stats?.revisionRequests ?? 0, icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-50" },
    { label: "Aktif Satıcı", value: stats?.activeVendors ?? 0, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <AdminLayout
      title="AI Satış Asistanı"
      description="Gelen talepler, RFQ yönetimi ve teklif süreci"
    >
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {["all", "new", "rfq_sent", "quoted", "revision_requested", "approved", "sent", "won", "lost"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "all" ? "Tümü" : STATUS_LABELS[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <List className="h-3.5 w-3.5" /> Liste
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
            <Input
              placeholder="Ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>
        </div>

        {/* Action buttons — always full-width row */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={() => setShowNewDeal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Yeni Deal Ac
            </Button>
            <Button
              onClick={() => checkInboxMutation.mutate()}
              disabled={checkInboxMutation.isPending || onCooldown}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkInboxMutation.isPending ? "animate-spin" : ""}`} />
              {checkInboxMutation.isPending ? "Kontrol ediliyor..." : onCooldown ? "Bekleniyor..." : "Postaları Kontrol Et"}
            </Button>
            {inboxMsg && (
              <span className={`text-sm font-medium ${inboxMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {inboxMsg.ok ? "✓" : "✗"} {inboxMsg.text}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/panel/isr/musteriler")}>
              <Users className="h-4 w-4 mr-1.5" /> Musteri Rehberi
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/panel/isr/vendors")}>
              <Building2 className="h-4 w-4 mr-1.5" /> Satici & Distributor
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/panel/isr/kurallar")}>
              <TrendingUp className="h-4 w-4 mr-1.5" /> Marj Kurallari
            </Button>
          </div>
        </div>

        {/* Deals — List or Kanban */}
        {viewMode === "list" ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-emerald-500" />
                Deal Listesi
                <span className="text-sm font-normal text-slate-500">({deals.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {deals.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Mail className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">Henüz deal yok. Gelen kutusunu kontrol edin.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {deals.map((deal) => {
                    const status = STATUS_LABELS[deal.status] ?? { label: deal.status, color: "bg-slate-100 text-slate-600" };
                    return (
                      <button
                        key={deal.id}
                        onClick={() => navigate(`/panel/isr/deal/${deal.id}`)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-slate-900 text-sm">
                              {deal.customerCompany ?? deal.customerName ?? deal.customerEmail}
                            </span>
                            {deal.vendorName && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                                {deal.vendorName}
                              </span>
                            )}
                            <Badge className={`text-xs ${status.color} border-0`}>{status.label}</Badge>
                            <Badge className={`text-xs ${PRIORITY_COLORS[deal.priority] ?? ""} border-0`}>
                              {PRIORITY_LABELS[deal.priority] ?? deal.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {deal.aiSummary ?? deal.originalSubject ?? deal.productKeywords ?? "—"}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {deal.customerEmail} · {format(new Date(deal.createdAt), "d MMM yyyy", { locale: tr })}
                            {deal.rfqCount > 0 && ` · ${deal.rfqCount} RFQ`}
                            {deal.quoteCount > 0 && ` · ${deal.quoteCount} teklif`}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Kanban View */
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3" style={{ minWidth: "max-content" }}>
              {KANBAN_COLUMNS.map((col) => {
                const colDeals = deals.filter((d) => d.status === col.id);
                return (
                  <div
                    key={col.id}
                    className={`w-60 rounded-xl border-2 ${col.border} flex flex-col bg-white`}
                  >
                    <div className={`px-3 py-2.5 rounded-t-lg ${col.headerBg} flex items-center justify-between`}>
                      <span className={`text-xs font-semibold ${col.headerText}`}>{col.label}</span>
                      <span className={`text-xs font-bold ${col.headerText} bg-white/60 px-1.5 py-0.5 rounded-full`}>{colDeals.length}</span>
                    </div>
                    <div className="flex-1 p-2 space-y-2 min-h-[160px] max-h-[560px] overflow-y-auto">
                      {colDeals.length === 0 && (
                        <div className="text-center py-8 text-xs text-slate-300">Boş</div>
                      )}
                      {colDeals.map((deal) => (
                        <button
                          key={deal.id}
                          onClick={() => navigate(`/panel/isr/deal/${deal.id}`)}
                          className="w-full text-left bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all space-y-1.5"
                        >
                          <div className="font-semibold text-slate-900 text-xs leading-snug">
                            {deal.customerCompany ?? deal.customerName ?? deal.customerEmail}
                          </div>
                          {deal.vendorName && (
                            <span className="inline-block text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              {deal.vendorName}
                            </span>
                          )}
                          {(deal.aiSummary ?? deal.productKeywords) && (
                            <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {deal.aiSummary ?? deal.productKeywords}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[deal.priority] ?? "bg-slate-100 text-slate-500"}`}>
                              {PRIORITY_LABELS[deal.priority] ?? deal.priority}
                            </span>
                            <span className="text-xs text-slate-400">
                              {format(new Date(deal.createdAt), "d MMM", { locale: tr })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <NewDealModal
        open={showNewDeal}
        onClose={() => setShowNewDeal(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["isr-deals"] });
          qc.invalidateQueries({ queryKey: ["isr-stats"] });
        }}
      />
    </AdminLayout>
  );
}
