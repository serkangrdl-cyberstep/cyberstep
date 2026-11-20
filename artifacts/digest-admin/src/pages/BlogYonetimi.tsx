import { RichTextEditor } from "@/components/RichTextEditor";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Wand2, Loader2, ImageOff } from "lucide-react";

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


async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
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
  const [editForm, setEditForm] = useState({ title: "", slug: "", excerpt: "", content: "" });
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [msg, setMsg] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());

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

  interface DraftStatus {
    state: "idle" | "running" | "ok" | "error";
    startedAt: string | null; finishedAt: string | null;
    title: string | null; postId: number | null;
    coverOk: boolean | null; error: string | null;
  }

  const { data: draftStatus } = useQuery<DraftStatus>({
    queryKey: ["digest-draft-status"],
    queryFn: () => adminFetch("/api/admin-panel/blog-autopilot/draft-status"),
    refetchInterval: (q) => (q.state.data?.state === "running" ? 4000 : false),
  });
  const draftRunning = draftStatus?.state === "running";

  const draftMut = useMutation({
    mutationFn: () => adminFetch("/api/admin-panel/blog-autopilot/generate-draft", { method: "POST" }) as Promise<{ started: boolean }>,
    onSuccess: (r) => {
      setMsg(r.started ? "" : "Zaten bir taslak üretiliyor, bitmesini bekleyin.");
      qc.invalidateQueries({ queryKey: ["digest-draft-status"] });
    },
    onError: () => setMsg("Taslak üretimi başlatılamadı."),
  });

  const prevDraftState = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevDraftState.current === "running" && draftStatus?.state !== "running") {
      qc.invalidateQueries({ queryKey: ["digest-blog-posts"] });
    }
    prevDraftState.current = draftStatus?.state;
  }, [draftStatus?.state, qc]);

  const unpublishMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin-panel/blog/${id}/unpublish`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-blog-posts"] }); setMsg("Yayindan kaldirildi."); },
    onError: () => setMsg("Hata olustu."),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title: string; slug: string; excerpt: string; content?: string } }) =>
      adminFetch(`/api/admin-panel/blog/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-blog-posts"] });
      setEditPost(null);
      setMsg("Degisiklikler kaydedildi.");
    },
    onError: (e) => setMsg(e instanceof Error && e.message ? `Kayit basarisiz: ${e.message}` : "Kayit basarisiz."),
  });

  const openEdit = async (post: BlogPost) => {
    setEditPost(post);
    setEditForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, content: "" });
    try {
      const full = await adminFetch(`/api/admin-panel/blog/${post.id}`) as { content: string };
      setEditForm(f => ({ ...f, content: full.content ?? "" }));
    } catch { setMsg("Icerik yuklenemedi."); }
  };

  async function handleGenerateCover(post: BlogPost) {
    setGeneratingIds(prev => new Set(prev).add(post.id));
    try {
      const r = await adminFetch(`/api/admin-panel/blog/${post.id}/generate-cover`, { method: "POST" }) as
        { backgroundOk: boolean; reason: string | null };
      qc.invalidateQueries({ queryKey: ["digest-blog-posts"] });
      setMsg(r.backgroundOk
        ? "Kapak gorseli uretildi ve kaydedildi."
        : `Baslikli kapak kaydedildi, ancak yapay zeka arka plani uretilemedi: ${r.reason}`);
    } catch (e) {
      setMsg(`Gorsel uretme basarisiz: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(post.id); return s; });
    }
  }

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin-panel/blog/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["digest-blog-posts"] }); setMsg("Yazi silindi."); },
    onError: () => setMsg("Silme basarisiz."),
  });

  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  async function openPreview(post: BlogPost) {
    try {
      const full = await adminFetch(`/api/admin-panel/blog/${post.id}`) as { title: string; content: string };
      setPreview({ title: full.title, content: full.content });
    } catch {
      setMsg("Onizleme acilamadi.");
    }
  }

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
          <button
            onClick={() => draftMut.mutate()}
            disabled={draftMut.isPending || draftRunning}
            className="text-xs px-3 py-1.5 rounded-full border bg-primary text-primary-foreground border-primary hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5">
            {draftMut.isPending || draftRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            {draftRunning ? "Üretiliyor…" : "Taslak üret"}
          </button>
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

      {draftStatus && draftStatus.state !== "idle" && (
        <div className={`p-3 rounded-lg border text-sm ${
          draftStatus.state === "error"
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
        }`}>
          {draftStatus.state === "running" && "Taslak üretiliyor, genellikle 2-3 dakika sürer. Sayfayı kapatabilirsiniz."}
          {draftStatus.state === "ok" && (
            <>
              Taslak hazır: <b>{draftStatus.title}</b>.{" "}
              {draftStatus.coverOk === false && "Kapak görseli yalnızca yazıyla üretildi (yapay zeka arka planı üretilemedi)."}
            </>
          )}
          {draftStatus.state === "error" && <>Taslak üretimi başarısız: {draftStatus.error}</>}
        </div>
      )}

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
              className="border border-border rounded-xl bg-card overflow-hidden">
              {post.coverImageBase64 && (
                <div className="relative">
                  <img
                    src={post.coverImageBase64}
                    alt="Kapak"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}
              <div className="p-4 space-y-3">
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
                  {post.status === "draft" ? (
                    <button onClick={() => openPreview(post)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                      Onizle
                    </button>
                  ) : (
                    <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                      Goruntule
                    </a>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`"${post.title}" kalici olarak silinsin mi? Bu islem geri alinamaz.`)) deleteMut.mutate(post.id); }}
                    disabled={deleteMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                    Sil
                  </button>
                  <a href={`/panel/blog`} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                    Tam Editor
                  </a>
                  <button
                    onClick={() => handleGenerateCover(post)}
                    disabled={generatingIds.has(post.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {generatingIds.has(post.id)
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Uretiliyor...</>
                      : post.coverImageBase64
                        ? <><Wand2 className="h-3 w-3" /> Gorseli Yenile</>
                        : <><ImageOff className="h-3 w-3" /> Gorsel Uret</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-foreground">{preview.title}</h3>
              <button onClick={() => setPreview(null)}
                className="text-muted-foreground hover:text-foreground text-xs border border-border rounded px-2 py-1">Kapat</button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: preview.content }} />
          </div>
        </div>
      )}

      {editPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
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
                <label className="text-xs font-medium text-muted-foreground block mb-1">Adres (slug): /blog/{editForm.slug}</label>
                <input
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.slug}
                  onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))}
                />
                {editPost.status === "published" && editForm.slug !== editPost.slug && (
                  <p className="text-[11px] text-amber-600 mt-1">Yayindaki yazinin adresi degisirse eski link calismaz.</p>
                )}
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
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Icerik {editPost.status === "published" && "- kaydedince yayindaki yazi yayindan kalkmadan guncellenir"}
                </label>
                <RichTextEditor value={editForm.content} onChange={html => setEditForm(f => ({ ...f, content: html }))} />
                <p className="text-[11px] text-muted-foreground mt-1">Duz metin yapistirirsaniz satirlar otomatik paragraf olur; baslik icin H2 dugmesini kullanin.</p>
              </div>
              <p className="text-xs text-muted-foreground">
                SEO ve sosyal medya alanlarini duzenlemek icin{" "}
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
                disabled={saveMut.isPending || !editForm.content}
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
