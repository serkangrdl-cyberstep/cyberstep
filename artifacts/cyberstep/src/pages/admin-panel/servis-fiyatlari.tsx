import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X } from "lucide-react";

interface ServicePrice {
  slug: string; label: string; amount_tl: string; unit: string; updated_at: string;
}

const UNIT_LABELS: Record<string, string> = { "yıl": "/ yıl", "ay": "/ ay", "tek seferlik": "tek seferlik", "tarama": "/ tarama" };

export default function AdminServisFiyatlari() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [editVals, setEditVals] = useState({ label: "", amount_tl: "", unit: "" });

  const { data: prices = [], isLoading } = useQuery<ServicePrice[]>({
    queryKey: ["admin-service-prices"],
    queryFn: async () => {
      const res = await fetch("/api/admin/service-prices", { credentials: "include" });
      if (!res.ok) throw new Error("Yüklenemedi");
      return res.json();
    },
  });

  const updatePrice = useMutation({
    mutationFn: async ({ slug, data }: { slug: string; data: Partial<ServicePrice> }) => {
      const res = await fetch(`/api/admin/service-prices/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-service-prices"] }); setEditing(null); },
  });

  const startEdit = (p: ServicePrice) => {
    setEditing(p.slug);
    setEditVals({ label: p.label, amount_tl: p.amount_tl, unit: p.unit });
  };

  const saveEdit = (slug: string) => updatePrice.mutate({ slug, data: { label: editVals.label, amount_tl: editVals.amount_tl, unit: editVals.unit } });

  const fmtPrice = (p: ServicePrice) => {
    const amt = parseFloat(p.amount_tl);
    if (amt === 0) return "Ücretsiz";
    return `${new Intl.NumberFormat("tr-TR").format(amt)} TL ${UNIT_LABELS[p.unit] ?? p.unit} + KDV`;
  };

  return (
    <AdminLayout title="Servis Fiyatları">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Servis Fiyat Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-1">Tüm servis fiyatları buradan yönetilir. Frontend bu tabloyu kullanır.</p>
        </div>

        {isLoading && <p className="text-slate-400">Yükleniyor...</p>}

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">SERVİS</th>
                <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">SLUG</th>
                <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">FİYAT</th>
                <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">BİRİM</th>
                <th className="text-left text-slate-400 text-xs font-medium px-4 py-3">SON GÜNCELLEME</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {prices.map(p => (
                <tr key={p.slug} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    {editing === p.slug ? (
                      <input className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1 w-48"
                        maxLength={120} value={editVals.label} onChange={e => setEditVals(v => ({ ...v, label: e.target.value }))} />
                    ) : (
                      <span className="text-white text-sm font-medium">{p.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><code className="text-slate-400 text-xs">{p.slug}</code></td>
                  <td className="px-4 py-3">
                    {editing === p.slug ? (
                      <input type="number" className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1 w-28"
                        maxLength={20} value={editVals.amount_tl} onChange={e => setEditVals(v => ({ ...v, amount_tl: e.target.value }))} />
                    ) : (
                      <span className="text-emerald-400 text-sm font-semibold">{fmtPrice(p)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === p.slug ? (
                      <select className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1"
                        value={editVals.unit} onChange={e => setEditVals(v => ({ ...v, unit: e.target.value }))}>
                        <option value="yıl">Yıllık</option>
                        <option value="ay">Aylık</option>
                        <option value="tek seferlik">Tek Seferlik</option>
                        <option value="tarama">Tarama başına</option>
                      </select>
                    ) : (
                      <span className="text-slate-300 text-sm">{p.unit}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.updated_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editing === p.slug ? (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2" onClick={() => saveEdit(p.slug)} disabled={updatePrice.isPending}><Save className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-slate-400 h-7 px-2" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 px-2" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">
            <strong className="text-slate-300">Not:</strong> Fiyat değişiklikleri anında yayına girer. Servis sayfaları <code className="bg-slate-700 px-1 rounded">GET /api/public/prices</code> endpoint'ini kullanır.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
