import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TrendingUp, Plus, Edit, Trash2, Star } from "lucide-react";
import { useState } from "react";

interface MarginRule {
  id: number;
  vendorId: number | null;
  name: string;
  minMarginPct: string;
  targetMarginPct: string;
  maxDiscountPct: string;
  autoApproveBelow: string | null;
  requireApprovalAbove: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface Vendor {
  id: number;
  displayName: string;
}

const EMPTY_RULE = {
  name: "", minMarginPct: "15", targetMarginPct: "25", maxDiscountPct: "10",
  autoApproveBelow: "", requireApprovalAbove: "", isDefault: false, vendorId: "",
};

export default function AdminIsrKurallar() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing?: MarginRule }>({ open: false });
  const [form, setForm] = useState(EMPTY_RULE);

  const { data: rules = [], refetch } = useQuery<MarginRule[]>({
    queryKey: ["isr-margin-rules"],
    queryFn: () => fetch("/api/admin-panel/isr/margin-rules", { credentials: "include" }).then(r => r.json()),
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
  });

  const saveRule = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        vendorId: form.vendorId ? parseInt(form.vendorId) : null,
        minMarginPct: parseFloat(form.minMarginPct),
        targetMarginPct: parseFloat(form.targetMarginPct),
        maxDiscountPct: parseFloat(form.maxDiscountPct),
        autoApproveBelow: form.autoApproveBelow ? parseFloat(form.autoApproveBelow) : null,
        requireApprovalAbove: form.requireApprovalAbove ? parseFloat(form.requireApprovalAbove) : null,
      };
      if (dialog.editing) {
        return fetch(`/api/admin-panel/isr/margin-rules/${dialog.editing.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/isr/margin-rules", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then(r => r.json());
    },
    onSuccess: () => { setDialog({ open: false }); refetch(); },
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/isr/margin-rules/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const openDialog = (r?: MarginRule) => {
    setForm(r ? {
      name: r.name,
      minMarginPct: r.minMarginPct,
      targetMarginPct: r.targetMarginPct,
      maxDiscountPct: r.maxDiscountPct,
      autoApproveBelow: r.autoApproveBelow ?? "",
      requireApprovalAbove: r.requireApprovalAbove ?? "",
      isDefault: r.isDefault,
      vendorId: r.vendorId ? String(r.vendorId) : "",
    } : EMPTY_RULE);
    setDialog({ open: true, editing: r });
  };

  return (
    <AdminLayout title="Marj Kuralları" description="Fiyat hesaplama, kar marjı ve otomatik onay limitleri">
      <div className="space-y-6">

        {/* Explanation card */}
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">Marj kuralları nasıl çalışır?</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Distribütörden maliyet fiyatı geldiğinde, <strong>Hedef Marj</strong> oranında satış fiyatı otomatik hesaplanır.</li>
              <li><strong>Min Marj</strong>: Bu oranın altına düşülemez, indirim bu sınırı aşamaz.</li>
              <li><strong>Max İndirim</strong>: Müşteriye yapılabilecek maksimum indirim oranı.</li>
              <li><strong>Otomatik Onay Limiti</strong>: Bu tutarın altındaki teklifler direkt gönderilir.</li>
              <li><strong>Onay Zorunlu Limit</strong>: Bu tutarın üzerindeki teklifler mutlaka onay gerektirir.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Kural Ekle
          </Button>
        </div>

        {rules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-slate-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Henüz marj kuralı tanımlanmadı. Bir varsayılan kural ekleyin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const vendorName = rule.vendorId
                ? vendors.find(v => v.id === rule.vendorId)?.displayName
                : null;
              return (
                <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{rule.name}</CardTitle>
                        {rule.isDefault && (
                          <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5" /> Varsayılan
                          </Badge>
                        )}
                        {vendorName && (
                          <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{vendorName}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(rule)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteRule.mutate(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-lg font-bold text-slate-900">%{Number(rule.minMarginPct).toFixed(0)}</div>
                        <div className="text-xs text-slate-500">Min Marj</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <div className="text-lg font-bold text-emerald-700">%{Number(rule.targetMarginPct).toFixed(0)}</div>
                        <div className="text-xs text-slate-500">Hedef Marj</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <div className="text-lg font-bold text-orange-600">%{Number(rule.maxDiscountPct).toFixed(0)}</div>
                        <div className="text-xs text-slate-500">Max İndirim</div>
                      </div>
                    </div>
                    {(rule.autoApproveBelow || rule.requireApprovalAbove) && (
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        {rule.autoApproveBelow && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                            {Number(rule.autoApproveBelow).toLocaleString("tr-TR")} TRY altı otomatik gönder
                          </div>
                        )}
                        {rule.requireApprovalAbove && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                            {Number(rule.requireApprovalAbove).toLocaleString("tr-TR")} TRY üstü onay zorunlu
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Kural Düzenle" : "Yeni Marj Kuralı"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Kural Adı</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="text-sm mt-1" placeholder="ör: Fortinet Standart" />
            </div>
            <div>
              <Label className="text-xs">Satıcı (opsiyonel — boş bırakılırsa tüm satıcılar için geçerli)</Label>
              <select
                value={form.vendorId}
                onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Tüm Satıcılar (Varsayılan)</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Min Marj %</Label>
                <Input type="number" value={form.minMarginPct} onChange={e => setForm(f => ({ ...f, minMarginPct: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Hedef Marj %</Label>
                <Input type="number" value={form.targetMarginPct} onChange={e => setForm(f => ({ ...f, targetMarginPct: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Indirim %</Label>
                <Input type="number" value={form.maxDiscountPct} onChange={e => setForm(f => ({ ...f, maxDiscountPct: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Otomatik Onay Limiti (TRY)</Label>
                <Input type="number" value={form.autoApproveBelow} onChange={e => setForm(f => ({ ...f, autoApproveBelow: e.target.value }))} className="text-sm mt-1" placeholder="ör: 50000" />
              </div>
              <div>
                <Label className="text-xs">Onay Zorunlu Limit (TRY)</Label>
                <Input type="number" value={form.requireApprovalAbove} onChange={e => setForm(f => ({ ...f, requireApprovalAbove: e.target.value }))} className="text-sm mt-1" placeholder="ör: 200000" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isDefault}
                onCheckedChange={v => setForm(f => ({ ...f, isDefault: v }))}
              />
              <Label className="text-sm cursor-pointer">Varsayılan kural olarak ayarla</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Iptal</Button>
            <Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending || !form.name}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
