import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, CheckCircle2, XCircle, Loader2, Eye, Trash2,
  Clock, ChevronLeft, ChevronRight, UserCheck, TrendingUp, AlertTriangle,
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

interface WorkPackage {
  id: number;
  assessmentId: number | null;
  domainScanId: number | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  estimatedCost: number | null;
  commissionRate: number;
  status: string;
  partnerId: number | null;
  partnerCompany: string | null;
  partnerEmail: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  completionNote: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  companyName: string | null;
  domain: string | null;
  createdAt: string;
}

interface WorkPackageListResp {
  rows: WorkPackage[];
  total: number;
  page: number;
  limit: number;
}

interface Stats {
  total: number;
  open: number;
  assigned: number;
  completed: number;
  verified: number;
}

interface Partner {
  id: number;
  companyName: string;
  tier: string;
  categories: string[];
}

const CATEGORIES = [
  "E-posta Güvenliği", "KVKK / Uyum", "IT Altyapı", "Penetrasyon Testi",
  "Siber Sigorta", "Bulut Güvenliği", "SOC / İzleme", "Eğitim", "Diğer",
];

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  completed: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  verified: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Açık", assigned: "Atandı", in_progress: "Devam Ediyor",
  completed: "Tamamlandı", verified: "Doğrulandı",
};

