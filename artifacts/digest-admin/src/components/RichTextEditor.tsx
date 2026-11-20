import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

function Btn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-xs transition-colors ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // İçerik sunucudan sonradan yüklenince editöre aktar (kullanıcı yazarken dokunma).
  useEffect(() => {
    if (editor && value && editor.isEmpty) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/50">
        <Btn title="Kalin" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title="Italik" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="Baslik 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn title="Baslik 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Btn title="Paragraf" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>Paragraf</Btn>
        <Btn title="Madde listesi" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Liste</Btn>
        <Btn title="Numarali liste" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Liste</Btn>
        <Btn title="Link" active={editor.isActive("link")} onClick={() => {
          const url = window.prompt("Link URL:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}>Link</Btn>
        <Btn title="Geri al" onClick={() => editor.chain().focus().undo().run()}>↩</Btn>
        <Btn title="Yinele" onClick={() => editor.chain().focus().redo().run()}>↪</Btn>
      </div>
      <EditorContent editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none p-3 max-h-[50vh] overflow-y-auto [&_.ProseMirror]:min-h-[220px] [&_.ProseMirror]:outline-none" />
    </div>
  );
}
