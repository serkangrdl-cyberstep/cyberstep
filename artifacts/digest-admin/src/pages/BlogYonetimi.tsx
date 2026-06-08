import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  authorName: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  coverImageBase64: string | null;
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

function statusBadge(status: string) {
  if (status === "published") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Yayında</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Taslak</span>;
}

export default function BlogYonetimi() {
  const qc = useQueryClient();
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [editForm, setEditForm] = useState({ title: "", excerpt: "" });
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [msg, setMsg] = useState("");

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["digest-blog-posts"],
    queryFn: () => adminFetch("/api/admin-panel/blog"),
    refetchInterval: 30000,
  });

  const publishMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin-panel/blog/${id}/publish`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-blog-posts"] }); setMsg("Yazı yayinlandi."); },
    onError: () => setMsg("Hata olustu."),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin-panel/blog/${id}/unpublish`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-blog-posts"] }); setMsg("Yayindan kaldirildi."); },
    onError: () => setMsg("Hata olustu."),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title: string; excerpt: string } }) =>
      adminFetch(`/api/admin-panel/blog/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-blog-posts"] });
      setEditPost(null);
      setMsg("Degisiklikler kaydedildi.");
    },
    onError: () => setMsg("Kayit basarisiz."),
  });

  const openEdit = (post: BlogPost) => {
    setEditPost(post);
    setEditForm({ title: post.title, excerpt: post.excerpt });
  };

  const filtered = posts.filter(p =>
    filter === "all" ? true : p.status === filter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Blog Yonetimi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Yayimlanan ve taslak blog yazilari — duzenle, yayimla veya yayindan kaldir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "published", "draft"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              }`}>
              {f === "all" ? "Tumu" : f === "published" ? "Yayinda" : "Taslak"}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  ({posts.filter(p => p.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {msg}
          <button onClick={() => setMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Yukleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Kayit yok.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id}
              className="border border-border rounded-xl bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {statusBadge(post.status)}
                    <span className="text-xs text-muted-foreground">
                      {post.publishedAt
                        ? format(new Date(post.publishedAt), "d MMM yyyy", { locale: tr })
                        : format(new Date(post.createdAt), "d MMM yyyy", { locale: tr }) + " (olusturuldu)"}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm leading-snug">{post.title}</h3>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{post.excerpt}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(post)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                  Duzenle
                </button>
                {post.status === "draft" ? (
                  <button onClick={() => publishMut.mutate(post.id)} disabled={publishMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50">
                    Yayimla
                  </button>
                ) : (
                  <button onClick={() => unpublishMut.mutate(post.id)} disabled={unpublishMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-muted-foreground transition-colors disabled:opacity-50">
                    Yayindan Kaldir
                  </button>
                )}
                <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                  Goruntule
                </a>
                <a href={`/panel/blog`} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                  Tam Editor
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {editPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Hizli Duzenleme</h3>
              <button onClick={() => setEditPost(null)}
                className="text-muted-foreground hover:text-foreground text-xs border border-border rounded px-2 py-1">Kapat</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Baslik</label>
                <input
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Ozet</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={4}
                  value={editForm.excerpt}
                  onChange={e => setEditForm(f => ({ ...f, excerpt: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Icerik, SEO ve sosyal medya alanlarini duzenlemek icin{" "}
                <a href="/panel/blog" target="_blank" className="underline text-primary">tam blog editorunu</a>{" "}
                kullanin.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditPost(null)}
                className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                Iptal
              </button>
              <button
                onClick={() => saveMut.mutate({ id: editPost.id, data: editForm })}
                disabled={saveMut.isPending}
                className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saveMut.isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
