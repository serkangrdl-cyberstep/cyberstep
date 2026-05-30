import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface NewsSource {
  id: number;
  name: string;
  url: string;
  type: string;
  language: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
}

function apiFetch(path: string, opts?: RequestInit) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());
}

export default function Sources() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", language: "en" });
  const [formErr, setFormErr] = useState("");

  const { data: sources = [], isLoading } = useQuery<NewsSource[]>({
    queryKey: ["digest-sources"],
    queryFn: () => apiFetch("/api/digest/sources"),
  });

  const addMut = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch("/api/digest/sources", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-sources"] });
      setShowAdd(false);
      setForm({ name: "", url: "", language: "en" });
      setFormErr("");
    },
    onError: () => setFormErr("Kaynak eklenemedi. URL zaten mevcut olabilir."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/digest/sources/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["digest-sources"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      return fetch(`${base}/api/digest/sources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["digest-sources"] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setFormErr("Ad ve URL zorunludur.");
      return;
    }
    addMut.mutate(form);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RSS Kaynaklar</h1>
          <p className="text-muted-foreground text-sm mt-1">Haber toplanacak RSS feed kaynaklar</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showAdd ? "Iptal" : "Kaynak Ekle"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Yeni RSS Kaynagi</h2>
          {formErr && <p className="text-sm text-destructive">{formErr}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Kaynak Adi</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="BleepingComputer"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">RSS URL</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com/feed.rss"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Dil</label>
              <select
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="tr">Turkce (hepsi dahil)</option>
                <option value="en">Ingilizce (Turkiye filtreli)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addMut.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {addMut.isPending ? "Ekleniyor..." : "Ekle"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-muted text-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Iptal
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className={`bg-card border rounded-lg p-4 transition-colors ${s.isActive ? "border-card-border" : "border-border opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.language === "tr" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {s.language.toUpperCase()}
                    </span>
                    {!s.isActive && <span className="text-xs text-muted-foreground">(Pasif)</span>}
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary truncate block mt-0.5"
                  >
                    {s.url}
                  </a>
                  {s.lastFetchedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Son cekme: {new Date(s.lastFetchedAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleMut.mutate({ id: s.id, isActive: !s.isActive })}
                    disabled={toggleMut.isPending}
                    className="px-3 py-1.5 text-xs border border-border rounded-md text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {s.isActive ? "Durdur" : "Etkinlestir"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${s.name}" kaynagi silinsin mi?`)) {
                        deleteMut.mutate(s.id);
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="px-3 py-1.5 text-xs border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p>Turkce kaynaklar: tum haberler kaydedilir.</p>
        <p>Ingilizce kaynaklar: sadece baslik veya ozette "Turkiye / Turkey / BTK / USOM" gibi anahtar kelimeler gecen haberler kaydedilir.</p>
      </div>
    </div>
  );
}