export default function IsPaketleri() {
  useRequireAdmin();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [detailPkg, setDetailPkg] = useState<WorkPackage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [assignPkg, setAssignPkg] = useState<WorkPackage | null>(null);
  const [verifyPkg, setVerifyPkg] = useState<WorkPackage | null>(null);
  const [scoreAfterInput, setScoreAfterInput] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", category: "E-posta Güvenliği",
    priority: "medium", estimatedCost: "", commissionRate: "15",
    companyName: "", domain: "",
  });
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["wp-stats"],
    queryFn: () => fetch("/api/work-packages/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: list, isLoading } = useQuery<WorkPackageListResp>({
    queryKey: ["work-packages", page],
    queryFn: () => fetch(`/api/work-packages?page=${page}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: partners } = useQuery<{ rows: Partner[] }>({
    queryKey: ["admin-partners-active"],
    queryFn: () => fetch("/api/admin-panel/partners?status=active", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/work-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
          commissionRate: Number(form.commissionRate),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-packages"] });
      qc.invalidateQueries({ queryKey: ["wp-stats"] });
      setAddOpen(false);
      setForm({ title: "", description: "", category: "E-posta Güvenliği", priority: "medium", estimatedCost: "", commissionRate: "15", companyName: "", domain: "" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, partnerId }: { id: number; partnerId: number }) => {
      const res = await fetch(`/api/work-packages/${id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ partnerId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-packages"] });
      qc.invalidateQueries({ queryKey: ["wp-stats"] });
      setAssignPkg(null);
      setSelectedPartnerId("");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, scoreAfter }: { id: number; scoreAfter?: number }) => {
      const res = await fetch(`/api/work-packages/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scoreAfter }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-packages"] });
      qc.invalidateQueries({ queryKey: ["wp-stats"] });
      setVerifyPkg(null);
      setScoreAfterInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/work-packages/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-packages"] });
      qc.invalidateQueries({ queryKey: ["wp-stats"] });
    },
  });

  const totalPages = Math.ceil((list?.total ?? 0) / (list?.limit ?? 30));

  return (
    <AdminLayout title="İş Paketleri" description="Risk bulgularından aksiyon paketleri oluşturun, partnerlere atayın ve doğrulayın">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Toplam", value: stats?.total ?? 0, color: "text-slate-300" },
          { label: "Açık", value: stats?.open ?? 0, color: "text-slate-400" },
          { label: "Atandı", value: stats?.assigned ?? 0, color: "text-blue-400" },
          { label: "Tamamlandı", value: stats?.completed ?? 0, color: "text-violet-400" },
          { label: "Doğrulandı", value: stats?.verified ?? 0, color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-100 text-base">İş Paketi Listesi</CardTitle>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Paket
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Başlık</th>
                <th className="px-4 py-3 text-left">Müşteri</th>
                <th className="px-4 py-3 text-center">Kategori</th>
                <th className="px-4 py-3 text-center">Öncelik</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-center">Tahmini</th>
                <th className="px-4 py-3 text-center">Delta</th>
                <th className="px-4 py-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Yükleniyor...
                </td></tr>
              )}
              {!isLoading && (list?.rows ?? []).length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Henüz iş paketi yok</td></tr>
              )}
              {(list?.rows ?? []).map(pkg => (
                <tr key={pkg.id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">{pkg.title}</p>
                    <p className="text-slate-500 text-xs line-clamp-1">{pkg.description ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-300 text-xs">{pkg.companyName ?? "—"}</p>
                    <p className="text-slate-500 text-xs font-mono">{pkg.domain ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">{pkg.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${PRIORITY_BADGE[pkg.priority] ?? ""}`}>
                      {PRIORITY_LABEL[pkg.priority] ?? pkg.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[pkg.status] ?? ""}`}>
                      {STATUS_LABEL[pkg.status] ?? pkg.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-300 text-xs">{pkg.partnerCompany ?? <span className="text-slate-600">Atanmadı</span>}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-300 text-xs">{pkg.estimatedCost ? `₺${pkg.estimatedCost.toLocaleString("tr-TR")}` : "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pkg.scoreBefore !== null && pkg.scoreAfter !== null ? (
                      <span className={`text-xs font-bold ${pkg.scoreAfter > pkg.scoreBefore ? "text-emerald-400" : "text-red-400"}`}>
                        {pkg.scoreAfter > pkg.scoreBefore ? "+" : ""}{pkg.scoreAfter - pkg.scoreBefore}
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => setDetailPkg(pkg)} title="Detay">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {pkg.status === "open" && (
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-blue-600 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => setAssignPkg(pkg)} title="Partner Ata">
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {pkg.status === "completed" && (
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => setVerifyPkg(pkg)} title="Doğrula">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-600 text-red-400 hover:bg-red-500/10"
                        onClick={() => deleteMutation.mutate(pkg.id)} title="Sil">
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
            <span className="text-slate-500 text-xs">{list?.total ?? 0} paket</span>
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

      {/* Add Package Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader><DialogTitle>Yeni İş Paketi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Başlık *</Label>
              <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Örn: SPF/DMARC yapılandırma düzeltmesi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Kategori *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Öncelik</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Düşük</SelectItem>
                    <SelectItem value="medium">Orta</SelectItem>
                    <SelectItem value="high">Yüksek</SelectItem>
                    <SelectItem value="critical">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Müşteri / Firma</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100" value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Alan Adı</Label>
                <Input className="bg-slate-800 border-slate-600 text-slate-100 font-mono" value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Tahmini Maliyet (TL)</Label>
                <Input type="number" className="bg-slate-800 border-slate-600 text-slate-100" value={form.estimatedCost}
                  onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Komisyon Oranı (%)</Label>
                <Input type="number" className="bg-slate-800 border-slate-600 text-slate-100" value={form.commissionRate}
                  onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))} />
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
              disabled={createMutation.isPending || !form.title || !form.category}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Oluştur"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Partner Modal */}
      {assignPkg && (
        <Dialog open onOpenChange={() => setAssignPkg(null)}>
          <DialogContent className="max-w-sm bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>Partner Ata — {assignPkg.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue placeholder="Partner seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(partners?.rows ?? []).filter(p => (p as any).status === "active" || true).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.companyName} — {p.tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!selectedPartnerId || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ id: assignPkg.id, partnerId: Number(selectedPartnerId) })}>
                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ata"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Verify Modal */}
      {verifyPkg && (
        <Dialog open onOpenChange={() => setVerifyPkg(null)}>
          <DialogContent className="max-w-sm bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>Tamamlamayı Doğrula</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-400">{verifyPkg.title}</p>
              {verifyPkg.completionNote && (
                <div className="bg-slate-800 rounded p-2 text-xs text-slate-300">{verifyPkg.completionNote}</div>
              )}
              {verifyPkg.scoreBefore !== null && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">
                    Önceki Skor: {verifyPkg.scoreBefore} — Yeni Skor (opsiyonel)
                  </Label>
                  <Input type="number" className="bg-slate-800 border-slate-600 text-slate-100"
                    placeholder="Ör: 75"
                    value={scoreAfterInput} onChange={e => setScoreAfterInput(e.target.value)} />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-slate-600 text-slate-300"
                  onClick={() => setVerifyPkg(null)}>İptal</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({
                    id: verifyPkg.id,
                    scoreAfter: scoreAfterInput ? Number(scoreAfterInput) : undefined,
                  })}>
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Doğrula"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Modal */}
      {detailPkg && (
        <Dialog open onOpenChange={() => setDetailPkg(null)}>
          <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {detailPkg.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${STATUS_BADGE[detailPkg.status] ?? ""}`}>{STATUS_LABEL[detailPkg.status]}</Badge>
                <Badge variant="outline" className={`text-xs ${PRIORITY_BADGE[detailPkg.priority] ?? ""}`}>{PRIORITY_LABEL[detailPkg.priority]}</Badge>
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">{detailPkg.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><span className="text-slate-500">Müşteri:</span> <span className="text-slate-200">{detailPkg.companyName ?? "—"}</span></div>
                <div><span className="text-slate-500">Alan:</span> <span className="text-slate-200 font-mono">{detailPkg.domain ?? "—"}</span></div>
                <div><span className="text-slate-500">Partner:</span> <span className="text-slate-200">{detailPkg.partnerCompany ?? "Atanmadı"}</span></div>
                <div><span className="text-slate-500">Maliyet:</span> <span className="text-slate-200">{detailPkg.estimatedCost ? `₺${detailPkg.estimatedCost.toLocaleString("tr-TR")}` : "—"}</span></div>
                <div><span className="text-slate-500">Komisyon:</span> <span className="text-slate-200">%{detailPkg.commissionRate}</span></div>
                {detailPkg.estimatedCost && (
                  <div><span className="text-slate-500">CyberStep payı:</span> <span className="text-emerald-400">₺{Math.round(detailPkg.estimatedCost * detailPkg.commissionRate / 100).toLocaleString("tr-TR")}</span></div>
                )}
              </div>
              {detailPkg.scoreBefore !== null && detailPkg.scoreAfter !== null && (
                <div className="bg-slate-800 rounded-lg p-3 flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{detailPkg.scoreBefore}</p>
                    <p className="text-xs text-slate-500">Önceki</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{detailPkg.scoreAfter}</p>
                    <p className="text-xs text-slate-500">Sonraki</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">+{detailPkg.scoreAfter - detailPkg.scoreBefore}</p>
                    <p className="text-xs text-slate-500">Delta</p>
                  </div>
                </div>
              )}
              {detailPkg.completionNote && (
                <div className="bg-slate-800 rounded p-2 text-xs text-slate-300">
                  <p className="text-slate-500 mb-1">Partner notu:</p>
                  {detailPkg.completionNote}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
