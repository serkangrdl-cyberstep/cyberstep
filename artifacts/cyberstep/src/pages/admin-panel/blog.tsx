import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Plus, Pencil, Trash2, Globe, EyeOff, Users, ArrowLeft, ImagePlus, X,
  Bot, Play, ChevronRight, CalendarCheck2, Zap,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarouselSlide { slide: number; text: string; }
interface VisualPrompts { blog: string; linkedin: string; instagram: string; x: string; }
interface BlogRef { title: string; url: string; }

interface BlogPost {
  id: number;
  title: string; titleEn: string | null;
  slug: string;
  excerpt: string; excerptEn: string | null;
  content?: string; contentEn?: string | null;
  socialTextTr?: string | null; socialTextEn?: string | null;
  linkedinPostTr?: string | null; linkedinPostEn?: string | null;
  seoTitle?: string | null; seoTitleEn?: string | null;
  metaDescription?: string | null; metaDescriptionEn?: string | null;
  focusKeyword?: string | null; focusKeywordEn?: string | null;
  seoTags?: string[] | null; seoTagsEn?: string[] | null;
  instagramCarouselTr?: CarouselSlide[] | null;
  instagramCarouselEn?: CarouselSlide[] | null;
  instagramCaptionTr?: string | null; instagramCaptionEn?: string | null;
  visualPromptsTr?: VisualPrompts | null;
  visualPromptsEn?: VisualPrompts | null;
  refsJson?: BlogRef[] | null;
  coverImageBase64: string | null;
  authorName: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

type PostSaveData = {
  title: string; excerpt: string; content: string;
  titleEn: string; excerptEn: string; contentEn: string;
  seoTitle: string; seoTitleEn: string;
  metaDescription: string; metaDescriptionEn: string;
  focusKeyword: string; focusKeywordEn: string;
  seoTags: string[]; seoTagsEn: string[];
  socialTextTr: string; socialTextEn: string;
  linkedinPostTr: string; linkedinPostEn: string;
  instagramCarouselTr: CarouselSlide[]; instagramCarouselEn: CarouselSlide[];
  instagramCaptionTr: string; instagramCaptionEn: string;
  visualPromptsTr: VisualPrompts; visualPromptsEn: VisualPrompts;
  refsJson: BlogRef[];
  coverImageBase64: string | null; authorName: string;
};

// ─── Tiptap editor components ─────────────────────────────────────────────────

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
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
      <EditorContent
        editor={editor}
        className="min-h-[400px] prose prose-sm max-w-none p-4 focus:outline-none [&_.ProseMirror]:min-h-[380px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child_::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child_::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child_::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child_::before]:pointer-events-none [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4"
      />
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function LangTabBar({ active, onChange }: { active: "tr" | "en"; onChange: (l: "tr" | "en") => void }) {
  return (
    <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit mb-4">
      <button type="button" onClick={() => onChange("tr")}
        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${active === "tr" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"}`}>
        Turkce (TR)
      </button>
      <button type="button" onClick={() => onChange("en")}
        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${active === "en" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"}`}>
        English (EN)
      </button>
    </div>
  );
}

type SectionTab = "icerik" | "seo" | "sosyal";

function SectionTabBar({ active, onChange }: { active: SectionTab; onChange: (s: SectionTab) => void }) {
  const tabs: { key: SectionTab; label: string }[] = [
    { key: "icerik", label: "Icerik" },
    { key: "seo", label: "SEO" },
    { key: "sosyal", label: "Sosyal Medya" },
  ];
  return (
    <div className="flex gap-0 border-b border-slate-700 mb-5">
      {tabs.map(t => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${active === t.key ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function CharCounter({ value, max, min }: { value: string; max: number; min?: number }) {
  const len = value.length;
  const over = len > max;
  const under = min !== undefined && len > 0 && len < min;
  return (
    <span className={`text-xs tabular-nums ${over ? "text-red-400" : under ? "text-amber-400" : "text-slate-500"}`}>
      {len}/{max}{min !== undefined ? ` (min ${min})` : ""}
    </span>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1">
      {children}
      {hint && <span className="text-slate-500 font-normal ml-1.5">{hint}</span>}
    </label>
  );
}

// ─── Carousel editor ──────────────────────────────────────────────────────────

function CarouselEditor({ slides, onChange }: { slides: CarouselSlide[]; onChange: (s: CarouselSlide[]) => void }) {
  const add = () => {
    if (slides.length >= 8) return;
    onChange([...slides, { slide: slides.length + 1, text: "" }]);
  };
  const remove = (i: number) => {
    onChange(slides.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slide: idx + 1 })));
  };
  const update = (i: number, text: string) => {
    onChange(slides.map((s, idx) => idx === i ? { ...s, text } : s));
  };
  return (
    <div className="space-y-2">
      {slides.length === 0 && (
        <p className="text-slate-500 text-xs">Henuz slayt yok. 6–8 slayt onerilir.</p>
      )}
      {slides.map((s, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-xs text-slate-500 mt-2.5 w-6 shrink-0 font-mono">S{s.slide}</span>
          <Textarea value={s.text} onChange={e => update(i, e.target.value)}
            placeholder={`Slayt ${s.slide} — kisa ve net metin...`}
            rows={2} className="bg-slate-800 border-slate-700 text-white text-sm resize-none flex-1" />
          <button type="button" onClick={() => remove(i)} className="mt-2 text-slate-500 hover:text-red-400 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={slides.length >= 8}
        className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs h-7">
        + Slayt Ekle{slides.length > 0 ? ` (${slides.length}/8)` : ""}
      </Button>
    </div>
  );
}

// ─── References editor ────────────────────────────────────────────────────────

function RefsEditor({ refs, onChange }: { refs: BlogRef[]; onChange: (r: BlogRef[]) => void }) {
  const add = () => {
    if (refs.length >= 5) return;
    onChange([...refs, { title: "", url: "" }]);
  };
  const remove = (i: number) => onChange(refs.filter((_, idx) => idx !== i));
  const update = (i: number, field: "title" | "url", value: string) => {
    onChange(refs.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };
  return (
    <div className="space-y-2">
      {refs.length === 0 && <p className="text-slate-500 text-xs">Max 5 kaynak. Eklenmezse bolum gorunmez.</p>}
      {refs.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={r.title} onChange={e => update(i, "title", e.target.value)}
            placeholder="Kaynak adi (orn: ENISA Threat Landscape 2024)"
            className="bg-slate-800 border-slate-700 text-white text-sm flex-1" />
          <Input value={r.url} onChange={e => update(i, "url", e.target.value)}
            placeholder="https://..."
            className="bg-slate-800 border-slate-700 text-white text-sm flex-1" />
          <button type="button" onClick={() => remove(i)}
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={refs.length >= 5}
        className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs h-7">
        + Kaynak Ekle{refs.length > 0 ? ` (${refs.length}/5)` : ""}
      </Button>
    </div>
  );
}

// ─── PostForm ─────────────────────────────────────────────────────────────────

function PostForm({
  initial, onSave, onCancel, isSaving,
}: {
  initial?: Partial<BlogPost>;
  onSave: (data: PostSaveData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [sectionTab, setSectionTab] = useState<SectionTab>("icerik");
  const [langTab, setLangTab] = useState<"tr" | "en">("tr");

  // Icerik
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [excerptEn, setExcerptEn] = useState(initial?.excerptEn ?? "");
  const [contentEn, setContentEn] = useState(initial?.contentEn ?? "");

  // SEO TR
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(initial?.metaDescription ?? "");
  const [focusKw, setFocusKw] = useState(initial?.focusKeyword ?? "");
  const [seoTagsStr, setSeoTagsStr] = useState((initial?.seoTags ?? []).join(", "));
  // SEO EN
  const [seoTitleEn, setSeoTitleEn] = useState(initial?.seoTitleEn ?? "");
  const [metaDescEn, setMetaDescEn] = useState(initial?.metaDescriptionEn ?? "");
  const [focusKwEn, setFocusKwEn] = useState(initial?.focusKeywordEn ?? "");
  const [seoTagsStrEn, setSeoTagsStrEn] = useState((initial?.seoTagsEn ?? []).join(", "));

  // Sosyal TR
  const [linkedinTr, setLinkedinTr] = useState(initial?.linkedinPostTr ?? "");
  const [xPostTr, setXPostTr] = useState(initial?.socialTextTr ?? "");
  const [carouselTr, setCarouselTr] = useState<CarouselSlide[]>(initial?.instagramCarouselTr ?? []);
  const [captionTr, setCaptionTr] = useState(initial?.instagramCaptionTr ?? "");
  const [vpBlogTr, setVpBlogTr] = useState(initial?.visualPromptsTr?.blog ?? "");
  const [vpLinkedinTr, setVpLinkedinTr] = useState(initial?.visualPromptsTr?.linkedin ?? "");
  const [vpInstTr, setVpInstTr] = useState(initial?.visualPromptsTr?.instagram ?? "");
  const [vpXTr, setVpXTr] = useState(initial?.visualPromptsTr?.x ?? "");
  // Sosyal EN
  const [linkedinEn, setLinkedinEn] = useState(initial?.linkedinPostEn ?? "");
  const [xPostEn, setXPostEn] = useState(initial?.socialTextEn ?? "");
  const [carouselEn, setCarouselEn] = useState<CarouselSlide[]>(initial?.instagramCarouselEn ?? []);
  const [captionEn, setCaptionEn] = useState(initial?.instagramCaptionEn ?? "");
  const [vpBlogEn, setVpBlogEn] = useState(initial?.visualPromptsEn?.blog ?? "");
  const [vpLinkedinEn, setVpLinkedinEn] = useState(initial?.visualPromptsEn?.linkedin ?? "");
  const [vpInstEn, setVpInstEn] = useState(initial?.visualPromptsEn?.instagram ?? "");
  const [vpXEn, setVpXEn] = useState(initial?.visualPromptsEn?.x ?? "");

  // Shared
  const [refs, setRefs] = useState<BlogRef[]>(initial?.refsJson ?? []);

  // Meta
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "CyberStep.io");
  const [coverImageBase64, setCoverImageBase64] = useState<string | null>(initial?.coverImageBase64 ?? null);
  const coverRef = useRef<HTMLInputElement>(null);

  const handleCoverImage = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert("Kapak gorseli 2MB'dan kucuk olmalidir"); return; }
    const reader = new FileReader();
    reader.onload = e => setCoverImageBase64(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave({
      title, excerpt, content,
      titleEn, excerptEn, contentEn,
      seoTitle, seoTitleEn,
      metaDescription: metaDesc, metaDescriptionEn: metaDescEn,
      focusKeyword: focusKw, focusKeywordEn: focusKwEn,
      seoTags: seoTagsStr.split(",").map(t => t.trim()).filter(Boolean),
      seoTagsEn: seoTagsStrEn.split(",").map(t => t.trim()).filter(Boolean),
      socialTextTr: xPostTr, socialTextEn: xPostEn,
      linkedinPostTr: linkedinTr, linkedinPostEn: linkedinEn,
      instagramCarouselTr: carouselTr, instagramCarouselEn: carouselEn,
      instagramCaptionTr: captionTr, instagramCaptionEn: captionEn,
      visualPromptsTr: { blog: vpBlogTr, linkedin: vpLinkedinTr, instagram: vpInstTr, x: vpXTr },
      visualPromptsEn: { blog: vpBlogEn, linkedin: vpLinkedinEn, instagram: vpInstEn, x: vpXEn },
      refsJson: refs,
      coverImageBase64,
      authorName,
    });
  };

  // Completion indicators
  const seoComplete = langTab === "tr"
    ? [seoTitle, metaDesc, focusKw, seoTagsStr].filter(Boolean).length
    : [seoTitleEn, metaDescEn, focusKwEn, seoTagsStrEn].filter(Boolean).length;

  const sosyalComplete = langTab === "tr"
    ? [linkedinTr, xPostTr, captionTr].filter(Boolean).length + (carouselTr.length > 0 ? 1 : 0)
    : [linkedinEn, xPostEn, captionEn].filter(Boolean).length + (carouselEn.length > 0 ? 1 : 0);

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4 mr-1" />Geri
        </Button>
        <h2 className="text-lg font-semibold text-white">{initial?.id ? "Yaziyi Duzenle" : "Yeni Yazi"}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="space-y-4 md:col-span-1">
          <div>
            <FieldLabel>Yazar</FieldLabel>
            <Input value={authorName} onChange={e => setAuthorName(e.target.value)}
              placeholder="Yazar adi" className="bg-slate-800 border-slate-700 text-white text-sm" />
          </div>
          <div>
            <FieldLabel>Kapak Gorseli</FieldLabel>
            {coverImageBase64 ? (
              <div className="relative">
                <img src={coverImageBase64} alt="Kapak" className="w-full h-28 object-cover rounded-lg" />
                <button onClick={() => setCoverImageBase64(null)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => coverRef.current?.click()}
                className="w-full h-28 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Gorsel yukle (max 2MB)</span>
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverImage(f); e.target.value = ""; }} />
          </div>
          {initial?.slug && (
            <div>
              <FieldLabel>URL Slug</FieldLabel>
              <p className="text-xs text-emerald-400 font-mono break-all bg-slate-800 rounded px-2 py-1.5">/blog/{initial.slug}</p>
            </div>
          )}
          {/* Progress indicators */}
          <div className="space-y-1.5 pt-1">
            {[
              { key: "icerik", label: "Icerik", done: !!(title && excerpt && content) },
              { key: "seo", label: "SEO", done: seoComplete >= 3 },
              { key: "sosyal", label: "Sosyal Medya", done: sosyalComplete >= 3 },
            ].map(({ key, label, done }) => (
              <button key={key} type="button" onClick={() => setSectionTab(key as SectionTab)}
                className="w-full flex items-center gap-2 text-left text-xs text-slate-400 hover:text-white transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-400" : "bg-slate-600"}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="md:col-span-3">
          <SectionTabBar active={sectionTab} onChange={setSectionTab} />

          {/* ── ICERIK ── */}
          {sectionTab === "icerik" && (
            <div className="space-y-4">
              <LangTabBar active={langTab} onChange={setLangTab} />

              {langTab === "tr" ? (
                <>
                  <div>
                    <FieldLabel>Baslik (TR) *</FieldLabel>
                    <Input value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="Turkce blog yazisi basligi"
                      className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <FieldLabel>Ozet (TR) *</FieldLabel>
                    <Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)}
                      rows={3} placeholder="Kart ve liste goruntusunde gorunecek kisa ozet"
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <FieldLabel hint="— istege bagli">Title (EN)</FieldLabel>
                    <Input value={titleEn} onChange={e => setTitleEn(e.target.value)}
                      placeholder="English blog post title"
                      className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <FieldLabel hint="— istege bagli">Excerpt (EN)</FieldLabel>
                    <Textarea value={excerptEn} onChange={e => setExcerptEn(e.target.value)}
                      rows={3} placeholder="Short English excerpt for card display"
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {langTab === "tr" ? "Icerik (TR) *" : "Content (EN)"}
                  {langTab === "en" && <span className="text-slate-500 font-normal ml-1.5">— istege bagli</span>}
                </label>
                <div className="bg-white rounded-lg">
                  {langTab === "tr"
                    ? <RichEditor key="tr" value={content} onChange={setContent} placeholder="Turkce icerik..." />
                    : <RichEditor key="en" value={contentEn} onChange={setContentEn} placeholder="English content..." />}
                </div>
              </div>
            </div>
          )}

          {/* ── SEO ── */}
          {sectionTab === "seo" && (
            <div className="space-y-4">
              <LangTabBar active={langTab} onChange={setLangTab} />

              {langTab === "tr" ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>SEO Baslik (TR)</FieldLabel>
                      <CharCounter value={seoTitle} max={60} />
                    </div>
                    <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
                      placeholder="Google arama sonucundaki baslik (max 60 karakter)"
                      className="bg-slate-800 border-slate-700 text-white" />
                    <p className="text-xs text-slate-500 mt-1">Bos birakilirsa blog basligi kullanilir.</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>Meta Aciklama (TR)</FieldLabel>
                      <CharCounter value={metaDesc} max={160} />
                    </div>
                    <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)}
                      rows={3} placeholder="Google'da snippet olarak gorunen aciklama (max 160 karakter)"
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  <div>
                    <FieldLabel>Odak Anahtar Kelime (TR)</FieldLabel>
                    <Input value={focusKw} onChange={e => setFocusKw(e.target.value)}
                      placeholder="orn: kobi siber guvenlik"
                      className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <FieldLabel hint="— virgülle ayrılmış, max 5">SEO Etiketleri (TR)</FieldLabel>
                    <Input value={seoTagsStr} onChange={e => setSeoTagsStr(e.target.value)}
                      placeholder="siber guvenlik, kobi, fidye yazilimi, veri sicakligi, risk"
                      className="bg-slate-800 border-slate-700 text-white" />
                    {seoTagsStr && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {seoTagsStr.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-emerald-900/40 text-emerald-300 text-xs rounded-full border border-emerald-700/40">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>SEO Title (EN)</FieldLabel>
                      <CharCounter value={seoTitleEn} max={60} />
                    </div>
                    <Input value={seoTitleEn} onChange={e => setSeoTitleEn(e.target.value)}
                      placeholder="Google search result title in English (max 60 chars)"
                      className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>Meta Description (EN)</FieldLabel>
                      <CharCounter value={metaDescEn} max={160} />
                    </div>
                    <Textarea value={metaDescEn} onChange={e => setMetaDescEn(e.target.value)}
                      rows={3} placeholder="English meta description for Google (max 160 chars)"
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  <div>
                    <FieldLabel>Focus Keyword (EN)</FieldLabel>
                    <Input value={focusKwEn} onChange={e => setFocusKwEn(e.target.value)}
                      placeholder="e.g. smb cybersecurity"
                      className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div>
                    <FieldLabel hint="— comma-separated, max 5">SEO Tags (EN)</FieldLabel>
                    <Input value={seoTagsStrEn} onChange={e => setSeoTagsStrEn(e.target.value)}
                      placeholder="cybersecurity, smb, ransomware, data breach, risk assessment"
                      className="bg-slate-800 border-slate-700 text-white" />
                    {seoTagsStrEn && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {seoTagsStrEn.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded-full border border-blue-700/40">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── SOSYAL MEDYA ── */}
          {sectionTab === "sosyal" && (
            <div className="space-y-5">
              <LangTabBar active={langTab} onChange={setLangTab} />

              {langTab === "tr" ? (
                <div className="space-y-5">
                  {/* LinkedIn TR */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>LinkedIn Post (TR)</FieldLabel>
                      <CharCounter value={linkedinTr} max={1200} min={600} />
                    </div>
                    <Textarea value={linkedinTr} onChange={e => setLinkedinTr(e.target.value)}
                      rows={7} placeholder="Profesyonel LinkedIn paylasim metni (600–1200 karakter). Ilk 2 satir dikkat cekici olmali..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* X TR */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>X (Twitter) Post (TR)</FieldLabel>
                      <CharCounter value={xPostTr} max={280} />
                    </div>
                    <Textarea value={xPostTr} onChange={e => setXPostTr(e.target.value)}
                      rows={3} placeholder="Kisa ve vurucu X paylasiimi (max 280 karakter)..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* Instagram Carousel TR */}
                  <div>
                    <FieldLabel hint="— 6–8 slayt onerilir">Instagram Carousel (TR)</FieldLabel>
                    <CarouselEditor slides={carouselTr} onChange={setCarouselTr} />
                  </div>
                  {/* Instagram Caption TR */}
                  <div>
                    <FieldLabel>Instagram Caption (TR)</FieldLabel>
                    <Textarea value={captionTr} onChange={e => setCaptionTr(e.target.value)}
                      rows={4} placeholder="Instagram gonderisi altindaki aciklama metni ve hashtag'ler..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* Visual Prompts TR */}
                  <div>
                    <FieldLabel hint="— AI görsel üretim için">Gorsel Promptlari (TR)</FieldLabel>
                    <div className="space-y-3 mt-1">
                      {([
                        { label: "Blog Kapak Gorseli", val: vpBlogTr, set: setVpBlogTr },
                        { label: "LinkedIn Gorseli", val: vpLinkedinTr, set: setVpLinkedinTr },
                        { label: "Instagram Carousel Gorseli", val: vpInstTr, set: setVpInstTr },
                        { label: "X (Twitter) Gorseli", val: vpXTr, set: setVpXTr },
                      ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                        <div key={label}>
                          <p className="text-xs text-slate-400 mb-1">{label}</p>
                          <Textarea value={val} onChange={e => set(e.target.value)}
                            rows={2} placeholder="Midjourney / DALL-E / Firefly prompt..."
                            className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* LinkedIn EN */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>LinkedIn Post (EN)</FieldLabel>
                      <CharCounter value={linkedinEn} max={1200} min={600} />
                    </div>
                    <Textarea value={linkedinEn} onChange={e => setLinkedinEn(e.target.value)}
                      rows={7} placeholder="Professional LinkedIn post (600–1200 chars). First 2 lines should hook the reader..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* X EN */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>X (Twitter) Post (EN)</FieldLabel>
                      <CharCounter value={xPostEn} max={280} />
                    </div>
                    <Textarea value={xPostEn} onChange={e => setXPostEn(e.target.value)}
                      rows={3} placeholder="Short punchy X post (max 280 chars)..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* Instagram Carousel EN */}
                  <div>
                    <FieldLabel hint="— 6–8 slides recommended">Instagram Carousel (EN)</FieldLabel>
                    <CarouselEditor slides={carouselEn} onChange={setCarouselEn} />
                  </div>
                  {/* Instagram Caption EN */}
                  <div>
                    <FieldLabel>Instagram Caption (EN)</FieldLabel>
                    <Textarea value={captionEn} onChange={e => setCaptionEn(e.target.value)}
                      rows={4} placeholder="Instagram post caption and hashtags..."
                      className="bg-slate-800 border-slate-700 text-white resize-none" />
                  </div>
                  {/* Visual Prompts EN */}
                  <div>
                    <FieldLabel hint="— for AI image generation">Visual Prompts (EN)</FieldLabel>
                    <div className="space-y-3 mt-1">
                      {([
                        { label: "Blog Cover Image", val: vpBlogEn, set: setVpBlogEn },
                        { label: "LinkedIn Image", val: vpLinkedinEn, set: setVpLinkedinEn },
                        { label: "Instagram Carousel Image", val: vpInstEn, set: setVpInstEn },
                        { label: "X (Twitter) Image", val: vpXEn, set: setVpXEn },
                      ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                        <div key={label}>
                          <p className="text-xs text-slate-400 mb-1">{label}</p>
                          <Textarea value={val} onChange={e => set(e.target.value)}
                            rows={2} placeholder="Midjourney / DALL-E / Firefly prompt..."
                            className="bg-slate-800 border-slate-700 text-white text-sm resize-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Referanslar — shared */}
              <div className="pt-5 border-t border-slate-700">
                <FieldLabel hint="— TR ve EN icin ortak, max 5">Kaynaklar / References</FieldLabel>
                <RefsEditor refs={refs} onChange={setRefs} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
        <Button variant="outline" onClick={onCancel} className="border-slate-600 text-slate-300 hover:bg-slate-700">
          Iptal
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !title || !excerpt || !content}
          className="bg-emerald-500 hover:bg-emerald-400 text-white"
        >
          {isSaving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}

// ─── AdminBlog main view ──────────────────────────────────────────────────────

export default function AdminBlog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: admin } = useRequireAdmin();

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/blog", { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
    enabled: !!admin,
  });

  const { data: editPost } = useQuery<BlogPost>({
    queryKey: ["admin-blog-post", editingId],
    queryFn: async () => {
      const r = await fetch(`/api/admin-panel/blog/${editingId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
    enabled: !!editingId && view === "edit" && !!admin,
  });

  const { data: subscribers } = useQuery<{ id: number; email: string; isActive: boolean }[]>({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/newsletter/subscribers", { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
    enabled: !!admin,
  });

  interface AutopilotStatus {
    totalPlanned: number;
    currentIndex: number;
    completedCount: number;
    weeksCompleted: number;
    nextTopic: { index: number; category: string; categoryCode: string; title: string };
    lastPublished: { id: number; title: string; publishedAt: string } | null;
  }

  const { data: autopilot, refetch: refetchAutopilot } = useQuery<AutopilotStatus>({
    queryKey: ["blog-autopilot-status"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/blog-autopilot/status", { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
    enabled: !!admin,
    refetchInterval: 30000,
  });

  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [draftRunning, setDraftRunning] = useState(false);

  const runAutopilotNow = async () => {
    if (autopilotRunning) return;
    if (!confirm("Claude ile hemen yeni bir blog yazisi uretilsin mi? Bu islem 1-2 dakika surebilir.")) return;
    setAutopilotRunning(true);
    try {
      const r = await fetch("/api/admin-panel/blog-autopilot/run-now", { method: "POST", credentials: "include" });
      const data = await r.json() as { success?: boolean };
      if (data.success) {
        toast({ title: "Blog yazisi uretiliyor", description: "Yaklasik 1-2 dakika icinde yayinlanacak" });
        setTimeout(() => { void invalidate(); void refetchAutopilot(); setAutopilotRunning(false); }, 90000);
      }
    } catch {
      toast({ title: "Hata", variant: "destructive" });
      setAutopilotRunning(false);
    }
  };

  const generateDraftNow = async () => {
    if (draftRunning) return;
    if (!confirm("Siradaki yazi TASLAK olarak uretilsin mi? Yayin oncesi inceleyebilirsiniz.")) return;
    setDraftRunning(true);
    try {
      const r = await fetch("/api/admin-panel/blog-autopilot/generate-draft", { method: "POST", credentials: "include" });
      const data = await r.json() as { success?: boolean };
      if (data.success) {
        toast({ title: "Taslak uretiliyor", description: "1-2 dakika icinde Taslak listesinde gorunecek" });
        setTimeout(() => { void invalidate(); void refetchAutopilot(); setDraftRunning(false); }, 90000);
      }
    } catch {
      toast({ title: "Hata", variant: "destructive" });
      setDraftRunning(false);
    }
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-blog"] });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch("/api/admin-panel/blog", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi olusturuldu" }); invalidate(); setView("list"); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`/api/admin-panel/blog/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Yazi guncellendi" }); invalidate(); setView("list"); setEditingId(null); },
    onError: () => toast({ title: "Guncelleme hatasi", variant: "destructive" }),
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
          <div className="text-slate-400 py-8 text-center">Yukleniyor...</div>
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

        {/* Blog Autopilot Paneli */}
        <div className="bg-slate-800 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-400" />
              <span className="font-semibold text-white">Blog Autopilot</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-2 py-0.5">
                Claude ile
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />
                Paz + Per 09:00
              </div>
              <button
                onClick={() => void generateDraftNow()}
                disabled={draftRunning || autopilotRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {draftRunning ? (
                  <><Zap className="h-3.5 w-3.5 animate-pulse" />Taslak uretiliyor...</>
                ) : (
                  <><EyeOff className="h-3.5 w-3.5" />Taslak Uret</>
                )}
              </button>
              <button
                onClick={() => void runAutopilotNow()}
                disabled={autopilotRunning || draftRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {autopilotRunning ? (
                  <><Zap className="h-3.5 w-3.5 animate-pulse" />Uretiliyor...</>
                ) : (
                  <><Play className="h-3.5 w-3.5" />Simdi Uret</>
                )}
              </button>
            </div>
          </div>

          {autopilot ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((autopilot.completedCount / autopilot.totalPlanned) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {autopilot.completedCount}/{autopilot.totalPlanned}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-700/60 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">Tamamlanan Hafta</div>
                    <div className="text-lg font-bold text-white">{autopilot.weeksCompleted}<span className="text-slate-500 text-sm font-normal">/52</span></div>
                  </div>
                  <div className="bg-slate-700/60 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">Plan Dolulugu</div>
                    <div className="text-lg font-bold text-emerald-400">
                      %{Math.round((autopilot.completedCount / autopilot.totalPlanned) * 100)}
                    </div>
                  </div>
                </div>
                {autopilot.lastPublished && (
                  <div className="mt-3 text-xs text-slate-500">
                    Son: <span className="text-slate-300">{autopilot.lastPublished.title}</span>
                    {" "}· {format(new Date(autopilot.lastPublished.publishedAt), "d MMM yyyy", { locale: tr })}
                  </div>
                )}
              </div>
              <div className="bg-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 text-xs mb-2">Siradaki Yazi</div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    autopilot.nextTopic.categoryCode === "FA" ? "bg-orange-500/20 text-orange-400" :
                    autopilot.nextTopic.categoryCode === "DU" ? "bg-red-500/20 text-red-400" :
                    autopilot.nextTopic.categoryCode === "SE" ? "bg-blue-500/20 text-blue-400" :
                    autopilot.nextTopic.categoryCode === "CO" ? "bg-purple-500/20 text-purple-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  }`}>{autopilot.nextTopic.categoryCode}</span>
                  <span className="text-xs text-slate-400 truncate">{autopilot.nextTopic.category}</span>
                </div>
                <div className="text-sm text-white font-medium leading-snug mb-2">
                  {autopilot.nextTopic.title}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <ChevronRight className="h-3 w-3" />
                  Yazi {autopilot.nextTopic.index + 1}/{autopilot.totalPlanned}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-3">Yukleniyor...</div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setView("new")} className="bg-emerald-500 hover:bg-emerald-400 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Yazi
          </Button>
        </div>

        {isLoading && <div className="text-slate-400 text-center py-8">Yukleniyor...</div>}
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-white truncate">{post.title}</span>
                  {post.titleEn && (
                    <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs shrink-0">EN</Badge>
                  )}
                  <Badge variant={post.status === "published" ? "default" : "secondary"}
                    className={post.status === "published"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0"
                      : "bg-slate-700 text-slate-400 shrink-0"}>
                    {post.status === "published" ? "Yayinda" : "Taslak"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-sm truncate">{post.excerpt}</p>
                {post.publishedAt && (
                  <p className="text-slate-500 text-xs mt-0.5">
                    {format(new Date(post.publishedAt), "d MMMM yyyy", { locale: tr })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {post.status === "published" ? (
                  <Button size="sm" variant="outline" onClick={() => unpublishMutation.mutate(post.id)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs">
                    <EyeOff className="h-3.5 w-3.5 mr-1" />Taslaga Al
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => publishMutation.mutate(post.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs">
                    <Globe className="h-3.5 w-3.5 mr-1" />Yayinla
                  </Button>
                )}
                <Button size="sm" variant="outline"
                  onClick={() => { setEditingId(post.id); setView("edit"); }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { if (confirm("Bu yaziyi silmek istiyor musunuz?")) deleteMutation.mutate(post.id); }}
                  className="border-red-800 text-red-400 hover:bg-red-900/20">
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
