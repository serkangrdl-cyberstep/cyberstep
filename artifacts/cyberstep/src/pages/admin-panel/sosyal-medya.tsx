import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface SocialLink {
  id: number;
  platform: string;
  label: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Diger" },
];

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "text-[#0077B5]",
  instagram: "text-[#E4405F]",
  x: "text-slate-900",
  youtube: "text-[#FF0000]",
  facebook: "text-[#1877F2]",
  tiktok: "text-slate-900",
  other: "text-slate-500",
};

export default function AdminSosyalMedya() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newPlatform, setNewPlatform] = useState("linkedin");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const { data: links, isLoading } = useQuery<SocialLink[]>({
    queryKey: ["admin-social-links"],
    queryFn: () => fetch("/api/admin-panel/social-links", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-social-links"] });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch("/api/admin-panel/social-links", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Sosyal medya linki eklendi" });
      setNewPlatform("linkedin"); setNewLabel(""); setNewUrl("");
      invalidate();
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`/api/admin-panel/social-links/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Guncellendi" }); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/social-links/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Silindi" }); invalidate(); },
  });

  const handleAdd = () => {
    if (!newLabel || !newUrl) { toast({ title: "Etiket ve URL zorunludur", variant: "destructive" }); return; }
    if (!newUrl.startsWith("http")) { toast({ title: "URL http:// veya https:// ile baslamalidir", variant: "destructive" }); return; }
    createMutation.mutate({ platform: newPlatform, label: newLabel, url: newUrl, sortOrder: (links?.length ?? 0) * 10 });
  };

  return (
    <AdminLayout title="Sosyal Medya Yonetimi" description="Linkleri ekle, duzenle, aktif/deaktif yap. Footer'da gosterilir.">
      <div className="max-w-2xl space-y-6">
        {/* Add new */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" />
            Yeni Link Ekle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Platform</label>
              <select
                value={newPlatform}
                onChange={e => {
                  setNewPlatform(e.target.value);
                  const p = PLATFORMS.find(p => p.value === e.target.value);
                  if (p) setNewLabel(p.label);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-white"
              >
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Etiket</label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ornek: CyberStep LinkedIn" className="bg-slate-900 border-slate-600 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">URL</label>
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://linkedin.com/company/..." className="bg-slate-900 border-slate-600 text-white" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={createMutation.isPending} className="bg-emerald-500 hover:bg-emerald-400 text-white">
            {createMutation.isPending ? "Ekleniyor..." : "Ekle"}
          </Button>
        </div>

        {/* Links list */}
        <div>
          <h3 className="text-white font-semibold mb-3">Mevcut Linkler</h3>
          {isLoading && <div className="text-slate-400 text-sm">Yukleniyor...</div>}
          {!isLoading && links?.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
              Henuz link yok. Yukardaki formdan ekleyin.
            </div>
          )}
          <div className="space-y-2">
            {links?.map(link => (
              <div key={link.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-slate-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-medium text-sm ${PLATFORM_COLORS[link.platform] ?? "text-slate-300"}`}>
                      {PLATFORMS.find(p => p.value === link.platform)?.label ?? link.platform}
                    </span>
                    <Badge variant={link.isActive ? "default" : "secondary"} className={link.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs" : "bg-slate-700 text-slate-500 text-xs"}>
                      {link.isActive ? "Aktif" : "Deaktif"}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-xs truncate">{link.label} — {link.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateMutation.mutate({ id: link.id, data: { isActive: !link.isActive } })}
                    className={link.isActive ? "border-slate-600 text-slate-300 hover:bg-slate-700 text-xs" : "border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 text-xs"}
                  >
                    {link.isActive ? "Deaktif Et" : "Aktif Et"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { if (confirm("Bu linki silmek istiyor musunuz?")) deleteMutation.mutate(link.id); }}
                    className="border-red-800 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-sm text-slate-400">
          Aktif linkler sitenin footer bolumunde ikonlarla gosterilir. Sirayi sortOrder degeriyle ayarlayabilirsiniz.
        </div>
      </div>
    </AdminLayout>
  );
}
