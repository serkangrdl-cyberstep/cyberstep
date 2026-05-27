import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Plus, Pencil, Trash2, Globe, EyeOff, Users, ArrowLeft, ImagePlus, X
} from "lucide-react";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

interface BlogPost {
  id: number;
  title: string;
  titleEn: string | null;
  slug: string;
  excerpt: string;
  excerptEn: string | null;
  content?: string;
  contentEn?: string | null;
  coverImageBase64: string | null;
  authorName: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

function ToolbarBtn({
  onClick, active, children, title,
}: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${active ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor, onImageInsert }: {
  editor: ReturnType<typeof useEditor>;
  onImageInsert: () => void;
}) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Kalin"><strong>B</strong></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italik"><em>I</em></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Alti cizili"><u>U</u></ToolbarBtn>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Baslik 2"><span className="font-bold">H2</span></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Baslik 3"><span className="font-bold">H3</span></ToolbarBtn>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Madde listesi">&#8226; Liste</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numarali liste">1. Liste</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Alinti">" "</ToolbarBtn>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Sola hizala">&#8676;</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Ortala">&#8677;</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Saga hizala">&#8678;</ToolbarBtn>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <ToolbarBtn
        onClick={() => {
          const url = window.prompt("Link URL:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
        title="Link ekle"
      >
        Link
      </ToolbarBtn>
      <ToolbarBtn onClick={onImageInsert} title="Gorsel ekle">
        <span className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" />Gorsel</span>
      </ToolbarBtn>
      <div className="w-px h-5 bg-slate-300 mx-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Geri al">&#8617;</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Yinele">&#8618;</ToolbarBtn>
    </div>
  );
}

function RichEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ImageExtension.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Icerik buraya..." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const handleImageFile = useCallback((file: File) => {
    if (!editor) return;
    if (file.size > 2 * 1024 * 1024) { alert("Gorsel boyutu 2MB'dan kucuk olmalidir"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <EditorToolbar editor={editor} onImageInsert={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
      />
      <EditorContent
        editor={editor}
        className="min-h-[400px] prose prose-sm max-w-none p-4 focus:outline-none [&_.ProseMirror]:min-h-[380px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child_::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child_::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child_::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child_::before]:pointer-events-none [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4"
      />
    </div>
  );
}

type PostSaveData = {
  title: string; excerpt: string; content: string;
  titleEn: string; excerptEn: string; contentEn: string;
  coverImageBase64: string | null; authorName: string;
};

function PostForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<BlogPost>;
  onSave: (data: PostSaveData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [langTab, setLangTab] = useState<"tr" | "en">("tr");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [excerptEn, setExcerptEn] = useState(initial?.excerptEn ?? "");
  const [contentEn, setContentEn] = useState(initial?.contentEn ?? "");
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "CyberStep.io");
  const [coverImageBase64, setCoverImageBase64] = useState<string | null>(initial?.coverImageBase64 ?? null);
  const coverRef = useRef<HTMLInputElement>(null);

  const handleCoverImage = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert("Kapak gorseli 2MB'dan kucuk olmalidir"); return; }
    const reader = new FileReader();
    reader.onload = e => setCoverImageBase64(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
        <h2 className="text-lg font-semibold text-white">{initial?.id ? "Yaziyi Duzenle" : "Yeni Yazi"}</h2>
      </div>

      {/* Sidebar fields — shared */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          {/* Language tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setLangTab("tr")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${langTab === "tr" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Turkce (TR)
            </button>
            <button
              type="button"
              onClick={() => setLangTab("en")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${langTab === "en" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"}`}
            >
              English (EN)
            </button>
          </div>

          {langTab === "tr" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Baslik (TR) *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Turkce blog yazisi basligi" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ozet (TR) *</label>
                <Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Kisa Turkce ozet" rows={3} className="bg-slate-800 border-slate-700 text-white resize-none" />
              </div>
            </div>
          )}

          {langTab === "en" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title (EN) <span className="text-slate-500">isteğe bağlı</span></label>
                <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} placeholder="English blog post title" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Excerpt (EN) <span className="text-slate-500">isteğe bağlı</span></label>
                <Textarea value={excerptEn} onChange={e => setExcerptEn(e.target.value)} placeholder="Short English excerpt" rows={3} className="bg-slate-800 border-slate-700 text-white resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Yazar</label>
            <Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Yazar adi" className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Kapak Gorseli</label>
            {coverImageBase64 ? (
              <div className="relative">
                <img src={coverImageBase64} alt="Kapak" className="w-full h-32 object-cover rounded-lg" />
                <button onClick={() => setCoverImageBase64(null)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs">Gorsel yukle</span>
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverImage(f); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      {/* Content editor — per language */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {langTab === "tr" ? "Icerik (TR) *" : "Content (EN)"} {langTab === "en" && <span className="text-slate-500">isteğe bağlı</span>}
        </label>
        <div className="bg-white rounded-lg">
          {langTab === "tr" ? (
            <RichEditor key="tr" value={content} onChange={setContent} placeholder="Turkce icerik..." />
          ) : (
            <RichEditor key="en" value={contentEn} onChange={setContentEn} placeholder="English content..." />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} className="border-slate-600 text-slate-300 hover:bg-slate-700">Iptal</Button>
        <Button
          onClick={() => onSave({ title, excerpt, content, titleEn, excerptEn, contentEn, coverImageBase64, authorName })}
          disabled={isSaving || !title || !excerpt || !content}
          className="bg-emerald-500 hover:bg-emerald-400 text-white"
        >
          {isSaving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminBlog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["admin-blog"],
    queryFn: () => fetch("/api/admin-panel/blog", { credentials: "include" }).then(r => r.json()),
  });

  const { data: editPost } = useQuery<BlogPost>({
    queryKey: ["admin-blog-post", editingId],
    queryFn: () => fetch(`/api/admin-panel/blog/${editingId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!editingId && view === "edit",
  });

  const { data: subscribers } = useQuery<{ id: number; email: string; isActive: boolean }[]>({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: () => fetch("/api/admin-panel/newsletter/subscribers", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); };

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch("/api/admin-panel/blog", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi olusturuldu" }); invalidate(); setView("list"); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`/api/admin-panel/blog/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi guncellendi" }); invalidate(); setView("list"); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/blog/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi silindi" }); invalidate(); },
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/blog/${id}/publish`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi yayinlandi", description: "Abonelere e-posta gonderiliyor" }); invalidate(); },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/blog/${id}/unpublish`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi taslaga alindi" }); invalidate(); },
  });

  const activeSubscribers = subscribers?.filter(s => s.isActive).length ?? 0;

  if (view === "new") {
    return (
      <AdminLayout title="Yeni Blog Yazisi">
        <PostForm
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setView("list")}
          isSaving={createMutation.isPending}
        />
      </AdminLayout>
    );
  }

  if (view === "edit" && editingId) {
    return (
      <AdminLayout title="Yaziyi Duzenle">
        {editPost ? (
          <PostForm
            initial={editPost}
            onSave={data => updateMutation.mutate({ id: editingId, data })}
            onCancel={() => { setView("list"); setEditingId(null); }}
            isSaving={updateMutation.isPending}
          />
        ) : (
          <div className="text-slate-400">Yukleniyor...</div>
        )}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Blog Yonetimi" description="Yazi olustur, yayinla ve abone istatistiklerini gorun">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Toplam Yazi</div>
            <div className="text-2xl font-bold text-white">{posts?.length ?? 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Yayinda</div>
            <div className="text-2xl font-bold text-emerald-400">{posts?.filter(p => p.status === "published").length ?? 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 flex items-start justify-between">
            <div>
              <div className="text-slate-400 text-sm mb-1">Aktif Abone</div>
              <div className="text-2xl font-bold text-white">{activeSubscribers}</div>
            </div>
            <Users className="h-5 w-5 text-slate-500 mt-1" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setView("new")} className="bg-emerald-500 hover:bg-emerald-400 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Yazi
          </Button>
        </div>

        {isLoading && <div className="text-slate-400">Yukleniyor...</div>}
        {!isLoading && posts?.length === 0 && (
          <div className="text-center py-16 text-slate-500">Henuz yazi yok. Ilk yazinizi olusturun.</div>
        )}
        <div className="space-y-3">
          {posts?.map(post => (
            <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-4">
              {post.coverImageBase64 && (
                <img src={post.coverImageBase64} alt="" className="w-16 h-12 object-cover rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white truncate">{post.title}</span>
                  {post.titleEn && (
                    <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs">EN</Badge>
                  )}
                  <Badge variant={post.status === "published" ? "default" : "secondary"} className={post.status === "published" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400"}>
                    {post.status === "published" ? "Yayinda" : "Taslak"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-sm truncate">{post.excerpt}</p>
                {post.publishedAt && (
                  <p className="text-slate-500 text-xs mt-1">{format(new Date(post.publishedAt), "d MMMM yyyy", { locale: tr })}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {post.status === "published" ? (
                  <Button size="sm" variant="outline" onClick={() => unpublishMutation.mutate(post.id)} className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs">
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                    Taslaga Al
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => publishMutation.mutate(post.id)} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs">
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    Yayinla
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditingId(post.id); setView("edit"); }} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (confirm("Bu yaziyi silmek istiyor musunuz?")) deleteMutation.mutate(post.id); }} className="border-red-800 text-red-400 hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
