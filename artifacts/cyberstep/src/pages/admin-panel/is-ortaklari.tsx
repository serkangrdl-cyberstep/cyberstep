import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, CheckCircle2, XCircle, Loader2, Eye, Trash2,
  Shield, TrendingUp, Clock, ChevronLeft, ChevronRight, Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminLayout } from "@/components/admin-layout";
import { useRequireAdmin } from "@/hooks/use-admin";

interface Partner {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  categories: string[];
  tier: string;
  status: string;
  monthlyFee: number | null;
  subscriptionStatus: string | null;
  description: string | null;
  totalProjectsCompleted: number | null;
  rating: number | null;
  createdAt: string;
  approvedAt: string | null;
}

interface PartnerListResp {
  rows: Partner[];
  total: number;
  page: number;
  limit: number;
}

interface PartnerStats {
  total: number;
  pending: number;
  active: number;
  gold: number;
}

const CATEGORIES = [
  "IT Altyapı / MSP",
  "KVKK / Uyum Danışmanlığı",
  "Siber Sigorta",
  "Penetrasyon Testi",
  "E-posta Güvenliği",
  "Bulut / Hosting",
  "SOC / Güvenlik İzleme",
  "Eğitim / Farkındalık",
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Onay Bekliyor",
  active: "Aktif",
  suspended: "Askıda",
};
const TIER_BADGE: Record<string, string> = {
  silver: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  gold: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function IsOrtaklari() {
  useRequireAdmin();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [tierModal, setTierModal] = useState<Partner | null>(null);

  const [form, setForm] = useState({
    email: "", password: "", companyName: "", contactName: "",
    phone: "", website: "", description: "", tier: "silver",
    monthlyFee: "", categories: [] as string[],
  });

  const { data: stats } = useQuery<PartnerStats>({
    queryKey: ["admin-partner-stats"],
    queryFn: () => fetch("/api/admin-panel/partners/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: list, isLoading } = useQuery<PartnerListResp>({
    queryKey: ["admin-partners", page],
    queryFn: () => fetch(`/api/admin-panel/partners?page=${page}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: detail } = useQuery<Partner>({
    queryKey: ["admin-partner-detail", detailId],
    queryFn: () => fetch(`/api/admin-panel/partners/${detailId}`, { credentials: "include" }).then(r => r.json()),
    enabled: detailId !== null,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin-panel/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      qc.invalidateQueries({ queryKey: ["admin-partner-stats"] });
      setAddOpen(false);
      setForm({ email: "", password: "", companyName: "", contactName: "", phone: "", website: "", description: "", tier: "silver", monthlyFee: "", categories: [] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin-panel/partners/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier: "silver" }),
      });
      if (!res.ok) throw new Error("Onaylanamadı");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      qc.invalidateQueries({ queryKey: ["admin-partner-stats"] });
      setApproveId(null);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin-panel/partners/${id}/suspend`, { method: "PUT", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partners"] }),
  });

  const tierMutation = useMutation({
    mutationFn: async ({ id, tier, monthlyFee }: { id: number; tier: string; monthlyFee: number }) => {
      const res = await fetch(`/api/admin-panel/partners/${id}/tier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier, monthlyFee }),
      });
      if (!res.ok) throw new Error("Tier güncellenemedi");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      setTierModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin-panel/partners/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partners"] }),
  });

  const totalPages = Math.ceil((list?.total ?? 0) / (list?.limit ?? 30));

  return (
    <AdminLayout title="İş Ortakları" description="Partner ekosistemini yönetin — onay, tier ve performans takibi">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Toplam Partner", value: stats?.total ?? 0, icon: Building2, color: "text-slate-300" },
          { label: "Onay Bekliyor", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-400" },
          { label: "Aktif Partner", value: stats?.active ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Gold Tier", value: stats?.gold ?? 0, icon: Star, color: "text-amber-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-100 text-base">Partner Listesi</CardTitle>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Partner
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Firma</th>
                <th className="px-4 py-3 text-left">İletişim</th>
                <th className="px-4 py-3 text-left">Kategoriler</th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-center">Tamamlanan</th>
                <th className="px-4 py-3 text-left">Kayıt</th>
                <th className="px-4 py-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Yükleniyor...
                </td></tr>
              )}
              {!isLoading && (list?.rows ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Henüz kayıtlı partner yok
                </td></tr>
              )}
              {(list?.rows ?? []).map(p => (
                <tr key={p.id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">{p.companyName}</p>
                    <p className="text-slate-500 text-xs">{p.website ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-300 text-xs">{p.contactName}</p>
                    <p className="text-slate-500 text-xs">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.categories ?? []).slice(0, 2).map(c => (
                        <Badge key={c} variant="outline" className="text-xs px-1.5 py-0 text-slate-400 border-slate-600">{c}</Badge>
                      ))}
                      {(p.categories ?? []).length > 2 && (
                        <span className="text-xs text-slate-600">+{p.categories.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${TIER_BADGE[p.tier] ?? ""}`}>
                      {p.tier === "gold" ? "Gold" : "Silver"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[p.status] ?? ""}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-300 text-sm font-mono">{p.totalProjectsCompleted ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => setDetailId(p.id)} title="Detay">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => approveMutation.mutate(p.id)} title="Onayla"
                          disabled={approveMutation.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.status === "active" && (
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-amber-600 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => setTierModal(p)} title="Tier Değiştir">
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-600 text-red-400 hover:bg-red-500/10"
                        onClick={() => deleteMutation.mutate(p.id)} title="Sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 text-xs">{list?.total ?? 0} partner</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Partner Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Yeni Partner Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Firma Adı *</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Yetkili Adı *</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">E-posta *</Label>
                <Input type="email" className="bg-slate-800 border-slate-600 text-slate-100" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Şifre *</Label>
                <Input type="password" className="bg-slate-800 border-slate-600 text-slate-100" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Telefon</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Web Site</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Tier</Label>
                <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Aylık Ücret (TL)</Label>
                <Input type="number" className="bg-slate-800 border-slate-600 text-slate-100" value={form.monthlyFee}
                  onChange={e => setForm(f => ({ ...f, monthlyFee: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Kategoriler</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c} type="button"
                    className={`text-xs px-2 py-1 rounded border transition-colors ${form.categories.includes(c) ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}
                    onClick={() => setForm(f => ({
                      ...f,
                      categories: f.categories.includes(c) ? f.categories.filter(x => x !== c) : [...f.categories, c],
                    }))}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Açıklama</Label>
              <Textarea className="bg-slate-800 border-slate-600 text-slate-100 resize-none" rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setAddOpen(false)}>İptal</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={createMutation.isPending || !form.email || !form.password || !form.companyName || !form.contactName}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tier Modal */}
      {tierModal && (
        <Dialog open onOpenChange={() => setTierModal(null)}>
          <DialogContent className="max-w-sm bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>Tier Değiştir — {tierModal.companyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Yeni Tier</Label>
                <Select defaultValue={tierModal.tier} onValueChange={v => setTierModal(t => t ? { ...t, tier: v } : null)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silver">Silver — Lead erişimi</SelectItem>
                    <SelectItem value="gold">Gold — White-label + öncelikli lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Aylık Platform Ücreti (TL)</Label>
                <Input type="number" className="bg-slate-800 border-slate-600 text-slate-100"
                  defaultValue={tierModal.monthlyFee ?? 0}
                  onChange={e => setTierModal(t => t ? { ...t, monthlyFee: Number(e.target.value) } : null)} />
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={tierMutation.isPending}
                onClick={() => tierMutation.mutate({ id: tierModal.id, tier: tierModal.tier, monthlyFee: tierModal.monthlyFee ?? 0 })}>
                {tierMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Modal */}
      {detailId && detail && (
        <Dialog open onOpenChange={() => setDetailId(null)}>
          <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {detail.companyName}
                <Badge variant="outline" className={`text-xs ${TIER_BADGE[detail.tier] ?? ""}`}>{detail.tier}</Badge>
                <Badge variant="outline" className={`text-xs ${STATUS_BADGE[detail.status] ?? ""}`}>{STATUS_LABEL[detail.status]}</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Yetkili:</span> <span className="text-slate-200">{detail.contactName}</span></div>
                <div><span className="text-slate-500">E-posta:</span> <span className="text-slate-200">{detail.email}</span></div>
                <div><span className="text-slate-500">Telefon:</span> <span className="text-slate-200">{detail.phone ?? "—"}</span></div>
                <div><span className="text-slate-500">Web:</span> <span className="text-slate-200">{detail.website ?? "—"}</span></div>
                <div><span className="text-slate-500">Aylık Ücret:</span> <span className="text-slate-200">₺{detail.monthlyFee ?? 0}</span></div>
                <div><span className="text-slate-500">Tamamlanan:</span> <span className="text-slate-200">{detail.totalProjectsCompleted ?? 0} proje</span></div>
              </div>
              {detail.description && (
                <p className="text-slate-400 text-xs bg-slate-800 rounded p-2">{detail.description}</p>
              )}
              {(detail.categories ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.categories.map(c => (
                    <Badge key={c} variant="outline" className="text-xs text-slate-400 border-slate-600">{c}</Badge>
                  ))}
                </div>
              )}
              {detail.status === "active" && (
                <Button variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => { suspendMutation.mutate(detail.id); setDetailId(null); }}>
                  Hesabı Askıya Al
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
