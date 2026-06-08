import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface BadgeRow {
  achievement: { id: number; customerId: number; earnedAt: string; sharedAt: string | null };
  badge: { id: number; slug: string; name: string; description: string; icon: string };
}

interface BadgeAdvantage {
  id: number;
  title: string;
  partnerName: string;
  description: string;
  discountPercent: number | null;
  badgeText: string | null;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE()}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type AdvForm = {
  title: string; partnerName: string; description: string;
  discountPercent: string; badgeText: string; logoUrl: string; sortOrder: string;
};
const EMPTY_ADV: AdvForm = { title: "", partnerName: "", description: "", discountPercent: "", badgeText: "", logoUrl: "", sortOrder: "0" };

export default function Rozetler() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"achievements" | "advantages">("achievements");
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [editAdvId, setEditAdvId] = useState<number | null>(null);
  const [advForm, setAdvForm] = useState<AdvForm>(EMPTY_ADV);
  const [msg, setMsg] = useState("");

  const { data: achievements = [], isLoading: achLoading } = useQuery<BadgeRow[]>({
    queryKey: ["digest-admin-badges"],
    queryFn: () => adminFetch("/api/admin/badges"),
  });

  const { data: advantages = [], isLoading: advLoading } = useQuery<BadgeAdvantage[]>({
    queryKey: ["digest-badge-advantages"],
    queryFn: () => adminFetch("/api/admin-panel/badge-advantages"),
  });

  const byBadge = achievements.reduce<Record<string, { badge: BadgeRow["badge"]; count: number }>>((acc, row) => {
    const key = row.badge.slug;
    if (!acc[key]) acc[key] = { badge: row.badge, count: 0 };
    acc[key]!.count++;
    return acc;
  }, {});

  const setAdv = (k: keyof AdvForm, v: string) => setAdvForm(f => ({ ...f, [k]: v }));

  const openNewAdv = () => { setEditAdvId(null); setAdvForm(EMPTY_ADV); setShowAdvForm(true); };
  const openEditAdv = (adv: BadgeAdvantage) => {
    setEditAdvId(adv.id);
    setAdvForm({
      title: adv.title, partnerName: adv.partnerName, description: adv.description,
      discountPercent: adv.discountPercent !== null ? String(adv.discountPercent) : "",
      badgeText: adv.badgeText ?? "", logoUrl: adv.logoUrl ?? "", sortOrder: String(adv.sortOrder),
    });
    setShowAdvForm(true);
  };

  const saveAdvMut = useMutation({
    mutationFn: (data: AdvForm) => {
      const payload = {
        ...data,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
        sortOrder: Number(data.sortOrder) || 0,
      };
      const url = editAdvId !== null
        ? `/api/admin-panel/badge-advantages/${editAdvId}`
        : "/api/admin-panel/badge-advantages";
      return adminFetch(url, { method: editAdvId !== null ? "PUT" : "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-badge-advantages"] });
      setShowAdvForm(false); setEditAdvId(null); setAdvForm(EMPTY_ADV);
      setMsg("Avantaj kaydedildi.");
    },
    onError: () => setMsg("Hata olustu."),
  });

  const deleteAdvMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin-panel/badge-advantages/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-badge-advantages"] }); setMsg("Silindi."); },
    onError: () => setMsg("Silinemedi."),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rozet Yonetimi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Musteri basari rozetleri ve rozet avantajlari.
          </p>
        </div>
        {tab === "advantages" && (
          <button onClick={openNewAdv}
            className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            + Yeni Avantaj
          </button>
        )}
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {msg} <button onClick={() => setMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      <div className="flex gap-2">
        {(["achievements", "advantages"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}>
            {t === "achievements" ? "Musteri Rozetleri" : "Rozet Avantajlari"}
          </button>
        ))}
      </div>

      {tab === "achievements" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Toplam Kazanim", value: achievements.length },
              { label: "Rozet Cesidi", value: Object.keys(byBadge).length },
              { label: "Paylasildi", value: achievements.filter(r => r.achievement.sharedAt).length },
            ].map(s => (
              <div key={s.label} className="border border-border rounded-xl bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{achLoading ? "—" : s.value}</p>
              </div>
            ))}
          </div>
          {!achLoading && (
            <div className="space-y-2">
              {Object.values(byBadge).sort((a, b) => b.count - a.count).map(({ badge, count }) => (
                <div key={badge.slug} className="border border-border rounded-xl bg-card p-3 flex items-center gap-3">
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{badge.name}</p>
                    <p className="text-muted-foreground text-xs">{badge.description}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Son Kazanimlar</p>
            {achievements.slice(0, 20).map(row => (
              <div key={row.achievement.id} className="border border-border rounded-lg bg-card px-3 py-2 flex items-center gap-2">
                <span className="text-base">{row.badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{row.badge.name}</p>
                  <p className="text-xs text-muted-foreground">Musteri #{row.achievement.customerId}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(row.achievement.earnedAt), "d MMM yyyy", { locale: tr })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "advantages" && (
        <div className="space-y-3">
          {showAdvForm && (
            <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-3 shadow-xl mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{editAdvId !== null ? "Duzenle" : "Yeni Avantaj"}</h3>
                  <button onClick={() => setShowAdvForm(false)}
                    className="text-xs border border-border rounded px-2 py-1 text-muted-foreground">Kapat</button>
                </div>
                {[
                  { k: "title" as const, label: "Baslik *", req: true },
                  { k: "partnerName" as const, label: "Partner Adi *", req: true },
                  { k: "description" as const, label: "Aciklama *", req: true },
                  { k: "discountPercent" as const, label: "Indirim % (opsiyonel)", req: false },
                  { k: "badgeText" as const, label: "Rozet Metni (opsiyonel)", req: false },
                  { k: "logoUrl" as const, label: "Logo URL (opsiyonel)", req: false },
                  { k: "sortOrder" as const, label: "Siralama", req: false },
                ].map(({ k, label }) => (
                  <div key={k}>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                    <input value={advForm[k]} onChange={e => setAdv(k, e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowAdvForm(false)}
                    className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                    Iptal
                  </button>
                  <button onClick={() => saveAdvMut.mutate(advForm)} disabled={saveAdvMut.isPending}
                    className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {saveAdvMut.isPending ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {advLoading ? (
            <p className="text-sm text-muted-foreground">Yukleniyor...</p>
          ) : advantages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henuz avantaj yok.</p>
          ) : (
            advantages.map(adv => (
              <div key={adv.id} className="border border-border rounded-xl bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${adv.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {adv.isActive ? "Aktif" : "Pasif"}
                      </span>
                      {adv.discountPercent && (
                        <span className="text-xs font-bold text-primary">%{adv.discountPercent} indirim</span>
                      )}
                    </div>
                    <p className="font-semibold text-foreground text-sm">{adv.title}</p>
                    <p className="text-xs text-muted-foreground">{adv.partnerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{adv.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditAdv(adv)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                    Duzenle
                  </button>
                  <button onClick={() => { if (confirm("Silmek istediginizden emin misiniz?")) deleteAdvMut.mutate(adv.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-600/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
